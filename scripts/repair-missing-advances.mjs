import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    // Only repair cards with no receipts, so existing payments are never counted twice.
    const jobs = await tx.jobCard.findMany({
      where: { advancePaid: { gt: 0 }, payments: { none: {} } },
    })
    if (!process.argv.includes('--apply')) {
      return jobs.map((job) => ({ jobCardId: job.id, amount: job.advancePaid }))
    }
    for (const job of jobs) {
      await tx.payment.create({
        data: {
          jobCardId: job.id,
          amount: job.advancePaid,
          method: 'ADVANCE',
          createdBy: job.createdBy,
          paymentDate: job.date,
          createdAt: job.createdAt,
          grandTotalAtPayment: job.grandTotal,
          totalPaidAtPayment: job.advancePaid,
          balanceAfterPayment: Math.max(0, job.grandTotal - job.advancePaid),
        },
      })
    }
    return { repaired: jobs.length, amount: jobs.reduce((sum, job) => sum + job.advancePaid, 0) }
  }, { isolationLevel: 'Serializable' })
  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
}).finally(() => prisma.$disconnect())
