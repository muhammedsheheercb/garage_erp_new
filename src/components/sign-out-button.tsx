"use client"

import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useTranslation } from "@/i18n"

export function SignOutButton() {
  const { t } = useTranslation()

  const handleSignOut = () => {
    // Hard navigate to our custom logout route.
    // This allows Electron to intercept and clear all Chromium storage,
    // and deletes server cookies before loading the login page.
    window.location.href = "/api/auth/logout"
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
          />
        }
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline-block">{t.common.signOut}</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.common.signOutConfirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {t.common.signOutConfirmDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleSignOut}>
            {t.common.signOut}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
