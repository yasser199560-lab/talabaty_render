// Thin wrapper around two free LLM providers: Gemini (primary) and Groq
// (silent fallback). Kept dependency-free (uses Node's built-in fetch).
//
// Why two providers: any single free API can rate-limit or have an outage.
// If Gemini fails for any reason, this automatically retries on Groq
// without the user ever seeing an error — they just get a slightly
// different (but still good) answer. Both are free, no-card providers:
// - Gemini: https://aistudio.google.com/app/apikey
// - Groq:   https://console.groq.com/keys
//
// Google moved from "Standard" keys (AIzaSy..., sent as a ?key= query
// param) to "Auth" keys (AQ...., sent as an x-goog-api-key header) during
// 2026 — every key AI Studio issues now is the new Auth format.

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
// gemini-2.5-flash was retired for new API keys as of late 2026 — Google's
// error message points to this as the replacement. If this ever 404s
// again, check https://ai.google.dev/gemini-api/docs/models for the
// current free-tier Flash model name and swap it in here.
const GEMINI_MODEL = "gemini-3.6-flash";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

// A file the user attached to their message — an image (menu photo,
// prescription, product photo) or a PDF (price list, catalog). Sent as
// base64 with no "data:...;base64," prefix (the frontend strips it).
// Only Gemini can read attachments; if the request falls back to Groq,
// the attachment is dropped and the model is told to say so rather than
// silently ignoring what the user shared.
export interface Attachment {
  mimeType: string;
  data: string;
}

interface AskAiOptions {
  system: string;
  messages: ChatTurn[];
  maxTokens?: number;
  attachment?: Attachment; // applies to the last message in `messages`
}

export class AiClientError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "AiClientError";
  }
}

async function askGemini({ system, messages, maxTokens = 700, attachment }: AskAiOptions): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiClientError("GEMINI_API_KEY is not set on the server");
  }

  const url = `${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent`;

  const contents = messages.map((m, idx) => {
    const parts: Record<string, unknown>[] = [{ text: m.content }];
    const isLastUserTurn = idx === messages.length - 1 && m.role === "user";
    if (isLastUserTurn && attachment) {
      parts.push({ inline_data: { mime_type: attachment.mimeType, data: attachment.data } });
    }
    return {
      role: m.role === "assistant" ? "model" : "user",
      parts,
    };
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new AiClientError(`Gemini API error (${response.status}): ${body}`, response.status);
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// Groq's free tier is text-only (no document/image understanding on the
// free models), so this never receives an attachment — the caller strips
// it and adjusts the system prompt before falling back here.
async function askGroq({ system, messages, maxTokens = 700 }: AskAiOptions): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new AiClientError("GROQ_API_KEY is not set on the server");
  }

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "system", content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new AiClientError(`Groq API error (${response.status}): ${body}`, response.status);
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

// Public entry point: tries Gemini first, and if that throws for any
// reason (rate limit, outage, bad key), silently retries on Groq instead
// of surfacing an error to the user. Only throws if both fail (or if
// GROQ_API_KEY isn't configured, in which case there's nothing to fall
// back to and the original Gemini error is thrown as before).
export async function askAi(options: AskAiOptions): Promise<string> {
  try {
    return await askGemini(options);
  } catch (geminiError) {
    const message = geminiError instanceof Error ? geminiError.message : String(geminiError);
    if (!process.env.GROQ_API_KEY) {
      throw geminiError;
    }
    console.error("[aiClient] Gemini failed, falling back to Groq:", message);

    try {
      const fallbackOptions: AskAiOptions = options.attachment
        ? {
            ...options,
            attachment: undefined,
            system: `${options.system}\n\nNote: the user attached a file with their message, but it isn't available to you right now due to a temporary issue. Politely let them know you can't view the attachment at the moment and ask them to describe its contents or try attaching it again shortly.`,
          }
        : options;
      const text = await askGroq(fallbackOptions);
      console.error("[aiClient] Groq fallback succeeded");
      return text;
    } catch (groqError) {
      const groqMessage = groqError instanceof Error ? groqError.message : String(groqError);
      console.error("[aiClient] Groq fallback also failed:", groqMessage);
      // Surface the original Gemini error — it's the primary provider and
      // usually the more informative one.
      throw geminiError;
    }
  }
}

// Strips ```json fences if the model wraps its output despite instructions,
// and parses. Throws if the result still isn't valid JSON.
export function parseJsonReply<T>(raw: string): T {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned) as T;
}

// Last-resort fallback for when the model's output isn't valid JSON at all
// (usually because it got cut off mid-generation on a long list). Pulls
// just the "reply" field's text out with a regex so the user sees a clean
// message instead of a raw, broken JSON blob. Returns null if even that
// fails, so the caller can show a generic apology instead.
export function extractReplyText(raw: string): string | null {
  const match = raw.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!match) return null;
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return null;
  }
}
