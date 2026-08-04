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

// PCL-5 (PTSD Checklist for DSM-5) — 20 items, triggered by a positive PC-PTSD-5 screen
// (score >= 3). Two interpretation methods computed on submission (see lib/assessments/pcl5.ts):
// total score against published bands, and the DSM-5 criterion-endorsement rule for provisional
// diagnosis. Both surfaced together in the composed severity label. No "your worst event"
// free-text field — deliberately left out, since it's explicitly not scored in the source
// and would need a genuinely new element type (free-text) that doesn't exist anywhere else in
// this app yet.
const PCL5_QUESTIONS = [
  "Repeated, disturbing, and unwanted memories of the stressful experience?", // Q1
  "Repeated, disturbing dreams of the stressful experience?", // Q2
  "Suddenly feeling or acting as if the stressful experience were actually happening again (as if you were actually back there reliving it)?", // Q3
  "Feeling very upset when something reminded you of the stressful experience?", // Q4
  "Having strong physical reactions when something reminded you of the stressful experience (for example, heart pounding, trouble breathing, sweating)?", // Q5
  "Avoiding memories, thoughts, or feelings related to the stressful experience?", // Q6
  "Avoiding external reminders of the stressful experience (for example, people, places, conversations, activities, objects, or situations)?", // Q7
  "Trouble remembering important parts of the stressful experience?", // Q8
  "Having strong negative beliefs about yourself, other people, or the world (for example, having thoughts such as: I am bad, there is something seriously wrong with me, no one can be trusted, the world is completely dangerous)?", // Q9
  "Blaming yourself or someone else for the stressful experience or what happened after it?", // Q10
  "Having strong negative feelings such as fear, horror, anger, guilt, or shame?", // Q11
  "Loss of interest in activities that you used to enjoy?", // Q12
  "Feeling distant or cut off from other people?", // Q13
  "Trouble experiencing positive feelings (for example, being unable to feel happiness or have loving feelings for people close to you)?", // Q14
  "Irritable behavior, angry outbursts, or acting aggressively?", // Q15
  "Taking too many risks or doing things that could cause you harm?", // Q16
  "Being \"superalert\" or watchful or on guard?", // Q17
  "Feeling jumpy or easily startled?", // Q18
  "Having difficulty concentrating?", // Q19
  "Trouble falling or staying asleep?", // Q20
] as const

const PCL5_RESPONSE_OPTIONS = [
  { label: "Not at all", value: "0", score: 0, order: 1 },
  { label: "A little bit", value: "1", score: 1, order: 2 },
  { label: "Moderately", value: "2", score: 2, order: 3 },
  { label: "Quite a bit", value: "3", score: 3, order: 4 },
  { label: "Extremely", value: "4", score: 4, order: 5 },
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
    .where(eq(assessmentDefinitions.assessmentCode, "PCL5"))
    .limit(1)

  if (existing) {
    console.log("PCL5 assessment already seeded — skipping.")
    await pool.end()
    return
  }

  const [definition] = await db
    .insert(assessmentDefinitions)
    .values({
      assessmentCode: "PCL5",
      assessmentName: "PTSD Checklist for DSM-5 (PCL-5)",
      assessmentType: "psychometric_assessment",
      scoringEnabled: true,
      clientCompletable: true,
      practitionerCompletable: true,
      isActive: true,
    })
    .returning({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })

  for (let i = 0; i < PCL5_QUESTIONS.length; i++) {
    const questionText = PCL5_QUESTIONS[i]
    const [element] = await db
      .insert(assessmentElements)
      .values({
        assessmentDefinitionId: definition.assessmentDefinitionId,
        elementKey: `pcl5_q${i + 1}`,
        questionText,
        elementType: "radio",
        dataType: "integer",
        displayOrder: i + 1,
        isRequired: true,
        isActive: true,
      })
      .returning({ assessmentElementId: assessmentElements.assessmentElementId })

    await db.insert(assessmentOptions).values(
      PCL5_RESPONSE_OPTIONS.map((option) => ({
        assessmentElementId: element.assessmentElementId,
        assessmentDefinitionId: definition.assessmentDefinitionId,
        optionLabel: option.label,
        optionValue: option.value,
        scoreValue: option.score,
        displayOrder: option.order,
      }))
    )
  }

  console.log("PCL5 assessment seeded successfully (20 items).")
  await pool.end()
}

main().catch((error) => {
  console.error("PCL5 seed failed:", error)
  process.exit(1)
})
