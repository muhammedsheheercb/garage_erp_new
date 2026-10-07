import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
try {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PurchaseCancellation" (
    "id" TEXT PRIMARY KEY,
    "purchaseNumber" TEXT NOT NULL UNIQUE,
    "supplierName" TEXT NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "grandTotal" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL,
    "pendingAmount" DOUBLE PRECISION NOT NULL,
    "cancelledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledBy" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL
  )`)
  await prisma.$executeRawUnsafe('ALTER TABLE "PurchaseCancellation" ADD COLUMN IF NOT EXISTS "restoredAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "restoredBy" TEXT')
  console.log('Purchase cancellation and restoration history table is ready.')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
