"use client"

import { DeleteConfirmationButton } from "@/components/delete-confirmation-button"

type DeleteResult = {
  error?: string
  blockedReason?: string
  hasReports?: boolean
}

type DeleteAction = (options?: {
  acknowledgeReports?: boolean
}) => Promise<DeleteResult | void>

export function EntityDeleteSection({
  entityName,
  blockedReason,
  requiresReportConfirmation,
  confirmationMessage,
  deleteAction,
}: {
  entityName: string
  blockedReason?: string
  requiresReportConfirmation?: boolean
  /** Custom message for the extra-confirmation dialog, passed through to
   * DeleteConfirmationButton. Optional — omit to use the default
   * client/reports wording. */
  confirmationMessage?: string
  deleteAction: DeleteAction
}) {
  return (
    <DeleteConfirmationButton
      entityName={entityName}
      blockedReason={blockedReason}
      dangerouslyRequireConfirmation={requiresReportConfirmation}
      confirmationMessage={confirmationMessage}
      onDelete={async () => {
        const result = await deleteAction(
          requiresReportConfirmation ? { acknowledgeReports: true } : undefined
        )
        if (result?.error || result?.blockedReason) {
          throw new Error(result.error ?? result.blockedReason)
        }
      }}
    />
  )
}
