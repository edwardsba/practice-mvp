"use client"

import { useEffect } from "react"

import {
  editDetailsPanelElementId,
  type EditDetailsPanelId,
} from "@/lib/clients/edit-details-panels"

/** Scroll the named Edit details panel into view after open-from-link. */
export function ScrollToOpenPanel({
  panelId,
}: {
  panelId: EditDetailsPanelId | null
}) {
  useEffect(() => {
    if (!panelId) return
    const timer = window.setTimeout(() => {
      document
        .getElementById(editDetailsPanelElementId(panelId))
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 50)
    return () => window.clearTimeout(timer)
  }, [panelId])

  return null
}
