"use client"

import { useMemo, useState, type ReactNode } from "react"

import {
  createRelationshipAction,
  deleteRelationshipAction,
  updatePartnershipAction,
  updateRelationshipAction,
} from "@/app/clients/[client_id]/background/actions"
import {
  mobileControlClassName,
  PartialDatePicker,
  ReadOnlyField,
  SaveRow,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/client-background/fields"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { assessAge, displayedAge, formatPartialDateLabel } from "@/lib/client-background/age"
import { parsePartialDate } from "@/lib/client-background/partial-date"
import {
  ADDABLE_RELATIONSHIP_GROUPS,
  ADDABLE_RELATIONSHIP_ROLES,
  DEPENDENCY_LABELS,
  DEPENDENCY_VALUES,
  HEALTH_STATUSES,
  HEALTH_STATUS_LABELS,
  PARTNERSHIP_STATUSES,
  PARTNERSHIP_STATUS_LABELS,
  RELATIONSHIP_LIVING_SITUATIONS,
  RELATIONSHIP_LIVING_SITUATION_LABELS,
  RELATIONSHIP_TO_CLIENT_LABELS,
  SEX_OPTIONS,
  type PartnershipRecord,
  type RelationshipRecord,
  type RelationshipRelink,
  type RelationshipToClient,
} from "@/lib/client-background/types"
import { todayDateString } from "@/lib/dates/practice-time"
import {
  brokenLinksForRoleChange,
  buildRelationshipTree,
  canonicalParentsLink,
  familyOfOriginLayout,
  linkedParentId,
  originPartnerships,
  otherPersonInPartnership,
  parentsRelationshipLabel,
  partnershipsForPerson,
  personName,
  personRoleLabel,
  personWithRoleLabel,
  relationshipLineLabel,
  stepParentLinkLabel,
  stepParentLinks,
  treeLineStatus,
  type BrokenLinks,
} from "@/lib/client-background/tree"
import {
  applyRelationshipVisibilityDefaults,
  isMinorChild,
  relationshipFieldVisibility,
} from "@/lib/client-background/visibility"
import { cn } from "@/lib/utils"

type Selection = { kind: "person"; id: string } | { kind: "partnership"; id: string } | null

type RelinkPrompt = {
  links: BrokenLinks
  moveTo: string
  name: string
  oldRole: RelationshipToClient
  newRole: RelationshipToClient
}

const STEP_SIBLING_HELPER = "A step-sibling is listed under a step-parent. Add the step-parent first."
const STEP_CHILD_HELPER = "A step-child is linked to a partner. Add the partner first."
const CAREGIVER_HINT = "For example: grandparent, aunt, foster carer."

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
  const [mobileScreen, setMobileScreen] = useState<"list" | "detail" | "edit">("list")
  const [editing, setEditing] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [draft, setDraft] = useState<RelationshipRecord | null>(null)
  const [draftPairs, setDraftPairs] = useState<PartnershipRecord[]>([])
  const [associatedParentId, setAssociatedParentId] = useState<string | null>(null)
  const [partnershipDraft, setPartnershipDraft] = useState<PartnershipRecord | null>(null)
  const [typeListOpen, setTypeListOpen] = useState(false)
  const [relinkPrompt, setRelinkPrompt] = useState<RelinkPrompt | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tree = useMemo(() => buildRelationshipTree(people, pairs), [people, pairs])
  const parentLinks = useMemo(() => originPartnerships(people, pairs), [people, pairs])
  const parentsLink = useMemo(() => canonicalParentsLink(people, pairs), [people, pairs])
  const layout = useMemo(() => familyOfOriginLayout(tree, parentsLink), [tree, parentsLink])
  const needsLinking = useMemo(
    () => [
      ...tree.unlinkedStepParents.map((person) => ({ person, action: "Choose parent ›" })),
      ...tree.unlinkedStepSiblings.map((person) => ({ person, action: "Choose step-parent ›" })),
      ...tree.unlinkedStepChildren.map((person) => ({ person, action: "Choose partner ›" })),
    ],
    [tree]
  )

  function personPartnerships(personId: string, partnershipList: PartnershipRecord[]) {
    return partnershipsForPerson(personId, partnershipList).filter(
      (item) => item.partnershipRecordId !== parentsLink.partnership?.partnershipRecordId
    )
  }

  function openPerson(person: RelationshipRecord, partnershipList: PartnershipRecord[], startEditing = false) {
    setIsNew(false)
    setSelection({ kind: "person", id: person.relationshipRecordId })
    setMobileScreen(startEditing ? "edit" : "detail")
    setDraft({ ...person })
    setDraftPairs(personPartnerships(person.relationshipRecordId, partnershipList).map((item) => ({ ...item })))
    setAssociatedParentId(linkedParentId(person.relationshipRecordId, people, partnershipList))
    setPartnershipDraft(null)
    setEditing(startEditing)
    setError(null)
    setLinkError(null)
    setTypeListOpen(false)
    setRelinkPrompt(null)
  }

  function openPartnership(partnership: PartnershipRecord, startEditing = false) {
    setIsNew(false)
    setSelection({ kind: "partnership", id: partnership.partnershipRecordId })
    setMobileScreen(startEditing ? "edit" : "detail")
    setPartnershipDraft({ ...partnership })
    setDraft(null)
    setDraftPairs([])
    setAssociatedParentId(null)
    setEditing(startEditing)
    setError(null)
    setLinkError(null)
    setTypeListOpen(false)
    setRelinkPrompt(null)
  }

  function openNew(
    role: RelationshipToClient,
    preset?: {
      associatedParentId?: string | null
      partnershipRecordId?: string | null
      linkedPartnerRecordId?: string | null
    }
  ) {
    const record = blankRelationship(role)
    if (preset?.partnershipRecordId) record.partnershipRecordId = preset.partnershipRecordId
    if (preset?.linkedPartnerRecordId) record.linkedPartnerRecordId = preset.linkedPartnerRecordId
    if (role === "sibling_full" && !record.partnershipRecordId && parentLinks.length === 1) {
      record.partnershipRecordId = parentLinks[0].partnershipRecordId
    }
    setIsNew(true)
    setSelection(null)
    setDraft(record)
    setDraftPairs([])
    setAssociatedParentId(role === "step_parent" ? preset?.associatedParentId ?? null : null)
    setPartnershipDraft(null)
    setEditing(true)
    setMobileScreen("edit")
    setError(null)
    setLinkError(null)
    setTypeListOpen(false)
    setRelinkPrompt(null)
  }

  function cancelEdit() {
    setLinkError(null)
    setRelinkPrompt(null)
    if (isNew) {
      setIsNew(false)
      setDraft(null)
      setDraftPairs([])
      setAssociatedParentId(null)
      setEditing(false)
      setSelection(null)
      setMobileScreen("list")
      setError(null)
      return
    }
    if (selection?.kind === "person") {
      const person = people.find((item) => item.relationshipRecordId === selection.id)
      if (person) {
        setDraft({ ...person })
        setDraftPairs(personPartnerships(person.relationshipRecordId, pairs).map((item) => ({ ...item })))
        setAssociatedParentId(linkedParentId(person.relationshipRecordId, people, pairs))
      }
    }
    if (selection?.kind === "partnership") {
      const partnership = pairs.find((item) => item.partnershipRecordId === selection.id)
      if (partnership) setPartnershipDraft({ ...partnership })
    }
    setEditing(false)
    setMobileScreen((current) => (current === "edit" ? "detail" : current))
    setError(null)
  }

  function changeRole(role: RelationshipToClient) {
    if (!draft) return
    const stayingStep = role === "step_parent" && draft.relationshipToClient === "step_parent"
    setLinkError(null)
    setDraft(withRole(draft, role, parentLinks))
    if (!stayingStep) setAssociatedParentId(null)
  }

  async function savePerson(relink?: RelationshipRelink) {
    if (!draft) return
    const associationError = associationErrorFor(draft, associatedParentId, parentLinks)
    if (associationError) {
      setLinkError(associationError)
      return
    }
    setLinkError(null)

    if (!isNew && !relink) {
      const existing = people.find((person) => person.relationshipRecordId === draft.relationshipRecordId)
      if (existing) {
        const links = brokenLinksForRoleChange(existing, draft.relationshipToClient, people, pairs)
        if (links) {
          setRelinkPrompt({
            links,
            moveTo: links.targets[0]?.id ?? "",
            name: personName({ ...existing, givenName: draft.givenName.trim() || existing.givenName }),
            oldRole: existing.relationshipToClient,
            newRole: draft.relationshipToClient,
          })
          return
        }
      }
    }

    setPending(true)
    setError(null)
    const result = isNew
      ? await createRelationshipAction(clientId, draft, associatedParentId)
      : await updateRelationshipAction(clientId, draft, draftPairs, {
          associatedParentId,
          relink: relink ?? null,
        })
    setPending(false)
    if (result.error || !result.relationship) {
      setError(result.error ?? "Could not save this person.")
      setRelinkPrompt(null)
      return
    }

    const removed = new Set(result.removedPartnershipIds ?? [])
    const nextPairs = mergePartnerships(pairs, result.partnerships ?? []).filter(
      (pair) => !removed.has(pair.partnershipRecordId)
    )
    const nextPeople = new Map(people.map((person) => [person.relationshipRecordId, person]))
    for (const person of result.affectedRelationships ?? []) {
      nextPeople.set(person.relationshipRecordId, person)
    }
    nextPeople.set(result.relationship.relationshipRecordId, result.relationship)
    const peopleList = [...nextPeople.values()]
    const nextParents = canonicalParentsLink(peopleList, nextPairs)
    setPeople(peopleList)
    setPairs(nextPairs)
    setIsNew(false)
    setDraft(result.relationship)
    setDraftPairs(
      partnershipsForPerson(result.relationship.relationshipRecordId, nextPairs)
        .filter((item) => item.partnershipRecordId !== nextParents.partnership?.partnershipRecordId)
        .map((item) => ({ ...item }))
    )
    setAssociatedParentId(linkedParentId(result.relationship.relationshipRecordId, peopleList, nextPairs))
    setSelection({ kind: "person", id: result.relationship.relationshipRecordId })
    setEditing(false)
    setMobileScreen("detail")
    setRelinkPrompt(null)
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
    setMobileScreen("detail")
  }

  async function remove() {
    if (!draft || isNew) return
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
    setAssociatedParentId(null)
    setEditing(false)
    setIsNew(false)
    setMobileScreen("list")
  }

  function leaveRecord() {
    if (editing) {
      cancelEdit()
      return
    }
    setMobileScreen("list")
  }

  function patch(partial: Partial<RelationshipRecord>) {
    if (!draft) return
    setLinkError(null)
    setDraft(applyRelationshipVisibilityDefaults({ ...draft, ...partial }))
  }

  const list = (
    <div className="space-y-4 text-[13px] lg:max-h-[75vh] lg:overflow-y-auto lg:pr-1">
      <Button type="button" size="sm" disabled={pending} onClick={() => setTypeListOpen(true)}>
        + Add relationship
      </Button>
      {error && !draft && !partnershipDraft ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="space-y-1">
        <h2 className="text-sm font-semibold">Family of Origin</h2>
        {layout.parents.map((person) => (
          <TreeRow
            key={person.relationshipRecordId}
            label={relationshipLineLabel(person, treeLineStatus(person, pairs))}
            selected={selection?.kind === "person" && selection.id === person.relationshipRecordId}
            onSelect={() => openPerson(person, pairs)}
            extra={
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={pending}
                onClick={() => openNew("step_parent", { associatedParentId: person.relationshipRecordId })}
              >
                + Add step-parent
              </Button>
            }
          />
        ))}
        {parentsLink.partnership ? (
          <TreeRow
            label={parentsRelationshipLabel(parentsLink.partnership)}
            selected={selection?.kind === "partnership" && selection.id === parentsLink.partnership.partnershipRecordId}
            onSelect={() => openPartnership(parentsLink.partnership!)}
          />
        ) : (
          <p className="px-2 text-muted-foreground">Parents&apos; relationship</p>
        )}
        {layout.caregivers.map((person) => (
          <TreeRow
            key={person.relationshipRecordId}
            label={relationshipLineLabel(person, treeLineStatus(person, pairs))}
            selected={selection?.kind === "person" && selection.id === person.relationshipRecordId}
            onSelect={() => openPerson(person, pairs)}
          />
        ))}
        {layout.siblings.map((person) => (
          <TreeRow
            key={person.relationshipRecordId}
            label={relationshipLineLabel(person)}
            selected={selection?.kind === "person" && selection.id === person.relationshipRecordId}
            onSelect={() => openPerson(person, pairs)}
          />
        ))}
        <div className="pt-1">
          <Button type="button" variant="outline" size="xs" disabled={pending} onClick={() => openNew("sibling_full")}>
            + Add sibling
          </Button>
        </div>
      </section>

      <section className="space-y-2 border-t pt-4">
        <h2 className="text-sm font-semibold">Extended Family</h2>
        {tree.otherFamily.length === 0 ? <p className="text-muted-foreground">Nothing recorded</p> : null}
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
                  onClick={() =>
                    openNew("sibling_step", { partnershipRecordId: node.partnership.partnershipRecordId })
                  }
                >
                  + Add step-sibling
                </Button>
              </div>
            ))}
          </div>
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
                onClick={() => openNew("child_biological", { linkedPartnerRecordId: node.person.relationshipRecordId })}
              >
                + Add child
              </Button>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="xs" disabled={pending} onClick={() => openNew("current_partner")}>
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
          <Button type="button" variant="outline" size="xs" disabled={pending} onClick={() => openNew("child_biological")}>
            + Add child
          </Button>
        </div>
      </section>

      {needsLinking.length > 0 ? (
        <section className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-2 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <h2 className="px-2 text-sm font-semibold">Needs linking</h2>
          {needsLinking.map(({ person, action }) => {
            const name = person.givenName.trim() || "Not recorded"
            const selected = selection?.kind === "person" && selection.id === person.relationshipRecordId
            return (
              <button
                key={person.relationshipRecordId}
                type="button"
                className={cn(
                  "flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-2 text-left text-[13px] hover:bg-amber-100 dark:hover:bg-amber-900",
                  selected && "bg-amber-100 font-medium dark:bg-amber-900"
                )}
                onClick={() => openPerson(person, pairs, true)}
              >
                <span>
                  {personRoleLabel(person)} — {name}
                </span>
                <span className="shrink-0 text-xs font-medium">{action}</span>
              </button>
            )
          })}
        </section>
      ) : null}
    </div>
  )

  const detail = partnershipDraft ? (
    <PartnershipDetail
      partnership={partnershipDraft}
      editing={editing}
      pending={pending}
      error={error}
      onEdit={() => {
        setEditing(true)
        setMobileScreen("edit")
      }}
      onCancel={cancelEdit}
      onChange={setPartnershipDraft}
      onSave={() => void savePartnership()}
      onBack={leaveRecord}
      backLabel={editing ? "← Back" : "← Back to list"}
    />
  ) : draft ? (
    <PersonDetail
      draft={draft}
      draftPairs={draftPairs}
      people={people}
      partnerships={pairs}
      isNew={isNew}
      editing={editing}
      pending={pending}
      error={error}
      linkError={linkError}
      associatedParentId={associatedParentId}
      canRemove={!isNew && canRemovePerson(draft, people)}
      onEdit={() => {
        setEditing(true)
        setMobileScreen("edit")
      }}
      onCancel={cancelEdit}
      onPatch={patch}
      onRole={changeRole}
      onAssociatedParentId={(id) => {
        setLinkError(null)
        setAssociatedParentId(id)
      }}
      onReplaceWithNew={openNew}
      onPairs={setDraftPairs}
      onSave={() => void savePerson()}
      onRemove={() => void remove()}
      onBack={leaveRecord}
      backLabel={editing ? "← Back" : "← Back to list"}
    />
  ) : (
    <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed p-6 text-center text-[13px] text-muted-foreground">
      Select someone from the list, or add a relationship
    </div>
  )

  return (
    <>
      <div className="lg:grid lg:grid-cols-2 lg:gap-4">
        <div className={mobileScreen === "list" ? "min-w-0" : "hidden min-w-0 lg:block"}>{list}</div>
        <div className={mobileScreen === "list" ? "hidden min-w-0 lg:block" : "min-w-0"}>{detail}</div>
      </div>
      <TypeListDialog open={typeListOpen} pending={pending} onClose={() => setTypeListOpen(false)} onChoose={openNew} />
      {relinkPrompt ? (
        <RelinkDialog
          prompt={relinkPrompt}
          pending={pending}
          onMoveTo={(moveTo) => setRelinkPrompt({ ...relinkPrompt, moveTo })}
          onCancel={() => setRelinkPrompt(null)}
          onConfirm={() => {
            const relink: RelationshipRelink = relinkPrompt.moveTo
              ? { action: "move", targetRecordId: relinkPrompt.moveTo }
              : { action: "unlink" }
            void savePerson(relink)
          }}
        />
      ) : null}
    </>
  )
}

function blankRelationship(role: RelationshipToClient): RelationshipRecord {
  return {
    relationshipRecordId: "",
    relationshipToClient: role,
    sex: "",
    givenName: "",
    displayOrder: 0,
    dateOfBirth: "",
    approximateAge: null,
    approximateAgeRecordedOn: "",
    healthStatus: "",
    deceased: false,
    ageAtDeath: null,
    healthOrCauseOfDeath: "",
    lengthOfRelationship: "",
    relationshipStatus: "",
    timeSinceEnded: "",
    qualityOfRelationship: "",
    dependency: "",
    livingSituation: "",
    caregiverRelationship: "",
    linkedPartnerRecordId: null,
    partnershipRecordId: null,
  }
}

function withRole(
  record: RelationshipRecord,
  role: RelationshipToClient,
  originLinks: PartnershipRecord[]
): RelationshipRecord {
  const nested = role === "sibling_half" || role === "sibling_step"
  const wasNested = record.relationshipToClient === "sibling_half" || record.relationshipToClient === "sibling_step"
  const child = role === "child_biological" || role === "child_step"
  const wasChild = record.relationshipToClient === "child_biological" || record.relationshipToClient === "child_step"

  let partnershipRecordId: string | null = null
  if (nested && wasNested) partnershipRecordId = record.partnershipRecordId
  if (role === "sibling_full") {
    if (record.relationshipToClient === "sibling_full" && record.partnershipRecordId) {
      partnershipRecordId = record.partnershipRecordId
    } else if (originLinks.length === 1) {
      partnershipRecordId = originLinks[0].partnershipRecordId
    }
  }

  return applyRelationshipVisibilityDefaults({
    ...record,
    relationshipToClient: role,
    partnershipRecordId,
    linkedPartnerRecordId: child && wasChild ? record.linkedPartnerRecordId : null,
    caregiverRelationship: role === "other_caregiver" ? record.caregiverRelationship : "",
  })
}

function associationErrorFor(
  draft: RelationshipRecord,
  parentId: string | null,
  originLinks: PartnershipRecord[]
): string | null {
  const role = draft.relationshipToClient
  if (role === "step_parent" && !parentId) return "Choose an associated parent."
  if ((role === "sibling_half" || role === "sibling_step") && !draft.partnershipRecordId) {
    return "Choose an associated step-parent."
  }
  if (role === "sibling_full" && originLinks.length > 1 && !draft.partnershipRecordId) {
    return "Choose the parents' partnership."
  }
  if (role === "child_step" && !draft.linkedPartnerRecordId) return "Choose an associated partner."
  return null
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
  backLabel,
}: {
  title: string
  subtitle: string
  editing: boolean
  onEdit: () => void
  onBack: () => void
  backLabel: string
}) {
  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="lg:hidden" onClick={onBack}>
        {backLabel}
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
  backLabel,
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
  backLabel: string
}) {
  const status = partnership.relationshipStatus ? PARTNERSHIP_STATUS_LABELS[partnership.relationshipStatus] : ""
  return (
    <div className="min-w-0 space-y-4 lg:text-[13px] lg:[&_input]:text-[13px] lg:[&_label]:text-[13px] lg:[&_legend]:text-[13px] lg:[&_select]:text-[13px] lg:[&_textarea]:text-[13px]">
      <DetailHeader
        title="Parents' relationship"
        subtitle="Mother and father"
        editing={editing}
        onEdit={onEdit}
        onBack={onBack}
        backLabel={backLabel}
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
        <div className="space-y-4">
          <ReadOnlyField label="Relationship status" value={status} />
          <ReadOnlyField label="Start" value={formatPartialDateLabel(partnership.started)} />
          <ReadOnlyField label="End" value={formatPartialDateLabel(partnership.ended)} />
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
    <div className="space-y-4 rounded-md border p-4">
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
      <PartialDatePicker
        id={`partnership_start_${partnership.partnershipRecordId}`}
        dateLabel="Start"
        mode="date-only"
        value={partnership.started}
        onChange={(started) => onChange({ ...partnership, started })}
      />
      <PartialDatePicker
        id={`partnership_end_${partnership.partnershipRecordId}`}
        dateLabel="End"
        mode="date-only"
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

function BirthEditor({
  record,
  onPatch,
}: {
  record: RelationshipRecord
  onPatch: (partial: Partial<RelationshipRecord>) => void
}) {
  return (
    <PartialDatePicker
      id="rel_dob"
      dateLabel="Date of birth"
      mode={record.healthStatus === "deceased" ? "date-only" : "person"}
      value={record.dateOfBirth}
      onChange={(dateOfBirth) => onPatch({ dateOfBirth, approximateAge: null, approximateAgeRecordedOn: "" })}
    />
  )
}

function BirthReadOnly({ record }: { record: RelationshipRecord }) {
  const age =
    record.healthStatus === "deceased"
      ? ""
      : displayedAge(assessAge(parsePartialDate(record.dateOfBirth), parsePartialDate(todayDateString()), "person"))
  return (
    <>
      {record.healthStatus === "deceased" ? null : <ReadOnlyField label="Age" value={age} />}
      <ReadOnlyField label="Date of birth" value={formatPartialDateLabel(record.dateOfBirth)} />
    </>
  )
}

function PersonDetail({
  draft,
  draftPairs,
  people,
  partnerships,
  isNew,
  editing,
  pending,
  error,
  linkError,
  associatedParentId,
  canRemove,
  onEdit,
  onCancel,
  onPatch,
  onRole,
  onAssociatedParentId,
  onReplaceWithNew,
  onPairs,
  onSave,
  onRemove,
  onBack,
  backLabel,
}: {
  draft: RelationshipRecord
  draftPairs: PartnershipRecord[]
  people: RelationshipRecord[]
  partnerships: PartnershipRecord[]
  isNew: boolean
  editing: boolean
  pending: boolean
  error: string | null
  linkError: string | null
  associatedParentId: string | null
  canRemove: boolean
  onEdit: () => void
  onCancel: () => void
  onPatch: (partial: Partial<RelationshipRecord>) => void
  onRole: (role: RelationshipToClient) => void
  onAssociatedParentId: (id: string | null) => void
  onReplaceWithNew: (role: RelationshipToClient) => void
  onPairs: (pairs: PartnershipRecord[]) => void
  onSave: () => void
  onRemove: () => void
  onBack: () => void
  backLabel: string
}) {
  const visibility = relationshipFieldVisibility(draft)
  return (
    <div className="min-w-0 space-y-4 lg:text-[13px] lg:[&_input]:text-[13px] lg:[&_label]:text-[13px] lg:[&_legend]:text-[13px] lg:[&_select]:text-[13px] lg:[&_textarea]:text-[13px]">
      <DetailHeader
        title={isNew ? "New relationship" : personName(draft)}
        subtitle={personRoleLabel(draft)}
        editing={editing}
        onEdit={onEdit}
        onBack={onBack}
        backLabel={backLabel}
      />
      {editing ? (
        <>
          <RoleSelect record={draft} onChange={onRole} />
          <TextField id="rel_name" label="Name" value={draft.givenName} onChange={(givenName) => onPatch({ givenName })} />
          <AssociationFields
            draft={draft}
            people={people}
            partnerships={partnerships}
            associatedParentId={associatedParentId}
            linkError={linkError}
            pending={pending}
            onPatch={onPatch}
            onAssociatedParentId={onAssociatedParentId}
            onReplaceWithNew={onReplaceWithNew}
          />
          <SelectField id="rel_sex" label="Sex" value={draft.sex} onChange={(sex) => onPatch({ sex })}>
            <option value="">Not recorded</option>
            {SEX_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </SelectField>
          <BirthEditor record={draft} onPatch={onPatch} />
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
                  className={mobileControlClassName}
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
          {visibility.lengthOfRelationship ? (
            <TextField
              id="rel_length"
              label="Length of relationship"
              value={draft.lengthOfRelationship}
              onChange={(lengthOfRelationship) => onPatch({ lengthOfRelationship })}
            />
          ) : null}
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

function AssociationFields({
  draft,
  people,
  partnerships,
  associatedParentId,
  linkError,
  pending,
  onPatch,
  onAssociatedParentId,
  onReplaceWithNew,
}: {
  draft: RelationshipRecord
  people: RelationshipRecord[]
  partnerships: PartnershipRecord[]
  associatedParentId: string | null
  linkError: string | null
  pending: boolean
  onPatch: (partial: Partial<RelationshipRecord>) => void
  onAssociatedParentId: (id: string | null) => void
  onReplaceWithNew: (role: RelationshipToClient) => void
}) {
  const role = draft.relationshipToClient
  const selfId = draft.relationshipRecordId

  if (role === "step_parent") {
    return (
      <SelectField
        id="rel_associated_parent"
        label="Associated parent"
        value={associatedParentId ?? ""}
        error={linkError}
        onChange={(value) => onAssociatedParentId(value || null)}
      >
        <option value="">Choose a parent</option>
        {originParentOptions(people, selfId).map((person) => (
          <option key={person.relationshipRecordId} value={person.relationshipRecordId}>
            {personWithRoleLabel(person)}
          </option>
        ))}
      </SelectField>
    )
  }

  if (role === "other_caregiver") {
    return (
      <TextField
        id="rel_caregiver"
        label="Caregiver relationship"
        hint={CAREGIVER_HINT}
        value={draft.caregiverRelationship}
        onChange={(caregiverRelationship) => onPatch({ caregiverRelationship })}
      />
    )
  }

  if (role === "sibling_half" || role === "sibling_step") {
    const links = stepParentLinks(people, partnerships).filter(
      (link) => link.stepParent.relationshipRecordId !== selfId
    )
    if (links.length === 0) {
      return (
        <div className="space-y-1.5">
          <SelectField
            id="rel_associated_step_parent"
            label="Associated step-parent"
            value=""
            disabled
            error={linkError}
            hint={STEP_SIBLING_HELPER}
            onChange={() => undefined}
          >
            <option value="">No step-parent recorded</option>
          </SelectField>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => onReplaceWithNew("step_parent")}>
            + Add step-parent
          </Button>
        </div>
      )
    }
    return (
      <SelectField
        id="rel_associated_step_parent"
        label="Associated step-parent"
        value={draft.partnershipRecordId ?? ""}
        error={linkError}
        onChange={(value) => onPatch({ partnershipRecordId: value || null })}
      >
        <option value="">Choose a step-parent</option>
        {links.map((link) => (
          <option key={link.partnershipRecordId} value={link.partnershipRecordId}>
            {stepParentLinkLabel(link)}
          </option>
        ))}
      </SelectField>
    )
  }

  if (role === "sibling_full") {
    const origins = originPartnerships(people, partnerships)
    if (origins.length <= 1) return null
    return (
      <SelectField
        id="rel_parents_partnership"
        label="Parents' partnership"
        value={draft.partnershipRecordId ?? ""}
        error={linkError}
        onChange={(value) => onPatch({ partnershipRecordId: value || null })}
      >
        <option value="">Choose parents</option>
        {origins.map((partnership) => (
          <option key={partnership.partnershipRecordId} value={partnership.partnershipRecordId}>
            {parentsPartnershipChoice(partnership, people)}
          </option>
        ))}
      </SelectField>
    )
  }

  if (role === "child_biological" || role === "child_step") {
    const partners = partnerOptions(people, selfId)
    if (role === "child_step" && partners.length === 0) {
      return (
        <div className="space-y-1.5">
          <SelectField
            id="rel_associated_partner"
            label="Associated partner"
            value=""
            disabled
            error={linkError}
            hint={STEP_CHILD_HELPER}
            onChange={() => undefined}
          >
            <option value="">No partner recorded</option>
          </SelectField>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => onReplaceWithNew("current_partner")}
          >
            + Add partner
          </Button>
        </div>
      )
    }
    return (
      <SelectField
        id="rel_associated_partner"
        label="Associated partner"
        value={draft.linkedPartnerRecordId ?? ""}
        error={linkError}
        onChange={(value) => onPatch({ linkedPartnerRecordId: value || null })}
      >
        {role === "child_biological" ? (
          <option value="">Not linked to a partner</option>
        ) : (
          <option value="">Choose a partner</option>
        )}
        {partners.map((person) => (
          <option key={person.relationshipRecordId} value={person.relationshipRecordId}>
            {personWithRoleLabel(person)}
          </option>
        ))}
      </SelectField>
    )
  }

  return null
}

function originParentOptions(people: RelationshipRecord[], excludeId: string) {
  const rank = (role: RelationshipToClient) => (role === "mother" ? 0 : role === "father" ? 1 : 2)
  return people
    .filter(
      (person) =>
        (person.relationshipToClient === "mother" ||
          person.relationshipToClient === "father" ||
          person.relationshipToClient === "parent") &&
        person.relationshipRecordId !== excludeId
    )
    .sort(
      (a, b) =>
        rank(a.relationshipToClient) - rank(b.relationshipToClient) ||
        a.displayOrder - b.displayOrder ||
        a.givenName.localeCompare(b.givenName)
    )
}

function partnerOptions(people: RelationshipRecord[], excludeId: string) {
  const rank = (role: RelationshipToClient) => (role === "current_partner" ? 0 : 1)
  return people
    .filter(
      (person) =>
        (person.relationshipToClient === "current_partner" || person.relationshipToClient === "prior_partner") &&
        person.relationshipRecordId !== excludeId
    )
    .sort(
      (a, b) =>
        rank(a.relationshipToClient) - rank(b.relationshipToClient) ||
        a.displayOrder - b.displayOrder ||
        a.givenName.localeCompare(b.givenName)
    )
}

function parentsPartnershipChoice(partnership: PartnershipRecord, people: RelationshipRecord[]) {
  const a = people.find((person) => person.relationshipRecordId === partnership.partnerAId)
  const b = people.find((person) => person.relationshipRecordId === partnership.partnerBId)
  return `Sibling of ${a ? personName(a) : "parent"} and ${b ? personName(b) : "parent"}`
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
    <div className="space-y-4">
      <ReadOnlyField label="Relationship to client" value={personRoleLabel(record)} />
      <ReadOnlyField label="Name" value={record.givenName} />
      {record.relationshipToClient === "other_caregiver" ? (
        <ReadOnlyField label="Caregiver relationship" value={record.caregiverRelationship} />
      ) : null}
      <ReadOnlyField label="Sex" value={record.sex} />
      <BirthReadOnly record={record} />
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
      {visibility.lengthOfRelationship ? (
        <ReadOnlyField label="Length of relationship" value={record.lengthOfRelationship} />
      ) : null}
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
      {visibility.livingSituation ? (
        <ReadOnlyField
          label="Living situation"
          value={record.livingSituation ? RELATIONSHIP_LIVING_SITUATION_LABELS[record.livingSituation] : ""}
        />
      ) : null}
      {pairs.map((partnership) => {
        const other = otherPersonInPartnership(partnership, record.relationshipRecordId, people)
        const otherLabel = other ? personName(other) : "the other person"
        const status = partnership.relationshipStatus ? PARTNERSHIP_STATUS_LABELS[partnership.relationshipStatus] : ""
        return (
          <div key={partnership.partnershipRecordId} className="space-y-4 rounded-md border p-4">
            <p className="font-medium">Relationship — with {otherLabel}</p>
            <ReadOnlyField label="Relationship status" value={status} />
            <ReadOnlyField label="Start" value={formatPartialDateLabel(partnership.started)} />
            <ReadOnlyField label="End" value={formatPartialDateLabel(partnership.ended)} />
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
  return (
    <SelectField
      id="rel_role"
      label="Relationship to client"
      value={role}
      onChange={(next) => onChange(next as RelationshipToClient)}
    >
      {ADDABLE_RELATIONSHIP_ROLES.map((option) => (
        <option key={option} value={option}>
          {RELATIONSHIP_TO_CLIENT_LABELS[option]}
        </option>
      ))}
    </SelectField>
  )
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
        <SelectField
          id="rel_living"
          label="Living situation"
          value={record.livingSituation}
          onChange={(livingSituation) =>
            onChange({ livingSituation: livingSituation as RelationshipRecord["livingSituation"] })
          }
        >
          <option value="">Not recorded</option>
          {RELATIONSHIP_LIVING_SITUATIONS.map((option) => (
            <option key={option} value={option}>
              {RELATIONSHIP_LIVING_SITUATION_LABELS[option]}
            </option>
          ))}
        </SelectField>
      ) : null}
    </>
  )
}

function TypeListDialog({
  open,
  pending,
  onClose,
  onChoose,
}: {
  open: boolean
  pending: boolean
  onClose: () => void
  onChoose: (role: RelationshipToClient) => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add relationship</DialogTitle>
          <DialogDescription>Choose a relationship type. Nothing is saved until you press Save.</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
          {ADDABLE_RELATIONSHIP_GROUPS.map((group) => (
            <div key={group.label} className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{group.label}</p>
              {group.roles.map((role) => (
                <Button
                  key={role}
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  disabled={pending}
                  onClick={() => onChoose(role)}
                >
                  {RELATIONSHIP_TO_CLIENT_LABELS[role]}
                </Button>
              ))}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RelinkDialog({
  prompt,
  pending,
  onMoveTo,
  onCancel,
  onConfirm,
}: {
  prompt: RelinkPrompt
  pending: boolean
  onMoveTo: (moveTo: string) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const count = prompt.links.people.length
  const title =
    count === 1 ? `1 person is linked to ${prompt.name}` : `${count} people are linked to ${prompt.name}`
  const oldRole = RELATIONSHIP_TO_CLIENT_LABELS[prompt.oldRole].toLowerCase()
  const newRole = RELATIONSHIP_TO_CLIENT_LABELS[prompt.newRole].toLowerCase()
  return (
    <Dialog open onOpenChange={(next) => !next && !pending && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            They are listed under {prompt.name} as a {oldRole}. Once {prompt.name} is a {newRole}, that link no longer
            applies.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-1 text-sm">
          {prompt.links.people.map((person) => (
            <li key={person.relationshipRecordId}>
              {personRoleLabel(person)} — {person.givenName.trim() || "Not recorded"}
            </li>
          ))}
        </ul>
        <SelectField id="relink_move" label="Move them to" value={prompt.moveTo} onChange={onMoveTo}>
          {prompt.links.targets.map((target) => (
            <option key={target.id} value={target.id}>
              {target.label}
            </option>
          ))}
          <option value="">Leave unlinked for now</option>
        </SelectField>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={onConfirm}>
            Change and save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
