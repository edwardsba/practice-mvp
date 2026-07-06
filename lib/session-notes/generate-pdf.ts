import PDFDocument from "pdfkit"

import type {
  SessionNoteAssessmentResult,
  SessionNoteAsqResult,
  SessionNoteBtpTarget,
  SessionNoteCrisisPlanInfo,
  SessionNoteNextAppointment,
} from "@/lib/session-notes/load-context"
import {
  formatSessionNoteDate,
  formatSessionNoteTime,
} from "@/lib/session-notes/format"

const PAGE_MARGIN = 50
const PAGE_WIDTH = 595.28 // A4 width in points
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2
const BASE_FONT_SIZE = 10
const LINE_GAP = 4
const HEADER_RULE_COLOR = "#999999"
const BOTTOM_RULE_COLOR = "#999999"
const TEXT_COLOR = "#111111"
const MUTED_COLOR = "#555555"

function formatDob(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export type SessionNotePdfData = {
  clientId: string
  clientName: string
  dateOfBirth: string | null
  sessionDate: string
  sessionTime: string | null
  therapeuticTarget: string | null
  btpTargets: SessionNoteBtpTarget[]
  assessments: SessionNoteAssessmentResult[]
  asqResult: SessionNoteAsqResult
  crisisPlan: SessionNoteCrisisPlanInfo
  practitionerNotes: string | null
  nextAppointment: SessionNoteNextAppointment
  practitionerName: string
  practitionerTitle: string | null
  practitionerDisplayName: string
}

type TableColumn = {
  header: string
  width: number
}

function bodyText(doc: PDFKit.PDFDocument, text: string, options: PDFKit.Mixins.TextOptions = {}) {
  doc
    .font("Helvetica")
    .fontSize(BASE_FONT_SIZE)
    .fillColor(TEXT_COLOR)
    .text(text, { lineGap: LINE_GAP, ...options })
}

function drawTable(
  doc: PDFKit.PDFDocument,
  columns: TableColumn[],
  rows: string[][]
) {
  const startX = doc.x
  let y = doc.y
  const rowPadding = 6

  doc.font("Helvetica").fontSize(BASE_FONT_SIZE).fillColor(TEXT_COLOR)
  let x = startX
  for (const col of columns) {
    doc.text(col.header, x, y, { width: col.width })
    x += col.width
  }
  y = doc.y + rowPadding
  doc
    .moveTo(startX, y)
    .lineTo(startX + CONTENT_WIDTH, y)
    .strokeColor(HEADER_RULE_COLOR)
    .lineWidth(0.75)
    .stroke()
  y += rowPadding

  doc.font("Helvetica").fontSize(BASE_FONT_SIZE).fillColor(TEXT_COLOR)
  for (const row of rows) {
    const rowStartY = y
    let maxHeight = 0
    for (let i = 0; i < columns.length; i++) {
      const cellHeight = doc.heightOfString(row[i] ?? "—", {
        width: columns[i].width,
      })
      maxHeight = Math.max(maxHeight, cellHeight)
    }
    x = startX
    for (let i = 0; i < columns.length; i++) {
      doc.text(row[i] ?? "—", x, rowStartY, { width: columns[i].width })
      x += columns[i].width
    }
    y = rowStartY + maxHeight + rowPadding
  }

  doc
    .moveTo(startX, y)
    .lineTo(startX + CONTENT_WIDTH, y)
    .strokeColor(BOTTOM_RULE_COLOR)
    .lineWidth(0.75)
    .stroke()
  y += rowPadding

  doc.x = startX
  doc.y = y
}

function sectionLabel(doc: PDFKit.PDFDocument, text: string) {
  doc.moveDown(0.75)
  doc
    .font("Helvetica-BoldOblique")
    .fontSize(BASE_FONT_SIZE)
    .fillColor(TEXT_COLOR)
    .text(text, { lineGap: LINE_GAP })
  doc.moveDown(0.4)
}

export function generateSessionNotePdf(data: SessionNotePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN })
    const chunks: Buffer[] = []

    doc.on("data", (chunk) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    // Title
    doc
      .font("Helvetica-Bold")
      .fontSize(BASE_FONT_SIZE)
      .fillColor(TEXT_COLOR)
      .text("Confidential Session Note", { lineGap: LINE_GAP })
    doc.moveDown(0.75)

    // Client / session meta
    bodyText(doc, `Client: ${data.clientName} (DOB: ${formatDob(data.dateOfBirth)})`)
    bodyText(
      doc,
      `Session: ${formatSessionNoteDate(data.sessionDate)}, ${formatSessionNoteTime(data.sessionTime)}`
    )

    // Objective Measures
    sectionLabel(doc, "Objective Measures")
    const completedAssessments = data.assessments.filter(
      (a) => a.assessmentResultId
    )
    if (completedAssessments.length === 0) {
      doc.fillColor(MUTED_COLOR)
      bodyText(doc, "No objective measures completed this session.")
      doc.fillColor(TEXT_COLOR)
    } else {
      drawTable(
        doc,
        [
          { header: "Assessment", width: 90 },
          { header: "Score", width: 55 },
          { header: "Rating", width: 210 },
          { header: "Functional Impairment", width: 140 },
        ],
        completedAssessments.map((a) => [
          a.name,
          `${a.score}${a.maxScore != null ? `/${a.maxScore}` : ""}`,
          a.severity ?? "—",
          a.functionalImpairmentLabel ?? "—",
        ])
      )
    }

    // Risk Assessment
    sectionLabel(doc, "Risk Assessment")
    if (data.asqResult) {
      drawTable(
        doc,
        [
          { header: "Assessment", width: 110 },
          { header: "Score", width: 110 },
          { header: "Rating", width: 275 },
        ],
        [["ASQ", `${data.asqResult.score}/5`, data.asqResult.acuteRiskRating ?? "—"]]
      )
    } else {
      doc.fillColor(MUTED_COLOR)
      bodyText(doc, "No ASQ administered this session.")
      doc.fillColor(TEXT_COLOR)
    }
    doc.moveDown(0.3)
    bodyText(
      doc,
      `Current crisis plan: ${
        data.crisisPlan
          ? `v${data.crisisPlan.versionNumber}, ${formatSessionNoteDate(data.crisisPlan.dateOfPlan)}`
          : "—"
      }`
    )

    // Treatment Plan Progress
    sectionLabel(doc, "Treatment Plan Progress")
    bodyText(doc, `Therapeutic target: ${data.therapeuticTarget || "No treatment plan"}`)
    doc.moveDown(0.3)
    if (data.btpTargets.length === 0) {
      doc.fillColor(MUTED_COLOR)
      bodyText(doc, "No behavioural target results for this session.")
      doc.fillColor(TEXT_COLOR)
    } else {
      drawTable(
        doc,
        [
          { header: "Behavioural Target", width: 245 },
          { header: "Score", width: 100 },
          { header: "Rating", width: 150 },
        ],
        data.btpTargets.map((t) => [t.target, `${t.score}/5`, t.ratingLabel])
      )
    }

    // Notes
    sectionLabel(doc, "Notes")
    bodyText(doc, data.practitionerNotes?.trim() || "—")

    // Next appointment
    doc.moveDown(0.6)
    doc
      .font("Helvetica-Oblique")
      .fontSize(BASE_FONT_SIZE)
      .fillColor(TEXT_COLOR)
      .text("Next Appointment ", { continued: true, lineGap: LINE_GAP })
      .font("Helvetica")
      .text(data.nextAppointment?.label ?? "No upcoming appointment", {
        lineGap: LINE_GAP,
      })

    // Signature
    doc.moveDown(2.5)
    const signatureY = doc.y
    doc
      .moveTo(PAGE_MARGIN, signatureY + 30)
      .lineTo(PAGE_MARGIN + 220, signatureY + 30)
      .strokeColor("#666666")
      .lineWidth(0.5)
      .stroke()
    doc
      .font("Helvetica")
      .fontSize(BASE_FONT_SIZE)
      .fillColor(MUTED_COLOR)
      .text("Practitioner signature", PAGE_MARGIN, signatureY)
    doc
      .fontSize(BASE_FONT_SIZE)
      .fillColor(TEXT_COLOR)
      .text(data.practitionerDisplayName || "—", PAGE_MARGIN, signatureY + 36)

    doc.end()
  })
}
