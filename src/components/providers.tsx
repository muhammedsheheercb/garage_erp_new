"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { QueryClient, QueryClientProvider, keepPreviousData } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/sonner"
import { LanguageInitializer } from "@/components/language-initializer"

// Filter out the React 19 script tag warning in development (caused by next-themes)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const orig = console.error;
  console.error = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Encountered a script tag')) {
      return;
    }
    orig.apply(console, args);
  };
}

// Keep navigation fast while still showing records added from another browser.
// Mutations invalidate affected queries immediately, so a longer client cache
// only avoids duplicate reads while navigating between modules.
const queryClient = new QueryClient({
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
