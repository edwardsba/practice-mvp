import "server-only"

import { and, asc, eq } from "drizzle-orm"

import { auditEvents, clientBackgrounds, clientRelationshipBlocks, clientRelationshipRecords, clients } from "@/db/schema"
import { db } from "@/lib/db"
import { toBlockAnswers, toClientRelationshipStatus, toRelationship, toRelationshipBlock } from "@/lib/client-background/map"
import {
  answerAfterBlockCount,
  answerKeyForBlock,
  childTypesForBlock,
  clientStatusFromCurrentBlockEdit,
  isArrangementType,
  isBlockAnswer,
  isPartneredClientStatus,
  isSiblingBlockType,
  legacyRoleForMember,
  NEW_CURRENT_RELATIONSHIP,
  NEW_PREVIOUS_RELATIONSHIP,
  rolesForBlock,
  siblingTypesForBlock,
} from "@/lib/client-background/relationship-blocks"
import { sanitizeRelationship } from "@/lib/client-background/sanitize"
import { saveClientRelationshipStatus } from "@/lib/client-background/mutations"
import {
  refuseEmptyPersonDraft,
  refuseSecondCurrentFromBlocks,
} from "@/lib/client-background/person-draft"
import {
  CAREGIVER_RELATIONSHIPS,
  CHILD_TYPES,
  emptyBlockAnswers,
  type BlockAnswer,
  type BlockKind,
  type BlockRole,
  type RelationshipBlock,
  type RelationshipBlockAnswers,
  type RelationshipRecord,
} from "@/lib/client-background/types"

type Scope = { clientId: string; practiceId: string; userId: string }

export type BlockEditorState = {
  relationships: RelationshipRecord[]
  blocks: RelationshipBlock[]
  blockAnswers: RelationshipBlockAnswers
  relationshipStatus: { relationshipStatus: string; relationshipStatusOther: string }
}

async function ownedClient(clientId: string, practiceId: string) {
  const [client] = await db
    .select({ clientId: clients.clientId })
    .from(clients)
    .where(and(eq(clients.clientId, clientId), eq(clients.practiceId, practiceId), eq(clients.isActive, true)))
    .limit(1)
  return client ?? null
}

export async function loadBlockEditorState(clientId: string, practiceId: string): Promise<BlockEditorState | null> {
  if (!(await ownedClient(clientId, practiceId))) return null
  const [background] = await db
    .select()
    .from(clientBackgrounds)
    .where(and(eq(clientBackgrounds.clientId, clientId), eq(clientBackgrounds.practiceId, practiceId)))
    .limit(1)
  const people = await db
    .select()
    .from(clientRelationshipRecords)
    .where(and(eq(clientRelationshipRecords.clientId, clientId), eq(clientRelationshipRecords.practiceId, practiceId)))
    .orderBy(asc(clientRelationshipRecords.displayOrder))
  const blocks = await db
    .select()
    .from(clientRelationshipBlocks)
    .where(and(eq(clientRelationshipBlocks.clientId, clientId), eq(clientRelationshipBlocks.practiceId, practiceId)))
    .orderBy(asc(clientRelationshipBlocks.displayOrder))
  return {
    relationships: people.map(toRelationship),
    blocks: blocks.map(toRelationshipBlock),
    blockAnswers: toBlockAnswers(background ?? null),
    relationshipStatus: toClientRelationshipStatus(background ?? null),
  }
}

async function writeAudit(scope: Scope, eventType: string, entityType: string, entityId: string) {
  await db.insert(auditEvents).values({
    practiceId: scope.practiceId,
    userId: scope.userId,
    clientId: scope.clientId,
    eventType,
    entityType,
    entityId,
  })
}

async function writeAnswers(scope: Scope, answers: RelationshipBlockAnswers) {
  const values = {
    previousRelationships: answers.previousRelationships || null,
    otherChildren: answers.otherChildren || null,
    motherOtherRelationships: answers.motherOtherRelationships || null,
    fatherOtherRelationships: answers.fatherOtherRelationships || null,
    caregiverArrangements: answers.caregiverArrangements || null,
    updatedAt: new Date(),
  }
  const [existing] = await db
    .select({ id: clientBackgrounds.clientBackgroundId, practiceId: clientBackgrounds.practiceId })
    .from(clientBackgrounds)
    .where(eq(clientBackgrounds.clientId, scope.clientId))
    .limit(1)
  if (existing && existing.practiceId !== scope.practiceId) return
  if (!existing) {
    const [created] = await db
      .insert(clientBackgrounds)
      .values({ clientId: scope.clientId, practiceId: scope.practiceId, ...values })
      .returning({ id: clientBackgrounds.clientBackgroundId })
    await writeAudit(scope, "client_background.created", "client_background", created.id)
    return
  }
  await db.update(clientBackgrounds).set(values).where(eq(clientBackgrounds.clientBackgroundId, existing.id))
}

async function setAnswerFor(scope: Scope, key: keyof RelationshipBlockAnswers, value: BlockAnswer | "") {
  const state = await loadBlockEditorState(scope.clientId, scope.practiceId)
  if (!state) return
  await writeAnswers(scope, { ...state.blockAnswers, [key]: value })
}

function blocksOf(state: BlockEditorState, key: keyof RelationshipBlockAnswers) {
  return state.blocks.filter((block) => answerKeyForBlock(block) === key)
}

async function refreshAnswer(scope: Scope, key: keyof RelationshipBlockAnswers) {
  const state = await loadBlockEditorState(scope.clientId, scope.practiceId)
  if (!state) return
  const count = blocksOf(state, key).length
  const next = answerAfterBlockCount(count)
  if (count === 0 && state.blockAnswers[key] === "none") return
  if (state.blockAnswers[key] !== next) await setAnswerFor(scope, key, next)
}

function allowedType(kind: BlockKind, role: BlockRole, roleType: string, arrangementType: string): boolean {
  if (role === "child") return (CHILD_TYPES as readonly string[]).includes(roleType)
  if (role === "sibling") return siblingTypesForBlock(kind).includes(roleType as never) && isSiblingBlockType(roleType)
  if (role === "parent") return roleType === "mother" || roleType === "father"
  if (role === "caregiver") {
    if (arrangementType === "adoption") return roleType === "" || (CAREGIVER_RELATIONSHIPS as readonly string[]).includes(roleType)
    return (CAREGIVER_RELATIONSHIPS as readonly string[]).includes(roleType)
  }
  return roleType === ""
}

async function ownedBlock(scope: Scope, blockId: string) {
  const [block] = await db
    .select()
    .from(clientRelationshipBlocks)
    .where(
      and(
        eq(clientRelationshipBlocks.relationshipBlockId, blockId),
        eq(clientRelationshipBlocks.clientId, scope.clientId),
        eq(clientRelationshipBlocks.practiceId, scope.practiceId)
      )
    )
    .limit(1)
  return block ?? null
}

async function ownedPerson(scope: Scope, personId: string) {
  const [person] = await db
    .select()
    .from(clientRelationshipRecords)
    .where(
      and(
        eq(clientRelationshipRecords.relationshipRecordId, personId),
        eq(clientRelationshipRecords.clientId, scope.clientId),
        eq(clientRelationshipRecords.practiceId, scope.practiceId)
      )
    )
    .limit(1)
  return person ?? null
}

async function refuseSecondCurrent(scope: Scope, kind: BlockKind): Promise<string | null> {
  if (kind !== "client_current") return null
  const state = await loadBlockEditorState(scope.clientId, scope.practiceId)
  if (!state) return "Client was not found."
  return refuseSecondCurrentFromBlocks(state.blocks, kind)
}

export type SaveRelationshipPersonDraftInput = Scope & {
  /** Existing block — add the person here. Omit to create a new block. */
  relationshipBlockId?: string
  kind?: BlockKind
  parentSide?: "mother" | "father" | ""
  arrangementType?: string
  block?: {
    status?: string
    statusDetail?: string
    arrangementType?: string
    arrangementDetail?: string
    startedOn?: string
    endedOn?: string
    childrenAnswer?: string
    siblingsAnswer?: string
  }
  person: {
    givenName?: string
    sex?: string
    dateOfBirth?: string
    blockRole: BlockRole
    blockRoleType?: string
    livingSituation?: string
    healthStatus?: string
    deceased?: boolean
    dateOfDeath?: string
    supportive?: string
    conflict?: string
    qualityOfRelationship?: string
    dependency?: string
    notKnown?: boolean
  }
}

/**
 * Create a relationship block (if needed) and one person in a single transaction.
 * Refuses an empty person and a second client_current block. No write until Save.
 */
export async function saveRelationshipPersonDraft(input: SaveRelationshipPersonDraftInput) {
  if (!(await ownedClient(input.clientId, input.practiceId))) return { error: "Client was not found." }
  const empty = refuseEmptyPersonDraft({
    givenName: input.person.givenName ?? "",
    blockRoleType: input.person.blockRoleType ?? "",
  })
  if (empty) return { error: empty }

  const role = input.person.blockRole
  let blockId = input.relationshipBlockId?.trim() || ""
  let kind: BlockKind | null = null

  if (blockId) {
    const existing = await ownedBlock(input, blockId)
    if (!existing) return { error: "Relationship was not found." }
    kind = toRelationshipBlock(existing).kind
    if (!rolesForBlock(kind).includes(role)) {
      return { error: "That person does not belong in this relationship." }
    }
  } else {
    kind = input.kind ?? null
    if (!kind) return { error: "Choose a relationship type." }
    const second = await refuseSecondCurrent(input, kind)
    if (second) return { error: second }
    if (!rolesForBlock(kind).includes(role)) {
      return { error: "That person does not belong in this relationship." }
    }
  }

  const roleType = (input.person.blockRoleType ?? "").trim()
  const arrangementForCheck =
    input.block?.arrangementType ||
    input.arrangementType ||
    ""
  if (role !== "partner" && role !== "caregiver" && roleType && kind) {
    if (!allowedType(kind, role, roleType, arrangementForCheck)) {
      return { error: "Choose a type for this relationship." }
    }
  }

  const sanitizedPerson = sanitizeRelationship({
    relationshipRecordId: "",
    givenName: input.person.givenName ?? "",
    sex: input.person.sex ?? "",
    dateOfBirth: input.person.dateOfBirth ?? "",
    blockRole: role,
    blockRoleType: roleType,
    livingSituation: input.person.livingSituation ?? "",
    healthStatus: input.person.healthStatus ?? "",
    deceased: Boolean(input.person.deceased),
    dateOfDeath: input.person.dateOfDeath ?? "",
    supportive: input.person.supportive ?? "",
    conflict: input.person.conflict ?? "",
    qualityOfRelationship: input.person.qualityOfRelationship ?? "",
    dependency: input.person.dependency ?? "",
    notKnown: Boolean(input.person.notKnown),
  })

  let createdBlockId: string | null = null
  let createdMemberId: string | null = null

  await db.transaction(async (tx) => {
    if (!blockId && kind) {
      const state = await loadBlockEditorState(input.clientId, input.practiceId)
      if (!state) throw new Error("Client was not found.")
      if (kind === "biological_parents" || kind === "client_other_children") {
        const existing = state.blocks.find((block) => block.kind === kind)
        if (existing) {
          blockId = existing.relationshipBlockId
        }
      }
      if (!blockId) {
        const siblings = state.blocks.filter((block) => block.kind === kind)
        let parentRecordId: string | null = null
        const parentSide =
          input.parentSide === "mother" || input.parentSide === "father" ? input.parentSide : ""
        if (kind === "parent_other") {
          if (!parentSide) throw new Error("Choose which parent.")
          parentRecordId =
            state.relationships.find((person) => person.relationshipToClient === parentSide)
              ?.relationshipRecordId ?? null
        }
        const arrangementType =
          (input.block?.arrangementType || input.arrangementType) &&
          isArrangementType(input.block?.arrangementType || input.arrangementType || "")
            ? input.block?.arrangementType || input.arrangementType || ""
            : ""
        const [created] = await tx
          .insert(clientRelationshipBlocks)
          .values({
            clientId: input.clientId,
            practiceId: input.practiceId,
            kind,
            parentRecordId,
            parentSide: parentSide || null,
            arrangementType: arrangementType || null,
            status: input.block?.status?.trim() || null,
            statusDetail: input.block?.statusDetail?.trim() || null,
            arrangementDetail: input.block?.arrangementDetail?.trim() || null,
            startedOn: input.block?.startedOn?.trim() || null,
            endedOn: input.block?.endedOn?.trim() || null,
            childrenAnswer: isBlockAnswer(input.block?.childrenAnswer ?? "")
              ? input.block?.childrenAnswer
              : null,
            siblingsAnswer: isBlockAnswer(input.block?.siblingsAnswer ?? "")
              ? input.block?.siblingsAnswer
              : null,
            displayOrder: siblings.reduce((max, block) => Math.max(max, block.displayOrder), -1) + 1,
          })
          .returning()
        blockId = created.relationshipBlockId
        createdBlockId = created.relationshipBlockId
        await tx.insert(auditEvents).values({
          practiceId: input.practiceId,
          userId: input.userId,
          clientId: input.clientId,
          eventType: "client_relationship_block.created",
          entityType: "client_relationship_block",
          entityId: created.relationshipBlockId,
        })
        const answerKey = answerKeyForBlock(toRelationshipBlock(created))
        if (answerKey) {
          const [background] = await tx
            .select({ id: clientBackgrounds.clientBackgroundId, practiceId: clientBackgrounds.practiceId })
            .from(clientBackgrounds)
            .where(eq(clientBackgrounds.clientId, input.clientId))
            .limit(1)
          const answerValues = {
            previousRelationships: answerKey === "previousRelationships" ? "yes" : undefined,
            otherChildren: answerKey === "otherChildren" ? "yes" : undefined,
            motherOtherRelationships: answerKey === "motherOtherRelationships" ? "yes" : undefined,
            fatherOtherRelationships: answerKey === "fatherOtherRelationships" ? "yes" : undefined,
            caregiverArrangements: answerKey === "caregiverArrangements" ? "yes" : undefined,
            updatedAt: new Date(),
          }
          if (!background) {
            await tx.insert(clientBackgrounds).values({
              clientId: input.clientId,
              practiceId: input.practiceId,
              previousRelationships: answerKey === "previousRelationships" ? "yes" : null,
              otherChildren: answerKey === "otherChildren" ? "yes" : null,
              motherOtherRelationships: answerKey === "motherOtherRelationships" ? "yes" : null,
              fatherOtherRelationships: answerKey === "fatherOtherRelationships" ? "yes" : null,
              caregiverArrangements: answerKey === "caregiverArrangements" ? "yes" : null,
            })
          } else if (background.practiceId === input.practiceId) {
            const patch: Record<string, unknown> = { updatedAt: answerValues.updatedAt }
            if (answerKey === "previousRelationships") patch.previousRelationships = "yes"
            if (answerKey === "otherChildren") patch.otherChildren = "yes"
            if (answerKey === "motherOtherRelationships") patch.motherOtherRelationships = "yes"
            if (answerKey === "fatherOtherRelationships") patch.fatherOtherRelationships = "yes"
            if (answerKey === "caregiverArrangements") patch.caregiverArrangements = "yes"
            await tx
              .update(clientBackgrounds)
              .set(patch)
              .where(eq(clientBackgrounds.clientBackgroundId, background.id))
          }
        }
      }
    } else if (blockId && input.block) {
      const existing = await ownedBlock(input, blockId)
      if (existing) {
        await tx
          .update(clientRelationshipBlocks)
          .set({
            status: input.block.status?.trim() || existing.status,
            statusDetail: input.block.statusDetail?.trim() || existing.statusDetail,
            arrangementType: input.block.arrangementType?.trim() || existing.arrangementType,
            arrangementDetail: input.block.arrangementDetail?.trim() || existing.arrangementDetail,
            startedOn: input.block.startedOn?.trim() || existing.startedOn,
            endedOn: input.block.endedOn?.trim() || existing.endedOn,
            childrenAnswer: isBlockAnswer(input.block.childrenAnswer ?? "")
              ? input.block.childrenAnswer
              : existing.childrenAnswer,
            siblingsAnswer: isBlockAnswer(input.block.siblingsAnswer ?? "")
              ? input.block.siblingsAnswer
              : existing.siblingsAnswer,
            updatedAt: new Date(),
          })
          .where(eq(clientRelationshipBlocks.relationshipBlockId, blockId))
      }
    }

    if (!blockId || !kind) throw new Error("Relationship was not found.")

    const rows = await tx
      .select({ displayOrder: clientRelationshipRecords.displayOrder })
      .from(clientRelationshipRecords)
      .where(
        and(
          eq(clientRelationshipRecords.clientId, input.clientId),
          eq(clientRelationshipRecords.practiceId, input.practiceId)
        )
      )
    const displayOrder = rows.reduce((max, row) => Math.max(max, row.displayOrder), -1) + 1
    const siblingType =
      role === "sibling" ? roleType || siblingTypesForBlock(kind)[0] || "" : roleType
    const legacy = legacyRoleForMember(kind, role, siblingType)
    const [createdPerson] = await tx
      .insert(clientRelationshipRecords)
      .values({
        clientId: input.clientId,
        practiceId: input.practiceId,
        relationshipToClient: legacy,
        givenName: sanitizedPerson.givenName || null,
        sex: sanitizedPerson.sex || null,
        dateOfBirth: sanitizedPerson.dateOfBirth || null,
        deceased: sanitizedPerson.deceased,
        healthStatus: sanitizedPerson.healthStatus || null,
        dateOfDeath: sanitizedPerson.dateOfDeath || null,
        supportive: sanitizedPerson.supportive || null,
        conflict: sanitizedPerson.conflict || null,
        qualityOfRelationship: sanitizedPerson.qualityOfRelationship || null,
        dependency: sanitizedPerson.dependency || null,
        livingSituation: sanitizedPerson.livingSituation || null,
        notKnown: sanitizedPerson.notKnown,
        displayOrder,
        relationshipBlockId: blockId,
        blockRole: role,
        blockRoleType: siblingType || null,
        caregiverRelationship: role === "caregiver" ? siblingType || null : null,
      })
      .returning()
    createdMemberId = createdPerson.relationshipRecordId
    await tx.insert(auditEvents).values({
      practiceId: input.practiceId,
      userId: input.userId,
      clientId: input.clientId,
      eventType: "client_relationship.created",
      entityType: "client_relationship",
      entityId: createdPerson.relationshipRecordId,
    })
    if (role === "child") {
      await tx
        .update(clientRelationshipBlocks)
        .set({ childrenAnswer: "yes", updatedAt: new Date() })
        .where(eq(clientRelationshipBlocks.relationshipBlockId, blockId))
    }
    if (role === "sibling") {
      await tx
        .update(clientRelationshipBlocks)
        .set({ siblingsAnswer: "yes", updatedAt: new Date() })
        .where(eq(clientRelationshipBlocks.relationshipBlockId, blockId))
    }
  })

  const state = await loadBlockEditorState(input.clientId, input.practiceId)
  return {
    ...state,
    createdBlockId,
    createdMemberId,
  }
}

/** Create an unplaced person for History "Who → + Add person". */
export type CreateUnplacedPersonInput = Scope & {
  givenName?: string
  sex?: string
  dateOfBirth?: string
  healthStatus?: string
  deceased?: boolean
  dateOfDeath?: string
  supportive?: string
  conflict?: string
  qualityOfRelationship?: string
  dependency?: string
  livingSituation?: string
  notKnown?: boolean
  blockRoleType?: string
}

/**
 * Create an unplaced person (History Who). Refuses an empty draft.
 * Prefer passing the full person draft from the shared form; nothing is written until Save.
 */
export async function createUnplacedPerson(input: CreateUnplacedPersonInput) {
  if (!(await ownedClient(input.clientId, input.practiceId))) return { error: "Client was not found." }
  const empty = refuseEmptyPersonDraft({
    givenName: input.givenName ?? "",
    blockRoleType: input.blockRoleType ?? "",
  })
  if (empty) return { error: empty }

  const sanitized = sanitizeRelationship({
    relationshipRecordId: "",
    givenName: input.givenName ?? "",
    sex: input.sex ?? "",
    dateOfBirth: input.dateOfBirth ?? "",
    healthStatus: input.healthStatus ?? "",
    deceased: Boolean(input.deceased),
    dateOfDeath: input.dateOfDeath ?? "",
    supportive: input.supportive ?? "",
    conflict: input.conflict ?? "",
    qualityOfRelationship: input.qualityOfRelationship ?? "",
    dependency: input.dependency ?? "",
    livingSituation: input.livingSituation ?? "",
    notKnown: Boolean(input.notKnown),
    relationshipToClient: "other_caregiver",
  })

  const rows = await db
    .select({ displayOrder: clientRelationshipRecords.displayOrder })
    .from(clientRelationshipRecords)
    .where(and(eq(clientRelationshipRecords.clientId, input.clientId), eq(clientRelationshipRecords.practiceId, input.practiceId)))
  const displayOrder = rows.reduce((max, row) => Math.max(max, row.displayOrder), -1) + 1
  const [created] = await db
    .insert(clientRelationshipRecords)
    .values({
      clientId: input.clientId,
      practiceId: input.practiceId,
      relationshipToClient: "other_caregiver",
      givenName: sanitized.givenName || null,
      sex: sanitized.sex || null,
      dateOfBirth: sanitized.dateOfBirth || null,
      healthStatus: sanitized.healthStatus || null,
      deceased: sanitized.deceased,
      dateOfDeath: sanitized.dateOfDeath || null,
      supportive: sanitized.supportive || null,
      conflict: sanitized.conflict || null,
      qualityOfRelationship: sanitized.qualityOfRelationship || null,
      dependency: sanitized.dependency || null,
      livingSituation: sanitized.livingSituation || null,
      notKnown: sanitized.notKnown,
      displayOrder,
      placementReview: "unplaced",
    })
    .returning()
  await writeAudit(input, "client_relationship.created", "client_relationship", created.relationshipRecordId)
  return {
    ...(await loadBlockEditorState(input.clientId, input.practiceId)),
    createdMemberId: created.relationshipRecordId,
  }
}

export async function createRelationshipBlock(input: Scope & {
  kind: BlockKind
  parentSide?: "mother" | "father" | ""
  arrangementType?: string
}) {
  if (!(await ownedClient(input.clientId, input.practiceId))) return { error: "Client was not found." }
  const kind = input.kind
  const second = await refuseSecondCurrent(input, kind)
  if (second) return { error: second }
  if (kind === "biological_parents" || kind === "client_other_children") {
    const state = await loadBlockEditorState(input.clientId, input.practiceId)
    if (state?.blocks.some((block) => block.kind === kind)) return loadBlockEditorState(input.clientId, input.practiceId)
  }
  const state = await loadBlockEditorState(input.clientId, input.practiceId)
  if (!state) return { error: "Client was not found." }
  const siblings = state.blocks.filter((block) => block.kind === kind)
  let parentRecordId: string | null = null
  const parentSide = input.parentSide === "mother" || input.parentSide === "father" ? input.parentSide : ""
  if (kind === "parent_other") {
    if (!parentSide) return { error: "Choose which parent." }
    parentRecordId =
      state.relationships.find((person) => person.relationshipToClient === parentSide)?.relationshipRecordId ?? null
  }
  const arrangementType = input.arrangementType && isArrangementType(input.arrangementType) ? input.arrangementType : ""
  const [created] = await db
    .insert(clientRelationshipBlocks)
    .values({
      clientId: input.clientId,
      practiceId: input.practiceId,
      kind,
      parentRecordId,
      parentSide: parentSide || null,
      arrangementType: arrangementType || null,
      displayOrder: siblings.reduce((max, block) => Math.max(max, block.displayOrder), -1) + 1,
    })
    .returning()
  await writeAudit(input, "client_relationship_block.created", "client_relationship_block", created.relationshipBlockId)
  const key = answerKeyForBlock(toRelationshipBlock(created))
  if (key) await setAnswerFor(input, key, "yes")
  return loadBlockEditorState(input.clientId, input.practiceId)
}

export async function updateRelationshipBlock(input: Scope & { block: unknown }) {
  const raw = input.block && typeof input.block === "object" ? (input.block as Record<string, unknown>) : null
  const blockId = typeof raw?.relationshipBlockId === "string" ? raw.relationshipBlockId : ""
  const existing = blockId ? await ownedBlock(input, blockId) : null
  if (!existing) return { error: "Relationship was not found." }
  const status = typeof raw?.status === "string" ? raw.status : existing.status
  const statusDetail = typeof raw?.statusDetail === "string" ? raw.statusDetail : existing.statusDetail
  const arrangementType = typeof raw?.arrangementType === "string" ? raw.arrangementType : existing.arrangementType
  const arrangementDetail = typeof raw?.arrangementDetail === "string" ? raw.arrangementDetail : existing.arrangementDetail
  const startedOn = typeof raw?.startedOn === "string" ? raw.startedOn : existing.startedOn
  const endedOn = typeof raw?.endedOn === "string" ? raw.endedOn : existing.endedOn
  const childrenAnswerRaw = typeof raw?.childrenAnswer === "string" ? raw.childrenAnswer : existing.childrenAnswer
  const siblingsAnswerRaw = typeof raw?.siblingsAnswer === "string" ? raw.siblingsAnswer : existing.siblingsAnswer
  const childrenAnswer = isBlockAnswer(childrenAnswerRaw ?? "") ? childrenAnswerRaw : null
  const siblingsAnswer = isBlockAnswer(siblingsAnswerRaw ?? "") ? siblingsAnswerRaw : null
  const keepStatusDetail = existing.kind === "client_other_children" || status === "other"
  const mirrored = clientStatusFromCurrentBlockEdit(
    existing.kind,
    status ?? "",
    keepStatusDetail ? statusDetail ?? "" : ""
  )
  await db.transaction(async (tx) => {
    await tx
      .update(clientRelationshipBlocks)
      .set({
        status: status || null,
        statusDetail: keepStatusDetail ? statusDetail || null : null,
        arrangementType: arrangementType || null,
        arrangementDetail: arrangementType === "other" ? arrangementDetail || null : null,
        startedOn: startedOn || null,
        endedOn: endedOn || null,
        childrenAnswer,
        siblingsAnswer,
        updatedAt: new Date(),
      })
      .where(eq(clientRelationshipBlocks.relationshipBlockId, existing.relationshipBlockId))
    if (mirrored) {
      const now = new Date()
      const [background] = await tx
        .select({ clientBackgroundId: clientBackgrounds.clientBackgroundId })
        .from(clientBackgrounds)
        .where(
          and(
            eq(clientBackgrounds.clientId, input.clientId),
            eq(clientBackgrounds.practiceId, input.practiceId)
          )
        )
        .limit(1)
      if (background) {
        await tx
          .update(clientBackgrounds)
          .set({
            relationshipStatus: mirrored.relationshipStatus || null,
            relationshipStatusOther: mirrored.relationshipStatusOther || null,
            updatedAt: now,
          })
          .where(eq(clientBackgrounds.clientBackgroundId, background.clientBackgroundId))
      } else {
        await tx.insert(clientBackgrounds).values({
          clientId: input.clientId,
          practiceId: input.practiceId,
          relationshipStatus: mirrored.relationshipStatus || null,
          relationshipStatusOther: mirrored.relationshipStatusOther || null,
          updatedAt: now,
        })
      }
    }
  })
  return loadBlockEditorState(input.clientId, input.practiceId)
}

/** Unlink people from a block into Not placed — never silent-delete them with the block. */
async function unplaceMembersOfBlock(scope: Scope, relationshipBlockId: string) {
  const members = await db
    .select({ relationshipRecordId: clientRelationshipRecords.relationshipRecordId })
    .from(clientRelationshipRecords)
    .where(
      and(
        eq(clientRelationshipRecords.relationshipBlockId, relationshipBlockId),
        eq(clientRelationshipRecords.clientId, scope.clientId),
        eq(clientRelationshipRecords.practiceId, scope.practiceId)
      )
    )
  if (members.length === 0) return
  await db
    .update(clientRelationshipRecords)
    .set({
      relationshipBlockId: null,
      placementReview: "unplaced",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(clientRelationshipRecords.relationshipBlockId, relationshipBlockId),
        eq(clientRelationshipRecords.clientId, scope.clientId),
        eq(clientRelationshipRecords.practiceId, scope.practiceId)
      )
    )
  for (const member of members) {
    await writeAudit(scope, "client_relationship.unplaced", "client_relationship", member.relationshipRecordId)
  }
}

export async function deleteRelationshipBlock(input: Scope & { relationshipBlockId: string }) {
  const existing = await ownedBlock(input, input.relationshipBlockId)
  if (!existing) return { error: "Relationship was not found." }
  if (existing.kind === "biological_parents") return { error: "The biological parents block stays." }
  const block = toRelationshipBlock(existing)
  await unplaceMembersOfBlock(input, existing.relationshipBlockId)
  await db
    .delete(clientRelationshipBlocks)
    .where(eq(clientRelationshipBlocks.relationshipBlockId, existing.relationshipBlockId))
  await writeAudit(input, "client_relationship_block.deleted", "client_relationship_block", existing.relationshipBlockId)
  const key = answerKeyForBlock(block)
  if (key) await refreshAnswer(input, key)
  return loadBlockEditorState(input.clientId, input.practiceId)
}

export async function setRelationshipBlockAnswer(input: Scope & { key: keyof RelationshipBlockAnswers; value: string }) {
  if (!isBlockAnswer(input.value)) return { error: "Choose Yes, None, or Not asked." }
  const state = await loadBlockEditorState(input.clientId, input.practiceId)
  if (!state) return { error: "Client was not found." }
  const count = blocksOf(state, input.key).length
  if (count > 0 && input.value !== "yes") return { error: "Remove the relationships first." }
  if (count === 0 && input.value === "yes") {
    await setAnswerFor(input, input.key, "yes")
    return loadBlockEditorState(input.clientId, input.practiceId)
  }
  const stored = count > 0 ? "yes" : input.value === "none" ? "none" : answerAfterBlockCount(0)
  if (input.value === "not_asked" || input.value === "none") await setAnswerFor(input, input.key, input.value)
  else await setAnswerFor(input, input.key, stored)
  return loadBlockEditorState(input.clientId, input.practiceId)
}

export async function addBlockMember(input: Scope & { relationshipBlockId: string; role: BlockRole; roleType?: string }) {
  const blockRow = await ownedBlock(input, input.relationshipBlockId)
  if (!blockRow) return { error: "Relationship was not found." }
  const block = toRelationshipBlock(blockRow)
  if (!rolesForBlock(block.kind).includes(input.role)) return { error: "That person does not belong in this relationship." }
  const roleType = (input.roleType ?? "").trim()
  if (input.role !== "partner" && input.role !== "caregiver" && !allowedType(block.kind, input.role, roleType, block.arrangementType)) {
    if (input.role === "child" || input.role === "sibling" || input.role === "parent") {
      if (roleType && !allowedType(block.kind, input.role, roleType, block.arrangementType)) {
        return { error: "Choose a type for this relationship." }
      }
    }
  }
  if (input.role === "sibling" && !siblingTypesForBlock(block.kind).includes((roleType || siblingTypesForBlock(block.kind)[0]) as never)) {
    return { error: "Choose a type for this relationship." }
  }
  const siblingType = input.role === "sibling" ? roleType || siblingTypesForBlock(block.kind)[0] || "" : roleType
  if (input.role === "parent" && siblingType !== "mother" && siblingType !== "father") return { error: "Choose mother or father." }
  if (input.role === "child" && roleType && !(CHILD_TYPES as readonly string[]).includes(roleType)) {
    return { error: "Choose a type for this child." }
  }
  if (input.role === "child" && childTypesForBlock(block.kind).length === 0) return { error: "This relationship has no children." }
  const rows = await db
    .select({ displayOrder: clientRelationshipRecords.displayOrder })
    .from(clientRelationshipRecords)
    .where(and(eq(clientRelationshipRecords.clientId, input.clientId), eq(clientRelationshipRecords.practiceId, input.practiceId)))
  const displayOrder = rows.reduce((max, row) => Math.max(max, row.displayOrder), -1) + 1
  const legacy = legacyRoleForMember(block.kind, input.role, siblingType)
  const [created] = await db
    .insert(clientRelationshipRecords)
    .values({
      clientId: input.clientId,
      practiceId: input.practiceId,
      relationshipToClient: legacy,
      displayOrder,
      relationshipBlockId: block.relationshipBlockId,
      blockRole: input.role,
      blockRoleType: siblingType || null,
      caregiverRelationship: input.role === "caregiver" ? siblingType || null : null,
    })
    .returning()
  await writeAudit(input, "client_relationship.created", "client_relationship", created.relationshipRecordId)
  if (input.role === "child") {
    await db
      .update(clientRelationshipBlocks)
      .set({ childrenAnswer: "yes", updatedAt: new Date() })
      .where(eq(clientRelationshipBlocks.relationshipBlockId, block.relationshipBlockId))
  }
  if (input.role === "sibling") {
    await db
      .update(clientRelationshipBlocks)
      .set({ siblingsAnswer: "yes", updatedAt: new Date() })
      .where(eq(clientRelationshipBlocks.relationshipBlockId, block.relationshipBlockId))
  }
  return loadBlockEditorState(input.clientId, input.practiceId)
}

export async function updateBlockMember(input: Scope & { relationship: unknown }) {
  const draft = sanitizeRelationship(input.relationship)
  const existing = draft.relationshipRecordId ? await ownedPerson(input, draft.relationshipRecordId) : null
  if (!existing) return { error: "Person was not found." }
  const block = existing.relationshipBlockId ? await ownedBlock(input, existing.relationshipBlockId) : null
  const role = (existing.blockRole || draft.blockRole || "") as BlockRole | ""
  let roleType = draft.blockRoleType
  if (block && role === "sibling" && roleType && !isSiblingBlockType(roleType)) roleType = existing.blockRoleType ?? ""
  if (block && role === "sibling" && roleType && !siblingTypesForBlock(toRelationshipBlock(block).kind).includes(roleType as never)) {
    return { error: "Choose a type for this relationship." }
  }
  const kind = block ? toRelationshipBlock(block).kind : "biological_parents"
  const legacy = role ? legacyRoleForMember(kind, role, roleType ?? "") : existing.relationshipToClient
  await db
    .update(clientRelationshipRecords)
    .set({
      relationshipToClient: legacy,
      sex: draft.sex || null,
      givenName: draft.givenName || null,
      dateOfBirth: draft.dateOfBirth || null,
      deceased: draft.deceased,
      healthStatus: draft.healthStatus || null,
      dateOfDeath: draft.dateOfDeath || null,
      healthOrCauseOfDeath: draft.healthOrCauseOfDeath || null,
      supportive: draft.supportive || null,
      conflict: draft.conflict || null,
      qualityOfRelationship: draft.qualityOfRelationship || null,
      dependency: draft.dependency || null,
      livingSituation: draft.livingSituation || null,
      notKnown: draft.notKnown,
      blockRole: role || null,
      blockRoleType: roleType || null,
      childTypeDetail: role === "child" ? draft.childTypeDetail || null : existing.childTypeDetail,
      caregiverRelationship: role === "caregiver" ? roleType || null : existing.caregiverRelationship,
      caregiverRelationshipDetail: role === "caregiver" ? draft.caregiverRelationshipDetail || null : existing.caregiverRelationshipDetail,
      updatedAt: new Date(),
    })
    .where(eq(clientRelationshipRecords.relationshipRecordId, existing.relationshipRecordId))
  return loadBlockEditorState(input.clientId, input.practiceId)
}

export async function removeBlockMember(input: Scope & { relationshipRecordId: string }) {
  const existing = await ownedPerson(input, input.relationshipRecordId)
  if (!existing) return { error: "Person was not found." }
  if (existing.blockRole === "parent" && (existing.relationshipToClient === "mother" || existing.relationshipToClient === "father")) {
    return { error: "Mark a parent as not known instead of removing them." }
  }
  const blockId = existing.relationshipBlockId
  const role = existing.blockRole
  await db
    .delete(clientRelationshipRecords)
    .where(
      and(
        eq(clientRelationshipRecords.relationshipRecordId, existing.relationshipRecordId),
        eq(clientRelationshipRecords.practiceId, input.practiceId)
      )
    )
  await writeAudit(input, "client_relationship.deleted", "client_relationship", existing.relationshipRecordId)
  if (blockId && (role === "child" || role === "sibling")) {
    await refreshMemberAnswer(input, blockId, role)
  }
  return loadBlockEditorState(input.clientId, input.practiceId)
}

/** Removing the last child/sibling sets Not asked, never None. */
async function refreshMemberAnswer(scope: Scope, blockId: string, role: "child" | "sibling") {
  const remaining = await db
    .select({ relationshipRecordId: clientRelationshipRecords.relationshipRecordId })
    .from(clientRelationshipRecords)
    .where(
      and(
        eq(clientRelationshipRecords.relationshipBlockId, blockId),
        eq(clientRelationshipRecords.clientId, scope.clientId),
        eq(clientRelationshipRecords.practiceId, scope.practiceId),
        eq(clientRelationshipRecords.blockRole, role)
      )
    )
  if (remaining.length > 0) return
  if (role === "child") {
    await db
      .update(clientRelationshipBlocks)
      .set({ childrenAnswer: "not_asked", updatedAt: new Date() })
      .where(eq(clientRelationshipBlocks.relationshipBlockId, blockId))
    return
  }
  await db
    .update(clientRelationshipBlocks)
    .set({ siblingsAnswer: "not_asked", updatedAt: new Date() })
    .where(eq(clientRelationshipBlocks.relationshipBlockId, blockId))
}

export async function moveBlockMember(input: Scope & {
  relationshipRecordId: string
  relationshipBlockId: string
  role: BlockRole
  roleType?: string
}) {
  const person = await ownedPerson(input, input.relationshipRecordId)
  if (!person) return { error: "Person was not found." }
  let destinationId = input.relationshipBlockId
  if (destinationId === NEW_CURRENT_RELATIONSHIP || destinationId === NEW_PREVIOUS_RELATIONSHIP) {
    const kind = destinationId === NEW_CURRENT_RELATIONSHIP ? "client_current" : "client_previous"
    if (kind === "client_current") {
      const second = await refuseSecondCurrent(input, kind)
      if (second) return { error: second }
    }
    const created = await createRelationshipBlock({
      ...input,
      kind,
    })
    if (!created || !("blocks" in created) || !created.blocks) return created ?? { error: "Could not add the relationship." }
    if ("error" in created && created.error) return created
    const newest = created.blocks
      .filter((block) => block.kind === kind)
      .sort((a, b) => b.displayOrder - a.displayOrder)[0]
    if (!newest) return { error: "Could not add the relationship." }
    destinationId = newest.relationshipBlockId
  }
  const blockRow = await ownedBlock(input, destinationId)
  if (!blockRow) return { error: "Choose a relationship to move them to." }
  const block = toRelationshipBlock(blockRow)
  if (!rolesForBlock(block.kind).includes(input.role)) return { error: "That person does not belong in this relationship." }
  const roleType = (input.roleType ?? siblingTypesForBlock(block.kind)[0] ?? "").trim()
  if (
    (input.role === "child" || input.role === "sibling" || input.role === "parent" || input.role === "caregiver") &&
    !allowedType(block.kind, input.role, roleType, block.arrangementType)
  ) {
    return { error: "Choose a type for this relationship." }
  }
  const previousBlockId = person.relationshipBlockId
  const previousRole = person.blockRole
  await db
    .update(clientRelationshipRecords)
    .set({
      relationshipBlockId: block.relationshipBlockId,
      blockRole: input.role,
      blockRoleType: roleType || null,
      relationshipToClient: legacyRoleForMember(block.kind, input.role, roleType),
      placementReview: null,
      caregiverRelationship: input.role === "caregiver" ? roleType || null : person.caregiverRelationship,
      updatedAt: new Date(),
    })
    .where(eq(clientRelationshipRecords.relationshipRecordId, person.relationshipRecordId))
  await writeAudit(input, "client_relationship.moved", "client_relationship", person.relationshipRecordId)
  if (input.role === "child") {
    await db
      .update(clientRelationshipBlocks)
      .set({ childrenAnswer: "yes", updatedAt: new Date() })
      .where(eq(clientRelationshipBlocks.relationshipBlockId, block.relationshipBlockId))
  }
  if (input.role === "sibling") {
    await db
      .update(clientRelationshipBlocks)
      .set({ siblingsAnswer: "yes", updatedAt: new Date() })
      .where(eq(clientRelationshipBlocks.relationshipBlockId, block.relationshipBlockId))
  }
  if (
    previousBlockId &&
    previousBlockId !== block.relationshipBlockId &&
    (previousRole === "child" || previousRole === "sibling")
  ) {
    await refreshMemberAnswer(input, previousBlockId, previousRole)
  }
  return loadBlockEditorState(input.clientId, input.practiceId)
}

export async function saveRelationshipStatusWithCurrentBlock(input: Scope & { relationshipStatus: unknown }) {
  const saved = await saveClientRelationshipStatus({
    clientId: input.clientId,
    practiceId: input.practiceId,
    userId: input.userId,
    relationshipStatus: input.relationshipStatus,
  })
  if (saved.error) return { error: saved.error }
  const status = saved.relationshipStatus ?? ""
  const state = await loadBlockEditorState(input.clientId, input.practiceId)
  const current = (state?.blocks ?? [])
    .filter((block) => block.kind === "client_current")
    .sort((a, b) => a.displayOrder - b.displayOrder)
  if (isPartneredClientStatus(status)) {
    if (current.length === 0) {
      const [created] = await db
        .insert(clientRelationshipBlocks)
        .values({
          clientId: input.clientId,
          practiceId: input.practiceId,
          kind: "client_current",
          status,
          displayOrder: 0,
        })
        .returning()
      await writeAudit(input, "client_relationship_block.created", "client_relationship_block", created.relationshipBlockId)
    } else if (current[0].status !== status) {
      await db
        .update(clientRelationshipBlocks)
        .set({ status, updatedAt: new Date() })
        .where(eq(clientRelationshipBlocks.relationshipBlockId, current[0].relationshipBlockId))
    }
  } else {
    // Non-partnered: dissolve current blocks. People go to Not placed — never silent-delete.
    for (const block of current) {
      await unplaceMembersOfBlock(input, block.relationshipBlockId)
      await db
        .delete(clientRelationshipBlocks)
        .where(eq(clientRelationshipBlocks.relationshipBlockId, block.relationshipBlockId))
      await writeAudit(input, "client_relationship_block.deleted", "client_relationship_block", block.relationshipBlockId)
    }
  }
  return loadBlockEditorState(input.clientId, input.practiceId)
}

export async function blankAnswerState(): Promise<RelationshipBlockAnswers> {
  return emptyBlockAnswers()
}
