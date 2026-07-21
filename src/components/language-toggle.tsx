"use client"

import { useTranslation, type Locale } from "@/i18n"
import { Button } from "@/components/ui/button"
import { Languages } from "lucide-react"

export function LanguageToggle() {
  const { locale, setLocale, t } = useTranslation()

  const toggleLocale = () => {
    const newLocale: Locale = locale === "en" ? "ar" : "en"
    setLocale(newLocale)
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLocale}
      className="gap-1.5 text-muted-foreground hover:text-foreground font-medium"
      title={t.language.switchLanguage}
    >
      <Languages className="h-[1.2rem] w-[1.2rem]" />
      <span className="text-xs">
        {locale === "en" ? t.language.arabic : t.language.english}
      </span>
    </Button>
  )
}
