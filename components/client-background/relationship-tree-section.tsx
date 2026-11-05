"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

import {
  addBlockMemberAction,
  createRelationshipBlockAction,
  deleteRelationshipBlockAction,
  moveBlockMemberAction,
  removeBlockMemberAction,
  updateBlockMemberAction,
  updateRelationshipBlockAction,
} from "@/app/clients/[client_id]/background/actions"
import { PartialDatePicker, SelectField, TextAreaField, TextField, selectClassName } from "@/components/client-background/fields"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  childTypesForBlock,
  isPartneredClientStatus,
  moveDestinationKind,
  moveDestinations,
  rolesForBlock,
  siblingTypesForBlock,
} from "@/lib/client-background/relationship-blocks"
import {
  addTargetKind,
  buildRelationshipTree,
  headingFor,
  linesAboutPerson,
  type RelationshipTreeNode,
} from "@/lib/client-background/relationship-tree"
import { todayDateString } from "@/lib/dates/practice-time"
import {
  ARRANGEMENT_TYPE_LABELS,
  ARRANGEMENT_TYPES,
  CAREGIVER_RELATIONSHIP_LABELS,
  CAREGIVER_RELATIONSHIPS,
  CHILD_TYPE_LABELS,
  CURRENT_BLOCK_STATUS_LABELS,
  DEPENDENCY_LABELS,
  DEPENDENCY_VALUES,
  EVENT_TYPE_LABELS,
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
  type ClientRelationshipStatusValue,
  type EventRecord,
  type EventType,
  type RelationshipBlock,
  type RelationshipBlockAnswers,
  type RelationshipRecord,
} from "@/lib/client-background/types"
import { personAge } from "@/lib/reports/background-report-prose"
import { cn } from "@/lib/utils"

type EditorState = {
  relationships?: RelationshipRecord[]
  blocks?: RelationshipBlock[]
  blockAnswers?: RelationshipBlockAnswers
  error?: string
}

type Selection =
  | { type: "person"; id: string }
  | { type: "block"; id: string }
  | { type: "add" }

type PersonDraft = {
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

const ROLE_LABELS: Record<BlockRole, string> = {
  partner: "Partner",
  child: "Child",
  parent: "Parent",
  sibling: "Sibling",
  caregiver: "Caregiver",
}

export function RelationshipTreeSection({
  clientId,
  relationships,
  blocks,
  blockAnswers,
  relationshipStatus,
  dateOfBirth,
  events,
}: {
  clientId: string
  relationships: RelationshipRecord[]
  blocks: RelationshipBlock[]
  blockAnswers: RelationshipBlockAnswers
  relationshipStatus: ClientRelationshipStatusValue
  dateOfBirth: string | null
  events: EventRecord[]
}) {
  const [local, setLocal] = useState<EditorState | null>(null)
  const incoming = snapshot(relationships, blocks)
  useEffect(() => {
    setLocal(null)
  }, [incoming])
  const people = local?.relationships ?? relationships
  const shownBlocks = local?.blocks ?? blocks
  const answers = local?.blockAnswers ?? blockAnswers
  const tree = buildRelationshipTree({
    blocks: shownBlocks,
    relationships: people,
    blockAnswers: answers,
    dateOfBirth,
    asOf: todayDateString(),
  })
  const [selection, setSelection] = useState<Selection | null>(null)
  const [mode, setMode] = useState<"view" | "edit">("view")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  useEffect(() => {
    if (!selection) return
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelection(null)
        setMode("view")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selection])

  function close() {
    setSelection(null)
    setMode("view")
    setError("")
  }

  function openPerson(id: string) {
    setSelection({ type: "person", id })
    setMode("view")
    setError("")
  }

  function openBlock(id: string) {
    setSelection({ type: "block", id })
    setMode("view")
    setError("")
  }

  async function apply(work: () => Promise<unknown>): Promise<EditorState | null> {
    setSaving(true)
    setError("")
    try {
      const result = (await work()) as EditorState | null
      if (!result) {
        setError("Could not save.")
        return null
      }
      if (result.error) {
        setError(result.error)
        return null
      }
      if (result.relationships && result.blocks && result.blockAnswers) setLocal(result)
      return result
    } finally {
      setSaving(false)
    }
  }

  const person = selection?.type === "person" ? people.find((item) => item.relationshipRecordId === selection.id) : undefined
  const block = selection?.type === "block" ? shownBlocks.find((item) => item.relationshipBlockId === selection.id) : undefined
  const lockedId = isPartneredClientStatus(relationshipStatus.relationshipStatus)
    ? shownBlocks.filter((item) => item.kind === "client_current").sort((a, b) => a.displayOrder - b.displayOrder)[0]?.relationshipBlockId ?? null
    : null

  return (
    <div className="space-y-4">
      <TreeCard title={tree.partners.title} nodes={tree.partners.children} onAdd={() => { setSelection({ type: "add" }); setMode("edit"); setError("") }} onPerson={openPerson} onBlock={openBlock} />
      <TreeCard title={tree.parents.title} nodes={tree.parents.children} onAdd={() => { setSelection({ type: "add" }); setMode("edit"); setError("") }} onPerson={openPerson} onBlock={openBlock} />
      {ready && selection
        ? createPortal(
            <div className="fixed inset-0 z-50">
              <button type="button" className="absolute inset-0 bg-black/20" aria-label="Dismiss" onClick={close} />
              <aside
                role="dialog"
                aria-modal="true"
                aria-label={selection.type === "add" ? "Add a person" : person?.givenName || block?.relationshipBlockId || "Relationship"}
                className="absolute inset-y-0 right-0 flex w-full animate-[relationship-panel_200ms_ease-out] flex-col bg-background shadow-xl sm:w-[440px]"
              >
                <style>{`@keyframes relationship-panel { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
                {selection.type === "add" ? (
                  <AddForm
                    clientId={clientId}
                    blocks={shownBlocks}
                    saving={saving}
                    error={error}
                    onClose={close}
                    onSave={async (targetId, role, roleType, draft) => {
                      const beforeBlocks = shownBlocks.map((item) => item.relationshipBlockId)
                      const beforePeople = people.map((item) => item.relationshipRecordId)
                      const created = addTargetKind(targetId)
                      let blockId = targetId
                      if (created) {
                        const result = await apply(() =>
                          createRelationshipBlockAction(clientId, created.kind, { parentSide: created.parentSide })
                        )
                        const nextId = result?.blocks?.find((item) => !beforeBlocks.includes(item.relationshipBlockId))?.relationshipBlockId
                        if (!result || !nextId) return
                        blockId = nextId
                      }
                      const added = await apply(() => addBlockMemberAction(clientId, blockId, role, roleType))
                      const createdPerson = added?.relationships?.find((item) => !beforePeople.includes(item.relationshipRecordId))
                      if (!added || !createdPerson) return
                      const saved = await apply(() => updateBlockMemberAction(clientId, personFromDraft(createdPerson, draft)))
                      if (!saved) return
                      setSelection({ type: "person", id: createdPerson.relationshipRecordId })
                      setMode("view")
                    }}
                  />
                ) : selection.type === "person" && person ? (
                  <PersonPanel
                    person={person}
                    block={shownBlocks.find((item) => item.relationshipBlockId === person.relationshipBlockId) ?? null}
                    blocks={shownBlocks}
                    people={people}
                    events={events}
                    dateOfBirth={dateOfBirth}
                    mode={mode}
                    saving={saving}
                    error={error}
                    onClose={close}
                    onEdit={() => { setMode("edit"); setError("") }}
                    onCancel={() => { setMode("view"); setError("") }}
                    onSave={async (draft) => {
                      const saved = await apply(() => updateBlockMemberAction(clientId, personFromDraft(person, draft)))
                      if (saved) setMode("view")
                    }}
                    onRemove={async () => {
                      const removed = await apply(() => removeBlockMemberAction(clientId, person.relationshipRecordId))
                      if (removed) close()
                    }}
                    onMove={async (destinationId, role, roleType) => {
                      await apply(() => moveBlockMemberAction(clientId, person.relationshipRecordId, destinationId, role, roleType))
                    }}
                  />
                ) : selection.type === "block" && block ? (
                  <BlockPanel
                    block={block}
                    people={people.filter((item) => item.relationshipBlockId === block.relationshipBlockId)}
                    locked={block.relationshipBlockId === lockedId}
                    mode={mode}
                    saving={saving}
                    error={error}
                    onClose={close}
                    onEdit={() => { setMode("edit"); setError("") }}
                    onCancel={() => { setMode("view"); setError("") }}
                    onOpenPerson={openPerson}
                    onSave={async (draft) => {
                      const saved = await apply(() => updateRelationshipBlockAction(clientId, draft))
                      if (saved) setMode("view")
                    }}
                    onRemove={async () => {
                      const removed = await apply(() => deleteRelationshipBlockAction(clientId, block.relationshipBlockId))
                      if (removed) close()
                    }}
                  />
                ) : null}
              </aside>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}

function TreeCard({
  title,
  nodes,
  onAdd,
  onPerson,
  onBlock,
}: {
  title: string
  nodes: RelationshipTreeNode[]
  onAdd: () => void
  onPerson: (id: string) => void
  onBlock: (id: string) => void
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <button type="button" className="text-sm text-primary underline-offset-2 hover:underline" onClick={onAdd}>
          + Add
        </button>
      </CardHeader>
      <CardContent>
        <BranchList nodes={nodes} onPerson={onPerson} onBlock={onBlock} />
      </CardContent>
    </Card>
  )
}

function BranchList({
  nodes,
  onPerson,
  onBlock,
}: {
  nodes: RelationshipTreeNode[]
  onPerson: (id: string) => void
  onBlock: (id: string) => void
}) {
  const items = nodes.filter((node) => node.kind !== "note")
  const notes = nodes.filter((node) => node.kind === "note")
  return (
    <>
      {items.length > 0 ? (
        <ul>
          {items.map((node, index) => (
            <li key={nodeKey(node, index)} className="relative pl-4">
              <span
                aria-hidden
                className="absolute top-0 left-0 w-0.5 bg-[#a1a1aa]"
                style={{ height: index === items.length - 1 ? 20 : "100%" }}
              />
              <span aria-hidden className="absolute top-5 left-0 h-0.5 w-4 bg-[#a1a1aa]" />
              <TreeNode node={node} onPerson={onPerson} onBlock={onBlock} />
            </li>
          ))}
        </ul>
      ) : null}
      {notes.map((note) =>
        note.kind === "note" ? (
          <p key={note.text} className="mt-3 text-sm text-muted-foreground">
            {note.text}
          </p>
        ) : null
      )}
    </>
  )
}

function TreeNode({
  node,
  onPerson,
  onBlock,
}: {
  node: Exclude<RelationshipTreeNode, { kind: "note" }>
  onPerson: (id: string) => void
  onBlock: (id: string) => void
}) {
  if (node.kind === "person") {
    const [name, ...rest] = node.line.split(" · ")
    return (
      <button type="button" className="flex min-h-10 w-full items-center gap-2 rounded-md px-1 text-left hover:bg-muted" onClick={() => onPerson(node.id)}>
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium",
            node.deceased ? "border-2 border-dashed border-[#a1a1aa]" : "bg-muted"
          )}
          aria-hidden
        >
          {node.initial}
        </span>
        <span className="text-sm">
          <span className="font-medium">{name}</span>
          {rest.length > 0 ? <span className="text-muted-foreground"> · {rest.join(" · ")}</span> : null}
        </span>
      </button>
    )
  }
  if (node.kind === "block") {
    return (
      <>
        <button type="button" className="flex min-h-10 w-full flex-col justify-center rounded-md px-1 text-left hover:bg-muted" onClick={() => onBlock(node.id)}>
          <span className="text-sm font-medium">{node.heading}</span>
          {node.meta ? <span className="text-xs text-muted-foreground">{node.meta}</span> : null}
        </button>
        {node.children.length > 0 ? <BranchList nodes={node.children} onPerson={onPerson} onBlock={onBlock} /> : null}
      </>
    )
  }
  return (
    <>
      <p className="flex min-h-10 items-center px-1 text-sm text-muted-foreground">{node.label}</p>
      {node.children.length > 0 ? <BranchList nodes={node.children} onPerson={onPerson} onBlock={onBlock} /> : null}
      {node.children.length === 0 && node.empty ? (
        <ul>
          <li className="relative pl-4">
            <span aria-hidden className="absolute top-0 left-0 h-5 w-0.5 bg-[#a1a1aa]" />
            <span aria-hidden className="absolute top-5 left-0 h-0.5 w-4 bg-[#a1a1aa]" />
            <p className="flex min-h-10 items-center px-1 text-sm text-muted-foreground italic">{node.empty}</p>
          </li>
        </ul>
      ) : null}
    </>
  )
}

function PersonPanel({
  person,
  block,
  blocks,
  people,
  events,
  dateOfBirth,
  mode,
  saving,
  error,
  onClose,
  onEdit,
  onCancel,
  onSave,
  onRemove,
  onMove,
}: {
  person: RelationshipRecord
  block: RelationshipBlock | null
  blocks: RelationshipBlock[]
  people: RelationshipRecord[]
  events: EventRecord[]
  dateOfBirth: string | null
  mode: "view" | "edit"
  saving: boolean
  error: string
  onClose: () => void
  onEdit: () => void
  onCancel: () => void
  onSave: (draft: PersonDraft) => Promise<void>
  onRemove: () => Promise<void>
  onMove: (destinationId: string, role: BlockRole, roleType: string) => Promise<void>
}) {
  const [draft, setDraft] = useState<PersonDraft>(() => draftFromPerson(person))
  useEffect(() => setDraft(draftFromPerson(person)), [person])
  const nodeName = person.notKnown && person.blockRole === "parent" ? (person.blockRoleType === "father" ? "Father" : "Mother") : person.givenName.trim() || "Person"
  const context = block ? headingFor(block).split(" · ")[0] : "Not placed"
  const title = roleTitle(person, block)
  const history = events.filter((event) => event.relationshipRecordId === person.relationshipRecordId && event.about === "significant_other")
  return (
    <>
      <PanelHeader
        initial={nodeName.slice(0, 1).toUpperCase() || "?"}
        deceased={person.deceased || person.healthStatus === "deceased"}
        title={nodeName}
        subtitle={`${title} · ${context}`}
        onClose={onClose}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {mode === "view" ? (
          <div className="space-y-6">
            <Facts rows={personFacts(person, dateOfBirth)} />
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Relationships</h3>
              <ul className="space-y-1 text-sm">
                {linesAboutPerson(person, blocks, people).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
            {history.length > 0 ? (
              <section className="space-y-2">
                <h3 className="text-sm font-medium">History about {nodeName}</h3>
                <ul className="space-y-1 text-sm">
                  {history.map((event) => (
                    <li key={event.eventRecordId}>
                      {event.title.trim() || "Untitled"}
                      <span className="text-muted-foreground"> · {EVENT_TYPE_LABELS[event.eventType as EventType] ?? event.eventType}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : (
          <PersonFields idPrefix={person.relationshipRecordId} person={person} block={block} draft={draft} onChange={setDraft} />
        )}
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </div>
      {mode === "view" ? (
        <footer className="space-y-3 border-t p-4">
          <MoveBox person={person} blocks={blocks} disabled={saving} onMove={onMove} />
          <div className="flex justify-end">
            <button type="button" className="inline-flex min-h-10 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground" onClick={onEdit}>
              Edit
            </button>
          </div>
        </footer>
      ) : (
        <EditFooter saving={saving} onRemove={() => void onRemove()} onCancel={onCancel} onSave={() => void onSave(draft)} />
      )}
    </>
  )
}

function BlockPanel({
  block,
  people,
  locked,
  mode,
  saving,
  error,
  onClose,
  onEdit,
  onCancel,
  onSave,
  onRemove,
  onOpenPerson,
}: {
  block: RelationshipBlock
  people: RelationshipRecord[]
  locked: boolean
  mode: "view" | "edit"
  saving: boolean
  error: string
  onClose: () => void
  onEdit: () => void
  onCancel: () => void
  onSave: (draft: RelationshipBlock) => Promise<void>
  onRemove: () => Promise<void>
  onOpenPerson: (id: string) => void
}) {
  const [draft, setDraft] = useState(block)
  useEffect(() => setDraft(block), [block])
  const removable = block.kind !== "biological_parents" && block.kind !== "client_other_children"
  return (
    <>
      <PanelHeader initial={headingFor(block).slice(0, 1)} deceased={false} title={headingFor(block)} subtitle={blockMetaLine(block)} onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {mode === "view" ? (
          <div className="space-y-6">
            <Facts rows={blockFacts(block)} />
            <section className="space-y-2">
              <h3 className="text-sm font-medium">People</h3>
              {people.length === 0 ? <p className="text-sm text-muted-foreground">No one recorded</p> : null}
              <ul>
                {people.map((person) => (
                  <li key={person.relationshipRecordId}>
                    <button type="button" className="flex min-h-10 w-full items-center text-left text-sm font-medium hover:underline" onClick={() => onOpenPerson(person.relationshipRecordId)}>
                      {person.givenName.trim() || "Unnamed"}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : (
          <BlockFields block={draft} locked={locked} onChange={setDraft} />
        )}
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </div>
      {mode === "view" ? (
        <footer className="flex justify-end border-t p-4">
          <button type="button" className="inline-flex min-h-10 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground" onClick={onEdit}>
            Edit
          </button>
        </footer>
      ) : (
        <EditFooter saving={saving} onRemove={removable ? () => void onRemove() : undefined} onCancel={onCancel} onSave={() => void onSave(draft)} />
      )}
    </>
  )
}

function AddForm({
  clientId,
  blocks,
  saving,
  error,
  onClose,
  onSave,
}: {
  clientId: string
  blocks: RelationshipBlock[]
  saving: boolean
  error: string
  onClose: () => void
  onSave: (targetId: string, role: BlockRole, roleType: string, draft: PersonDraft) => Promise<void>
}) {
  const targets = addTargets(blocks)
  const [targetId, setTargetId] = useState(targets[0]?.id ?? "")
  const target = targets.find((item) => item.id === targetId) ?? targets[0]
  const kind = target?.kind ?? null
  const roles = kind ? rolesForBlock(kind) : []
  const [role, setRole] = useState<BlockRole>(roles[0] ?? "partner")
  const safeRole = roles.includes(role) ? role : roles[0] ?? "partner"
  const arrangement = blocks.find((item) => item.relationshipBlockId === targetId)?.arrangementType ?? ""
  const types = typesFor(kind, safeRole, arrangement)
  const [draft, setDraft] = useState<PersonDraft>(emptyDraft)
  const roleType = types.includes(draft.blockRoleType) ? draft.blockRoleType : types[0] ?? ""
  const placeholder = { ...blankPerson(clientId), blockRole: safeRole, blockRoleType: roleType }
  const chosen = blocks.find((item) => item.relationshipBlockId === targetId) ?? (kind ? blankBlock(kind) : null)
  return (
    <>
      <PanelHeader initial="+" deceased={false} title="Add a person" subtitle="Choose where they belong" onClose={onClose} />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <SelectField id="add-where" label="Where" value={targetId} onChange={(value) => setTargetId(value)}>
          {targets.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </SelectField>
        <SelectField id="add-role" label="Role" value={safeRole} onChange={(value) => setRole(value as BlockRole)}>
          {roles.map((item) => (
            <option key={item} value={item}>{ROLE_LABELS[item]}</option>
          ))}
        </SelectField>
        <PersonFields idPrefix="add-person" person={placeholder} block={chosen} draft={{ ...draft, blockRoleType: roleType }} onChange={setDraft} />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
      <EditFooter saving={saving || !target} onCancel={onClose} onSave={() => void onSave(targetId, safeRole, roleType, { ...draft, blockRoleType: roleType })} />
    </>
  )
}

function PanelHeader({
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
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-medium", deceased ? "border-2 border-dashed border-[#a1a1aa]" : "bg-muted")} aria-hidden>
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-base font-medium">{title}</h2>
        <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <button type="button" className="inline-flex size-10 items-center justify-center rounded-md hover:bg-muted" aria-label="Close" onClick={onClose}>
        <X className="size-4" />
      </button>
    </header>
  )
}

function EditFooter({
  saving,
  onRemove,
  onCancel,
  onSave,
}: {
  saving: boolean
  onRemove?: () => void
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <footer className="flex items-center gap-2 border-t p-4">
      {onRemove ? (
        <button type="button" className="inline-flex min-h-10 items-center text-sm text-destructive underline-offset-2 hover:underline" disabled={saving} onClick={onRemove}>
          Remove
        </button>
      ) : null}
      <span className="flex-1" />
      <button type="button" className="inline-flex min-h-10 items-center rounded-md border px-3 text-sm" disabled={saving} onClick={onCancel}>
        Cancel
      </button>
      <button type="button" className="inline-flex min-h-10 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-60" disabled={saving} onClick={onSave}>
        Save
      </button>
    </footer>
  )
}

function Facts({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="space-y-2 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[9.5rem_1fr] gap-2">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function PersonFields({
  idPrefix,
  person,
  block,
  draft,
  onChange,
}: {
  idPrefix: string
  person: RelationshipRecord
  block: RelationshipBlock | null
  draft: PersonDraft
  onChange: (draft: PersonDraft) => void
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
          <option key={option} value={option}>{option}</option>
        ))}
      </SelectField>
      <PartialDatePicker id={`${idPrefix}-dob`} dateLabel="Date of birth" mode="person" value={draft.dateOfBirth} onChange={(dateOfBirth) => patch({ dateOfBirth })} />
      {role === "child" && childTypes.length > 0 ? (
        <SelectField id={`${idPrefix}-child-type`} label="Type" value={draft.blockRoleType} onChange={(blockRoleType) => patch({ blockRoleType })}>
          <option value="">Not recorded</option>
          {childTypes.map((type) => (
            <option key={type} value={type}>{CHILD_TYPE_LABELS[type]}</option>
          ))}
        </SelectField>
      ) : null}
      {role === "sibling" && siblingTypes.length > 0 ? (
        <SelectField id={`${idPrefix}-sibling-type`} label="Type" value={draft.blockRoleType} onChange={(blockRoleType) => patch({ blockRoleType })}>
          {siblingTypes.map((type) => (
            <option key={type} value={type}>{SIBLING_BLOCK_TYPE_LABELS[type]}</option>
          ))}
        </SelectField>
      ) : null}
      {role === "parent" ? (
        <SelectField id={`${idPrefix}-parent`} label="Parent" value={draft.blockRoleType || "mother"} onChange={(blockRoleType) => patch({ blockRoleType })}>
          <option value="mother">Mother</option>
          <option value="father">Father</option>
        </SelectField>
      ) : null}
      {role === "caregiver" && block?.arrangementType !== "adoption" ? (
        <SelectField id={`${idPrefix}-caregiver`} label="Relationship" value={draft.blockRoleType} onChange={(blockRoleType) => patch({ blockRoleType })}>
          <option value="">Not recorded</option>
          {CAREGIVER_RELATIONSHIPS.map((type) => (
            <option key={type} value={type}>{CAREGIVER_RELATIONSHIP_LABELS[type]}</option>
          ))}
        </SelectField>
      ) : null}
      {role === "parent" ? (
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
          <option key={option} value={option}>{HEALTH_STATUS_LABELS[option]}</option>
        ))}
      </SelectField>
      {draft.healthStatus === "deceased" || draft.deceased ? (
        <PartialDatePicker id={`${idPrefix}-died`} dateLabel="Year of death" mode="date-only" value={draft.dateOfDeath} onChange={(dateOfDeath) => patch({ dateOfDeath })} />
      ) : null}
      <SelectField id={`${idPrefix}-support`} label="Supportive" value={draft.supportive} onChange={(supportive) => patch({ supportive: supportive as PersonDraft["supportive"] })}>
        <option value="">Not recorded</option>
        {RELATIONSHIP_RATING_VALUES.map((option) => (
          <option key={option} value={option}>{RELATIONSHIP_RATING_LABELS[option]}</option>
        ))}
      </SelectField>
      <SelectField id={`${idPrefix}-conflict`} label="Conflict or strain" value={draft.conflict} onChange={(conflict) => patch({ conflict: conflict as PersonDraft["conflict"] })}>
        <option value="">Not recorded</option>
        {RELATIONSHIP_RATING_VALUES.map((option) => (
          <option key={option} value={option}>{RELATIONSHIP_RATING_LABELS[option]}</option>
        ))}
      </SelectField>
      <TextAreaField id={`${idPrefix}-comment`} label="Comment" value={draft.qualityOfRelationship} onChange={(qualityOfRelationship) => patch({ qualityOfRelationship })} />
      <SelectField id={`${idPrefix}-dependency`} label="Dependency" value={draft.dependency} onChange={(dependency) => patch({ dependency: dependency as PersonDraft["dependency"] })}>
        <option value="">Not recorded</option>
        {DEPENDENCY_VALUES.map((option) => (
          <option key={option} value={option}>{DEPENDENCY_LABELS[option]}</option>
        ))}
      </SelectField>
      <SelectField id={`${idPrefix}-living`} label="Living situation" value={draft.livingSituation} onChange={(livingSituation) => patch({ livingSituation: livingSituation as PersonDraft["livingSituation"] })}>
        <option value="">Not recorded</option>
        {RELATIONSHIP_LIVING_SITUATIONS.map((option) => (
          <option key={option} value={option}>{RELATIONSHIP_LIVING_SITUATION_LABELS[option]}</option>
        ))}
      </SelectField>
    </div>
  )
}

function BlockFields({
  block,
  locked,
  onChange,
}: {
  block: RelationshipBlock
  locked: boolean
  onChange: (block: RelationshipBlock) => void
}) {
  const statuses = statusesFor(block.kind)
  return (
    <div className="space-y-3">
      {statuses.length > 0 ? (
        locked ? (
          <p className="text-sm">
            {statusLabel(block.status) || "Not recorded"}
            <span className="mt-1 block text-xs text-muted-foreground">Set by the client&apos;s relationship status.</span>
          </p>
        ) : (
          <SelectField id={`${block.relationshipBlockId}-status`} label={block.kind === "client_previous" ? "How it ended" : "Status"} value={block.status} onChange={(status) => onChange({ ...block, status })}>
            <option value="">Not recorded</option>
            {statuses.map((status) => (
              <option key={status} value={status}>{statusLabel(status)}</option>
            ))}
          </SelectField>
        )
      ) : null}
      {block.status === "other" ? (
        <TextField id={`${block.relationshipBlockId}-other`} label="Other status" value={block.statusDetail} onChange={(statusDetail) => onChange({ ...block, statusDetail })} />
      ) : null}
      {block.kind === "caregiver_arrangement" ? (
        <SelectField id={`${block.relationshipBlockId}-arrangement`} label="Arrangement" value={block.arrangementType} onChange={(arrangementType) => onChange({ ...block, arrangementType: arrangementType as ArrangementType | "" })}>
          <option value="">Not recorded</option>
          {ARRANGEMENT_TYPES.map((type) => (
            <option key={type} value={type}>{ARRANGEMENT_TYPE_LABELS[type]}</option>
          ))}
        </SelectField>
      ) : null}
      {block.arrangementType === "other" ? (
        <TextField id={`${block.relationshipBlockId}-arrangement-detail`} label="Other arrangement" value={block.arrangementDetail} onChange={(arrangementDetail) => onChange({ ...block, arrangementDetail })} />
      ) : null}
      {block.kind !== "client_other_children" ? (
        <PartialDatePicker id={`${block.relationshipBlockId}-start`} dateLabel="Started" mode="date-only" value={block.startedOn} onChange={(startedOn) => onChange({ ...block, startedOn })} />
      ) : null}
      {block.kind !== "client_other_children" && block.kind !== "client_current" ? (
        <PartialDatePicker id={`${block.relationshipBlockId}-end`} dateLabel="Ended" mode="date-only" value={block.endedOn} onChange={(endedOn) => onChange({ ...block, endedOn })} />
      ) : null}
      {block.kind === "client_current" || block.kind === "client_previous" ? (
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={block.noChildren} onChange={(event) => onChange({ ...block, noChildren: event.target.checked })} />
          No children
        </label>
      ) : null}
    </div>
  )
}

function MoveBox({
  person,
  blocks,
  disabled,
  onMove,
}: {
  person: RelationshipRecord
  blocks: RelationshipBlock[]
  disabled: boolean
  onMove: (destinationId: string, role: BlockRole, roleType: string) => Promise<void>
}) {
  const destinations = moveDestinations(blocks)
  const [destinationId, setDestinationId] = useState(() => destinations.find((item) => item.id !== person.relationshipBlockId)?.id ?? destinations[0]?.id ?? "")
  const kind = moveDestinationKind(blocks, destinationId)
  const roles = kind ? [...rolesForBlock(kind)] : []
  const [roleChoice, setRoleChoice] = useState<BlockRole>(roles[0] ?? "partner")
  const role = roles.includes(roleChoice) ? roleChoice : roles[0] ?? "partner"
  const arrangement = blocks.find((item) => item.relationshipBlockId === destinationId)?.arrangementType ?? ""
  const types = typesFor(kind, role, arrangement)
  const [typeChoice, setTypeChoice] = useState(types[0] ?? "")
  const roleType = types.includes(typeChoice) ? typeChoice : types[0] ?? ""
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Move to…</span>
          <select className={selectClassName} value={destinationId} onChange={(event) => setDestinationId(event.target.value)}>
            {destinations.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Role</span>
          <select className={selectClassName} value={role} onChange={(event) => setRoleChoice(event.target.value as BlockRole)}>
            {roles.map((item) => (
              <option key={item} value={item}>{ROLE_LABELS[item]}</option>
            ))}
          </select>
        </label>
        {types.length > 0 ? (
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Type</span>
            <select className={selectClassName} value={roleType} onChange={(event) => setTypeChoice(event.target.value)}>
              {types.map((item) => (
                <option key={item} value={item}>{typeOptionLabel(role, item)}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <button type="button" className="inline-flex min-h-10 items-center text-sm text-primary underline-offset-2 hover:underline disabled:opacity-60" disabled={disabled || !destinationId} onClick={() => void onMove(destinationId, role, roleType)}>
        Move
      </button>
    </div>
  )
}

function personFacts(person: RelationshipRecord, dateOfBirth: string | null): { label: string; value: string }[] {
  const age = person.dateOfBirth.trim() ? personAge(person.dateOfBirth, todayDateString()) : null
  const born = /^(\d{4})/.exec(person.dateOfBirth)?.[1]
  const rows: { label: string; value: string }[] = [
    { label: "Sex", value: person.sex.trim() || "Not recorded" },
    { label: "Age", value: age != null ? (born ? `${age} (born ${born})` : String(age)) : "Not recorded" },
    { label: "Health", value: person.healthStatus ? HEALTH_STATUS_LABELS[person.healthStatus] : "Not recorded" },
  ]
  if (person.deceased || person.healthStatus === "deceased" || person.dateOfDeath.trim()) {
    rows.push({ label: "Year of death", value: /^(\d{4})/.exec(person.dateOfDeath)?.[1] || person.dateOfDeath || "Not recorded" })
  }
  rows.push(
    { label: "Supportive", value: person.supportive ? RELATIONSHIP_RATING_LABELS[person.supportive] : "Not recorded" },
    { label: "Conflict or strain", value: person.conflict ? RELATIONSHIP_RATING_LABELS[person.conflict] : "Not recorded" },
    { label: "Comment", value: person.qualityOfRelationship.trim() || "Not recorded" },
    { label: "Dependency", value: person.dependency ? DEPENDENCY_LABELS[person.dependency] : "Not recorded" },
    { label: "Living situation", value: person.livingSituation ? RELATIONSHIP_LIVING_SITUATION_LABELS[person.livingSituation] : "Not recorded" }
  )
  if (person.blockRole === "child" || person.blockRole === "sibling") {
    rows.push({ label: "Type", value: typeOptionLabel(person.blockRole, person.blockRoleType || person.childType) || "Not recorded" })
  }
  void dateOfBirth
  return rows
}

function blockFacts(block: RelationshipBlock): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = []
  if (block.kind === "client_previous") rows.push({ label: "How it ended", value: statusLabel(block.status) || "Not recorded" })
  else if (block.kind !== "caregiver_arrangement" && block.kind !== "client_other_children") {
    rows.push({ label: "Status", value: statusLabel(block.status) || "Not recorded" })
  }
  if (block.kind === "caregiver_arrangement") {
    rows.push({
      label: "Arrangement",
      value: block.arrangementType ? ARRANGEMENT_TYPE_LABELS[block.arrangementType as ArrangementType] ?? block.arrangementType : "Not recorded",
    })
  }
  if (block.kind !== "client_other_children") {
    rows.push({ label: "Started", value: block.startedOn.trim() || "Not recorded" })
    if (block.kind !== "client_current") rows.push({ label: "Ended", value: block.endedOn.trim() || "Not recorded" })
  }
  return rows
}

function blockMetaLine(block: RelationshipBlock): string {
  return [block.startedOn.trim(), block.endedOn.trim()].filter(Boolean).join("–") || "Relationship"
}

function statusesFor(kind: BlockKind): string[] {
  if (kind === "client_current") return Object.keys(CURRENT_BLOCK_STATUS_LABELS)
  if (kind === "client_previous") return Object.keys(PREVIOUS_BLOCK_STATUS_LABELS)
  if (kind === "biological_parents") return [...Object.keys(CURRENT_BLOCK_STATUS_LABELS), ...Object.keys(PREVIOUS_BLOCK_STATUS_LABELS), NEVER_IN_A_RELATIONSHIP]
  if (kind === "parent_other") return [...Object.keys(CURRENT_BLOCK_STATUS_LABELS), ...Object.keys(PREVIOUS_BLOCK_STATUS_LABELS)]
  return []
}

function statusLabel(status: string): string {
  if (status === NEVER_IN_A_RELATIONSHIP) return "Never in a relationship"
  if (status in CURRENT_BLOCK_STATUS_LABELS) return CURRENT_BLOCK_STATUS_LABELS[status as keyof typeof CURRENT_BLOCK_STATUS_LABELS]
  if (status in PREVIOUS_BLOCK_STATUS_LABELS) return PREVIOUS_BLOCK_STATUS_LABELS[status as keyof typeof PREVIOUS_BLOCK_STATUS_LABELS]
  return ""
}

function typesFor(kind: BlockKind | null, role: BlockRole, arrangement: string): string[] {
  if (!kind) return []
  if (role === "child") return [...childTypesForBlock(kind)]
  if (role === "sibling") return [...siblingTypesForBlock(kind)]
  if (role === "parent") return ["mother", "father"]
  if (role === "caregiver" && arrangement !== "adoption") return [...CAREGIVER_RELATIONSHIPS]
  return []
}

function typeOptionLabel(role: BlockRole | "" | undefined, value: string): string {
  if (!value) return ""
  if (role === "child" && value in CHILD_TYPE_LABELS) return CHILD_TYPE_LABELS[value as keyof typeof CHILD_TYPE_LABELS]
  if (role === "sibling" && value in SIBLING_BLOCK_TYPE_LABELS) return SIBLING_BLOCK_TYPE_LABELS[value as keyof typeof SIBLING_BLOCK_TYPE_LABELS]
  if (role === "parent") return value === "father" ? "Father" : "Mother"
  if (role === "caregiver" && value in CAREGIVER_RELATIONSHIP_LABELS) return CAREGIVER_RELATIONSHIP_LABELS[value as keyof typeof CAREGIVER_RELATIONSHIP_LABELS]
  return value
}

function addTargets(blocks: RelationshipBlock[]): { id: string; label: string; kind: BlockKind }[] {
  const rows: { id: string; label: string; kind: BlockKind }[] = []
  for (const block of blocks.filter((item) => item.kind === "client_current")) rows.push({ id: block.relationshipBlockId, label: headingFor(block), kind: block.kind })
  rows.push({ id: "new-current", label: "+ New current relationship", kind: "client_current" })
  for (const block of blocks.filter((item) => item.kind === "client_previous")) rows.push({ id: block.relationshipBlockId, label: headingFor(block), kind: block.kind })
  rows.push({ id: "new-previous", label: "+ New previous relationship", kind: "client_previous" })
  const biological = blocks.find((item) => item.kind === "biological_parents")
  if (biological) rows.push({ id: biological.relationshipBlockId, label: headingFor(biological), kind: biological.kind })
  else rows.push({ id: "new-biological", label: "+ New biological parents", kind: "biological_parents" })
  for (const block of blocks.filter((item) => item.kind === "parent_other" && item.parentSide === "mother")) {
    rows.push({ id: block.relationshipBlockId, label: headingFor(block), kind: block.kind })
  }
  rows.push({ id: "new-mother", label: "+ New mother's relationship", kind: "parent_other" })
  for (const block of blocks.filter((item) => item.kind === "parent_other" && item.parentSide === "father")) {
    rows.push({ id: block.relationshipBlockId, label: headingFor(block), kind: block.kind })
  }
  rows.push({ id: "new-father", label: "+ New father's relationship", kind: "parent_other" })
  for (const block of blocks.filter((item) => item.kind === "caregiver_arrangement")) rows.push({ id: block.relationshipBlockId, label: headingFor(block), kind: block.kind })
  rows.push({ id: "new-caregiver", label: "+ New caregiver arrangement", kind: "caregiver_arrangement" })
  const other = blocks.find((item) => item.kind === "client_other_children")
  if (other) rows.push({ id: other.relationshipBlockId, label: headingFor(other), kind: other.kind })
  else rows.push({ id: "new-other-children", label: "+ New other children", kind: "client_other_children" })
  return rows
}

const emptyDraft: PersonDraft = {
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

function draftFromPerson(person: RelationshipRecord): PersonDraft {
  return {
    givenName: person.givenName,
    sex: person.sex,
    dateOfBirth: person.dateOfBirth,
    blockRoleType: person.blockRoleType ?? person.childType ?? "",
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

function personFromDraft(person: RelationshipRecord, draft: PersonDraft): RelationshipRecord {
  const deceased = draft.healthStatus === "deceased" || (draft.deceased && draft.healthStatus === "")
  return {
    ...person,
    givenName: draft.givenName,
    sex: draft.sex as RelationshipRecord["sex"],
    dateOfBirth: draft.dateOfBirth,
    blockRoleType: draft.blockRoleType,
    childType: person.blockRole === "child" ? (draft.blockRoleType as RelationshipRecord["childType"]) : person.childType,
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

function blankBlock(kind: BlockKind): RelationshipBlock {
  return {
    relationshipBlockId: "",
    kind,
    parentRecordId: null,
    parentSide: "",
    status: "",
    statusDetail: "",
    arrangementType: "",
    arrangementDetail: "",
    startedOn: "",
    endedOn: "",
    noChildren: false,
    displayOrder: 0,
  }
}

function blankPerson(clientId: string): RelationshipRecord {
  return {
    relationshipRecordId: `new-${clientId}`,
    relationshipToClient: "current_partner",
    sex: "",
    givenName: "",
    displayOrder: 0,
    dateOfBirth: "",
    approximateAge: null,
    approximateAgeRecordedOn: "",
    healthStatus: "",
    deceased: false,
    ageAtDeath: null,
    dateOfDeath: "",
    healthOrCauseOfDeath: "",
    lengthOfRelationship: "",
    relationshipStatus: "",
    howEnded: "",
    laterRelationships: "",
    childType: "",
    childTypeDetail: "",
    timeSinceEnded: "",
    supportive: "",
    conflict: "",
    qualityOfRelationship: "",
    dependency: "",
    livingSituation: "",
    caregiverRelationship: "",
    caregiverRelationshipDetail: "",
    startedOn: "",
    endedOn: "",
    partnerType: "",
    parentType: "",
    adoptedOn: "",
    notKnown: false,
    otherParentKind: "",
    otherParentDetail: "",
    linkedPartnerRecordId: null,
    partnershipRecordId: null,
    relationshipBlockId: null,
    blockRole: "",
    blockRoleType: "",
    placementReview: "",
  }
}

function roleTitle(person: RelationshipRecord, block: RelationshipBlock | null): string {
  if (person.blockRole === "parent") {
    return person.blockRoleType === "father" || person.relationshipToClient === "father" ? "Father" : "Mother"
  }
  if (person.blockRole === "child") {
    if (person.sex === "Female") return "Daughter"
    if (person.sex === "Male") return "Son"
    return "Child"
  }
  if (person.blockRole === "sibling") {
    if (person.sex === "Female") return "Sister"
    if (person.sex === "Male") return "Brother"
    return "Sibling"
  }
  if (person.blockRole === "partner") {
    if (block?.kind === "parent_other") {
      if (person.sex === "Female") return "Step-mother"
      if (person.sex === "Male") return "Step-father"
      return "Partner"
    }
    if (block?.kind === "client_current" && block.status === "married") {
      if (person.sex === "Female") return "Wife"
      if (person.sex === "Male") return "Husband"
    }
    if (block?.kind === "client_previous") {
      if (person.sex === "Female") return "Woman"
      if (person.sex === "Male") return "Man"
    }
    return "Partner"
  }
  const detail = person.caregiverRelationshipDetail.trim()
  if (detail) return detail.slice(0, 1).toUpperCase() + detail.slice(1)
  return "Caregiver"
}

function nodeKey(node: RelationshipTreeNode, index: number): string {
  if (node.kind === "person" || node.kind === "block") return node.id
  if (node.kind === "note") return node.text
  return `${node.label}-${index}`
}

function snapshot(relationships: RelationshipRecord[], blocks: RelationshipBlock[]): string {
  return JSON.stringify({
    relationships: relationships.map((person) => [person.relationshipRecordId, person.givenName, person.relationshipBlockId, person.blockRole, person.blockRoleType, person.dateOfBirth, person.dateOfDeath, person.sex, person.healthStatus, person.deceased, person.notKnown, person.supportive, person.conflict, person.qualityOfRelationship, person.dependency, person.livingSituation]),
    blocks: blocks.map((block) => [block.relationshipBlockId, block.kind, block.status, block.startedOn, block.endedOn, block.arrangementType, block.noChildren, block.parentSide]),
  })
}
