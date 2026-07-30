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

  const [isOpen, setIsOpen] = React.useState(false)
  const [internalDate, setInternalDate] = React.useState<DateRange | undefined>(date)

  React.useEffect(() => {
    if (isOpen) {
      setInternalDate(date)
    }
  }, [isOpen, date])

  const handleApply = () => {
    setDate(internalDate)
    setIsOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setInternalDate(undefined)
    setDate(undefined)
    setIsOpen(false)
  }

  return (
    <div className={cn("grid gap-2 relative", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
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
                  {format(date.from, "dd/MM/yyyy")} -{" "}
                  {format(date.to, "dd/MM/yyyy")}
                </>
              ) : (
                format(date.from, "dd/MM/yyyy")
              )
            ) : (
              <span>{placeholder}</span>
            )}
          </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={internalDate?.from || new Date()}
            selected={internalDate}
            onSelect={setInternalDate}
            numberOfMonths={2}
            locale={dateLocale}
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
          />
          <div className="flex items-center justify-end gap-2 p-3 border-t">
            <Button variant="ghost" size="sm" onClick={handleClear}>
              Clear
            </Button>
            <Button size="sm" onClick={handleApply}>
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {date?.from && (
        <button
          type="button"
          className="absolute end-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground z-10 rounded-full hover:bg-muted"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleClear}
          aria-label="Clear date"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
