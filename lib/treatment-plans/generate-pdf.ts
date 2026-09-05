import PDFDocument from "pdfkit"

import {
  ALTERNATE_RESPONSES_OPTIONS,
  CASE_FORMULATION_OPTIONS,
  ONGOING_ASSESSMENT_OPTIONS,
  PSYCHOEDUCATION_OPTIONS,
  QUALITY_OF_LIFE_OPTIONS,
  RISK_MANAGEMENT_OPTIONS,
  SUPPORT_SERVICES_OPTIONS,
  TREATMENT_MODALITY_OPTIONS,
  optionLabel,
} from "@/lib/treatment-plans/fields"
import type { TreatmentPlanRow } from "@/lib/treatment-plans/types"
import {
  formatAttemptDate,
  sortAttemptsChronologically,
} from "@/lib/treatment-plans/format-attempt-date"

const PAGE_MARGIN = 50
const PAGE_WIDTH = 595.28
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2
const BASE_FONT_SIZE = 10
const LINE_GAP = 4
const TEXT_COLOR = "#111111"
const MUTED_COLOR = "#555555"
const SECTION_GAP = 12

export type TreatmentPlanPdfClient = {
  firstName: string
  lastName: string
  dateOfBirth: string | null
}

function formatDisplayDate(value: string | Date | null): string {
  if (!value) return "—"
  const date =
    value instanceof Date
      ? value
      : new Date(value.includes("T") ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function heading(doc: PDFKit.PDFDocument, text: string) {
  doc.moveDown(0.75)
  doc
    .font("Helvetica-Bold")
    .fontSize(BASE_FONT_SIZE)
    .fillColor(TEXT_COLOR)
    .text(text, { lineGap: LINE_GAP })
  doc.moveDown(0.25)
}

function bodyText(doc: PDFKit.PDFDocument, text: string) {
  doc
    .font("Helvetica")
    .fontSize(BASE_FONT_SIZE)
    .fillColor(TEXT_COLOR)
    .text(text, { lineGap: LINE_GAP, width: CONTENT_WIDTH })
}

function bulletList(doc: PDFKit.PDFDocument, items: string[]) {
  if (items.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(BASE_FONT_SIZE)
      .fillColor(MUTED_COLOR)
      .text("None selected", { lineGap: LINE_GAP })
    return
  }
  doc.font("Helvetica").fontSize(BASE_FONT_SIZE).fillColor(TEXT_COLOR)
  for (const item of items) {
    doc.text(`•  ${item}`, { lineGap: LINE_GAP, width: CONTENT_WIDTH, indent: 4 })
  }
}

function multiSectionLabels(
  options: { key: string; label: string }[],
  section: { selected: string[]; other: string[] } | null
): string[] {
  if (!section) return []
  return [
    ...section.selected.map((key) => optionLabel(options, key)),
    ...section.other,
  ]
}

export function generateTreatmentPlanPdf(
  plan: TreatmentPlanRow,
  client: TreatmentPlanPdfClient
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN })
    const chunks: Buffer[] = []

    doc.on("data", (chunk) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor(TEXT_COLOR)
      .text("Treatment Plan", { lineGap: LINE_GAP })
    doc.y = doc.y + SECTION_GAP * 0.5

    doc.font("Helvetica").fontSize(BASE_FONT_SIZE).fillColor(TEXT_COLOR)
    doc.text(`Client name: ${client.firstName} ${client.lastName}`, {
      lineGap: LINE_GAP,
    })
    doc.text(`Date of birth: ${formatDisplayDate(client.dateOfBirth)}`, {
      lineGap: LINE_GAP,
    })
    doc.text(`Version: ${plan.versionNumber}`, { lineGap: LINE_GAP })
    doc.text(`Start date: ${formatDisplayDate(plan.startDate)}`, {
      lineGap: LINE_GAP,
    })
    if (plan.endDate) {
      doc.text(`End date: ${formatDisplayDate(plan.endDate)}`, {
        lineGap: LINE_GAP,
      })
    }
    doc.text(`Created: ${formatDisplayDate(plan.createdAt)}`, {
      lineGap: LINE_GAP,
    })

    doc.y = doc.y + SECTION_GAP

    heading(doc, "Diagnosis")
    bodyText(doc, plan.diagnosis?.trim() || "—")

    heading(doc, "Therapeutic target")
    bodyText(doc, plan.therapeuticTarget?.trim() || "—")

    heading(doc, "Behavioural targets")
    bulletList(doc, plan.behaviouralTargetsJson?.items ?? [])

    heading(doc, "Treatment modalities")
    bulletList(
      doc,
      multiSectionLabels(TREATMENT_MODALITY_OPTIONS, plan.treatmentModalitiesJson)
    )

    heading(doc, "Case formulation model")
    bulletList(
      doc,
      multiSectionLabels(CASE_FORMULATION_OPTIONS, plan.caseFormulationJson)
    )

    heading(doc, "Ongoing assessment tools")
    const ongoing = plan.ongoingAssessmentsJson ?? {
      phq9: false,
      gad7: false,
      assist: false,
    }
    bulletList(
      doc,
      ONGOING_ASSESSMENT_OPTIONS.filter(
        (option) => ongoing[option.key as keyof typeof ongoing]
      ).map((option) => option.label)
    )

    heading(doc, "Risk")

    const suicideAttempts = sortAttemptsChronologically(
      plan.suicideAttemptsJson?.items ?? []
    )
    doc
      .font("Helvetica-Bold")
      .fontSize(BASE_FONT_SIZE)
      .fillColor(TEXT_COLOR)
      .text("Suicide attempt history (lifetime)", { lineGap: LINE_GAP })
    doc.moveDown(0.15)
    if (suicideAttempts.length === 0) {
      doc
        .font("Helvetica")
        .fontSize(BASE_FONT_SIZE)
        .fillColor(MUTED_COLOR)
        .text("No suicide attempts recorded", { lineGap: LINE_GAP })
    } else {
      doc.font("Helvetica").fontSize(BASE_FONT_SIZE).fillColor(TEXT_COLOR)
      for (const attempt of suicideAttempts) {
        const line = attempt.notes
          ? `${formatAttemptDate(attempt)} — ${attempt.notes}`
          : formatAttemptDate(attempt)
        doc.text(`•  ${line}`, { lineGap: LINE_GAP, width: CONTENT_WIDTH, indent: 4 })
      }
    }
    doc.moveDown(0.35)

    bulletList(
      doc,
      multiSectionLabels(RISK_MANAGEMENT_OPTIONS, plan.riskManagementJson)
    )

    heading(doc, "Support services")
    bulletList(
      doc,
      multiSectionLabels(SUPPORT_SERVICES_OPTIONS, plan.supportServicesJson)
    )

    heading(doc, "Psychoeducation")
    bulletList(
      doc,
      multiSectionLabels(PSYCHOEDUCATION_OPTIONS, plan.psychoeducationJson)
    )

    heading(doc, "Alternate responses")
    bulletList(
      doc,
      multiSectionLabels(
        ALTERNATE_RESPONSES_OPTIONS,
        plan.alternateResponsesJson
      )
    )

    heading(doc, "Quality of life")
    bulletList(
      doc,
      multiSectionLabels(QUALITY_OF_LIFE_OPTIONS, plan.qualityOfLifeJson)
    )

    doc.end()
  })
}
