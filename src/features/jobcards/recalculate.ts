import type { Prisma } from "@prisma/client"
import { calculateJobCardTotals } from "./totals"

export async function recalculateJobCardTotals(tx: Prisma.TransactionClient, id: string) {
  const job = await tx.jobCard.findUnique({ where: { id }, include: { services: true, parts: true } })
  if (!job) return
  let otherCharges: Array<{ amount: number }> = []
  if (job.otherCharges) {
    const charges: unknown = JSON.parse(job.otherCharges)
    if (Array.isArray(charges)) {
      otherCharges = charges.map(charge => ({ amount: Math.max(0, Number(charge.amount) || 0) }))
    }
  }
  await tx.jobCard.update({ where: { id }, data: calculateJobCardTotals({ ...job, otherCharges }) })
}
