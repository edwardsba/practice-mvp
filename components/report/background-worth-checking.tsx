import Link from "next/link"

import type { BackgroundCheck } from "@/lib/client-background/checks"
import type {
  BackgroundReportOmission,
  BackgroundReportOmissionTarget,
} from "@/lib/reports/generate-background-report"

function hrefFor(clientId: string, target: BackgroundCheck["target"] | BackgroundReportOmissionTarget): string {
  if (target === "practitioner") return `/practitioner/edit`
  return `/clients/${clientId}/background#check-${target}`
}

export function BackgroundWorthChecking({
  clientId,
  checks,
  omissions,
}: {
  clientId: string
  checks: BackgroundCheck[]
  omissions: BackgroundReportOmission[]
}) {
  const seen = new Set<string>()
  const items = [
    ...checks.map((check) => ({
      id: `check-${check.id}`,
      message: check.message,
      href: hrefFor(clientId, check.target),
    })),
    ...omissions.map((item) => ({
      id: `omitted-${item.id}`,
      message: item.message,
      href: hrefFor(clientId, item.target),
    })),
  ].filter((item) => {
    if (seen.has(item.message)) return false
    seen.add(item.message)
    return true
  })
  if (items.length === 0) return null

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="font-medium">Worth checking before finalising ({items.length})</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={item.href} className="underline">
              {item.message}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
