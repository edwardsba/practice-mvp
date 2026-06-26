export type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "success"
  | "warning"
  | "destructive"
  | "muted"

export type StatusConfig = {
  label: string
  variant: BadgeVariant
}

export const APPOINTMENT_STATUS_CONFIG: Record<string, StatusConfig> = {
  scheduled: { label: "Scheduled", variant: "default" },
  confirmed: { label: "Confirmed", variant: "default" },
  completed: { label: "Attended", variant: "success" },
  no_show: { label: "No-show", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "destructive" },
}

export const APPOINTMENT_STATUS_TRANSITIONS: Record<string, string[]> = {
  scheduled: ["confirmed", "cancelled"],
  confirmed: ["completed", "no_show", "cancelled"],
  completed: ["no_show"],
  no_show: [],
  cancelled: [],
}

export const FUNDING_APPROVAL_STATUS_CONFIG: Record<string, StatusConfig> = {
  active: { label: "Active", variant: "default" },
  expired: { label: "Expired", variant: "muted" },
  exhausted: { label: "Exhausted", variant: "muted" },
  cancelled: { label: "Cancelled", variant: "destructive" },
}

export const SESSION_NOTE_STATUS_CONFIG: Record<string, StatusConfig> = {
  draft: { label: "Draft", variant: "default" },
  finalised: { label: "Finalised", variant: "success" },
}

export const CLIENT_STATUS_CONFIG: Record<string, StatusConfig> = {
  active: { label: "Active", variant: "default" },
  on_hold: { label: "On hold", variant: "warning" },
  discharged: { label: "Discharged", variant: "success" },
  inactive: { label: "Inactive", variant: "muted" },
}

export const CLIENT_STATUS_TRANSITIONS: Record<string, string[]> = {
  active: ["on_hold", "discharged", "inactive"],
  on_hold: ["active", "discharged", "inactive"],
  discharged: ["active"],
  inactive: ["active"],
}

export const ATTENDANCE_RISK_CONFIG: Record<string, StatusConfig> = {
  low: { label: "Reliable", variant: "success" },
  moderate: { label: "Some risk", variant: "warning" },
  high: { label: "High risk", variant: "destructive" },
  insufficient: { label: "New client", variant: "muted" },
}

export const PSQ_STATUS_CONFIG: Record<string, StatusConfig> = {
  sent: { label: "Sent", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
}

export const ASQ_STATUS_CONFIG: Record<string, StatusConfig> = {
  completed: { label: "Completed", variant: "success" },
}

export function getStatusConfig(
  map: Record<string, StatusConfig>,
  status: string
): StatusConfig {
  return map[status] ?? { label: status, variant: "outline" }
}
