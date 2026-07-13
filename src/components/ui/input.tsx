"use client"

import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import {
  isNumericInputMode,
  normalizeNumericInputValue,
} from "@/lib/digits"
import { cn } from "@/lib/utils"

function Input({
  className,
  type,
  inputMode,
  onChange,
  onBlur,
  ...props
}: React.ComponentProps<"input">) {
  // type=number rejects Arabic-Indic digits in most browsers — use text + numeric keypad.
  const isNumeric = isNumericInputMode(type, inputMode)
  const resolvedType = type === "number" ? "text" : type
  const resolvedInputMode =
    type === "number" ? (inputMode ?? "decimal") : inputMode

  const normalizeEventValue = (
    event: React.ChangeEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>
  ) => {
    if (!isNumeric) return
    const next = normalizeNumericInputValue(
      event.currentTarget.value,
      type,
      resolvedInputMode
    )
    if (event.currentTarget.value !== next) {
      event.currentTarget.value = next
    }
  }

  return (
    <InputPrimitive
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-[var(--mds-radius-md)] border border-input bg-card px-3 py-1.5 text-sm transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-card dark:disabled:bg-muted/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
      type={resolvedType}
      inputMode={resolvedInputMode}
      onChange={(event) => {
        normalizeEventValue(event)
        onChange?.(event)
      }}
      onBlur={(event) => {
        normalizeEventValue(event)
        onBlur?.(event)
      }}
    />
  )
}

export { Input }
