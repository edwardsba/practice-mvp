"use client"

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react"
import { ChevronDown } from "lucide-react"

import {
  createRelationshipAction,
  deleteRelationshipAction,
  saveClientRelationshipStatusAction,
  updatePartnershipAction,
  updateRelationshipAction,
} from "@/app/clients/[client_id]/background/actions"
import { AddButton } from "@/components/client-background/fields"
import { AutosaveFields, type SavePhase } from "@/components/client-background/interview-autosave"
import {
  ClientRelationshipStatusFields,
  PartnershipDetail,
  PersonDetail,
  RelinkDialog,
  associationErrorFor,
  blankRelationship,
  canRemovePerson,
  mergePartnerships,
  withRole,
  type RelinkPrompt,
} from "@/components/client-background/relationships-section"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  buildRelationshipTree,
  canonicalParentsLink,
  familyOfOriginLayout,
  linkedParentId,
  originPartnerships,
  parentsRelationshipLabel,
  partnershipsForPerson,
  personName,
  personRoleLabel,
  relationshipLineLabel,
  stepParentLinkLabel,
  treeLineStatus,
  brokenLinksForRoleChange,
} from "@/lib/client-background/tree"
import { applyRelationshipVisibilityDefaults } from "@/lib/client-background/visibility"
import type { AppliedAnswer } from "@/lib/background-questionnaire/to-client-background"
import type {
  ClientRelationshipStatusValue,
  PartnershipRecord,
  RelationshipRecord,
  RelationshipRelink,
  RelationshipToClient,
} from "@/lib/client-background/types"
import { cn } from "@/lib/utils"

type PersonSheet = {
  kind: "person"
  isNew: boolean
  editing: boolean
  draft: RelationshipRecord
  draftPairs: PartnershipRecord[]
  associatedParentId: string | null
}

type PartnershipSheet = {
  kind: "partnership"
  editing: boolean
  draft: PartnershipRecord
}

export function InterviewRelationships({
  clientId,
  relationships,
  partnerships,
  relationshipStatus,
  onRelationships,
  onPhase,
  registerFlush,
  relationshipClient,
  childrenPrompt,
}: {
  clientId: string
  relationships: RelationshipRecord[]
  partnerships: PartnershipRecord[]
  relationshipStatus: ClientRelationshipStatusValue
  onRelationships: (relationships: RelationshipRecord[]) => void
  onPhase: (id: string, phase: SavePhase, retry: (() => void) | null) => void
  registerFlush: (flush: () => Promise<void>) => () => void
  relationshipClient?: AppliedAnswer<ClientRelationshipStatusValue>
  childrenPrompt?: string | null
}) {
  const [open, setOpen] = useState(true)
  const [people, setPeople] = useState(relationships)
  const [pairs, setPairs] = useState(partnerships)
  const [clientStatus, setClientStatus] = useState(relationshipStatus)
  const [partnerStatusDraft, setPartnerStatusDraft] = useState(relationshipStatus)
  const [sheet, setSheet] = useState<PersonSheet | PartnershipSheet | null>(null)
  const [relinkPrompt, setRelinkPrompt] = useState<RelinkPrompt | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const scrollY = useRef(0)

  useEffect(() => {
    onRelationships(people)
  }, [people, onRelationships])

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
  const recordedChildren = people.filter(
    (person) => person.relationshipToClient === "child_biological" || person.relationshipToClient === "child_step"
  ).length
  const currentPartners = tree.partners.filter((item) => item.person.relationshipToClient === "current_partner")
  const priorPartners = tree.partners.filter((item) => item.person.relationshipToClient === "prior_partner")

  function remember(event: MouseEvent<HTMLButtonElement>) {
    opener.current = event.currentTarget
    scrollY.current = window.scrollY
  }

  function closeSheet(force = false) {
    if (pending && !force) return
    setSheet(null)
    setRelinkPrompt(null)
    setLinkError(null)
    setError(null)
    const node = opener.current
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY.current)
      node?.focus()
    })
  }

  function personPartnerships(personId: string, partnershipList: PartnershipRecord[]) {
    return partnershipsForPerson(personId, partnershipList).filter(
      (item) => item.partnershipRecordId !== parentsLink.partnership?.partnershipRecordId
    )
  }

  function openPerson(person: RelationshipRecord, startEditing: boolean, event?: MouseEvent<HTMLButtonElement>) {
    if (event) remember(event)
    setSheet({
      kind: "person",
      isNew: false,
      editing: startEditing,
      draft: { ...person },
      draftPairs: personPartnerships(person.relationshipRecordId, pairs).map((item) => ({ ...item })),
      associatedParentId: linkedParentId(person.relationshipRecordId, people, pairs),
    })
    setPartnerStatusDraft(clientStatus)
    setError(null)
    setLinkError(null)
    setRelinkPrompt(null)
  }

  function openPartnership(partnership: PartnershipRecord, event: MouseEvent<HTMLButtonElement>) {
    remember(event)
    setSheet({ kind: "partnership", editing: false, draft: { ...partnership } })
    setError(null)
    setLinkError(null)
    setRelinkPrompt(null)
  }

  function openNew(
    role: RelationshipToClient,
    event?: MouseEvent<HTMLButtonElement>,
    preset?: {
      associatedParentId?: string | null
      partnershipRecordId?: string | null
      linkedPartnerRecordId?: string | null
    }
  ) {
    if (event) remember(event)
    const record = blankRelationship(role)
    if (preset?.partnershipRecordId) record.partnershipRecordId = preset.partnershipRecordId
    if (preset?.linkedPartnerRecordId) record.linkedPartnerRecordId = preset.linkedPartnerRecordId
    if (role === "sibling_full" && !record.partnershipRecordId && parentLinks.length === 1) {
      record.partnershipRecordId = parentLinks[0].partnershipRecordId
    }
    setSheet({
      kind: "person",
      isNew: true,
      editing: true,
      draft: record,
      draftPairs: [],
      associatedParentId: role === "step_parent" ? preset?.associatedParentId ?? null : null,
    })
    setPartnerStatusDraft(clientStatus)
    setError(null)
    setLinkError(null)
    setRelinkPrompt(null)
  }

  function patch(partial: Partial<RelationshipRecord>) {
    setSheet((current) => {
      if (!current || current.kind !== "person") return current
      setLinkError(null)
      return {
        ...current,
        draft: applyRelationshipVisibilityDefaults({ ...current.draft, ...partial }),
      }
    })
  }

  function changeRole(role: RelationshipToClient) {
    setSheet((current) => {
      if (!current || current.kind !== "person") return current
      const stayingStep = role === "step_parent" && current.draft.relationshipToClient === "step_parent"
      setLinkError(null)
      return {
        ...current,
        draft: withRole(current.draft, role, parentLinks),
        associatedParentId: stayingStep ? current.associatedParentId : null,
      }
    })
  }

  function cancelEdit() {
    setLinkError(null)
    setRelinkPrompt(null)
    setError(null)
    setPartnerStatusDraft(clientStatus)
    if (!sheet) return
    if (sheet.kind === "person" && sheet.isNew) {
      closeSheet(true)
      return
    }
    if (sheet.kind === "partnership") {
      const saved = pairs.find((item) => item.partnershipRecordId === sheet.draft.partnershipRecordId)
      if (!saved) {
        closeSheet(true)
        return
      }
      setSheet({ ...sheet, editing: false, draft: { ...saved } })
      return
    }
    const saved = people.find((item) => item.relationshipRecordId === sheet.draft.relationshipRecordId)
    if (!saved) {
      closeSheet(true)
      return
    }
    setSheet({
      ...sheet,
      editing: false,
      draft: { ...saved },
      draftPairs: personPartnerships(saved.relationshipRecordId, pairs).map((item) => ({ ...item })),
      associatedParentId: linkedParentId(saved.relationshipRecordId, people, pairs),
    })
  }

  async function savePerson(relink?: RelationshipRelink) {
    if (!sheet || sheet.kind !== "person") return
    const draft = sheet.draft
    const associationError = associationErrorFor(draft, sheet.associatedParentId, parentLinks)
    if (associationError) {
      setLinkError(associationError)
      return
    }
    setLinkError(null)
    if (!sheet.isNew && !relink) {
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
    onPhase("relationships", "saving", null)
    const statusPayload = draft.relationshipToClient === "current_partner" ? partnerStatusDraft : undefined
    const result = sheet.isNew
      ? await createRelationshipAction(clientId, draft, sheet.associatedParentId, statusPayload)
      : await updateRelationshipAction(clientId, draft, sheet.draftPairs, {
          associatedParentId: sheet.associatedParentId,
          relink: relink ?? null,
          clientRelationshipStatus: statusPayload,
        })
    setPending(false)
    if (result.error || !result.relationship) {
      const message = result.error ?? "Could not save this person."
      setError(message)
      setRelinkPrompt(null)
      onPhase("relationships", "error", () => void savePerson(relink))
      return
    }

    const removed = new Set(result.removedPartnershipIds ?? [])
    const nextPairs = mergePartnerships(pairs, result.partnerships ?? []).filter(
      (pair) => !removed.has(pair.partnershipRecordId)
    )
    const nextPeople = new Map(people.map((person) => [person.relationshipRecordId, person]))
    for (const person of result.affectedRelationships ?? []) nextPeople.set(person.relationshipRecordId, person)
    nextPeople.set(result.relationship.relationshipRecordId, result.relationship)
    const peopleList = [...nextPeople.values()]
    setPeople(peopleList)
    setPairs(nextPairs)
    if (result.clientRelationshipStatus) {
      setClientStatus(result.clientRelationshipStatus)
      setPartnerStatusDraft(result.clientRelationshipStatus)
    }
    setRelinkPrompt(null)
    onPhase("relationships", "saved", null)
    closeSheet(true)
  }

  async function savePartnership() {
    if (!sheet || sheet.kind !== "partnership") return
    setPending(true)
    setError(null)
    onPhase("relationships", "saving", null)
    const result = await updatePartnershipAction(clientId, sheet.draft)
    setPending(false)
    if (result.error || !result.partnership) {
      setError(result.error ?? "Could not save this relationship.")
      onPhase("relationships", "error", () => void savePartnership())
      return
    }
    setPairs((current) => mergePartnerships(current, [result.partnership!]))
    onPhase("relationships", "saved", null)
    closeSheet(true)
  }

  async function removePerson() {
    if (!sheet || sheet.kind !== "person" || sheet.isNew) return
    if (!window.confirm(`Remove ${personName(sheet.draft)} from this client's relationships?`)) return
    setPending(true)
    setError(null)
    const result = await deleteRelationshipAction(clientId, sheet.draft.relationshipRecordId)
    setPending(false)
    if (result.error) {
      setError(result.error)
      onPhase("relationships", "error", () => void removePerson())
      return
    }
    const removedId = sheet.draft.relationshipRecordId
    setPeople((current) => current.filter((person) => person.relationshipRecordId !== removedId))
    setPairs((current) => current.filter((pair) => pair.partnerAId !== removedId && pair.partnerBId !== removedId))
    onPhase("relationships", "saved", null)
    closeSheet(true)
  }

  function goBack() {
    if (!sheet) return
    if (sheet.kind === "person" && sheet.editing) {
      cancelEdit()
      return
    }
    if (sheet.kind === "partnership" && sheet.editing) {
      cancelEdit()
      return
    }
    closeSheet()
  }

  const personSheet = sheet?.kind === "person" ? sheet : null
  const partnershipSheet = sheet?.kind === "partnership" ? sheet : null

  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="font-semibold">Relationships · {people.length} {people.length === 1 ? "person" : "people"}</span>
          <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
        </button>
      </CardHeader>
      {open ? (
        <CardContent className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Partners and children</h3>
            <AutosaveFields
              saved={clientStatus}
              save={async (value) => {
                const result = await saveClientRelationshipStatusAction(clientId, value)
                if (result.error || result.relationshipStatus === undefined || result.relationshipStatusOther === undefined) {
                  return { error: result.error ?? "Could not save relationship status." }
                }
                const next = {
                  relationshipStatus: result.relationshipStatus,
                  relationshipStatusOther: result.relationshipStatusOther,
                }
                setClientStatus(next)
                setPartnerStatusDraft(next)
                return { value: next }
              }}
              onPhase={(phase, retry) => onPhase("relationship-status", phase, retry)}
              registerFlush={registerFlush}
            >
              {(value, onChange, commit) => (
                <ClientRelationshipStatusFields
                  idPrefix="interview_status"
                  value={value}
                  onChange={onChange}
                  onCommit={commit}
                  client={relationshipClient}
                />
              )}
            </AutosaveFields>
            <Group title="Current partner">
              {currentPartners.map((partner) => (
                <RowButton
                  key={partner.person.relationshipRecordId}
                  label={relationshipLineLabel(partner.person, treeLineStatus(partner.person, pairs))}
                  onClick={(event) => openPerson(partner.person, false, event)}
                />
              ))}
              {currentPartners.length === 0 ? (
                <AddButton label="+ Add partner" onClick={(event) => openNew("current_partner", event)} />
              ) : null}
            </Group>
            <Group title="Prior partners">
              {priorPartners.map((partner) => (
                <RowButton
                  key={partner.person.relationshipRecordId}
                  label={relationshipLineLabel(partner.person, treeLineStatus(partner.person, pairs))}
                  onClick={(event) => openPerson(partner.person, false, event)}
                />
              ))}
              <AddButton label="+ Add prior partner" onClick={(event) => openNew("prior_partner", event)} />
            </Group>
            <Group
              title="Children"
              note={
                childrenPrompt ? (
                  <p className="px-2 text-sm text-blue-800">
                    Client: {childrenPrompt} · {recordedChildren} recorded
                  </p>
                ) : null
              }
            >
              {tree.partners.map((partner) =>
                partner.children.length > 0 ? (
                  <div key={partner.person.relationshipRecordId} className="space-y-1">
                    <p className="px-2 text-xs text-muted-foreground">{personName(partner.person)}</p>
                    {partner.children.map((child) => (
                      <RowButton
                        key={child.relationshipRecordId}
                        label={relationshipLineLabel(child)}
                        onClick={(event) => openPerson(child, false, event)}
                      />
                    ))}
                  </div>
                ) : null
              )}
              {tree.unlinkedChildren.map((child) => (
                <RowButton
                  key={child.relationshipRecordId}
                  label={relationshipLineLabel(child)}
                  onClick={(event) => openPerson(child, false, event)}
                />
              ))}
              {tree.unlinkedStepChildren.map((child) => (
                <RowButton
                  key={child.relationshipRecordId}
                  label={relationshipLineLabel(child)}
                  onClick={(event) => openPerson(child, false, event)}
                />
              ))}
              <AddButton label="+ Add child" onClick={(event) => openNew("child_biological", event)} />
            </Group>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Family of origin</h3>
            <Group title="Parents">
              {layout.parents.map((person) => (
                <RowButton
                  key={person.relationshipRecordId}
                  label={relationshipLineLabel(person, treeLineStatus(person, pairs))}
                  onClick={(event) => openPerson(person, false, event)}
                />
              ))}
              {layout.caregivers.map((person) => (
                <RowButton
                  key={person.relationshipRecordId}
                  label={relationshipLineLabel(person, treeLineStatus(person, pairs))}
                  onClick={(event) => openPerson(person, false, event)}
                />
              ))}
              <RowButton
                label={
                  parentsLink.partnership
                    ? parentsRelationshipLabel(parentsLink.partnership)
                    : "Parents' relationship"
                }
                onClick={(event) => {
                  if (parentsLink.partnership) openPartnership(parentsLink.partnership, event)
                }}
                disabled={!parentsLink.partnership}
              />
              <div className="flex flex-col items-start gap-2">
                <AddButton label="+ Add parent" onClick={(event) => openNew("parent", event)} />
                <AddButton label="+ Add other primary caregiver" onClick={(event) => openNew("other_caregiver", event)} />
              </div>
            </Group>
            <Group title="Siblings">
              {layout.siblings.map((person) => (
                <RowButton
                  key={person.relationshipRecordId}
                  label={relationshipLineLabel(person)}
                  onClick={(event) => openPerson(person, false, event)}
                />
              ))}
              <AddButton label="+ Add sibling" onClick={(event) => openNew("sibling_full", event)} />
            </Group>
            <Group title="Step-family">
              {tree.otherFamily.map((group) => (
                <div key={group.parent.relationshipRecordId} className="space-y-1">
                  {group.stepParents.map((node) => (
                    <div key={node.person.relationshipRecordId} className="space-y-1">
                      <RowButton
                        label={`Step-parent – ${stepParentLinkLabel({
                          stepParent: node.person,
                          parent: group.parent,
                          partnershipRecordId: node.partnership.partnershipRecordId,
                        })}`}
                        onClick={(event) => openPerson(node.person, false, event)}
                      />
                      <div className="ml-4 space-y-1 border-l pl-3">
                        {node.siblings.map((sibling) => (
                          <RowButton
                            key={sibling.relationshipRecordId}
                            label={relationshipLineLabel(sibling)}
                            onClick={(event) => openPerson(sibling, false, event)}
                          />
                        ))}
                        <AddButton
                          label="+ Add half- or step-sibling"
                          onClick={(event) =>
                            openNew("sibling_half", event, { partnershipRecordId: node.partnership.partnershipRecordId })
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <AddButton label="+ Add step-parent" onClick={(event) => openNew("step_parent", event)} />
            </Group>
          </section>

          {needsLinking.length > 0 ? (
            <section className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-2 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
              <h3 className="px-2 text-sm font-semibold">Needs linking</h3>
              {needsLinking.map(({ person, action }) => (
                <button
                  key={person.relationshipRecordId}
                  type="button"
                  className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-md px-2 text-left text-sm hover:bg-amber-200 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:hover:bg-amber-800"
                  onClick={(event) => openPerson(person, true, event)}
                >
                  <span>
                    {personRoleLabel(person)} — {person.givenName.trim() || "Not recorded"}
                  </span>
                  <span className="shrink-0 text-xs font-medium">{action}</span>
                </button>
              ))}
            </section>
          ) : null}
        </CardContent>
      ) : null}

      <Sheet open={sheet != null} onOpenChange={(next) => !next && closeSheet()}>
        <SheetContent className="h-full w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              {personSheet ? (personSheet.isNew ? "New relationship" : personName(personSheet.draft)) : "Parents' relationship"}
            </SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
          {personSheet ? (
            <PersonDetail
              draft={personSheet.draft}
              draftPairs={personSheet.draftPairs}
              people={people}
              partnerships={pairs}
              isNew={personSheet.isNew}
              editing={personSheet.editing}
              pending={pending}
              error={error}
              linkError={linkError}
              associatedParentId={personSheet.associatedParentId}
              canRemove={canRemovePerson(personSheet.draft, people)}
              onEdit={() => setSheet({ ...personSheet, editing: true })}
              onCancel={cancelEdit}
              onPatch={patch}
              onRole={changeRole}
              onAssociatedParentId={(id) =>
                setSheet((current) => (current?.kind === "person" ? { ...current, associatedParentId: id } : current))
              }
              onReplaceWithNew={(role) => openNew(role)}
              onPairs={(draftPairs) =>
                setSheet((current) => (current?.kind === "person" ? { ...current, draftPairs } : current))
              }
              clientRelationshipStatus={partnerStatusDraft}
              onClientRelationshipStatus={setPartnerStatusDraft}
              onSave={() => void savePerson()}
              onRemove={() => void removePerson()}
              onBack={goBack}
              backLabel="← Back"
            />
          ) : null}
          {partnershipSheet ? (
            <PartnershipDetail
              partnership={partnershipSheet.draft}
              editing={partnershipSheet.editing}
              pending={pending}
              error={error}
              onEdit={() => setSheet({ ...partnershipSheet, editing: true })}
              onCancel={cancelEdit}
              onChange={(draft) => setSheet({ ...partnershipSheet, draft })}
              onSave={() => void savePartnership()}
              onBack={goBack}
              backLabel="← Back"
            />
          ) : null}
          </div>
        </SheetContent>
      </Sheet>
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
    </Card>
  )
}

function Group({
  title,
  note,
  children,
}: {
  title: string
  note?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <h4 className="px-2 text-sm font-medium">{title}</h4>
      {note}
      {children}
    </div>
  )
}

function RowButton({
  label,
  onClick,
  disabled,
}: {
  label: string
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="flex min-h-11 w-full cursor-pointer items-center rounded-md px-2 text-left text-sm hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default disabled:hover:bg-transparent"
      onClick={onClick}
    >
      {label}
    </button>
  )
}
