"use client"

import { useState } from "react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  className,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Card className={cn("mb-6", className)}>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen((value) => !value)}
      >
        <CardTitle className="flex items-center justify-between text-base">
          <span>{title}</span>
          <span className="text-muted-foreground" aria-hidden>
            {open ? "−" : "+"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className={open ? undefined : "hidden"}>{children}</CardContent>
    </Card>
  )
}
