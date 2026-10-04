import { format } from "date-fns"

export function parseSettlementDate(value: string): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("A valid payment date is required")
  }

  const date = new Date(value + "T12:00:00")
  if (Number.isNaN(date.getTime()) || format(date, "yyyy-MM-dd") !== value) {
    throw new Error("A valid payment date is required")
  }
  if (value > format(new Date(), "yyyy-MM-dd")) {
    throw new Error("Payment date cannot be in the future")
  }
  return date
}
