"use client"

import { Button } from "@/components/ui/button"

function formatExpiry(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function QuestionnaireLinkPanel({
  linkHeading,
  link,
  expiresAt,
  statusMessage,
  onCopy,
  copied,
  alignEnd = false,
}: {
  linkHeading: string
  link: string
  expiresAt: string
  statusMessage: string | null
  onCopy: () => void
  copied: boolean
  alignEnd?: boolean
}) {
  return (
    <div className="w-full rounded-lg border border-primary/20 bg-muted/40 p-4">
      {statusMessage ? (
        <p
          className={`mb-3 text-sm font-medium text-foreground ${alignEnd ? "text-right" : ""}`}
        >
          {statusMessage}
        </p>
      ) : null}
      <p className={`mb-2 text-sm font-medium ${alignEnd ? "text-right" : ""}`}>
        {linkHeading}
      </p>
      <p className="mb-3 break-all rounded-md border bg-background px-3 py-2 font-mono text-sm">
        {link}
      </p>
      <p
        className={`mb-3 text-sm text-muted-foreground ${alignEnd ? "text-right" : ""}`}
      >
        Expires: {formatExpiry(expiresAt)}
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onCopy}>
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  )
}
