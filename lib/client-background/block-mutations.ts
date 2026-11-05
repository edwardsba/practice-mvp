import "server-only"

import { and, asc, eq } from "drizzle-orm"

import { auditEvents, clientBackgrounds, clientRelationshipBlocks, clientRelationshipRecords, clients } from "@/db/schema"
import { db } from "@/lib/db"
import { toBlockAnswers, toClientRelationshipStatus, toRelationship, toRelationshipBlock } from "@/lib/client-background/map"
import {
  answerAfterBlockCount,
  answerKeyForBlock,
  childTypesForBlock,
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

export async function createRelationshipBlock(input: Scope & {
  kind: BlockKind
  parentSide?: "mother" | "father" | ""
  arrangementType?: string
}) {
  if (!(await ownedClient(input.clientId, input.practiceId))) return { error: "Client was not found." }
  const kind = input.kind
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
  const noChildren = typeof raw?.noChildren === "boolean" ? raw.noChildren : existing.noChildren
  await db
    .update(clientRelationshipBlocks)
    .set({
      status: status || null,
      statusDetail: status === "other" ? statusDetail || null : null,
      arrangementType: arrangementType || null,
      arrangementDetail: arrangementType === "other" ? arrangementDetail || null : null,
      startedOn: startedOn || null,
      endedOn: endedOn || null,
      noChildren,
      updatedAt: new Date(),
    })
    .where(eq(clientRelationshipBlocks.relationshipBlockId, existing.relationshipBlockId))
  return loadBlockEditorState(input.clientId, input.practiceId)
}

export async function deleteRelationshipBlock(input: Scope & { relationshipBlockId: string }) {
  const existing = await ownedBlock(input, input.relationshipBlockId)
  if (!existing) return { error: "Relationship was not found." }
  if (existing.kind === "biological_parents") return { error: "The biological parents block stays." }
  const block = toRelationshipBlock(existing)
  await db
    .delete(clientRelationshipRecords)
    .where(
      and(
        eq(clientRelationshipRecords.relationshipBlockId, existing.relationshipBlockId),
        eq(clientRelationshipRecords.clientId, input.clientId),
        eq(clientRelationshipRecords.practiceId, input.practiceId)
      )
    )
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
      childType: input.role === "child" ? siblingType || null : null,
      caregiverRelationship: input.role === "caregiver" ? siblingType || null : null,
    })
    .returning()
  await writeAudit(input, "client_relationship.created", "client_relationship", created.relationshipRecordId)
  if (input.role === "child") {
    await db
      .update(clientRelationshipBlocks)
      .set({ noChildren: false, updatedAt: new Date() })
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
      childType: role === "child" ? roleType || null : existing.childType,
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
  await db
    .delete(clientRelationshipRecords)
    .where(
      and(
        eq(clientRelationshipRecords.relationshipRecordId, existing.relationshipRecordId),
        eq(clientRelationshipRecords.practiceId, input.practiceId)
      )
    )
  await writeAudit(input, "client_relationship.deleted", "client_relationship", existing.relationshipRecordId)
  return loadBlockEditorState(input.clientId, input.practiceId)
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
    const created = await createRelationshipBlock({
      ...input,
      kind: destinationId === NEW_CURRENT_RELATIONSHIP ? "client_current" : "client_previous",
    })
    if (!created || !("blocks" in created) || !created.blocks) return created ?? { error: "Could not add the relationship." }
    const kind = destinationId === NEW_CURRENT_RELATIONSHIP ? "client_current" : "client_previous"
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
  await db
    .update(clientRelationshipRecords)
    .set({
      relationshipBlockId: block.relationshipBlockId,
      blockRole: input.role,
      blockRoleType: roleType || null,
      relationshipToClient: legacyRoleForMember(block.kind, input.role, roleType),
      placementReview: null,
      childType: input.role === "child" ? roleType || null : person.childType,
      caregiverRelationship: input.role === "caregiver" ? roleType || null : person.caregiverRelationship,
      updatedAt: new Date(),
    })
    .where(eq(clientRelationshipRecords.relationshipRecordId, person.relationshipRecordId))
  await writeAudit(input, "client_relationship.moved", "client_relationship", person.relationshipRecordId)
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
  if (isPartneredClientStatus(status)) {
    const state = await loadBlockEditorState(input.clientId, input.practiceId)
    const current = (state?.blocks ?? [])
      .filter((block) => block.kind === "client_current")
      .sort((a, b) => a.displayOrder - b.displayOrder)
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
  }
  return loadBlockEditorState(input.clientId, input.practiceId)
}

export async function blankAnswerState(): Promise<RelationshipBlockAnswers> {
  return emptyBlockAnswers()
}
