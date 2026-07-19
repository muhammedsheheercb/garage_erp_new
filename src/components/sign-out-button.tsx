"use client"

import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
export function SignOutButton() {
  const handleSignOut = async () => {
    try {
      // Call our custom API route to forcefully delete cookies
      await fetch("/api/auth/force-logout", { method: "POST" });
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      // Hard redirect to login page
      window.location.href = "/login";
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
