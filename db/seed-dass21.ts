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

// groupLabel carries the DASS-21 subscale (Depression/Anxiety/Stress) for each item.
// Scoring rule (implemented in resolver logic, not here): sum each subscale's 7 raw item
// scores, then multiply by 2 to get the reportable score (0-42 per subscale) — required to
// match the standard DASS-21 severity bands, which were calibrated against the original
// 42-item DASS. Items are seeded in their original DASS-21 administration order (1-21),
// not grouped by subscale — that's how the instrument is presented to clients.
const DASS21_QUESTIONS = [
  { text: "I found it hard to wind down.", group: "Stress" },
  { text: "I was aware of dryness of my mouth.", group: "Anxiety" },
  { text: "I couldn't seem to experience any positive feeling at all.", group: "Depression" },
  { text: "I experienced breathing difficulty (e.g., excessively rapid breathing, breathlessness in the absence of physical exertion).", group: "Anxiety" },
  { text: "I found it difficult to work up the initiative to do things.", group: "Depression" },
  { text: "I tended to over-react to situations.", group: "Stress" },
  { text: "I experienced trembling (e.g., in the hands).", group: "Anxiety" },
  { text: "I felt that I was using a lot of nervous energy.", group: "Stress" },
  { text: "I was worried about situations in which I might panic and make a fool of myself.", group: "Anxiety" },
  { text: "I felt that I had nothing to look forward to.", group: "Depression" },
  { text: "I found myself getting agitated.", group: "Stress" },
  { text: "I found it difficult to relax.", group: "Stress" },
  { text: "I felt down-hearted and blue.", group: "Depression" },
  { text: "I was intolerant of anything that kept me from getting on with what I was doing.", group: "Stress" },
  { text: "I felt I was close to panic.", group: "Anxiety" },
  { text: "I was unable to become enthusiastic about anything.", group: "Depression" },
  { text: "I felt I wasn't worth much as a person.", group: "Depression" },
  { text: "I felt that I was rather touchy.", group: "Stress" },
  { text: "I was aware of the action of my heart in the absence of physical exertion (e.g., sense of heart rate increase, heart missing a beat).", group: "Anxiety" },
  { text: "I felt scared without any good reason.", group: "Anxiety" },
  { text: "I felt that life was meaningless.", group: "Depression" },
] as const

const DASS21_RESPONSE_OPTIONS = [
  { label: "Did not apply to me at all", value: "0", score: 0, order: 1 },
  { label: "Applied to me to some degree, or some of the time", value: "1", score: 1, order: 2 },
  { label: "Applied to me to a considerable degree, or a good part of time", value: "2", score: 2, order: 3 },
  { label: "Applied to me very much, or most of the time", value: "3", score: 3, order: 4 },
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
    .where(eq(assessmentDefinitions.assessmentCode, "DASS21"))
    .limit(1)

  if (existing) {
    console.log("DASS-21 assessment already seeded — skipping.")
    await pool.end()
    return
  }

  const [definition] = await db
    .insert(assessmentDefinitions)
    .values({
      assessmentCode: "DASS21",
      assessmentName: "Depression Anxiety Stress Scales - 21 Item (DASS-21)",
      assessmentType: "psychometric_assessment",
      scoringEnabled: true,
      clientCompletable: true,
      practitionerCompletable: true,
      isActive: true,
    })
    .returning({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })

  for (let i = 0; i < DASS21_QUESTIONS.length; i++) {
    const question = DASS21_QUESTIONS[i]
    const [element] = await db
      .insert(assessmentElements)
      .values({
        assessmentDefinitionId: definition.assessmentDefinitionId,
        elementKey: `dass21_q${i + 1}`,
        questionText: question.text,
        elementType: "radio",
        dataType: "integer",
        displayOrder: i + 1,
        isRequired: true,
        isActive: true,
        groupLabel: question.group,
      })
      .returning({ assessmentElementId: assessmentElements.assessmentElementId })

    await db.insert(assessmentOptions).values(
      DASS21_RESPONSE_OPTIONS.map((option) => ({
        assessmentElementId: element.assessmentElementId,
        assessmentDefinitionId: definition.assessmentDefinitionId,
        optionLabel: option.label,
        optionValue: option.value,
        scoreValue: option.score,
        displayOrder: option.order,
      }))
    )
  }

  console.log("DASS-21 assessment seeded successfully (21 items across 3 subscales).")
  await pool.end()
}

main().catch((error) => {
  console.error("DASS-21 seed failed:", error)
  process.exit(1)
})
