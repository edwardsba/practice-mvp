import { config } from "dotenv"
import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import {
  assessmentDefinitions,
  assessmentElements,
  assessmentOptions,
} from "./schema"

config({ path: ".env.local" })

type MseField = {
  key: string
  order: number
  text: string
  groupLabel: string
  subgroupLabel: string | null
  options: readonly string[]
  /** Option label pre-selected in the form UI. */
  defaultOptionLabel: string
  /** Option label that counts as "normal" for reporting sentences. */
  reportingBaselineOptionLabel: string
}

function optionValue(label: string): string {
  return label
    .toLowerCase()
    .replace(/[\/]/g, " ")
    .trim()
    .replace(/[\s-]+/g, "_")
}

const MSE_FIELDS: readonly MseField[] = [
  {
    key: "mse_appearance",
    order: 1,
    text: "Appearance",
    groupLabel: "Presentation",
    subgroupLabel: null,
    options: ["Neat", "Dishevelled", "Inappropriate", "Bizarre"],
    defaultOptionLabel: "Neat",
    reportingBaselineOptionLabel: "Neat",
  },
  {
    key: "mse_behaviour",
    order: 2,
    text: "Behaviour",
    groupLabel: "Presentation",
    subgroupLabel: null,
    options: [
      "Cooperative",
      "Guarded",
      "Hyperactive",
      "Agitated",
      "Paranoid",
      "Stereotyped",
      "Aggressive",
      "Bizarre",
      "Withdrawn",
    ],
    defaultOptionLabel: "Cooperative",
    reportingBaselineOptionLabel: "Cooperative",
  },
  {
    key: "mse_eye_contact",
    order: 3,
    text: "Eye Contact",
    groupLabel: "Presentation",
    subgroupLabel: null,
    options: ["Normal", "Intense", "Avoidant"],
    defaultOptionLabel: "Normal",
    reportingBaselineOptionLabel: "Normal",
  },
  {
    key: "mse_motor_activity",
    order: 4,
    text: "Motor Activity",
    groupLabel: "Presentation",
    subgroupLabel: null,
    options: ["Normal", "Restless", "Tics", "Slowed"],
    defaultOptionLabel: "Normal",
    reportingBaselineOptionLabel: "Normal",
  },
  {
    key: "mse_affect",
    order: 5,
    text: "Affect",
    groupLabel: "Presentation",
    subgroupLabel: null,
    options: ["Full", "Constricted", "Flat", "Labile"],
    defaultOptionLabel: "Full",
    reportingBaselineOptionLabel: "Full",
  },
  {
    key: "mse_hallucination",
    order: 6,
    text: "Hallucination",
    groupLabel: "Mental Function",
    subgroupLabel: "Perceptions",
    options: ["None", "Auditory", "Visual"],
    defaultOptionLabel: "None",
    reportingBaselineOptionLabel: "None",
  },
  {
    key: "mse_depersonalisation_derealisation",
    order: 7,
    text: "Depersonalisation / Derealisation",
    groupLabel: "Mental Function",
    subgroupLabel: "Perceptions",
    options: ["None", "Derealisation", "Depersonalisation"],
    defaultOptionLabel: "None",
    reportingBaselineOptionLabel: "None",
  },
  {
    key: "mse_homicidality",
    order: 8,
    text: "Homicidality",
    groupLabel: "Mental Function",
    subgroupLabel: "Thoughts",
    options: ["None", "Aggressive", "Intent", "Plan"],
    defaultOptionLabel: "None",
    reportingBaselineOptionLabel: "None",
  },
  {
    key: "mse_delusions",
    order: 9,
    text: "Delusions",
    groupLabel: "Mental Function",
    subgroupLabel: "Thoughts",
    options: ["None", "Grandiose", "Paranoid", "Religious"],
    defaultOptionLabel: "None",
    reportingBaselineOptionLabel: "None",
  },
  {
    key: "mse_suicidality",
    order: 10,
    text: "Suicidality",
    groupLabel: "Mental Function",
    subgroupLabel: "Thoughts",
    options: ["None", "Ideation", "Plan", "Intent", "Self-Harm"],
    defaultOptionLabel: "None",
    reportingBaselineOptionLabel: "None",
  },
  {
    key: "mse_orientation",
    order: 11,
    text: "Orientation",
    groupLabel: "Mental Function",
    subgroupLabel: "Cognitions",
    options: ["None", "Place", "Object", "Person", "Time"],
    defaultOptionLabel: "None",
    reportingBaselineOptionLabel: "None",
  },
  {
    key: "mse_memory",
    order: 12,
    text: "Memory",
    groupLabel: "Mental Function",
    subgroupLabel: "Cognitions",
    options: ["None", "Short-Term", "Long-Term"],
    defaultOptionLabel: "None",
    reportingBaselineOptionLabel: "None",
  },
  {
    key: "mse_attention",
    order: 13,
    text: "Attention",
    groupLabel: "Mental Function",
    subgroupLabel: "Cognitions",
    options: ["Normal", "Distracted"],
    defaultOptionLabel: "Normal",
    reportingBaselineOptionLabel: "Normal",
  },
  {
    key: "mse_insight",
    order: 14,
    text: "Insight",
    groupLabel: "Discernment",
    subgroupLabel: null,
    options: ["Good", "Fair", "Poor"],
    // UI convenience default — distinct from reporting baseline ("Good")
    defaultOptionLabel: "Fair",
    reportingBaselineOptionLabel: "Good",
  },
  {
    key: "mse_judgement",
    order: 15,
    text: "Judgement",
    groupLabel: "Discernment",
    subgroupLabel: null,
    options: ["Good", "Fair", "Poor"],
    // UI convenience default — distinct from reporting baseline ("Good")
    defaultOptionLabel: "Fair",
    reportingBaselineOptionLabel: "Good",
  },
]

async function applyOptionFlags(
  db: ReturnType<typeof drizzle>,
  definitionId: string
) {
  for (const field of MSE_FIELDS) {
    const [element] = await db
      .select({ assessmentElementId: assessmentElements.assessmentElementId })
      .from(assessmentElements)
      .where(
        and(
          eq(assessmentElements.assessmentDefinitionId, definitionId),
          eq(assessmentElements.elementKey, field.key)
        )
      )
      .limit(1)

    if (!element) continue

    await db
      .update(assessmentOptions)
      .set({ isDefaultSelection: false, isReportingBaseline: false })
      .where(eq(assessmentOptions.assessmentElementId, element.assessmentElementId))

    await db
      .update(assessmentOptions)
      .set({ isDefaultSelection: true })
      .where(
        and(
          eq(assessmentOptions.assessmentElementId, element.assessmentElementId),
          eq(assessmentOptions.optionLabel, field.defaultOptionLabel)
        )
      )

    await db
      .update(assessmentOptions)
      .set({ isReportingBaseline: true })
      .where(
        and(
          eq(assessmentOptions.assessmentElementId, element.assessmentElementId),
          eq(assessmentOptions.optionLabel, field.reportingBaselineOptionLabel)
        )
      )
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local")
  }

  const pool = new Pool({ connectionString })
  const db = drizzle(pool)

  const [existing] = await db
    .select({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })
    .from(assessmentDefinitions)
    .where(eq(assessmentDefinitions.assessmentCode, "mse"))
    .limit(1)

  if (existing) {
    await applyOptionFlags(db, existing.assessmentDefinitionId)
    console.log(
      "MSE assessment already seeded — default and reporting-baseline flags updated."
    )
    await pool.end()
    return
  }

  const [definition] = await db
    .insert(assessmentDefinitions)
    .values({
      assessmentCode: "mse",
      assessmentName: "Mental Status Examination",
      assessmentType: "psychometric_assessment",
      scoringEnabled: false,
      clientCompletable: false,
      practitionerCompletable: true,
      isActive: true,
    })
    .returning({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })

  for (const field of MSE_FIELDS) {
    const [element] = await db
      .insert(assessmentElements)
      .values({
        assessmentDefinitionId: definition.assessmentDefinitionId,
        elementKey: field.key,
        questionText: field.text,
        elementType: "radio",
        dataType: "text",
        displayOrder: field.order,
        isRequired: true,
        isActive: true,
        groupLabel: field.groupLabel,
        subgroupLabel: field.subgroupLabel,
      })
      .returning({ assessmentElementId: assessmentElements.assessmentElementId })

    await db.insert(assessmentOptions).values(
      field.options.map((label, index) => ({
        assessmentElementId: element.assessmentElementId,
        assessmentDefinitionId: definition.assessmentDefinitionId,
        optionLabel: label,
        optionValue: optionValue(label),
        scoreValue: 0,
        displayOrder: index + 1,
        isDefaultSelection: label === field.defaultOptionLabel,
        isReportingBaseline: label === field.reportingBaselineOptionLabel,
      }))
    )
  }

  console.log(
    `MSE assessment seeded successfully (${MSE_FIELDS.length} elements).`
  )
  await pool.end()
}

main().catch((error) => {
  console.error("MSE seed failed:", error)
  process.exit(1)
})
