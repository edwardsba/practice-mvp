import { StatusBadge } from "@/components/ui/status-badge"
import { derivePsqStatus } from "@/lib/session-notes/format"
import { PSQ_STATUS_CONFIG } from "@/lib/status"

export function PsqStatusBadge({
  sentAt,
  batteryStatus,
}: {
  sentAt: Date | null | undefined
  batteryStatus: string | null | undefined
}) {
  const status = derivePsqStatus(sentAt, batteryStatus)

  if (status === "not_sent") {
    return <span className="text-sm text-muted-foreground">—</span>
  }

  return <StatusBadge status={status} statusMap={PSQ_STATUS_CONFIG} />
}
