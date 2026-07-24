import type { ReactNode } from "react"

export function ListPageHeader({
  heading,
  action,
}: {
  heading: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
      {action ? <div className="flex-shrink-0">{action}</div> : null}
    </div>
  )
}
