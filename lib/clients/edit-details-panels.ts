export const EDIT_DETAILS_PANEL_IDS = [
  "details",
  "relationships",
  "history",
  "emergency",
  "communication",
] as const

export type EditDetailsPanelId = (typeof EDIT_DETAILS_PANEL_IDS)[number]

export function isEditDetailsPanelId(
  value: string | null | undefined
): value is EditDetailsPanelId {
  return (
    typeof value === "string" &&
    (EDIT_DETAILS_PANEL_IDS as readonly string[]).includes(value)
  )
}

/** Parse `?open=` for the Edit details page. Unknown values → null (all closed). */
export function parseEditDetailsOpenParam(
  value: string | string[] | null | undefined
): EditDetailsPanelId | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return null
  return isEditDetailsPanelId(raw) ? raw : null
}

export function editDetailsPanelElementId(panel: EditDetailsPanelId): string {
  return `edit-panel-${panel}`
}

/** Build `/clients/[id]/edit?open=…` (and optional saved flag). */
export function buildEditDetailsHref(
  clientId: string,
  open?: EditDetailsPanelId | null,
  options?: { saved?: boolean }
): string {
  const params = new URLSearchParams()
  if (open) params.set("open", open)
  if (options?.saved) params.set("saved", "1")
  const query = params.toString()
  return query
    ? `/clients/${clientId}/edit?${query}`
    : `/clients/${clientId}/edit`
}
