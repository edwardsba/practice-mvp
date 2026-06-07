import {
  APPOINTMENT_DURATIONS,
  APPOINTMENT_MODES,
  APPOINTMENT_STATUSES,
  type AppointmentDuration,
  type AppointmentMode,
  type AppointmentStatus,
} from "@/lib/appointments/constants"

export type AppointmentFormValues = {
  clientId: string
  appointmentDate: string
  appointmentTime: string
  durationMinutes: AppointmentDuration
  location: string | null
  mode: AppointmentMode
  status: AppointmentStatus
  notes: string | null
}

function normalizeTime(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = match[3] ? Number(match[3]) : 0

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    Number.isNaN(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

export function parseAppointmentFormData(
  formData: FormData
): AppointmentFormValues | { error: string } {
  const clientId = String(formData.get("client_id") ?? "").trim()
  const appointmentDate = String(formData.get("appointment_date") ?? "").trim()
  const appointmentTimeRaw = String(formData.get("appointment_time") ?? "").trim()
  const durationRaw = Number(formData.get("duration_minutes"))
  const location = String(formData.get("location") ?? "").trim() || null
  const modeRaw = String(formData.get("mode") ?? "face_to_face")
    .trim()
    .toLowerCase()
  const statusRaw = String(formData.get("status") ?? "").trim().toLowerCase()
  const notes = String(formData.get("notes") ?? "").trim() || null

  if (!clientId) {
    return { error: "Client is required." }
  }

  if (!appointmentDate || !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
    return { error: "A valid appointment date is required." }
  }

  const appointmentTime = normalizeTime(appointmentTimeRaw)
  if (!appointmentTime) {
    return { error: "A valid appointment time is required." }
  }

  if (!APPOINTMENT_DURATIONS.includes(durationRaw as AppointmentDuration)) {
    return { error: "Duration is required." }
  }

  if (!APPOINTMENT_STATUSES.includes(statusRaw as AppointmentStatus)) {
    return { error: "Status is required." }
  }

  if (!APPOINTMENT_MODES.includes(modeRaw as AppointmentMode)) {
    return { error: "Mode is required." }
  }

  return {
    clientId,
    appointmentDate,
    appointmentTime,
    durationMinutes: durationRaw as AppointmentDuration,
    location,
    mode: modeRaw as AppointmentMode,
    status: statusRaw as AppointmentStatus,
    notes,
  }
}
