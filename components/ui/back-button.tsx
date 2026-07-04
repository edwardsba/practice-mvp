"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

import { Button } from "@/components/ui/button"
import { resolveBackNavigation } from "@/lib/navigation/back"

function BackButtonInner({
  fallbackHref,
  label,
}: {
  fallbackHref: string
  label: string
}) {
  const searchParams = useSearchParams()
  const returnTo = searchParams.get("returnTo") ?? undefined
  const { href, label: resolvedLabel } = resolveBackNavigation(
    returnTo,
    fallbackHref,
    label
  )

  return (
    <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
      <Link href={href}>{resolvedLabel}</Link>
    </Button>
  )
}

export function BackButton({
  fallbackHref,
  label = "← Back",
}: {
  fallbackHref: string
  label?: string
}) {
  return (
    <Suspense
      fallback={
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" disabled>
          {label}
        </Button>
      }
    >
      <BackButtonInner fallbackHref={fallbackHref} label={label} />
    </Suspense>
  )
}
