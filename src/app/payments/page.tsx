import { PaymentList } from "@/features/payments/components/payment-list"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { ModulePageWrapper } from "@/components/module-page-wrapper"

export default async function PaymentsPage() {
  const session = await getSession()
  
  if (!session) {
    redirect('/login')
  }

  return (
    <ModulePageWrapper titleKey="payments.title" descriptionKey="payments.description">
      <PaymentList />
    </ModulePageWrapper>
  )
}
