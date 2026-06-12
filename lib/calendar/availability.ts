import { parseDateString } from "@/lib/calendar/dates"

export type AvailabilityBlock = {
  dayOfWeek: number
  startTime: string
  endTime: string
  mode: string
}

function normalizeTimeValue(time: string): string {
  const value = String(time).trim()
  const match = value.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return value.slice(0, 5)
  return `${match[1].padStart(2, "0")}:${match[2]}`
}

function timeToMinutes(time: string): number {
  const normalized = normalizeTimeValue(time)
  const [hours, minutes] = normalized.split(":").map((part) => Number(part))
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0
  return hours * 60 + minutes
}

function getDayOfWeek(dateStr: string): number {
  const jsDay = parseDateString(dateStr).getDay()
  return jsDay === 0 ? 6 : jsDay - 1
}

export function isSlotAvailable(
  dateStr: string,
  slotTime: string,
  availabilityBlocks: AvailabilityBlock[]
): boolean {
  if (availabilityBlocks.length === 0) {
    return true
  }

  const dayOfWeek = getDayOfWeek(dateStr)
  const slotMinutes = timeToMinutes(slotTime)

  return availabilityBlocks.some((block) => {
    if (block.dayOfWeek !== dayOfWeek) return false
    const startMinutes = timeToMinutes(block.startTime)
    const endMinutes = timeToMinutes(block.endTime)
    return slotMinutes >= startMinutes && slotMinutes < endMinutes
  })
}
