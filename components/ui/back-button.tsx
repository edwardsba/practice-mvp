"use client"

import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"

export function BackButton({
  fallbackHref: _fallbackHref,
  label: _label,
}: {
  fallbackHref: string
  label?: string
}) {
  const router = useRouter()
  return (
    <Button
      variant="ghost"
      size="sm"
      className="mb-2 -ml-2"
      onClick={() => router.back()}
    >
      ← Back
    </Button>
  )
}
