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
