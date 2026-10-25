"use client"

import type { BackgroundCheck } from "@/lib/client-background/checks"
import { checkElementIds } from "@/lib/client-background/checks"

export function scrollToBackgroundCheck(check: BackgroundCheck) {
  for (const id of checkElementIds(check)) {
    const node = document.getElementById(id)
    if (!node) continue
    node.scrollIntoView({ behavior: "smooth", block: "start" })
    return
  }
}

export function WorthCheckingLinks({
  checks,
  onJump,
}: {
  checks: BackgroundCheck[]
  onJump: (check: BackgroundCheck) => void
}) {
  return (
    <ul className="space-y-1">
      {checks.map((check) => (
        <li key={check.id}>
          <button type="button" className="text-left underline" onClick={() => onJump(check)}>
            {check.message}
          </button>
        </li>
      ))}
    </ul>
  )
}
