"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

type MenuItem =
  | { label: string; href: string; disabled?: false }
  | { label: string; disabled: true }

const MENU_ITEMS = (clientId: string): MenuItem[] => [
  { label: "Appointments", href: `/clients/${clientId}/appointments` },
  { label: "Feedback", href: `/clients/${clientId}/assessments/feedback` },
  { label: "Session Notes", href: `/clients/${clientId}/session-notes` },
  { label: "Assessments", href: `/clients/${clientId}/assessments` },
  { label: "Communications", href: `/clients/${clientId}/communications` },
  { label: "Reports", href: `/clients/${clientId}/reports` },
  { label: "Claims", href: `/clients/${clientId}/claims` },
  { label: "Tasks", disabled: true },
  { label: "Treatment Plans", disabled: true },
  { label: "Behavioural Targets", disabled: true },
]

export function ClientMenuSidebar({ clientId }: { clientId: string }) {
  const pathname = usePathname()
  const items = MENU_ITEMS(clientId)

  return (
    <nav
      aria-label="Client menu"
      className="rounded-lg border bg-card p-2 max-lg:flex max-lg:gap-1 max-lg:overflow-x-auto lg:flex lg:flex-col"
    >
      {items.map((item) => {
        if (item.disabled) {
          return (
            <span
              key={item.label}
              className="block shrink-0 rounded-md px-3 py-2 text-sm text-muted-foreground max-lg:whitespace-nowrap"
            >
              {item.label}
            </span>
          )
        }

        const isActive = pathname === item.href

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block shrink-0 rounded-md px-3 py-2 text-sm transition-colors max-lg:whitespace-nowrap hover:bg-muted",
              isActive && "bg-muted font-medium"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
