"use client"

import { SidePanelFooter } from "@/components/shared/side-panel"

/**
 * Shared Cancel / Save footer for relationship person and draft forms.
 * Remove stays on the left for existing people only; Add another for new items.
 */
export function RelationshipEditFooter({
  saving = false,
  saveDisabled = false,
  saveLabel = "Save",
  onRemove,
  onCancel,
  onSave,
  onAddAnother,
}: {
  saving?: boolean
  saveDisabled?: boolean
  saveLabel?: string
  onRemove?: () => void
  onCancel: () => void
  onSave: () => void
  onAddAnother?: () => void
}) {
  return (
    <SidePanelFooter
      saving={saving}
      saveDisabled={saveDisabled}
      saveLabel={saveLabel}
      onRemove={onRemove}
      onCancel={onCancel}
      onSave={onSave}
      onAddAnother={onAddAnother}
      className="border-t-0"
    />
  )
}

/** Interview section footer: Discard + Save section. */
export function RelationshipSectionFooter({
  unsavedCount,
  saving = false,
  onDiscard,
  onSave,
}: {
  unsavedCount: number
  saving?: boolean
  onDiscard: () => void
  onSave: () => void
}) {
  return (
    <div className="space-y-2 border-t pt-3">
      {unsavedCount > 0 ? (
        <p className="text-sm text-muted-foreground">
          {unsavedCount} unsaved change{unsavedCount === 1 ? "" : "s"}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex min-h-10 items-center rounded-md border px-3 text-sm"
          disabled={saving || unsavedCount === 0}
          onClick={onDiscard}
        >
          Discard
        </button>
        <span className="flex-1" />
        <button
          type="button"
          className="inline-flex min-h-10 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-60"
          disabled={saving || unsavedCount === 0}
          onClick={onSave}
        >
          Save section
        </button>
      </div>
    </div>
  )
}
