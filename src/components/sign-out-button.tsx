"use client"

import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { logOutAction } from "@/app/actions/auth"

export function SignOutButton() {
  return (
    <form action={logOutAction}>
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="gap-2 text-muted-foreground hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline-block">Sign Out</span>
      </Button>
    </form>
  )
}
