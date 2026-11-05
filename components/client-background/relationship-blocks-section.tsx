"use client"

import { useEffect, useMemo, useRef, useState } from "react"

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
import { ClientAnswer, Field, PartialDatePicker, SelectField, TextField, selectClassName } from "@/components/client-background/fields"
import type { SavePhase } from "@/components/client-background/interview-autosave"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AppliedAnswer } from "@/lib/background-questionnaire/to-client-background"
import {
  answerKeyForBlock,
  childTypesForBlock,
  isPartneredClientStatus,
  needLabel,
  needsForBlock,
  needsForMember,
  previousBlocksInOrder,
  rolesForBlock,
  siblingTypesForBlock,
  statusesForBlock,
} from "@/lib/client-background/relationship-blocks"
import {
  ARRANGEMENT_TYPE_LABELS,
  ARRANGEMENT_TYPES,
  BLOCK_ANSWER_LABELS,
  BLOCK_ANSWERS,
  CAREGIVER_RELATIONSHIP_LABELS,
  CAREGIVER_RELATIONSHIPS,
  CHILD_TYPE_LABELS,
  CLIENT_RELATIONSHIP_STATUSES,
  CLIENT_RELATIONSHIP_STATUS_LABELS,
  CURRENT_BLOCK_STATUS_LABELS,
  DEPENDENCY_LABELS,
  DEPENDENCY_VALUES,
  HEALTH_STATUS_LABELS,
  HEALTH_STATUSES,
  PREVIOUS_BLOCK_STATUS_LABELS,
  RELATIONSHIP_LIVING_SITUATION_LABELS,
  RELATIONSHIP_LIVING_SITUATIONS,
  RELATIONSHIP_RATING_LABELS,
  RELATIONSHIP_RATING_VALUES,
  SEX_OPTIONS,
  SIBLING_BLOCK_TYPE_LABELS,
  emptyBlockAnswers,
  type ArrangementType,
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

const linkClass = "text-sm text-primary underline-offset-2 hover:underline"

function statusLabel(status: string): string {
  if (status === "never_in_a_relationship") return "Never in a relationship"
  if (status in CURRENT_BLOCK_STATUS_LABELS) return CURRENT_BLOCK_STATUS_LABELS[status as keyof typeof CURRENT_BLOCK_STATUS_LABELS]
  if (status in PREVIOUS_BLOCK_STATUS_LABELS) return PREVIOUS_BLOCK_STATUS_LABELS[status as keyof typeof PREVIOUS_BLOCK_STATUS_LABELS]
  return status
}

function blockTitle(block: RelationshipBlock): string {
  if (block.kind === "client_current") return "Current relationship"
  if (block.kind === "client_previous") return "Previous relationship"
  if (block.kind === "client_other_children") return "Other children"
  if (block.kind === "biological_parents") return "Biological parents"
  if (block.kind === "parent_other") return block.parentSide === "father" ? "Father's other relationship" : "Mother's other relationship"
  if (block.arrangementType && block.arrangementType in ARRANGEMENT_TYPE_LABELS) {
    return ARRANGEMENT_TYPE_LABELS[block.arrangementType]
  }
  return "Care arrangement"
}

function Needs({ need }: { need: string }) {
  return <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-950">{need}</span>
}

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
}) {
  const [people, setPeople] = useState(relationships)
  const [blockList, setBlockList] = useState(blocks ?? [])
  const [answers, setAnswers] = useState(blockAnswers ?? emptyBlockAnswers())
  const [status, setStatus] = useState(relationshipStatus)
  const [error, setError] = useState<string | null>(null)
  const inflight = useRef<Promise<void> | null>(null)

  useEffect(() => {
    if (!registerFlush) return
    return registerFlush(() => inflight.current ?? Promise.resolve())
  }, [registerFlush])

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

  function run(work: () => Promise<EditorState | null>) {
    const task = (async () => {
      onPhase?.("relationships", "saving", null)
      const result = await work()
      const ok = apply(result)
      onPhase?.("relationships", ok ? "saved" : "error", ok ? null : () => run(work))
    })()
    inflight.current = task
    return task
  }

  const currentBlocks = blockList
    .filter((block) => block.kind === "client_current")
    .sort((a, b) => a.displayOrder - b.displayOrder)
  const lockedId = isPartneredClientStatus(status.relationshipStatus) ? currentBlocks[0]?.relationshipBlockId ?? null : null
  const recordedChildren = people.filter(
    (person) => person.blockRole === "child" || person.relationshipToClient === "child_biological" || person.relationshipToClient === "child_step"
  ).length
  const unplaced = people.filter((person) => !person.relationshipBlockId)
  const biological = blockList.find((block) => block.kind === "biological_parents")
  const otherChildren = blockList.find((block) => block.kind === "client_other_children")

  return (
    <Card id="check-relationships" className="scroll-mt-28">
      <CardHeader>
        <CardTitle>Relationships</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <section className="space-y-4">
          <h3 className="text-sm font-medium">Partners and children</h3>
          <StatusFields
            value={status}
            client={relationshipClient}
            onChange={(next) => {
              setStatus(next)
              void run(() => saveRelationshipStatusBlockAction(clientId, next))
            }}
          />
          {childrenPrompt ? (
            <p className="text-sm text-blue-800">
              Client: {childrenPrompt} · {recordedChildren} recorded
            </p>
          ) : null}
          {currentBlocks.map((block) => (
            <BlockCard
              key={block.relationshipBlockId}
              clientId={clientId}
              block={block}
              people={people}
              lockedStatus={block.relationshipBlockId === lockedId}
              run={run}
            />
          ))}
          <button type="button" className={linkClass} onClick={() => void run(() => createRelationshipBlockAction(clientId, "client_current"))}>
            + Add another current relationship
          </button>
          <AnsweredBlocks
            clientId={clientId}
            title="Previous significant relationships"
            answer={answers.previousRelationships}
            answerKey="previousRelationships"
            kind="client_previous"
            blocks={previousBlocksInOrder(blockList)}
            people={people}
            run={run}
          />
          <OtherChildren
            clientId={clientId}
            answer={answers.otherChildren}
            block={otherChildren}
            people={people}
            run={run}
          />
        </section>
        <section className="space-y-4">
          <h3 className="text-sm font-medium">Primary caregivers and siblings</h3>
          {biological ? <BlockCard clientId={clientId} block={biological} people={people} lockedStatus={false} run={run} /> : null}
          <AnsweredBlocks
            clientId={clientId}
            title="Mother's other relationships"
            answer={answers.motherOtherRelationships}
            answerKey="motherOtherRelationships"
            kind="parent_other"
            parentSide="mother"
            blocks={blockList.filter((block) => block.kind === "parent_other" && block.parentSide === "mother")}
            people={people}
            run={run}
          />
          <AnsweredBlocks
            clientId={clientId}
            title="Father's other relationships"
            answer={answers.fatherOtherRelationships}
            answerKey="fatherOtherRelationships"
            kind="parent_other"
            parentSide="father"
            blocks={blockList.filter((block) => block.kind === "parent_other" && block.parentSide === "father")}
            people={people}
            run={run}
          />
          <AnsweredBlocks
            clientId={clientId}
            title="Other primary caregiver arrangements"
            answer={answers.caregiverArrangements}
            answerKey="caregiverArrangements"
            kind="caregiver_arrangement"
            blocks={blockList.filter((block) => block.kind === "caregiver_arrangement")}
            people={people}
            run={run}
          />
        </section>
        {unplaced.length > 0 ? (
          <section className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3">
            <h3 className="text-sm font-medium text-amber-950">Unplaced</h3>
            <p className="text-sm text-amber-950">These people could not be placed in a relationship.</p>
            {unplaced.map((person) => (
              <UnplacedRow key={person.relationshipRecordId} clientId={clientId} person={person} blocks={blockList} run={run} />
            ))}
          </section>
        ) : null}
      </CardContent>
    </Card>
  )
}

function StatusFields({
  value,
  client,
  onChange,
}: {
  value: ClientRelationshipStatusValue
  client?: AppliedAnswer<ClientRelationshipStatusValue>
  onChange: (value: ClientRelationshipStatusValue) => void
}) {
  return (
    <>
      <SelectField
        id="client_relationship_status"
        label="Current relationship status"
        value={value.relationshipStatus}
        client={
          client ? (
            <ClientAnswer
              label={client.label}
              matches={
                value.relationshipStatus === client.apply.relationshipStatus &&
                (client.apply.relationshipStatus !== "other" || value.relationshipStatusOther === client.apply.relationshipStatusOther)
              }
              onUse={() => onChange(client.apply)}
            />
          ) : undefined
        }
        onChange={(relationshipStatus) =>
          onChange({
            relationshipStatus: relationshipStatus as ClientRelationshipStatus | "",
            relationshipStatusOther: relationshipStatus === "other" ? value.relationshipStatusOther : "",
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
      {value.relationshipStatus === "other" ? (
        <TextField
          id="client_relationship_status_other"
          label="Other relationship status"
          value={value.relationshipStatusOther}
          onChange={(relationshipStatusOther) => onChange({ ...value, relationshipStatusOther })}
        />
      ) : null}
    </>
  )
}

function AnsweredBlocks({
  clientId,
  title,
  answer,
  answerKey,
  kind,
  parentSide,
  blocks,
  people,
  run,
}: {
  clientId: string
  title: string
  answer: RelationshipBlockAnswers[keyof RelationshipBlockAnswers]
  answerKey: keyof RelationshipBlockAnswers
  kind: BlockKind
  parentSide?: "mother" | "father"
  blocks: RelationshipBlock[]
  people: RelationshipRecord[]
  run: (work: () => Promise<EditorState | null>) => Promise<void>
}) {
  const shown = answer === "none" ? [] : blocks
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-medium">{title}</h4>
        <AnswerControl
          value={blocks.length > 0 ? "yes" : answer || "not_asked"}
          disabled={blocks.length > 0}
          onChange={(value) => void run(() => setRelationshipBlockAnswerAction(clientId, answerKey, value))}
        />
      </div>
      {shown.map((block) => (
        <BlockCard key={block.relationshipBlockId} clientId={clientId} block={block} people={people} lockedStatus={false} run={run} />
      ))}
      {answer !== "none" ? (
        <button
          type="button"
          className={linkClass}
          onClick={() =>
            void run(() =>
              createRelationshipBlockAction(clientId, kind, { parentSide })
            )
          }
        >
          {kind === "caregiver_arrangement" ? "+ Add arrangement" : "+ Add relationship"}
        </button>
      ) : null}
    </div>
  )
}

function AnswerControl({
  value,
  disabled,
  onChange,
}: {
  value: string
  disabled: boolean
  onChange: (value: BlockAnswer) => void
}) {
  return (
    <div className="flex gap-1">
      {BLOCK_ANSWERS.map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled && option !== "yes"}
          className={cn(
            "rounded-md px-2 py-1 text-xs",
            value === option ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}
          onClick={() => onChange(option)}
        >
          {BLOCK_ANSWER_LABELS[option]}
        </button>
      ))}
    </div>
  )
}

function OtherChildren({
  clientId,
  answer,
  block,
  people,
  run,
}: {
  clientId: string
  answer: RelationshipBlockAnswers["otherChildren"]
  block: RelationshipBlock | undefined
  people: RelationshipRecord[]
  run: (work: () => Promise<EditorState | null>) => Promise<void>
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-medium">Other children</h4>
        <AnswerControl
          value={block ? "yes" : answer || "not_asked"}
          disabled={Boolean(block)}
          onChange={(value) => void run(() => setRelationshipBlockAnswerAction(clientId, "otherChildren", value))}
        />
      </div>
      {answer !== "none" ? (
        <MemberList
          clientId={clientId}
          block={block}
          role="child"
          people={people}
          title="Children"
          addLabel="+ Add child"
          run={run}
          ensureBlock={() => createRelationshipBlockAction(clientId, "client_other_children")}
        />
      ) : null}
    </div>
  )
}

function BlockCard({
  clientId,
  block,
  people,
  lockedStatus,
  run,
}: {
  clientId: string
  block: RelationshipBlock
  people: RelationshipRecord[]
  lockedStatus: boolean
  run: (work: () => Promise<EditorState | null>) => Promise<void>
}) {
  const needs = needsForBlock(block, lockedStatus)
  const statuses = statusesForBlock(block.kind)
  const showChildren = block.kind === "client_current" || block.kind === "client_previous"
  const showPartners = rolesForBlock(block.kind).includes("partner")
  const showParents = block.kind === "biological_parents"
  const showCaregivers = block.kind === "caregiver_arrangement"
  const showSiblings = siblingTypesForBlock(block.kind).length > 0
  const children = people.filter((person) => person.relationshipBlockId === block.relationshipBlockId && person.blockRole === "child")

  function save(patch: Partial<RelationshipBlock>) {
    void run(() => updateRelationshipBlockAction(clientId, { ...block, ...patch }))
  }

  return (
    <section className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-medium">{blockTitle(block)}</h4>
        <span className="flex flex-wrap gap-1">
          {needs.map((need) => (
            <Needs key={need} need={needLabel(need)} />
          ))}
        </span>
      </div>
      {statuses.length > 0 ? (
        lockedStatus ? (
          <p className="text-sm">
            {statusLabel(block.status) || "Not recorded"}
            <span className="mt-1 block text-xs text-muted-foreground">Set by the client&apos;s relationship status.</span>
          </p>
        ) : (
          <SelectField id={`${block.relationshipBlockId}-status`} label="Status" value={block.status} onChange={(status) => save({ status })}>
            <option value="">Not recorded</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </SelectField>
        )
      ) : null}
      {block.status === "other" ? (
        <TextField
          id={`${block.relationshipBlockId}-status-detail`}
          label="Other status"
          value={block.statusDetail}
          onChange={(statusDetail) => save({ statusDetail })}
        />
      ) : null}
      {block.kind === "caregiver_arrangement" ? (
        <SelectField
          id={`${block.relationshipBlockId}-arrangement`}
          label="Arrangement"
          value={block.arrangementType}
          onChange={(arrangementType) => save({ arrangementType: arrangementType as ArrangementType | "" })}
        >
          <option value="">Not recorded</option>
          {ARRANGEMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {ARRANGEMENT_TYPE_LABELS[type]}
            </option>
          ))}
        </SelectField>
      ) : null}
      {block.kind !== "client_other_children" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <PartialDatePicker
            id={`${block.relationshipBlockId}-start`}
            dateLabel={block.arrangementType === "adoption" ? "From (adoption date)" : block.kind === "caregiver_arrangement" ? "From" : "Started"}
            mode="date-only"
            value={block.startedOn}
            onChange={(startedOn) => save({ startedOn })}
          />
          {block.kind !== "client_current" ? (
            <PartialDatePicker
              id={`${block.relationshipBlockId}-end`}
              dateLabel={block.kind === "caregiver_arrangement" ? "Until" : "Ended"}
              mode="date-only"
              value={block.endedOn}
              onChange={(endedOn) => save({ endedOn })}
            />
          ) : null}
        </div>
      ) : null}
      {showPartners ? (
        <MemberList clientId={clientId} block={block} role="partner" people={people} title="Partners" addLabel="+ Add another partner" run={run} />
      ) : null}
      {showParents ? (
        <MemberList clientId={clientId} block={block} role="parent" people={people} title="Parents" addLabel="+ Add parent" run={run} />
      ) : null}
      {showCaregivers ? (
        <MemberList
          clientId={clientId}
          block={block}
          role="caregiver"
          people={people}
          title={block.arrangementType === "adoption" ? "Adoptive parents" : "Caregivers"}
          addLabel="+ Add caregiver"
          run={run}
        />
      ) : null}
      {showChildren ? (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.noChildren}
              onChange={(event) => save({ noChildren: event.target.checked })}
            />
            No children
          </label>
          {block.noChildren ? null : (
            <MemberList clientId={clientId} block={block} role="child" people={people} title="Children" addLabel="+ Add child" run={run} />
          )}
          {block.noChildren && children.length > 0 ? (
            <MemberList clientId={clientId} block={block} role="child" people={people} title="Children" addLabel="+ Add child" run={run} />
          ) : null}
        </div>
      ) : null}
      {showSiblings ? (
        <MemberList clientId={clientId} block={block} role="sibling" people={people} title="Siblings" addLabel="+ Add sibling" run={run} />
      ) : null}
      {block.kind !== "biological_parents" && block.kind !== "client_other_children" ? (
        <button
          type="button"
          className="text-sm text-destructive underline-offset-2 hover:underline"
          onClick={() => void run(() => deleteRelationshipBlockAction(clientId, block.relationshipBlockId))}
        >
          Remove relationship
        </button>
      ) : null}
    </section>
  )
}

function MemberList({
  clientId,
  block,
  role,
  people,
  title,
  addLabel,
  run,
  ensureBlock,
}: {
  clientId: string
  block?: RelationshipBlock
  role: BlockRole
  people: RelationshipRecord[]
  title: string
  addLabel: string
  run: (work: () => Promise<EditorState | null>) => Promise<void>
  ensureBlock?: () => Promise<EditorState | null>
}) {
  const members = block ? people.filter((person) => person.relationshipBlockId === block.relationshipBlockId && person.blockRole === role) : []
  const defaultType =
    role === "sibling" && block ? siblingTypesForBlock(block.kind)[0] : role === "parent" ? "mother" : role === "child" ? "biological" : ""
  return (
    <div className="space-y-2">
      <h5 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h5>
      {members.map((person) => (
        <PersonRow key={person.relationshipRecordId} clientId={clientId} person={person} block={block} run={run} />
      ))}
      <button
        type="button"
        className={linkClass}
        onClick={() =>
          void run(async () => {
            let target = block
            if (!target && ensureBlock) {
              const created = await ensureBlock()
              if (!created || !("blocks" in created) || !created.blocks) return created
              target = created.blocks.find((item) => answerKeyForBlock(item) === "otherChildren") ?? created.blocks.at(-1)
            }
            if (!target) return { error: "Could not add." }
            return addBlockMemberAction(clientId, target.relationshipBlockId, role, defaultType)
          })
        }
      >
        {addLabel}
      </button>
    </div>
  )
}

function PersonRow({
  clientId,
  person,
  block,
  run,
}: {
  clientId: string
  person: RelationshipRecord
  block?: RelationshipBlock
  run: (work: () => Promise<EditorState | null>) => Promise<void>
}) {
  const [draft, setDraft] = useState(person)
  const timer = useRef<number | null>(null)
  useEffect(() => setDraft(person), [person])
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])
  const needs = block ? needsForMember(block, draft) : []
  const siblingTypes = block ? siblingTypesForBlock(block.kind) : []
  const childTypes = block ? childTypesForBlock(block.kind) : []

  function save(next: RelationshipRecord) {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      void run(() => updateBlockMemberAction(clientId, next))
    }, 400)
  }

  function patch(partial: Partial<RelationshipRecord>) {
    const next = { ...draft, ...partial }
    setDraft(next)
    save(next)
  }

  const removable = !(draft.blockRole === "parent" && (draft.relationshipToClient === "mother" || draft.relationshipToClient === "father"))

  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-2">
      <div className="flex flex-wrap gap-1">
        {needs.map((need) => (
          <Needs key={need} need={needLabel(need)} />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField id={`${draft.relationshipRecordId}-name`} label="Name" value={draft.givenName} onChange={(givenName) => patch({ givenName })} />
        {draft.blockRole === "partner" || draft.blockRole === "parent" || draft.blockRole === "sibling" ? (
          <SelectField id={`${draft.relationshipRecordId}-sex`} label="Sex" value={draft.sex} onChange={(sex) => patch({ sex })}>
            <option value="">Not recorded</option>
            {SEX_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </SelectField>
        ) : null}
        <PartialDatePicker
          id={`${draft.relationshipRecordId}-dob`}
          dateLabel="Date of birth"
          mode="person"
          value={draft.dateOfBirth}
          onChange={(dateOfBirth) => patch({ dateOfBirth })}
        />
        {draft.blockRole === "child" && childTypes.length > 0 ? (
          <SelectField
            id={`${draft.relationshipRecordId}-child-type`}
            label="Type"
            value={draft.blockRoleType || draft.childType}
            onChange={(blockRoleType) => patch({ blockRoleType, childType: blockRoleType as RelationshipRecord["childType"] })}
          >
            <option value="">Not recorded</option>
            {childTypes.map((type) => (
              <option key={type} value={type}>
                {CHILD_TYPE_LABELS[type]}
              </option>
            ))}
          </SelectField>
        ) : null}
        {draft.blockRole === "sibling" && siblingTypes.length > 0 ? (
          <SelectField
            id={`${draft.relationshipRecordId}-sibling-type`}
            label="Type"
            value={draft.blockRoleType ?? ""}
            onChange={(blockRoleType) => patch({ blockRoleType })}
            disabled={siblingTypes.length === 1}
          >
            {siblingTypes.map((type) => (
              <option key={type} value={type}>
                {SIBLING_BLOCK_TYPE_LABELS[type]}
              </option>
            ))}
          </SelectField>
        ) : null}
        {draft.blockRole === "parent" ? (
          <SelectField
            id={`${draft.relationshipRecordId}-parent-type`}
            label="Parent"
            value={draft.blockRoleType || (draft.relationshipToClient === "father" ? "father" : "mother")}
            onChange={(blockRoleType) => patch({ blockRoleType })}
          >
            <option value="mother">Mother</option>
            <option value="father">Father</option>
          </SelectField>
        ) : null}
        {draft.blockRole === "caregiver" && block?.arrangementType !== "adoption" ? (
          <SelectField
            id={`${draft.relationshipRecordId}-caregiver-type`}
            label="Relationship"
            value={draft.blockRoleType || draft.caregiverRelationship}
            onChange={(blockRoleType) => patch({ blockRoleType })}
          >
            <option value="">Not recorded</option>
            {CAREGIVER_RELATIONSHIPS.map((type) => (
              <option key={type} value={type}>
                {CAREGIVER_RELATIONSHIP_LABELS[type]}
              </option>
            ))}
          </SelectField>
        ) : null}
      </div>
      {draft.blockRole === "parent" ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.notKnown} onChange={(event) => patch({ notKnown: event.target.checked })} />
          Not known
        </label>
      ) : null}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Health, ratings, and living situation</summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <SelectField id={`${draft.relationshipRecordId}-health`} label="Health" value={draft.healthStatus} onChange={(healthStatus) => patch({ healthStatus: healthStatus as RelationshipRecord["healthStatus"] })}>
            <option value="">Not recorded</option>
            {HEALTH_STATUSES.map((option) => (
              <option key={option} value={option}>
                {HEALTH_STATUS_LABELS[option]}
              </option>
            ))}
          </SelectField>
          {draft.healthStatus === "deceased" ? (
            <PartialDatePicker
              id={`${draft.relationshipRecordId}-died`}
              dateLabel="Year of death"
              mode="date-only"
              value={draft.dateOfDeath}
              onChange={(dateOfDeath) => patch({ dateOfDeath })}
            />
          ) : null}
          <SelectField id={`${draft.relationshipRecordId}-support`} label="Supportive" value={draft.supportive} onChange={(supportive) => patch({ supportive: supportive as RelationshipRecord["supportive"] })}>
            <option value="">Not recorded</option>
            {RELATIONSHIP_RATING_VALUES.map((option) => (
              <option key={option} value={option}>
                {RELATIONSHIP_RATING_LABELS[option]}
              </option>
            ))}
          </SelectField>
          <SelectField id={`${draft.relationshipRecordId}-conflict`} label="Conflict" value={draft.conflict} onChange={(conflict) => patch({ conflict: conflict as RelationshipRecord["conflict"] })}>
            <option value="">Not recorded</option>
            {RELATIONSHIP_RATING_VALUES.map((option) => (
              <option key={option} value={option}>
                {RELATIONSHIP_RATING_LABELS[option]}
              </option>
            ))}
          </SelectField>
          <SelectField id={`${draft.relationshipRecordId}-dependency`} label="Dependency" value={draft.dependency} onChange={(dependency) => patch({ dependency: dependency as RelationshipRecord["dependency"] })}>
            <option value="">Not recorded</option>
            {DEPENDENCY_VALUES.map((option) => (
              <option key={option} value={option}>
                {DEPENDENCY_LABELS[option]}
              </option>
            ))}
          </SelectField>
          <SelectField
            id={`${draft.relationshipRecordId}-living`}
            label="Living situation"
            value={draft.livingSituation}
            onChange={(livingSituation) => patch({ livingSituation: livingSituation as RelationshipRecord["livingSituation"] })}
          >
            <option value="">Not recorded</option>
            {RELATIONSHIP_LIVING_SITUATIONS.map((option) => (
              <option key={option} value={option}>
                {RELATIONSHIP_LIVING_SITUATION_LABELS[option]}
              </option>
            ))}
          </SelectField>
        </div>
      </details>
      {removable ? (
        <button
          type="button"
          className="text-sm text-destructive underline-offset-2 hover:underline"
          onClick={() => void run(() => removeBlockMemberAction(clientId, draft.relationshipRecordId))}
        >
          Remove
        </button>
      ) : null}
    </div>
  )
}

function UnplacedRow({
  clientId,
  person,
  blocks,
  run,
}: {
  clientId: string
  person: RelationshipRecord
  blocks: RelationshipBlock[]
  run: (work: () => Promise<EditorState | null>) => Promise<void>
}) {
  const [blockId, setBlockId] = useState(blocks[0]?.relationshipBlockId ?? "")
  const block = blocks.find((item) => item.relationshipBlockId === blockId)
  const roles = block ? rolesForBlock(block.kind) : []
  const [role, setRole] = useState<BlockRole>(roles[0] ?? "child")
  const types = useMemo(() => {
    if (!block) return []
    if (role === "child") return [...childTypesForBlock(block.kind)]
    if (role === "sibling") return [...siblingTypesForBlock(block.kind)]
    if (role === "parent") return ["mother", "father"]
    return []
  }, [block, role])
  const [roleType, setRoleType] = useState(types[0] ?? "")
  useEffect(() => {
    if (roles[0] && !roles.includes(role)) setRole(roles[0])
  }, [roles, role])
  useEffect(() => {
    if (types[0] && !types.includes(roleType)) setRoleType(types[0])
  }, [types, roleType])

  return (
    <div className="space-y-2 rounded-md bg-white p-2 text-sm">
      <p className="font-medium">{person.givenName.trim() || person.relationshipToClient}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Move to">
          <select className={selectClassName} value={blockId} onChange={(event) => setBlockId(event.target.value)}>
            {blocks.map((item) => (
              <option key={item.relationshipBlockId} value={item.relationshipBlockId}>
                {blockTitle(item)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Role">
          <select className={selectClassName} value={role} onChange={(event) => setRole(event.target.value as BlockRole)}>
            {roles.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
        {types.length > 0 ? (
          <Field label="Type">
            <select className={selectClassName} value={roleType} onChange={(event) => setRoleType(event.target.value)}>
              {types.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>
      <button
        type="button"
        className={linkClass}
        onClick={() => void run(() => moveBlockMemberAction(clientId, person.relationshipRecordId, blockId, role, roleType))}
      >
        Move
      </button>
    </div>
  )
}
