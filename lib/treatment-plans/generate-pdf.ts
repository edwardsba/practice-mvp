import PDFDocument from "pdfkit"

import {
  ONGOING_ASSESSMENT_OPTIONS,
  TREATMENT_MODALITY_OPTIONS,
  TREATMENT_MODEL_OPTIONS,
  TREATMENT_SUMMARY_ITEMS,
  flattenSupportServiceOptions,
  optionLabel,
} from "@/lib/treatment-plans/fields"
import type { TreatmentPlanRow } from "@/lib/treatment-plans/types"
import {
  formatAttemptDate,
  sortAttemptsChronologically,
} from "@/lib/treatment-plans/format-attempt-date"
import { loadActiveCrisisPlanSummary } from "@/lib/crisis-plans/load"

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

export async function generateTreatmentPlanPdf(
  plan: TreatmentPlanRow,
  client: TreatmentPlanPdfClient
): Promise<Buffer> {
  const crisisPlanSummary = await loadActiveCrisisPlanSummary(
    plan.clientId,
    plan.practiceId
  )

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
    doc.moveDown(0.15)
    doc
      .font("Helvetica")
      .fontSize(BASE_FONT_SIZE)
      .fillColor(MUTED_COLOR)
      .text(`Report date: ${formatDisplayDate(plan.diagnosisReportDate)}`, {
        lineGap: LINE_GAP,
      })

    heading(doc, "Therapeutic target")
    bodyText(doc, plan.therapeuticTarget?.trim() || "—")

    heading(doc, "SMART Goals")
    bulletList(doc, plan.smartGoalsJson?.items ?? [])

    heading(doc, "Treatment modalities")
    bulletList(
      doc,
      multiSectionLabels(TREATMENT_MODALITY_OPTIONS, plan.treatmentModalitiesJson)
    )

    heading(doc, "Treatment Model")
    bodyText(
      doc,
      plan.treatmentModelJson?.selected
        ? optionLabel(TREATMENT_MODEL_OPTIONS, plan.treatmentModelJson.selected)
        : "None selected"
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

    const medicationSupervision = plan.medicationSupervisionJson ?? {
      supervised: false,
      supervisorName: null,
    }
    doc
      .font("Helvetica-Bold")
      .fontSize(BASE_FONT_SIZE)
      .fillColor(TEXT_COLOR)
      .text("Medication supervision", { lineGap: LINE_GAP })
    doc.moveDown(0.15)
    doc
      .font("Helvetica")
      .fontSize(BASE_FONT_SIZE)
      .fillColor(TEXT_COLOR)
      .text(
        medicationSupervision.supervised
          ? `Yes — supervised by ${medicationSupervision.supervisorName ?? "—"}`
          : "No",
        { lineGap: LINE_GAP }
      )
    doc.moveDown(0.35)

    doc
      .font("Helvetica-Bold")
      .fontSize(BASE_FONT_SIZE)
      .fillColor(TEXT_COLOR)
      .text("Crisis plan", { lineGap: LINE_GAP })
    doc.moveDown(0.15)
    doc
      .font("Helvetica")
      .fontSize(BASE_FONT_SIZE)
      .fillColor(crisisPlanSummary ? TEXT_COLOR : MUTED_COLOR)
      .text(
        crisisPlanSummary
          ? `Version ${crisisPlanSummary.versionNumber} — ${formatDisplayDate(crisisPlanSummary.dateOfPlan)}`
          : "No current crisis plan",
        { lineGap: LINE_GAP }
      )

    heading(doc, "Other Support Services")
    bulletList(
      doc,
      multiSectionLabels(flattenSupportServiceOptions(), plan.supportServicesJson)
    )

    heading(doc, "Treatment Summary")
    bulletList(doc, TREATMENT_SUMMARY_ITEMS)

    doc.end()
  })
}
