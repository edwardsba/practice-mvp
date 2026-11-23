"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"

import { DiscardChangesDialog } from "@/components/client-background/discard-changes-dialog"
import { RelationshipPanelShell } from "@/components/client-background/relationship-panel-shared"
import { FundingApprovalForm } from "@/components/funding/funding-approval-form"
import type { ReferralFundingCardFormOptions } from "@/lib/funding/referral-funding-card-props"

/**
 * Interview-only: "+ Add referral or funding approval" opens FundingApprovalForm
 * in the shared side panel. Nothing is saved until Save; Cancel/✕ with edits
 * asks Discard changes?
 */
export function InterviewFundingAddPanel({
  clientId,
  practiceId,
  formOptions,
  open,
  onOpenChange,
}: {
  clientId: string
  practiceId: string
  formOptions: ReferralFundingCardFormOptions
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [relationships, setRelationships] = useState(formOptions.relationships)

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    setRelationships(formOptions.relationships)
  }, [formOptions.relationships])

  useEffect(() => {
    if (open) {
      setDirty(false)
      setDiscardOpen(false)
    }
  }, [open])

  function requestClose() {
    if (dirty) {
      setDiscardOpen(true)
      return
    }
    onOpenChange(false)
  }

  function confirmDiscard() {
    setDiscardOpen(false)
    setDirty(false)
    onOpenChange(false)
  }

  if (!mounted || !open) {
    return (
      <DiscardChangesDialog
        open={discardOpen}
        onDiscard={confirmDiscard}
        onKeepEditing={() => setDiscardOpen(false)}
      />
    )
  }

  return (
    <>
      {createPortal(
        <RelationshipPanelShell
          ariaLabel="Add referral or funding approval"
          onDismiss={requestClose}
        >
          <header className="flex items-start gap-3 border-b p-4">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-medium">
                Add referral or funding approval
              </h2>
              <p className="truncate text-sm text-muted-foreground">
                {formOptions.client.firstName} {formOptions.client.lastName}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-md hover:bg-muted"
              aria-label="Close"
              onClick={requestClose}
            >
              <X className="size-4" />
            </button>
          </header>

          <div
            className="min-h-0 flex-1 overflow-y-auto p-4"
            onChange={() => setDirty(true)}
            onInput={() => setDirty(true)}
          >
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
              initialValues={{ clientId }}
              onPersonCreated={(person) => {
                setRelationships((current) => {
                  if (
                    current.some(
                      (row) =>
                        row.relationshipRecordId === person.relationshipRecordId
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
              onSaved={() => {
                setDirty(false)
                onOpenChange(false)
                router.refresh()
              }}
              onCancel={requestClose}
            />
          </div>
        </RelationshipPanelShell>,
        document.body
      )}

      <DiscardChangesDialog
        open={discardOpen}
        onDiscard={confirmDiscard}
        onKeepEditing={() => setDiscardOpen(false)}
      />
    </>
  )
}
