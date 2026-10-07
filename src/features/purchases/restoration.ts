import type { Prisma } from "@prisma/client"
import { z } from "zod"
import { planPurchaseCancellation, PurchaseCancellationError } from "./cancellation"
import { recalculateJobCardTotals } from "../jobcards/recalculate"

const dates = { createdAt: z.coerce.date(), updatedAt: z.coerce.date() }
const itemSchema = z.object({ id: z.string(), inventoryId: z.string(), quantity: z.number().int().positive(),
  purchasePrice: z.number(), sellingPrice: z.number(), taxRate: z.number(), taxAmount: z.number(), itemTotal: z.number(), ...dates })
const partSchema = z.object({ id: z.string(), jobCardId: z.string(), inventoryId: z.string().nullable(),
  isPending: z.boolean(), quantity: z.number().int().positive(), price: z.number(), ...dates,
  jobCard: z.object({ status: z.string() }) })
const snapshotSchema = z.object({
  id: z.string(), purchaseNumber: z.string(), purchaseDate: z.coerce.date(), purchaseType: z.enum(['STOCK', 'VEHICLE', 'PENDING_PARTS']),
  jobCardId: z.string().nullable(), supplierId: z.string(), paymentMethodId: z.string(),
  subTotal: z.number(), taxRate: z.number(), taxAmount: z.number(), discount: z.number(),
  grandTotal: z.number(), paidAmount: z.number(), pendingAmount: z.number(), paymeterReimbursed: z.number(),
  createdBy: z.string().nullable(), ...dates,
  items: z.array(itemSchema),
  purchasePayments: z.array(z.object({ id: z.string(), paymeterId: z.string(), amount: z.number(),
    paidAmount: z.number(), pendingAmount: z.number(), date: z.coerce.date(), ...dates })),
  batches: z.array(z.object({ id: z.string(), inventoryId: z.string(), batchNumber: z.string(), quantity: z.number().int(),
    purchasePrice: z.number(), sellingPrice: z.number(), ...dates,
    directSaleItems: z.array(z.unknown()), jobCardParts: z.array(partSchema) })),
})

export async function restoreCancelledPurchase(tx: Prisma.TransactionClient, id: string, restoredBy: string) {
  const archive = await tx.purchaseCancellation.findUnique({ where: { id } })
  if (!archive) throw new PurchaseCancellationError('Cancelled purchase not found. Refresh the list.')
  if (archive.restoredAt) return // Repeated requests must never add the stock or payments twice.
  const parsed = snapshotSchema.safeParse(archive.snapshot)
  if (!parsed.success) throw new PurchaseCancellationError('The saved purchase details are incomplete. This purchase needs review before restoration.')
  const purchase = parsed.data
  if (purchase.id !== id || purchase.purchaseNumber !== archive.purchaseNumber) {
    throw new PurchaseCancellationError('The saved purchase details do not match this cancellation.')
  }
  const ledgerAmounts = planPurchaseCancellation(purchase)
  const ledgerIds = [...new Set([purchase.paymentMethodId, ...purchase.purchasePayments.map(payment => payment.paymeterId)])]
  if (await tx.paymeter.count({ where: { id: { in: ledgerIds } } }) !== ledgerIds.length) {
    throw new PurchaseCancellationError('An original payment ledger no longer exists. Restore that ledger first.')
  }
  if (await tx.purchase.findFirst({ where: { OR: [{ id }, { purchaseNumber: purchase.purchaseNumber }] } })) {
    throw new PurchaseCancellationError('This purchase already exists. Refresh the list before restoring.')
  }
  if (!await tx.supplier.findUnique({ where: { id: purchase.supplierId } })) {
    throw new PurchaseCancellationError('The original supplier no longer exists. Restore the supplier first.')
  }
  const inventoryIds = [...new Set(purchase.items.map(item => item.inventoryId))]
  if (await tx.inventory.count({ where: { id: { in: inventoryIds } } }) !== inventoryIds.length) {
    throw new PurchaseCancellationError('An original inventory item no longer exists. Restore that item first.')
  }
  if (purchase.jobCardId) {
    const job = await tx.jobCard.findUnique({ where: { id: purchase.jobCardId }, select: { status: true } })
    if (!job || ['COMPLETED', 'CANCELLED'].includes(job.status)) {
      throw new PurchaseCancellationError('The original job card is completed, cancelled, or missing. The purchase cannot be restored.')
    }
  }
  for (const batch of purchase.batches) {
    for (const part of batch.jobCardParts) {
      const current = await tx.jobCardPart.findUnique({ where: { id: part.id } })
      if (purchase.purchaseType === 'PENDING_PARTS') {
        if (!current || !current.isPending || current.batchId !== null || current.jobCardId !== part.jobCardId ||
          current.inventoryId !== batch.inventoryId || current.quantity !== part.quantity || current.price !== part.price) {
          throw new PurchaseCancellationError('The pending parts have been changed, removed, or purchased again. Resolve those changes before restoring.')
        }
      } else if (current) {
        throw new PurchaseCancellationError('The original vehicle part already exists. Resolve that conflict before restoring.')
      }
      if (purchase.purchaseType === 'VEHICLE' && await tx.jobCardPart.findFirst({ where: {
        jobCardId: part.jobCardId, isPending: false,
        OR: [{ inventoryId: batch.inventoryId }, { batch: { inventoryId: batch.inventoryId } }],
      } })) {
        throw new PurchaseCancellationError('Replacement parts are already allocated to this vehicle. Resolve those parts before restoring.')
      }
    }
  }
  const { items, batches, purchasePayments, ...purchaseData } = purchase
  await tx.purchase.create({ data: purchaseData })
  for (const item of items) await tx.purchaseItem.create({ data: { ...item, purchaseId: id } })
  for (const batch of batches) {
    const { jobCardParts, directSaleItems, ...batchData } = batch
    if (directSaleItems.length) throw new PurchaseCancellationError('Sold stock cannot be restored from this cancellation.')
    await tx.inventoryBatch.create({ data: { ...batchData, purchaseId: id } })
    for (const part of jobCardParts) {
      const { jobCard, ...partData } = part
      if (['COMPLETED', 'CANCELLED'].includes(jobCard.status)) throw new PurchaseCancellationError('Completed job parts cannot be restored.')
      if (purchase.purchaseType === 'PENDING_PARTS') {
        await tx.jobCardPart.update({ where: { id: part.id }, data: { ...partData, batchId: batch.id } })
      } else {
        await tx.jobCardPart.create({ data: { ...partData, batchId: batch.id } })
      }
    }
  }
  for (const payment of purchasePayments) await tx.purchasePayment.create({ data: { ...payment, purchaseId: id } })
  for (const [paymeterId, amount] of ledgerAmounts) {
    if (amount > 0) await tx.paymeter.update({ where: { id: paymeterId }, data: { spentAmount: { increment: amount } } })
  }
  if (purchase.jobCardId && purchase.purchaseType !== 'STOCK') await recalculateJobCardTotals(tx, purchase.jobCardId)
  await tx.purchaseCancellation.update({ where: { id }, data: { restoredAt: new Date(), restoredBy } })
}
