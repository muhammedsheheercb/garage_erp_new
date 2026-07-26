import { EmployeeList } from "@/features/employees/components/employee-list"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { ModulePageWrapper } from "@/components/module-page-wrapper"

export default async function EmployeesPage() {
  const session = await getSession()
  if (!session || session.role !== "ADMIN") {
    redirect('/login')
  }
  return <ModulePageWrapper titleKey="Users" descriptionKey="Create user login accounts and choose each module's access level."><EmployeeList /></ModulePageWrapper>
}
