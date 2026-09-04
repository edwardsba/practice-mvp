import PDFDocument from "pdfkit"

import type { SageSrDiagnosticReportContent } from "@/lib/assessment-summary/load-sage-sr-diagnostic-report"

const PAGE_MARGIN = 50
const PAGE_WIDTH = 595.28
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2
const BASE_FONT_SIZE = 10
const LINE_GAP = 4
const TEXT_COLOR = "#111111"
const MUTED_COLOR = "#555555"
const ALERT_COLOR = "#dc2626"
const SECTION_GAP = 12
const HEADER_RULE_COLOR = "#e0e0e0"
const CALLOUT_FILL = "#fffbeb"
const CALLOUT_BORDER = "#fcd34d"
const CALLOUT_INK = "#451a03"
const CALLOUT_PADDING = 8

export type SageSrDiagnosticReportPdfMeta = {
  title: string
  clientName: string
  dateOfBirth: string | null
  reportDate: string | null
  practiceName: string
}

export function resolveSageSrDiagnosticReportContent(
  edited: unknown,
  generated: unknown
): SageSrDiagnosticReportContent | null {
  const candidate = edited ?? generated
  if (!candidate || typeof candidate !== "object") return null
  const content = candidate as SageSrDiagnosticReportContent
  if (typeof content.exclusionClause !== "string" || !content.core) return null
  return content
}

function formatDisplayDate(value: string | null | undefined): string {
  if (!value?.trim()) return "—"
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function pageBottom(doc: PDFKit.PDFDocument) {
  return doc.page.height - PAGE_MARGIN
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > pageBottom(doc)) {
    doc.addPage()
    doc.x = PAGE_MARGIN
  }
}

function heading(doc: PDFKit.PDFDocument, text: string) {
  ensureSpace(doc, BASE_FONT_SIZE * 3)
  doc.moveDown(0.75)
  doc
    .font("Helvetica-Bold")
    .fontSize(BASE_FONT_SIZE)
    .fillColor(TEXT_COLOR)
    .text(text, { lineGap: LINE_GAP, width: CONTENT_WIDTH })
  doc.moveDown(0.25)
}

function bodyText(
  doc: PDFKit.PDFDocument,
  text: string,
  color: string = TEXT_COLOR
) {
  doc
    .font("Helvetica")
    .fontSize(BASE_FONT_SIZE)
    .fillColor(color)
    .text(text, { lineGap: LINE_GAP, width: CONTENT_WIDTH })
}

function drawExclusionCallout(doc: PDFKit.PDFDocument, text: string) {
  const innerWidth = CONTENT_WIDTH - CALLOUT_PADDING * 2
  doc.font("Helvetica").fontSize(BASE_FONT_SIZE)
  let remaining = text.trim()

  while (remaining.length > 0) {
    const minHeight =
      CALLOUT_PADDING * 2 + doc.currentLineHeight(true) + LINE_GAP
    if (pageBottom(doc) - doc.y < minHeight + 4) {
      doc.addPage()
      doc.x = PAGE_MARGIN
    }

    const innerAvail = pageBottom(doc) - doc.y - CALLOUT_PADDING * 2
    let lo = 1
    let hi = remaining.length
    let fit = remaining.slice(0, 1)
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2)
      const candidate = remaining.slice(0, mid)
      const h = doc.heightOfString(candidate, {
        width: innerWidth,
        lineGap: LINE_GAP,
      })
      if (h <= innerAvail) {
        fit = candidate
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    if (fit.length < remaining.length) {
      const lastSpace = fit.lastIndexOf(" ")
      if (lastSpace > 0) fit = fit.slice(0, lastSpace)
    }

    const boxInnerH = doc.heightOfString(fit, {
      width: innerWidth,
      lineGap: LINE_GAP,
    })
    const boxH = boxInnerH + CALLOUT_PADDING * 2
    const y = doc.y
    doc.save()
    doc.lineWidth(1)
    doc
      .rect(PAGE_MARGIN, y, CONTENT_WIDTH, boxH)
      .fillAndStroke(CALLOUT_FILL, CALLOUT_BORDER)
    doc.restore()
    doc.fillColor(CALLOUT_INK)
    doc.text(fit, PAGE_MARGIN + CALLOUT_PADDING, y + CALLOUT_PADDING, {
      width: innerWidth,
      lineGap: LINE_GAP,
    })
    doc.y = y + boxH + 6
    doc.x = PAGE_MARGIN
    remaining = remaining.slice(fit.length).trim()
  }

  doc.fillColor(TEXT_COLOR)
}

export function generateSageSrDiagnosticReportPdf(
  meta: SageSrDiagnosticReportPdfMeta,
  content: SageSrDiagnosticReportContent
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
      .text(meta.title, { lineGap: LINE_GAP, width: CONTENT_WIDTH })
    doc.y = doc.y + SECTION_GAP * 0.5

    doc.font("Helvetica").fontSize(BASE_FONT_SIZE).fillColor(TEXT_COLOR)
    doc.text(`Client name: ${meta.clientName}`, { lineGap: LINE_GAP })
    doc.text(`Date of birth: ${formatDisplayDate(meta.dateOfBirth)}`, {
      lineGap: LINE_GAP,
    })
    doc.text(`Report date: ${formatDisplayDate(meta.reportDate)}`, {
      lineGap: LINE_GAP,
    })
    doc.text(`Practice: ${meta.practiceName}`, { lineGap: LINE_GAP })

    doc.y = doc.y + SECTION_GAP * 0.5
    doc
      .moveTo(PAGE_MARGIN, doc.y)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
      .strokeColor(HEADER_RULE_COLOR)
      .lineWidth(0.75)
      .stroke()
    doc.y = doc.y + SECTION_GAP

    if (content.introduction) {
      bodyText(doc, content.introduction)
      doc.moveDown(0.5)
    }

    drawExclusionCallout(doc, content.exclusionClause)

    if (content.background) {
      heading(doc, "Background")
      const backgroundParagraphs = [
        content.background.opening,
        content.background.background,
        content.background.adverseChildhoodEvents,
        content.background.currentFunctioning,
        content.background.safetyAndStability,
        content.background.treatmentEngagement,
      ].filter((text): text is string => Boolean(text))
      for (const paragraph of backgroundParagraphs) {
        bodyText(doc, paragraph, MUTED_COLOR)
        doc.moveDown(0.35)
      }
    }

    heading(doc, "Core")
    if (content.core.alertsSentence) {
      bodyText(doc, content.core.alertsSentence, ALERT_COLOR)
      doc.moveDown(0.35)
    }
    for (const paragraph of content.core.paragraphs) {
      bodyText(doc, paragraph.paragraph, MUTED_COLOR)
      doc.moveDown(0.35)
    }
    if (content.core.furtherEvaluationSentence) {
      bodyText(doc, content.core.furtherEvaluationSentence, MUTED_COLOR)
      doc.moveDown(0.35)
    }
    if (content.core.absentOrMinimalSentence) {
      bodyText(doc, content.core.absentOrMinimalSentence, MUTED_COLOR)
      doc.moveDown(0.35)
    }

    if (content.personality) {
      heading(doc, "Personality")
      for (const paragraph of content.personality.paragraphs) {
        bodyText(doc, paragraph.paragraph, MUTED_COLOR)
        doc.moveDown(0.35)
      }
      if (content.personality.belowThresholdSentence) {
        bodyText(doc, content.personality.belowThresholdSentence, MUTED_COLOR)
      }
    }

    doc.end()
  })
}
