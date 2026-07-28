import { Suspense } from "react"
import { getCustomerFullDetails } from "@/features/customers/actions"
import { CustomerDetailsClient } from "./customer-details-client"
import { notFound } from "next/navigation"

export default async function CustomerDetailsPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>,
  searchParams: Promise<{ from?: string, to?: string }>
}) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  
  const customer = await getCustomerFullDetails(resolvedParams.id, resolvedSearchParams.from, resolvedSearchParams.to)

  if (!customer) {
    notFound()
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <Suspense fallback={<div className="h-24 flex items-center justify-center text-muted-foreground">Loading details...</div>}>
        <CustomerDetailsClient customer={customer} />
      </Suspense>
    </div>
  )
}
