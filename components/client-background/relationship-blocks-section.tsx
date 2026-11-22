"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

import {
  deleteRelationshipBlockAction,
  moveBlockMemberAction,
  removeBlockMemberAction,
  saveRelationshipPersonDraftAction,
  saveRelationshipStatusBlockAction,
  setRelationshipBlockAnswerAction,
  updateBlockMemberAction,
  updateRelationshipBlockAction,
} from "@/app/clients/[client_id]/background/actions"
import { AddToRelationshipMenu } from "@/components/client-background/add-to-relationship-menu"
import { DiscardChangesDialog } from "@/components/client-background/discard-changes-dialog"
import { ClientAnswer, SelectField, TextField } from "@/components/client-background/fields"
import type { SavePhase } from "@/components/client-background/interview-autosave"
import { InterviewSectionCard, needsBadge } from "@/components/client-background/interview-section-card"
import { NewPersonDraftForm } from "@/components/client-background/new-person-draft-form"
import {
  NewRelationshipPanel,
  NEW_RELATIONSHIP_ENTRY_POINTS,
  type NewRelationshipDraftSave,
} from "@/components/client-background/new-relationship-panel"
import {
  RelationshipEditFooter,
  RelationshipSectionFooter,
} from "@/components/client-background/relationship-edit-footer"
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
import {
  countUnsavedRelationshipChanges,
  type RelationshipSectionSnapshot,
} from "@/lib/client-background/unsaved-changes"
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
  | { type: "person"; id: string }
  | { type: "block"; id: string }
  | { type: "move"; id: string }
  | { type: "new_relationship_draft"; kind: BlockKind; parentSide?: "mother" | "father" }
  | { type: "new_person_draft"; blockId: string; role: BlockRole }

const linkClass = "text-sm text-primary underline-offset-2 hover:underline"

const INTIMATE_KINDS = new Set<BlockKind>(["client_current", "client_previous", "client_other_children"])
const CAREGIVER_KINDS = new Set<BlockKind>(["biological_parents", "parent_other", "caregiver_arrangement"])

function Needs({ need }: { need: string }) {
  return <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-950">{need}</span>
}

function resolvedChildrenAnswer(block: RelationshipBlock): BlockAnswer | "" {
  if (block.childrenAnswer === "yes" || block.childrenAnswer === "none" || block.childrenAnswer === "not_asked") {
    return block.childrenAnswer
  }
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

function emptyStatus(): ClientRelationshipStatusValue {
  return { relationshipStatus: "", relationshipStatusOther: "" }
}

function intimateSnapshot(
  blocks: RelationshipBlock[],
  answers: RelationshipBlockAnswers,
  status: ClientRelationshipStatusValue
): RelationshipSectionSnapshot {
  return {
    blocks: blocks.filter((block) => INTIMATE_KINDS.has(block.kind)),
    blockAnswers: {
      ...emptyBlockAnswers(),
      previousRelationships: answers.previousRelationships,
      otherChildren: answers.otherChildren,
    },
    relationshipStatus: status,
  }
}

function caregiversSnapshot(
  blocks: RelationshipBlock[],
  answers: RelationshipBlockAnswers
): RelationshipSectionSnapshot {
  return {
    blocks: blocks.filter((block) => CAREGIVER_KINDS.has(block.kind)),
    blockAnswers: {
      ...emptyBlockAnswers(),
      motherOtherRelationships: answers.motherOtherRelationships,
      fatherOtherRelationships: answers.fatherOtherRelationships,
      caregiverArrangements: answers.caregiverArrangements,
    },
    relationshipStatus: emptyStatus(),
  }
}

function primaryRoleForKind(kind: BlockKind): BlockRole {
  if (kind === "caregiver_arrangement") return "caregiver"
  if (kind === "client_other_children") return "child"
  return "partner"
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
  const initialBlocks = blocks ?? []
  const initialAnswers = blockAnswers ?? emptyBlockAnswers()
  const [people, setPeople] = useState(relationships)
  const [blockList, setBlockList] = useState(initialBlocks)
  const [answers, setAnswers] = useState(initialAnswers)
  const [status, setStatus] = useState(relationshipStatus)
  const [baselineBlocks, setBaselineBlocks] = useState(initialBlocks)
  const [baselineAnswers, setBaselineAnswers] = useState(initialAnswers)
  const [baselineStatus, setBaselineStatus] = useState(relationshipStatus)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [panelSaving, setPanelSaving] = useState(false)
  const [intimateSaving, setIntimateSaving] = useState(false)
  const [caregiversSaving, setCaregiversSaving] = useState(false)
  const [confirmLeavePanel, setConfirmLeavePanel] = useState(false)
  const [intimateOpenLocal, setIntimateOpenLocal] = useState(false)
  const [caregiversOpenLocal, setCaregiversOpenLocal] = useState(false)
  const intimateOpen = sectionOpen?.intimate ?? intimateOpenLocal
  const caregiversOpen = sectionOpen?.caregivers ?? caregiversOpenLocal
  const portalReady = typeof document !== "undefined"
  const inflight = useRef<Promise<void> | null>(null)
  const panelDirtyRef = useRef(false)

  useEffect(() => {
    setPeople(relationships)
    setBlockList(blocks ?? [])
    setAnswers(blockAnswers ?? emptyBlockAnswers())
    setStatus(relationshipStatus)
    setBaselineBlocks(blocks ?? [])
    setBaselineAnswers(blockAnswers ?? emptyBlockAnswers())
    setBaselineStatus(relationshipStatus)
  }, [relationships, blocks, blockAnswers, relationshipStatus])

  useEffect(() => {
    if (!registerFlush) return
    return registerFlush(() => inflight.current ?? Promise.resolve())
  }, [registerFlush])

  const intimateDraft = intimateSnapshot(blockList, answers, status)
  const intimateBaseline = intimateSnapshot(baselineBlocks, baselineAnswers, baselineStatus)
  const caregiversDraft = caregiversSnapshot(blockList, answers)
  const caregiversBaseline = caregiversSnapshot(baselineBlocks, baselineAnswers)
  const intimateUnsaved = countUnsavedRelationshipChanges(intimateBaseline, intimateDraft)
  const caregiversUnsaved = countUnsavedRelationshipChanges(caregiversBaseline, caregiversDraft)
  const sectionDirty = intimateUnsaved > 0 || caregiversUnsaved > 0

  useEffect(() => {
    if (!sectionDirty) return
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [sectionDirty])

  function apply(result: EditorState | null) {
    if (!result || !result.relationships || !result.blocks || !result.blockAnswers) {
      setError(result && "error" in result && result.error ? result.error : "Could not save.")
      return false
    }
    setPeople(result.relationships)
    setBlockList(result.blocks)
    setAnswers(result.blockAnswers)
    setBaselineBlocks(result.blocks)
    setBaselineAnswers(result.blockAnswers)
    if (result.relationshipStatus) {
      const nextStatus = {
        relationshipStatus: result.relationshipStatus.relationshipStatus as ClientRelationshipStatus | "",
        relationshipStatusOther: result.relationshipStatus.relationshipStatusOther,
      }
      setStatus(nextStatus)
      setBaselineStatus(nextStatus)
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

  function patchBlock(relationshipBlockId: string, patch: Partial<RelationshipBlock>) {
    setBlockList((list) =>
      list.map((block) =>
        block.relationshipBlockId === relationshipBlockId ? { ...block, ...patch } : block
      )
    )
  }

  function setAnswer(key: keyof RelationshipBlockAnswers, value: BlockAnswer) {
    setAnswers((current) => ({ ...current, [key]: value }))
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
  const newPersonBlock =
    selection?.type === "new_person_draft"
      ? blockList.find((item) => item.relationshipBlockId === selection.blockId)
      : undefined

  function closePanel() {
    setSelection(null)
    setError(null)
    setConfirmLeavePanel(false)
    panelDirtyRef.current = false
  }

  function requestClosePanel() {
    if (panelDirtyRef.current) {
      setConfirmLeavePanel(true)
      return
    }
    closePanel()
  }

  function openPerson(id: string) {
    setSelection({ type: "person", id })
    setError(null)
    panelDirtyRef.current = false
  }

  function openBlock(id: string) {
    setSelection({ type: "block", id })
    setError(null)
    panelDirtyRef.current = false
  }

  function openNewRelationship(kind: BlockKind, options?: { parentSide?: "mother" | "father" }) {
    setSelection({
      type: "new_relationship_draft",
      kind,
      parentSide: options?.parentSide,
    })
    setError(null)
    panelDirtyRef.current = false
  }

  function openNewPerson(blockId: string, role: BlockRole) {
    setSelection({ type: "new_person_draft", blockId, role })
    setError(null)
    panelDirtyRef.current = false
  }

  useEffect(() => {
    if (!selection) return
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      if (selection.type === "new_relationship_draft" || selection.type === "new_person_draft") {
        setConfirmLeavePanel(true)
        return
      }
      requestClosePanel()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selection])

  async function saveNewRelationshipDraft(draft: NewRelationshipDraftSave) {
    setPanelSaving(true)
    try {
      const blockRole = primaryRoleForKind(draft.kind)
      const result = await run(() =>
        saveRelationshipPersonDraftAction(clientId, {
          kind: draft.kind,
          parentSide: draft.parentSide,
          block: draft.block,
          person: {
            givenName: draft.person.givenName,
            sex: draft.person.sex,
            dateOfBirth: draft.person.dateOfBirth,
            blockRole,
            blockRoleType:
              draft.person.blockRoleType ||
              (blockRole === "child" ? "biological" : ""),
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
      if (result) closePanel()
    } finally {
      setPanelSaving(false)
    }
  }

  async function saveNewPersonDraft(
    blockId: string,
    role: BlockRole,
    fields: {
      givenName: string
      sex: string
      dateOfBirth: string
      blockRoleType: string
      livingSituation: string
    }
  ) {
    setPanelSaving(true)
    try {
      const block = blockList.find((item) => item.relationshipBlockId === blockId)
      const defaultType =
        role === "sibling"
          ? siblingTypesForBlock(block?.kind ?? "biological_parents")[0] ?? ""
          : role === "child"
            ? "biological"
            : ""
      const result = await run(() =>
        saveRelationshipPersonDraftAction(clientId, {
          relationshipBlockId: blockId,
          person: {
            givenName: fields.givenName,
            sex: fields.sex,
            dateOfBirth: fields.dateOfBirth,
            blockRole: role,
            blockRoleType: fields.blockRoleType || defaultType,
            livingSituation: fields.livingSituation,
          },
        })
      )
      if (result) closePanel()
    } finally {
      setPanelSaving(false)
    }
  }

  async function saveIntimateSection() {
    setIntimateSaving(true)
    setError(null)
    onPhase?.("relationships", "saving", null)
    try {
      let last: EditorState | null = null
      if (
        baselineStatus.relationshipStatus !== status.relationshipStatus ||
        baselineStatus.relationshipStatusOther !== status.relationshipStatusOther
      ) {
        last = await saveRelationshipStatusBlockAction(clientId, status)
        if (!last || ("error" in last && last.error)) {
          setError(last && "error" in last && last.error ? String(last.error) : "Could not save.")
          onPhase?.("relationships", "error", () => void saveIntimateSection())
          return
        }
      }
      for (const key of ["previousRelationships", "otherChildren"] as const) {
        if (baselineAnswers[key] !== answers[key]) {
          last = await setRelationshipBlockAnswerAction(clientId, key, answers[key] || "")
          if (!last || ("error" in last && last.error)) {
            setError(last && "error" in last && last.error ? String(last.error) : "Could not save.")
            onPhase?.("relationships", "error", () => void saveIntimateSection())
            return
          }
        }
      }
      const baseMap = new Map(baselineBlocks.map((block) => [block.relationshipBlockId, block]))
      for (const block of blockList.filter((item) => INTIMATE_KINDS.has(item.kind))) {
        const prior = baseMap.get(block.relationshipBlockId)
        if (
          !prior ||
          prior.status !== block.status ||
          prior.statusDetail !== block.statusDetail ||
          prior.arrangementType !== block.arrangementType ||
          prior.arrangementDetail !== block.arrangementDetail ||
          prior.startedOn !== block.startedOn ||
          prior.endedOn !== block.endedOn ||
          prior.childrenAnswer !== block.childrenAnswer ||
          prior.siblingsAnswer !== block.siblingsAnswer
        ) {
          last = await updateRelationshipBlockAction(clientId, block)
          if (!last || ("error" in last && last.error)) {
            setError(last && "error" in last && last.error ? String(last.error) : "Could not save.")
            onPhase?.("relationships", "error", () => void saveIntimateSection())
            return
          }
        }
      }
      if (last) {
        apply(last)
      } else {
        setBaselineStatus(status)
        setBaselineAnswers((current) => ({
          ...current,
          previousRelationships: answers.previousRelationships,
          otherChildren: answers.otherChildren,
        }))
        setBaselineBlocks((current) => {
          const draftMap = new Map(
            blockList.filter((item) => INTIMATE_KINDS.has(item.kind)).map((block) => [block.relationshipBlockId, block])
          )
          return current.map((block) => draftMap.get(block.relationshipBlockId) ?? block)
        })
        onRelationshipStatus?.(status)
        onBlockAnswers?.(answers)
        onBlocks?.(blockList)
      }
      onPhase?.("relationships", "saved", null)
    } finally {
      setIntimateSaving(false)
    }
  }

  function discardIntimateSection() {
    setStatus(baselineStatus)
    setAnswers((current) => ({
      ...current,
      previousRelationships: baselineAnswers.previousRelationships,
      otherChildren: baselineAnswers.otherChildren,
    }))
    setBlockList((list) => {
      const baseMap = new Map(
        baselineBlocks
          .filter((block) => INTIMATE_KINDS.has(block.kind))
          .map((block) => [block.relationshipBlockId, block])
      )
      return list.map((block) =>
        INTIMATE_KINDS.has(block.kind) ? baseMap.get(block.relationshipBlockId) ?? block : block
      )
    })
    setError(null)
  }

  async function saveCaregiversSection() {
    setCaregiversSaving(true)
    setError(null)
    onPhase?.("relationships", "saving", null)
    try {
      let last: EditorState | null = null
      for (const key of [
        "motherOtherRelationships",
        "fatherOtherRelationships",
        "caregiverArrangements",
      ] as const) {
        if (baselineAnswers[key] !== answers[key]) {
          last = await setRelationshipBlockAnswerAction(clientId, key, answers[key] || "")
          if (!last || ("error" in last && last.error)) {
            setError(last && "error" in last && last.error ? String(last.error) : "Could not save.")
            onPhase?.("relationships", "error", () => void saveCaregiversSection())
            return
          }
        }
      }
      const baseMap = new Map(baselineBlocks.map((block) => [block.relationshipBlockId, block]))
      for (const block of blockList.filter((item) => CAREGIVER_KINDS.has(item.kind))) {
        const prior = baseMap.get(block.relationshipBlockId)
        if (
          !prior ||
          prior.status !== block.status ||
          prior.statusDetail !== block.statusDetail ||
          prior.arrangementType !== block.arrangementType ||
          prior.arrangementDetail !== block.arrangementDetail ||
          prior.startedOn !== block.startedOn ||
          prior.endedOn !== block.endedOn ||
          prior.childrenAnswer !== block.childrenAnswer ||
          prior.siblingsAnswer !== block.siblingsAnswer
        ) {
          last = await updateRelationshipBlockAction(clientId, block)
          if (!last || ("error" in last && last.error)) {
            setError(last && "error" in last && last.error ? String(last.error) : "Could not save.")
            onPhase?.("relationships", "error", () => void saveCaregiversSection())
            return
          }
        }
      }
      if (last) {
        apply(last)
      } else {
        setBaselineAnswers((current) => ({
          ...current,
          motherOtherRelationships: answers.motherOtherRelationships,
          fatherOtherRelationships: answers.fatherOtherRelationships,
          caregiverArrangements: answers.caregiverArrangements,
        }))
        setBaselineBlocks((current) => {
          const draftMap = new Map(
            blockList
              .filter((item) => CAREGIVER_KINDS.has(item.kind))
              .map((block) => [block.relationshipBlockId, block])
          )
          return current.map((block) => draftMap.get(block.relationshipBlockId) ?? block)
        })
        onBlockAnswers?.(answers)
        onBlocks?.(blockList)
      }
      onPhase?.("relationships", "saved", null)
    } finally {
      setCaregiversSaving(false)
    }
  }

  function discardCaregiversSection() {
    setAnswers((current) => ({
      ...current,
      motherOtherRelationships: baselineAnswers.motherOtherRelationships,
      fatherOtherRelationships: baselineAnswers.fatherOtherRelationships,
      caregiverArrangements: baselineAnswers.caregiverArrangements,
    }))
    setBlockList((list) => {
      const baseMap = new Map(
        baselineBlocks
          .filter((block) => CAREGIVER_KINDS.has(block.kind))
          .map((block) => [block.relationshipBlockId, block])
      )
      return list.map((block) =>
        CAREGIVER_KINDS.has(block.kind) ? baseMap.get(block.relationshipBlockId) ?? block : block
      )
    })
    setError(null)
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
      : selection?.type === "new_person_draft"
        ? selection.blockId
        : null

  return (
    <div data-entry-point={NEW_RELATIONSHIP_ENTRY_POINTS.interview}>
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
                  onChange={setStatus}
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
                  onClientStatus={setStatus}
                  onBlockStatus={(nextStatus) => patchBlock(block.relationshipBlockId, { status: nextStatus })}
                  onOpenBlock={() => openBlock(block.relationshipBlockId)}
                  onOpenPerson={openPerson}
                  onAddToRelationship={(role) => openNewPerson(block.relationshipBlockId, role)}
                  onAddPartner={() => openNewPerson(block.relationshipBlockId, "partner")}
                  onAddChild={() => openNewPerson(block.relationshipBlockId, "child")}
                  onChildrenAnswer={(childrenAnswer) =>
                    patchBlock(block.relationshipBlockId, { childrenAnswer })
                  }
                />
              ))
            )}
            {currentBlocks.length === 0 ? (
              <button type="button" className={linkClass} onClick={() => openNewRelationship("client_current")}>
                + Add current relationship
              </button>
            ) : null}
          </section>

          <section className="space-y-3">
            <AnswerSelect
              id="previous_relationships_answer"
              label="Previous significant relationships"
              value={previous.length > 0 ? "yes" : answers.previousRelationships || ""}
              locked={previous.length > 0}
              onChange={(value) => setAnswer("previousRelationships", value)}
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
                  onStatus={(statusValue) => patchBlock(block.relationshipBlockId, { status: statusValue })}
                  onAddToRelationship={(role) => openNewPerson(block.relationshipBlockId, role)}
                  onAddPartner={() => openNewPerson(block.relationshipBlockId, "partner")}
                  onAddChild={() => openNewPerson(block.relationshipBlockId, "child")}
                  onChildrenAnswer={(childrenAnswer) =>
                    patchBlock(block.relationshipBlockId, { childrenAnswer })
                  }
                />
              ))}
            {answers.previousRelationships !== "none" ? (
              <button type="button" className={linkClass} onClick={() => openNewRelationship("client_previous")}>
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
              onChange={(value) => setAnswer("otherChildren", value)}
            />
            {(otherChildren.length > 0 || answers.otherChildren === "yes") &&
              otherChildren.map((block) => (
                <OtherChildrenTree
                  key={block.relationshipBlockId}
                  block={block}
                  people={people}
                  selectedId={selectedId}
                  onOpenPerson={openPerson}
                  onStatusDetail={(statusDetail) => patchBlock(block.relationshipBlockId, { statusDetail })}
                  onAddChild={() => openNewPerson(block.relationshipBlockId, "child")}
                />
              ))}
            {answers.otherChildren === "yes" || otherChildren.length > 0 ? (
              <button
                type="button"
                className={linkClass}
                onClick={() => openNewRelationship("client_other_children")}
              >
                + Add relationship
              </button>
            ) : null}
          </section>

          {unplacedIntimate.length > 0 ? (
            <UnplacedGroup people={unplacedIntimate} onOpenPerson={openPerson} onMove={(id) => setSelection({ type: "move", id })} />
          ) : null}

          <RelationshipSectionFooter
            unsavedCount={intimateUnsaved}
            saving={intimateSaving}
            onDiscard={discardIntimateSection}
            onSave={() => void saveIntimateSection()}
          />
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
                patchBlock(biological.relationshipBlockId, { status: statusValue })
              }
              onAddSibling={() => openNewPerson(biological.relationshipBlockId, "sibling")}
              onSiblingsAnswer={(siblingsAnswer) =>
                patchBlock(biological.relationshipBlockId, { siblingsAnswer })
              }
            />
          ) : null}

          <AnsweredSideSection
            id="mother_other_answer"
            label={motherName ? `Mother (${motherName}) · other relationships` : "Mother · other relationships"}
            answer={motherOther.length > 0 ? "yes" : answers.motherOtherRelationships || ""}
            locked={motherOther.length > 0}
            onAnswer={(value) => setAnswer("motherOtherRelationships", value)}
            onAdd={() => openNewRelationship("parent_other", { parentSide: "mother" })}
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
                onStatus={(statusValue) => patchBlock(block.relationshipBlockId, { status: statusValue })}
                onAddToRelationship={(role) => openNewPerson(block.relationshipBlockId, role)}
                onAddPartner={() => openNewPerson(block.relationshipBlockId, "partner")}
                onAddSibling={() => openNewPerson(block.relationshipBlockId, "sibling")}
                onSiblingsAnswer={(siblingsAnswer) =>
                  patchBlock(block.relationshipBlockId, { siblingsAnswer })
                }
              />
            ))}
          </AnsweredSideSection>

          <AnsweredSideSection
            id="father_other_answer"
            label={fatherName ? `Father (${fatherName}) · other relationships` : "Father · other relationships"}
            answer={fatherOther.length > 0 ? "yes" : answers.fatherOtherRelationships || ""}
            locked={fatherOther.length > 0}
            onAnswer={(value) => setAnswer("fatherOtherRelationships", value)}
            onAdd={() => openNewRelationship("parent_other", { parentSide: "father" })}
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
                onStatus={(statusValue) => patchBlock(block.relationshipBlockId, { status: statusValue })}
                onAddToRelationship={(role) => openNewPerson(block.relationshipBlockId, role)}
                onAddPartner={() => openNewPerson(block.relationshipBlockId, "partner")}
                onAddSibling={() => openNewPerson(block.relationshipBlockId, "sibling")}
                onSiblingsAnswer={(siblingsAnswer) =>
                  patchBlock(block.relationshipBlockId, { siblingsAnswer })
                }
              />
            ))}
          </AnsweredSideSection>

          <AnsweredSideSection
            id="caregiver_arrangements_answer"
            label="Other caregiver arrangements"
            answer={caregivers.length > 0 ? "yes" : answers.caregiverArrangements || ""}
            locked={caregivers.length > 0}
            onAnswer={(value) => setAnswer("caregiverArrangements", value)}
            onAdd={() => openNewRelationship("caregiver_arrangement")}
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
                  patchBlock(block.relationshipBlockId, {
                    arrangementType: arrangementType as RelationshipBlock["arrangementType"],
                  })
                }
                onAddCaregiver={() => openNewPerson(block.relationshipBlockId, "caregiver")}
                onAddSibling={() => openNewPerson(block.relationshipBlockId, "sibling")}
                onSiblingsAnswer={(siblingsAnswer) =>
                  patchBlock(block.relationshipBlockId, { siblingsAnswer })
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

          <RelationshipSectionFooter
            unsavedCount={caregiversUnsaved}
            saving={caregiversSaving}
            onDiscard={discardCaregiversSection}
            onSave={() => void saveCaregiversSection()}
          />
        </div>
      </InterviewSectionCard>

      {portalReady && selection
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
                    : selection.type === "block"
                      ? selectedBlock?.relationshipBlockId || "Relationship"
                      : selectedPerson?.givenName || "Person"
              }
              onDismiss={() => {
                if (
                  selection.type === "new_relationship_draft" ||
                  selection.type === "new_person_draft"
                ) {
                  setConfirmLeavePanel(true)
                  return
                }
                requestClosePanel()
              }}
            >
              {selection.type === "new_relationship_draft" ? (
                <NewRelationshipPanel
                  key={`new-rel-${selection.kind}-${selection.parentSide ?? ""}`}
                  kind={selection.kind}
                  parentSide={selection.parentSide ?? ""}
                  people={people}
                  locked={false}
                  error={error}
                  saving={panelSaving}
                  onSave={(draft) => void saveNewRelationshipDraft(draft)}
                  onCancel={closePanel}
                />
              ) : selection.type === "new_person_draft" && newPersonBlock ? (
                <NewPersonDraftForm
                  key={`new-person-${selection.blockId}-${selection.role}`}
                  block={newPersonBlock}
                  people={people}
                  role={selection.role}
                  error={error}
                  saving={panelSaving}
                  onSave={(draft) => void saveNewPersonDraft(selection.blockId, selection.role, draft)}
                  onCancel={closePanel}
                />
              ) : selection.type === "move" && selectedPerson ? (
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
                    saving={panelSaving}
                    error={error ?? ""}
                    onCancel={() => setSelection({ type: "person", id: selectedPerson.relationshipRecordId })}
                    onMove={async (destinationId, role, roleType) => {
                      setPanelSaving(true)
                      try {
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
                      } finally {
                        setPanelSaving(false)
                      }
                    }}
                  />
                </>
              ) : selection.type === "person" && selectedPerson ? (
                <InterviewPersonPanel
                  key={selectedPerson.relationshipRecordId}
                  person={selectedPerson}
                  block={blockList.find((item) => item.relationshipBlockId === selectedPerson.relationshipBlockId) ?? null}
                  error={error}
                  saving={panelSaving}
                  onDirtyChange={(dirty) => {
                    panelDirtyRef.current = dirty
                  }}
                  onClose={requestClosePanel}
                  onMove={() => setSelection({ type: "move", id: selectedPerson.relationshipRecordId })}
                  onRemove={async () => {
                    setPanelSaving(true)
                    try {
                      const removed = await run(() =>
                        removeBlockMemberAction(clientId, selectedPerson.relationshipRecordId)
                      )
                      if (removed) closePanel()
                    } finally {
                      setPanelSaving(false)
                    }
                  }}
                  onCancel={requestClosePanel}
                  onSave={async (draft) => {
                    setPanelSaving(true)
                    try {
                      const saved = await run(() =>
                        updateBlockMemberAction(clientId, personFromDraft(selectedPerson, draft))
                      )
                      if (saved) closePanel()
                    } finally {
                      setPanelSaving(false)
                    }
                  }}
                />
              ) : selection.type === "block" && selectedBlock ? (
                <InterviewBlockPanel
                  key={selectedBlock.relationshipBlockId}
                  block={selectedBlock}
                  locked={selectedBlock.relationshipBlockId === lockedId}
                  error={error}
                  saving={panelSaving}
                  onDirtyChange={(dirty) => {
                    panelDirtyRef.current = dirty
                  }}
                  onClose={requestClosePanel}
                  onRemove={
                    selectedBlock.kind !== "biological_parents" && selectedBlock.kind !== "client_other_children"
                      ? async () => {
                          setPanelSaving(true)
                          try {
                            const removed = await run(() =>
                              deleteRelationshipBlockAction(clientId, selectedBlock.relationshipBlockId)
                            )
                            if (removed) closePanel()
                          } finally {
                            setPanelSaving(false)
                          }
                        }
                      : undefined
                  }
                  onCancel={requestClosePanel}
                  onSave={async (draft) => {
                    setPanelSaving(true)
                    try {
                      const saved = await run(() => updateRelationshipBlockAction(clientId, draft))
                      if (saved) closePanel()
                    } finally {
                      setPanelSaving(false)
                    }
                  }}
                />
              ) : null}
            </RelationshipPanelShell>,
            document.body
          )
        : null}

      <DiscardChangesDialog
        open={confirmLeavePanel}
        onKeepEditing={() => setConfirmLeavePanel(false)}
        onDiscard={closePanel}
      />
    </div>
  )
}

function InterviewPersonPanel({
  person,
  block,
  error,
  saving,
  onDirtyChange,
  onClose,
  onMove,
  onRemove,
  onCancel,
  onSave,
}: {
  person: RelationshipRecord
  block: RelationshipBlock | null
  error: string | null
  saving: boolean
  onDirtyChange: (dirty: boolean) => void
  onClose: () => void
  onMove: () => void
  onRemove: () => Promise<void>
  onCancel: () => void
  onSave: (draft: PersonDraft) => Promise<void>
}) {
  const [draft, setDraft] = useState(() => draftFromPerson(person))
  const baseline = draftFromPerson(person)
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline)
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])
  const name = person.notKnown && person.blockRole === "parent"
    ? person.blockRoleType === "father"
      ? "Father"
      : "Mother"
    : person.givenName.trim() || "Person"
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
          onChange={setDraft}
        />
        <div className="mt-4">
          <button type="button" className="inline-flex min-h-10 items-center rounded-md border px-3 text-sm" onClick={onMove}>
            Move to…
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </div>
      <RelationshipEditFooter
        saving={saving}
        onRemove={removable ? () => void onRemove() : undefined}
        onCancel={onCancel}
        onSave={() => void onSave(draft)}
      />
    </>
  )
}

function InterviewBlockPanel({
  block,
  locked,
  error,
  saving,
  onDirtyChange,
  onClose,
  onRemove,
  onCancel,
  onSave,
}: {
  block: RelationshipBlock
  locked: boolean
  error: string | null
  saving: boolean
  onDirtyChange: (dirty: boolean) => void
  onClose: () => void
  onRemove?: () => Promise<void>
  onCancel: () => void
  onSave: (draft: RelationshipBlock) => Promise<void>
}) {
  const [draft, setDraft] = useState(block)
  const dirty =
    draft.status !== block.status ||
    draft.statusDetail !== block.statusDetail ||
    draft.arrangementType !== block.arrangementType ||
    draft.arrangementDetail !== block.arrangementDetail ||
    draft.startedOn !== block.startedOn ||
    draft.endedOn !== block.endedOn ||
    draft.childrenAnswer !== block.childrenAnswer ||
    draft.siblingsAnswer !== block.siblingsAnswer
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])
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
        <BlockFields block={draft} locked={locked} onChange={setDraft} />
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </div>
      <RelationshipEditFooter
        saving={saving}
        onRemove={onRemove ? () => void onRemove() : undefined}
        onCancel={onCancel}
        onSave={() => void onSave(draft)}
      />
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
  onAddToRelationship,
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
  onAddToRelationship: (role: BlockRole) => void
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
        <AddToRelationshipMenu block={block} onSelect={onAddToRelationship} />
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
  onAddToRelationship,
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
  onAddToRelationship: (role: BlockRole) => void
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
        <AddToRelationshipMenu block={block} onSelect={onAddToRelationship} />
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
  return (
    <div className={layer2BandClassName}>
      <TextField
        id={`${block.relationshipBlockId}-relationship-inline`}
        label="Relationship"
        placeholder="e.g. IVF with a donor, sole adoption"
        value={block.statusDetail}
        onChange={onStatusDetail}
      />
      {!block.statusDetail.trim() ? <Needs need="Unrecorded relationship" /> : null}
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
  onAddToRelationship,
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
  onAddToRelationship: (role: BlockRole) => void
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
        <AddToRelationshipMenu block={block} onSelect={onAddToRelationship} />
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
