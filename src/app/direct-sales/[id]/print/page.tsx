import { getDirectSaleById } from "@/features/direct-sales/actions"
import { notFound } from "next/navigation"
import { DirectSalePrint } from "./print-client"

export default async function DirectSalePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const sale = await getDirectSaleById((await params).id)
  if (!sale) notFound()
  return <DirectSalePrint sale={sale} />
}
