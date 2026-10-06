import type { Prisma } from "@prisma/client"

// Direct-payment ledgers are internal bookkeeping records, not user paymeters.
export const directPaymeterNames = ["Direct Cash", "Direct Bank Transfer", "Card", "Direct Card"]

export const userPaymeterWhere = {
  NOT: directPaymeterNames.map((name) => ({
    name: { equals: name, mode: "insensitive" as const },
  })),
}

export function isDirectPaymeterName(name: string) {
  return directPaymeterNames.some((reserved) => reserved.toLowerCase() === name.trim().toLowerCase())
}

const directPaymentNames = { CASH: "Direct Cash", BANK_TRANSFER: "Direct Bank Transfer", CARD: "Card" } as const

export async function getDirectPaymeterId(tx: Prisma.TransactionClient, method: keyof typeof directPaymentNames) {
  const name = directPaymentNames[method]
  const existing = await tx.paymeter.findUnique({ where: { name } })
  if (existing) return existing.id
  return (await tx.paymeter.create({ data: { name } })).id
}
