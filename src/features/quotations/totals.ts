export function calculateQuotationTotals(data: {
  services: Array<{ price: number; quantity: number }>
  parts: Array<{ price: number; quantity: number }>
}) {
  const serviceTotal = data.services.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const partsTotal = data.parts.reduce((sum, item) => sum + item.price * item.quantity, 0)
  return { serviceTotal, partsTotal, grandTotal: serviceTotal + partsTotal }
}
