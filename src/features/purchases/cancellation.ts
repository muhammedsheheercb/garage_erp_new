import type { Prisma } from "@prisma/client"
import { recalculateJobCardTotals } from "../jobcards/recalculate"

export class PurchaseCancellationError extends Error {}

type CancellationPurchase = {
  purchaseType: string; jobCardId: string | null; paymentMethodId: string;
  paidAmount: number; paymeterReimbursed: number;
  items: Array<{ inventoryId: string; quantity: number; purchasePrice: number; sellingPrice: number }>;
  purchasePayments: Array<{ paymeterId: string; amount: number; paidAmount: number; pendingAmount: number }>;
  batches: Array<{ id: string; inventoryId: string; quantity: number; purchasePrice: number; sellingPrice: number;
    directSaleItems: unknown[];
    jobCardParts: Array<{ id: string; jobCardId: string; jobCard: { status: string } }> }>;
}

// Validate the whole reversal before writing anything. The caller uses a serializable transaction.
export function planPurchaseCancellation(purchase: CancellationPurchase) {
  const fail = (message: string): never => { throw new PurchaseCancellationError(message) }
  if (purchase.paymeterReimbursed > 0 || purchase.purchasePayments.some(p => p.paidAmount > 0)) {
    fail("This purchase has reimbursed payments whose settlement history cannot be safely reversed. Resolve the reimbursements before cancelling.")
  }
  const key = (item: { inventoryId: string; purchasePrice: number; sellingPrice: number }) =>
    JSON.stringify([item.inventoryId, item.purchasePrice, item.sellingPrice])
  const quantities = new Map<string, number>()
  for (const item of purchase.items) quantities.set(key(item), (quantities.get(key(item)) || 0) + item.quantity)
  for (const batch of purchase.batches) {
    if (batch.directSaleItems.length) fail("Parts from this purchase have been sold. Reverse the sale before cancelling.")
    for (const part of batch.jobCardParts) {
      if (["COMPLETED", "CANCELLED"].includes(part.jobCard.status)) fail("This purchase supplies a completed or cancelled job card and cannot be cancelled.")
      if (purchase.purchaseType === "STOCK" || part.jobCardId !== purchase.jobCardId) {
        fail("Parts from this purchase are reserved on another job card. Remove those reservations before cancelling.")
      }
    }
    quantities.set(key(batch), (quantities.get(key(batch)) || 0) - batch.quantity)
  }
  if (!purchase.batches.length || [...quantities.values()].some(q => q !== 0)) {
    fail("Stock from this purchase has been used or changed. Restore the stock before cancelling.")
  }
  const supplierPayments = purchase.purchasePayments.filter(p => p.pendingAmount > 0 || p.paidAmount > 0)
  const initialAmount = purchase.paidAmount - supplierPayments.reduce((sum, p) => sum + p.amount, 0)
  if (initialAmount < -0.000001) fail("The purchase payment history needs review before cancellation.")
  const reversals = new Map<string, number>([[purchase.paymentMethodId, Math.max(0, initialAmount)]])
  for (const payment of supplierPayments) reversals.set(payment.paymeterId, (reversals.get(payment.paymeterId) || 0) + payment.amount)
  return [...reversals].sort(([a], [b]) => a.localeCompare(b))
}

export async function reversePurchase(tx: Prisma.TransactionClient, id: string, cancelledBy: string) {
  if (await tx.purchaseCancellation.findUnique({ where: { id } })) return
  const purchase = await tx.purchase.findUnique({ where: { id }, include: {
    supplier: true, paymentMethod: true, items: { include: { inventory: true } }, purchasePayments: true,
    batches: { include: { directSaleItems: true, jobCardParts: { include: { jobCard: { select: { status: true } } } } } },
  } })
  if (!purchase) throw new PurchaseCancellationError("Purchase not found. Refresh the purchase list.")
  const reversals = planPurchaseCancellation(purchase)
  if (purchase.jobCardId && purchase.purchaseType !== "STOCK") {
    const job = await tx.jobCard.findUnique({ where: { id: purchase.jobCardId }, select: { status: true } })
    if (!job || ["COMPLETED", "CANCELLED"].includes(job.status)) {
      throw new PurchaseCancellationError("This purchase's job card is completed, cancelled, or missing.")
    }
  }
  for (const [paymeterId, amount] of reversals) {
    if (amount <= 0) continue
    const result = await tx.paymeter.updateMany({ where: { id: paymeterId, spentAmount: { gte: amount } }, data: { spentAmount: { decrement: amount } } })
    if (result.count !== 1) throw new PurchaseCancellationError("The payment ledger has already been settled. Resolve that settlement before cancelling.")
  }
  for (const batch of purchase.batches) {
    for (const part of batch.jobCardParts) {
      if (purchase.purchaseType === "PENDING_PARTS") {
        await tx.jobCardPart.update({ where: { id: part.id }, data: { batchId: null, inventoryId: batch.inventoryId, isPending: true } })
      } else {
        await tx.jobCardPart.delete({ where: { id: part.id } })
      }
    }
  }
  await tx.purchaseCancellation.create({ data: {
    id, purchaseNumber: purchase.purchaseNumber, supplierName: purchase.supplier.name,
    purchaseDate: purchase.purchaseDate, grandTotal: purchase.grandTotal,
    paidAmount: purchase.paidAmount, pendingAmount: purchase.pendingAmount, cancelledBy,
    snapshot: JSON.parse(JSON.stringify(purchase)) as Prisma.InputJsonValue,
  } })
  // Cascades remove purchase items, payments and batches after their job-card links are reversed.
  await tx.purchase.delete({ where: { id } })
  if (purchase.jobCardId && purchase.purchaseType !== "STOCK") await recalculateJobCardTotals(tx, purchase.jobCardId)
}
