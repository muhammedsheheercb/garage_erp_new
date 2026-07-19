"use client"

import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SignOutButton() {
  const handleSignOut = () => {
    // Hard navigate to our custom API route to clear all cookies and redirect to /login
    window.location.href = "/api/auth/force-logout"
  }

  return (
    <Button
      onClick={handleSignOut}
      variant="ghost"
      size="sm"
      className="gap-2 text-muted-foreground hover:text-foreground"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline-block">Sign Out</span>
    </Button>
  )
}
