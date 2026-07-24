import type { ReactNode } from "react"

export function EntityPageHeader({
  kicker,
  name,
  subheading,
  badge,
  action,
}: {
  kicker: string
  name: string
  subheading?: ReactNode
  badge?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          {kicker}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{name}</h1>
        {subheading ? (
          <div className="mt-1.5 text-sm text-muted-foreground">
            {subheading}
          </div>
        ) : null}
      </div>
      {badge || action ? (
        <div className="flex flex-shrink-0 items-center gap-2">
          {action}
          {badge}
        </div>
      ) : null}
    </div>
  )
}
