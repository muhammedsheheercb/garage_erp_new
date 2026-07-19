"use client"

import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"

export function SignOutButton() {
  const router = useRouter()

  const handleSignOut = async () => {
    try {
      await signOut({ redirect: false })
    } catch (error) {
      console.error("Sign out error:", error)
    } finally {
      window.location.href = "/login"
    }
  }

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={handleSignOut}
      className="gap-2 text-muted-foreground hover:text-foreground"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline-block">Sign Out</span>
    </Button>
  )
}
