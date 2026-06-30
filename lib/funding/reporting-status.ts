import type { StatusConfig } from "@/lib/status"

export type ReportingRequirementStatus =
  | "completed"
  | "overdue"
  | "not_due"

export const REPORTING_REQUIREMENT_STATUS_CONFIG: Record<
  ReportingRequirementStatus,
  StatusConfig
> = {
  completed: { label: "Completed", variant: "success" },
  overdue: { label: "Overdue", variant: "destructive" },
  not_due: { label: "Not due yet", variant: "muted" },
}

/**
 * Derive the status of a single reporting requirement.
 * - completed: a report has been linked to this requirement
 * - overdue: not linked AND the trigger appointment has passed
 * - not_due: not linked AND the trigger appointment hasn't been reached yet
 */
export function deriveReportingRequirementStatus({
  hasLinkedReport,
  appointmentNumber,
  appointmentsAttended,
}: {
  hasLinkedReport: boolean
  appointmentNumber: number
  appointmentsAttended: number
}): ReportingRequirementStatus {
  if (hasLinkedReport) return "completed"
  if (appointmentsAttended >= appointmentNumber) return "overdue"
  return "not_due"
}

export type ReportingOverallStatus =
  | "completed"
  | "overdue"
  | "in_progress"
  | "not_due"

export const REPORTING_OVERALL_STATUS_CONFIG: Record<
  ReportingOverallStatus,
  StatusConfig
> = {
  completed: { label: "All complete", variant: "success" },
  overdue: { label: "Overdue", variant: "destructive" },
  in_progress: { label: "In progress", variant: "warning" },
  not_due: { label: "Not due yet", variant: "muted" },
}

/**
 * Roll up individual reporting requirement statuses into a single
 * overall status for an approval.
 * - completed: every requirement has a linked report
 * - overdue: at least one requirement is overdue
 * - in_progress: at least one requirement complete, none overdue
 * - not_due: no requirements complete and none overdue
 * - null: approval has no reporting requirements configured
 */
export function deriveReportingOverallStatus(
  statuses: ReportingRequirementStatus[]
): ReportingOverallStatus | null {
  if (statuses.length === 0) return null
  if (statuses.every((s) => s === "completed")) return "completed"
  if (statuses.some((s) => s === "overdue")) return "overdue"
  if (statuses.some((s) => s === "completed")) return "in_progress"
  return "not_due"
}
