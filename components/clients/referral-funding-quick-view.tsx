"use client"

import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import type { QuickViewLine } from "@/lib/funding/claims-page"
import { attentionStatusBadgeClass } from "@/lib/ui/status-colours"
import { cn } from "@/lib/utils"

function approvalHref(fundingApprovalId: string): string {
  return `/funding/approvals/${fundingApprovalId}`
}

export function ReferralFundingQuickView({
  clientId,
  lines,
  footer,
}: {
  clientId: string
  lines: QuickViewLine[]
  /** Optional footer under the lines (e.g. Interview add control). */
  footer?: React.ReactNode
}) {
  const claimsHref = `/clients/${clientId}/claims`

  if (lines.length === 1 && lines[0]?.kind === "empty") {
    return (
      <div className="space-y-2">
        <div className="flex min-h-11 items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            No referrals or funding recorded
          </span>
          <Link
            href={claimsHref}
            className="shrink-0 font-medium text-primary hover:underline"
          >
            Add ›
          </Link>
        </div>
        {footer}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {lines.map((line) => {
          if (line.kind === "empty") return null

          if (line.kind === "unattached_referral") {
            return (
              <li key={line.fundingApprovalId}>
                <Link
                  href={approvalHref(line.fundingApprovalId)}
                  className={cn(
                    "flex min-h-11 items-start justify-between gap-3 rounded-md px-1 py-2 hover:bg-muted/40"
                  )}
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-semibold">{line.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {line.subtitle}
                    </p>
                  </div>
                  <Badge variant="warning" className="mt-0.5 shrink-0">
                    To attach
                  </Badge>
                </Link>
              </li>
            )
          }

          if (line.kind === "active_claim") {
            const [claimType, ...rest] = line.title.split(" · ")
            const restName = rest.join(" · ")
            const href = line.fundingApprovalId
              ? approvalHref(line.fundingApprovalId)
              : claimsHref
            return (
              <li key={line.claimId}>
                <Link
                  href={href}
                  className="flex min-h-11 items-start justify-between gap-3 rounded-md px-1 py-2 hover:bg-muted/40"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm">
                      <span className="font-semibold">{claimType}</span>
                      {restName ? (
                        <>
                          {" · "}
                          <span>{restName}</span>
                        </>
                      ) : null}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {line.subtitle}
                    </p>
                    {line.reportTag ? (
                      <span className={attentionStatusBadgeClass}>
                        {line.reportTag}
                      </span>
                    ) : null}
                  </div>
                  <Badge variant="success" className="mt-0.5 shrink-0">
                    Active
                  </Badge>
                </Link>
              </li>
            )
          }

          const href = line.fundingApprovalId
            ? approvalHref(line.fundingApprovalId)
            : claimsHref
          return (
            <li key={line.claimId}>
              <Link
                href={href}
                className="flex min-h-11 items-start justify-between gap-3 rounded-md px-1 py-2 hover:bg-muted/40"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-semibold">{line.title}</p>
                  <p className="text-sm text-muted-foreground">{line.subtitle}</p>
                </div>
                <Badge variant="muted" className="mt-0.5 shrink-0">
                  Inactive
                </Badge>
              </Link>
            </li>
          )
        })}
      </ul>
      {footer}
    </div>
  )
}
