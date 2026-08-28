import type { SageSrBackgroundSection } from "@/lib/sage-sr/parse-background"

/** Splits a "Label: Value" line on its FIRST colon — correct for every real line this
 *  section deals with, since values never themselves contain a colon in the real data
 *  (confirmed against Test01's actual parsed output after the parser fix in
 *  parse-background.ts). Returns null for a line with no colon at all (shouldn't happen
 *  post-parser-fix, but defensive rather than throwing on unexpected input). */
function parseLabelValue(line: string): { label: string; value: string } | null {
  const colonIndex = line.indexOf(":")
  if (colonIndex === -1) return null
  return {
    label: line.slice(0, colonIndex).trim(),
    value: line.slice(colonIndex + 1).trim(),
  }
}

function findLine(lines: string[], labelPrefix: string): { label: string; value: string } | null {
  for (const line of lines) {
    const parsed = parseLabelValue(line)
    if (parsed && parsed.label.startsWith(labelPrefix)) return parsed
  }
  return null
}

const STANDARD_LIKERT = ["Never", "Rarely", "Sometimes", "Often", "Always"]

/** For a "frequency-protective" item, Often/Always is the non-clinical baseline —
 *  Sometimes/Rarely/Never is notable. Some Housing/Social-Supports response values carry
 *  a trailing garbled parenthetical count (e.g. "Sometimes 6(-10 times)" — a known,
 *  separate, not-yet-fixed parser artifact) — only the leading Likert word is read, the
 *  rest is ignored rather than risking a bad split on malformed text. */
function likertWord(value: string): string {
  const match = STANDARD_LIKERT.find((word) => value.startsWith(word))
  return match ?? value
}

function isProtectiveBaseline(value: string): boolean {
  const word = likertWord(value)
  return word === "Often" || word === "Always"
}

/** Social Determinants of Health uses a stricter threshold than other protective-frequency
 *  sections, per Ben's explicit call — basic needs (food, housing, prescriptions) are only
 *  truly non-notable at "Always"; "Often" still gets named individually rather than folded
 *  into the collapse, unlike every other frequency-protective section in this report. */
function isStrictProtectiveBaseline(value: string): boolean {
  return likertWord(value) === "Always"
}

/** For a "frequency-problem" item (Physical Impairment is the one section in this report
 *  where this applies), Never/Rarely is the baseline and Sometimes/Often/Always is
 *  notable — the reverse polarity of every other frequency section here. */
function isProblemBaseline(value: string): boolean {
  const word = likertWord(value)
  return word === "Never" || word === "Rarely"
}

function isNoBaseline(value: string): boolean {
  return value === "No"
}

/** Fully lowercases a label/value for mid-sentence embedding — Background's labels are
 *  Title Case as TeleSage printed them ("Stable Housing", "Money for food/clothes"), not
 *  sentence-initial-only capitalized the way Personality's DSM criterion text is, so a
 *  single-character lowercaseFirst leaves embedded capitals like "stable Housing". No
 *  genuine proper nouns appear in these labels (ethnicity/race values are handled
 *  separately, since "Hispanic/Latino" and "White" do need to stay capitalized). */
function lc(text: string): string {
  return text.toLowerCase()
}

/**
 * The MSE-style collapse-or-list mechanism this whole Background section is built on:
 * items at the non-clinical baseline fold into one collapsed sentence naming all of
 * them together; anything NOT at baseline is always named individually and explicitly,
 * regardless of how small a minority it is. A section where every item is at baseline
 * gets only the collapse sentence; a section where every item is notable gets only the
 * individual sentences; a mixed section gets both.
 */
function buildCollapseOrListSentences(
  items: { label: string; value: string }[],
  isBaseline: (value: string) => boolean,
  collapseSentence: (labels: string[]) => string,
  itemSentence: (label: string, value: string) => string
): string[] {
  const baselineLabels: string[] = []
  const notableSentences: string[] = []

  for (const item of items) {
    if (isBaseline(item.value)) {
      baselineLabels.push(item.label)
    } else {
      notableSentences.push(itemSentence(item.label, item.value))
    }
  }

  const sentences: string[] = []
  if (baselineLabels.length > 0) sentences.push(collapseSentence(baselineLabels))
  sentences.push(...notableSentences)
  return sentences
}

function joinList(items: string[]): string {
  if (items.length === 0) return ""
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`
}

/** Same as joinList, but with "or" as the final conjunction — for negation contexts
 *  ("no poor sleep, physical health, or pain") where "and" reads wrong in English. */
function joinListOr(items: string[]): string {
  if (items.length === 0) return ""
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} or ${items[1]}`
  return `${items.slice(0, -1).join(", ")}, or ${items[items.length - 1]}`
}

/** Natural-phrase form of each of the fixed frequency-based Adverse Childhood Events
 *  questions this instrument always asks (the question set itself doesn't vary between
 *  clients, only the responses) — keyed by the exact label text as parse-background.ts
 *  produces it. "Parent died" is intentionally absent: it's a Yes/No item, not a
 *  frequency item, and handled separately from the rest of the ACE list below. */
const ACE_NATURAL_PHRASES: Record<string, string> = {
  "Lived with someone who had a serious mental health problem": "living with someone who had a serious mental health problem",
  "Lived with someone who had a serious substance use problem": "living with someone who had a serious substance use problem",
  "Was physically abused": "physical abuse",
  "Was emotionally abused": "emotional abuse",
  "Was neglected": "neglect",
  "Saw violent events near them": "exposure to violent events",
  "Parent in jail/prison": "a parent being incarcerated",
}

/** Natural phrase (with correct article) for each of the 3 fixed Phone and Internet
 *  Access items this instrument always asks — same fixed-question-set reasoning as
 *  ACE_NATURAL_PHRASES above. */
const PHONE_ACCESS_PHRASES: Record<string, string> = {
  "Had access to smartphone": "a smartphone",
  "Had access to data/minutes": "data/minutes",
  "Had access to internet": "the internet",
}

export interface SageSrBackgroundReportGroups {
  opening: string | null
  background: string | null
  adverseChildhoodEvents: string | null
  currentFunctioning: string | null
  safetyAndStability: string | null
  treatmentEngagement: string | null
}

/**
 * Builds the combined Background section of the SAGE-SR Diagnostic Report from a
 * client's parsed Background sections, grouped into 6 narrative groups (per Ben's
 * approved plan) rather than TeleSage's own arbitrary section order. Any of the 6 group
 * fields may be null if that group had nothing to report (e.g. Behavioral Health
 * Treatment History is entirely skipped when "Not Administered" — a real, expected case,
 * distinct from a section that genuinely has "None reported" as a client answer).
 *
 * Self-Injury Associated Items is deliberately never read here — excluded from the
 * Diagnostic Report entirely, per Ben's standing instruction to keep this document clear
 * of risk-assessment content (a separate system's job).
 *
 * Cross-referencing against Core's and Personality's own findings (ACEs vs. trauma/mood
 * diagnoses, Physical Impairment's sleep item vs. Core's sleep-related criteria,
 * Presenting Problem vs. what Core actually found, lifetime vs. current substance use)
 * is flagged inline below at each relevant spot but NOT implemented here — Core's own
 * section generator doesn't exist yet, so there's nothing to cross-reference against
 * yet. Revisit once it does.
 */
export function buildSageSrBackgroundSection(
  sections: SageSrBackgroundSection[]
): SageSrBackgroundReportGroups {
  const byName = new Map(sections.map((s) => [s.section, s]))
  const linesOf = (name: string) => byName.get(name)?.lines ?? []

  // ---------- Group 1: Opening (Demographics + Presenting Problem) ----------
  const demoLines = linesOf("Demographics")
  const age = findLine(demoLines, "Age")?.value
  const race = findLine(demoLines, "Race")?.value
  const ethnicity = findLine(demoLines, "Ethnicity")?.value
  const sexAtBirth = findLine(demoLines, "Sex at Birth")?.value
  const pronouns = findLine(demoLines, "Pronouns")?.value

  const demoSentence =
    age && race && sexAtBirth && pronouns
      ? `The client is a ${age}-year-old ${race}${ethnicity ? ` (${ethnicity})` : ""} individual, assigned ${lc(sexAtBirth)} at birth, using ${lc(pronouns)} pronouns.`
      : null

  const presentingProblemValue = findLine(linesOf("Presenting Behavioral Health Problem"), "")?.value
  // TODO cross-reference: once Core's own section generator exists, compare whatever the
  // client stated here against what Core's screening actually surfaced — a mismatch (or
  // a "none reported" here alongside real Core findings) is a genuinely useful thing to
  // note explicitly, not something to build blind right now.
  const presentingProblemSentence =
    presentingProblemValue && presentingProblemValue !== "None reported"
      ? `The client's stated presenting complaint was: ${lc(presentingProblemValue)}.`
      : "The client did not report a presenting behavioral health problem at intake."

  const opening = [demoSentence, presentingProblemSentence].filter(Boolean).join(" ") || null

  // ---------- Group 2: Background (Education, Work, prior Dx history, Treatment History) ----------
  const educationValue = findLine(linesOf("Education"), "Education")?.value
  const educationSentence = educationValue ? `Highest level of education completed: ${lc(educationValue)}.` : null

  const workStatusValue = findLine(linesOf("Current Work Status"), "Work Status")?.value
  const paidWorkValue = findLine(linesOf("Current Work Status"), "Paid Work")?.value
  const workSentence =
    workStatusValue && paidWorkValue
      ? `He is currently ${lc(workStatusValue)}, working ${paidWorkValue} per week.`
      : workStatusValue
        ? `Current work status: ${lc(workStatusValue)}.`
        : null

  // Personal Behavioral Health History's two fields ("Substance Use Diagnosis" and
  // "Mental Health Diagnosis") render as a merged label line with their two values on
  // the following two lines in TeleSage's own layout — a distinct, narrower quirk from
  // the two already fixed in parse-background.ts, handled here by name rather than with
  // another blanket parser change, since it's specific to this one section's known,
  // fixed two-field structure.
  const personalHistoryLines = linesOf("Personal Behavioral Health History")
  const [substanceDx, mentalHealthDx] = personalHistoryLines.length >= 3
    ? [personalHistoryLines[1], personalHistoryLines[2]]
    : [undefined, undefined]
  // TODO cross-reference: once Core's generator exists, compare "None reported" lifetime
  // history here against Core's own CURRENT substance-use/mental-health diagnoses — a
  // client with no lifetime diagnosis but active current Core findings is worth noting.
  const personalHistorySentence =
    substanceDx && mentalHealthDx
      ? substanceDx === "None reported" && mentalHealthDx === "None reported"
        ? "He reported no lifetime history of substance use or mental health diagnoses."
        : `Lifetime diagnosis history: substance use — ${lc(substanceDx)}; mental health — ${lc(mentalHealthDx)}.`
      : null

  const familyHistoryValue = linesOf("Family Behavioral Health History")[0]
  const familyHistorySentence =
    familyHistoryValue === "None reported" || familyHistoryValue === undefined
      ? "No family history of behavioral health or substance use conditions was reported."
      : `Family behavioral health history: ${lc(familyHistoryValue)}.`

  // Behavioral Health Treatment History is skipped entirely when "Not Administered" —
  // that means this section wasn't given to the client at all, a genuinely different
  // case from a real "None reported" answer, and forcing a sentence out of "the
  // instrument wasn't administered" would misrepresent it as a clinical finding.
  const treatmentHistoryValue = linesOf("Behavioral Health Treatment History")[0]
  const treatmentHistorySentence =
    treatmentHistoryValue && treatmentHistoryValue !== "Not Administered"
      ? `Behavioral health treatment history: ${lc(treatmentHistoryValue)}.`
      : null

  const background =
    [educationSentence, workSentence, personalHistorySentence, familyHistorySentence, treatmentHistorySentence]
      .filter(Boolean)
      .join(" ") || null

  // ---------- Group 3: Adverse Childhood Events (always full detail, never collapsed) ----------
  // TODO cross-reference: once Core's generator exists, connect endorsed ACEs here to
  // any trauma-adjacent (PTSD) or mood/anxiety diagnoses Core found — childhood adversity
  // is well-established risk context for exactly those findings.
  const aceLines = linesOf("Adverse Childhood Events")
  const aceItems = aceLines.map(parseLabelValue).filter((i): i is { label: string; value: string } => i !== null)

  const parentDied = aceItems.find((i) => i.label === "Parent died")
  const impairmentItem = aceItems.find((i) => i.label.startsWith("Client reported resulting impairment"))
  const frequencyItems = aceItems.filter((i) => i.label in ACE_NATURAL_PHRASES)

  const endorsedAce = frequencyItems.filter((i) => likertWord(i.value) !== "Never")
  const deniedAce = frequencyItems.filter((i) => likertWord(i.value) === "Never")

  const aceSentences: string[] = []
  if (endorsedAce.length > 0) {
    aceSentences.push(
      `During childhood, the client reported ${joinList(
        endorsedAce.map((i) => `${ACE_NATURAL_PHRASES[i.label]} (${lc(likertWord(i.value))})`)
      )}.`
    )
  }
  const deniedPhrases = [...deniedAce.map((i) => ACE_NATURAL_PHRASES[i.label])]
  if (parentDied && parentDied.value === "No") deniedPhrases.push("the death of a parent")
  if (deniedPhrases.length > 0) {
    aceSentences.push(`He denied ${joinList(deniedPhrases)}.`)
  }
  if (parentDied && parentDied.value !== "No") {
    aceSentences.push(`He reported the death of a parent (${lc(parentDied.value)}).`)
  }
  if (impairmentItem) {
    aceSentences.push(
      impairmentItem.value === "No"
        ? "He did not report resulting impairment from these experiences in the past 30 days."
        : `He reported resulting impairment from these experiences in the past 30 days (${lc(impairmentItem.value)}).`
    )
  }

  const adverseChildhoodEvents = aceSentences.length > 0 ? aceSentences.join(" ") : null

  // ---------- Group 4: Current functioning (Housing/Social Supports + Resiliency) ----------
  const housingLines = linesOf("Current Housing and Social Supports")
  const maritalStatus = findLine(housingLines, "Marital Status")?.value
  const livesWith = findLine(housingLines, "Lives with")?.value
  const supportCount = findLine(housingLines, "Felt support from")?.value

  const housingFactsSentence =
    maritalStatus && livesWith
      ? `Marital status: ${lc(maritalStatus)}. He currently lives with ${lc(livesWith)}.`
      : null
  const supportCountSentence = supportCount
    ? `He reported having ${supportCount} he could rely on for emotional or practical support.`
    : null

  const housingFrequencyLabels = [
    "Participated in group social activities",
    "Had contact with friends/family",
    "Enjoyed contact with friends/family",
    "Had close friend(s)/family member(s)",
    "Had someone to turn to for advice",
    "Had practical support",
  ]
  const housingFrequencyItems = housingFrequencyLabels
    .map((label) => findLine(housingLines, label))
    .filter((i): i is { label: string; value: string } => i !== null)
  // These labels already read as complete predicates following "He" ("Had contact with
  // friends/family" = "[He] had contact with friends/family") — deliberately NOT
  // prefixed with a verb like "reported", which would double up on the label's own verb.
  const housingFrequencySentences = buildCollapseOrListSentences(
    housingFrequencyItems,
    isProtectiveBaseline,
    (labels) => `He ${joinList(labels.map(lc))}, consistently (often or always).`,
    (label, value) => `He ${lc(label)} only ${lc(likertWord(value))}.`
  )

  const resiliencyLines = linesOf("Resiliency")
  const resiliencyItems = resiliencyLines.map(parseLabelValue).filter((i): i is { label: string; value: string } => i !== null)
  const resiliencySentences = buildCollapseOrListSentences(
    resiliencyItems,
    isProtectiveBaseline,
    (labels) => `He ${joinList(labels.map(lc))}, consistently (often or always).`,
    (label, value) => `He ${lc(label)} only ${lc(likertWord(value))}.`
  )

  const currentFunctioning =
    [
      housingFactsSentence,
      supportCountSentence,
      ...housingFrequencySentences,
      ...resiliencySentences,
    ]
      .filter(Boolean)
      .join(" ") || null

  // ---------- Group 5: Safety and stability ----------
  const victimLines = linesOf("Victim of Crime")
  const victimItems = victimLines.map(parseLabelValue).filter((i): i is { label: string; value: string } => i !== null)
  const victimSentences = buildCollapseOrListSentences(
    victimItems,
    isNoBaseline,
    () => "He denied being a victim of sexual assault, other violent crime, or non-violent crime in the past 12 months.",
    (label, value) => `${label}: ${lc(value)}.`
  )

  const legalLines = linesOf("Legal History")
  const legalItems = legalLines.map(parseLabelValue).filter((i): i is { label: string; value: string } => i !== null)
  const legalSentences = buildCollapseOrListSentences(
    legalItems,
    isNoBaseline,
    () => "He reported no legal issues or arrests in the past 12 months.",
    (label, value) => `${label}: ${lc(value)}.`
  )

  // TODO cross-reference: once Core's generator exists, connect a notable sleep-problem
  // finding here to Core's own sleep-related criteria (present across several diagnoses —
  // MDE, GAD, manic episode).
  const impairmentLines = linesOf("Physical Impairment")
  const physicalImpairmentItems = impairmentLines.map(parseLabelValue).filter((i): i is { label: string; value: string } => i !== null)
  const impairmentSentences = buildCollapseOrListSentences(
    physicalImpairmentItems,
    isProblemBaseline,
    (labels) => `He reported no impairment due to ${joinListOr(labels.map((l) => lc(l).replace(/^had impairment due to /, "")))}.`,
    (label, value) => `He ${lc(label)} ${lc(likertWord(value))}.`
  )

  const sdohLines = linesOf("Social Determinants of Health")
  const sdohItems = sdohLines.map(parseLabelValue).filter((i): i is { label: string; value: string } => i !== null)
  const sdohSentences = buildCollapseOrListSentences(
    sdohItems,
    isStrictProtectiveBaseline,
    (labels) => `He reported no difficulties with social determinants of health — ${joinList(labels.map(lc))} were all consistently available.`,
    (label, value) => `${label} was reported as less than consistently available (${lc(likertWord(value))}).`
  )

  const phoneLines = linesOf("Phone and Internet Access")
  const phoneItems = phoneLines.map(parseLabelValue).filter((i): i is { label: string; value: string } => i !== null)
  const phoneSentences = buildCollapseOrListSentences(
    phoneItems,
    isProtectiveBaseline,
    (labels) => `He had consistent access to ${joinList(labels.map((l) => PHONE_ACCESS_PHRASES[l] ?? lc(l)))}.`,
    (label, value) => `${label} was reported as less consistent (${lc(likertWord(value))}).`
  )

  const safetyAndStability =
    [...victimSentences, ...legalSentences, ...impairmentSentences, ...sdohSentences, ...phoneSentences]
      .filter(Boolean)
      .join(" ") || null

  // ---------- Group 6: Treatment engagement ----------
  const willingnessValue = findLine(linesOf("Willingness to Receive Treatment"), "Interested in")?.value
  const treatmentEngagement =
    willingnessValue && willingnessValue.length > 0
      ? `The client indicated interest in: ${lc(willingnessValue)}.`
      : "No specific treatment interest was indicated."

  return {
    opening,
    background,
    adverseChildhoodEvents,
    currentFunctioning,
    safetyAndStability,
    treatmentEngagement,
  }
}
