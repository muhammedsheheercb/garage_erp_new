// Service prices are line amounts; part prices are per unit.
// Keep this calculation shared by the form and the authoritative server save.
export function calculateJobCardTotals(data: {
  services: Array<{ price: number }>
  parts: Array<{ quantity: number; price: number }>
  otherCharges: Array<{ amount: number }>
  discount?: number
  tax?: number
}) {
  const serviceTotal = data.services.reduce((sum, service) => sum + service.price, 0)
  const partsTotal = data.parts.reduce((sum, part) => sum + part.quantity * part.price, 0)
  const otherTotal = data.otherCharges.reduce((sum, charge) => sum + charge.amount, 0)
  return { serviceTotal, partsTotal, grandTotal: Math.max(0, serviceTotal + partsTotal + otherTotal + (data.tax || 0) - (data.discount || 0)) }
}
