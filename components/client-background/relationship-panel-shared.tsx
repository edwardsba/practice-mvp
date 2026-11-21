"use client"

import { useState, type ReactNode } from "react"
import { X } from "lucide-react"

import { PartialDatePicker, SelectField, TextAreaField, TextField } from "@/components/client-background/fields"
import {
  childTypesForBlock,
  rolesForBlock,
  siblingTypesForBlock,
  statusesForBlock,
} from "@/lib/client-background/relationship-blocks"
import { moveTargets } from "@/lib/client-background/relationship-tree"
import {
  ARRANGEMENT_TYPE_LABELS,
  ARRANGEMENT_TYPES,
  CAREGIVER_RELATIONSHIP_LABELS,
  CAREGIVER_RELATIONSHIPS,
  CHILD_TYPE_LABELS,
  CURRENT_BLOCK_STATUS_LABELS,
  DEPENDENCY_LABELS,
  DEPENDENCY_VALUES,
  HEALTH_STATUS_LABELS,
  HEALTH_STATUSES,
  NEVER_IN_A_RELATIONSHIP,
  PREVIOUS_BLOCK_STATUS_LABELS,
  RELATIONSHIP_LIVING_SITUATION_LABELS,
  RELATIONSHIP_LIVING_SITUATIONS,
  RELATIONSHIP_RATING_LABELS,
  RELATIONSHIP_RATING_VALUES,
  SEX_OPTIONS,
  SIBLING_BLOCK_TYPE_LABELS,
  type ArrangementType,
  type BlockKind,
  type BlockRole,
  type RelationshipBlock,
  type RelationshipRecord,
} from "@/lib/client-background/types"
import { cn } from "@/lib/utils"

export type PersonDraft = {
  givenName: string
  sex: string
  dateOfBirth: string
  blockRoleType: string
  healthStatus: RelationshipRecord["healthStatus"] | ""
  dateOfDeath: string
  supportive: RelationshipRecord["supportive"] | ""
  conflict: RelationshipRecord["conflict"] | ""
  qualityOfRelationship: string
  dependency: RelationshipRecord["dependency"] | ""
  livingSituation: RelationshipRecord["livingSituation"] | ""
  notKnown: boolean
  deceased: boolean
}

export const ROLE_LABELS: Record<BlockRole, string> = {
  partner: "Partner",
  child: "Child",
  parent: "Parent",
  sibling: "Sibling",
  caregiver: "Caregiver",
}

export const emptyPersonDraft: PersonDraft = {
  givenName: "",
  sex: "",
  dateOfBirth: "",
  blockRoleType: "",
  healthStatus: "",
  dateOfDeath: "",
  supportive: "",
  conflict: "",
  qualityOfRelationship: "",
  dependency: "",
  livingSituation: "",
  notKnown: false,
  deceased: false,
}

export function draftFromPerson(person: RelationshipRecord): PersonDraft {
  return {
    givenName: person.givenName,
    sex: person.sex,
    dateOfBirth: person.dateOfBirth,
    blockRoleType: person.blockRoleType ?? "",
    healthStatus: person.healthStatus,
    dateOfDeath: person.dateOfDeath,
    supportive: person.supportive,
    conflict: person.conflict,
    qualityOfRelationship: person.qualityOfRelationship,
    dependency: person.dependency,
    livingSituation: person.livingSituation,
    notKnown: person.notKnown,
    deceased: person.deceased,
  }
}

export function personFromDraft(person: RelationshipRecord, draft: PersonDraft): RelationshipRecord {
  const deceased = draft.healthStatus === "deceased" || (draft.deceased && draft.healthStatus === "")
  return {
    ...person,
    givenName: draft.givenName,
    sex: draft.sex as RelationshipRecord["sex"],
    dateOfBirth: draft.dateOfBirth,
    blockRoleType: draft.blockRoleType,
    healthStatus: draft.healthStatus,
    dateOfDeath: deceased ? draft.dateOfDeath : "",
    supportive: draft.supportive,
    conflict: draft.conflict,
    qualityOfRelationship: draft.qualityOfRelationship,
    dependency: draft.dependency,
    livingSituation: draft.livingSituation,
    notKnown: draft.notKnown,
    deceased,
  }
}

export function statusLabel(status: string): string {
  if (status === NEVER_IN_A_RELATIONSHIP) return "Never in a relationship"
  if (status in CURRENT_BLOCK_STATUS_LABELS) {
    return CURRENT_BLOCK_STATUS_LABELS[status as keyof typeof CURRENT_BLOCK_STATUS_LABELS]
  }
  if (status in PREVIOUS_BLOCK_STATUS_LABELS) {
    return PREVIOUS_BLOCK_STATUS_LABELS[status as keyof typeof PREVIOUS_BLOCK_STATUS_LABELS]
  }
  return status
}

export function typeOptionLabel(role: BlockRole | "" | undefined, value: string): string {
  if (!value) return ""
  if (role === "child" && value in CHILD_TYPE_LABELS) return CHILD_TYPE_LABELS[value as keyof typeof CHILD_TYPE_LABELS]
  if (role === "sibling" && value in SIBLING_BLOCK_TYPE_LABELS) {
    return SIBLING_BLOCK_TYPE_LABELS[value as keyof typeof SIBLING_BLOCK_TYPE_LABELS]
  }
  if (role === "parent") return value === "father" ? "Father" : "Mother"
  if (role === "caregiver" && value in CAREGIVER_RELATIONSHIP_LABELS) {
    return CAREGIVER_RELATIONSHIP_LABELS[value as keyof typeof CAREGIVER_RELATIONSHIP_LABELS]
  }
  return value
}

export function typesForRole(kind: BlockKind | null, role: BlockRole, arrangement: string): string[] {
  if (!kind) return []
  if (role === "child") return [...childTypesForBlock(kind)]
  if (role === "sibling") return [...siblingTypesForBlock(kind)]
  if (role === "parent") return ["mother", "father"]
  if (role === "caregiver" && arrangement !== "adoption") return [...CAREGIVER_RELATIONSHIPS]
  return []
}

export function PanelHeader({
  initial,
  deceased,
  title,
  subtitle,
  onClose,
}: {
  initial: string
  deceased: boolean
  title: string
  subtitle: string
  onClose: () => void
}) {
  return (
    <header className="flex items-start gap-3 border-b p-4">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-medium",
          deceased ? "border-2 border-dashed border-[#a1a1aa]" : "bg-muted"
        )}
        aria-hidden
      >
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-base font-medium">{title}</h2>
        <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <button
        type="button"
        className="inline-flex size-10 items-center justify-center rounded-md hover:bg-muted"
        aria-label="Close"
        onClick={onClose}
      >
        <X className="size-4" />
      </button>
    </header>
  )
}

export function PersonFields({
  idPrefix,
  person,
  block,
  draft,
  onChange,
  /** New relationship form: Name, Sex, DOB/age, Health (+ caregiver Relationship). */
  basicsOnly = false,
}: {
  idPrefix: string
  person: RelationshipRecord
  block: RelationshipBlock | null
  draft: PersonDraft
  onChange: (draft: PersonDraft) => void
  basicsOnly?: boolean
}) {
  function patch(partial: Partial<PersonDraft>) {
    onChange({ ...draft, ...partial })
  }
  const role = person.blockRole
  const kind = block?.kind
  const childTypes = kind ? childTypesForBlock(kind) : []
  const siblingTypes = kind ? siblingTypesForBlock(kind) : []
  return (
    <div className="space-y-3">
      <TextField id={`${idPrefix}-name`} label="Name" value={draft.givenName} onChange={(givenName) => patch({ givenName })} />
      <SelectField id={`${idPrefix}-sex`} label="Sex" value={draft.sex} onChange={(sex) => patch({ sex })}>
        <option value="">Not recorded</option>
        {SEX_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </SelectField>
      <PartialDatePicker
        id={`${idPrefix}-dob`}
        dateLabel="Date of birth or age"
        mode="person"
        value={draft.dateOfBirth}
        onChange={(dateOfBirth) => patch({ dateOfBirth })}
      />
      {!basicsOnly && role === "child" && childTypes.length > 0 ? (
        <SelectField
          id={`${idPrefix}-child-type`}
          label="Type"
          value={draft.blockRoleType}
          onChange={(blockRoleType) => patch({ blockRoleType })}
        >
          <option value="">Not recorded</option>
          {childTypes.map((type) => (
            <option key={type} value={type}>
              {CHILD_TYPE_LABELS[type]}
            </option>
          ))}
        </SelectField>
      ) : null}
      {!basicsOnly && role === "sibling" && siblingTypes.length > 0 ? (
        <SelectField
          id={`${idPrefix}-sibling-type`}
          label="Type"
          value={draft.blockRoleType}
          onChange={(blockRoleType) => patch({ blockRoleType })}
        >
          {siblingTypes.map((type) => (
            <option key={type} value={type}>
              {SIBLING_BLOCK_TYPE_LABELS[type]}
            </option>
          ))}
        </SelectField>
      ) : null}
      {!basicsOnly && role === "parent" ? (
        <SelectField
          id={`${idPrefix}-parent`}
          label="Parent"
          value={draft.blockRoleType || "mother"}
          onChange={(blockRoleType) => patch({ blockRoleType })}
        >
          <option value="mother">Mother</option>
          <option value="father">Father</option>
        </SelectField>
      ) : null}
      {role === "caregiver" && block?.arrangementType !== "adoption" ? (
        <SelectField
          id={`${idPrefix}-caregiver`}
          label="Relationship"
          value={draft.blockRoleType}
          onChange={(blockRoleType) => patch({ blockRoleType })}
        >
          <option value="">Not recorded</option>
          {CAREGIVER_RELATIONSHIPS.map((type) => (
            <option key={type} value={type}>
              {CAREGIVER_RELATIONSHIP_LABELS[type]}
            </option>
          ))}
        </SelectField>
      ) : null}
      {!basicsOnly && role === "parent" ? (
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.notKnown} onChange={(event) => patch({ notKnown: event.target.checked })} />
          Not known
        </label>
      ) : null}
      <SelectField
        id={`${idPrefix}-health`}
        label="Health"
        value={draft.healthStatus}
        onChange={(healthStatus) =>
          patch({
            healthStatus: healthStatus as PersonDraft["healthStatus"],
            deceased: healthStatus === "deceased",
          })
        }
      >
        <option value="">Not recorded</option>
        {HEALTH_STATUSES.map((option) => (
          <option key={option} value={option}>
            {HEALTH_STATUS_LABELS[option]}
          </option>
        ))}
      </SelectField>
      {draft.healthStatus === "deceased" || draft.deceased ? (
        <PartialDatePicker
          id={`${idPrefix}-died`}
          dateLabel="Year of death"
          mode="date-only"
          value={draft.dateOfDeath}
          onChange={(dateOfDeath) => patch({ dateOfDeath })}
        />
      ) : null}
      {basicsOnly ? null : (
      <>
      <SelectField
        id={`${idPrefix}-support`}
        label="Supportive"
        value={draft.supportive}
        onChange={(supportive) => patch({ supportive: supportive as PersonDraft["supportive"] })}
      >
        <option value="">Not recorded</option>
        {RELATIONSHIP_RATING_VALUES.map((option) => (
          <option key={option} value={option}>
            {RELATIONSHIP_RATING_LABELS[option]}
          </option>
        ))}
      </SelectField>
      <SelectField
        id={`${idPrefix}-conflict`}
        label="Conflict or strain"
        value={draft.conflict}
        onChange={(conflict) => patch({ conflict: conflict as PersonDraft["conflict"] })}
      >
        <option value="">Not recorded</option>
        {RELATIONSHIP_RATING_VALUES.map((option) => (
          <option key={option} value={option}>
            {RELATIONSHIP_RATING_LABELS[option]}
          </option>
        ))}
      </SelectField>
      <TextAreaField
        id={`${idPrefix}-comment`}
        label="Comment"
        value={draft.qualityOfRelationship}
        onChange={(qualityOfRelationship) => patch({ qualityOfRelationship })}
      />
      <SelectField
        id={`${idPrefix}-dependency`}
        label="Dependency"
        value={draft.dependency}
        onChange={(dependency) => patch({ dependency: dependency as PersonDraft["dependency"] })}
      >
        <option value="">Not recorded</option>
        {DEPENDENCY_VALUES.map((option) => (
          <option key={option} value={option}>
            {DEPENDENCY_LABELS[option]}
          </option>
        ))}
      </SelectField>
      <SelectField
        id={`${idPrefix}-living`}
        label="Living situation"
        value={draft.livingSituation}
        onChange={(livingSituation) => patch({ livingSituation: livingSituation as PersonDraft["livingSituation"] })}
      >
        <option value="">Not recorded</option>
        {RELATIONSHIP_LIVING_SITUATIONS.map((option) => (
          <option key={option} value={option}>
            {RELATIONSHIP_LIVING_SITUATION_LABELS[option]}
          </option>
        ))}
      </SelectField>
      </>
      )}
    </div>
  )
}

export function BlockFields({
  block,
  locked,
  onChange,
  showChildrenQuestion = false,
  hideEndedForCurrent = true,
}: {
  block: RelationshipBlock
  locked: boolean
  onChange: (block: RelationshipBlock) => void
  /** Yes / None / Not asked — same as the interview Children dropdown. */
  showChildrenQuestion?: boolean
  hideEndedForCurrent?: boolean
}) {
  const statuses = statusesForBlock(block.kind)
  const hideEnded =
    hideEndedForCurrent &&
    (block.kind === "client_current" ||
      block.status === "married" ||
      block.status === "de_facto" ||
      block.status === "dating" ||
      block.status === "engaged" ||
      (block.status in CURRENT_BLOCK_STATUS_LABELS && block.kind !== "client_previous"))
  return (
    <div className="space-y-3">
      {statuses.length > 0 ? (
        locked ? (
          <p className="text-sm">
            {statusLabel(block.status) || "Not recorded"}
            <span className="mt-1 block text-xs text-muted-foreground">Set by the client&apos;s relationship status.</span>
          </p>
        ) : (
          <SelectField
            id={`${block.relationshipBlockId}-status`}
            label={block.kind === "client_previous" ? "How it ended" : "Status"}
            value={block.status}
            onChange={(status) => onChange({ ...block, status })}
          >
            <option value="">Not recorded</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </SelectField>
        )
      ) : null}
      {block.status === "other" ? (
        <TextField
          id={`${block.relationshipBlockId}-other`}
          label="Other status"
          value={block.statusDetail}
          onChange={(statusDetail) => onChange({ ...block, statusDetail })}
        />
      ) : null}
      {block.kind === "client_other_children" ? (
        <TextField
          id={`${block.relationshipBlockId}-relationship`}
          label="Relationship"
          placeholder="e.g. IVF with a donor, sole adoption"
          value={block.statusDetail}
          onChange={(statusDetail) => onChange({ ...block, statusDetail })}
        />
      ) : null}
      {block.kind === "caregiver_arrangement" ? (
        <SelectField
          id={`${block.relationshipBlockId}-arrangement`}
          label="Arrangement"
          value={block.arrangementType}
          onChange={(arrangementType) => onChange({ ...block, arrangementType: arrangementType as ArrangementType | "" })}
        >
          <option value="">Not recorded</option>
          {ARRANGEMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {ARRANGEMENT_TYPE_LABELS[type]}
            </option>
          ))}
        </SelectField>
      ) : null}
      {block.arrangementType === "other" ? (
        <TextField
          id={`${block.relationshipBlockId}-arrangement-detail`}
          label="Other arrangement"
          value={block.arrangementDetail}
          onChange={(arrangementDetail) => onChange({ ...block, arrangementDetail })}
        />
      ) : null}
      {block.kind !== "client_other_children" ? (
        <PartialDatePicker
          id={`${block.relationshipBlockId}-start`}
          dateLabel="Started"
          mode="date-only"
          value={block.startedOn}
          onChange={(startedOn) => onChange({ ...block, startedOn })}
        />
      ) : null}
      {block.kind !== "client_other_children" && !hideEnded ? (
        <PartialDatePicker
          id={`${block.relationshipBlockId}-end`}
          dateLabel="Ended"
          mode="date-only"
          value={block.endedOn}
          onChange={(endedOn) => onChange({ ...block, endedOn })}
        />
      ) : null}
      {showChildrenQuestion && (block.kind === "client_current" || block.kind === "client_previous") ? (
        <SelectField
          id={`${block.relationshipBlockId}-children`}
          label="Children"
          value={block.childrenAnswer || ""}
          onChange={(childrenAnswer) =>
            onChange({
              ...block,
              childrenAnswer: childrenAnswer === "yes" || childrenAnswer === "none" || childrenAnswer === "not_asked" ? childrenAnswer : "",
            })
          }
        >
          <option value="">Select…</option>
          <option value="yes">Yes</option>
          <option value="none">None</option>
          <option value="not_asked">Not asked</option>
        </SelectField>
      ) : null}
    </div>
  )
}

export function MoveStep({
  name,
  person,
  blocks,
  people,
  saving,
  error,
  onCancel,
  onMove,
}: {
  name: string
  person: RelationshipRecord
  blocks: RelationshipBlock[]
  people: RelationshipRecord[]
  saving: boolean
  error: string
  onCancel: () => void
  onMove: (destinationId: string, role: BlockRole, roleType: string) => Promise<void>
}) {
  const targets = moveTargets(blocks, person.relationshipBlockId ?? null, people)
  const [blockId, setBlockId] = useState("")
  const [role, setRole] = useState<BlockRole | "">("")
  const [roleType, setRoleType] = useState("")
  const target = targets.find((item) => item.id === blockId)
  const roles = target ? rolesForBlock(target.kind) : []
  const chosenRole = role && roles.includes(role) ? role : ""
  const arrangement = blocks.find((item) => item.relationshipBlockId === blockId)?.arrangementType ?? ""
  const types = chosenRole ? typesForRole(target?.kind ?? null, chosenRole, arrangement) : []
  const chosenType = types.includes(roleType) ? roleType : ""
  const ready = Boolean(blockId && chosenRole && (types.length === 0 || chosenType))
  return (
    <>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <h3 className="text-sm font-medium">Move {name} to…</h3>
        <fieldset className="space-y-1">
          <legend className="text-sm text-muted-foreground">Relationship</legend>
          {targets.map((item) => (
            <label key={item.id} className="flex min-h-10 items-center gap-2 text-sm">
              <input
                type="radio"
                name={`move-block-${person.relationshipRecordId}`}
                checked={blockId === item.id}
                onChange={() => {
                  setBlockId(item.id)
                  setRole("")
                  setRoleType("")
                }}
              />
              {item.label}
            </label>
          ))}
        </fieldset>
        <fieldset className={cn("space-y-1", !blockId && "opacity-60")} disabled={!blockId}>
          <legend className="text-sm text-muted-foreground">Role</legend>
          {blockId ? (
            roles.map((item) => (
              <label key={item} className="flex min-h-10 items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`move-role-${person.relationshipRecordId}`}
                  checked={chosenRole === item}
                  onChange={() => {
                    setRole(item)
                    setRoleType("")
                  }}
                />
                {ROLE_LABELS[item]}
              </label>
            ))
          ) : (
            <p className="flex min-h-10 items-center text-sm text-muted-foreground">Choose a relationship first.</p>
          )}
        </fieldset>
        {chosenRole && types.length > 0 ? (
          <fieldset className="space-y-1">
            <legend className="text-sm text-muted-foreground">Type</legend>
            {types.map((item) => (
              <label key={item} className="flex min-h-10 items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`move-type-${person.relationshipRecordId}`}
                  checked={chosenType === item}
                  onChange={() => setRoleType(item)}
                />
                {typeOptionLabel(chosenRole, item)}
              </label>
            ))}
          </fieldset>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
      <footer className="flex items-center justify-end gap-2 border-t p-4">
        <button type="button" className="inline-flex min-h-10 items-center rounded-md border px-3 text-sm" disabled={saving} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="inline-flex min-h-10 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-60"
          disabled={saving || !ready || chosenRole === ""}
          onClick={() => {
            if (chosenRole === "") return
            void onMove(blockId, chosenRole, chosenType)
          }}
        >
          Move
        </button>
      </footer>
    </>
  )
}

export function RelationshipPanelShell({
  ariaLabel,
  onDismiss,
  children,
}: {
  ariaLabel: string
  onDismiss: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-black/20" aria-label="Dismiss" onClick={onDismiss} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className="absolute inset-y-0 right-0 flex w-full animate-[relationship-panel_200ms_ease-out] flex-col bg-background shadow-xl sm:w-[440px]"
      >
        <style>{`@keyframes relationship-panel { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
        {children}
      </aside>
    </div>
  )
}
