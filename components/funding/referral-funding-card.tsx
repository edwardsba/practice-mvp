"use client"

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"

import { FundingApprovalForm } from "@/components/funding/funding-approval-form"
import { RelationshipPanelShell } from "@/components/client-background/relationship-panel-shared"
import { StatusBadge } from "@/components/ui/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDisplayDate } from "@/lib/funding/format"
import {
  formatAttendedBand,
  referralCardBodyLines,
  REFERRAL_SOURCES,
  type ReferralSource,
} from "@/lib/funding/referral"
import {
  REFERRAL_FUNDING_CARD_EMPTY_MESSAGE,
  type ReferralFundingApprovalRow,
  type ReferralFundingCardFormOptions,
  type ReferralFundingCardProps,
} from "@/lib/funding/referral-funding-card-props"
import { REPORTING_REQUIREMENT_STATUS_CONFIG } from "@/lib/funding/reporting-status"
import { FUNDING_APPROVAL_STATUS_CONFIG } from "@/lib/status"
import { personRoleLabel } from "@/lib/client-background/tree"
import type { RelationshipToClient } from "@/lib/client-background/types"

export {
  REFERRAL_FUNDING_CARD_EMPTY_MESSAGE,
  type ReferralFundingCardProps,
}

type PanelState =
  | { mode: "create" }
  | { mode: "view"; approvalId: string }
  | { mode: "edit"; approvalId: string }

function asReferralSource(
  value: string | null | undefined
): ReferralSource | null {
  if (!value) return null
  return (REFERRAL_SOURCES as readonly string[]).includes(value)
    ? (value as ReferralSource)
    : null
}

function approvalBandText(
  approval: ReferralFundingApprovalRow,
  formatDate: (value: string | null | undefined) => string
) {
  const claim = approval.claimTypeName?.trim() || "Claim"
  const start = formatDate(approval.startDate)
  const end = approval.endDate ? formatDate(approval.endDate) : "open"
  const attended = formatAttendedBand(
    approval.appointmentsAttended,
    approval.appointmentsApproved
  )
  return `${claim} · ${start} – ${end} · ${attended}`
}

function bodyLinesForApproval(
  approval: ReferralFundingApprovalRow,
  relationships: ReferralFundingCardFormOptions["relationships"]
) {
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

  return referralCardBodyLines({
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
}

function ApprovalView({
  approval,
  relationships,
}: {
  approval: ReferralFundingApprovalRow
  relationships: ReferralFundingCardFormOptions["relationships"]
}) {
  const lines = bodyLinesForApproval(approval, relationships)
  return (
    <div className="space-y-4 p-4">
      <div className="space-y-1">
        <p className="text-base font-semibold">
          {approval.approvalTypeName?.trim() || "Funding approval"}
        </p>
        <p className="text-sm text-muted-foreground">
          {approvalBandText(approval, formatDisplayDate)}
        </p>
        <StatusBadge
          status={approval.approvalStatus}
          statusMap={FUNDING_APPROVAL_STATUS_CONFIG}
        />
      </div>
      {lines.length > 0 ? (
        <dl className="space-y-2">
          {lines.map((line) => (
            <div key={line.label}>
              <dt className="text-xs text-muted-foreground">{line.label}</dt>
              <dd className="text-sm whitespace-pre-wrap">{line.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">No referral details recorded.</p>
      )}
      {approval.reportingRequirements.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Reports</p>
          <div className="flex flex-wrap gap-2">
            {approval.reportingRequirements.map((req) => (
              <span
                key={`${req.appointmentNumber}-${req.reportType}`}
                className="inline-flex flex-col gap-1 rounded-md border px-2 py-1 text-xs sm:flex-row sm:items-center sm:gap-2"
              >
                <span>
                  {req.appointmentNumber} · {req.reportType}
                </span>
                <StatusBadge
                  status={req.status}
                  statusMap={REPORTING_REQUIREMENT_STATUS_CONFIG}
                />
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function ReferralFundingCard({
  clientId,
  practiceId,
  approvals,
  formOptions,
  hideTitle = false,
}: ReferralFundingCardProps & { hideTitle?: boolean }) {
  const router = useRouter()
  const [panel, setPanel] = useState<PanelState | null>(null)
  const [mounted, setMounted] = useState(false)
  const [relationships, setRelationships] = useState(formOptions.relationships)

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    setRelationships(formOptions.relationships)
  }, [formOptions.relationships])

  const selectedApproval = useMemo(() => {
    if (!panel || panel.mode === "create") return null
    return (
      approvals.find((row) => row.fundingApprovalId === panel.approvalId) ?? null
    )
  }, [approvals, panel])

  function closePanel() {
    setPanel(null)
  }

  function editInitialValues(approval: ReferralFundingApprovalRow) {
    return {
      fundingApprovalId: approval.fundingApprovalId,
      clientId,
      fundingApprovalTypeId: approval.fundingApprovalTypeId,
      claimId: approval.claimId,
      referrerId: approval.referrerId,
      referralDate: approval.referralDate,
      referrerComments: approval.referrerComments,
      referralSource: approval.referralSource,
      referrerRelationshipId: approval.referrerRelationshipId,
      referrerOther: approval.referrerOther,
      startDate: approval.startDate,
      endDate: approval.endDate,
      appointmentsApproved: approval.appointmentsApproved,
      appointmentsAttended: approval.appointmentsAttended,
      approvalStatus: approval.approvalStatus,
    }
  }

  const panelTitle =
    panel?.mode === "create"
      ? "Add funding approval"
      : panel?.mode === "edit"
        ? "Edit funding approval"
        : selectedApproval?.approvalTypeName?.trim() || "Funding approval"

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          {hideTitle ? <span className="sr-only">Referral and funding</span> : <CardTitle>Referral and funding</CardTitle>}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={hideTitle ? "ml-auto" : undefined}
            onClick={() => setPanel({ mode: "create" })}
          >
            + Add funding approval
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {approvals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {REFERRAL_FUNDING_CARD_EMPTY_MESSAGE}
            </p>
          ) : (
            approvals.map((approval) => {
              const lines = bodyLinesForApproval(approval, relationships)
              return (
                <div
                  key={approval.fundingApprovalId}
                  className="space-y-2 border-b pb-4 last:border-b-0 last:pb-0"
                >
                  <button
                    type="button"
                    className="w-full rounded-md text-left hover:bg-muted/40"
                    onClick={() =>
                      setPanel({
                        mode: "view",
                        approvalId: approval.fundingApprovalId,
                      })
                    }
                  >
                    <p className="font-semibold">
                      {approval.approvalTypeName?.trim() || "Funding approval"}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span>
                        {approvalBandText(approval, formatDisplayDate)}
                      </span>
                      <StatusBadge
                        status={approval.approvalStatus}
                        statusMap={FUNDING_APPROVAL_STATUS_CONFIG}
                      />
                    </p>
                  </button>
                  {lines.length > 0 ? (
                    <dl className="space-y-1.5 pl-0.5">
                      {lines.map((line) => (
                        <div key={line.label} className="text-sm">
                          <span className="text-muted-foreground">
                            {line.label}:{" "}
                          </span>
                          <span className="whitespace-pre-wrap">
                            {line.value}
                          </span>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {approval.reportingRequirements.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {approval.reportingRequirements.map((req) => (
                        <span
                          key={`${approval.fundingApprovalId}-${req.appointmentNumber}-${req.reportType}`}
                          className="inline-flex flex-col gap-1 rounded-md border px-2 py-1 text-xs sm:flex-row sm:items-center sm:gap-2"
                        >
                          <span>
                            {req.appointmentNumber} · {req.reportType}
                          </span>
                          <StatusBadge
                            status={req.status}
                            statusMap={REPORTING_REQUIREMENT_STATUS_CONFIG}
                          />
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {mounted && panel
        ? createPortal(
            <RelationshipPanelShell
              ariaLabel={panelTitle}
              onDismiss={closePanel}
            >
              <header className="flex items-start gap-3 border-b p-4">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-medium">{panelTitle}</h2>
                  <p className="truncate text-sm text-muted-foreground">
                    {formOptions.client.firstName} {formOptions.client.lastName}
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex size-10 items-center justify-center rounded-md hover:bg-muted"
                  aria-label="Close"
                  onClick={closePanel}
                >
                  <X className="size-4" />
                </button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {panel.mode === "view" && selectedApproval ? (
                  <ApprovalView
                    approval={selectedApproval}
                    relationships={relationships}
                  />
                ) : null}

                {panel.mode === "create" || panel.mode === "edit" ? (
                  <div className="p-4">
                    <FundingApprovalForm
                      practiceId={practiceId}
                      clients={[formOptions.client]}
                      approvalTypes={formOptions.approvalTypes}
                      claims={formOptions.claims.map((claim) => ({
                        ...claim,
                        clientId,
                      }))}
                      referrers={formOptions.referrers}
                      relationships={relationships}
                      professions={formOptions.professions}
                      organisations={formOptions.organisations}
                      privateClaimTypeId={formOptions.privateClaimTypeId}
                      lockClient
                      embedded
                      initialValues={
                        panel.mode === "edit" && selectedApproval
                          ? editInitialValues(selectedApproval)
                          : { clientId }
                      }
                      onPersonCreated={(person) => {
                        setRelationships((current) => {
                          if (
                            current.some(
                              (row) =>
                                row.relationshipRecordId ===
                                person.relationshipRecordId
                            )
                          ) {
                            return current
                          }
                          return [
                            ...current,
                            {
                              relationshipRecordId: person.relationshipRecordId,
                              givenName: person.givenName,
                              relationshipToClient: person.relationshipToClient,
                              blockRole: person.blockRole ?? null,
                              blockRoleType: person.blockRoleType ?? null,
                            },
                          ]
                        })
                      }}
                      onSaved={(fundingApprovalId) => {
                        router.refresh()
                        if (panel.mode === "create") {
                          setPanel({ mode: "view", approvalId: fundingApprovalId })
                        } else {
                          setPanel({ mode: "view", approvalId: fundingApprovalId })
                        }
                      }}
                      onCancel={() => {
                        if (panel.mode === "edit" && selectedApproval) {
                          setPanel({
                            mode: "view",
                            approvalId: selectedApproval.fundingApprovalId,
                          })
                        } else {
                          closePanel()
                        }
                      }}
                    />
                  </div>
                ) : null}
              </div>

              {panel.mode === "view" && selectedApproval ? (
                <footer className="flex items-center justify-end gap-2 border-t p-4">
                  <Button
                    type="button"
                    onClick={() =>
                      setPanel({
                        mode: "edit",
                        approvalId: selectedApproval.fundingApprovalId,
                      })
                    }
                  >
                    Edit
                  </Button>
                </footer>
              ) : null}
            </RelationshipPanelShell>,
            document.body
          )
        : null}
    </>
  )
}

