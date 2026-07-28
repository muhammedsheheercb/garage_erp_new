import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const expenses = await prisma.expense.findMany({
    where: { paymentMethod: 'PAYMETER' }
  })
  
  let count = 0;
  for (const exp of expenses) {
    if (exp.pendingAmount === 0 && exp.paidAmount === 0) {
      await prisma.expense.update({
        where: { id: exp.id },
        data: { pendingAmount: exp.amount }
      })
      count++;
    }
  }
  console.log(`Updated ${count} expenses.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
