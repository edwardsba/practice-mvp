import { StatusBadge } from "@/components/ui/status-badge"
import { derivePsqStatus } from "@/lib/session-notes/format"
import { PSQ_STATUS_CONFIG } from "@/lib/status"

export function PsqStatusBadge({
  sentAt,
  psqBatteryStatus,
}: {
  sentAt: Date | null | undefined
  psqBatteryStatus: string | null | undefined
}) {
  const status = derivePsqStatus(sentAt, psqBatteryStatus)

  if (status === "not_sent") {
    return <span className="text-sm text-muted-foreground">—</span>
  }

  return <StatusBadge status={status} statusMap={PSQ_STATUS_CONFIG} />
}
