"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export function ClientPanelFields({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <dl className={cn("grid gap-3", className)}>{children}</dl>
}

export function ClientPanelField({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "grid gap-1 sm:grid-cols-[150px_1fr] sm:items-start sm:gap-3",
        className
      )}
    >
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm font-medium">{children}</dd>
    </div>
  )
}

type ClientPanelBase = {
  title: string
  children: ReactNode
  className?: string
  id?: string
}

type ClientPanelMenu = ClientPanelBase & {
  control: "menu"
  menuContent: ReactNode
  expandedContent?: never
  openHref?: never
  openLabel?: never
  defaultExpanded?: never
}

type ClientPanelOpen = ClientPanelBase & {
  control: "open"
  openHref: string
  openLabel?: string
  menuContent?: never
  expandedContent?: never
  defaultExpanded?: never
}

/** Same as open, default label "Edit ›". */
type ClientPanelEdit = ClientPanelBase & {
  control: "edit"
  openHref: string
  openLabel?: string
  menuContent?: never
  expandedContent?: never
  defaultExpanded?: never
}

type ClientPanelExpand = ClientPanelBase & {
  control: "expand"
  expandedContent: ReactNode
  /** When true, the panel starts open (e.g. from `?open=`). Not remembered between visits. */
  defaultExpanded?: boolean
  menuContent?: never
  openHref?: never
  openLabel?: never
}

export type ClientPanelProps =
  | ClientPanelMenu
  | ClientPanelOpen
  | ClientPanelEdit
  | ClientPanelExpand

/**
 * Shared client-details panel: title + one control (menu / open / expand) + body.
 */
export function ClientPanel(props: ClientPanelProps) {
  const { title, children, className, control, id } = props
  const [expanded, setExpanded] = useState(
    control === "expand" ? Boolean(props.defaultExpanded) : false
  )

  return (
    <Card
      id={id}
      className={cn("scroll-mt-24 gap-4 py-4 shadow-sm", className)}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 px-4 py-0">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {control === "menu" ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10 shrink-0"
                aria-label="Client menu"
              >
                <Menu className="size-5" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-56">
              {props.menuContent}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {control === "open" || control === "edit" ? (
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href={props.openHref}>
              {props.openLabel ?? (control === "edit" ? "Edit ›" : "Open ›")}
            </Link>
          </Button>
        ) : null}
        {control === "expand" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Collapse ⌃" : "Expand ⌄"}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="px-4">
        {control === "expand" && expanded ? props.expandedContent : children}
      </CardContent>
    </Card>
  )
}
