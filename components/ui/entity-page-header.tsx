import type { ReactNode } from "react"

export function EntityPageHeader({
  kicker,
  name,
  subheading,
  badge,
  action,
  subheadingAction,
}: {
  kicker: string
  name: string
  subheading?: ReactNode
  badge?: ReactNode
  action?: ReactNode
  subheadingAction?: ReactNode
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          {kicker}
        </p>
        {badge || action ? (
          <div className="flex flex-shrink-0 items-center gap-2">
            {action}
            {badge}
          </div>
        ) : null}
      </div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{name}</h1>
      {subheading || subheadingAction ? (
        <div className="mt-1.5 flex items-center justify-between gap-4">
          {subheading ? (
            <div className="text-sm text-muted-foreground">{subheading}</div>
          ) : (
            <div />
          )}
          {subheadingAction ? (
            <div className="flex-shrink-0">{subheadingAction}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
