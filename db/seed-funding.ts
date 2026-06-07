import { config } from "dotenv"
import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import {
  claimTypes,
  fundingApprovalTypeReports,
  fundingApprovalTypes,
  practices,
} from "./schema"

config({ path: ".env.local" })

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.")
  }

  const pool = new Pool({ connectionString })
  const db = drizzle(pool)

  const [practice] = await db
    .select({ practiceId: practices.practiceId })
    .from(practices)
    .where(eq(practices.isActive, true))
    .limit(1)

  if (!practice) {
    throw new Error("No active practice found.")
  }

  const practiceId = practice.practiceId
  const now = new Date()

  async function upsertClaimType(name: string) {
    const [existing] = await db
      .select()
      .from(claimTypes)
      .where(
        and(
          eq(claimTypes.practiceId, practiceId),
          eq(claimTypes.claimTypeName, name)
        )
      )
      .limit(1)

    if (existing) {
      return existing
    }

    const [created] = await db
      .insert(claimTypes)
      .values({
        practiceId,
        claimTypeName: name,
        updatedAt: now,
      })
      .returning()

    return created
  }

  const medicare = await upsertClaimType("Medicare")
  const ndis = await upsertClaimType("NDIS")
  const workCover = await upsertClaimType(
    "WorkCover (Workers Compensation Insurance NSW)"
  )

  async function upsertApprovalType(data: {
    name: string
    claimTypeId: string
    durationMonths: number
    appointmentsApproved: number
    reports?: Array<{ appointmentNumber: number; reportType: string }>
  }) {
    const [existing] = await db
      .select()
      .from(fundingApprovalTypes)
      .where(
        and(
          eq(fundingApprovalTypes.practiceId, practiceId),
          eq(fundingApprovalTypes.name, data.name)
        )
      )
      .limit(1)

    let approvalType = existing

    if (!approvalType) {
      const [created] = await db
        .insert(fundingApprovalTypes)
        .values({
          practiceId,
          name: data.name,
          claimTypeId: data.claimTypeId,
          durationMonths: data.durationMonths,
          appointmentsApproved: data.appointmentsApproved,
          updatedAt: now,
        })
        .returning()
      approvalType = created
    }

    if (data.reports?.length) {
      for (const report of data.reports) {
        const [existingReport] = await db
          .select()
          .from(fundingApprovalTypeReports)
          .where(
            and(
              eq(
                fundingApprovalTypeReports.fundingApprovalTypeId,
                approvalType.fundingApprovalTypeId
              ),
              eq(
                fundingApprovalTypeReports.appointmentNumber,
                report.appointmentNumber
              )
            )
          )
          .limit(1)

        if (!existingReport) {
          await db.insert(fundingApprovalTypeReports).values({
            fundingApprovalTypeId: approvalType.fundingApprovalTypeId,
            appointmentNumber: report.appointmentNumber,
            reportType: report.reportType,
            updatedAt: now,
          })
        }
      }
    }

    return approvalType
  }

  await upsertApprovalType({
    name: "MHTP Initial",
    claimTypeId: medicare.claimTypeId,
    durationMonths: 12,
    appointmentsApproved: 6,
    reports: [{ appointmentNumber: 6, reportType: "Progress Report" }],
  })

  await upsertApprovalType({
    name: "MHTP Review",
    claimTypeId: medicare.claimTypeId,
    durationMonths: 12,
    appointmentsApproved: 4,
  })

  await upsertApprovalType({
    name: "AHTR",
    claimTypeId: workCover.claimTypeId,
    durationMonths: 12,
    appointmentsApproved: 8,
  })

  await pool.end()
  console.log("Funding seed data inserted successfully.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
