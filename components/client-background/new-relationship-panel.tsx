"use client"

import { useState } from "react"

import { ContextStrip } from "@/components/client-background/context-strip"
import { DiscardChangesDialog } from "@/components/client-background/discard-changes-dialog"
import { SelectField, TextField, PartialDatePicker } from "@/components/client-background/fields"
import { RelationshipEditFooter } from "@/components/client-background/relationship-edit-footer"
import {
  BlockFields,
  PanelHeader,
  emptyPersonDraft,
  type PersonDraft,
} from "@/components/client-background/relationship-panel-shared"
import { resolveFormContext } from "@/lib/client-background/form-context"
import {
  NEW_RELATIONSHIP_ENTRY_POINTS,
  NEW_RELATIONSHIP_FORM_ID,
  newRelationshipFormIdForEntryPoint,
} from "@/lib/client-background/new-relationship-form"
import { personDraftHasRequiredContent } from "@/lib/client-background/person-draft"
import {
  SEX_OPTIONS,
  type BlockKind,
  type RelationshipBlock,
  type RelationshipRecord,
} from "@/lib/client-background/types"

export {
  NEW_RELATIONSHIP_ENTRY_POINTS,
  NEW_RELATIONSHIP_FORM_ID,
  newRelationshipFormIdForEntryPoint,
}

export type NewRelationshipDraftSave = {
  kind: BlockKind
  parentSide?: "mother" | "father" | ""
  block: Pick<
    RelationshipBlock,
    | "status"
    | "statusDetail"
    | "arrangementType"
    | "arrangementDetail"
    | "startedOn"
    | "endedOn"
    | "childrenAnswer"
    | "siblingsAnswer"
  >
  person: PersonDraft
}

function draftBlock(kind: BlockKind, parentSide?: "mother" | "father" | ""): RelationshipBlock {
  return {
    relationshipBlockId: `draft-${kind}`,
    kind,
    parentRecordId: null,
    parentSide: parentSide === "mother" || parentSide === "father" ? parentSide : "",
    status: "",
    statusDetail: "",
    arrangementType: "",
    arrangementDetail: "",
    startedOn: "",
    endedOn: "",
    childrenAnswer: "",
    siblingsAnswer: "",
    displayOrder: 0,
  }
}

/**
 * Shared New relationship / New arrangement form — browser-only draft.
 * Nothing is written until Save. Used by interview and Client Background.
 */
export function NewRelationshipPanel({
  kind,
  parentSide = "",
  people,
  locked = false,
  error,
  saving = false,
  onSave,
  onCancel,
}: {
  kind: BlockKind
  parentSide?: "mother" | "father" | ""
  people: RelationshipRecord[]
  locked?: boolean
  error: string | null
  saving?: boolean
  onSave: (draft: NewRelationshipDraftSave) => void | Promise<void>
  onCancel: () => void
}) {
  const [blockDraft, setBlockDraft] = useState(() => draftBlock(kind, parentSide))
  const [personDraft, setPersonDraft] = useState<PersonDraft>(emptyPersonDraft)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const isArrangement = kind === "caregiver_arrangement"
  const context = resolveFormContext(
    {
      clientName: "",
      about: "self",
      block: blockDraft,
      person:
        kind === "parent_other"
          ? people.find(
              (person) =>
                person.relationshipToClient === parentSide ||
                (person.blockRole === "parent" && person.blockRoleType === parentSide)
            ) ?? null
          : null,
    },
    people
  )
  const showChildren = kind === "client_current" || kind === "client_previous"
  const showSiblings = kind === "parent_other" || kind === "caregiver_arrangement"
  const canSave = personDraftHasRequiredContent(personDraft)
  const dirty =
    canSave ||
    Boolean(blockDraft.status.trim()) ||
    Boolean(blockDraft.statusDetail.trim()) ||
    Boolean(blockDraft.arrangementType.trim()) ||
    Boolean(blockDraft.arrangementDetail.trim()) ||
    Boolean(blockDraft.startedOn.trim()) ||
    Boolean(blockDraft.endedOn.trim()) ||
    Boolean(blockDraft.childrenAnswer) ||
    Boolean(blockDraft.siblingsAnswer) ||
    Boolean(personDraft.sex.trim()) ||
    Boolean(personDraft.dateOfBirth.trim()) ||
    Boolean(personDraft.healthStatus)

  function requestClose() {
    if (dirty) {
      setConfirmDiscard(true)
      return
    }
    onCancel()
  }

  return (
    <div data-form-id={NEW_RELATIONSHIP_FORM_ID} className="flex min-h-0 flex-1 flex-col">
      <PanelHeader
        initial="+"
        deceased={false}
        title={isArrangement ? "New arrangement" : "New relationship"}
        subtitle=""
        onClose={requestClose}
      />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <ContextStrip lines={context.lines} readOnly />
        <BlockFields
          block={blockDraft}
          locked={locked}
          showChildrenQuestion={false}
          onChange={setBlockDraft}
        />
        <div className="space-y-2">
          <h3 className="text-sm font-medium">{isArrangement ? "Caregiver" : "Partner"}</h3>
          <div className="space-y-3">
            <TextField
              id={`new-rel-${kind}-name`}
              label="Name"
              value={personDraft.givenName}
              onChange={(givenName) => setPersonDraft({ ...personDraft, givenName })}
            />
            <SelectField
              id={`new-rel-${kind}-sex`}
              label="Sex"
              value={personDraft.sex}
              onChange={(sex) => setPersonDraft({ ...personDraft, sex })}
            >
              <option value="">Not recorded</option>
              {SEX_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </SelectField>
            <PartialDatePicker
              id={`new-rel-${kind}-dob`}
              dateLabel="Date of birth or age"
              mode="person"
              value={personDraft.dateOfBirth}
              onChange={(dateOfBirth) => setPersonDraft({ ...personDraft, dateOfBirth })}
            />
          </div>
        </div>
        {showChildren ? (
          <SelectField
            id={`new-rel-${kind}-children`}
            label="Children"
            value={blockDraft.childrenAnswer || ""}
            onChange={(childrenAnswer) => {
              const answer =
                childrenAnswer === "yes" || childrenAnswer === "none" || childrenAnswer === "not_asked"
                  ? childrenAnswer
                  : ("" as const)
              setBlockDraft({ ...blockDraft, childrenAnswer: answer })
            }}
          >
            <option value="">Select…</option>
            <option value="yes">Yes</option>
            <option value="none">None</option>
            <option value="not_asked">Not asked</option>
          </SelectField>
        ) : null}
        {showSiblings ? (
          <SelectField
            id={`new-rel-${kind}-siblings`}
            label="Siblings"
            value={blockDraft.siblingsAnswer || ""}
            onChange={(siblingsAnswer) => {
              const answer =
                siblingsAnswer === "yes" || siblingsAnswer === "none" || siblingsAnswer === "not_asked"
                  ? siblingsAnswer
                  : ("" as const)
              setBlockDraft({ ...blockDraft, siblingsAnswer: answer })
            }}
          >
            <option value="">Select…</option>
            <option value="yes">Yes</option>
            <option value="none">None</option>
            <option value="not_asked">Not asked</option>
          </SelectField>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
      <RelationshipEditFooter
        saving={saving}
        saveDisabled={!canSave}
        onCancel={requestClose}
        onSave={() =>
          void onSave({
            kind,
            parentSide,
            block: {
              status: blockDraft.status,
              statusDetail: blockDraft.statusDetail,
              arrangementType: blockDraft.arrangementType,
              arrangementDetail: blockDraft.arrangementDetail,
              startedOn: blockDraft.startedOn,
              endedOn: blockDraft.endedOn,
              childrenAnswer: blockDraft.childrenAnswer,
              siblingsAnswer: blockDraft.siblingsAnswer,
            },
            person: personDraft,
          })
        }
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

/** Both entry points resolve to this same React component. */
export function newRelationshipFormForEntryPoint(
  entry: keyof typeof NEW_RELATIONSHIP_ENTRY_POINTS
): typeof NewRelationshipPanel {
  void entry
  return NewRelationshipPanel
}
