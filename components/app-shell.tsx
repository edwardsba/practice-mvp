import Link from "next/link"

import { AppNav } from "@/components/app-nav"
import { cn } from "@/lib/utils"

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
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link
            href="/dashboard"
            className="shrink-0 text-sm font-semibold tracking-tight"
          >
            Practice MVP
          </Link>
          <AppNav />
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
