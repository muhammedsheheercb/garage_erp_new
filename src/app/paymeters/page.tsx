import { PaymeterList } from "@/features/paymeters/components/paymeter-list"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { ModulePageWrapper } from "@/components/module-page-wrapper"

export default async function PaymetersPage() {
  const session = await getSession()
  
  if (!session) {
    redirect('/login')
  }

  return (
    <ModulePageWrapper titleKey="paymetersMod.title" descriptionKey="paymetersMod.description">
      <PaymeterList />
    </ModulePageWrapper>
  )
}
