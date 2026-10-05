import type { Prisma } from "@prisma/client"
import type { PurchaseFormValues } from "./schema"

export async function assertPurchasableJobCard(tx: Prisma.TransactionClient, id?: string | null) {
  if (!id) return
  const job = await tx.jobCard.findUnique({ where: { id }, select: { status: true } })
  if (!job || job.status === "COMPLETED" || job.status === "CANCELLED") {
    throw new Error("Purchases cannot change a completed, cancelled, or missing job card.")
  }
}

export async function editPurchaseStock(tx: Prisma.TransactionClient, purchase: {
  id: string; purchaseNumber: string; purchaseType: string; jobCardId: string | null
}, data: PurchaseFormValues) {
  const batches = await tx.inventoryBatch.findMany({ where: { purchaseId: purchase.id },
    include: { jobCardParts: { include: { jobCard: { select: { status: true } } } }, directSaleItems: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  })
  const originalItems = await tx.purchaseItem.findMany({ where: { purchaseId: purchase.id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] })
  const oldQuantities = new Map<string, number>()
  for (const batch of batches) {
    const matching = originalItems.filter(item => item.inventoryId === batch.inventoryId &&
      item.purchasePrice === batch.purchasePrice && item.sellingPrice === batch.sellingPrice)
    if (new Set(matching.map(item => item.quantity)).size > 1) {
      throw new Error("This purchase has ambiguous stock batches and needs review before editing.")
    }
    const match = matching[0]
    const index = match ? originalItems.indexOf(match) : originalItems.findIndex(item => item.inventoryId === batch.inventoryId)
    if (index < 0) throw new Error("This purchase's stock needs review before editing.")
    oldQuantities.set(batch.id, originalItems.splice(index, 1)[0].quantity)
    if (batch.jobCardParts.some(part => part.jobCard.status === "COMPLETED")) {
      throw new Error("This purchase supplies a completed job card and cannot be edited.")
    }
  }
  if (originalItems.length) throw new Error("This purchase has missing stock batches and needs review before editing.")
  const linked = batches.some(batch => batch.jobCardParts.length > 0)
  if (linked && (purchase.purchaseType !== data.purchaseType || purchase.jobCardId !== (data.jobCardId || null))) {
    throw new Error("A purchase linked to job card parts cannot change its type or job card.")
  }
  if (purchase.purchaseType === "PENDING_PARTS" && (data.purchaseType !== "PENDING_PARTS" || purchase.jobCardId !== data.jobCardId)) {
    throw new Error("A pending-parts purchase cannot change its type or job card.")
  }
  for (const item of data.items) {
    const index = batches.findIndex(batch => batch.inventoryId === item.inventoryId)
    const batch = index >= 0 ? batches.splice(index, 1)[0] : undefined
    if (!batch) {
      if (data.purchaseType === "PENDING_PARTS") throw new Error("Edit the existing purchased pending items; purchase additional pending parts separately.")
      const added = await tx.inventoryBatch.create({ data: {
        inventoryId: item.inventoryId, quantity: item.quantity, purchasePrice: item.purchasePrice,
        sellingPrice: item.sellingPrice, purchaseId: purchase.id, batchNumber: purchase.purchaseNumber,
      } })
      if (data.purchaseType === "VEHICLE" && data.jobCardId) {
        await tx.jobCardPart.create({ data: { jobCardId: data.jobCardId, batchId: added.id, inventoryId: item.inventoryId, quantity: item.quantity, price: item.sellingPrice } })
      }
      continue
    }
    const quantity = batch.quantity + item.quantity - oldQuantities.get(batch.id)!
    const ownParts = data.purchaseType !== "STOCK" ? batch.jobCardParts.filter(part => part.jobCardId === data.jobCardId) : []
    if (ownParts.length > 1 || (data.purchaseType === "PENDING_PARTS" && !ownParts.length)) {
      throw new Error("This purchase's linked parts need review before editing.")
    }
    const otherReserved = batch.jobCardParts.filter(part => !ownParts.includes(part) && !part.isPending && !["COMPLETED", "CANCELLED"].includes(part.jobCard.status))
      .reduce((sum, part) => sum + part.quantity, 0)
    if (quantity < 0 || quantity < otherReserved + (ownParts.length ? item.quantity : 0)) {
      throw new Error("Purchase quantity cannot be reduced below stock already used or reserved.")
    }
    await tx.inventoryBatch.update({ where: { id: batch.id }, data: { quantity, purchasePrice: item.purchasePrice, sellingPrice: item.sellingPrice } })
    for (const part of ownParts) {
      await tx.jobCardPart.update({ where: { id: part.id }, data: { quantity: item.quantity, price: item.sellingPrice } })
    }
    if (!ownParts.length && data.purchaseType === "VEHICLE" && data.jobCardId) {
      if (quantity < otherReserved + item.quantity) throw new Error("This stock has already been used or reserved.")
      await tx.jobCardPart.create({ data: { jobCardId: data.jobCardId, batchId: batch.id, inventoryId: item.inventoryId, quantity: item.quantity, price: item.sellingPrice } })
    }
  }
  for (const batch of batches) {
    if (batch.jobCardParts.length || batch.directSaleItems.length || batch.quantity !== oldQuantities.get(batch.id)) {
      throw new Error("Items already used or linked to a job card cannot be removed from the purchase.")
    }
    await tx.inventoryBatch.delete({ where: { id: batch.id } })
  }
}
