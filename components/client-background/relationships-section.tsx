"use client"

import { useMemo, useState, type ReactNode } from "react"

import {
  createRelationshipAction,
  deleteRelationshipAction,
  updatePartnershipAction,
  updateRelationshipAction,
} from "@/app/clients/[client_id]/background/actions"
import { ReadOnlyField, SaveRow, SelectField, TextAreaField, TextField } from "@/components/client-background/fields"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DEPENDENCY_LABELS,
  DEPENDENCY_VALUES,
  HEALTH_STATUSES,
  HEALTH_STATUS_LABELS,
  PARTNERSHIP_STATUSES,
  PARTNERSHIP_STATUS_LABELS,
  RELATIONSHIP_TO_CLIENT_LABELS,
  type PartnershipRecord,
  type RelationshipRecord,
  type RelationshipToClient,
} from "@/lib/client-background/types"
import type { CreateRelationshipInput } from "@/lib/client-background/types"
import {
  buildRelationshipTree,
  canonicalParentsLink,
  originPartnerships,
  otherPersonInPartnership,
  parentsRelationshipLabel,
  partnershipsForPerson,
  personName,
  personRoleLabel,
  relationshipLineLabel,
  treeLineStatus,
} from "@/lib/client-background/tree"
import {
  applyRelationshipVisibilityDefaults,
  isMinorChild,
  relationshipFieldVisibility,
} from "@/lib/client-background/visibility"
import { cn } from "@/lib/utils"

type Picker =
  | null
  | "menu"
  | "partner"
  | "unlinked-child"
  | "sibling-partnership"
  | { kind: "child"; partnerRecordId: string }
  | { kind: "step-sibling"; partnershipRecordId: string }

type Selection = { kind: "person"; id: string } | { kind: "partnership"; id: string } | null

export function RelationshipsSection({
  clientId,
  relationships,
  partnerships,
}: {
  clientId: string
  relationships: RelationshipRecord[]
  partnerships: PartnershipRecord[]
}) {
  const [people, setPeople] = useState(relationships)
  const [pairs, setPairs] = useState(partnerships)
  const [selection, setSelection] = useState<Selection>(null)
  const [mobileDetail, setMobileDetail] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<RelationshipRecord | null>(null)
  const [draftPairs, setDraftPairs] = useState<PartnershipRecord[]>([])
  const [partnershipDraft, setPartnershipDraft] = useState<PartnershipRecord | null>(null)
  const [picker, setPicker] = useState<Picker>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tree = useMemo(() => buildRelationshipTree(people, pairs), [people, pairs])
  const parentLinks = useMemo(() => originPartnerships(people, pairs), [people, pairs])
  const parentsLink = useMemo(() => canonicalParentsLink(people, pairs), [people, pairs])
  const originRows = useMemo(() => {
    const primary = [parentsLink.mother, parentsLink.father].filter((person): person is RelationshipRecord => person != null)
    const primaryIds = new Set(primary.map((person) => person.relationshipRecordId))
    const rest = tree.originParents.filter((person) => !primaryIds.has(person.relationshipRecordId))
    return [...primary, ...rest]
  }, [parentsLink, tree.originParents])

  function personPartnerships(personId: string, partnershipList: PartnershipRecord[]) {
    return partnershipsForPerson(personId, partnershipList).filter(
      (item) => item.partnershipRecordId !== parentsLink.partnership?.partnershipRecordId
    )
  }

  function openPerson(person: RelationshipRecord, partnershipList: PartnershipRecord[], startEditing = false) {
    setSelection({ kind: "person", id: person.relationshipRecordId })
    setMobileDetail(true)
    setDraft({ ...person })
    setDraftPairs(personPartnerships(person.relationshipRecordId, partnershipList).map((item) => ({ ...item })))
    setPartnershipDraft(null)
    setEditing(startEditing)
    setError(null)
    setPicker(null)
  }

  function openPartnership(partnership: PartnershipRecord, startEditing = false) {
    setSelection({ kind: "partnership", id: partnership.partnershipRecordId })
    setMobileDetail(true)
    setPartnershipDraft({ ...partnership })
    setDraft(null)
    setDraftPairs([])
    setEditing(startEditing)
    setError(null)
    setPicker(null)
  }

  async function create(spec: CreateRelationshipInput) {
    setPending(true)
    setError(null)
    const result = await createRelationshipAction(clientId, spec)
    setPending(false)
    if (result.error || !result.relationship) {
      setError(result.error ?? "Could not add this person.")
      return
    }
    const nextPeople = [...people, result.relationship]
    const nextPairs = mergePartnerships(pairs, result.partnerships ?? [])
    setPeople(nextPeople)
    setPairs(nextPairs)
    openPerson(result.relationship, nextPairs, true)
  }

  function addFullSibling() {
    if (parentLinks.length > 1) {
      setPicker("sibling-partnership")
      return
    }
    void create({
      kind: "full_sibling",
      partnershipRecordId: parentLinks[0]?.partnershipRecordId ?? null,
    })
  }

  function cancelEdit() {
    if (selection?.kind === "person") {
      const person = people.find((item) => item.relationshipRecordId === selection.id)
      if (person) {
        setDraft({ ...person })
        setDraftPairs(personPartnerships(person.relationshipRecordId, pairs).map((item) => ({ ...item })))
      }
    }
    if (selection?.kind === "partnership") {
      const partnership = pairs.find((item) => item.partnershipRecordId === selection.id)
      if (partnership) setPartnershipDraft({ ...partnership })
    }
    setEditing(false)
    setError(null)
  }

  async function savePerson() {
    if (!draft) return
    setPending(true)
    setError(null)
    const result = await updateRelationshipAction(clientId, draft, draftPairs)
    setPending(false)
    if (result.error || !result.relationship) {
      setError(result.error ?? "Could not save this person.")
      return
    }
    setPeople((current) =>
      current.map((person) =>
        person.relationshipRecordId === result.relationship!.relationshipRecordId ? result.relationship! : person
      )
    )
    const nextPairs = result.partnerships ? mergePartnerships(pairs, result.partnerships) : pairs
    if (result.partnerships) setPairs(nextPairs)
    setDraft(result.relationship)
    setDraftPairs(personPartnerships(result.relationship.relationshipRecordId, nextPairs).map((item) => ({ ...item })))
    setEditing(false)
  }

  async function savePartnership() {
    if (!partnershipDraft) return
    setPending(true)
    setError(null)
    const result = await updatePartnershipAction(clientId, partnershipDraft)
    setPending(false)
    if (result.error || !result.partnership) {
      setError(result.error ?? "Could not save this relationship.")
      return
    }
    setPairs((current) => mergePartnerships(current, [result.partnership!]))
    setPartnershipDraft(result.partnership)
    setEditing(false)
  }

  async function remove() {
    if (!draft) return
    if (!window.confirm(`Remove ${personName(draft)} from this client's relationships?`)) return
    setPending(true)
    setError(null)
    const result = await deleteRelationshipAction(clientId, draft.relationshipRecordId)
    setPending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    const removedId = draft.relationshipRecordId
    setPeople((current) => current.filter((person) => person.relationshipRecordId !== removedId))
    setPairs((current) => current.filter((pair) => pair.partnerAId !== removedId && pair.partnerBId !== removedId))
    setSelection(null)
    setDraft(null)
    setDraftPairs([])
    setEditing(false)
    setMobileDetail(false)
  }

  function patch(partial: Partial<RelationshipRecord>) {
    if (!draft) return
    setDraft(applyRelationshipVisibilityDefaults({ ...draft, ...partial }))
  }

  const list = (
    <div className="max-h-[75vh] space-y-4 overflow-y-auto pr-1 text-[13px]">
      <Button type="button" size="sm" disabled={pending} onClick={() => setPicker("menu")}>
        + Add family member
      </Button>
      {error && !draft && !partnershipDraft ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="space-y-1">
        <h2 className="text-sm font-semibold">Family of Origin</h2>
        {parentsLink.partnership ? (
          <TreeRow
            label={parentsRelationshipLabel(parentsLink.partnership)}
            selected={selection?.kind === "partnership" && selection.id === parentsLink.partnership.partnershipRecordId}
            onSelect={() => openPartnership(parentsLink.partnership!)}
          />
        ) : (
          <p className="px-2 text-muted-foreground">Parents&apos; relationship</p>
        )}
        {originRows.map((person) => (
          <TreeRow
            key={person.relationshipRecordId}
            label={relationshipLineLabel(person, treeLineStatus(person, pairs))}
            selected={selection?.kind === "person" && selection.id === person.relationshipRecordId}
            onSelect={() => openPerson(person, pairs)}
            extra={
              person.relationshipToClient === "mother" || person.relationshipToClient === "father" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={pending}
                  onClick={() => void create({ kind: "step_parent", parentRecordId: person.relationshipRecordId })}
                >
                  + Add relationship
                </Button>
              ) : null
            }
          />
        ))}
        {tree.fullSiblings.map((person) => (
          <TreeRow
            key={person.relationshipRecordId}
            label={relationshipLineLabel(person)}
            selected={selection?.kind === "person" && selection.id === person.relationshipRecordId}
            onSelect={() => openPerson(person, pairs)}
          />
        ))}
        <div className="pt-1">
          <Button type="button" variant="outline" size="xs" disabled={pending} onClick={addFullSibling}>
            + Add sibling
          </Button>
        </div>
      </section>

      <section className="space-y-2 border-t pt-4">
        <h2 className="text-sm font-semibold">Extended Family</h2>
        {tree.otherFamily.length === 0 && tree.unlinkedStepParents.length === 0 && tree.unlinkedStepSiblings.length === 0 ? (
          <p className="text-muted-foreground">Nothing recorded</p>
        ) : null}
        {tree.otherFamily.map((group) => (
          <div key={group.parent.relationshipRecordId} className="space-y-1">
            <p className="font-medium">{personName(group.parent)}</p>
            {group.stepParents.map((node) => (
              <div key={node.person.relationshipRecordId} className="ml-3 space-y-1 border-l pl-3">
                <TreeRow
                  label={relationshipLineLabel(node.person, treeLineStatus(node.person, pairs))}
                  selected={selection?.kind === "person" && selection.id === node.person.relationshipRecordId}
                  onSelect={() => openPerson(node.person, pairs)}
                />
                {node.siblings.map((sibling) => (
                  <div key={sibling.relationshipRecordId} className="ml-3">
                    <TreeRow
                      label={relationshipLineLabel(sibling)}
                      selected={selection?.kind === "person" && selection.id === sibling.relationshipRecordId}
                      onSelect={() => openPerson(sibling, pairs)}
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={pending}
                  onClick={() => setPicker({ kind: "step-sibling", partnershipRecordId: node.partnership.partnershipRecordId })}
                >
                  + Add step-sibling
                </Button>
              </div>
            ))}
          </div>
        ))}
        {tree.unlinkedStepParents.map((person) => (
          <TreeRow
            key={person.relationshipRecordId}
            label={relationshipLineLabel(person, treeLineStatus(person, pairs))}
            selected={selection?.kind === "person" && selection.id === person.relationshipRecordId}
            onSelect={() => openPerson(person, pairs)}
          />
        ))}
        {tree.unlinkedStepSiblings.map((person) => (
          <TreeRow
            key={person.relationshipRecordId}
            label={relationshipLineLabel(person)}
            selected={selection?.kind === "person" && selection.id === person.relationshipRecordId}
            onSelect={() => openPerson(person, pairs)}
          />
        ))}
      </section>

      <section className="space-y-2 border-t pt-4">
        <h2 className="text-sm font-semibold">Partners and Children</h2>
        {tree.partners.map((node) => (
          <div key={node.person.relationshipRecordId} className="space-y-1">
            <TreeRow
              label={relationshipLineLabel(node.person, treeLineStatus(node.person, pairs))}
              selected={selection?.kind === "person" && selection.id === node.person.relationshipRecordId}
              onSelect={() => openPerson(node.person, pairs)}
            />
            {node.children.map((child) => (
              <div key={child.relationshipRecordId} className="ml-3">
                <TreeRow
                  label={relationshipLineLabel(child)}
                  selected={selection?.kind === "person" && selection.id === child.relationshipRecordId}
                  onSelect={() => openPerson(child, pairs)}
                />
              </div>
            ))}
            <div className="ml-3">
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={pending}
                onClick={() => setPicker({ kind: "child", partnerRecordId: node.person.relationshipRecordId })}
              >
                + Add child
              </Button>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="xs" disabled={pending} onClick={() => setPicker("partner")}>
          + Add partner
        </Button>
        <div className="space-y-1">
          <p className="font-medium">Children not linked to a listed partner</p>
          {tree.unlinkedChildren.map((child) => (
            <TreeRow
              key={child.relationshipRecordId}
              label={relationshipLineLabel(child)}
              selected={selection?.kind === "person" && selection.id === child.relationshipRecordId}
              onSelect={() => openPerson(child, pairs)}
            />
          ))}
          <Button type="button" variant="outline" size="xs" disabled={pending} onClick={() => setPicker("unlinked-child")}>
            + Add child
          </Button>
        </div>
      </section>
    </div>
  )

  const detail = partnershipDraft ? (
    <PartnershipDetail
      partnership={partnershipDraft}
      editing={editing}
      pending={pending}
      error={error}
      onEdit={() => setEditing(true)}
      onCancel={cancelEdit}
      onChange={setPartnershipDraft}
      onSave={() => void savePartnership()}
      onBack={() => setMobileDetail(false)}
    />
  ) : draft ? (
    <PersonDetail
      draft={draft}
      draftPairs={draftPairs}
      people={people}
      editing={editing}
      pending={pending}
      error={error}
      canRemove={canRemovePerson(draft, people)}
      onEdit={() => setEditing(true)}
      onCancel={cancelEdit}
      onPatch={patch}
      onPairs={setDraftPairs}
      onSave={() => void savePerson()}
      onRemove={() => void remove()}
      onBack={() => setMobileDetail(false)}
    />
  ) : (
    <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed p-6 text-center text-[13px] text-muted-foreground">
      Select someone from the list, or add a new person
    </div>
  )

  return (
    <>
      <div className="lg:grid lg:grid-cols-2 lg:gap-4">
        <div className={cn(mobileDetail ? "hidden lg:block" : "block")}>{list}</div>
        <div className={cn(mobileDetail ? "block" : "hidden lg:block")}>{detail}</div>
      </div>
      <PickerDialog
        picker={picker}
        parentLinks={parentLinks}
        people={people}
        pending={pending}
        onClose={() => setPicker(null)}
        onPick={setPicker}
        onCreate={(spec) => void create(spec)}
      />
    </>
  )
}

function canRemovePerson(person: RelationshipRecord, people: RelationshipRecord[]) {
  if (person.relationshipToClient !== "mother" && person.relationshipToClient !== "father") return true
  return people.filter((item) => item.relationshipToClient === person.relationshipToClient).length > 1
}

function mergePartnerships(current: PartnershipRecord[], incoming: PartnershipRecord[]) {
  const byId = new Map(current.map((item) => [item.partnershipRecordId, item]))
  for (const item of incoming) byId.set(item.partnershipRecordId, item)
  return [...byId.values()]
}

function TreeRow({
  label,
  selected,
  onSelect,
  extra,
}: {
  label: string
  selected: boolean
  onSelect: () => void
  extra?: ReactNode
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className={cn("min-w-0 flex-1 rounded-md px-2 py-1 text-left hover:bg-muted", selected && "bg-muted font-medium")}
        onClick={onSelect}
      >
        {label}
      </button>
      {extra}
    </div>
  )
}

function DetailHeader({
  title,
  subtitle,
  editing,
  onEdit,
  onBack,
}: {
  title: string
  subtitle: string
  editing: boolean
  onEdit: () => void
  onBack: () => void
}) {
  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="lg:hidden" onClick={onBack}>
        ← Back to list
      </Button>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>
        {editing ? null : (
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
        )}
      </div>
    </>
  )
}

function PartnershipDetail({
  partnership,
  editing,
  pending,
  error,
  onEdit,
  onCancel,
  onChange,
  onSave,
  onBack,
}: {
  partnership: PartnershipRecord
  editing: boolean
  pending: boolean
  error: string | null
  onEdit: () => void
  onCancel: () => void
  onChange: (partnership: PartnershipRecord) => void
  onSave: () => void
  onBack: () => void
}) {
  const status = partnership.relationshipStatus ? PARTNERSHIP_STATUS_LABELS[partnership.relationshipStatus] : ""
  return (
    <div className="space-y-4 text-[13px] [&_input]:text-[13px] [&_label]:text-[13px] [&_select]:text-[13px] [&_textarea]:text-[13px]">
      <DetailHeader
        title="Parents' relationship"
        subtitle="Mother and father"
        editing={editing}
        onEdit={onEdit}
        onBack={onBack}
      />
      {editing ? (
        <>
          <PartnershipFields partnership={partnership} otherLabel="each other" onChange={onChange} />
          <SaveRow
            pending={pending}
            error={error}
            onSave={onSave}
            extra={
              <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onCancel}>
                Cancel
              </Button>
            }
          />
        </>
      ) : (
        <div className="space-y-3">
          <ReadOnlyField label="Relationship status" value={status} />
          <ReadOnlyField label="Start" value={partnership.started} />
          <ReadOnlyField label="End" value={partnership.ended} />
          <ReadOnlyField label="Quality of relationship" value={partnership.qualityOfRelationship} />
        </div>
      )}
    </div>
  )
}

function PartnershipFields({
  partnership,
  otherLabel,
  onChange,
}: {
  partnership: PartnershipRecord
  otherLabel: string
  onChange: (partnership: PartnershipRecord) => void
}) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="font-medium">Relationship — with {otherLabel}</p>
      <SelectField
        id={`partnership_status_${partnership.partnershipRecordId}`}
        label="Relationship status"
        value={partnership.relationshipStatus}
        onChange={(relationshipStatus) =>
          onChange({ ...partnership, relationshipStatus: relationshipStatus as PartnershipRecord["relationshipStatus"] })
        }
      >
        <option value="">Not recorded</option>
        {PARTNERSHIP_STATUSES.map((status) => (
          <option key={status} value={status}>
            {PARTNERSHIP_STATUS_LABELS[status]}
          </option>
        ))}
      </SelectField>
      <TextField
        id={`partnership_start_${partnership.partnershipRecordId}`}
        label="Start"
        value={partnership.started}
        onChange={(started) => onChange({ ...partnership, started })}
        placeholder="Year, date, or duration"
      />
      <TextField
        id={`partnership_end_${partnership.partnershipRecordId}`}
        label="End"
        value={partnership.ended}
        onChange={(ended) => onChange({ ...partnership, ended })}
      />
      <TextAreaField
        id={`partnership_quality_${partnership.partnershipRecordId}`}
        label={`Quality of relationship (with ${otherLabel})`}
        value={partnership.qualityOfRelationship}
        onChange={(qualityOfRelationship) => onChange({ ...partnership, qualityOfRelationship })}
      />
    </div>
  )
}

function PersonDetail({
  draft,
  draftPairs,
  people,
  editing,
  pending,
  error,
  canRemove,
  onEdit,
  onCancel,
  onPatch,
  onPairs,
  onSave,
  onRemove,
  onBack,
}: {
  draft: RelationshipRecord
  draftPairs: PartnershipRecord[]
  people: RelationshipRecord[]
  editing: boolean
  pending: boolean
  error: string | null
  canRemove: boolean
  onEdit: () => void
  onCancel: () => void
  onPatch: (partial: Partial<RelationshipRecord>) => void
  onPairs: (pairs: PartnershipRecord[]) => void
  onSave: () => void
  onRemove: () => void
  onBack: () => void
}) {
  return (
    <div className="space-y-4 text-[13px] [&_input]:text-[13px] [&_label]:text-[13px] [&_select]:text-[13px] [&_textarea]:text-[13px]">
      <DetailHeader
        title={personName(draft)}
        subtitle={personRoleLabel(draft)}
        editing={editing}
        onEdit={onEdit}
        onBack={onBack}
      />
      {editing ? (
        <>
          <RoleSelect record={draft} onChange={(relationshipToClient) => onPatch({ relationshipToClient })} />
          <TextField id="rel_name" label="Name" value={draft.givenName} onChange={(givenName) => onPatch({ givenName })} />
          <TextField id="rel_gender" label="Gender" value={draft.gender} onChange={(gender) => onPatch({ gender })} />
          <div className="space-y-1.5">
            <Label htmlFor="rel_age">Age</Label>
            <Input
              id="rel_age"
              type="number"
              min={0}
              value={draft.age ?? ""}
              onChange={(event) => onPatch({ age: event.target.value === "" ? null : Number(event.target.value) })}
            />
          </div>
          <SelectField
            id="rel_health"
            label="Health status"
            value={draft.healthStatus}
            hint="Select 'Deceased' if this person has passed away."
            onChange={(healthStatus) => onPatch({ healthStatus: healthStatus as RelationshipRecord["healthStatus"] })}
          >
            <option value="">Not recorded</option>
            {HEALTH_STATUSES.map((status) => (
              <option key={status} value={status}>
                {HEALTH_STATUS_LABELS[status]}
              </option>
            ))}
          </SelectField>
          {draft.healthStatus === "deceased" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="rel_age_death">Age at death</Label>
                <Input
                  id="rel_age_death"
                  type="number"
                  min={0}
                  value={draft.ageAtDeath ?? ""}
                  onChange={(event) =>
                    onPatch({ ageAtDeath: event.target.value === "" ? null : Number(event.target.value) })
                  }
                />
              </div>
              <TextField
                id="rel_cause"
                label="Health or cause of death"
                value={draft.healthOrCauseOfDeath}
                onChange={(healthOrCauseOfDeath) => onPatch({ healthOrCauseOfDeath })}
              />
            </>
          ) : null}
          <TextField
            id="rel_length"
            label="Length of relationship"
            value={draft.lengthOfRelationship}
            onChange={(lengthOfRelationship) => onPatch({ lengthOfRelationship })}
          />
          <RelationshipExtras record={draft} onChange={onPatch} />
          {draftPairs.map((partnership) => {
            const other = otherPersonInPartnership(partnership, draft.relationshipRecordId, people)
            return (
              <PartnershipFields
                key={partnership.partnershipRecordId}
                partnership={partnership}
                otherLabel={other ? personName(other) : "the other person"}
                onChange={(next) =>
                  onPairs(
                    draftPairs.map((item) =>
                      item.partnershipRecordId === partnership.partnershipRecordId ? next : item
                    )
                  )
                }
              />
            )
          })}
          <SaveRow
            pending={pending}
            error={error}
            onSave={onSave}
            extra={
              <>
                <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onCancel}>
                  Cancel
                </Button>
                {canRemove ? (
                  <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onRemove}>
                    Remove
                  </Button>
                ) : null}
              </>
            }
          />
        </>
      ) : (
        <PersonReadOnly record={draft} pairs={draftPairs} people={people} />
      )}
    </div>
  )
}

function PersonReadOnly({
  record,
  pairs,
  people,
}: {
  record: RelationshipRecord
  pairs: PartnershipRecord[]
  people: RelationshipRecord[]
}) {
  const visibility = relationshipFieldVisibility(record)
  return (
    <div className="space-y-3">
      <ReadOnlyField label="Relationship to client" value={personRoleLabel(record)} />
      <ReadOnlyField label="Name" value={record.givenName} />
      <ReadOnlyField label="Gender" value={record.gender} />
      <ReadOnlyField label="Age" value={record.age == null ? "" : String(record.age)} />
      <ReadOnlyField
        label="Health status"
        value={record.healthStatus ? HEALTH_STATUS_LABELS[record.healthStatus] : ""}
      />
      {record.healthStatus === "deceased" ? (
        <>
          <ReadOnlyField label="Age at death" value={record.ageAtDeath == null ? "" : String(record.ageAtDeath)} />
          <ReadOnlyField label="Health or cause of death" value={record.healthOrCauseOfDeath} />
        </>
      ) : null}
      <ReadOnlyField label="Length of relationship" value={record.lengthOfRelationship} />
      {visibility.relationshipStatus ? <ReadOnlyField label="Relationship status" value={record.relationshipStatus} /> : null}
      {visibility.timeSinceEnded ? <ReadOnlyField label="Time since ended" value={record.timeSinceEnded} /> : null}
      {visibility.qualityOfRelationship ? (
        <ReadOnlyField label="Quality of relationship (with client)" value={record.qualityOfRelationship} />
      ) : null}
      {visibility.dependency ? (
        <ReadOnlyField label="Dependency" value={record.dependency ? DEPENDENCY_LABELS[record.dependency] : ""} />
      ) : isMinorChild(record) ? (
        <p className="text-muted-foreground">Dependency is recorded as they depend on the client for children under 18.</p>
      ) : null}
      {visibility.livingSituation ? <ReadOnlyField label="Living situation" value={record.livingSituation} /> : null}
      {pairs.map((partnership) => {
        const other = otherPersonInPartnership(partnership, record.relationshipRecordId, people)
        const otherLabel = other ? personName(other) : "the other person"
        const status = partnership.relationshipStatus ? PARTNERSHIP_STATUS_LABELS[partnership.relationshipStatus] : ""
        return (
          <div key={partnership.partnershipRecordId} className="space-y-3 rounded-md border p-3">
            <p className="font-medium">Relationship — with {otherLabel}</p>
            <ReadOnlyField label="Relationship status" value={status} />
            <ReadOnlyField label="Start" value={partnership.started} />
            <ReadOnlyField label="End" value={partnership.ended} />
            <ReadOnlyField label="Quality of relationship" value={partnership.qualityOfRelationship} />
          </div>
        )
      })}
    </div>
  )
}

function RoleSelect({
  record,
  onChange,
}: {
  record: RelationshipRecord
  onChange: (role: RelationshipToClient) => void
}) {
  const role = record.relationshipToClient
  if (role === "mother" || role === "father") return null
  const options = roleOptions(role)
  if (!options) return null
  return (
    <SelectField id="rel_role" label="Relationship to client" value={role} onChange={(next) => onChange(next as RelationshipToClient)}>
      {options.map((option) => (
        <option key={option} value={option}>
          {RELATIONSHIP_TO_CLIENT_LABELS[option]}
        </option>
      ))}
    </SelectField>
  )
}

function roleOptions(role: RelationshipToClient): RelationshipToClient[] | null {
  if (role === "mother" || role === "father" || role === "parent") return ["mother", "father", "parent"]
  if (role === "current_partner" || role === "prior_partner") return ["current_partner", "prior_partner"]
  if (role === "child_biological" || role === "child_step") return ["child_biological", "child_step"]
  if (role === "sibling_half" || role === "sibling_step") return ["sibling_half", "sibling_step"]
  return null
}

function RelationshipExtras({
  record,
  onChange,
}: {
  record: RelationshipRecord
  onChange: (partial: Partial<RelationshipRecord>) => void
}) {
  const visibility = relationshipFieldVisibility(record)
  return (
    <>
      {visibility.relationshipStatus ? (
        <TextField
          id="rel_status"
          label="Relationship status"
          value={record.relationshipStatus}
          onChange={(relationshipStatus) => onChange({ relationshipStatus })}
          placeholder="e.g. married, de facto, separated"
        />
      ) : null}
      {visibility.timeSinceEnded ? (
        <TextField
          id="rel_ended"
          label="Time since ended"
          value={record.timeSinceEnded}
          onChange={(timeSinceEnded) => onChange({ timeSinceEnded })}
        />
      ) : null}
      {visibility.qualityOfRelationship ? (
        <TextAreaField
          id="rel_quality"
          label="Quality of relationship (with client)"
          value={record.qualityOfRelationship}
          onChange={(qualityOfRelationship) => onChange({ qualityOfRelationship })}
        />
      ) : null}
      {visibility.dependency ? (
        <SelectField
          id="rel_dependency"
          label="Dependency"
          value={record.dependency}
          onChange={(dependency) => onChange({ dependency: dependency as RelationshipRecord["dependency"] })}
        >
          <option value="">Not recorded</option>
          {DEPENDENCY_VALUES.map((value) => (
            <option key={value} value={value}>
              {DEPENDENCY_LABELS[value]}
            </option>
          ))}
        </SelectField>
      ) : isMinorChild(record) ? (
        <p className="text-muted-foreground">Dependency is recorded as they depend on the client for children under 18.</p>
      ) : null}
      {visibility.livingSituation ? (
        <TextField
          id="rel_living"
          label="Living situation"
          value={record.livingSituation}
          onChange={(livingSituation) => onChange({ livingSituation })}
        />
      ) : null}
    </>
  )
}

function PickerDialog({
  picker,
  parentLinks,
  people,
  pending,
  onClose,
  onPick,
  onCreate,
}: {
  picker: Picker
  parentLinks: PartnershipRecord[]
  people: RelationshipRecord[]
  pending: boolean
  onClose: () => void
  onPick: (picker: Picker) => void
  onCreate: (spec: CreateRelationshipInput) => void
}) {
  return (
    <Dialog open={picker !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pickerTitle(picker)}</DialogTitle>
          <DialogDescription>{pickerDescription(picker)}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {picker === "menu" ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  if (parentLinks.length > 1) onPick("sibling-partnership")
                  else onCreate({ kind: "full_sibling", partnershipRecordId: parentLinks[0]?.partnershipRecordId ?? null })
                }}
              >
                Sibling
              </Button>
              <Button type="button" variant="outline" disabled={pending} onClick={() => onPick("partner")}>
                Partner
              </Button>
              <Button type="button" variant="outline" disabled={pending} onClick={() => onPick("unlinked-child")}>
                Child not linked to a partner
              </Button>
            </>
          ) : null}
          {picker === "partner" ? (
            <>
              <Button type="button" variant="outline" disabled={pending} onClick={() => onCreate({ kind: "partner", role: "current_partner" })}>
                Current partner
              </Button>
              <Button type="button" variant="outline" disabled={pending} onClick={() => onCreate({ kind: "partner", role: "prior_partner" })}>
                Prior partner
              </Button>
            </>
          ) : null}
          {picker === "unlinked-child" || (picker && typeof picker === "object" && picker.kind === "child") ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  onCreate(
                    picker && typeof picker === "object" && picker.kind === "child"
                      ? { kind: "child", partnerRecordId: picker.partnerRecordId, role: "child_biological" }
                      : { kind: "unlinked_child", role: "child_biological" }
                  )
                }
              >
                Biological child
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  onCreate(
                    picker && typeof picker === "object" && picker.kind === "child"
                      ? { kind: "child", partnerRecordId: picker.partnerRecordId, role: "child_step" }
                      : { kind: "unlinked_child", role: "child_step" }
                  )
                }
              >
                Step-child
              </Button>
            </>
          ) : null}
          {picker && typeof picker === "object" && picker.kind === "step-sibling" ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => onCreate({ kind: "step_sibling", partnershipRecordId: picker.partnershipRecordId, role: "sibling_half" })}
              >
                Half-sibling
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => onCreate({ kind: "step_sibling", partnershipRecordId: picker.partnershipRecordId, role: "sibling_step" })}
              >
                Step-sibling
              </Button>
            </>
          ) : null}
          {picker === "sibling-partnership"
            ? parentLinks.map((partnership) => {
                const a = people.find((person) => person.relationshipRecordId === partnership.partnerAId)
                const b = people.find((person) => person.relationshipRecordId === partnership.partnerBId)
                return (
                  <Button
                    key={partnership.partnershipRecordId}
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() => onCreate({ kind: "full_sibling", partnershipRecordId: partnership.partnershipRecordId })}
                  >
                    Sibling of {a ? personName(a) : "parent"} and {b ? personName(b) : "parent"}
                  </Button>
                )
              })
            : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function pickerTitle(picker: Picker) {
  if (picker === "menu") return "Add family member"
  if (picker === "partner") return "Add partner"
  if (picker === "unlinked-child" || (picker && typeof picker === "object" && picker.kind === "child")) return "Add child"
  if (picker && typeof picker === "object" && picker.kind === "step-sibling") return "Add step-sibling"
  if (picker === "sibling-partnership") return "Which parents?"
  return "Add"
}

function pickerDescription(picker: Picker) {
  if (picker === "menu") return "Choose the kind of person to add."
  if (picker === "sibling-partnership") return "Full siblings are linked to a parent partnership."
  return "This creates one person. You can fill in the details next."
}
