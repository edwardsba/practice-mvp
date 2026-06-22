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
  deleteAction,
}: {
  entityName: string
  blockedReason?: string
  requiresReportConfirmation?: boolean
  deleteAction: DeleteAction
}) {
  return (
    <DeleteConfirmationButton
      entityName={entityName}
      blockedReason={blockedReason}
      dangerouslyRequireConfirmation={requiresReportConfirmation}
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
