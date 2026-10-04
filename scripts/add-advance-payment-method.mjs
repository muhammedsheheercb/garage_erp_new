import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  // Nullable so historical advances retain their unknown payment channel.
  await prisma.$executeRawUnsafe('ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "receivedMethod" TEXT')
  console.log('Advance payment method column is ready.')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
