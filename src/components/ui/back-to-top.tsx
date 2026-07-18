"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ArrowUp } from "lucide-react"

// Throttle function to limit how often a function runs
function useThrottle(callback: (...args: any[]) => void, limit: number) {
  const [inThrottle, setInThrottle] = useState(false)

  return useCallback(
    (...args: any[]) => {
      if (!inThrottle) {
        callback(...args)
        setInThrottle(true)
        setTimeout(() => setInThrottle(false), limit)
      }
    },
    [callback, limit, inThrottle]
  )
}

export function BackToTop() {
  const [isVisible, setIsVisible] = useState(false)

  const handleScroll = useCallback(() => {
    // Show button when user scrolls down 300px
    if (window.scrollY > 300) {
      setIsVisible(true)
    } else {
      setIsVisible(false)
    }
  }, [])

  // Throttle Scroll: Checks scroll position only every 200ms to improve scrolling performance
  const throttledScroll = useThrottle(handleScroll, 200)

  useEffect(() => {
    window.addEventListener("scroll", throttledScroll)
    return () => window.removeEventListener("scroll", throttledScroll)
  }, [throttledScroll])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    })
  }

  if (!isVisible) return null

  return (
    <Button
      variant="default"
      size="icon"
      className="fixed bottom-8 right-8 z-50 rounded-full shadow-lg transition-all animate-in fade-in slide-in-from-bottom-4"
      onClick={scrollToTop}
      aria-label="Back to top"
    >
      <ArrowUp className="h-5 w-5" />
    </Button>
  )
}
