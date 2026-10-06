"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { QueryClient, QueryClientProvider, keepPreviousData } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/sonner"
import { LanguageInitializer } from "@/components/language-initializer"

// Keep navigation fast while still showing records added from another browser.
// Mutations invalidate affected queries immediately, so a longer client cache
// only avoids duplicate reads while navigating between modules.
const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      gcTime: 1000 * 60 * 10,
      placeholderData: keepPreviousData,
      retry: 1,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
})

export function Providers({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  const [queryClient] = React.useState(createQueryClient)
  return (
    <NextThemesProvider {...props}>
      <QueryClientProvider client={queryClient}>
        <LanguageInitializer />
        {children}
        <Toaster />
      </QueryClientProvider>
    </NextThemesProvider>
  )
}
