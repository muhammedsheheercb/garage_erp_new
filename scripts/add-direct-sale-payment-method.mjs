import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  // Historical sales keep an unknown channel instead of being classified as cash.
  await prisma.$executeRawUnsafe('ALTER TABLE "DirectSale" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT')
  console.log('Direct sale payment method column is ready.')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
