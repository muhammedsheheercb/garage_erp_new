import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  return new PrismaClient({
    // DATABASE_URL is intentionally read by Prisma from the runtime environment.
    // The web server and the embedded Next.js server use the same value.
    transactionOptions: {
      // Multi-query ERP writes can exceed Prisma's five-second default.
      // Individual transactions (such as backups) can override this limit.
      timeout: 30_000,
    },
  })
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
