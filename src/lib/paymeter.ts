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
