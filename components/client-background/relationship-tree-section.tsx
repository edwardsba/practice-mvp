"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

import {
  addBlockMemberAction,
  createRelationshipBlockAction,
  deleteRelationshipBlockAction,
  moveBlockMemberAction,
  removeBlockMemberAction,
  updateBlockMemberAction,
  updateRelationshipBlockAction,
} from "@/app/clients/[client_id]/background/actions"
import { SelectField } from "@/components/client-background/fields"
import {
  BlockFields,
  MoveStep,
  PanelHeader,
  PersonFields,
  ROLE_LABELS,
  RelationshipPanelShell,
  draftFromPerson,
  emptyPersonDraft,
  personFromDraft,
  statusLabel,
  typeOptionLabel,
  typesForRole,
  type PersonDraft,
} from "@/components/client-background/relationship-panel-shared"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { isPartneredClientStatus, rolesForBlock } from "@/lib/client-background/relationship-blocks"
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
  DEPENDENCY_LABELS,
  EVENT_TYPE_LABELS,
  HEALTH_STATUS_LABELS,
  RELATIONSHIP_LIVING_SITUATION_LABELS,
  RELATIONSHIP_RATING_LABELS,
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
    relationshipStatus,
  })
  const [selection, setSelection] = useState<Selection | null>(null)
  const [mode, setMode] = useState<"view" | "edit" | "move">("view")
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
            <RelationshipPanelShell
              ariaLabel={selection.type === "add" ? "Add a person" : person?.givenName || block?.relationshipBlockId || "Relationship"}
              onDismiss={close}
            >
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
                  onStartMove={() => { setMode("move"); setError("") }}
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
                    const moved = await apply(() => moveBlockMemberAction(clientId, person.relationshipRecordId, destinationId, role, roleType))
                    if (moved) setMode("view")
                  }}
                />
              ) : selection.type === "block" && block ? (
                <BlockPanel
                  block={block}
                  people={people.filter((item) => item.relationshipBlockId === block.relationshipBlockId)}
                  locked={block.relationshipBlockId === lockedId}
                  mode={mode === "move" ? "view" : mode}
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
            </RelationshipPanelShell>,
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
        {nodes.some((node) => node.kind === "section") ? (
          <div className="space-y-6">
            {nodes.map((node, index) =>
              node.kind === "section" ? (
                <div key={node.title}>
                  <h3 className="mb-2 text-sm font-semibold">{node.title}</h3>
                  {node.children.length > 0 ? <ConnectedList nodes={node.children} onPerson={onPerson} onBlock={onBlock} /> : null}
                </div>
              ) : (
                <ConnectedList key={nodeKey(node, index)} nodes={[node]} onPerson={onPerson} onBlock={onBlock} />
              )
            )}
          </div>
        ) : (
          <ConnectedList nodes={nodes} onPerson={onPerson} onBlock={onBlock} />
        )}
      </CardContent>
    </Card>
  )
}

function BranchList({
  nodes,
  plainNotes = false,
  onPerson,
  onBlock,
}: {
  nodes: RelationshipTreeNode[]
  plainNotes?: boolean
  onPerson: (id: string) => void
  onBlock: (id: string) => void
}) {
  if (!plainNotes) return <ConnectedList nodes={nodes} onPerson={onPerson} onBlock={onBlock} />
  const parts: ({ kind: "list"; nodes: Exclude<RelationshipTreeNode, { kind: "note" }>[] } | { kind: "note"; text: string })[] = []
  for (const node of nodes) {
    if (node.kind === "note") {
      parts.push({ kind: "note", text: node.text })
      continue
    }
    const last = parts[parts.length - 1]
    if (last?.kind === "list") last.nodes.push(node)
    else parts.push({ kind: "list", nodes: [node] })
  }
  return (
    <>
      {parts.map((part, index) =>
        part.kind === "note" ? (
          <p key={`${part.text}-${index}`} className="my-3 text-sm text-muted-foreground">
            {part.text}
          </p>
        ) : (
          <ConnectedList key={`list-${index}`} nodes={part.nodes} onPerson={onPerson} onBlock={onBlock} />
        )
      )}
    </>
  )
}

function ConnectedList({
  nodes,
  onPerson,
  onBlock,
}: {
  nodes: RelationshipTreeNode[]
  onPerson: (id: string) => void
  onBlock: (id: string) => void
}) {
  return (
    <ul>
      {nodes.map((node, index) => (
        <li key={nodeKey(node, index)} className="relative pl-4">
          <span
            aria-hidden
            className="absolute top-0 left-0 w-0.5 bg-[#a1a1aa]"
            style={{ height: index === nodes.length - 1 ? 20 : "100%" }}
          />
          <span aria-hidden className="absolute top-5 left-0 h-0.5 w-4 bg-[#a1a1aa]" />
          {node.kind === "note" ? (
            <p className="flex min-h-10 items-center px-1 text-sm text-muted-foreground italic">{node.text}</p>
          ) : (
            <TreeNode node={node} onPerson={onPerson} onBlock={onBlock} />
          )}
        </li>
      ))}
    </ul>
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
      <>
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
        {node.children.length > 0 ? <ConnectedList nodes={node.children} onPerson={onPerson} onBlock={onBlock} /> : null}
      </>
    )
  }
  if (node.kind === "section") return null
  if (node.kind === "block") {
    const band = (
      <>
        <span className="text-sm font-medium">{node.heading}</span>
        {node.meta ? <span className="text-xs text-muted-foreground">{node.meta}</span> : null}
      </>
    )
    return (
      <>
        {node.interactive === false || !node.id ? (
          <div className="flex min-h-10 w-full flex-col justify-center rounded-[8px] bg-[#f4f4f5] px-3 py-2">{band}</div>
        ) : (
          <button
            type="button"
            className="flex min-h-10 w-full flex-col justify-center rounded-[8px] bg-[#f4f4f5] px-3 py-2 text-left hover:bg-[#e4e4e7]"
            onClick={() => onBlock(node.id)}
          >
            {band}
          </button>
        )}
        {node.children.length > 0 ? <BranchList nodes={node.children} onPerson={onPerson} onBlock={onBlock} /> : null}
      </>
    )
  }
  if (node.children.length === 0) {
    return node.empty ? <p className="flex min-h-10 items-center px-1 text-sm text-muted-foreground italic">{node.empty}</p> : null
  }
  return (
    <>
      <p className="flex min-h-10 items-center px-1 text-sm text-muted-foreground">{node.label}</p>
      <BranchList nodes={node.children} onPerson={onPerson} onBlock={onBlock} />
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
  onStartMove,
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
  mode: "view" | "edit" | "move"
  saving: boolean
  error: string
  onClose: () => void
  onEdit: () => void
  onStartMove: () => void
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
      {mode === "move" ? (
        <MoveStep name={nodeName} person={person} blocks={blocks} people={people} saving={saving} error={error} onCancel={onCancel} onMove={onMove} />
      ) : (
      <>
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
        <footer className="flex items-center justify-end gap-2 border-t p-4">
          <button type="button" className="inline-flex min-h-10 items-center rounded-md border px-3 text-sm" onClick={onStartMove}>
            Move to…
          </button>
          <button type="button" className="inline-flex min-h-10 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground" onClick={onEdit}>
            Edit
          </button>
        </footer>
      ) : (
        <EditFooter saving={saving} onRemove={() => void onRemove()} onCancel={onCancel} onSave={() => void onSave(draft)} />
      )}
      </>
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
  const types = typesForRole(kind, safeRole, arrangement)
  const [draft, setDraft] = useState<PersonDraft>(emptyPersonDraft)
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
    childrenAnswer: "",
    siblingsAnswer: "",
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
    childType: "",
    childTypeDetail: "",
    supportive: "",
    conflict: "",
    qualityOfRelationship: "",
    dependency: "",
    livingSituation: "",
    caregiverRelationship: "",
    caregiverRelationshipDetail: "",
    notKnown: false,
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
  if (node.kind === "note") return `${node.text}-${index}`
  if (node.kind === "section") return node.title
  return `${node.label}-${index}`
}

function snapshot(relationships: RelationshipRecord[], blocks: RelationshipBlock[]): string {
  return JSON.stringify({
    relationships: relationships.map((person) => [person.relationshipRecordId, person.givenName, person.relationshipBlockId, person.blockRole, person.blockRoleType, person.dateOfBirth, person.dateOfDeath, person.sex, person.healthStatus, person.deceased, person.notKnown, person.supportive, person.conflict, person.qualityOfRelationship, person.dependency, person.livingSituation]),
    blocks: blocks.map((block) => [block.relationshipBlockId, block.kind, block.status, block.startedOn, block.endedOn, block.arrangementType, block.noChildren, block.parentSide]),
  })
}
