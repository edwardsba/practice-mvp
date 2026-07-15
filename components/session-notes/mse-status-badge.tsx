import { StatusBadge } from "@/components/ui/status-badge"
import { deriveAssessmentStatus } from "@/lib/session-notes/format"
import { ASQ_STATUS_CONFIG } from "@/lib/status"

export function MseStatusBadge({
  instance,
}: {
  instance:
    | { status?: string | null; submittedAt?: Date | string | null }
    | null
    | undefined
}) {
  const status = deriveAssessmentStatus(instance)

  if (status === "not_done") {
    return <span className="text-sm text-muted-foreground">—</span>
  }

  return <StatusBadge status={status} statusMap={ASQ_STATUS_CONFIG} />
}
