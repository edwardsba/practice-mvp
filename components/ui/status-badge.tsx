import { Badge } from "@/components/ui/badge"
import { getStatusConfig, type StatusConfig } from "@/lib/status"
import { cn } from "@/lib/utils"

export function StatusBadge({
  status,
  statusMap,
  className,
}: {
  status: string
  statusMap: Record<string, StatusConfig>
  className?: string
}) {
  const config = getStatusConfig(statusMap, status)

  return (
    <Badge variant={config.variant} className={cn(className)}>
      {config.label}
    </Badge>
  )
}
