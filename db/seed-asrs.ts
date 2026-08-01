import { config } from "dotenv"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import {
  assessmentDefinitions,
  assessmentElements,
  assessmentOptions,
} from "./schema"

config({ path: ".env.local" })

// Single definition, all 18 items. The Part A (items 1-6) / Part B (items 7-18) module boundary
// is resolver logic at runtime, not baked in here — Part B is only ever queued if Part A's
// shaded-box scoring (see note below) hits >=4 of 6, and it reuses Part A's answers rather than
// re-asking, per the shared elementKey scheme used elsewhere in this battery.
//
// Part A scoring quirk (implement in resolver, not here): items 1-3 count as a "hit" at
// Sometimes-or-higher; items 4-6 count as a "hit" at Often-or-higher. Score >=4 hits = positive
// screen. This is NOT a uniform cutoff across all 6 items — don't just sum raw scores for Part A.
const ASRS_QUESTIONS = [
  { text: "How often do you have trouble wrapping up the final details of a project, once the challenging parts have been done?", subscale: "inattention" },
  { text: "How often do you have difficulty getting things in order when you have to do a task that requires organization?", subscale: "inattention" },
  { text: "How often do you have problems remembering appointments or obligations?", subscale: "inattention" },
  { text: "When you have a task that requires a lot of thought, how often do you avoid or delay getting started?", subscale: "inattention" },
  { text: "How often do you fidget or squirm with your hands or feet when you have to sit down for a long time?", subscale: "hyperactivity" },
  { text: "How often do you feel overly active and compelled to do things, like you were driven by a motor?", subscale: "hyperactivity" },
  { text: "How often do you make careless mistakes when you have to work on a boring or difficult project?", subscale: "inattention" },
  { text: "How often do you have difficulty keeping your attention when you are doing boring or repetitive work?", subscale: "inattention" },
  { text: "How often do you have difficulty concentrating on what people say to you, even when they are speaking to you directly?", subscale: "inattention" },
  { text: "How often do you misplace or have difficulty finding things at home or at work?", subscale: "inattention" },
  { text: "How often are you distracted by activity or noise around you?", subscale: "inattention" },
  { text: "How often do you leave your seat in meetings or other situations in which you are expected to remain seated?", subscale: "hyperactivity" },
  { text: "How often do you feel restless or fidgety?", subscale: "hyperactivity" },
  { text: "How often do you have difficulty unwinding and relaxing when you have time to yourself?", subscale: "hyperactivity" },
  { text: "How often do you find yourself talking too much when you are in social situations?", subscale: "hyperactivity" },
  { text: "When you are in a conversation, how often do you find yourself finishing the sentences of the people you are talking to, before they can finish them themselves?", subscale: "hyperactivity" },
  { text: "How often do you have difficulty waiting your turn in situations when turn taking is required?", subscale: "hyperactivity" },
  { text: "How often do you interrupt others when they are busy?", subscale: "hyperactivity" },
] as const

const ASRS_RESPONSE_OPTIONS = [
  { label: "Never", value: "1", score: 1, order: 1 },
  { label: "Rarely", value: "2", score: 2, order: 2 },
  { label: "Sometimes", value: "3", score: 3, order: 3 },
  { label: "Often", value: "4", score: 4, order: 4 },
  { label: "Very Often", value: "5", score: 5, order: 5 },
] as const

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
    .where(eq(assessmentDefinitions.assessmentCode, "ASRS"))
    .limit(1)

  if (existing) {
    console.log("ASRS assessment already seeded — skipping.")
    await pool.end()
    return
  }

  const [definition] = await db
    .insert(assessmentDefinitions)
    .values({
      assessmentCode: "ASRS",
      assessmentName: "Adult ADHD Self-Report Scale v1.1 (ASRS-v1.1)",
      assessmentType: "psychometric_assessment",
      scoringEnabled: true,
      clientCompletable: true,
      practitionerCompletable: true,
      isActive: true,
    })
    .returning({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })

  for (let i = 0; i < ASRS_QUESTIONS.length; i++) {
    const order = i + 1
    const question = ASRS_QUESTIONS[i]
    const [element] = await db
      .insert(assessmentElements)
      .values({
        assessmentDefinitionId: definition.assessmentDefinitionId,
        elementKey: `asrs_q${order}`,
        questionText: question.text,
        elementType: "radio",
        dataType: "integer",
        displayOrder: order,
        isRequired: true,
        isActive: true,
        groupLabel: question.subscale,
      })
      .returning({ assessmentElementId: assessmentElements.assessmentElementId })

    await db.insert(assessmentOptions).values(
      ASRS_RESPONSE_OPTIONS.map((option) => ({
        assessmentElementId: element.assessmentElementId,
        assessmentDefinitionId: definition.assessmentDefinitionId,
        optionLabel: option.label,
        optionValue: option.value,
        scoreValue: option.score,
        displayOrder: option.order,
      }))
    )
  }

  console.log("ASRS assessment seeded successfully (18 items, Part A = items 1-6, Part B = items 7-18).")
  await pool.end()
}

main().catch((error) => {
  console.error("ASRS seed failed:", error)
  process.exit(1)
})
