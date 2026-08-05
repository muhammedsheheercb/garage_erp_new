"use client"

import { useEffect } from "react"
import { useLanguageStore } from "@/i18n"

/**
 * This component syncs the HTML dir and lang attributes 
 * with the stored language preference on mount.
 * Place this inside the Providers tree.
 */
export function LanguageInitializer() {
  const locale = useLanguageStore((s) => s.locale)
  const setLocale = useLanguageStore((s) => s.setLocale)

  useEffect(() => {
    try {
      const stored = localStorage.getItem("garage-erp-locale")
      if (stored === "ar" || stored === "en") {
        setLocale(stored)
        return
      }
    } catch {}

    document.documentElement.lang = locale
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr"
  }, [locale, setLocale])

  return null
}
