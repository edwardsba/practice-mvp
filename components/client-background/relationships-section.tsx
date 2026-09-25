"use client"

import { useMemo, useState, type ReactNode } from "react"

import {
  createRelationshipAction,
  deleteRelationshipAction,
  updateRelationshipAction,
} from "@/app/clients/[client_id]/background/actions"
import { SaveRow, SelectField, TextAreaField, TextField } from "@/components/client-background/fields"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
  originPartnerships,
  otherPersonInPartnership,
  partnershipsForPerson,
  personName,
  personRoleLabel,
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
  | "parent"
  | "partner"
  | "unlinked-child"
  | "sibling-partnership"
  | { kind: "child"; partnerRecordId: string }
  | { kind: "step-sibling"; partnershipRecordId: string }

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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileDetail, setMobileDetail] = useState(false)
  const [draft, setDraft] = useState<RelationshipRecord | null>(null)
  const [draftPairs, setDraftPairs] = useState<PartnershipRecord[]>([])
  const [picker, setPicker] = useState<Picker>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tree = useMemo(() => buildRelationshipTree(people, pairs), [people, pairs])
  const parentLinks = useMemo(() => originPartnerships(people, pairs), [people, pairs])

  function openPerson(person: RelationshipRecord, partnershipList: PartnershipRecord[]) {
    setSelectedId(person.relationshipRecordId)
    setMobileDetail(true)
    setDraft({ ...person })
    setDraftPairs(partnershipsForPerson(person.relationshipRecordId, partnershipList).map((item) => ({ ...item })))
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
    openPerson(result.relationship, nextPairs)
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

  async function save() {
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
    if (result.partnerships) {
      setPairs((current) => mergePartnerships(current, result.partnerships!))
      setDraftPairs(result.partnerships)
    }
    setDraft(result.relationship)
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
    setSelectedId(null)
    setDraft(null)
    setDraftPairs([])
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
      {error && !draft ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="space-y-1">
        <h2 className="text-sm font-semibold">Family of Origin</h2>
        {tree.originParents.map((person) => (
          <PersonRow
            key={person.relationshipRecordId}
            person={person}
            selected={person.relationshipRecordId === selectedId}
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
          <PersonRow
            key={person.relationshipRecordId}
            person={person}
            selected={person.relationshipRecordId === selectedId}
            onSelect={() => openPerson(person, pairs)}
          />
        ))}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" variant="outline" size="xs" disabled={pending} onClick={() => setPicker("parent")}>
            + Add parent
          </Button>
          <Button type="button" variant="outline" size="xs" disabled={pending} onClick={addFullSibling}>
            + Add sibling
          </Button>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Other Family</h2>
        {tree.otherFamily.length === 0 && tree.unlinkedStepParents.length === 0 && tree.unlinkedStepSiblings.length === 0 ? (
          <p className="text-muted-foreground">Nothing recorded</p>
        ) : null}
        {tree.otherFamily.map((group) => (
          <div key={group.parent.relationshipRecordId} className="space-y-1">
            <p className="font-medium">{personName(group.parent)}</p>
            {group.stepParents.map((node) => (
              <div key={node.person.relationshipRecordId} className="ml-3 space-y-1 border-l pl-3">
                <PersonRow
                  person={node.person}
                  selected={node.person.relationshipRecordId === selectedId}
                  onSelect={() => openPerson(node.person, pairs)}
                />
                {node.siblings.map((sibling) => (
                  <div key={sibling.relationshipRecordId} className="ml-3">
                    <PersonRow
                      person={sibling}
                      selected={sibling.relationshipRecordId === selectedId}
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
          <PersonRow
            key={person.relationshipRecordId}
            person={person}
            selected={person.relationshipRecordId === selectedId}
            onSelect={() => openPerson(person, pairs)}
          />
        ))}
        {tree.unlinkedStepSiblings.map((person) => (
          <PersonRow
            key={person.relationshipRecordId}
            person={person}
            selected={person.relationshipRecordId === selectedId}
            onSelect={() => openPerson(person, pairs)}
          />
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Partners and Children</h2>
        {tree.partners.map((node) => (
          <div key={node.person.relationshipRecordId} className="space-y-1">
            <PersonRow
              person={node.person}
              selected={node.person.relationshipRecordId === selectedId}
              onSelect={() => openPerson(node.person, pairs)}
            />
            {node.children.map((child) => (
              <div key={child.relationshipRecordId} className="ml-3">
                <PersonRow
                  person={child}
                  selected={child.relationshipRecordId === selectedId}
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
        <div className="space-y-1">
          <p className="font-medium">Children not linked to a listed partner</p>
          {tree.unlinkedChildren.map((child) => (
            <PersonRow
              key={child.relationshipRecordId}
              person={child}
              selected={child.relationshipRecordId === selectedId}
              onSelect={() => openPerson(child, pairs)}
            />
          ))}
          <Button type="button" variant="outline" size="xs" disabled={pending} onClick={() => setPicker("unlinked-child")}>
            + Add child
          </Button>
        </div>
        <Button type="button" variant="outline" size="xs" disabled={pending} onClick={() => setPicker("partner")}>
          + Add partner
        </Button>
      </section>
    </div>
  )

  const detail = draft ? (
    <div className="space-y-4 text-[13px] [&_input]:text-[13px] [&_label]:text-[13px] [&_select]:text-[13px] [&_textarea]:text-[13px]">
      <Button type="button" variant="ghost" size="sm" className="lg:hidden" onClick={() => setMobileDetail(false)}>
        ← Back to list
      </Button>
      <div>
        <p className="font-medium">{personName(draft)}</p>
        <p className="text-muted-foreground">{personRoleLabel(draft)}</p>
      </div>
      <RoleSelect record={draft} onChange={(relationshipToClient) => patch({ relationshipToClient })} />
      <TextField id="rel_name" label="Name" value={draft.givenName} onChange={(givenName) => patch({ givenName })} />
      <TextField id="rel_gender" label="Gender" value={draft.gender} onChange={(gender) => patch({ gender })} />
      <div className="space-y-1.5">
        <Label htmlFor="rel_age">Age</Label>
        <Input
          id="rel_age"
          type="number"
          min={0}
          value={draft.age ?? ""}
          onChange={(event) => patch({ age: event.target.value === "" ? null : Number(event.target.value) })}
        />
      </div>
      <div className="flex items-start gap-3">
        <Checkbox
          id="rel_deceased"
          checked={draft.deceased}
          onCheckedChange={(checked) => patch({ deceased: checked === true })}
        />
        <Label htmlFor="rel_deceased" className="cursor-pointer font-normal">
          Deceased
        </Label>
      </div>
      {draft.deceased ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="rel_age_death">Age at death</Label>
            <Input
              id="rel_age_death"
              type="number"
              min={0}
              value={draft.ageAtDeath ?? ""}
              onChange={(event) =>
                patch({ ageAtDeath: event.target.value === "" ? null : Number(event.target.value) })
              }
            />
          </div>
          <TextField
            id="rel_cause"
            label="Health or cause of death"
            value={draft.healthOrCauseOfDeath}
            onChange={(healthOrCauseOfDeath) => patch({ healthOrCauseOfDeath })}
          />
        </>
      ) : null}
      <TextField
        id="rel_length"
        label="Length of relationship"
        value={draft.lengthOfRelationship}
        onChange={(lengthOfRelationship) => patch({ lengthOfRelationship })}
      />
      <RelationshipExtras record={draft} onChange={patch} />
      {draftPairs.map((partnership) => {
        const other = otherPersonInPartnership(partnership, draft.relationshipRecordId, people)
        const otherLabel = other ? personName(other) : "the other person"
        return (
          <div key={partnership.partnershipRecordId} className="space-y-3 rounded-md border p-3">
            <p className="font-medium">Relationship — with {otherLabel}</p>
            <SelectField
              id={`partnership_status_${partnership.partnershipRecordId}`}
              label="Relationship status"
              value={partnership.relationshipStatus}
              onChange={(relationshipStatus) =>
                setDraftPairs((current) =>
                  current.map((item) =>
                    item.partnershipRecordId === partnership.partnershipRecordId
                      ? { ...item, relationshipStatus: relationshipStatus as PartnershipRecord["relationshipStatus"] }
                      : item
                  )
                )
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
              onChange={(started) =>
                setDraftPairs((current) =>
                  current.map((item) =>
                    item.partnershipRecordId === partnership.partnershipRecordId ? { ...item, started } : item
                  )
                )
              }
              placeholder="Year, date, or duration"
            />
            <TextField
              id={`partnership_end_${partnership.partnershipRecordId}`}
              label="End"
              value={partnership.ended}
              onChange={(ended) =>
                setDraftPairs((current) =>
                  current.map((item) =>
                    item.partnershipRecordId === partnership.partnershipRecordId ? { ...item, ended } : item
                  )
                )
              }
            />
            <TextAreaField
              id={`partnership_quality_${partnership.partnershipRecordId}`}
              label={`Quality of relationship (with ${otherLabel})`}
              value={partnership.qualityOfRelationship}
              onChange={(qualityOfRelationship) =>
                setDraftPairs((current) =>
                  current.map((item) =>
                    item.partnershipRecordId === partnership.partnershipRecordId
                      ? { ...item, qualityOfRelationship }
                      : item
                  )
                )
              }
            />
          </div>
        )
      })}
      <SaveRow
        pending={pending}
        error={error}
        onSave={() => void save()}
        extra={
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => void remove()}>
            Remove
          </Button>
        }
      />
    </div>
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

function mergePartnerships(current: PartnershipRecord[], incoming: PartnershipRecord[]) {
  const byId = new Map(current.map((item) => [item.partnershipRecordId, item]))
  for (const item of incoming) byId.set(item.partnershipRecordId, item)
  return [...byId.values()]
}

function PersonRow({
  person,
  selected,
  onSelect,
  extra,
}: {
  person: RelationshipRecord
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
        {person.givenName.trim()
          ? `${personRoleLabel(person)} · ${person.givenName.trim()}`
          : personRoleLabel(person)}
      </button>
      {extra}
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
              <Button type="button" variant="outline" disabled={pending} onClick={() => onPick("parent")}>
                Parent
              </Button>
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
          {picker === "parent" ? (
            <>
              <Button type="button" variant="outline" disabled={pending} onClick={() => onCreate({ kind: "parent", role: "mother" })}>
                Mother
              </Button>
              <Button type="button" variant="outline" disabled={pending} onClick={() => onCreate({ kind: "parent", role: "father" })}>
                Father
              </Button>
              <Button type="button" variant="outline" disabled={pending} onClick={() => onCreate({ kind: "parent", role: "parent" })}>
                Parent
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
  if (picker === "parent") return "Add parent"
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
