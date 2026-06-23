"use client"

import { useRouter } from "next/navigation"

import { updateClientStatus } from "@/app/clients/[client_id]/actions"
import { StatusTransitionControl } from "@/components/ui/status-transition-control"
import {
  CLIENT_STATUS_CONFIG,
  CLIENT_STATUS_TRANSITIONS,
} from "@/lib/status"

export function ClientStatusControl({
  clientId,
  currentStatus,
}: {
  clientId: string
  currentStatus: string
}) {
  const router = useRouter()

  return (
    <StatusTransitionControl
      status={currentStatus}
      statusMap={CLIENT_STATUS_CONFIG}
      transitions={CLIENT_STATUS_TRANSITIONS}
      onTransition={async (newStatus) => {
        const result = await updateClientStatus(clientId, newStatus)
        if (result?.error) throw new Error(result.error)
        router.refresh()
      }}
    />
  )
}
