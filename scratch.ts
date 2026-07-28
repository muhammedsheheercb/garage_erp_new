import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const paymeters = await prisma.paymeter.findMany({
    include: {
      purchasePayments: true
    }
  })
  
  console.log(JSON.stringify(paymeters, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
