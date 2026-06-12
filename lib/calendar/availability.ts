export type AvailabilityBlock = {
  dayOfWeek: number
  startTime: string
  endTime: string
  mode: string
}

export function isSlotAvailable(
  dateStr: string,
  slotTime: string,
  availabilityBlocks: AvailabilityBlock[]
): boolean {
  const jsDay = new Date(`${dateStr}T00:00:00`).getDay()
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1

  return availabilityBlocks.some((block) => {
    if (block.dayOfWeek !== dayOfWeek) return false
    return (
      slotTime >= block.startTime.slice(0, 5) &&
      slotTime < block.endTime.slice(0, 5)
    )
  })
}
