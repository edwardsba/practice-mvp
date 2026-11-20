"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

import {
  addBlockMemberAction,
  createRelationshipBlockAction,
  deleteRelationshipBlockAction,
  moveBlockMemberAction,
  removeBlockMemberAction,
  saveRelationshipStatusBlockAction,
  setRelationshipBlockAnswerAction,
  updateBlockMemberAction,
  updateRelationshipBlockAction,
} from "@/app/clients/[client_id]/background/actions"
import { ClientAnswer, SelectField, TextField } from "@/components/client-background/fields"
import type { SavePhase } from "@/components/client-background/interview-autosave"
import { InterviewSectionCard, needsBadge } from "@/components/client-background/interview-section-card"
import {
  BlockFields,
  MoveStep,
  PanelHeader,
  PersonFields,
  RelationshipPanelShell,
  ROLE_LABELS,
  draftFromPerson,
  personFromDraft,
  statusLabel,
  type PersonDraft,
} from "@/components/client-background/relationship-panel-shared"
import {
  TreeBranch,
  TreeInlineSelect,
  treeItemStateClassName,
  treeLayer1ClassName,
  treeLayer2ShellClassName,
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
import type { AppliedAnswer } from "@/lib/background-questionnaire/to-client-background"
import {
  isPartneredClientStatus,
  needLabel,
  needsForBlock,
  needsForMember,
  previousBlocksInOrder,
  siblingTypesForBlock,
  statusesForBlock,
} from "@/lib/client-background/relationship-blocks"
import { relationshipDuration } from "@/lib/reports/relationship-block-report"
import { todayDateString } from "@/lib/dates/practice-time"
import {
  ARRANGEMENT_TYPE_LABELS,
  BLOCK_ANSWER_LABELS,
  BLOCK_ANSWERS,
  CLIENT_RELATIONSHIP_STATUSES,
  CLIENT_RELATIONSHIP_STATUS_LABELS,
  emptyBlockAnswers,
  type BlockAnswer,
  type BlockKind,
  type BlockRole,
  type ClientRelationshipStatus,
  type ClientRelationshipStatusValue,
  type RelationshipBlock,
  type RelationshipBlockAnswers,
  type RelationshipRecord,
} from "@/lib/client-background/types"
import { cn } from "@/lib/utils"

type EditorState = {
  relationships?: RelationshipRecord[]
  blocks?: RelationshipBlock[]
  blockAnswers?: RelationshipBlockAnswers
  relationshipStatus?: { relationshipStatus: string; relationshipStatusOther: string }
  error?: string
}

type Selection =
  | { type: "person"; id: string; addAnotherRole?: BlockRole }
  | { type: "block"; id: string }
  | { type: "move"; id: string }

const linkClass = "text-sm text-primary underline-offset-2 hover:underline"

function Needs({ need }: { need: string }) {
  return <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-950">{need}</span>
}

function resolvedChildrenAnswer(block: RelationshipBlock): BlockAnswer | "" {
  if (block.childrenAnswer === "yes" || block.childrenAnswer === "none" || block.childrenAnswer === "not_asked") {
    return block.childrenAnswer
  }
  if (block.noChildren) return "none"
  return ""
}

function resolvedSiblingsAnswer(block: RelationshipBlock): BlockAnswer | "" {
  if (block.siblingsAnswer === "yes" || block.siblingsAnswer === "none" || block.siblingsAnswer === "not_asked") {
    return block.siblingsAnswer
  }
  return ""
}

function membersOf(block: RelationshipBlock, people: RelationshipRecord[], role: BlockRole) {
  return people
    .filter((person) => person.relationshipBlockId === block.relationshipBlockId && person.blockRole === role)
    .sort((a, b) => a.displayOrder - b.displayOrder)
}

function parentRank(person: RelationshipRecord): number {
  if (person.blockRoleType === "mother" || person.relationshipToClient === "mother") return 0
  if (person.blockRoleType === "father" || person.relationshipToClient === "father") return 1
  return 2
}

function yearSpan(block: RelationshipBlock): string {
  const year = (value: string) => /^(\d{4})/.exec(value.trim())?.[1] ?? ""
  const start = year(block.startedOn)
  const end = year(block.endedOn)
  if (start && end && block.endedOn.trim() && block.kind !== "client_current") return `${start}–${end}`
  if (start && (block.kind === "client_current" || !block.endedOn.trim())) return `since ${start}`
  if (start) return start
  if (end) return `until ${end}`
  return ""
}

function blockMeta(block: RelationshipBlock): string {
  const span = yearSpan(block)
  if (block.kind === "client_current" || block.kind === "client_previous") {
    const duration = relationshipDuration(
      block.startedOn,
      block.kind === "client_current" ? "" : block.endedOn,
      todayDateString()
    )
    return [span, duration].filter(Boolean).join(" · ")
  }
  return span
}

function intimateUnplaced(person: RelationshipRecord): boolean {
  if (person.blockRole === "partner" || person.blockRole === "child") return true
  return (
    person.relationshipToClient === "current_partner" ||
    person.relationshipToClient === "prior_partner" ||
    person.relationshipToClient === "child_biological" ||
    person.relationshipToClient === "child_step"
  )
}

function countCardNeeds(
  blocks: RelationshipBlock[],
  people: RelationshipRecord[],
  lockedId: string | null
): number {
  let count = 0
  for (const block of blocks) {
    count += needsForBlock(block, block.relationshipBlockId === lockedId).length
    for (const person of people.filter((item) => item.relationshipBlockId === block.relationshipBlockId)) {
      count += needsForMember(block, person).length
    }
  }
  return count
}

function AnswerSelect({
  id,
  label,
  value,
  locked,
  onChange,
  inline = false,
}: {
  id: string
  label: string
  value: BlockAnswer | ""
  locked: boolean
  onChange: (value: BlockAnswer) => void
  inline?: boolean
}) {
  if (inline) {
    return (
      <TreeInlineSelect
        id={id}
        label={label}
        value={value || ""}
        disabled={locked && value === "yes"}
        onChange={(next) => {
          if (!next) return
          if (locked && next !== "yes") return
          onChange(next as BlockAnswer)
        }}
      >
        <option value="">Select…</option>
        {BLOCK_ANSWERS.map((option) => (
          <option key={option} value={option} disabled={locked && option !== "yes"}>
            {BLOCK_ANSWER_LABELS[option]}
          </option>
        ))}
      </TreeInlineSelect>
    )
  }
  return (
    <SelectField
      id={id}
      label={label}
      value={value || ""}
      disabled={locked && value === "yes"}
      onChange={(next) => {
        if (!next) return
        if (locked && next !== "yes") return
        onChange(next as BlockAnswer)
      }}
    >
      <option value="">Select…</option>
      {BLOCK_ANSWERS.map((option) => (
        <option key={option} value={option} disabled={locked && option !== "yes"}>
          {BLOCK_ANSWER_LABELS[option]}
        </option>
      ))}
    </SelectField>
  )
}

const layer2BandClassName = cn(treeLayer2ShellClassName, "space-y-2")

export function RelationshipBlocksSection({
  clientId,
  relationships,
  blocks,
  blockAnswers,
  relationshipStatus,
  onRelationships,
  onBlocks,
  onBlockAnswers,
  onRelationshipStatus,
  onPhase,
  registerFlush,
  relationshipClient,
  childrenPrompt,
  sectionOpen,
  onToggleSection,
  sectionBadge,
}: {
  clientId: string
  relationships: RelationshipRecord[]
  blocks?: RelationshipBlock[]
  blockAnswers?: RelationshipBlockAnswers
  relationshipStatus: ClientRelationshipStatusValue
  onRelationships?: (relationships: RelationshipRecord[]) => void
  onBlocks?: (blocks: RelationshipBlock[]) => void
  onBlockAnswers?: (answers: RelationshipBlockAnswers) => void
  onRelationshipStatus?: (status: ClientRelationshipStatusValue) => void
  onPhase?: (id: string, phase: SavePhase, retry: (() => void) | null) => void
  registerFlush?: (flush: () => Promise<void>) => () => void
  relationshipClient?: AppliedAnswer<ClientRelationshipStatusValue>
  childrenPrompt?: string | null
  /** Optional controlled open state from the interview page Open all / Close all. */
  sectionOpen?: { intimate: boolean; caregivers: boolean }
  onToggleSection?: (id: "intimate" | "caregivers") => void
  sectionBadge?: { intimate: string; caregivers: string }
}) {
  const [people, setPeople] = useState(relationships)
  const [blockList, setBlockList] = useState(blocks ?? [])
  const [answers, setAnswers] = useState(blockAnswers ?? emptyBlockAnswers())
  const [status, setStatus] = useState(relationshipStatus)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [intimateOpenLocal, setIntimateOpenLocal] = useState(false)
  const [caregiversOpenLocal, setCaregiversOpenLocal] = useState(false)
  const intimateOpen = sectionOpen?.intimate ?? intimateOpenLocal
  const caregiversOpen = sectionOpen?.caregivers ?? caregiversOpenLocal
  const portalReady = typeof document !== "undefined"
  const inflight = useRef<Promise<void> | null>(null)
  const personTimer = useRef<number | null>(null)
  const blockTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!registerFlush) return
    return registerFlush(() => inflight.current ?? Promise.resolve())
  }, [registerFlush])
  useEffect(() => {
    if (!selection) return
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSelection(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selection])
  useEffect(
    () => () => {
      if (personTimer.current) window.clearTimeout(personTimer.current)
      if (blockTimer.current) window.clearTimeout(blockTimer.current)
    },
    []
  )

  function apply(result: EditorState | null) {
    if (!result || !result.relationships || !result.blocks || !result.blockAnswers) {
      setError(result && "error" in result && result.error ? result.error : "Could not save.")
      return false
    }
    setPeople(result.relationships)
    setBlockList(result.blocks)
    setAnswers(result.blockAnswers)
    if (result.relationshipStatus) {
      const nextStatus = {
        relationshipStatus: result.relationshipStatus.relationshipStatus as ClientRelationshipStatus | "",
        relationshipStatusOther: result.relationshipStatus.relationshipStatusOther,
      }
      setStatus(nextStatus)
      onRelationshipStatus?.(nextStatus)
    }
    onRelationships?.(result.relationships)
    onBlocks?.(result.blocks)
    onBlockAnswers?.(result.blockAnswers)
    setError(null)
    return true
  }

  function run(work: () => Promise<EditorState | null>): Promise<EditorState | null> {
    const task = (async () => {
      onPhase?.("relationships", "saving", null)
      const result = await work()
      const ok = apply(result)
      onPhase?.("relationships", ok ? "saved" : "error", ok ? null : () => void run(work))
      return ok ? result : null
    })()
    inflight.current = task.then(() => undefined)
    return task
  }

  const currentBlocks = blockList
    .filter((block) => block.kind === "client_current")
    .sort((a, b) => a.displayOrder - b.displayOrder)
  const lockedId = isPartneredClientStatus(status.relationshipStatus)
    ? currentBlocks[0]?.relationshipBlockId ?? null
    : null
  const previous = previousBlocksInOrder(blockList)
  const otherChildren = blockList
    .filter((block) => block.kind === "client_other_children")
    .sort((a, b) => a.displayOrder - b.displayOrder)
  const biological = blockList.find((block) => block.kind === "biological_parents")
  const motherOther = blockList
    .filter((block) => block.kind === "parent_other" && block.parentSide === "mother")
    .sort((a, b) => {
      const ongoing = Number(!a.endedOn.trim()) - Number(!b.endedOn.trim())
      if (ongoing) return -ongoing
      return (b.startedOn.trim() || b.endedOn.trim()).localeCompare(a.startedOn.trim() || a.endedOn.trim())
    })
  const fatherOther = blockList
    .filter((block) => block.kind === "parent_other" && block.parentSide === "father")
    .sort((a, b) => {
      const ongoing = Number(!a.endedOn.trim()) - Number(!b.endedOn.trim())
      if (ongoing) return -ongoing
      return (b.startedOn.trim() || b.endedOn.trim()).localeCompare(a.startedOn.trim() || a.endedOn.trim())
    })
  const caregivers = blockList
    .filter((block) => block.kind === "caregiver_arrangement")
    .sort((a, b) => (b.startedOn.trim() || b.endedOn.trim()).localeCompare(a.startedOn.trim() || a.endedOn.trim()))

  const placed = new Set(blockList.map((block) => block.relationshipBlockId))
  const unplaced = people.filter((person) => !person.relationshipBlockId || !placed.has(person.relationshipBlockId))
  const unplacedIntimate = unplaced.filter(intimateUnplaced)
  const unplacedCaregivers = unplaced.filter((person) => !intimateUnplaced(person))

  const intimateBlocks = [...currentBlocks, ...previous, ...otherChildren]
  const caregiverBlocks = [
    ...(biological ? [biological] : []),
    ...motherOther,
    ...fatherOther,
    ...caregivers,
  ]
  const intimateNeeds =
    countCardNeeds(intimateBlocks, people, lockedId) + unplacedIntimate.length
  const caregiverNeeds =
    countCardNeeds(caregiverBlocks, people, null) + unplacedCaregivers.length
  const intimateBadge = sectionBadge?.intimate ?? needsBadge(intimateNeeds)
  const caregiversBadge = sectionBadge?.caregivers ?? needsBadge(caregiverNeeds)

  const recordedChildren = people.filter(
    (person) =>
      person.blockRole === "child" ||
      person.relationshipToClient === "child_biological" ||
      person.relationshipToClient === "child_step"
  ).length

  const selectedPerson =
    selection?.type === "person" || selection?.type === "move"
      ? people.find((item) => item.relationshipRecordId === selection.id)
      : undefined
  const selectedBlock =
    selection?.type === "block" ? blockList.find((item) => item.relationshipBlockId === selection.id) : undefined

  function closePanel() {
    setSelection(null)
    setError(null)
  }

  function openPerson(id: string, addAnotherRole?: BlockRole) {
    setSelection({ type: "person", id, addAnotherRole })
    setError(null)
  }

  function openBlock(id: string) {
    setSelection({ type: "block", id })
    setError(null)
  }

  async function addPerson(blockId: string, role: BlockRole, roleType = "") {
    const before = people.map((item) => item.relationshipRecordId)
    const result = await run(() => addBlockMemberAction(clientId, blockId, role, roleType))
    const created = result?.relationships?.find((item) => !before.includes(item.relationshipRecordId))
    if (created) openPerson(created.relationshipRecordId, role)
  }

  async function addBlock(kind: BlockKind, options?: { parentSide?: "mother" | "father" }) {
    const before = blockList.map((item) => item.relationshipBlockId)
    const result = await run(() => createRelationshipBlockAction(clientId, kind, options))
    const created = result?.blocks?.find((item) => !before.includes(item.relationshipBlockId))
    if (created) openBlock(created.relationshipBlockId)
  }

  function schedulePersonSave(person: RelationshipRecord, draft: PersonDraft) {
    if (personTimer.current) window.clearTimeout(personTimer.current)
    personTimer.current = window.setTimeout(() => {
      void run(() => updateBlockMemberAction(clientId, personFromDraft(person, draft)))
    }, 400)
  }

  function scheduleBlockSave(draft: RelationshipBlock) {
    if (blockTimer.current) window.clearTimeout(blockTimer.current)
    blockTimer.current = window.setTimeout(() => {
      void run(() => updateRelationshipBlockAction(clientId, draft))
    }, 400)
  }

  async function flushPersonSave(person: RelationshipRecord, draft: PersonDraft) {
    if (personTimer.current) {
      window.clearTimeout(personTimer.current)
      personTimer.current = null
    }
    return run(() => updateBlockMemberAction(clientId, personFromDraft(person, draft)))
  }

  async function addAnother(person: RelationshipRecord, role: BlockRole, draft: PersonDraft) {
    const blockId = person.relationshipBlockId
    if (!blockId) return
    await flushPersonSave(person, draft)
    const defaultType =
      role === "sibling"
        ? siblingTypesForBlock(blockList.find((item) => item.relationshipBlockId === blockId)?.kind ?? "biological_parents")[0] ??
          ""
        : role === "child"
          ? "biological"
          : role === "parent"
            ? "mother"
            : ""
    await addPerson(blockId, role, defaultType)
  }

  const motherName =
    biological &&
    membersOf(biological, people, "parent").find(
      (item) => item.blockRoleType === "mother" || item.relationshipToClient === "mother"
    )?.givenName.trim()
  const fatherName =
    biological &&
    membersOf(biological, people, "parent").find(
      (item) => item.blockRoleType === "father" || item.relationshipToClient === "father"
    )?.givenName.trim()
  const selectedId =
    selection?.type === "person" || selection?.type === "block" || selection?.type === "move"
      ? selection.id
      : null

  return (
    <>
      <InterviewSectionCard
        id="check-relationships-intimate"
        title="Intimate relationships and children"
        open={intimateOpen}
        onToggle={() =>
          onToggleSection ? onToggleSection("intimate") : setIntimateOpenLocal((open) => !open)
        }
        badge={intimateBadge}
      >
        <div id="check-relationships" className="space-y-6">
          {error && !selection ? <p className="text-sm text-destructive">{error}</p> : null}
          <section className="space-y-3">
            <h3 className={treeLayer1ClassName}>Current intimate relationship and children</h3>
            {childrenPrompt ? (
              <p className="text-sm text-blue-800">
                Client: {childrenPrompt} · {recordedChildren} recorded
              </p>
            ) : null}
            {currentBlocks.length === 0 ? (
              <div className={layer2BandClassName}>
                <ClientStatusSelect
                  status={status}
                  relationshipClient={relationshipClient}
                  onChange={(next) => {
                    setStatus(next)
                    void run(() => saveRelationshipStatusBlockAction(clientId, next))
                  }}
                />
              </div>
            ) : (
              currentBlocks.map((block, index) => (
                <CurrentBlockTree
                  key={block.relationshipBlockId}
                  block={block}
                  people={people}
                  locked={block.relationshipBlockId === lockedId}
                  statusSource={index === 0}
                  clientStatus={status}
                  relationshipClient={relationshipClient}
                  selectedId={selectedId}
                  onClientStatus={(next) => {
                    setStatus(next)
                    void run(() => saveRelationshipStatusBlockAction(clientId, next))
                  }}
                  onBlockStatus={(nextStatus) =>
                    void run(() => updateRelationshipBlockAction(clientId, { ...block, status: nextStatus }))
                  }
                  onOpenBlock={() => openBlock(block.relationshipBlockId)}
                  onOpenPerson={openPerson}
                  onAddPartner={() => void addPerson(block.relationshipBlockId, "partner")}
                  onAddChild={() => void addPerson(block.relationshipBlockId, "child", "biological")}
                  onChildrenAnswer={(childrenAnswer) =>
                    void run(() =>
                      updateRelationshipBlockAction(clientId, {
                        ...block,
                        childrenAnswer,
                        noChildren: childrenAnswer === "none",
                      })
                    )
                  }
                />
              ))
            )}
            {isPartneredClientStatus(status.relationshipStatus) || currentBlocks.length > 0 ? (
              <button type="button" className={linkClass} onClick={() => void addBlock("client_current")}>
                {currentBlocks.length > 0 ? "+ Add another current relationship" : "+ Add current relationship"}
              </button>
            ) : null}
          </section>

          <section className="space-y-3">
            <AnswerSelect
              id="previous_relationships_answer"
              label="Previous significant relationships"
              value={previous.length > 0 ? "yes" : answers.previousRelationships || ""}
              locked={previous.length > 0}
              onChange={(value) => void run(() => setRelationshipBlockAnswerAction(clientId, "previousRelationships", value))}
            />
            {(previous.length > 0 || answers.previousRelationships === "yes") &&
              previous.map((block) => (
                <PreviousBlockTree
                  key={block.relationshipBlockId}
                  block={block}
                  people={people}
                  selectedId={selectedId}
                  onOpenBlock={() => openBlock(block.relationshipBlockId)}
                  onOpenPerson={openPerson}
                  onStatus={(statusValue) =>
                    void run(() => updateRelationshipBlockAction(clientId, { ...block, status: statusValue }))
                  }
                  onAddPartner={() => void addPerson(block.relationshipBlockId, "partner")}
                  onAddChild={() => void addPerson(block.relationshipBlockId, "child", "biological")}
                  onChildrenAnswer={(childrenAnswer) =>
                    void run(() =>
                      updateRelationshipBlockAction(clientId, {
                        ...block,
                        childrenAnswer,
                        noChildren: childrenAnswer === "none",
                      })
                    )
                  }
                />
              ))}
            {answers.previousRelationships !== "none" ? (
              <button type="button" className={linkClass} onClick={() => void addBlock("client_previous")}>
                + Add previous relationship
              </button>
            ) : null}
          </section>

          <section className="space-y-3">
            <AnswerSelect
              id="other_children_answer"
              label="Other children"
              value={otherChildren.length > 0 ? "yes" : answers.otherChildren || ""}
              locked={otherChildren.length > 0}
              onChange={(value) => void run(() => setRelationshipBlockAnswerAction(clientId, "otherChildren", value))}
            />
            {(otherChildren.length > 0 || answers.otherChildren === "yes") &&
              otherChildren.map((block) => (
                <OtherChildrenTree
                  key={block.relationshipBlockId}
                  block={block}
                  people={people}
                  selectedId={selectedId}
                  onOpenPerson={openPerson}
                  onStatusDetail={(statusDetail) => {
                    const next = { ...block, statusDetail }
                    void run(() => updateRelationshipBlockAction(clientId, next))
                  }}
                  onAddChild={() => void addPerson(block.relationshipBlockId, "child", "biological")}
                />
              ))}
            {answers.otherChildren === "yes" || otherChildren.length > 0 ? (
              <button type="button" className={linkClass} onClick={() => void addBlock("client_other_children")}>
                + Add relationship
              </button>
            ) : null}
          </section>

          {unplacedIntimate.length > 0 ? (
            <UnplacedGroup people={unplacedIntimate} onOpenPerson={openPerson} onMove={(id) => setSelection({ type: "move", id })} />
          ) : null}
        </div>
      </InterviewSectionCard>

      <InterviewSectionCard
        id="check-relationships-caregivers"
        title="Primary caregivers and siblings"
        open={caregiversOpen}
        onToggle={() =>
          onToggleSection ? onToggleSection("caregivers") : setCaregiversOpenLocal((open) => !open)
        }
        badge={caregiversBadge}
      >
        <div className="space-y-6">
          {biological ? (
            <ParentsBlockTree
              block={biological}
              people={people}
              selectedId={selectedId}
              onOpenBlock={() => openBlock(biological.relationshipBlockId)}
              onOpenPerson={openPerson}
              onStatus={(statusValue) =>
                void run(() => updateRelationshipBlockAction(clientId, { ...biological, status: statusValue }))
              }
              onAddSibling={() =>
                void addPerson(
                  biological.relationshipBlockId,
                  "sibling",
                  siblingTypesForBlock("biological_parents")[0] ?? "full"
                )
              }
              onSiblingsAnswer={(siblingsAnswer) =>
                void run(() => updateRelationshipBlockAction(clientId, { ...biological, siblingsAnswer }))
              }
            />
          ) : null}

          <AnsweredSideSection
            id="mother_other_answer"
            label={motherName ? `Mother (${motherName}) · other relationships` : "Mother · other relationships"}
            answer={motherOther.length > 0 ? "yes" : answers.motherOtherRelationships || ""}
            locked={motherOther.length > 0}
            onAnswer={(value) =>
              void run(() => setRelationshipBlockAnswerAction(clientId, "motherOtherRelationships", value))
            }
            onAdd={() => void addBlock("parent_other", { parentSide: "mother" })}
            addLabel="+ Add relationship"
            hideAdd={answers.motherOtherRelationships === "none"}
          >
            {motherOther.map((block) => (
              <ParentOtherTree
                key={block.relationshipBlockId}
                block={block}
                people={people}
                selectedId={selectedId}
                onOpenBlock={() => openBlock(block.relationshipBlockId)}
                onOpenPerson={openPerson}
                onStatus={(statusValue) =>
                  void run(() => updateRelationshipBlockAction(clientId, { ...block, status: statusValue }))
                }
                onAddPartner={() => void addPerson(block.relationshipBlockId, "partner")}
                onAddSibling={() => void addPerson(block.relationshipBlockId, "sibling", "half")}
                onSiblingsAnswer={(siblingsAnswer) =>
                  void run(() => updateRelationshipBlockAction(clientId, { ...block, siblingsAnswer }))
                }
              />
            ))}
          </AnsweredSideSection>

          <AnsweredSideSection
            id="father_other_answer"
            label={fatherName ? `Father (${fatherName}) · other relationships` : "Father · other relationships"}
            answer={fatherOther.length > 0 ? "yes" : answers.fatherOtherRelationships || ""}
            locked={fatherOther.length > 0}
            onAnswer={(value) =>
              void run(() => setRelationshipBlockAnswerAction(clientId, "fatherOtherRelationships", value))
            }
            onAdd={() => void addBlock("parent_other", { parentSide: "father" })}
            addLabel="+ Add relationship"
            hideAdd={answers.fatherOtherRelationships === "none"}
          >
            {fatherOther.map((block) => (
              <ParentOtherTree
                key={block.relationshipBlockId}
                block={block}
                people={people}
                selectedId={selectedId}
                onOpenBlock={() => openBlock(block.relationshipBlockId)}
                onOpenPerson={openPerson}
                onStatus={(statusValue) =>
                  void run(() => updateRelationshipBlockAction(clientId, { ...block, status: statusValue }))
                }
                onAddPartner={() => void addPerson(block.relationshipBlockId, "partner")}
                onAddSibling={() => void addPerson(block.relationshipBlockId, "sibling", "half")}
                onSiblingsAnswer={(siblingsAnswer) =>
                  void run(() => updateRelationshipBlockAction(clientId, { ...block, siblingsAnswer }))
                }
              />
            ))}
          </AnsweredSideSection>

          <AnsweredSideSection
            id="caregiver_arrangements_answer"
            label="Other caregiver arrangements"
            answer={caregivers.length > 0 ? "yes" : answers.caregiverArrangements || ""}
            locked={caregivers.length > 0}
            onAnswer={(value) =>
              void run(() => setRelationshipBlockAnswerAction(clientId, "caregiverArrangements", value))
            }
            onAdd={() => void addBlock("caregiver_arrangement")}
            addLabel="+ Add arrangement"
            hideAdd={answers.caregiverArrangements === "none"}
          >
            {caregivers.map((block) => (
              <CaregiverTree
                key={block.relationshipBlockId}
                block={block}
                people={people}
                selectedId={selectedId}
                onOpenBlock={() => openBlock(block.relationshipBlockId)}
                onOpenPerson={openPerson}
                onArrangement={(arrangementType) =>
                  void run(() =>
                    updateRelationshipBlockAction(clientId, {
                      ...block,
                      arrangementType: arrangementType as RelationshipBlock["arrangementType"],
                    })
                  )
                }
                onAddCaregiver={() => void addPerson(block.relationshipBlockId, "caregiver")}
                onAddSibling={() => void addPerson(block.relationshipBlockId, "sibling", "adoptive")}
                onSiblingsAnswer={(siblingsAnswer) =>
                  void run(() => updateRelationshipBlockAction(clientId, { ...block, siblingsAnswer }))
                }
              />
            ))}
          </AnsweredSideSection>

          {unplacedCaregivers.length > 0 ? (
            <UnplacedGroup
              people={unplacedCaregivers}
              onOpenPerson={openPerson}
              onMove={(id) => setSelection({ type: "move", id })}
            />
          ) : null}
        </div>
      </InterviewSectionCard>

      {portalReady && selection
        ? createPortal(
            <RelationshipPanelShell
              ariaLabel={
                selection.type === "block"
                  ? selectedBlock?.relationshipBlockId || "Relationship"
                  : selectedPerson?.givenName || "Person"
              }
              onDismiss={closePanel}
            >
              {selection.type === "move" && selectedPerson ? (
                <>
                  <PanelHeader
                    initial={(selectedPerson.givenName.trim() || "?").slice(0, 1).toUpperCase()}
                    deceased={selectedPerson.deceased || selectedPerson.healthStatus === "deceased"}
                    title={selectedPerson.givenName.trim() || "Person"}
                    subtitle="Move to…"
                    onClose={closePanel}
                  />
                  <MoveStep
                    key={`move-${selectedPerson.relationshipRecordId}`}
                    name={selectedPerson.givenName.trim() || "Person"}
                    person={selectedPerson}
                    blocks={blockList}
                    people={people}
                    saving={false}
                    error={error ?? ""}
                    onCancel={() => setSelection({ type: "person", id: selectedPerson.relationshipRecordId })}
                    onMove={async (destinationId, role, roleType) => {
                      const moved = await run(() =>
                        moveBlockMemberAction(
                          clientId,
                          selectedPerson.relationshipRecordId,
                          destinationId,
                          role,
                          roleType
                        )
                      )
                      if (moved) setSelection({ type: "person", id: selectedPerson.relationshipRecordId })
                    }}
                  />
                </>
              ) : selection.type === "person" && selectedPerson ? (
                <InterviewPersonPanel
                  key={selectedPerson.relationshipRecordId}
                  person={selectedPerson}
                  block={blockList.find((item) => item.relationshipBlockId === selectedPerson.relationshipBlockId) ?? null}
                  addAnotherRole={selection.addAnotherRole}
                  error={error}
                  onClose={closePanel}
                  onDraftChange={(draft) => schedulePersonSave(selectedPerson, draft)}
                  onMove={() => setSelection({ type: "move", id: selectedPerson.relationshipRecordId })}
                  onRemove={async () => {
                    const removed = await run(() => removeBlockMemberAction(clientId, selectedPerson.relationshipRecordId))
                    if (removed) closePanel()
                  }}
                  onAddAnother={async (role, draft) => addAnother(selectedPerson, role, draft)}
                  onDone={async (draft) => {
                    await flushPersonSave(selectedPerson, draft)
                    closePanel()
                  }}
                />
              ) : selection.type === "block" && selectedBlock ? (
                <InterviewBlockPanel
                  key={selectedBlock.relationshipBlockId}
                  block={selectedBlock}
                  locked={selectedBlock.relationshipBlockId === lockedId}
                  error={error}
                  onClose={closePanel}
                  onDraftChange={scheduleBlockSave}
                  onRemove={
                    selectedBlock.kind !== "biological_parents" && selectedBlock.kind !== "client_other_children"
                      ? async () => {
                          const removed = await run(() =>
                            deleteRelationshipBlockAction(clientId, selectedBlock.relationshipBlockId)
                          )
                          if (removed) closePanel()
                        }
                      : undefined
                  }
                  onDone={async (draft) => {
                    if (blockTimer.current) {
                      window.clearTimeout(blockTimer.current)
                      blockTimer.current = null
                    }
                    await run(() => updateRelationshipBlockAction(clientId, draft))
                    closePanel()
                  }}
                />
              ) : null}
            </RelationshipPanelShell>,
            document.body
          )
        : null}
    </>
  )
}

function InterviewPersonPanel({
  person,
  block,
  addAnotherRole,
  error,
  onClose,
  onDraftChange,
  onMove,
  onRemove,
  onAddAnother,
  onDone,
}: {
  person: RelationshipRecord
  block: RelationshipBlock | null
  addAnotherRole?: BlockRole
  error: string | null
  onClose: () => void
  onDraftChange: (draft: PersonDraft) => void
  onMove: () => void
  onRemove: () => Promise<void>
  onAddAnother: (role: BlockRole, draft: PersonDraft) => Promise<void>
  onDone: (draft: PersonDraft) => Promise<void>
}) {
  const [draft, setDraft] = useState(() => draftFromPerson(person))
  const name = person.notKnown && person.blockRole === "parent"
    ? person.blockRoleType === "father"
      ? "Father"
      : "Mother"
    : person.givenName.trim() || "Person"
  const role = (addAnotherRole || person.blockRole || "partner") as BlockRole
  const addLabel =
    role === "child" ? "Add another child" : role === "sibling" ? "Add another sibling" : role === "partner" ? "Add another partner" : role === "caregiver" ? "Add another caregiver" : null
  const removable = !(person.blockRole === "parent" && (person.relationshipToClient === "mother" || person.relationshipToClient === "father"))

  return (
    <>
      <PanelHeader
        initial={name.slice(0, 1).toUpperCase() || "?"}
        deceased={person.deceased || person.healthStatus === "deceased"}
        title={name}
        subtitle={ROLE_LABELS[person.blockRole as BlockRole] || "Person"}
        onClose={onClose}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <PersonFields
          idPrefix={person.relationshipRecordId}
          person={person}
          block={block}
          draft={draft}
          onChange={(next) => {
            setDraft(next)
            onDraftChange(next)
          }}
        />
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </div>
      <footer className="flex flex-wrap items-center gap-2 border-t p-4">
        <button type="button" className="inline-flex min-h-10 items-center rounded-md border px-3 text-sm" onClick={onMove}>
          Move to…
        </button>
        {removable ? (
          <button
            type="button"
            className="inline-flex min-h-10 items-center text-sm text-destructive underline-offset-2 hover:underline"
            onClick={() => void onRemove()}
          >
            Remove
          </button>
        ) : null}
        {addLabel ? (
          <button
            type="button"
            className={cn(linkClass, "min-h-10")}
            onClick={() => void onAddAnother(role, draft)}
          >
            {addLabel}
          </button>
        ) : null}
        <span className="flex-1" />
        <button
          type="button"
          className="inline-flex min-h-10 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground"
          onClick={() => void onDone(draft)}
        >
          Done
        </button>
      </footer>
    </>
  )
}

function InterviewBlockPanel({
  block,
  locked,
  error,
  onClose,
  onDraftChange,
  onRemove,
  onDone,
}: {
  block: RelationshipBlock
  locked: boolean
  error: string | null
  onClose: () => void
  onDraftChange: (draft: RelationshipBlock) => void
  onRemove?: () => Promise<void>
  onDone: (draft: RelationshipBlock) => Promise<void>
}) {
  const [draft, setDraft] = useState(block)
  return (
    <>
      <PanelHeader
        initial="D"
        deceased={false}
        title="Dates"
        subtitle={blockMeta(block) || "Relationship"}
        onClose={onClose}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <BlockFields
          block={draft}
          locked={locked}
          showChildrenCheckbox={false}
          onChange={(next) => {
            setDraft(next)
            onDraftChange(next)
          }}
        />
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </div>
      <footer className="flex flex-wrap items-center gap-2 border-t p-4">
        {onRemove ? (
          <button
            type="button"
            className="inline-flex min-h-10 items-center text-sm text-destructive underline-offset-2 hover:underline"
            onClick={() => void onRemove()}
          >
            Remove
          </button>
        ) : null}
        <span className="flex-1" />
        <button
          type="button"
          className="inline-flex min-h-10 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground"
          onClick={() => void onDone(draft)}
        >
          Done
        </button>
      </footer>
    </>
  )
}

function PersonLine({
  person,
  block,
  onOpen,
  layer = 3,
  selected = false,
  isLast = true,
}: {
  person: RelationshipRecord
  block: RelationshipBlock | null
  onOpen: () => void
  layer?: 3 | 4
  selected?: boolean
  isLast?: boolean
}) {
  const needs = block ? needsForMember(block, person) : []
  const name =
    person.notKnown && person.blockRole === "parent"
      ? person.blockRoleType === "father"
        ? "Father"
        : "Mother"
      : person.givenName.trim() || ROLE_LABELS[person.blockRole as BlockRole] || "Person"
  const deceased = person.deceased || person.healthStatus === "deceased"
  const layer4 = layer === 4
  return (
    <ul>
      <TreeBranch intoLayer={layer} isLast={isLast}>
        <button
          type="button"
          aria-current={selected ? "true" : undefined}
          className={cn(
            layer4 ? treeLayer4ShellClassName : treeLayer3ShellClassName,
            treeItemStateClassName({ selected })
          )}
          onClick={onOpen}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                layer4 ? treeLayer4AvatarClassName : treeLayer3AvatarClassName,
                deceased ? "border-2 border-dashed border-[#a1a1aa]" : "bg-muted"
              )}
              aria-hidden
            >
              {name.slice(0, 1).toUpperCase() || "?"}
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
            {needs.length > 0 ? (
              <span className="flex flex-wrap gap-1">
                {needs.map((need) => (
                  <Needs key={need} need={needLabel(need)} />
                ))}
              </span>
            ) : null}
          </span>
          {person.blockRole ? (
            <span
              className={cn(
                layer4 ? treeLayer4MetaClassName : treeLayer3MetaClassName,
                selected && "text-[#1e3a8a]",
                "w-full"
              )}
            >
              {ROLE_LABELS[person.blockRole as BlockRole] ?? person.blockRole}
            </span>
          ) : null}
        </button>
      </TreeBranch>
    </ul>
  )
}

function DatesControl({
  block,
  needs,
  onOpen,
}: {
  block: RelationshipBlock
  needs: string[]
  onOpen: () => void
}) {
  const meta = blockMeta(block)
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {meta ? <span className="text-muted-foreground">{meta}</span> : <span className="text-muted-foreground">Dates not recorded</span>}
      <button type="button" className={linkClass} onClick={onOpen}>
        Dates ›
      </button>
      {needs.map((need) => (
        <Needs key={need} need={need} />
      ))}
    </div>
  )
}

function ClientStatusSelect({
  status,
  relationshipClient,
  onChange,
  id = "client_relationship_status",
}: {
  status: ClientRelationshipStatusValue
  relationshipClient?: AppliedAnswer<ClientRelationshipStatusValue>
  onChange: (next: ClientRelationshipStatusValue) => void
  id?: string
}) {
  return (
    <>
      <SelectField
        id={id}
        label="Current relationship status"
        value={status.relationshipStatus}
        client={
          relationshipClient ? (
            <ClientAnswer
              label={relationshipClient.label}
              matches={
                status.relationshipStatus === relationshipClient.apply.relationshipStatus &&
                (relationshipClient.apply.relationshipStatus !== "other" ||
                  status.relationshipStatusOther === relationshipClient.apply.relationshipStatusOther)
              }
              onUse={() => onChange(relationshipClient.apply)}
            />
          ) : undefined
        }
        onChange={(relationshipStatus) =>
          onChange({
            relationshipStatus: relationshipStatus as ClientRelationshipStatus | "",
            relationshipStatusOther: relationshipStatus === "other" ? status.relationshipStatusOther : "",
          })
        }
      >
        <option value="">Not recorded</option>
        {CLIENT_RELATIONSHIP_STATUSES.map((option) => (
          <option key={option} value={option}>
            {CLIENT_RELATIONSHIP_STATUS_LABELS[option]}
          </option>
        ))}
      </SelectField>
      {status.relationshipStatus === "other" ? (
        <TextField
          id={`${id}_other`}
          label="Other relationship status"
          value={status.relationshipStatusOther}
          onChange={(relationshipStatusOther) => onChange({ ...status, relationshipStatusOther })}
        />
      ) : null}
    </>
  )
}

/** Nest Children / Siblings under the last leader line (board AA). */
function withNestedQuestion(
  leaders: RelationshipRecord[],
  renderLeader: (person: RelationshipRecord) => ReactNode,
  question: ReactNode
) {
  if (leaders.length === 0) return <>{question}</>
  return (
    <>
      {leaders.map((person, index) => (
        <div key={person.relationshipRecordId} className="space-y-2">
          {renderLeader(person)}
          {index === leaders.length - 1 ? question : null}
        </div>
      ))}
    </>
  )
}

function ChildrenQuestion({
  block,
  people,
  onOpenPerson,
  onAddChild,
  onAnswer,
  selectedId,
}: {
  block: RelationshipBlock
  people: RelationshipRecord[]
  onOpenPerson: (id: string) => void
  onAddChild: () => void
  onAnswer: (value: BlockAnswer) => void
  selectedId: string | null
}) {
  const children = membersOf(block, people, "child")
  const answer = children.length > 0 ? "yes" : resolvedChildrenAnswer(block)
  return (
    <div className="space-y-2 pl-4">
      <AnswerSelect
        id={`${block.relationshipBlockId}-children`}
        label="Children"
        value={answer}
        locked={children.length > 0}
        onChange={onAnswer}
        inline
      />
      {answer === "yes" || children.length > 0 ? (
        <>
          {children.map((person, index) => (
            <PersonLine
              key={person.relationshipRecordId}
              person={person}
              block={block}
              layer={4}
              selected={selectedId === person.relationshipRecordId}
              isLast={index === children.length - 1}
              onOpen={() => onOpenPerson(person.relationshipRecordId)}
            />
          ))}
          <button type="button" className={linkClass} onClick={onAddChild}>
            + Add child
          </button>
        </>
      ) : null}
    </div>
  )
}

function SiblingsQuestion({
  block,
  people,
  onOpenPerson,
  onAddSibling,
  onAnswer,
  selectedId,
}: {
  block: RelationshipBlock
  people: RelationshipRecord[]
  onOpenPerson: (id: string) => void
  onAddSibling: () => void
  onAnswer: (value: BlockAnswer) => void
  selectedId: string | null
}) {
  const siblings = membersOf(block, people, "sibling")
  const answer = siblings.length > 0 ? "yes" : resolvedSiblingsAnswer(block)
  return (
    <div className="space-y-2 pl-4">
      <AnswerSelect
        id={`${block.relationshipBlockId}-siblings`}
        label="Siblings"
        value={answer}
        locked={siblings.length > 0}
        onChange={onAnswer}
        inline
      />
      {answer === "yes" || siblings.length > 0 ? (
        <>
          {siblings.map((person, index) => (
            <PersonLine
              key={person.relationshipRecordId}
              person={person}
              block={block}
              layer={4}
              selected={selectedId === person.relationshipRecordId}
              isLast={index === siblings.length - 1}
              onOpen={() => onOpenPerson(person.relationshipRecordId)}
            />
          ))}
          <button type="button" className={linkClass} onClick={onAddSibling}>
            + Add sibling
          </button>
        </>
      ) : null}
    </div>
  )
}

function CurrentBlockTree({
  block,
  people,
  locked,
  statusSource,
  clientStatus,
  relationshipClient,
  selectedId,
  onClientStatus,
  onBlockStatus,
  onOpenBlock,
  onOpenPerson,
  onAddPartner,
  onAddChild,
  onChildrenAnswer,
}: {
  block: RelationshipBlock
  people: RelationshipRecord[]
  locked: boolean
  statusSource: boolean
  clientStatus: ClientRelationshipStatusValue
  relationshipClient?: AppliedAnswer<ClientRelationshipStatusValue>
  selectedId: string | null
  onClientStatus: (next: ClientRelationshipStatusValue) => void
  onBlockStatus: (status: string) => void
  onOpenBlock: () => void
  onOpenPerson: (id: string) => void
  onAddPartner: () => void
  onAddChild: () => void
  onChildrenAnswer: (value: BlockAnswer) => void
}) {
  const partners = membersOf(block, people, "partner")
  const needs = needsForBlock(block, locked).map(needLabel)
  const statuses = statusesForBlock(block.kind)
  const children = (
    <ChildrenQuestion
      block={block}
      people={people}
      selectedId={selectedId}
      onOpenPerson={onOpenPerson}
      onAddChild={onAddChild}
      onAnswer={onChildrenAnswer}
    />
  )
  return (
    <div className={layer2BandClassName}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1">
          {statusSource ? (
            <ClientStatusSelect
              id={`client_relationship_status_${block.relationshipBlockId}`}
              status={clientStatus}
              relationshipClient={relationshipClient}
              onChange={onClientStatus}
            />
          ) : (
            <SelectField
              id={`${block.relationshipBlockId}-status-inline`}
              label="Status"
              value={block.status}
              onChange={onBlockStatus}
            >
              <option value="">Not recorded</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </SelectField>
          )}
        </div>
        <DatesControl block={block} needs={needs} onOpen={onOpenBlock} />
      </div>
      {withNestedQuestion(
        partners,
        (person) => (
          <PersonLine
            person={person}
            block={block}
            selected={selectedId === person.relationshipRecordId}
            onOpen={() => onOpenPerson(person.relationshipRecordId)}
          />
        ),
        children
      )}
      <button type="button" className={linkClass} onClick={onAddPartner}>
        + Add another partner
      </button>
    </div>
  )
}

function PreviousBlockTree({
  block,
  people,
  selectedId,
  onOpenBlock,
  onOpenPerson,
  onStatus,
  onAddPartner,
  onAddChild,
  onChildrenAnswer,
}: {
  block: RelationshipBlock
  people: RelationshipRecord[]
  selectedId: string | null
  onOpenBlock: () => void
  onOpenPerson: (id: string) => void
  onStatus: (status: string) => void
  onAddPartner: () => void
  onAddChild: () => void
  onChildrenAnswer: (value: BlockAnswer) => void
}) {
  const partners = membersOf(block, people, "partner")
  const needs = needsForBlock(block, false)
  const statuses = statusesForBlock(block.kind)
  const children = (
    <ChildrenQuestion
      block={block}
      people={people}
      selectedId={selectedId}
      onOpenPerson={onOpenPerson}
      onAddChild={onAddChild}
      onAnswer={onChildrenAnswer}
    />
  )
  return (
    <div className={layer2BandClassName}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1">
          <SelectField
            id={`${block.relationshipBlockId}-status-inline`}
            label="Status"
            value={block.status}
            onChange={onStatus}
          >
            <option value="">Not recorded</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </SelectField>
        </div>
        <DatesControl
          block={block}
          needs={needs.filter((need) => need !== "status").map(needLabel)}
          onOpen={onOpenBlock}
        />
        {needs.includes("status") ? <Needs need={needLabel("status")} /> : null}
      </div>
      {withNestedQuestion(
        partners,
        (person) => (
          <PersonLine
            person={person}
            block={block}
            selected={selectedId === person.relationshipRecordId}
            onOpen={() => onOpenPerson(person.relationshipRecordId)}
          />
        ),
        children
      )}
      <button type="button" className={linkClass} onClick={onAddPartner}>
        + Add partner
      </button>
    </div>
  )
}

function OtherChildrenTree({
  block,
  people,
  selectedId,
  onOpenPerson,
  onStatusDetail,
  onAddChild,
}: {
  block: RelationshipBlock
  people: RelationshipRecord[]
  selectedId: string | null
  onOpenPerson: (id: string) => void
  onStatusDetail: (value: string) => void
  onAddChild: () => void
}) {
  const children = membersOf(block, people, "child")
  const [detail, setDetail] = useState(block.statusDetail)
  const timer = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    []
  )
  return (
    <div className={layer2BandClassName}>
      <TextField
        id={`${block.relationshipBlockId}-relationship-inline`}
        label="Relationship"
        placeholder="e.g. IVF with a donor, sole adoption"
        value={detail}
        onChange={(statusDetail) => {
          setDetail(statusDetail)
          if (timer.current) window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => onStatusDetail(statusDetail), 400)
        }}
      />
      {!detail.trim() ? <Needs need="Unrecorded relationship" /> : null}
      {children.map((person, index) => (
        <PersonLine
          key={person.relationshipRecordId}
          person={person}
          block={block}
          layer={4}
          selected={selectedId === person.relationshipRecordId}
          isLast={index === children.length - 1}
          onOpen={() => onOpenPerson(person.relationshipRecordId)}
        />
      ))}
      <button type="button" className={linkClass} onClick={onAddChild}>
        + Add child
      </button>
    </div>
  )
}

function ParentsBlockTree({
  block,
  people,
  selectedId,
  onOpenBlock,
  onOpenPerson,
  onStatus,
  onAddSibling,
  onSiblingsAnswer,
}: {
  block: RelationshipBlock
  people: RelationshipRecord[]
  selectedId: string | null
  onOpenBlock: () => void
  onOpenPerson: (id: string) => void
  onStatus: (status: string) => void
  onAddSibling: () => void
  onSiblingsAnswer: (value: BlockAnswer) => void
}) {
  const parents = membersOf(block, people, "parent").sort(
    (a, b) => parentRank(a) - parentRank(b) || a.displayOrder - b.displayOrder
  )
  const statuses = statusesForBlock(block.kind)
  const needs = needsForBlock(block, false).map(needLabel)
  const siblings = (
    <SiblingsQuestion
      block={block}
      people={people}
      selectedId={selectedId}
      onOpenPerson={onOpenPerson}
      onAddSibling={onAddSibling}
      onAnswer={onSiblingsAnswer}
    />
  )
  return (
    <section className="space-y-3">
      <h3 className={treeLayer1ClassName}>Biological parents</h3>
      <div className={layer2BandClassName}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <SelectField id={`${block.relationshipBlockId}-status-inline`} label="Status" value={block.status} onChange={onStatus}>
              <option value="">Not recorded</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </SelectField>
          </div>
          <DatesControl block={block} needs={needs} onOpen={onOpenBlock} />
        </div>
        {withNestedQuestion(
          parents,
          (person) => (
            <PersonLine
              person={person}
              block={block}
              selected={selectedId === person.relationshipRecordId}
              onOpen={() => onOpenPerson(person.relationshipRecordId)}
            />
          ),
          siblings
        )}
      </div>
    </section>
  )
}

function ParentOtherTree({
  block,
  people,
  selectedId,
  onOpenBlock,
  onOpenPerson,
  onStatus,
  onAddPartner,
  onAddSibling,
  onSiblingsAnswer,
}: {
  block: RelationshipBlock
  people: RelationshipRecord[]
  selectedId: string | null
  onOpenBlock: () => void
  onOpenPerson: (id: string) => void
  onStatus: (status: string) => void
  onAddPartner: () => void
  onAddSibling: () => void
  onSiblingsAnswer: (value: BlockAnswer) => void
}) {
  const partners = membersOf(block, people, "partner")
  const statuses = statusesForBlock(block.kind)
  const needs = needsForBlock(block, false)
  const siblings = (
    <SiblingsQuestion
      block={block}
      people={people}
      selectedId={selectedId}
      onOpenPerson={onOpenPerson}
      onAddSibling={onAddSibling}
      onAnswer={onSiblingsAnswer}
    />
  )
  return (
    <div className={layer2BandClassName}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1">
          <SelectField id={`${block.relationshipBlockId}-status-inline`} label="Status" value={block.status} onChange={onStatus}>
            <option value="">Not recorded</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </SelectField>
        </div>
        <DatesControl
          block={block}
          needs={needs.filter((need) => need !== "status").map(needLabel)}
          onOpen={onOpenBlock}
        />
        {needs.includes("status") ? <Needs need={needLabel("status")} /> : null}
      </div>
      {withNestedQuestion(
        partners,
        (person) => (
          <PersonLine
            person={person}
            block={block}
            selected={selectedId === person.relationshipRecordId}
            onOpen={() => onOpenPerson(person.relationshipRecordId)}
          />
        ),
        siblings
      )}
      <button type="button" className={linkClass} onClick={onAddPartner}>
        + Add partner
      </button>
    </div>
  )
}

function CaregiverTree({
  block,
  people,
  selectedId,
  onOpenBlock,
  onOpenPerson,
  onArrangement,
  onAddCaregiver,
  onAddSibling,
  onSiblingsAnswer,
}: {
  block: RelationshipBlock
  people: RelationshipRecord[]
  selectedId: string | null
  onOpenBlock: () => void
  onOpenPerson: (id: string) => void
  onArrangement: (value: string) => void
  onAddCaregiver: () => void
  onAddSibling: () => void
  onSiblingsAnswer: (value: BlockAnswer) => void
}) {
  const caregivers = membersOf(block, people, "caregiver")
  const needs = needsForBlock(block, false)
  const siblings = (
    <SiblingsQuestion
      block={block}
      people={people}
      selectedId={selectedId}
      onOpenPerson={onOpenPerson}
      onAddSibling={onAddSibling}
      onAnswer={onSiblingsAnswer}
    />
  )
  return (
    <div className={layer2BandClassName}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1">
          <SelectField
            id={`${block.relationshipBlockId}-arrangement-inline`}
            label="Arrangement"
            value={block.arrangementType}
            onChange={onArrangement}
          >
            <option value="">Not recorded</option>
            {Object.entries(ARRANGEMENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
        </div>
        <DatesControl
          block={block}
          needs={needs.filter((need) => need !== "type").map(needLabel)}
          onOpen={onOpenBlock}
        />
        {needs.includes("type") ? <Needs need={needLabel("type")} /> : null}
      </div>
      {withNestedQuestion(
        caregivers,
        (person) => (
          <PersonLine
            person={person}
            block={block}
            selected={selectedId === person.relationshipRecordId}
            onOpen={() => onOpenPerson(person.relationshipRecordId)}
          />
        ),
        siblings
      )}
      <button type="button" className={linkClass} onClick={onAddCaregiver}>
        + Add caregiver
      </button>
    </div>
  )
}

function AnsweredSideSection({
  id,
  label,
  answer,
  locked,
  onAnswer,
  onAdd,
  addLabel,
  hideAdd,
  children,
}: {
  id: string
  label: string
  answer: BlockAnswer | ""
  locked: boolean
  onAnswer: (value: BlockAnswer) => void
  onAdd: () => void
  addLabel: string
  hideAdd: boolean
  children: import("react").ReactNode
}) {
  return (
    <section className="space-y-3">
      <AnswerSelect id={id} label={label} value={answer} locked={locked} onChange={onAnswer} />
      {children}
      {!hideAdd ? (
        <button type="button" className={linkClass} onClick={onAdd}>
          {addLabel}
        </button>
      ) : null}
    </section>
  )
}

function UnplacedGroup({
  people,
  onOpenPerson,
  onMove,
}: {
  people: RelationshipRecord[]
  onOpenPerson: (id: string) => void
  onMove: (id: string) => void
}) {
  return (
    <section className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3">
      <h3 className="text-sm font-medium text-amber-950">Not placed</h3>
      {people.map((person) => (
        <div key={person.relationshipRecordId} className="flex flex-wrap items-center gap-2 rounded-md bg-white p-2">
          <button
            type="button"
            className="min-h-10 flex-1 text-left text-sm font-medium hover:underline"
            onClick={() => onOpenPerson(person.relationshipRecordId)}
          >
            {person.givenName.trim() || person.relationshipToClient || "Person"}
          </button>
          <Needs need="Not placed" />
          <button type="button" className={linkClass} onClick={() => onMove(person.relationshipRecordId)}>
            Move to…
          </button>
        </div>
      ))}
    </section>
  )
}
