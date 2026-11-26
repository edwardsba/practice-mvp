import Link from "next/link"

/**
 * One Start-list row: assessment name on the left; Start link or badge on the right.
 */
export function StartAssessmentRow({
  name,
  href,
  badge,
}: {
  name: string
  href?: string
  badge?: string
}) {
  if (href) {
    return (
      <li>
        <Link
          href={href}
          className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40"
        >
          <span className="font-medium">{name}</span>
          <span className="shrink-0 text-sm text-primary">Start</span>
        </Link>
      </li>
    )
  }

  return (
    <li className="opacity-60">
      <div
        className="flex min-h-14 items-center justify-between gap-3 px-4 py-3"
        aria-disabled="true"
      >
        <span className="font-medium">{name}</span>
        <span className="shrink-0 rounded-md border px-2 py-0.5 text-xs">
          {badge ?? "Coming soon"}
        </span>
      </div>
    </li>
  )
}
