/** Shared batch availability rule for Job Cards and Direct Sales.
 * Completed sales/jobs are already deducted from `quantity`; open Job Cards reserve stock. */
export function batchAvailability(batch: { quantity: number; jobCardParts: Array<{ quantity: number }> }) {
  const reservedQuantity = batch.jobCardParts.reduce((sum, part) => sum + part.quantity, 0)
  return { reservedQuantity, availableQuantity: Math.max(0, batch.quantity - reservedQuantity) }
}
