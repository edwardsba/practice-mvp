import { StatusBadge } from "@/components/ui/status-badge"
import { deriveAsqStatus } from "@/lib/session-notes/format"
import { ASQ_STATUS_CONFIG } from "@/lib/status"

export function AsqStatusBadge({
  asqCompleted,
}: {
  asqCompleted: boolean | null | undefined
}) {
  const status = deriveAsqStatus(asqCompleted)

  if (status === "not_done") {
    return <span className="text-sm text-muted-foreground">—</span>
  }

  return <StatusBadge status={status} statusMap={ASQ_STATUS_CONFIG} />
}
