"use client"

import { create } from "zustand"
import { en } from "./translations/en"
import { ar } from "./translations/ar"
import type { TranslationKeys } from "./translations/en"

export type Locale = "en" | "ar"

const translations: Record<Locale, TranslationKeys> = { en, ar }

interface LanguageState {
  locale: Locale
  t: TranslationKeys
  setLocale: (locale: Locale) => void
  isRTL: boolean
}

// Keep the initial state identical during SSR and the first client render.
// The saved locale is restored by LanguageInitializer after hydration.
function getStoredLocale(): Locale {
  return "en"
}

export const useLanguageStore = create<LanguageState>((set) => {
  const initial = getStoredLocale()
  return {
    locale: initial,
    t: translations[initial],
    isRTL: initial === "ar",
    setLocale: (locale: Locale) => {
      if (typeof window !== "undefined") {
        localStorage.setItem("garage-erp-locale", locale)
        // Update HTML attributes for RTL support and language
        document.documentElement.lang = locale
        document.documentElement.dir = locale === "ar" ? "rtl" : "ltr"
      }
      set({
        locale,
        t: translations[locale],
        isRTL: locale === "ar",
      })
    },
  }
})

/**
 * Hook to access translations.
 * Usage: const { t, locale, setLocale, isRTL } = useTranslation()
 */
export function useTranslation() {
  return useLanguageStore()
}
