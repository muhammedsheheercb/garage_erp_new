type SavedPayment = { paymentMethodId?: string; paymentMethod?: { name: string } | null }

export function getPurchasePaymentSelection(purchase: SavedPayment) {
  const name = purchase.paymentMethod?.name.trim().toLowerCase()
  const directMethod = name === "direct cash" ? "CASH" as const
    : name === "direct bank transfer" ? "BANK_TRANSFER" as const
    : name === "card" || name === "direct card" ? "CARD" as const : undefined
  return {
    paymentSource: directMethod ? "DIRECT" as const : "PAYMETER" as const,
    paymentMethodId: directMethod ? "" : purchase.paymentMethodId || "",
    directPaymentMethod: directMethod,
  }
}
