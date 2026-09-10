import { getPurchaseById } from "@/features/purchases/actions"
import { notFound } from "next/navigation"
import { PurchasePrintClient } from "./purchase-print-client"

export default async function PrintPurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const purchase = await getPurchaseById(id)
  if (!purchase) return notFound()

  return <PurchasePrintClient purchase={purchase} />
}
