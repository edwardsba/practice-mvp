import Link from "next/link"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/appointments", label: "Appointments" },
  { href: "/session-notes", label: "Session Notes" },
  { href: "/practice", label: "Practice" },
  { href: "/practitioner", label: "Profile" },
]

export function AppShell({
  children,
  title,
  className,
}: {
  children: React.ReactNode
  title?: string
  className?: string
}) {
  return (
    <div className="min-h-full bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
            Practice MVP
          </Link>
          <nav className="flex flex-1 items-center gap-1">
            {navItems.map((item) => (
              <Button key={item.href} variant="ghost" size="sm" asChild>
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
          </nav>
        </div>
      </header>
      <main className={cn("mx-auto max-w-6xl px-4 py-8", className)}>
        {title ? (
          <h1 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h1>
        ) : null}
        {children}
      </main>
    </div>
  )
}
