"use client";

import { useTranslation } from "@/i18n";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface ModulePageWrapperProps {
  titleKey: string;
  descriptionKey: string;
  children: React.ReactNode;
}

/**
 * Reusable client-side page wrapper that provides:
 * - Translated "Back to Dashboard" button
 * - Translated page title and description
 *
 * Usage: Pass translation keys as dot-separated paths
 * e.g. titleKey="customers.title" descriptionKey="customers.description"
 */
export function ModulePageWrapper({
  titleKey,
  descriptionKey,
  children,
}: ModulePageWrapperProps) {
  const { t } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Resolve nested translation key like "customers.title"
  const resolveKey = (key: string): string => {
    const parts = key.split(".");
    let result: any = t;
    for (const part of parts) {
      result = result?.[part];
    }
    return typeof result === "string" ? result : key;
  };

  return (
    <div className="min-h-screen bg-white/60 p-4 md:p-8 dark:bg-background/60">
      <div className="max-w-screen-2xl mx-auto space-y-6">
        <div className="flex flex-col gap-4">
          <div suppressHydrationWarning>
            <Link href="/" passHref>
              <Button
                variant="ghost"
                size="sm"
                className="pl-0 gap-1 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />{" "}
                {isMounted ? t.common.back : "Back to Dashboard"}
              </Button>
            </Link>
          </div>
          <div suppressHydrationWarning>
            <h1 className="text-3xl font-bold tracking-tight">
              {isMounted ? resolveKey(titleKey) : titleKey}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isMounted ? resolveKey(descriptionKey) : descriptionKey}
            </p>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
