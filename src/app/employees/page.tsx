import { EmployeeList } from "@/features/employees/components/employee-list"
import { requireAdmin } from "@/lib/authorization"
import { ModulePageWrapper } from "@/components/module-page-wrapper"

export default async function EmployeesPage() {
  await requireAdmin()
  return <ModulePageWrapper titleKey="Employees" descriptionKey="Create employee login accounts and choose each module's access level."><EmployeeList /></ModulePageWrapper>
}
