export const SESSION_NOTE_STATUSES = ["draft", "finalised"] as const

export type SessionNoteStatus = (typeof SESSION_NOTE_STATUSES)[number]

export const SESSION_NOTE_FILTER_VALUES = ["all", "draft", "finalised"] as const

export type SessionNoteFilter = (typeof SESSION_NOTE_FILTER_VALUES)[number]

export const SESSION_NOTE_STATUS_LABELS: Record<SessionNoteStatus, string> = {
  draft: "Draft",
  finalised: "Finalised",
}
