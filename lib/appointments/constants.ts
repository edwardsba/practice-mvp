export const APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
  "completed",
  "no_show",
  "cancelled",
] as const

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  completed: "Attended",
  no_show: "No-show",
  cancelled: "Cancelled",
}

export const APPOINTMENT_MODES = ["face_to_face", "online"] as const

export type AppointmentMode = (typeof APPOINTMENT_MODES)[number]

export const APPOINTMENT_MODE_LABELS: Record<AppointmentMode, string> = {
  face_to_face: "Face to face",
  online: "Online",
}

export const APPOINTMENT_DURATIONS = [50, 80, 110] as const

export type AppointmentDuration = (typeof APPOINTMENT_DURATIONS)[number]

export const APPOINTMENT_FILTER_VALUES = ["upcoming", "past", "all"] as const

export type AppointmentFilter = (typeof APPOINTMENT_FILTER_VALUES)[number]

export function buildAppointmentTimeOptions(intervalMinutes: number = 15): string[] {
  const options: string[] = []
  for (let hour = 7; hour <= 20; hour++) {
    for (let minute = 0; minute < 60; minute += intervalMinutes) {
      if (hour === 20 && minute > 0) break
      options.push(
        `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`
      )
    }
  }
  return options
}
