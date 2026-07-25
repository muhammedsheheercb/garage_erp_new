"use client"

import * as React from "react"
import { addDays, format } from "date-fns"
import { Calendar as CalendarIcon, X } from "lucide-react"
import { DateRange } from "react-day-picker"
import { ar, enUS } from "date-fns/locale"
import { useTranslation } from "@/i18n"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerWithRangeProps extends React.HTMLAttributes<HTMLDivElement> {
  date: DateRange | undefined
  setDate: (date: DateRange | undefined) => void
  placeholder?: string
}

export function DatePickerWithRange({
  className,
  date,
  setDate,
  placeholder = "Pick a date range",
}: DatePickerWithRangeProps) {
  const { locale, t } = useTranslation()
  const dateLocale = locale === 'ar' ? ar : enUS

  return (
    <div className={cn("grid gap-2 relative", className)}>
      <Popover>
        <PopoverTrigger
          id="date"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "w-full sm:w-[300px] justify-start text-start font-normal pe-8",
            !date && "text-muted-foreground"
          )}
        >
            <CalendarIcon className="me-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y", { locale: dateLocale })} -{" "}
                  {format(date.to, "LLL dd, y", { locale: dateLocale })}
                </>
              ) : (
                format(date.from, "LLL dd, y", { locale: dateLocale })
              )
            ) : (
              <span>{placeholder}</span>
            )}
          </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
            locale={dateLocale}
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
          />
        </PopoverContent>
      </Popover>
      {date?.from && (
        <button
          type="button"
          className="absolute end-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground z-10 rounded-full hover:bg-muted"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setDate(undefined)
          }}
          aria-label="Clear date"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
