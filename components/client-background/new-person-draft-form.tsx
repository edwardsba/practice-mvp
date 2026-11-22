"use client"

import { useState } from "react"

import { DiscardChangesDialog } from "@/components/client-background/discard-changes-dialog"
import { PartialDatePicker, SelectField, TextField } from "@/components/client-background/fields"
import { PanelHeader } from "@/components/client-background/relationship-panel-shared"
import { RelationshipEditFooter } from "@/components/client-background/relationship-edit-footer"
import {
  addingToContextLine,
  childTypeOptionLabel,
  firstPartnerGivenName,
} from "@/lib/client-background/add-to-relationship"
import { personDraftHasRequiredContent } from "@/lib/client-background/person-draft"
import { siblingTypesForBlock } from "@/lib/client-background/relationship-blocks"
import {
  CHILD_TYPES,
  RELATIONSHIP_LIVING_SITUATION_LABELS,
  RELATIONSHIP_LIVING_SITUATIONS,
  SEX_OPTIONS,
  SIBLING_BLOCK_TYPE_LABELS,
  type BlockRole,
  type RelationshipBlock,
  type RelationshipRecord,
} from "@/lib/client-background/types"

export type NewPersonDraftFields = {
  givenName: string
  sex: string
  dateOfBirth: string
  blockRoleType: string
  livingSituation: string
}

const emptyFields = (): NewPersonDraftFields => ({
  givenName: "",
  sex: "",
  dateOfBirth: "",
  blockRoleType: "",
  livingSituation: "",
})

/**
 * Shared browser-only new-person draft (Partner / Child / Sibling).
 * Nothing is written until Save. Used on Client Background and Interview.
 */
export function NewPersonDraftForm({
  block,
  people,
  role,
  error,
  saving = false,
  onSave,
  onCancel,
}: {
  block: RelationshipBlock
  people: RelationshipRecord[]
  role: BlockRole
  error: string | null
  saving?: boolean
  onSave: (draft: NewPersonDraftFields) => void | Promise<void>
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<NewPersonDraftFields>(emptyFields)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const partnerName = firstPartnerGivenName(people, block.relationshipBlockId)
  const dirty =
    draft.givenName.trim() !== "" ||
    draft.sex.trim() !== "" ||
    draft.dateOfBirth.trim() !== "" ||
    draft.blockRoleType.trim() !== "" ||
    draft.livingSituation.trim() !== ""
  const canSave = personDraftHasRequiredContent(draft)
  const title =
    role === "child" ? "New child" : role === "sibling" ? "New sibling" : "New partner"

  function requestClose() {
    if (dirty) {
      setConfirmDiscard(true)
      return
    }
    onCancel()
  }

  function patch(partial: Partial<NewPersonDraftFields>) {
    setDraft((current) => ({ ...current, ...partial }))
  }

  const siblingOptions = role === "sibling" ? siblingTypesForBlock(block.kind) : []

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PanelHeader
        initial="+"
        deceased={false}
        title={title}
        subtitle=""
        onClose={requestClose}
      />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          {addingToContextLine(block, people)}
        </p>
        <TextField
          id={`new-person-${block.relationshipBlockId}-name`}
          label="Name"
          value={draft.givenName}
          onChange={(givenName) => patch({ givenName })}
        />
        <SelectField
          id={`new-person-${block.relationshipBlockId}-sex`}
          label="Sex"
          value={draft.sex}
          onChange={(sex) => patch({ sex })}
        >
          <option value="">Not recorded</option>
          {SEX_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </SelectField>
        {role === "child" ? (
          <SelectField
            id={`new-person-${block.relationshipBlockId}-type`}
            label="Type"
            value={draft.blockRoleType}
            onChange={(blockRoleType) => patch({ blockRoleType })}
          >
            <option value="">Select…</option>
            {CHILD_TYPES.map((type) => (
              <option key={type} value={type}>
                {childTypeOptionLabel(type, partnerName)}
              </option>
            ))}
          </SelectField>
        ) : null}
        {role === "sibling" ? (
          <SelectField
            id={`new-person-${block.relationshipBlockId}-sibling-type`}
            label="Type"
            value={draft.blockRoleType || siblingOptions[0] || ""}
            onChange={(blockRoleType) => patch({ blockRoleType })}
          >
            {siblingOptions.map((type) => (
              <option key={type} value={type}>
                {SIBLING_BLOCK_TYPE_LABELS[type as keyof typeof SIBLING_BLOCK_TYPE_LABELS] ?? type}
              </option>
            ))}
          </SelectField>
        ) : null}
        <PartialDatePicker
          id={`new-person-${block.relationshipBlockId}-dob`}
          dateLabel="Date of birth or age"
          mode="person"
          value={draft.dateOfBirth}
          onChange={(dateOfBirth) => patch({ dateOfBirth })}
        />
        {role === "child" || role === "partner" ? (
          <SelectField
            id={`new-person-${block.relationshipBlockId}-living`}
            label="Living situation"
            value={draft.livingSituation}
            onChange={(livingSituation) => patch({ livingSituation })}
          >
            <option value="">Not recorded</option>
            {RELATIONSHIP_LIVING_SITUATIONS.map((option) => (
              <option key={option} value={option}>
                {RELATIONSHIP_LIVING_SITUATION_LABELS[option]}
              </option>
            ))}
          </SelectField>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
      <RelationshipEditFooter
        saving={saving}
        saveDisabled={!canSave}
        onCancel={requestClose}
        onSave={() => void onSave(draft)}
      />
      <DiscardChangesDialog
        open={confirmDiscard}
        onKeepEditing={() => setConfirmDiscard(false)}
        onDiscard={() => {
          setConfirmDiscard(false)
          onCancel()
        }}
      />
    </div>
  )
}
