import type { Prisma } from "@prisma/client"

export async function deductCompletionStock(tx: Prisma.TransactionClient, jobCardId: string,
  parts: Array<{ batchId: string; quantity: number; isPending: boolean }>) {
  const quantities = new Map<string, number>()
  for (const part of parts) {
    if (part.isPending) throw new Error("Purchase pending parts before completing this job card.")
    if (!part.batchId) throw new Error("Select a stock batch before completing this job card.")
    quantities.set(part.batchId, (quantities.get(part.batchId) || 0) + part.quantity)
  }
  for (const [id, quantity] of [...quantities].sort(([a], [b]) => a.localeCompare(b))) {
    const batch = await tx.inventoryBatch.findUnique({ where: { id }, include: {
      jobCardParts: { where: { jobCardId: { not: jobCardId }, isPending: false,
        jobCard: { status: { notIn: ["COMPLETED", "CANCELLED"] } } } },
    } })
    if (!batch) throw new Error("A selected part's stock batch no longer exists.")
    const reserved = batch.jobCardParts.reduce((sum, part) => sum + part.quantity, 0)
    const updated = await tx.inventoryBatch.updateMany({
      where: { id, quantity: { gte: quantity + reserved } },
      data: { quantity: { decrement: quantity } },
    })
    if (updated.count !== 1) throw new Error("Stock changed or is reserved by another job card. Refresh the parts before completing this job card.")
  }
}
