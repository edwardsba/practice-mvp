"use client"

import { useMemo, useState } from "react"

import { DiscardChangesDialog } from "@/components/client-background/discard-changes-dialog"
import {
  PanelHeader,
  PersonFields,
  emptyPersonDraft,
  type PersonDraft,
} from "@/components/client-background/relationship-panel-shared"
import { RelationshipEditFooter } from "@/components/client-background/relationship-edit-footer"
import {
  addingToContextLine,
  childTypeOptionLabel,
  firstPartnerGivenName,
} from "@/lib/client-background/add-to-relationship"
import { personDraftHasRequiredContent } from "@/lib/client-background/person-draft"
import { siblingTypesForBlock } from "@/lib/client-background/relationship-blocks"
import {
  type BlockRole,
  type RelationshipBlock,
  type RelationshipRecord,
} from "@/lib/client-background/types"

/** @deprecated Use PersonDraft — kept as an alias for call sites mid-migration. */
export type NewPersonDraftFields = PersonDraft

/**
 * Shared browser-only new-person draft (Partner / Child / Sibling / unplaced).
 * Uses the same PersonFields form as edit. Nothing is written until Save.
 */
export function NewPersonDraftForm({
  block,
  people,
  role,
  error,
  saving = false,
  contextLine,
  title: titleOverride,
  onSave,
  onCancel,
}: {
  /** Null for History unplaced-person drafts. */
  block: RelationshipBlock | null
  people: RelationshipRecord[]
  role: BlockRole | "unplaced"
  error: string | null
  saving?: boolean
  /** Override the default "Adding to: …" context strip. */
  contextLine?: string
  title?: string
  onSave: (draft: PersonDraft) => void | Promise<void>
  onCancel: () => void
}) {
  const siblingDefault =
    role === "sibling" && block ? siblingTypesForBlock(block.kind)[0] ?? "" : ""
  const [draft, setDraft] = useState<PersonDraft>(() => ({
    ...emptyPersonDraft,
    blockRoleType: siblingDefault,
  }))
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const partnerName = block ? firstPartnerGivenName(people, block.relationshipBlockId) : ""
  const dirty = JSON.stringify(draft) !== JSON.stringify({ ...emptyPersonDraft, blockRoleType: siblingDefault })
  const canSave = personDraftHasRequiredContent(draft)
  const title =
    titleOverride ??
    (role === "child"
      ? "New child"
      : role === "sibling"
        ? "New sibling"
        : role === "partner"
          ? "New partner"
          : role === "caregiver"
            ? "New caregiver"
            : "New person")

  const syntheticPerson = useMemo((): RelationshipRecord => {
    return {
      relationshipRecordId: "draft-person",
      relationshipBlockId: block?.relationshipBlockId ?? null,
      relationshipToClient: "other_caregiver",
      givenName: draft.givenName,
      sex: draft.sex,
      dateOfBirth: draft.dateOfBirth,
      dateOfDeath: draft.dateOfDeath,
      deceased: draft.deceased,
      ageAtDeath: null,
      healthOrCauseOfDeath: "",
      childTypeDetail: "",
      notKnown: draft.notKnown,
      healthStatus: draft.healthStatus,
      supportive: draft.supportive,
      conflict: draft.conflict,
      qualityOfRelationship: draft.qualityOfRelationship,
      dependency: draft.dependency,
      livingSituation: draft.livingSituation as RelationshipRecord["livingSituation"],
      blockRole: role === "unplaced" ? "" : role,
      blockRoleType: draft.blockRoleType,
      caregiverRelationship: "",
      caregiverRelationshipDetail: "",
      displayOrder: 0,
      placementReview: role === "unplaced" ? "unplaced" : "",
    }
  }, [block?.relationshipBlockId, draft, role])

  function requestClose() {
    if (dirty) {
      setConfirmDiscard(true)
      return
    }
    onCancel()
  }

  const resolvedContext =
    contextLine ??
    (block ? addingToContextLine(block, people) : "Adding an unplaced person (History Who)")

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
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{resolvedContext}</p>
        <PersonFields
          idPrefix={`new-person-${block?.relationshipBlockId ?? "unplaced"}`}
          person={syntheticPerson}
          block={block}
          draft={draft}
          onChange={setDraft}
          childTypeLabel={
            role === "child" ? (type) => childTypeOptionLabel(type, partnerName) : undefined
          }
        />
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
