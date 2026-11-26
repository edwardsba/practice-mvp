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

type MseOption = {
  label: string
  value: string
}

type MseField = {
  key: string
  order: number
  text: string
  groupLabel: string
  subgroupLabel: string | null
  options: readonly MseOption[]
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

function opts(labels: readonly string[]): MseOption[] {
  return labels.map((label) => ({ label, value: optionValue(label) }))
}

const MSE_FIELDS: readonly MseField[] = [
  {
    key: "mse_appearance",
    order: 1,
    text: "Appearance",
    groupLabel: "Presentation",
    subgroupLabel: null,
    options: opts(["Neat", "Dishevelled", "Inappropriate", "Bizarre"]),
    defaultOptionLabel: "Neat",
    reportingBaselineOptionLabel: "Neat",
  },
  {
    key: "mse_behaviour",
    order: 2,
    text: "Behaviour",
    groupLabel: "Presentation",
    subgroupLabel: null,
    options: opts([
      "Cooperative",
      "Guarded",
      "Hyperactive",
      "Agitated",
      "Paranoid",
      "Stereotyped",
      "Aggressive",
      "Bizarre",
      "Withdrawn",
    ]),
    defaultOptionLabel: "Cooperative",
    reportingBaselineOptionLabel: "Cooperative",
  },
  {
    key: "mse_eye_contact",
    order: 3,
    text: "Eye Contact",
    groupLabel: "Presentation",
    subgroupLabel: null,
    options: opts(["Normal", "Intense", "Avoidant"]),
    defaultOptionLabel: "Normal",
    reportingBaselineOptionLabel: "Normal",
  },
  {
    key: "mse_motor_activity",
    order: 4,
    text: "Motor Activity",
    groupLabel: "Presentation",
    subgroupLabel: null,
    options: opts(["Normal", "Restless", "Tics", "Slowed"]),
    defaultOptionLabel: "Normal",
    reportingBaselineOptionLabel: "Normal",
  },
  {
    key: "mse_affect",
    order: 5,
    text: "Affect",
    groupLabel: "Presentation",
    subgroupLabel: null,
    options: opts(["Full", "Constricted", "Flat", "Labile"]),
    defaultOptionLabel: "Full",
    reportingBaselineOptionLabel: "Full",
  },
  {
    key: "mse_hallucination",
    order: 6,
    text: "Hallucination",
    groupLabel: "Perceptions",
    subgroupLabel: null,
    options: opts(["None", "Auditory", "Visual"]),
    defaultOptionLabel: "None",
    reportingBaselineOptionLabel: "None",
  },
  {
    key: "mse_depersonalisation_derealisation",
    order: 7,
    text: "Depersonalisation / Derealisation",
    groupLabel: "Perceptions",
    subgroupLabel: null,
    options: opts(["None", "Derealisation", "Depersonalisation"]),
    defaultOptionLabel: "None",
    reportingBaselineOptionLabel: "None",
  },
  {
    key: "mse_homicidality",
    order: 8,
    text: "Homicidality",
    groupLabel: "Thoughts",
    subgroupLabel: null,
    options: opts(["None", "Aggressive", "Intent", "Plan"]),
    defaultOptionLabel: "None",
    reportingBaselineOptionLabel: "None",
  },
  {
    key: "mse_delusions",
    order: 9,
    text: "Delusions",
    groupLabel: "Thoughts",
    subgroupLabel: null,
    options: opts(["None", "Grandiose", "Paranoid", "Religious"]),
    defaultOptionLabel: "None",
    reportingBaselineOptionLabel: "None",
  },
  {
    key: "mse_suicidality",
    order: 10,
    text: "Suicidality",
    groupLabel: "Thoughts",
    subgroupLabel: null,
    options: opts(["None", "Ideation", "Plan", "Intent", "Self-Harm"]),
    defaultOptionLabel: "None",
    reportingBaselineOptionLabel: "None",
  },
  {
    key: "mse_orientation",
    order: 11,
    text: "Orientation",
    groupLabel: "Cognitions",
    subgroupLabel: null,
    options: [
      { label: "Fully oriented", value: "none" },
      { label: "Disoriented to time", value: "time" },
      { label: "Disoriented to time and place", value: "time_place" },
      {
        label: "Disoriented to time, place and person",
        value: "time_place_person",
      },
    ],
    defaultOptionLabel: "Fully oriented",
    reportingBaselineOptionLabel: "Fully oriented",
  },
  {
    key: "mse_memory",
    order: 12,
    text: "Memory",
    groupLabel: "Cognitions",
    subgroupLabel: null,
    options: [
      { label: "Intact", value: "none" },
      { label: "Short-term impaired", value: "short_term" },
      { label: "Long-term impaired", value: "long_term" },
      { label: "Short- and long-term impaired", value: "short_long_term" },
    ],
    defaultOptionLabel: "Intact",
    reportingBaselineOptionLabel: "Intact",
  },
  {
    key: "mse_attention",
    order: 13,
    text: "Attention",
    groupLabel: "Cognitions",
    subgroupLabel: null,
    options: opts(["Normal", "Distracted"]),
    defaultOptionLabel: "Normal",
    reportingBaselineOptionLabel: "Normal",
  },
  {
    key: "mse_insight",
    order: 14,
    text: "Insight",
    groupLabel: "Discernment",
    subgroupLabel: null,
    options: opts(["Good", "Fair", "Poor"]),
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
    options: opts(["Good", "Fair", "Poor"]),
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
      field.options.map((option, index) => ({
        assessmentElementId: element.assessmentElementId,
        assessmentDefinitionId: definition.assessmentDefinitionId,
        optionLabel: option.label,
        optionValue: option.value,
        scoreValue: 0,
        displayOrder: index + 1,
        isDefaultSelection: option.label === field.defaultOptionLabel,
        isReportingBaseline:
          option.label === field.reportingBaselineOptionLabel,
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
