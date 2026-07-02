export type AvailabilityBlock = {
  dayOfWeek: number
  startTime: string
  endTime: string
  mode: string
}

export type AppointmentTypeOption = {
  appointmentTypeId: string
  nickname: string
  durationMinutes: number
  mode: string | null
  claimTypeId: string | null
}

function normalizeTime(value: string): string {
  return value.slice(0, 5)
}

export function resolveMode(
  date: string,
  time: string,
  appointmentType: AppointmentTypeOption | null,
  availabilityBlocks: AvailabilityBlock[]
): string {
  if (date && time && availabilityBlocks.length > 0) {
    const jsDay = new Date(`${date}T00:00:00`).getDay()
    const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1
    const timeValue = normalizeTime(time)

    const matchingBlock = availabilityBlocks.find((block) => {
      if (block.dayOfWeek !== dayOfWeek) return false
      return (
        timeValue >= normalizeTime(block.startTime) &&
        timeValue < normalizeTime(block.endTime)
      )
    })

    if (matchingBlock?.mode === "online") return "online"

    // Practice availability block says "both" (or a specific
    // face_to_face block) — default to face_to_face unless the
    // already-selected appointment type says otherwise.
    if (matchingBlock?.mode === "both" || matchingBlock?.mode === "face_to_face") {
      return appointmentType?.mode ?? "face_to_face"
    }
  }

  return appointmentType?.mode ?? "face_to_face"
}
