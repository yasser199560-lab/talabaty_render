import { Response } from "express";
import { AuthRequest } from "../types/authRequest";
import { askAi, parseJsonReply, extractReplyText, AiClientError, Attachment } from "../utils/aiClient";
import Product from "../models/Product";
import PartnerProfile from "../models/PartnerProfile";
import Order from "../models/Order";
import User from "../models/User";

interface ChatSuggestion {
  type: "store" | "product";
  id: string;
  partnerId: string;
  name: string;
}

interface ChatReply {
  reply: string;
  suggestions: ChatSuggestion[];
}

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_HISTORY_MESSAGES = 10; // keep the request small; the widget only needs recent context

const ALLOWED_ATTACHMENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
const MAX_ATTACHMENT_BASE64_CHARS = 4_500_000; // ~3.3MB raw file, keeps the request body well under the 8mb server limit

function validateAttachment(attachment: unknown): Attachment | null {
  if (!attachment || typeof attachment !== "object") return null;
  const { mimeType, data } = attachment as { mimeType?: unknown; data?: unknown };
  if (typeof mimeType !== "string" || typeof data !== "string") return null;
  if (!ALLOWED_ATTACHMENT_TYPES.has(mimeType)) {
    throw new Error(`Unsupported file type. Please attach a PNG, JPEG, WEBP image or a PDF.`);
  }
  if (data.length > MAX_ATTACHMENT_BASE64_CHARS) {
    throw new Error("That file is too large. Please attach something under 3MB.");
  }
  return { mimeType, data };
}

const STOPWORDS = new Set([
  "the", "a", "an", "i", "need", "want", "please", "all", "you", "have", "for", "with", "me",
  "my", "to", "of", "in", "on", "at", "is", "are", "can", "do", "does", "any", "some", "get",
  "find", "show", "what", "which", "near", "nearby", "around", "give", "there", "that", "this",
  "and", "or", "hi", "hello", "hey", "yes", "please", "pleas",
]);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Pulls meaningful search terms out of the user's message, and expands
// each into likely singular/plural variants (e.g. "pharmacies" -> also
// "pharmacy") so a plural query still matches a singular category name
// stored in the database, and vice versa. This is what makes "I need all
// pharmacies you have" actually find everything tagged category:
// "Pharmacy" — a naive substring match on the raw word would miss it.
function extractSearchTerms(message: string): string[] {
  const words = message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));

  const variants = new Set<string>();
  for (const word of words) {
    variants.add(word);
    if (word.endsWith("ies") && word.length > 4) variants.add(word.slice(0, -3) + "y");
    else if (word.endsWith("es") && word.length > 3) variants.add(word.slice(0, -2));
    else if (word.endsWith("s") && word.length > 3) variants.add(word.slice(0, -1));
  }
  return Array.from(variants).slice(0, 12);
}

// Builds the catalog context a guest/customer request is grounded in. When
// the message contains identifiable search terms, this runs a real,
// targeted database query (store name/category, product title/description/
// category) so it reliably finds every match — not just whatever happened
// to fall inside a fixed-size slice of the collection. When the message is
// too generic to search on (e.g. "hello"), it falls back to a lightweight
// list of store categories so the model still has something to open with.
async function buildCatalogContext(message: string): Promise<string> {
  const activePartnerUserIds = await User.find({ role: "partner", status: "active" }).distinct("_id");
  const terms = extractSearchTerms(message);

  let stores: { _id: unknown; storeName: string; category?: string; rating?: number; deliveryTime?: string }[];
  let products: { _id: unknown; title: string; description?: string; price: number; category?: string; partnerId: unknown }[];

  if (terms.length > 0) {
    const pattern = terms.map(escapeRegex).join("|");
    const regex = { $regex: pattern, $options: "i" };

    stores = await PartnerProfile.find({
      userId: { $in: activePartnerUserIds },
      $or: [{ storeName: regex }, { category: regex }],
    })
      .select("_id storeName category rating deliveryTime")
      .limit(25);

    const allActiveStoreIds = await PartnerProfile.find({ userId: { $in: activePartnerUserIds } }).distinct("_id");
    products = await Product.find({
      partnerId: { $in: allActiveStoreIds },
      isActive: true,
      $or: [{ title: regex }, { description: regex }, { category: regex }],
    })
      .select("_id title description price category partnerId")
      .limit(40);

    // A matching product's store might not itself match on name/category
    // (e.g. searching a dish name at a generically-named restaurant) — pull
    // those stores in too so every [store:id] referenced below is resolvable.
    const knownStoreIds = new Set(stores.map((s) => String(s._id)));
    const missingStoreIds = [...new Set(products.map((p) => String(p.partnerId)))].filter((id) => !knownStoreIds.has(id));
    if (missingStoreIds.length > 0) {
      const extraStores = await PartnerProfile.find({ _id: { $in: missingStoreIds } }).select(
        "_id storeName category rating deliveryTime"
      );
      stores = [...stores, ...extraStores];
    }
  } else {
    // Generic message with no searchable terms — give a light overview
    // instead of dumping the whole catalog.
    stores = await PartnerProfile.find({ userId: { $in: activePartnerUserIds } })
      .select("_id storeName category rating deliveryTime")
      .limit(15);
    products = [];
  }

  const storeLines = stores
    .map((s) => `- [store:${s._id}] "${s.storeName}" | category: ${s.category ?? "—"} | rating: ${s.rating ?? "—"} | delivery: ${s.deliveryTime ?? "—"}`)
    .join("\n");

  const productLines = products
    .map((p) => `- [product:${p._id}] "${p.title}" | store:${p.partnerId} | price: $${p.price.toFixed(2)} | category: ${p.category ?? "—"}${p.description ? ` | ${p.description}` : ""}`)
    .join("\n");

  const note =
    terms.length > 0
      ? `(results matched against: ${terms.join(", ")})`
      : "(no specific search terms detected in the message — this is a general overview; ask a follow-up question to narrow it down)";

  return `STORES ${note}:\n${storeLines || "(no matching stores found — say so honestly rather than guessing)"}\n\nPRODUCTS ${note}:\n${productLines || "(no matching products found, or none searched for)"}`;
}

async function buildCustomerOrderContext(customerId: string): Promise<string> {
  const orders = await Order.find({ customerId }).sort({ createdAt: -1 }).limit(5);
  if (orders.length === 0) return "This customer has no past orders yet.";
  return orders
    .map((o) => {
      const items = o.items.map((i) => `${i.quantity}x ${i.title}`).join(", ");
      return `- Order ${o._id} | ${o.orderStatus} | ${new Date(o.createdAt).toLocaleDateString()} | $${o.totalAmount.toFixed(2)} | items: ${items}`;
    })
    .join("\n");
}

async function buildPartnerContext(userId: string): Promise<string> {
  const profile = await PartnerProfile.findOne({ userId });
  if (!profile) return "This partner has not completed their store profile yet.";

  const products = await Product.find({ partnerId: profile._id }).select("title price category isActive");
  const recentOrders = await Order.find({ partnerId: profile._id }).sort({ createdAt: -1 }).limit(10);

  const statusCounts = recentOrders.reduce<Record<string, number>>((acc, o) => {
    acc[o.orderStatus] = (acc[o.orderStatus] || 0) + 1;
    return acc;
  }, {});

  return [
    `Store: "${profile.storeName}" (${profile.category ?? "uncategorized"})`,
    `Live items: ${products.length} (${products.filter((p) => p.isActive).length} active)`,
    `Recent order status breakdown (last ${recentOrders.length}): ${JSON.stringify(statusCounts)}`,
  ].join("\n");
}

const JSON_SHAPE_INSTRUCTIONS = `
Respond with ONLY valid JSON, no markdown fences, no commentary outside the JSON, in exactly this shape:
{"reply": "your conversational reply as plain text", "suggestions": [{"type": "store" | "product", "id": "the id after the colon in the bracketed tag, e.g. from [store:abc123] use abc123", "partnerId": "the store id this belongs to (same as id if type is store)", "name": "display name"}]}
"suggestions" should be an empty array [] if nothing specific applies. Only include suggestions that come directly from the STORES/PRODUCTS data given to you — never invent an id.
`.trim();

// Ground-truth reference for "how does the site work" questions, kept in
// sync with what the platform's code actually does (not marketing copy).
// This is what lets the assistant answer general site questions, not just
// "recommend me a restaurant".
const PLATFORM_FAQ = `
TALABATY PLATFORM FACTS (use these to answer general "how does this work" questions accurately; never invent policies, fees, or features not listed here):
- Talabaty is a delivery marketplace connecting customers with restaurants, supermarkets, pharmacies, bakeries, and fashion stores.
- Customer flow: browse stores by category or search -> open a store -> add items to cart -> checkout, choosing Cash on Delivery (COD) or Whish Money as the payment method -> track the order.
- Order statuses, in order: pending (just placed) -> accepted (store confirmed it) -> out_for_delivery -> completed. An order can also be cancelled. Customers view this under "My Orders".
- Customer account pages: Profile, Settings, Addresses (saved delivery addresses), Payment Methods, Support, Orders.
- To sign up: use the Register page for a customer account, or "Register as a partner" for a store account.
- Partner flow: register a partner account -> complete the Store Profile (store name, address, phone, category, delivery time estimate) -> the account is "pending" until an admin approves it -> once "active", the store is visible to customers and the partner can manage items (My Items), view orders (Partner Orders), and edit their profile.
- Forgot password: the site emails a 6-digit verification code (not a reset link) that expires in 10 minutes, then a short-lived reset session — this protects the account even if someone knows the email address.
- Admin accounts manage the platform (approving partners, freezing/unfreezing accounts, monitoring listings) — this isn't available to customers or partners.
- If asked something about the site you're not certain of from this list or the data you were given, say so plainly rather than guessing, and suggest the person check the relevant dashboard page or contact support.
`.trim();

const TONE_INSTRUCTIONS = `
Tone: always professional, clear, and courteous — like a knowledgeable member of Talabaty's support team. Use complete, well-formed sentences and correct grammar. Be warm but not overly casual: avoid slang, excessive exclamation points, and emojis. Keep replies concise and well-organized. When a request would match many stores or products, mention no more than 5-6 of the best matches rather than listing everything, and offer to narrow it down further. If you don't know something, say so professionally rather than guessing.
Formatting: the reply text supports light markdown, rendered nicely on screen — use "- " for bullet points, "1. " for numbered steps, and **bold** for emphasis where it genuinely improves clarity (e.g. store names in a list). Don't overuse formatting for short answers; plain sentences are best when a list isn't needed.
`.trim();

const ATTACHMENT_INSTRUCTIONS = `
The user has attached a file (image or PDF) to this message — read it carefully before replying. Useful things to do with it, depending on who's asking and what it contains:
- A partner sharing a menu, price list, or catalog: extract the items you can clearly read, listed as "- Item name — price" if prices are visible, and mention they can add these under My Items. Don't invent items or prices that aren't legible.
- A customer sharing a prescription or product photo: describe what you can identify and help them find a matching pharmacy or product from the catalog data above, without giving medical advice.
- Anything else: describe what's relevant in the file and answer the user's question about it.
If the file is unclear, blurry, or you're not confident about part of it, say so honestly rather than guessing.
`.trim();

export const chatWithAssistant = async (req: AuthRequest, res: Response) => {
  const { message, history, attachment: rawAttachment } = req.body as {
    message?: string;
    history?: IncomingMessage[];
    attachment?: unknown;
  };

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ message: "message is required" });
  }
  if (message.length > 1000) {
    return res.status(400).json({ message: "message is too long (max 1000 characters)" });
  }

  let attachment: Attachment | null = null;
  try {
    attachment = validateAttachment(rawAttachment);
  } catch (validationError) {
    return res.status(400).json({ message: (validationError as Error).message });
  }

  try {
    let system: string;

    if (req.user?.role === "partner") {
      const partnerContext = await buildPartnerContext(req.user.id);
      system = `You are Talabaty's assistant, currently helping a logged-in PARTNER (store owner) manage their store on the Talabaty delivery marketplace (restaurants, supermarkets, pharmacies, bakeries, and fashion stores).
You can help with two kinds of questions: (1) specific questions about their own store, using the data below, and (2) general questions about how Talabaty works as a platform, using the platform facts below. You do not have the ability to change data yourself — for edits, point them to the relevant dashboard page (My items, Store profile, Orders).

Their store data:
${partnerContext}

${PLATFORM_FAQ}

${TONE_INSTRUCTIONS}
${attachment ? `\n${ATTACHMENT_INSTRUCTIONS}\n` : ""}
${JSON_SHAPE_INSTRUCTIONS}`;
    } else {
      const catalogContext = await buildCatalogContext(message);
      const orderContext = req.user
        ? await buildCustomerOrderContext(req.user.id)
        : "This visitor is not logged in, so no order history is available. If they ask about tracking an order, suggest they log in.";

      system = `You are Talabaty's assistant, helping ${req.user ? "a logged-in CUSTOMER" : "a GUEST visitor (not logged in)"} on a food/grocery/pharmacy delivery marketplace.
You can help with two kinds of questions: (1) discovering stores and products from the real catalog below, and questions about their own past orders if relevant, and (2) general questions about how Talabaty works as a platform (ordering, payment methods, account setup, becoming a partner, etc.), using the platform facts below. Only recommend stores/products that appear in the catalog data — never invent one.

${catalogContext}

CUSTOMER ORDER HISTORY:
${orderContext}

${PLATFORM_FAQ}

${TONE_INSTRUCTIONS}
${attachment ? `\n${ATTACHMENT_INSTRUCTIONS}\n` : ""}
${JSON_SHAPE_INSTRUCTIONS}`;
    }

    const trimmedHistory = (history || []).slice(-MAX_HISTORY_MESSAGES).map((m) => ({
      role: m.role,
      content: String(m.content).slice(0, 1000),
    }));

    const raw = await askAi({
      system,
      messages: [...trimmedHistory, { role: "user", content: message }],
      maxTokens: attachment ? 1400 : 1024,
      attachment: attachment || undefined,
    });

    let parsed: ChatReply;
    try {
      parsed = parseJsonReply<ChatReply>(raw);
      if (!parsed.reply) throw new Error("missing reply field");
      if (!Array.isArray(parsed.suggestions)) parsed.suggestions = [];
    } catch {
      // Model didn't return valid JSON — usually a truncated response on a
      // long list. Try to salvage just the reply text; if even that isn't
      // there, fall back to a clean apology rather than showing broken JSON.
      const salvaged = extractReplyText(raw);
      parsed = {
        reply: salvaged || "I'm sorry, I wasn't able to put together a complete answer that time. Could you rephrase your question, or ask for fewer results at once?",
        suggestions: [],
      };
    }

    res.json(parsed);
  } catch (error) {
    if (error instanceof AiClientError) {
      console.error("[assistant/chat]", error.message);
      return res.status(502).json({ message: "The assistant is temporarily unavailable. Please try again shortly." });
    }
    throw error;
  }
};

// POST /api/assistant/generate-description — partner-only. Turns a rough
// item name/hint into a polished title + description + suggested category.
export const generateProductCopy = async (req: AuthRequest, res: Response) => {
  const { hint } = req.body as { hint?: string };

  if (!hint || typeof hint !== "string" || !hint.trim()) {
    return res.status(400).json({ message: "hint is required (a rough description of the item)" });
  }
  if (hint.length > 500) {
    return res.status(400).json({ message: "hint is too long (max 500 characters)" });
  }

  const system = `You write short, appetizing product listings for a food/grocery/pharmacy delivery marketplace called Talabaty. Given a partner's rough description of an item, produce a polished listing.
Respond with ONLY valid JSON, no markdown fences, no commentary, in exactly this shape:
{"title": "short catchy item title, under 8 words", "description": "1-2 appealing sentences, under 200 characters", "category": "one of: Restaurant, Supermarket, Pharmacy, Fashion, Bakery — pick the closest fit"}`;

  try {
    const raw = await askAi({
      system,
      messages: [{ role: "user", content: hint }],
      maxTokens: 300,
    });

    const parsed = parseJsonReply<{ title: string; description: string; category: string }>(raw);
    res.json(parsed);
  } catch (error) {
    if (error instanceof AiClientError) {
      console.error("[assistant/generate-description]", error.message);
      return res.status(502).json({ message: "The assistant is temporarily unavailable. Please try again shortly." });
    }
    console.error("[assistant/generate-description]", error);
    res.status(502).json({ message: "Couldn't generate a listing from that description. Try rephrasing." });
  }
};
