"use client"

import { useRouter } from "next/navigation"

import { transitionAppointmentStatus } from "@/app/appointments/actions"
import { StatusTransitionControl } from "@/components/ui/status-transition-control"
import {
  APPOINTMENT_STATUS_CONFIG,
  APPOINTMENT_STATUS_TRANSITIONS,
} from "@/lib/status"

export function AppointmentStatusControl({
  appointmentId,
  currentStatus,
}: {
  appointmentId: string
  currentStatus: string
}) {
  const router = useRouter()

  return (
    <StatusTransitionControl
      status={currentStatus}
      statusMap={APPOINTMENT_STATUS_CONFIG}
      transitions={APPOINTMENT_STATUS_TRANSITIONS}
      onTransition={async (newStatus) => {
        const result = await transitionAppointmentStatus(
          appointmentId,
          newStatus
        )
        if (result?.error) throw new Error(result.error)
        router.refresh()
      }}
    />
  )
}
