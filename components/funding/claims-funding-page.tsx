"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"

import { AttachToClaimPicker } from "@/components/funding/attach-to-claim-picker"
import { CollapsibleFundingCard } from "@/components/funding/collapsible-funding-card"
import { ReferralFundingCard } from "@/components/funding/referral-funding-card"
import { StatusBadge } from "@/components/ui/status-badge"
import { formatDisplayDate } from "@/lib/funding/format"
import type { ClaimsPageModel } from "@/lib/funding/claims-page"
import {
  referralCardBodyLines,
  REFERRAL_SOURCES,
  type ReferralSource,
} from "@/lib/funding/referral"
import type { ReferralFundingCardProps } from "@/lib/funding/referral-funding-card-props"
import { FUNDING_APPROVAL_STATUS_CONFIG } from "@/lib/status"
import { Badge } from "@/components/ui/badge"
import { personRoleLabel } from "@/lib/client-background/tree"
import type { RelationshipToClient } from "@/lib/client-background/types"

function asReferralSource(
  value: string | null | undefined
): ReferralSource | null {
  if (!value) return null
  return (REFERRAL_SOURCES as readonly string[]).includes(value)
    ? (value as ReferralSource)
    : null
}

function SectionHeading({ children }: { children: string }) {
  return (
    <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h2>
  )
}

function ClaimStatusPill({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? "success" : "muted"}>
      {active ? "Active" : "Inactive"}
    </Badge>
  )
}

function ProgressBar({ used, approved }: { used: number; approved: number }) {
  const pct = approved > 0 ? Math.min(100, Math.round((used / approved) * 100)) : 0
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-slate-600"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function ApprovalCardBody({
  approval,
  relationships,
  showAttach,
  clientId,
  claims,
  returnPath,
  onOpenCard,
}: {
  approval: ClaimsPageModel["referralsWithoutClaim"][number]
  relationships: ReferralFundingCardProps["formOptions"]["relationships"]
  showAttach: boolean
  clientId: string
  claims: Array<{ claimId: string; claimTypeName: string; isActive: boolean }>
  returnPath: string
  onOpenCard: (approvalId: string) => void
}) {
  const [attachOpen, setAttachOpen] = useState(false)
  const closeAttach = useCallback(() => setAttachOpen(false), [])

  const referrer =
    approval.referrerId && approval.referrerFirstName
      ? {
          title: approval.referrerTitle,
          firstName: approval.referrerFirstName,
          lastName: approval.referrerLastName ?? "",
          professionName: approval.referrerProfessionName,
        }
      : null

  const whoRecord = approval.referrerRelationshipId
    ? relationships.find(
        (row) => row.relationshipRecordId === approval.referrerRelationshipId
      )
    : null

  const referralLines = referralCardBodyLines({
    referrer,
    referralSource: asReferralSource(approval.referralSource),
    who: whoRecord
      ? {
          givenName: whoRecord.givenName,
          roleLabel: personRoleLabel({
            relationshipToClient:
              whoRecord.relationshipToClient as RelationshipToClient,
          }),
        }
      : null,
    referrerOther: approval.referrerOther,
    referralDate: approval.referralDate,
    referrerComments: approval.referrerComments,
    formatDate: formatDisplayDate,
  })

  const datesValue = [
    approval.startDate ? formatDisplayDate(approval.startDate) : null,
    approval.endDate ? formatDisplayDate(approval.endDate) : "open",
  ]
    .filter(Boolean)
    .join(" – ")

  const rows: Array<{ label: string; value: string }> = []
  if (approval.startDate || approval.endDate) {
    rows.push({ label: "Dates", value: datesValue || "—" })
  }
  for (const line of referralLines) {
    if (line.label === "Referral date") {
      rows.push({ label: "Referred", value: line.value })
    } else if (line.label === "Referrer comments") {
      rows.push({ label: "Comments", value: line.value })
    } else {
      rows.push(line)
    }
  }
  if (approval.kind === "funding_approval") {
    rows.push({
      label: "Sessions",
      value: approval.usedLine ?? `${approval.appointmentsAttended} used`,
    })
  }

  return (
    <div className="space-y-3">
      {rows.length > 0 ? (
        <dl className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className="grid gap-0.5 sm:grid-cols-[7rem_1fr] sm:gap-3"
            >
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd className="text-sm whitespace-pre-wrap">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {approval.appointmentsApproved != null ? (
        <ProgressBar
          used={approval.appointmentsAttended}
          approved={approval.appointmentsApproved}
        />
      ) : null}

      {approval.reportTag ? (
        <span
          className={
            approval.reportTag.kind === "sent"
              ? "inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800"
              : "inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-800"
          }
        >
          {approval.reportTag.label}
        </span>
      ) : null}

      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          className="text-sm font-medium text-primary hover:underline"
          onClick={() => onOpenCard(approval.fundingApprovalId)}
        >
          Open referral and funding card ›
        </button>
        {showAttach ? (
          attachOpen ? (
            <AttachToClaimPicker
              clientId={clientId}
              fundingApprovalId={approval.fundingApprovalId}
              claims={claims}
              returnPath={returnPath}
              onCancel={closeAttach}
            />
          ) : (
            <button
              type="button"
              className="text-sm font-medium text-primary hover:underline"
              onClick={() => setAttachOpen(true)}
            >
              Attach to a claim ›
            </button>
          )
        ) : null}
      </div>
    </div>
  )
}

function ApprovalCard({
  approval,
  relationships,
  showAttach,
  clientId,
  claims,
  returnPath,
  onOpenCard,
}: {
  approval: ClaimsPageModel["referralsWithoutClaim"][number]
  relationships: ReferralFundingCardProps["formOptions"]["relationships"]
  showAttach?: boolean
  clientId: string
  claims: Array<{ claimId: string; claimTypeName: string; isActive: boolean }>
  returnPath: string
  onOpenCard: (approvalId: string) => void
}) {
  return (
    <CollapsibleFundingCard
      id={`referral-${approval.fundingApprovalId}`}
      variant="light"
      defaultOpen={approval.initiallyOpen}
      header={
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              {approval.kindLabel}
            </span>
            {showAttach ? (
              <Badge variant="warning">To attach</Badge>
            ) : null}
            <StatusBadge
              status={approval.approvalStatus}
              statusMap={FUNDING_APPROVAL_STATUS_CONFIG}
            />
          </div>
          <p className="text-sm font-semibold">{approval.name}</p>
          <p className="text-sm text-muted-foreground">{approval.headerDetail}</p>
        </div>
      }
    >
      <ApprovalCardBody
        approval={approval}
        relationships={relationships}
        showAttach={Boolean(showAttach)}
        clientId={clientId}
        claims={claims}
        returnPath={returnPath}
        onOpenCard={onOpenCard}
      />
    </CollapsibleFundingCard>
  )
}

function ClaimCard({
  claim,
  clientId,
  returnPath,
  relationships,
  allClaims,
  onOpenCard,
}: {
  claim: ClaimsPageModel["activeClaims"][number]
  clientId: string
  returnPath: string
  relationships: ReferralFundingCardProps["formOptions"]["relationships"]
  allClaims: Array<{ claimId: string; claimTypeName: string; isActive: boolean }>
  onOpenCard: (approvalId: string) => void
}) {
  return (
    <CollapsibleFundingCard
      id={`claim-${claim.claimId}`}
      variant="strong"
      defaultOpen={claim.initiallyOpen}
      closedSummary={claim.closedSummary}
      header={
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              CLAIM
            </span>
            <ClaimStatusPill active={claim.isActive} />
          </div>
          <p className="text-lg font-semibold leading-tight">
            {claim.claimTypeName}
          </p>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-3 rounded-md bg-muted/60 p-3">
          {claim.detailRows.length > 0 ? (
            <dl className="space-y-2">
              {claim.detailRows.map((row) => (
                <div
                  key={row.label}
                  className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-3"
                >
                  <dt className="text-xs text-muted-foreground">{row.label}</dt>
                  <dd className="text-sm">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div>
            <p className="text-xs text-muted-foreground">
              Sessions claimed in {claim.calendarYear}
            </p>
            <p className="text-3xl font-semibold tracking-tight">
              {claim.sessionsClaimedInYear}
            </p>
          </div>
          <Link
            href={`/funding/claims/${claim.claimId}?returnTo=${encodeURIComponent(returnPath)}`}
            className="inline-block text-sm font-medium text-primary hover:underline"
          >
            Claim details ›
          </Link>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Funding approvals and referrals ({claim.approvals.length})
          </h3>
          <div className="space-y-2">
            {claim.approvals.map((approval) => (
              <ApprovalCard
                key={approval.fundingApprovalId}
                approval={approval}
                relationships={relationships}
                clientId={clientId}
                claims={allClaims}
                returnPath={returnPath}
                onOpenCard={onOpenCard}
              />
            ))}
          </div>
          <Link
            href={`/funding/approvals/new?claimId=${claim.claimId}&client_id=${clientId}&returnTo=${encodeURIComponent(returnPath)}`}
            className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
          >
            + Add referral or funding approval
          </Link>
        </div>
      </div>
    </CollapsibleFundingCard>
  )
}

export function ClaimsFundingPage({
  clientId,
  model,
  referralFunding,
}: {
  clientId: string
  model: ClaimsPageModel
  referralFunding: ReferralFundingCardProps
}) {
  const returnPath = `/clients/${clientId}/claims`
  const [openApprovalId, setOpenApprovalId] = useState<string | null>(null)

  const allClaims = useMemo(
    () =>
      [...model.activeClaims, ...model.inactiveClaims].map((claim) => ({
        claimId: claim.claimId,
        claimTypeName: claim.claimTypeName,
        isActive: claim.isActive,
      })),
    [model.activeClaims, model.inactiveClaims]
  )

  const handleOpenCard = useCallback((approvalId: string) => {
    setOpenApprovalId(approvalId)
  }, [])

  const clearOpen = useCallback(() => setOpenApprovalId(null), [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const hash = window.location.hash.replace(/^#/, "")
    if (!hash) return
    const el = document.getElementById(hash)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [])

  const hasAny =
    model.referralsWithoutClaim.length > 0 ||
    model.activeClaims.length > 0 ||
    model.inactiveClaims.length > 0

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      {!hasAny ? (
        <p className="text-sm text-muted-foreground">
          No claims, referrals or funding recorded yet.
        </p>
      ) : null}

      {model.referralsWithoutClaim.length > 0 ? (
        <section className="space-y-3">
          <SectionHeading>Referrals without a claim</SectionHeading>
          <div className="space-y-2">
            {model.referralsWithoutClaim.map((approval) => (
              <ApprovalCard
                key={approval.fundingApprovalId}
                approval={approval}
                relationships={referralFunding.formOptions.relationships}
                showAttach
                clientId={clientId}
                claims={allClaims}
                returnPath={returnPath}
                onOpenCard={handleOpenCard}
              />
            ))}
          </div>
        </section>
      ) : null}

      {model.activeClaims.length > 0 ? (
        <section className="space-y-3">
          <SectionHeading>Active claims</SectionHeading>
          <div className="space-y-4">
            {model.activeClaims.map((claim) => (
              <ClaimCard
                key={claim.claimId}
                claim={claim}
                clientId={clientId}
                returnPath={returnPath}
                relationships={referralFunding.formOptions.relationships}
                allClaims={allClaims}
                onOpenCard={handleOpenCard}
              />
            ))}
          </div>
        </section>
      ) : null}

      {model.inactiveClaims.length > 0 ? (
        <section className="space-y-3">
          <SectionHeading>Inactive claims</SectionHeading>
          <div className="space-y-4">
            {model.inactiveClaims.map((claim) => (
              <ClaimCard
                key={claim.claimId}
                claim={claim}
                clientId={clientId}
                returnPath={returnPath}
                relationships={referralFunding.formOptions.relationships}
                allClaims={allClaims}
                onOpenCard={handleOpenCard}
              />
            ))}
          </div>
        </section>
      ) : null}

      <Link
        href={`/funding/claims/new?client_id=${clientId}&returnTo=${encodeURIComponent(returnPath)}`}
        className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
      >
        + New claim
      </Link>

      <ReferralFundingCard
        {...referralFunding}
        panelOnly
        openApprovalId={openApprovalId}
        onOpenApprovalIdHandled={clearOpen}
      />
    </div>
  )
}
