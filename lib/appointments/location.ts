const ONLINE_APPOINTMENT_PHRASE =
  "online and you will receive a Teams link on the day"

/**
 * The bare location text for an appointment: the appointment's own location
 * if set, else the practice location nickname, else the practice address,
 * else the practice name as a last resort.
 * Does not consider appointment mode.
 */
export function resolveAppointmentLocationText(
  appointmentLocation: string | null,
  locationNickname: string | null,
  practiceAddress: string | null,
  practiceName: string
): string {
  return (
    appointmentLocation?.trim() ||
    locationNickname?.trim() ||
    practiceAddress?.trim() ||
    practiceName
  )
}

/**
 * A complete phrase describing where the appointment takes place, suitable
 * for a sentence like "This appointment is {appointment_location}."
 * Mode-aware: online appointments get a fixed phrase regardless of location.
 */
export function resolveAppointmentLocationPhrase(
  mode: string,
  appointmentLocation: string | null,
  locationNickname: string | null,
  practiceAddress: string | null,
  practiceName: string
): string {
  if (mode === "online") {
    return ONLINE_APPOINTMENT_PHRASE
  }
  return `in person at ${resolveAppointmentLocationText(
    appointmentLocation,
    locationNickname,
    practiceAddress,
    practiceName
  )}`
}
