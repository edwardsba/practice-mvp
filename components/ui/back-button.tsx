"use client"

import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"

export function BackButton({ fallbackHref }: { fallbackHref: string }) {
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
