import { SettingsForm } from "@/features/settings/components/settings-form"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { SettingsPageClient } from "@/features/settings/components/settings-page-client"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Settings - Garage ERP",
  description: "Configure garage preferences and manage database",
}

export default async function SettingsPage() {
  const session = await getSession()
  
  if (!session) {
    redirect('/login')
  }

  return (
    <SettingsPageClient>
      <SettingsForm />
    </SettingsPageClient>
  )
}
