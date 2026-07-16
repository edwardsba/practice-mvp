import { buildAsqSummarySentence } from "@/lib/assessment-summary/asq-template"
import { buildCrisisPlanSummarySentence } from "@/lib/assessment-summary/crisis-plan-summary"
import { buildSelfHarmHistorySentence } from "@/lib/assessment-summary/self-harm-history"
import { buildBtpSummaryParagraphs } from "@/lib/assessment-summary/btp-template"
import { buildMseProgressReportParagraph } from "@/lib/assessment-summary/mse-template"
import {
  buildAssessmentSummaryParagraph,
  toAssessmentPoints,
} from "@/lib/assessment-summary/templates"
import type { LetterBodyDoc, LetterBodyNode } from "@/lib/reports/letter-body-types"
import type { ReportSnapshot } from "@/lib/reports/snapshot"
import {
  getAsqResultsFromSnapshot,
  getAssistResultsFromSnapshot,
  getBtpResultsFromSnapshot,
  getGad7ResultsFromSnapshot,
  getMseResultsFromSnapshot,
  getPhq9ResultsFromSnapshot,
} from "@/lib/reports/snapshot"
import { buildTreatmentPlanSummary } from "@/lib/reports/treatment-plan-summary"

function heading(text: string): LetterBodyNode {
  return {
    type: "heading",
    attrs: { level: 2 },
    content: [{ type: "text", text }],
  }
}

function paragraph(text: string): LetterBodyNode {
  if (!text) return { type: "paragraph" }
  return { type: "paragraph", content: [{ type: "text", text }] }
}

function getReferrerFirstName(snapshot: ReportSnapshot): string | null {
  if (snapshot.recipient?.type !== "referrer") return null
  return (
    snapshot.recipient.firstName ||
    snapshot.recipient.name?.split(" ")[0] ||
    "Doctor"
  )
}

export function generateLetterBody(snapshot: ReportSnapshot): LetterBodyDoc {
  const content: LetterBodyNode[] = []
  const clientFirstName = snapshot.client.firstName
  const clientLastName = snapshot.client.lastName

  const referrerFirstName = getReferrerFirstName(snapshot)
  if (referrerFirstName) {
    content.push(paragraph(`Dear ${referrerFirstName},`))
    content.push(
      paragraph(
        `Thank you for your referral of ${clientFirstName} ${clientLastName}. Please find below a summary of the objective assessments completed across this referral period.`
      )
    )
  }

  const treatmentPlanSummary = buildTreatmentPlanSummary(
    clientFirstName,
    snapshot.therapeuticTarget,
    snapshot.behaviouralTargets
  )
  content.push(heading("Treatment plan summary"))
  content.push(paragraph(treatmentPlanSummary))

  const mseResults = getMseResultsFromSnapshot(snapshot)
  const mseParagraph = buildMseProgressReportParagraph(mseResults)
  content.push(heading("Mental status examination"))
  content.push(
    paragraph(
      mseParagraph ??
        "A Mental Status Examination (MSE) was not administered during this period."
    )
  )

  const phq9Results = getPhq9ResultsFromSnapshot(snapshot)
  const gad7Results = getGad7ResultsFromSnapshot(snapshot)
  const phq9Paragraph = buildAssessmentSummaryParagraph(
    "PHQ9",
    toAssessmentPoints(phq9Results),
    clientFirstName
  )
  const gad7Paragraph = buildAssessmentSummaryParagraph(
    "GAD7",
    toAssessmentPoints(gad7Results),
    clientFirstName
  )

  if (phq9Paragraph || gad7Paragraph) {
    content.push(heading("Mood and anxiety assessment"))
    content.push(
      paragraph(
        `As part of the treatment plan, ongoing emotional state was monitored using the Patient Health Questionnaire (PHQ-9) and the Generalised Anxiety Disorder scale (GAD-7).`
      )
    )
    if (phq9Paragraph) content.push(paragraph(phq9Paragraph))
    if (gad7Paragraph) content.push(paragraph(gad7Paragraph))
  }

  content.push(heading("Risk assessment"))

  content.push(paragraph(buildSelfHarmHistorySentence(snapshot.suicideAttempts)))

  const asqResults = getAsqResultsFromSnapshot(snapshot)
  const asqSentence = buildAsqSummarySentence(
    asqResults.map((r) => ({
      date: r.date,
      recentPositive: r.recentPositive ?? false,
      currentPositive: r.currentPositive ?? false,
    }))
  )
  const asqIntro =
    "Suicide risk was monitored throughout treatment using the Ask Suicide-Screening Questions (ASQ)."
  const asqNotAdministered =
    "The Ask Suicide-Screening Questions Assessment (ASQ) was not administered during this period."
  content.push(
    paragraph(asqSentence ? `${asqIntro} ${asqSentence}` : asqNotAdministered)
  )

  content.push(
    paragraph(
      buildCrisisPlanSummarySentence(clientFirstName, snapshot.crisisPlanDate)
    )
  )

  const btpResults = getBtpResultsFromSnapshot(snapshot)
  const assistResults = getAssistResultsFromSnapshot(snapshot)
  const assistParagraph = snapshot.assistEnabled
    ? buildAssessmentSummaryParagraph(
        "ASSIST",
        toAssessmentPoints(assistResults),
        clientFirstName
      )
    : null
  const btpParagraphs = buildBtpSummaryParagraphs(btpResults, clientFirstName)

  if (btpParagraphs.length > 0 || assistParagraph) {
    content.push(heading("Behavioural targets"))
    const behaviouralTargetsIntro =
      "Progress towards the client's behavioural targets was monitored with a self-rated measure."
    const assistIntro = snapshot.assistEnabled
      ? " Substance use was monitored using the Alcohol, Smoking and Substance Involvement Screening Test (ASSIST)."
      : ""
    content.push(paragraph(`${behaviouralTargetsIntro}${assistIntro}`))
    for (const { paragraph: text } of btpParagraphs) {
      content.push(paragraph(text))
    }
    if (assistParagraph) content.push(paragraph(assistParagraph))
  }

  content.push(heading("Clinical summary"))
  content.push(paragraph(""))
  content.push(heading("Recommendations"))
  content.push(paragraph(""))

  return { type: "doc", content }
}
