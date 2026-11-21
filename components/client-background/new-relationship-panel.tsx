"use client"

import { useState } from "react"

import { ContextStrip } from "@/components/client-background/context-strip"
import { SelectField } from "@/components/client-background/fields"
import {
  BlockFields,
  PanelHeader,
  PersonFields,
  draftFromPerson,
  type PersonDraft,
} from "@/components/client-background/relationship-panel-shared"
import { resolveFormContext } from "@/lib/client-background/form-context"
import {
  NEW_RELATIONSHIP_ENTRY_POINTS,
  NEW_RELATIONSHIP_FORM_ID,
  newRelationshipFormIdForEntryPoint,
} from "@/lib/client-background/new-relationship-form"
import type { RelationshipBlock, RelationshipRecord } from "@/lib/client-background/types"
import { cn } from "@/lib/utils"

export {
  NEW_RELATIONSHIP_ENTRY_POINTS,
  NEW_RELATIONSHIP_FORM_ID,
  newRelationshipFormIdForEntryPoint,
}

const linkClass = "text-sm text-primary underline-offset-2 hover:underline"

/**
 * Shared New relationship / New arrangement form (board AE): context strip,
 * Status/Arrangement · Started · Ended, Partner/Caregiver basics, Children or
 * Siblings, footer Add another · Done. Used by interview and Client Background.
 */
export function NewRelationshipPanel({
  block,
  member,
  people,
  locked,
  error,
  onBlockChange,
  onPersonChange,
  onAddAnother,
  onDone,
  onClose,
}: {
  block: RelationshipBlock
  member: RelationshipRecord
  people: RelationshipRecord[]
  locked: boolean
  error: string | null
  onBlockChange: (draft: RelationshipBlock) => void
  onPersonChange: (draft: PersonDraft) => void
  onAddAnother: (blockDraft: RelationshipBlock, personDraft: PersonDraft) => Promise<void>
  onDone: (blockDraft: RelationshipBlock, personDraft: PersonDraft) => void
  onClose: (blockDraft: RelationshipBlock, personDraft: PersonDraft) => void
}) {
  const [blockDraft, setBlockDraft] = useState(block)
  const [personDraft, setPersonDraft] = useState(draftFromPerson(member))
  const isArrangement = block.kind === "caregiver_arrangement"
  const context = resolveFormContext(
    {
      clientName: "",
      about: "self",
      block,
      person:
        block.kind === "parent_other"
          ? people.find(
              (person) =>
                person.relationshipToClient === block.parentSide ||
                (person.blockRole === "parent" && person.blockRoleType === block.parentSide)
            ) ?? null
          : null,
    },
    people
  )
  const showChildren = block.kind === "client_current" || block.kind === "client_previous"
  const showSiblings = block.kind === "parent_other" || block.kind === "caregiver_arrangement"
  const addLabel = isArrangement ? "Add another caregiver" : "Add another partner"

  return (
    <div data-form-id={NEW_RELATIONSHIP_FORM_ID} className="flex min-h-0 flex-1 flex-col">
      <PanelHeader
        initial="+"
        deceased={false}
        title={isArrangement ? "New arrangement" : "New relationship"}
        subtitle=""
        onClose={() => onClose(blockDraft, personDraft)}
      />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <ContextStrip lines={context.lines} readOnly />
        <BlockFields
          block={blockDraft}
          locked={locked}
          showChildrenQuestion={false}
          onChange={(next) => {
            setBlockDraft(next)
            onBlockChange(next)
          }}
        />
        <div className="space-y-2">
          <h3 className="text-sm font-medium">{isArrangement ? "Caregiver" : "Partner"}</h3>
          <PersonFields
            idPrefix={`${member.relationshipRecordId}-new`}
            person={member}
            block={blockDraft}
            draft={personDraft}
            basicsOnly
            onChange={(next) => {
              setPersonDraft(next)
              onPersonChange(next)
            }}
          />
        </div>
        {showChildren ? (
          <SelectField
            id={`${block.relationshipBlockId}-children-new`}
            label="Children"
            value={blockDraft.childrenAnswer || (blockDraft.noChildren ? "none" : "")}
            onChange={(childrenAnswer) => {
              const answer =
                childrenAnswer === "yes" || childrenAnswer === "none" || childrenAnswer === "not_asked"
                  ? childrenAnswer
                  : ("" as const)
              const next: RelationshipBlock = {
                ...blockDraft,
                childrenAnswer: answer,
                noChildren: answer === "none",
              }
              setBlockDraft(next)
              onBlockChange(next)
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
            id={`${block.relationshipBlockId}-siblings-new`}
            label="Siblings"
            value={blockDraft.siblingsAnswer || ""}
            onChange={(siblingsAnswer) => {
              const answer =
                siblingsAnswer === "yes" || siblingsAnswer === "none" || siblingsAnswer === "not_asked"
                  ? siblingsAnswer
                  : ("" as const)
              const next: RelationshipBlock = {
                ...blockDraft,
                siblingsAnswer: answer,
              }
              setBlockDraft(next)
              onBlockChange(next)
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
      <footer className="flex flex-wrap items-center gap-2 border-t p-4">
        <button
          type="button"
          className={cn(linkClass, "min-h-10")}
          onClick={() => void onAddAnother(blockDraft, personDraft)}
        >
          {addLabel}
        </button>
        <span className="flex-1" />
        <button
          type="button"
          className="inline-flex min-h-10 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground"
          onClick={() => onDone(blockDraft, personDraft)}
        >
          Done
        </button>
      </footer>
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
