import { OrderStatus } from "../models/Order";

const VALID_STATUSES: OrderStatus[] = ["pending", "accepted", "out_for_delivery", "completed", "cancelled"];

// ?status=accepted -> "accepted"; ?status=all (or missing/invalid) -> undefined
// (meaning "don't filter by status").
export function parseStatusFilter(status: unknown): OrderStatus | undefined {
  if (typeof status !== "string") return undefined;
  return (VALID_STATUSES as string[]).includes(status) ? (status as OrderStatus) : undefined;
}

// ?dateFilter=today|last7|last30|month|custom (+ startDate/endDate for custom)
// -> a Mongo range for the `createdAt` field, or undefined for "all time".
export function parseDateFilter(
  dateFilter: unknown,
  startDate: unknown,
  endDate: unknown
): { $gte: Date; $lte: Date } | undefined {
  if (typeof dateFilter !== "string" || dateFilter === "all" || dateFilter === "") return undefined;

  const now = new Date();
  let start: Date | undefined;
  let end: Date = now;

  switch (dateFilter) {
    case "today":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "last7":
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "last30":
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "custom": {
      if (typeof startDate === "string" && startDate) start = new Date(startDate);
      if (typeof endDate === "string" && endDate) {
        end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // include the whole end day
      }
      break;
    }
    default:
      return undefined;
  }

  if (!start || Number.isNaN(start.getTime())) return undefined;
  return { $gte: start, $lte: end };
}
