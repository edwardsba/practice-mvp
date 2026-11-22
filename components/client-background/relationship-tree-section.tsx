"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

import {
  deleteRelationshipBlockAction,
  moveBlockMemberAction,
  removeBlockMemberAction,
  saveRelationshipPersonDraftAction,
  updateBlockMemberAction,
  updateRelationshipBlockAction,
} from "@/app/clients/[client_id]/background/actions"
import { AddToRelationshipMenu } from "@/components/client-background/add-to-relationship-menu"
import { DiscardChangesDialog } from "@/components/client-background/discard-changes-dialog"
import {
  NewRelationshipPanel,
  NEW_RELATIONSHIP_ENTRY_POINTS,
  type NewRelationshipDraftSave,
} from "@/components/client-background/new-relationship-panel"
import {
  NewPersonDraftForm,
  type NewPersonDraftFields,
} from "@/components/client-background/new-person-draft-form"
import { RelationshipEditFooter } from "@/components/client-background/relationship-edit-footer"
import {
  BlockFields,
  MoveStep,
  PanelHeader,
  PersonFields,
  RelationshipPanelShell,
  draftFromPerson,
  personFromDraft,
  statusLabel,
  typeOptionLabel,
  type PersonDraft,
} from "@/components/client-background/relationship-panel-shared"
import {
  TreeBranch,
  treeItemStateClassName,
  treeLayer1ClassName,
  treeLayer2MetaClassName,
  treeLayer2ShellClassName,
  treeLayer2TitleClassName,
  treeLayer3AvatarClassName,
  treeLayer3MetaClassName,
  treeLayer3ShellClassName,
  treeLayer3TitleClassName,
  treeLayer4AvatarClassName,
  treeLayer4MetaClassName,
  treeLayer4ShellClassName,
  treeLayer4TitleClassName,
  treeSelectedTitleClassName,
} from "@/components/client-background/tree-levels"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { relationshipLineSupportsAddMenu } from "@/lib/client-background/add-to-relationship"
import { isPartneredClientStatus } from "@/lib/client-background/relationship-blocks"
import {
  buildRelationshipTree,
  headingFor,
  linesAboutPerson,
  relationshipSectionAddSpec,
  relationshipSectionAllowsAdd,
  type RelationshipSectionAddSpec,
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
  createdBlockId?: string
  createdMemberId?: string
}

type Selection =
  | { type: "person"; id: string }
  | { type: "block"; id: string }
  | { type: "new_relationship_draft"; kind: BlockKind; parentSide?: "mother" | "father" }
  | { type: "new_person_draft"; blockId: string; role: BlockRole }

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
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  useEffect(() => setReady(true), [])
  useEffect(() => {
    if (!selection) return
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        requestClose()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // requestClose closes over selection/mode; rebind when those change.
  }, [selection, mode])

  function close() {
    setSelection(null)
    setMode("view")
    setError("")
    setConfirmDiscard(false)
  }

  function requestClose() {
    if (
      selection?.type === "new_relationship_draft" ||
      selection?.type === "new_person_draft" ||
      (selection?.type === "person" && mode === "edit") ||
      (selection?.type === "block" && mode === "edit")
    ) {
      setConfirmDiscard(true)
      return
    }
    close()
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
  const draftBlock =
    selection?.type === "new_person_draft"
      ? shownBlocks.find((item) => item.relationshipBlockId === selection.blockId)
      : undefined
  const lockedId = isPartneredClientStatus(relationshipStatus.relationshipStatus)
    ? shownBlocks.filter((item) => item.kind === "client_current").sort((a, b) => a.displayOrder - b.displayOrder)[0]
        ?.relationshipBlockId ?? null
    : null

  const selectedId =
    selection?.type === "person" || selection?.type === "block" ? selection.id : null

  /** Browser-only — no database write until Save. */
  function startNewRelationship(spec: RelationshipSectionAddSpec) {
    setSelection({
      type: "new_relationship_draft",
      kind: spec.kind,
      parentSide: spec.parentSide,
    })
    setMode("edit")
    setError("")
  }

  function startAddToRelationship(blockId: string, role: BlockRole) {
    setSelection({ type: "new_person_draft", blockId, role })
    setMode("edit")
    setError("")
  }

  async function saveNewRelationship(draft: NewRelationshipDraftSave) {
    const result = await apply(() =>
      saveRelationshipPersonDraftAction(clientId, {
        kind: draft.kind,
        parentSide: draft.parentSide,
        block: draft.block,
        person: {
          givenName: draft.person.givenName,
          sex: draft.person.sex,
          dateOfBirth: draft.person.dateOfBirth,
          blockRole: draft.kind === "caregiver_arrangement" ? "caregiver" : "partner",
          blockRoleType: draft.person.blockRoleType,
          livingSituation: draft.person.livingSituation,
          healthStatus: draft.person.healthStatus,
          deceased: draft.person.deceased,
          dateOfDeath: draft.person.dateOfDeath,
          supportive: draft.person.supportive,
          conflict: draft.person.conflict,
          qualityOfRelationship: draft.person.qualityOfRelationship,
          dependency: draft.person.dependency,
          notKnown: draft.person.notKnown,
        },
      })
    )
    if (result) close()
  }

  async function saveNewPerson(fields: NewPersonDraftFields, role: BlockRole, blockId: string) {
    const result = await apply(() =>
      saveRelationshipPersonDraftAction(clientId, {
        relationshipBlockId: blockId,
        person: {
          givenName: fields.givenName,
          sex: fields.sex,
          dateOfBirth: fields.dateOfBirth,
          blockRole: role,
          blockRoleType: fields.blockRoleType,
          livingSituation: fields.livingSituation,
        },
      })
    )
    if (result) close()
  }

  return (
    <div className="space-y-4" data-entry-point={NEW_RELATIONSHIP_ENTRY_POINTS.clientBackground}>
      <TreeCard
        title={tree.partners.title}
        nodes={tree.partners.children}
        blocks={shownBlocks}
        onAddSection={startNewRelationship}
        onPerson={openPerson}
        onBlock={openBlock}
        onAddToRelationship={startAddToRelationship}
        selectedId={selectedId}
      />
      <TreeCard
        title={tree.parents.title}
        nodes={tree.parents.children}
        blocks={shownBlocks}
        onAddSection={startNewRelationship}
        onPerson={openPerson}
        onBlock={openBlock}
        onAddToRelationship={startAddToRelationship}
        selectedId={selectedId}
      />
      {ready && selection
        ? createPortal(
            <RelationshipPanelShell
              ariaLabel={
                selection.type === "new_relationship_draft"
                  ? selection.kind === "caregiver_arrangement"
                    ? "New arrangement"
                    : "New relationship"
                  : selection.type === "new_person_draft"
                    ? selection.role === "child"
                      ? "New child"
                      : selection.role === "sibling"
                        ? "New sibling"
                        : "New partner"
                    : person?.givenName || block?.relationshipBlockId || "Relationship"
              }
              onDismiss={requestClose}
            >
              {selection.type === "new_relationship_draft" ? (
                <NewRelationshipPanel
                  key={`draft-${selection.kind}-${selection.parentSide ?? ""}`}
                  kind={selection.kind}
                  parentSide={selection.parentSide}
                  people={people}
                  locked={false}
                  error={error || null}
                  saving={saving}
                  onSave={(draft) => void saveNewRelationship(draft)}
                  onCancel={close}
                />
              ) : selection.type === "new_person_draft" && draftBlock ? (
                <NewPersonDraftForm
                  key={`person-draft-${selection.blockId}-${selection.role}`}
                  block={draftBlock}
                  people={people}
                  role={selection.role}
                  error={error || null}
                  saving={saving}
                  onSave={(fields) => void saveNewPerson(fields, selection.role, selection.blockId)}
                  onCancel={close}
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
                  onClose={requestClose}
                  onEdit={() => {
                    setMode("edit")
                    setError("")
                  }}
                  onStartMove={() => {
                    setMode("move")
                    setError("")
                  }}
                  onCancel={() => {
                    setMode("view")
                    setError("")
                  }}
                  onSave={async (draft) => {
                    const saved = await apply(() => updateBlockMemberAction(clientId, personFromDraft(person, draft)))
                    if (saved) setMode("view")
                  }}
                  onRemove={async () => {
                    const removed = await apply(() => removeBlockMemberAction(clientId, person.relationshipRecordId))
                    if (removed) close()
                  }}
                  onMove={async (destinationId, role, roleType) => {
                    const moved = await apply(() =>
                      moveBlockMemberAction(clientId, person.relationshipRecordId, destinationId, role, roleType)
                    )
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
                  onClose={requestClose}
                  onEdit={() => {
                    setMode("edit")
                    setError("")
                  }}
                  onCancel={() => {
                    setMode("view")
                    setError("")
                  }}
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
      <DiscardChangesDialog
        open={confirmDiscard}
        onKeepEditing={() => setConfirmDiscard(false)}
        onDiscard={close}
      />
    </div>
  )
}

function TreeCard({
  title,
  nodes,
  blocks,
  onAddSection,
  onPerson,
  onBlock,
  onAddToRelationship,
  selectedId,
}: {
  title: string
  nodes: RelationshipTreeNode[]
  blocks: RelationshipBlock[]
  onAddSection: (spec: RelationshipSectionAddSpec) => void
  onPerson: (id: string) => void
  onBlock: (id: string) => void
  onAddToRelationship: (blockId: string, role: BlockRole) => void
  selectedId: string | null
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {nodes.some((node) => node.kind === "section") ? (
          <div className="space-y-6">
            {nodes.map((node, index) =>
              node.kind === "section" ? (
                <div key={node.title} className="space-y-2">
                  <h3 className={treeLayer1ClassName}>{node.title}</h3>
                  {node.children.length > 0 ? (
                    <ConnectedList
                      nodes={node.children}
                      blocks={blocks}
                      personLayer={3}
                      onPerson={onPerson}
                      onBlock={onBlock}
                      onAddToRelationship={onAddToRelationship}
                      selectedId={selectedId}
                    />
                  ) : null}
                  {(() => {
                    const spec = relationshipSectionAddSpec(node.title)
                    if (!spec || !relationshipSectionAllowsAdd(node.children, { kind: spec.kind })) return null
                    return (
                      <button
                        type="button"
                        className="text-sm text-primary underline-offset-2 hover:underline"
                        onClick={() => onAddSection(spec)}
                      >
                        {spec.label}
                      </button>
                    )
                  })()}
                </div>
              ) : (
                <ConnectedList
                  key={nodeKey(node, index)}
                  nodes={[node]}
                  blocks={blocks}
                  personLayer={3}
                  onPerson={onPerson}
                  onBlock={onBlock}
                  onAddToRelationship={onAddToRelationship}
                  selectedId={selectedId}
                />
              )
            )}
          </div>
        ) : (
          <ConnectedList
            nodes={nodes}
            blocks={blocks}
            personLayer={3}
            onPerson={onPerson}
            onBlock={onBlock}
            onAddToRelationship={onAddToRelationship}
            selectedId={selectedId}
          />
        )}
      </CardContent>
    </Card>
  )
}

function BranchList({
  nodes,
  blocks,
  plainNotes = false,
  personLayer,
  onPerson,
  onBlock,
  onAddToRelationship,
  selectedId,
}: {
  nodes: RelationshipTreeNode[]
  blocks: RelationshipBlock[]
  plainNotes?: boolean
  personLayer: 3 | 4
  onPerson: (id: string) => void
  onBlock: (id: string) => void
  onAddToRelationship: (blockId: string, role: BlockRole) => void
  selectedId: string | null
}) {
  if (!plainNotes) {
    return (
      <ConnectedList
        nodes={nodes}
        blocks={blocks}
        personLayer={personLayer}
        onPerson={onPerson}
        onBlock={onBlock}
        onAddToRelationship={onAddToRelationship}
        selectedId={selectedId}
      />
    )
  }
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
          <ConnectedList
            key={`list-${index}`}
            nodes={part.nodes}
            blocks={blocks}
            personLayer={personLayer}
            onPerson={onPerson}
            onBlock={onBlock}
            onAddToRelationship={onAddToRelationship}
            selectedId={selectedId}
          />
        )
      )}
    </>
  )
}

function ConnectedList({
  nodes,
  blocks,
  personLayer,
  onPerson,
  onBlock,
  onAddToRelationship,
  selectedId,
}: {
  nodes: RelationshipTreeNode[]
  blocks: RelationshipBlock[]
  personLayer: 3 | 4
  onPerson: (id: string) => void
  onBlock: (id: string) => void
  onAddToRelationship: (blockId: string, role: BlockRole) => void
  selectedId: string | null
}) {
  return (
    <ul>
      {nodes.map((node, index) => {
        const isLast = index === nodes.length - 1
        const intoLayer = node.kind === "block" ? 2 : personLayer
        return (
          <TreeBranch key={nodeKey(node, index)} intoLayer={intoLayer} isLast={isLast}>
            {node.kind === "note" ? (
              <p className="flex min-h-10 items-center px-1 text-sm text-muted-foreground italic">{node.text}</p>
            ) : (
              <TreeNode
                node={node}
                blocks={blocks}
                personLayer={personLayer}
                onPerson={onPerson}
                onBlock={onBlock}
                onAddToRelationship={onAddToRelationship}
                selectedId={selectedId}
              />
            )}
          </TreeBranch>
        )
      })}
    </ul>
  )
}

function TreeNode({
  node,
  blocks,
  personLayer,
  onPerson,
  onBlock,
  onAddToRelationship,
  selectedId,
}: {
  node: Exclude<RelationshipTreeNode, { kind: "note" }>
  blocks: RelationshipBlock[]
  personLayer: 3 | 4
  onPerson: (id: string) => void
  onBlock: (id: string) => void
  onAddToRelationship: (blockId: string, role: BlockRole) => void
  selectedId: string | null
}) {
  if (node.kind === "person") {
    const [name, ...rest] = node.line.split(" · ")
    const selected = selectedId === node.id
    const layer4 = personLayer === 4
    return (
      <>
        <button
          type="button"
          aria-current={selected ? "true" : undefined}
          className={cn(
            layer4 ? treeLayer4ShellClassName : treeLayer3ShellClassName,
            treeItemStateClassName({ selected })
          )}
          onClick={() => onPerson(node.id)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                layer4 ? treeLayer4AvatarClassName : treeLayer3AvatarClassName,
                node.deceased ? "border-2 border-dashed border-[#a1a1aa]" : "bg-muted"
              )}
              aria-hidden
            >
              {node.initial}
            </span>
            <span
              className={cn(
                layer4 ? treeLayer4TitleClassName : treeLayer3TitleClassName,
                treeSelectedTitleClassName(selected),
                "min-w-0"
              )}
            >
              {name}
            </span>
          </span>
          {rest.length > 0 ? (
            <span
              className={cn(
                layer4 ? treeLayer4MetaClassName : treeLayer3MetaClassName,
                selected && "text-[#1e3a8a]",
                "w-full"
              )}
            >
              {rest.join(" · ")}
            </span>
          ) : null}
        </button>
        {node.children.length > 0 ? (
          <ConnectedList
            nodes={node.children}
            blocks={blocks}
            personLayer={4}
            onPerson={onPerson}
            onBlock={onBlock}
            onAddToRelationship={onAddToRelationship}
            selectedId={selectedId}
          />
        ) : null}
      </>
    )
  }
  if (node.kind === "section") return null
  if (node.kind === "block") {
    const selected = Boolean(node.id) && selectedId === node.id
    const realBlock = node.id ? blocks.find((item) => item.relationshipBlockId === node.id) : undefined
    const blockKind = realBlock?.kind ?? node.blockKind
    const showAdd = Boolean(node.id && blockKind && relationshipLineSupportsAddMenu(blockKind))
    const band = (
      <>
        <span className={cn(treeLayer2TitleClassName, treeSelectedTitleClassName(selected))}>{node.heading}</span>
        {node.meta ? (
          <span className={cn(treeLayer2MetaClassName, selected && "text-[#1e3a8a]")}>{node.meta}</span>
        ) : null}
      </>
    )
    const addMenu =
      showAdd && node.id && realBlock ? (
        <AddToRelationshipMenu block={realBlock} onSelect={(role) => onAddToRelationship(node.id, role)} />
      ) : null
    return (
      <>
        {node.interactive === false || !node.id ? (
          <div className={cn("flex items-start gap-2", treeLayer2ShellClassName, treeItemStateClassName({ interactive: false, square: true }))}>
            <div className="min-w-0 flex-1">{band}</div>
            {addMenu}
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <button
              type="button"
              aria-current={selected ? "true" : undefined}
              className={cn("min-w-0 flex-1", treeLayer2ShellClassName, treeItemStateClassName({ selected, square: true }))}
              onClick={() => onBlock(node.id)}
            >
              {band}
            </button>
            {addMenu}
          </div>
        )}
        {node.children.length > 0 ? (
          <BranchList
            nodes={node.children}
            blocks={blocks}
            personLayer={3}
            onPerson={onPerson}
            onBlock={onBlock}
            onAddToRelationship={onAddToRelationship}
            selectedId={selectedId}
          />
        ) : null}
      </>
    )
  }
  if (node.children.length === 0) {
    return node.empty ? <p className="flex min-h-10 items-center px-1 text-sm text-muted-foreground italic">{node.empty}</p> : null
  }
  return (
    <>
      <p className="flex min-h-10 items-center px-1 text-sm text-muted-foreground">{node.label}</p>
      <BranchList
        nodes={node.children}
        blocks={blocks}
        personLayer={personLayer}
        onPerson={onPerson}
        onBlock={onBlock}
        onAddToRelationship={onAddToRelationship}
        selectedId={selectedId}
      />
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
  const nodeName =
    person.notKnown && person.blockRole === "parent"
      ? person.blockRoleType === "father"
        ? "Father"
        : "Mother"
      : person.givenName.trim() || "Person"
  const context = block ? headingFor(block).split(" · ")[0] : "Not placed"
  const title = roleTitle(person, block)
  const history = events.filter(
    (event) => event.relationshipRecordId === person.relationshipRecordId && event.about === "significant_other"
  )
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
                          <span className="text-muted-foreground">
                            {" "}
                            · {EVENT_TYPE_LABELS[event.eventType as EventType] ?? event.eventType}
                          </span>
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
              <button
                type="button"
                className="inline-flex min-h-10 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground"
                onClick={onEdit}
              >
                Edit
              </button>
            </footer>
          ) : (
            <RelationshipEditFooter
              saving={saving}
              onRemove={() => void onRemove()}
              onCancel={onCancel}
              onSave={() => void onSave(draft)}
            />
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
                    <button
                      type="button"
                      className="flex min-h-10 w-full items-center text-left text-sm font-medium hover:underline"
                      onClick={() => onOpenPerson(person.relationshipRecordId)}
                    >
                      {person.givenName.trim() || "Unnamed"}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : (
          <BlockFields block={draft} locked={locked} showChildrenQuestion onChange={setDraft} />
        )}
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </div>
      {mode === "view" ? (
        <footer className="flex justify-end border-t p-4">
          <button
            type="button"
            className="inline-flex min-h-10 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground"
            onClick={onEdit}
          >
            Edit
          </button>
        </footer>
      ) : (
        <RelationshipEditFooter
          saving={saving}
          onRemove={removable ? () => void onRemove() : undefined}
          onCancel={onCancel}
          onSave={() => void onSave(draft)}
        />
      )}
    </>
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
    {
      label: "Living situation",
      value: person.livingSituation ? RELATIONSHIP_LIVING_SITUATION_LABELS[person.livingSituation] : "Not recorded",
    }
  )
  if (person.blockRole === "child" || person.blockRole === "sibling") {
    rows.push({ label: "Type", value: typeOptionLabel(person.blockRole, person.blockRoleType ?? "") || "Not recorded" })
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
    relationships: relationships.map((person) => [
      person.relationshipRecordId,
      person.givenName,
      person.relationshipBlockId,
      person.blockRole,
      person.blockRoleType,
      person.dateOfBirth,
      person.dateOfDeath,
      person.sex,
      person.healthStatus,
      person.deceased,
      person.notKnown,
      person.supportive,
      person.conflict,
      person.qualityOfRelationship,
      person.dependency,
      person.livingSituation,
    ]),
    blocks: blocks.map((block) => [
      block.relationshipBlockId,
      block.kind,
      block.status,
      block.startedOn,
      block.endedOn,
      block.arrangementType,
      block.childrenAnswer,
      block.parentSide,
    ]),
  })
}
