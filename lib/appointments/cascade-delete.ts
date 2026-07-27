import { eq, inArray, or } from "drizzle-orm"

import {
  appointments,
  assessmentAccessLinks,
  assessmentElements,
  assessmentInstances,
  assessmentOptions,
  assessmentResponses,
  assessmentResults,
  batteryInstances,
  communications,
  sessionNotes,
} from "@/db/schema"
import { db } from "@/lib/db"

type DbClient = typeof db
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export type AppointmentCascadeSummary = {
  totalSessionNoteCount: number
  finalisedSessionNoteCount: number
  assessmentInstanceCount: number
}

/**
 * Gathers every ID that would need to be touched to fully remove this
 * appointment, scoped strictly to this one appointment — nothing here
 * reaches into other appointments or clients.
 *
 * This is built from the real foreign keys in the live database
 * (queried directly via information_schema — the Drizzle schema files
 * were found to be missing some real constraints), not assumed from
 * the schema files alone:
 *
 *   session_notes          -> appointments, battery_instances
 *   assessment_access_links -> assessment_instances, (self via next_access_link_id)
 *   assessment_elements     -> assessment_instances
 *   assessment_options      -> assessment_elements
 *   assessment_responses    -> assessment_instances
 *   assessment_results      -> assessment_instances
 *   battery_instances       -> assessment_instances (x4), assessment_access_links (x6)
 *   communications          -> assessment_access_links (kept, not deleted — see below)
 *
 * Accepts either the plain db client (for a read-only summary) or an
 * open transaction (for the actual delete), since both expose the same
 * query builder shape.
 */
async function gatherCascadeIds(
  client: DbClient | DbTransaction,
  appointmentId: string
) {
  const linkedSessionNotes = await client
    .select({
      sessionNoteId: sessionNotes.sessionNoteId,
      status: sessionNotes.status,
      batteryInstanceId: sessionNotes.batteryInstanceId,
    })
    .from(sessionNotes)
    .where(eq(sessionNotes.appointmentId, appointmentId))

  const linkedAssessmentInstances = await client
    .select({
      assessmentInstanceId: assessmentInstances.assessmentInstanceId,
    })
    .from(assessmentInstances)
    .where(eq(assessmentInstances.appointmentId, appointmentId))

  const assessmentInstanceIds = linkedAssessmentInstances.map(
    (row) => row.assessmentInstanceId
  )

  const linkedAssessmentElements = assessmentInstanceIds.length
    ? await client
        .select({ assessmentElementId: assessmentElements.assessmentElementId })
        .from(assessmentElements)
        .where(
          inArray(assessmentElements.assessmentInstanceId, assessmentInstanceIds)
        )
    : []
  const assessmentElementIds = linkedAssessmentElements.map(
    (row) => row.assessmentElementId
  )

  const accessLinksFromInstances = assessmentInstanceIds.length
    ? await client
        .select({
          assessmentAccessLinkId: assessmentAccessLinks.assessmentAccessLinkId,
        })
        .from(assessmentAccessLinks)
        .where(
          inArray(assessmentAccessLinks.assessmentInstanceId, assessmentInstanceIds)
        )
    : []

  const batteryInstancesFromAssessments = assessmentInstanceIds.length
    ? await client
        .select({
          batteryInstanceId: batteryInstances.batteryInstanceId,
          phq9LinkId: batteryInstances.phq9LinkId,
          gad7LinkId: batteryInstances.gad7LinkId,
          btpLinkId: batteryInstances.btpLinkId,
          assistLinkId: batteryInstances.assistLinkId,
          firstLinkId: batteryInstances.firstLinkId,
          lastLinkId: batteryInstances.lastLinkId,
        })
        .from(batteryInstances)
        .where(
          or(
            inArray(batteryInstances.phq9InstanceId, assessmentInstanceIds),
            inArray(batteryInstances.gad7InstanceId, assessmentInstanceIds),
            inArray(batteryInstances.btpInstanceId, assessmentInstanceIds),
            inArray(batteryInstances.assistInstanceId, assessmentInstanceIds)
          )
        )
    : []

  const batteryInstanceIds = Array.from(
    new Set([
      ...batteryInstancesFromAssessments.map((row) => row.batteryInstanceId),
      ...linkedSessionNotes
        .map((row) => row.batteryInstanceId)
        .filter((id): id is string => Boolean(id)),
    ])
  )

  const linkIdsFromBatteries = batteryInstancesFromAssessments.flatMap((row) =>
    [
      row.phq9LinkId,
      row.gad7LinkId,
      row.btpLinkId,
      row.assistLinkId,
      row.firstLinkId,
      row.lastLinkId,
    ].filter((id): id is string => Boolean(id))
  )

  const assessmentAccessLinkIds = Array.from(
    new Set([
      ...accessLinksFromInstances.map((row) => row.assessmentAccessLinkId),
      ...linkIdsFromBatteries,
    ])
  )

  return {
    sessionNoteIds: linkedSessionNotes.map((row) => row.sessionNoteId),
    finalisedSessionNoteCount: linkedSessionNotes.filter(
      (row) => row.status === "finalised"
    ).length,
    totalSessionNoteCount: linkedSessionNotes.length,
    assessmentInstanceIds,
    assessmentElementIds,
    assessmentAccessLinkIds,
    batteryInstanceIds,
  }
}

/**
 * Read-only summary for the delete confirmation UI — what would this
 * delete take with it?
 */
export async function getAppointmentCascadeSummary(
  appointmentId: string,
  practiceId: string
): Promise<AppointmentCascadeSummary> {
  const ids = await gatherCascadeIds(db, appointmentId)
  return {
    totalSessionNoteCount: ids.totalSessionNoteCount,
    finalisedSessionNoteCount: ids.finalisedSessionNoteCount,
    assessmentInstanceCount: ids.assessmentInstanceIds.length,
  }
}

/**
 * Performs the actual cascade delete inside an open transaction, in an
 * order verified against the real foreign keys in the live database:
 *
 *   1. Detach communications from the access links about to be deleted
 *      (communications is real sent-email history — it's kept, just
 *      un-linked, not deleted).
 *   2. Clear assessment_access_links' self-referencing next_access_link_id
 *      for any link in or pointing into the set about to be deleted.
 *   3. assessment_options (children of assessment_elements)
 *   4. assessment_elements (children of assessment_instances)
 *   5. assessment_responses, assessment_results (children of assessment_instances)
 *   6. session_notes (references appointments AND battery_instances)
 *   7. battery_instances (references assessment_instances AND
 *      assessment_access_links — safe now that session_notes is gone)
 *   8. assessment_access_links (references assessment_instances — safe
 *      now that battery_instances and communications no longer point to it)
 *   9. assessment_instances (parent of everything above)
 *   10. appointments (the root — safe now that everything pointing at it is gone)
 *
 * This deliberately bypasses the normal "finalised documents are locked"
 * rule for session notes — that rule protects against losing a note by
 * accident during normal editing, but the practitioner here has
 * explicitly confirmed they want the whole appointment, including any
 * finalised note, gone. Only reachable through this explicit, confirmed
 * path — never a substitute for the normal locked-document behaviour
 * anywhere else in the app.
 */
export async function cascadeDeleteAppointment(
  tx: DbTransaction,
  appointmentId: string,
  practiceId: string
) {
  const ids = await gatherCascadeIds(tx, appointmentId)

  if (ids.assessmentAccessLinkIds.length) {
    await tx
      .update(communications)
      .set({ assessmentAccessLinkId: null })
      .where(
        inArray(communications.assessmentAccessLinkId, ids.assessmentAccessLinkIds)
      )

    await tx
      .update(assessmentAccessLinks)
      .set({ nextAccessLinkId: null })
      .where(
        inArray(assessmentAccessLinks.nextAccessLinkId, ids.assessmentAccessLinkIds)
      )
  }

  if (ids.assessmentElementIds.length) {
    await tx
      .delete(assessmentOptions)
      .where(inArray(assessmentOptions.assessmentElementId, ids.assessmentElementIds))
    await tx
      .delete(assessmentElements)
      .where(inArray(assessmentElements.assessmentElementId, ids.assessmentElementIds))
  }

  if (ids.assessmentInstanceIds.length) {
    await tx
      .delete(assessmentResponses)
      .where(
        inArray(assessmentResponses.assessmentInstanceId, ids.assessmentInstanceIds)
      )
    await tx
      .delete(assessmentResults)
      .where(
        inArray(assessmentResults.assessmentInstanceId, ids.assessmentInstanceIds)
      )
  }

  if (ids.sessionNoteIds.length) {
    await tx
      .delete(sessionNotes)
      .where(inArray(sessionNotes.sessionNoteId, ids.sessionNoteIds))
  }

  if (ids.batteryInstanceIds.length) {
    await tx
      .delete(batteryInstances)
      .where(inArray(batteryInstances.batteryInstanceId, ids.batteryInstanceIds))
  }

  if (ids.assessmentAccessLinkIds.length) {
    await tx
      .delete(assessmentAccessLinks)
      .where(
        inArray(
          assessmentAccessLinks.assessmentAccessLinkId,
          ids.assessmentAccessLinkIds
        )
      )
  }

  if (ids.assessmentInstanceIds.length) {
    await tx
      .delete(assessmentInstances)
      .where(
        inArray(assessmentInstances.assessmentInstanceId, ids.assessmentInstanceIds)
      )
  }

  await tx.delete(appointments).where(eq(appointments.appointmentId, appointmentId))
}
