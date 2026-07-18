"use client"

import React from "react"
import Image from "next/image"

interface CurrencyProps {
  amount: number
  className?: string
  size?: number
}

export function Currency({ amount, className = "flex items-center gap-1", size = 1.2 }: CurrencyProps) {
  const formattedAmount = new Intl.NumberFormat('en-OM', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(amount)
  
  // Convert generic 'size' (e.g. 1.2) to pixel approximate size
  const pxSize = size * 20

  return (
    <div className={className}>
      <Image src="/Omr_symbol.svg" alt="OMR" width={pxSize} height={pxSize} className="object-contain" />
      <span>{formattedAmount}</span>
    </div>
  )
}

export function OmanIcon({ className, size = 1 }: { className?: string; size?: number }) {
  const pxSize = size * 20
  return (
    <div className={className}>
      <Image src="/Omr_symbol.svg" alt="OMR" width={pxSize} height={pxSize} className="object-contain" />
    </div>
  )
}


