import { CompanyList } from "@/features/vehicle-companies/components/company-list"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { ModulePageWrapper } from "@/components/module-page-wrapper"

export default async function VehicleCompaniesPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  return <ModulePageWrapper titleKey="vehicles.companiesTitle" descriptionKey="vehicles.companiesDescription"><CompanyList /></ModulePageWrapper>
}
