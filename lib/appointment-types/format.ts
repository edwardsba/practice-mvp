import {
  APPOINTMENT_MODE_LABELS,
  type AppointmentMode,
} from "@/lib/appointments/constants"

export function formatAppointmentTypeStatus(status: string) {
  if (status === "active") return "Active"
  if (status === "inactive") return "Inactive"
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function formatAppointmentTypeMode(mode: string | null | undefined) {
  if (!mode?.trim()) return "—"
  return APPOINTMENT_MODE_LABELS[mode as AppointmentMode] ?? mode
}

export function formatCurrency(value: string | number | null | undefined) {
  if (value == null || value === "") return "—"
  const amount = typeof value === "number" ? value : Number(value)
  if (Number.isNaN(amount)) return String(value)
  return amount.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
  })
}

export function formatDisplayDate(value: string | null | undefined) {
  if (!value?.trim()) return "—"
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function pickCurrentFee<
  T extends { startDate: string; endDate: string | null; status: string }
>(fees: T[], today: string): T | null {
  const activeFees = fees.filter((fee) => fee.status === "active")
  const currentFees = activeFees.filter(
    (fee) => !fee.endDate || fee.endDate >= today
  )

  const ongoing = currentFees.find((fee) => !fee.endDate)
  if (ongoing) return ongoing

  return (
    [...currentFees].sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ??
    null
  )
}
