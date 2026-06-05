"use client"

import * as React from "react"
import { format, parseISO, isValid } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  value?: string
  onChange?: (value: string) => void
  min?: string
  max?: string
  disabled?: boolean
  placeholder?: string
  className?: string
  required?: boolean
  readOnly?: boolean
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  disabled,
  placeholder = "Pilih tanggal",
  className,
  required,
  readOnly
}: DatePickerProps) {
  // Parsing value string (YYYY-MM-DD) to Date object
  const date = React.useMemo(() => {
    if (!value) return undefined
    const parsed = parseISO(value)
    return isValid(parsed) ? parsed : undefined
  }, [value])

  // Parsing min/max constraints
  const minDate = React.useMemo(() => {
    if (!min) return undefined
    const parsed = parseISO(min)
    if (!parsed || !isValid(parsed)) return undefined
    const d = new Date(parsed)
    d.setHours(0, 0, 0, 0)
    return d
  }, [min])

  const maxDate = React.useMemo(() => {
    if (!max) return undefined
    const parsed = parseISO(max)
    if (!parsed || !isValid(parsed)) return undefined
    const d = new Date(parsed)
    d.setHours(23, 59, 59, 999)
    return d
  }, [max])

  const handleSelect = (selectedDate: Date | undefined) => {
    if (readOnly || disabled) return
    if (selectedDate) {
      // Use YYYY-MM-DD format to match native input behavior
      onChange?.(format(selectedDate, "yyyy-MM-dd"))
    } else {
      onChange?.("")
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          disabled={disabled}
          type="button"
          className={cn(
            "w-full justify-start text-left font-normal bg-white border-slate-200 h-9 px-3 rounded-md shadow-sm transition-all hover:bg-slate-50",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-red-600" />
          {date ? format(date, "dd/MM/yyyy") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[300] w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          disabled={(d) => {
             // Disable dates based on min/max constraints
             if (minDate && d < minDate) return true;
             if (maxDate && d > maxDate) return true;
             return false;
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
