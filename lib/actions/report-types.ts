"use server"

import { and, asc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { fundingApprovalTypeReports, reportTypes } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { performSoftDelete } from "@/lib/delete/delete-utils"

export async function getReportTypes(practiceId: string) {
  const context = await requirePractitionerContext()
  if (context.practiceId !== practiceId) return []

  return db
    .select({
      reportTypeId: reportTypes.reportTypeId,
      name: reportTypes.name,
    })
    .from(reportTypes)
    .where(
      and(
        eq(reportTypes.practiceId, practiceId),
        eq(reportTypes.isActive, true)
      )
    )
    .orderBy(asc(reportTypes.name))
}

export async function getReportTypeById(
  practiceId: string,
  reportTypeId: string
) {
  const context = await requirePractitionerContext()
  if (context.practiceId !== practiceId) return null

  const [row] = await db
    .select({
      reportTypeId: reportTypes.reportTypeId,
      name: reportTypes.name,
    })
    .from(reportTypes)
    .where(
      and(
        eq(reportTypes.reportTypeId, reportTypeId),
        eq(reportTypes.practiceId, practiceId),
        eq(reportTypes.isActive, true)
      )
    )
    .limit(1)

  return row ?? null
}

export async function upsertReportType(
  practiceId: string,
  reportTypeId: string | undefined,
  _prevState: unknown,
  formData: FormData
): Promise<{ success?: boolean; reportTypeId?: string; error?: string }> {
  const context = await requirePractitionerContext()
  if (context.practiceId !== practiceId) return { error: "Unauthorized." }

  const name = String(formData.get("name") ?? "").trim()
  if (!name) return { error: "Name is required." }

  const now = new Date()
  let savedId = reportTypeId

  try {
    if (reportTypeId) {
      await db
        .update(reportTypes)
        .set({ name, updatedAt: now })
        .where(
          and(
            eq(reportTypes.reportTypeId, reportTypeId),
            eq(reportTypes.practiceId, practiceId)
          )
        )
    } else {
      const [created] = await db
        .insert(reportTypes)
        .values({ practiceId, name })
        .returning({ reportTypeId: reportTypes.reportTypeId })
      savedId = created.reportTypeId
    }
  } catch {
    return { error: "Unable to save report type." }
  }

  revalidatePath("/settings/report-types")
  if (savedId) revalidatePath(`/settings/report-types/${savedId}`)
  return { success: true, reportTypeId: savedId }
}

export async function getReportTypeDeleteStatus(
  practiceId: string,
  reportTypeId: string
): Promise<{ blockedReason?: string }> {
  const context = await requirePractitionerContext()
  if (context.practiceId !== practiceId) {
    return { blockedReason: "Unauthorized." }
  }

  const [existing] = await db
    .select({ reportTypeId: reportTypes.reportTypeId, name: reportTypes.name })
    .from(reportTypes)
    .where(
      and(
        eq(reportTypes.reportTypeId, reportTypeId),
        eq(reportTypes.practiceId, practiceId),
        eq(reportTypes.isActive, true)
      )
    )
    .limit(1)

  if (!existing) return { blockedReason: "Report type not found." }

  const [usage] = await db
    .select({ reportRequirementId: fundingApprovalTypeReports.reportRequirementId })
    .from(fundingApprovalTypeReports)
    .where(eq(fundingApprovalTypeReports.reportType, existing.name))
    .limit(1)

  if (usage) {
    return {
      blockedReason:
        "Cannot delete: this report type is used in funding approval type requirements.",
    }
  }

  return {}
}

export async function deleteReportType(
  reportTypeId: string,
  practiceId: string
): Promise<{ success?: boolean; error?: string; blockedReason?: string }> {
  const context = await requirePractitionerContext()
  if (context.practiceId !== practiceId) return { error: "Unauthorized." }

  const status = await getReportTypeDeleteStatus(practiceId, reportTypeId)
  if (status.blockedReason) return { blockedReason: status.blockedReason }

  const result = await performSoftDelete({
    table: reportTypes,
    id: reportTypeId,
    idField: reportTypes.reportTypeId,
    practiceId,
    practiceIdField: reportTypes.practiceId,
  })

  if (!result.success) {
    return { error: result.error ?? "Unable to delete report type." }
  }

  revalidatePath("/settings/report-types")
  redirect("/settings/report-types")
}
