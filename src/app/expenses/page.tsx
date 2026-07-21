import { ExpenseList } from "@/features/expenses/components/expense-list"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { ModulePageWrapper } from "@/components/module-page-wrapper"

export default async function ExpensesPage() {
  const session = await getSession()
  
  if (!session) {
    redirect('/login')
  }

  return (
    <ModulePageWrapper titleKey="expensesMod.title" descriptionKey="expensesMod.description">
      <ExpenseList />
    </ModulePageWrapper>
  )
}
