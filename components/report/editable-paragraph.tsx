"use client"

import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"

export function EditableParagraph({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
      className={cn(
        "w-full resize-none overflow-hidden whitespace-pre-wrap rounded-md border border-transparent bg-transparent p-0 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground",
        "hover:border-input/50 focus-visible:border-input focus-visible:ring-3 focus-visible:ring-ring/50",
        "print:border-none print:p-0 print:shadow-none",
        className
      )}
    />
  )
}
