import { MSE_INSERT_WORDS } from "@/lib/mse/insert-words"

export type MseSentenceFieldKey =
  | "appearance"
  | "behaviour"
  | "eyeContact"
  | "motorActivity"
  | "affect"
  | "hallucination"
  | "depersonalisationDerealisation"
  | "homicidality"
  | "delusions"
  | "orientation"
  | "memory"
  | "attention"
  | "insight"
  | "judgement"

/** DB element_key → sentence-engine field key. Suicidality is intentionally absent. */
export const MSE_ELEMENT_KEY_TO_FIELD: Record<string, MseSentenceFieldKey> = {
  mse_appearance: "appearance",
  mse_behaviour: "behaviour",
  mse_eye_contact: "eyeContact",
  mse_motor_activity: "motorActivity",
  mse_affect: "affect",
  mse_hallucination: "hallucination",
  mse_depersonalisation_derealisation: "depersonalisationDerealisation",
  mse_homicidality: "homicidality",
  mse_delusions: "delusions",
  mse_orientation: "orientation",
  mse_memory: "memory",
  mse_attention: "attention",
  mse_insight: "insight",
  mse_judgement: "judgement",
}

export type MseFieldSelection = {
  optionLabel: string
  isReportingBaseline: boolean
}

export type MseSessionNoteResponses = Partial<
  Record<MseSentenceFieldKey, MseFieldSelection>
>

const PRESENTATION_FIELDS: {
  key: MseSentenceFieldKey
  label: string
}[] = [
  { key: "appearance", label: "Appearance" },
  { key: "behaviour", label: "Behaviour" },
  { key: "eyeContact", label: "Eye contact" },
  { key: "motorActivity", label: "Motor activity" },
  { key: "affect", label: "Affect" },
]

const MENTAL_FUNCTION_GROUPS: {
  name: string
  fields: MseSentenceFieldKey[]
}[] = [
  {
    name: "Perceptions",
    fields: ["hallucination", "depersonalisationDerealisation"],
  },
  {
    name: "Thoughts",
    // suicidality deliberately excluded
    fields: ["homicidality", "delusions"],
  },
  {
    name: "Cognitions",
    fields: ["orientation", "memory", "attention"],
  },
]

const DISCERNMENT_FIELDS: {
  key: MseSentenceFieldKey
  label: string
}[] = [
  { key: "insight", label: "Insight" },
  { key: "judgement", label: "Judgement" },
]

export {
  PRESENTATION_FIELDS as MSE_PRESENTATION_FIELDS,
  MENTAL_FUNCTION_GROUPS as MSE_MENTAL_FUNCTION_GROUPS,
  DISCERNMENT_FIELDS as MSE_DISCERNMENT_FIELDS,
}

/** 1 → itself; 2 → "A and B"; 3+ → "A, B and C" (no serial comma). */
export function joinNames(names: string[]): string {
  if (names.length === 0) return ""
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

function lowercaseExceptFirst(names: string[]): string[] {
  return names.map((name, index) =>
    index === 0 ? name : name.charAt(0).toLowerCase() + name.slice(1)
  )
}

export { lowercaseExceptFirst as mseLowercaseExceptFirst }

function insertWord(
  fieldKey: MseSentenceFieldKey,
  optionLabel: string
): string | null {
  return MSE_INSERT_WORDS[fieldKey]?.[optionLabel] ?? null
}

function buildPresentationBlock(responses: MseSessionNoteResponses): string {
  const normalLabels: string[] = []
  const abnormalSentences: string[] = []

  for (const field of PRESENTATION_FIELDS) {
    const selection = responses[field.key]
    if (!selection) continue

    if (selection.isReportingBaseline) {
      normalLabels.push(field.label)
      continue
    }

    const word = insertWord(field.key, selection.optionLabel)
    if (!word) continue
    abnormalSentences.push(`${field.label} was ${word}.`)
  }

  const parts: string[] = []

  if (normalLabels.length === 1) {
    parts.push(
      `${lowercaseExceptFirst(normalLabels)[0]} was within expected limits.`
    )
  } else if (normalLabels.length === 2) {
    parts.push(
      `${joinNames(lowercaseExceptFirst(normalLabels))} were within expected limits.`
    )
  } else if (normalLabels.length >= 3) {
    parts.push(
      `${joinNames(lowercaseExceptFirst(normalLabels))} were all within expected limits.`
    )
  }

  parts.push(...abnormalSentences)
  return parts.join(" ")
}

function buildMentalFunctionBlock(responses: MseSessionNoteResponses): string {
  const normalGroupNames: string[] = []
  const abnormalSentences: string[] = []

  for (const group of MENTAL_FUNCTION_GROUPS) {
    const selections = group.fields
      .map((key) => ({ key, selection: responses[key] }))
      .filter(
        (entry): entry is { key: MseSentenceFieldKey; selection: MseFieldSelection } =>
          entry.selection != null
      )

    if (selections.length === 0) continue

    const allNormal = selections.every(
      (entry) => entry.selection.isReportingBaseline
    )

    if (allNormal) {
      normalGroupNames.push(group.name)
      continue
    }

    const abnormalWords: string[] = []
    for (const { key, selection } of selections) {
      if (selection.isReportingBaseline) continue
      const word = insertWord(key, selection.optionLabel)
      if (word) abnormalWords.push(word)
    }

    if (abnormalWords.length > 0) {
      abnormalSentences.push(
        `${group.name} included ${joinNames(abnormalWords)}.`
      )
    }
  }

  const parts: string[] = []

  if (normalGroupNames.length === 1 || normalGroupNames.length === 2) {
    parts.push(
      `${joinNames(lowercaseExceptFirst(normalGroupNames))} were within expected limits.`
    )
  } else if (normalGroupNames.length >= 3) {
    parts.push(
      `${joinNames(lowercaseExceptFirst(normalGroupNames))} were all within expected limits.`
    )
  }

  parts.push(...abnormalSentences)
  return parts.join(" ")
}

function buildDiscernmentBlock(responses: MseSessionNoteResponses): string {
  const normalLabels: string[] = []
  const abnormalSentences: string[] = []

  for (const field of DISCERNMENT_FIELDS) {
    const selection = responses[field.key]
    if (!selection) continue

    if (selection.isReportingBaseline) {
      normalLabels.push(field.label)
      continue
    }

    const word = insertWord(field.key, selection.optionLabel)
    if (!word) continue
    abnormalSentences.push(`${field.label} was ${word}.`)
  }

  const parts: string[] = []

  if (normalLabels.length === 1) {
    parts.push(`${lowercaseExceptFirst(normalLabels)[0]} was good.`)
  } else if (normalLabels.length === 2) {
    parts.push(
      `${joinNames(lowercaseExceptFirst(normalLabels))} were both good.`
    )
  }

  parts.push(...abnormalSentences)
  return parts.join(" ")
}

/**
 * Build the Session Note MSE narrative paragraph from field selections.
 * Suicidality is never read — omit it from `responses`.
 */
export function buildMseSessionNoteSentence(
  responses: MseSessionNoteResponses
): string {
  return [
    buildPresentationBlock(responses),
    buildMentalFunctionBlock(responses),
    buildDiscernmentBlock(responses),
  ]
    .filter((block) => block.trim().length > 0)
    .join(" ")
}
