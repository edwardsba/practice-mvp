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

// domainCode values match what battery_trigger_rules and the Tier 2/3 reference docs use.
// Domain scoring rule (implemented in resolver logic, not here): a domain's score is the
// MAX of its item scores, not a sum — e.g. Anxiety's score is the max of items 6, 7, 8.
const LEVEL1_XC_QUESTIONS = [
  { text: "Little interest or pleasure in doing things?", domainCode: "depression", isUrgentFlag: false },
  { text: "Feeling down, depressed, or hopeless?", domainCode: "depression", isUrgentFlag: false },
  { text: "Feeling more irritated, grouchy, or angry than usual?", domainCode: "anger", isUrgentFlag: false },
  { text: "Sleeping less than usual, but still have a lot of energy?", domainCode: "mania", isUrgentFlag: false },
  { text: "Starting lots more projects than usual or doing more risky things than usual?", domainCode: "mania", isUrgentFlag: false },
  { text: "Feeling nervous, anxious, frightened, worried, or on edge?", domainCode: "anxiety", isUrgentFlag: false },
  { text: "Feeling panic or being frightened?", domainCode: "anxiety", isUrgentFlag: false },
  { text: "Avoiding situations that make you anxious?", domainCode: "anxiety", isUrgentFlag: false },
  { text: "Unexplained aches and pains (e.g., head, back, joints, abdomen, legs)?", domainCode: "somatic", isUrgentFlag: false },
  { text: "Feeling that your illnesses are not being taken seriously enough?", domainCode: "somatic", isUrgentFlag: false },
  { text: "Thoughts of actually hurting yourself?", domainCode: "suicidal_ideation", isUrgentFlag: true },
  { text: "Hearing things other people couldn't hear, such as voices even when no one was around?", domainCode: "psychosis", isUrgentFlag: false },
  { text: "Feeling that someone could hear your thoughts, or that you could hear what another person was thinking?", domainCode: "psychosis", isUrgentFlag: false },
  { text: "Problems with sleep that affected your sleep quality overall?", domainCode: "sleep", isUrgentFlag: false },
  { text: "Problems with memory (e.g., learning new information) or with location (e.g., finding your way home)?", domainCode: "memory", isUrgentFlag: false },
  { text: "Unpleasant thoughts, urges, or images that repeatedly enter your mind?", domainCode: "repetitive_thoughts", isUrgentFlag: false },
  { text: "Feeling driven to perform certain behaviors or mental acts over and over again?", domainCode: "repetitive_thoughts", isUrgentFlag: false },
  { text: "Feeling detached or distant from yourself, your body, your physical surroundings, or your memories?", domainCode: "dissociation", isUrgentFlag: false },
  { text: "Not knowing who you really are or what you want out of life?", domainCode: "personality", isUrgentFlag: false },
  { text: "Not feeling close to other people or enjoying your relationships with them?", domainCode: "personality", isUrgentFlag: false },
  { text: "Drinking at least 4 drinks of any kind of alcohol in a single day?", domainCode: "substance_use", isUrgentFlag: false },
  { text: "Smoking any cigarettes, a cigar, or pipe, or using snuff or chewing tobacco?", domainCode: "substance_use", isUrgentFlag: false },
  { text: "Using any of the following medicines ON YOUR OWN — without a doctor's prescription, in greater amounts or longer than prescribed (e.g., painkillers, stimulants, sedatives/tranquilizers, marijuana, cocaine/crack, club drugs, hallucinogens, heroin, inhalants/solvents, methamphetamine)?", domainCode: "substance_use", isUrgentFlag: false },
] as const

const LEVEL1_XC_RESPONSE_OPTIONS = [
  { label: "None/Not at all", value: "0", score: 0, order: 1 },
  { label: "Slight/Rare (less than a day or two)", value: "1", score: 1, order: 2 },
  { label: "Mild/Several days", value: "2", score: 2, order: 3 },
  { label: "Moderate/More than half the days", value: "3", score: 3, order: 4 },
  { label: "Severe/Nearly every day", value: "4", score: 4, order: 5 },
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
    .where(eq(assessmentDefinitions.assessmentCode, "LEVEL1_XC"))
    .limit(1)

  if (existing) {
    console.log("Level 1 XC assessment already seeded — skipping.")
    await pool.end()
    return
  }

  const [definition] = await db
    .insert(assessmentDefinitions)
    .values({
      assessmentCode: "LEVEL1_XC",
      assessmentName: "DSM-5-TR Level 1 Cross-Cutting Symptom Measure—Adult",
      assessmentType: "psychometric_assessment",
      scoringEnabled: true,
      clientCompletable: true,
      practitionerCompletable: true,
      isActive: true,
    })
    .returning({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })

  for (let i = 0; i < LEVEL1_XC_QUESTIONS.length; i++) {
    const order = i + 1
    const question = LEVEL1_XC_QUESTIONS[i]
    const [element] = await db
      .insert(assessmentElements)
      .values({
        assessmentDefinitionId: definition.assessmentDefinitionId,
        elementKey: `level1xc_q${order}`,
        questionText: question.text,
        elementType: "radio",
        dataType: "integer",
        displayOrder: order,
        isRequired: true,
        isActive: true,
        domainCode: question.domainCode,
        isUrgentFlag: question.isUrgentFlag,
      })
      .returning({ assessmentElementId: assessmentElements.assessmentElementId })

    await db.insert(assessmentOptions).values(
      LEVEL1_XC_RESPONSE_OPTIONS.map((option) => ({
        assessmentElementId: element.assessmentElementId,
        assessmentDefinitionId: definition.assessmentDefinitionId,
        optionLabel: option.label,
        optionValue: option.value,
        scoreValue: option.score,
        displayOrder: option.order,
      }))
    )
  }

  console.log("Level 1 XC assessment seeded successfully (23 items).")
  await pool.end()
}

main().catch((error) => {
  console.error("Level 1 XC seed failed:", error)
  process.exit(1)
})
