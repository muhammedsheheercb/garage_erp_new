export function paymentChannel(method?: string | null): string {
  switch (method?.trim().toUpperCase()) {
    case "CASH":
    case "DIRECT CASH":
      return "Total Cash Amount"
    case "CARD":
    case "DIRECT CARD":
      return "Total Card Amount"
    case "TRANSFER":
    case "BANK_TRANSFER":
    case "BANK TRANSFER":
    case "DIRECT BANK TRANSFER":
      return "Total Bank Transfer Amount"
    default:
      return "Other / Unspecified"
  }
}

export function emptyPaymentBreakdown(): Record<string, number> {
  return {
    "Total Card Amount": 0,
    "Total Cash Amount": 0,
    "Total Bank Transfer Amount": 0,
  }
}

export function receiptMethod(payment: { method: string; receivedMethod?: string | null }) {
  return payment.method === "ADVANCE" ? payment.receivedMethod : payment.method
}

export function receiptMethodLabel(payment: { method: string; receivedMethod?: string | null }) {
  if (payment.method !== "ADVANCE") return payment.method
  const label = payment.receivedMethod === "CASH" ? "Cash" : payment.receivedMethod === "CARD" ? "Card" : payment.receivedMethod === "TRANSFER" ? "Bank Transfer" : "Unspecified"
  return `Advance (${label})`
}
