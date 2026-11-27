"use client"

import { useEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

import {
  deleteRelationshipBlockAction,
  moveBlockMemberAction,
  removeBlockMemberAction,
  saveRelationshipPersonDraftAction,
  updateBlockMemberAction,
  updateRelationshipBlockAction,
} from "@/app/clients/[client_id]/background/actions"
import { DiscardChangesDialog } from "@/components/client-background/discard-changes-dialog"
import { TreeAddControl, TreeLineRow } from "@/components/client-background/tree-add-control"
import {
  NewRelationshipPanel,
  NEW_RELATIONSHIP_ENTRY_POINTS,
  type NewRelationshipDraftSave,
} from "@/components/client-background/new-relationship-panel"
import { NewPersonDraftForm } from "@/components/client-background/new-person-draft-form"
import { RelationshipEditFooter } from "@/components/client-background/relationship-edit-footer"
import {
  BlockFields,
  MoveStep,
  PanelGroup,
  PersonAvatar,
  PersonCard,
  PersonFields,
  RelationshipPanelShell,
  draftFromPerson,
  personFromDraft,
  type PersonDraft,
} from "@/components/client-background/relationship-panel-shared"
import {
  PanelConnectedGroup,
  PanelInfoFields,
  SidePanelInfoFooter,
} from "@/components/client-background/panel-info-view"
import { personInfoGroups, relationshipInfoGroups } from "@/lib/client-background/panel-info"
import {
  TreeBranch,
  treeLayer1ClassName,
  treeLayer2MetaClassName,
  treeLayer2TitleClassName,
  treeLayer3AvatarClassName,
  treeLayer3MetaClassName,
  treeLayer3TitleClassName,
  treeLayer4AvatarClassName,
  treeLayer4MetaClassName,
  treeLayer4TitleClassName,
  treeSelectedTitleClassName,
} from "@/components/client-background/tree-levels"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { relationshipLineSupportsAddMenu } from "@/lib/client-background/add-to-relationship"
import {
  addChoicesForBlockKind,
  relationshipTreeAddChoices,
} from "@/lib/client-background/tree-add"
import { isPartneredClientStatus } from "@/lib/client-background/relationship-blocks"
import {
  partOfLine,
  personRoleLabel,
  relationshipPanelSubtitle,
  relationshipPanelTitle,
  relationshipViewGroups,
} from "@/lib/client-background/relationship-panel-display"
import {
  buildRelationshipTree,
  relationshipSectionAddSpec,
  relationshipSectionAllowsAdd,
  type RelationshipSectionAddSpec,
  type RelationshipTreeNode,
} from "@/lib/client-background/relationship-tree"
import { todayDateString } from "@/lib/dates/practice-time"
import {
  EVENT_TYPE_LABELS,
  type BlockKind,
  type BlockRole,
  type ClientRelationshipStatusValue,
  type EventRecord,
  type EventType,
  type RelationshipBlock,
  type RelationshipBlockAnswers,
  type RelationshipRecord,
} from "@/lib/client-background/types"
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
  clientName = "Client",
  relationships,
  blocks,
  blockAnswers,
  relationshipStatus,
  dateOfBirth,
  events,
}: {
  clientId: string
  clientName?: string
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

  function openPerson(id: string, nextMode: "view" | "edit" = "view") {
    setSelection({ type: "person", id })
    setMode(nextMode)
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

  async function saveNewPerson(fields: PersonDraft, role: BlockRole, blockId: string) {
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
          healthStatus: fields.healthStatus,
          deceased: fields.deceased,
          dateOfDeath: fields.dateOfDeath,
          supportive: fields.supportive,
          conflict: fields.conflict,
          qualityOfRelationship: fields.qualityOfRelationship,
          dependency: fields.dependency,
          notKnown: fields.notKnown,
        },
      })
    )
    if (result) close()
  }

  const personBlock =
    person != null
      ? shownBlocks.find((item) => item.relationshipBlockId === person.relationshipBlockId) ?? null
      : null
  const personDisplayName =
    person == null
      ? ""
      : person.notKnown && person.blockRole === "parent"
        ? person.blockRoleType === "father"
          ? "Father"
          : "Mother"
        : person.givenName.trim() || "Person"
  const panelShell = (() => {
    if (!selection) {
      return { ariaLabel: "Panel", title: "Panel", summary: undefined as string | undefined, leading: undefined as ReactNode }
    }
    if (selection.type === "new_relationship_draft") {
      const title = selection.kind === "caregiver_arrangement" ? "New arrangement" : "New relationship"
      return { ariaLabel: title, title, summary: undefined, leading: undefined }
    }
    if (selection.type === "new_person_draft") {
      const title =
        selection.role === "child" ? "New child" : selection.role === "sibling" ? "New sibling" : "New partner"
      return { ariaLabel: title, title, summary: undefined, leading: undefined }
    }
    if (selection.type === "person" && person) {
      const role = personRoleLabel(person, personBlock)
      const context = personBlock ? relationshipPanelTitle(personBlock) : "Not placed"
      return {
        ariaLabel: personDisplayName,
        title: personDisplayName,
        summary: `${role} · ${context}`,
        leading: (
          <PersonAvatar
            initial={personDisplayName.slice(0, 1).toUpperCase() || "?"}
            deceased={person.deceased || person.healthStatus === "deceased"}
          />
        ),
      }
    }
    if (selection.type === "block" && block) {
      const title = relationshipPanelTitle(block)
      return {
        ariaLabel: title,
        title,
        summary: relationshipPanelSubtitle(block),
        leading: undefined,
      }
    }
    return {
      ariaLabel: "Relationship",
      title: "Relationship",
      summary: undefined,
      leading: undefined,
    }
  })()

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
              ariaLabel={panelShell.ariaLabel}
              title={panelShell.title}
              summary={mode === "view" ? panelShell.summary : undefined}
              leading={mode === "view" ? panelShell.leading : undefined}
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
                  clientName={clientName}
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
                  onOpenBlock={(blockId) => openBlock(blockId)}
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
                  onOpenPerson={(id) => openPerson(id, mode === "edit" ? "edit" : "view")}
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
                  <div className="flex items-center gap-2">
                    <h3 className={cn(treeLayer1ClassName, "min-w-0 flex-1")}>{node.title}</h3>
                    {(() => {
                      const spec = relationshipSectionAddSpec(node.title)
                      if (!spec || !relationshipSectionAllowsAdd(node.children, { kind: spec.kind })) {
                        return null
                      }
                      const section =
                        spec.kind === "caregiver_arrangement"
                          ? "arrangement"
                          : spec.kind === "client_other_children"
                            ? "other_children"
                            : "relationship"
                      const choices = relationshipTreeAddChoices({ type: "heading", section })
                      if (!choices) return null
                      return (
                        <TreeAddControl
                          choices={choices}
                          aria-label={`Add under ${node.title}`}
                          onSelect={() => onAddSection(spec)}
                        />
                      )
                    })()}
                  </div>
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
    const layer: 3 | 4 = layer4 ? 4 : 3
    return (
      <>
        <TreeLineRow layer={layer} selected={selected} onOpen={() => onPerson(node.id)}>
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
                treeSelectedTitleClassName(selected),
                "w-full"
              )}
            >
              {rest.join(" · ")}
            </span>
          ) : null}
        </TreeLineRow>
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
    const addChoices =
      showAdd && blockKind ? addChoicesForBlockKind(blockKind) : null
    return (
      <>
        <TreeLineRow
          layer={2}
          selected={selected}
          interactive={node.interactive !== false && Boolean(node.id)}
          onOpen={node.id ? () => onBlock(node.id) : undefined}
          addChoices={addChoices}
          addAriaLabel="Add to this relationship"
          onAdd={
            node.id
              ? (choiceId) => onAddToRelationship(node.id, choiceId as BlockRole)
              : undefined
          }
        >
          <span className={cn(treeLayer2TitleClassName, treeSelectedTitleClassName(selected))}>
            {node.heading}
          </span>
          {node.meta ? (
            <span className={cn(treeLayer2MetaClassName, treeSelectedTitleClassName(selected))}>
              {node.meta}
            </span>
          ) : null}
        </TreeLineRow>
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
  clientName,
  mode,
  saving,
  error,
  onClose,
  onEdit,
  onStartMove,
  onCancel,
  onOpenBlock,
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
  clientName: string
  mode: "view" | "edit" | "move"
  saving: boolean
  error: string
  onClose: () => void
  onEdit: () => void
  onStartMove: () => void
  onCancel: () => void
  onOpenBlock: (blockId: string) => void
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
  const history = events.filter(
    (event) => event.relationshipRecordId === person.relationshipRecordId && event.about === "significant_other"
  )
  const partOf = partOfLine(person, block, people, clientName)
  void dateOfBirth
  void onClose
  const infoGroups = personInfoGroups(person, { asOf: todayDateString() })
  const connectedLinks = block
    ? [{ id: `part-of-${block.relationshipBlockId}`, label: `Part of: ${partOf}`, onOpen: () => onOpenBlock(block.relationshipBlockId) }]
    : []
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {mode === "move" ? (
        <MoveStep name={nodeName} person={person} blocks={blocks} people={people} saving={saving} error={error} onCancel={onCancel} onMove={onMove} />
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {mode === "view" ? (
              <div>
                <PanelInfoFields groups={infoGroups} />
                <PanelConnectedGroup
                  index={infoGroups.length}
                  links={connectedLinks}
                  empty={block ? undefined : "Not placed"}
                />
                {history.length > 0 ? (
                  <PanelGroup title={`History about ${nodeName}`} index={infoGroups.length + 1}>
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
                  </PanelGroup>
                ) : null}
              </div>
            ) : (
              <PersonFields
                idPrefix={person.relationshipRecordId}
                person={person}
                block={block}
                draft={draft}
                onChange={setDraft}
              />
            )}
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          </div>
          {mode === "view" ? (
            <div className="border-t">
              <SidePanelInfoFooter
                onEdit={onEdit}
                extra={
                  <button type="button" className="inline-flex min-h-10 items-center rounded-md border px-3 text-sm" onClick={onStartMove}>
                    Move to…
                  </button>
                }
              />
            </div>
          ) : (
            <div className="border-t">
              <RelationshipEditFooter
                saving={saving}
                onRemove={() => void onRemove()}
                onCancel={onCancel}
                onSave={() => void onSave(draft)}
              />
            </div>
          )}
        </>
      )}
    </div>
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
  const groups = relationshipViewGroups(block.kind)
  const infoGroups = relationshipInfoGroups(block)
  void onClose

  function peopleForRole(role: BlockRole) {
    return people
      .filter((person) => person.blockRole === role)
      .sort((a, b) => a.displayOrder - b.displayOrder)
  }

  const connectedPeople = people
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((person) => {
      const name =
        person.notKnown && person.blockRole === "parent"
          ? person.blockRoleType === "father"
            ? "Father"
            : "Mother"
          : person.givenName.trim() || "Unnamed"
      const role = personRoleLabel(person, block)
      return {
        id: person.relationshipRecordId,
        label: `${role}: ${name}`,
        onOpen: () => onOpenPerson(person.relationshipRecordId),
      }
    })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {mode === "view" ? (
          <div>
            <PanelInfoFields groups={infoGroups} />
            <PanelConnectedGroup index={infoGroups.length} links={connectedPeople} empty="None recorded" />
          </div>
        ) : (
          <div>
            {groups.map((group, index) => {
              if (group.role == null) {
                return (
                  <PanelGroup key={group.id} title={group.label} index={index}>
                    <BlockFields
                      block={draft}
                      locked={locked}
                      showChildrenQuestion={
                        block.kind === "client_current" || block.kind === "client_previous"
                      }
                      onChange={setDraft}
                    />
                  </PanelGroup>
                )
              }
              const members = peopleForRole(group.role)
              const isPartnerOrCaregiver = group.role === "partner" || group.role === "caregiver"
              const isChildren = group.role === "child"
              return (
                <PanelGroup key={group.id} title={group.label} index={index}>
                  {isPartnerOrCaregiver ? (
                    <>
                      {members.length > 0 ? (
                        <ul className="space-y-2">
                          {members.map((person) => (
                            <li key={person.relationshipRecordId}>
                              <PersonCard
                                person={person}
                                block={block}
                                onOpen={() => onOpenPerson(person.relationshipRecordId)}
                              />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">None recorded</p>
                      )}
                      <p className="mt-3 text-sm text-muted-foreground">
                        Full details (health, living situation, quality of relationship) are on the person&apos;s own
                        form.
                      </p>
                    </>
                  ) : isChildren || group.role === "sibling" || group.role === "parent" ? (
                    members.length > 0 ? (
                      <ul className="space-y-2">
                        {members.map((person) => (
                          <li key={person.relationshipRecordId}>
                            <PersonCard
                              person={person}
                              block={block}
                              onOpen={() => onOpenPerson(person.relationshipRecordId)}
                            />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {isChildren
                          ? "Add children after saving, with + on the relationship line."
                          : "None recorded"}
                      </p>
                    )
                  ) : null}
                </PanelGroup>
              )
            })}
          </div>
        )}
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </div>
      {mode === "view" ? (
        <div className="border-t">
          <SidePanelInfoFooter onEdit={onEdit} />
        </div>
      ) : (
        <div className="border-t">
          <RelationshipEditFooter
            saving={saving}
            onRemove={removable ? () => void onRemove() : undefined}
            onCancel={onCancel}
            onSave={() => void onSave(draft)}
          />
        </div>
      )}
    </div>
  )
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
