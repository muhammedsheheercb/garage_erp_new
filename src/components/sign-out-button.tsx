"use client"

import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { logOut } from "@/app/actions/auth"

export function SignOutButton() {
  const router = useRouter()

  const handleSignOut = async () => {
    try {
      await logOut()
    } catch (error) {
      console.error("Sign out error:", error)
      // Fallback redirect if server action throws an error (e.g. Next.js redirect error which is normal)
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
