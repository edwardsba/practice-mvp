import PDFDocument from "pdfkit"

import type { ReportSnapshot } from "@/lib/reports/snapshot"
import {
  getAsqResultsFromSnapshot,
  getAssistResultsFromSnapshot,
  getBtpResultsFromSnapshot,
  getGad7ResultsFromSnapshot,
  getPhq9ResultsFromSnapshot,
} from "@/lib/reports/snapshot"
import { resolveTemplateKey } from "@/lib/reports/templates"

const PAGE_MARGIN = 50
const PAGE_WIDTH = 595.28
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2
const BASE_FONT_SIZE = 10
const LINE_GAP = 4
const HEADER_RULE_COLOR = "#e0e0e0"
const BOTTOM_RULE_COLOR = "#e0e0e0"
const TEXT_COLOR = "#111111"
const MUTED_COLOR = "#555555"
const SECTION_GAP = 16

function formatDisplayDate(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatShortDate(value: string): string {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

type TableColumn = { header: string; width: number }

function drawTable(
  doc: PDFKit.PDFDocument,
  columns: TableColumn[],
  rows: string[][]
) {
  const startX = PAGE_MARGIN
  const rowPadding = 6
  const pageBottomMargin = doc.page.height - PAGE_MARGIN
  const lineHeight = doc.currentLineHeight(true)

  const headerHeight = lineHeight + rowPadding * 2
  const minRowHeight = lineHeight + rowPadding
  if (doc.y + headerHeight + minRowHeight > pageBottomMargin) {
    doc.addPage()
    doc.x = startX
  }

  let y = doc.y
  doc.font("Helvetica-Bold").fontSize(BASE_FONT_SIZE).fillColor(TEXT_COLOR)
  let x = startX
  for (const col of columns) {
    doc.text(col.header, x, y, { width: col.width, lineBreak: false })
    x += col.width
  }
  y += lineHeight + rowPadding

  doc
    .moveTo(startX, y)
    .lineTo(startX + CONTENT_WIDTH, y)
    .strokeColor(HEADER_RULE_COLOR)
    .lineWidth(0.75)
    .stroke()
  y += rowPadding

  doc.font("Helvetica").fontSize(BASE_FONT_SIZE).fillColor(TEXT_COLOR)
  for (const row of rows) {
    let maxHeight = lineHeight
    for (let i = 0; i < columns.length; i++) {
      const cellText = row[i] ?? "—"
      const h = doc.heightOfString(cellText, { width: columns[i].width })
      if (h > maxHeight) maxHeight = h
    }
    const rowHeight = maxHeight + rowPadding

    if (y + rowHeight > pageBottomMargin) {
      doc.addPage()
      y = PAGE_MARGIN
      doc.font("Helvetica-Bold").fontSize(BASE_FONT_SIZE).fillColor(TEXT_COLOR)
      x = startX
      for (const col of columns) {
        doc.text(col.header, x, y, { width: col.width, lineBreak: false })
        x += col.width
      }
      y += lineHeight + rowPadding
      doc
        .moveTo(startX, y)
        .lineTo(startX + CONTENT_WIDTH, y)
        .strokeColor(HEADER_RULE_COLOR)
        .lineWidth(0.75)
        .stroke()
      y += rowPadding
      doc.font("Helvetica").fontSize(BASE_FONT_SIZE).fillColor(TEXT_COLOR)
    }

    x = startX
    for (let i = 0; i < columns.length; i++) {
      const cellText = row[i] ?? "—"
      doc.text(cellText, x, y, { width: columns[i].width, lineBreak: false })
      x += columns[i].width
    }
    y += rowHeight
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

function sectionHeading(doc: PDFKit.PDFDocument, text: string) {
  doc.moveDown(0.75)
  doc
    .font("Helvetica-Bold")
    .fontSize(BASE_FONT_SIZE)
    .fillColor(TEXT_COLOR)
    .text(text, { lineGap: LINE_GAP })
  doc.moveDown(0.4)
}

function bodyText(
  doc: PDFKit.PDFDocument,
  text: string,
  options: PDFKit.Mixins.TextOptions = {}
) {
  doc
    .font("Helvetica")
    .fontSize(BASE_FONT_SIZE)
    .fillColor(TEXT_COLOR)
    .text(text, { lineGap: LINE_GAP, ...options })
}

function mutedText(doc: PDFKit.PDFDocument, text: string) {
  doc
    .font("Helvetica")
    .fontSize(BASE_FONT_SIZE)
    .fillColor(MUTED_COLOR)
    .text(text, { lineGap: LINE_GAP })
}

function drawLetterHeader(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot) {
  const practiceLines = [
    snapshot.practice.practiceName,
    ...(snapshot.practice.practiceAddress
      ? snapshot.practice.practiceAddress
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean)
      : []),
  ]

  const hasRecipient = snapshot.recipient && snapshot.recipient.type !== "none"
  const recipientLines: string[] = []
  if (hasRecipient && snapshot.recipient) {
    if (snapshot.recipient.name) recipientLines.push(snapshot.recipient.name)
    if (snapshot.recipient.organisationName) {
      recipientLines.push(snapshot.recipient.organisationName)
    }
    if (snapshot.recipient.streetAddress) {
      recipientLines.push(
        ...snapshot.recipient.streetAddress
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean)
      )
    }
    if (
      snapshot.recipient.postalAddress &&
      snapshot.recipient.postalAddress !== snapshot.recipient.streetAddress
    ) {
      recipientLines.push(
        ...snapshot.recipient.postalAddress
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean)
      )
    }
  }

  const addrStartY = PAGE_MARGIN
  const rightColX = PAGE_MARGIN + CONTENT_WIDTH - 180

  doc.font("Helvetica-Bold").fontSize(BASE_FONT_SIZE).fillColor(TEXT_COLOR)
  doc.text(practiceLines[0], rightColX, addrStartY, {
    width: 180,
    align: "right",
  })
  doc.font("Helvetica").fillColor(MUTED_COLOR)
  for (const line of practiceLines.slice(1)) {
    doc.text(line, rightColX, doc.y, { width: 180, align: "right" })
  }

  if (recipientLines.length > 0) {
    let ry = addrStartY
    doc.font("Helvetica-Bold").fontSize(BASE_FONT_SIZE).fillColor(TEXT_COLOR)
    doc.text(recipientLines[0], PAGE_MARGIN, ry, { width: 250 })
    doc.font("Helvetica").fillColor(MUTED_COLOR)
    for (const line of recipientLines.slice(1)) {
      ry = doc.y
      doc.text(line, PAGE_MARGIN, ry, { width: 250 })
    }
  }

  const addrBottomY = Math.max(doc.y, addrStartY + 40)
  doc.y = addrBottomY + SECTION_GAP
  doc.font("Helvetica").fontSize(BASE_FONT_SIZE).fillColor(MUTED_COLOR)
  doc.text(formatDisplayDate(snapshot.reportDate), PAGE_MARGIN, doc.y)
  doc.fillColor(TEXT_COLOR)
  doc.y = doc.y + SECTION_GAP

  doc
    .font("Helvetica-Bold")
    .fontSize(BASE_FONT_SIZE)
    .fillColor(TEXT_COLOR)
    .text(snapshot.reportTitle, { lineGap: LINE_GAP })

  doc.x = PAGE_MARGIN
  doc.y = doc.y + SECTION_GAP
}

function drawProgressReportBody(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot) {
  const metaY = doc.y
  doc
    .font("Helvetica-Bold")
    .fontSize(BASE_FONT_SIZE)
    .fillColor(MUTED_COLOR)
    .text("Client", PAGE_MARGIN, metaY, { width: CONTENT_WIDTH / 2 })
  doc.font("Helvetica").fillColor(TEXT_COLOR)
  doc.text(
    `${snapshot.client.firstName} ${snapshot.client.lastName}`,
    PAGE_MARGIN,
    doc.y,
    { width: CONTENT_WIDTH / 2 }
  )
  mutedText(doc, `Date of birth: ${formatDisplayDate(snapshot.client.dateOfBirth)}`)

  const practColX = PAGE_MARGIN + CONTENT_WIDTH / 2
  doc
    .font("Helvetica-Bold")
    .fontSize(BASE_FONT_SIZE)
    .fillColor(MUTED_COLOR)
    .text("Practitioner", practColX, metaY, { width: CONTENT_WIDTH / 2 })
  doc.font("Helvetica").fillColor(TEXT_COLOR)
  const displayLine =
    snapshot.practitioner.displayName ?? snapshot.practitioner.fullName
  doc.text(displayLine, practColX, doc.y, { width: CONTENT_WIDTH / 2 })
  doc
    .fillColor(MUTED_COLOR)
    .text(snapshot.practice.practiceName, practColX, doc.y, {
      width: CONTENT_WIDTH / 2,
    })
  doc.fillColor(TEXT_COLOR)

  doc.x = PAGE_MARGIN
  doc.y = doc.y + SECTION_GAP

  if (snapshot.dateRangeStart && snapshot.dateRangeEnd) {
    doc
      .font("Helvetica-Bold")
      .fontSize(BASE_FONT_SIZE)
      .fillColor(TEXT_COLOR)
      .text("Reporting period: ", { continued: true, lineGap: LINE_GAP })
    doc
      .font("Helvetica")
      .text(
        `${formatShortDate(snapshot.dateRangeStart)} – ${formatShortDate(snapshot.dateRangeEnd)}`,
        { lineGap: LINE_GAP }
      )
  }

  if (snapshot.fundingApproval) {
    sectionHeading(doc, "Funding approval")
    bodyText(doc, snapshot.fundingApproval.approvalTypeName)
    if (snapshot.fundingApproval.startDate) {
      mutedText(
        doc,
        `Approved: ${formatDisplayDate(snapshot.fundingApproval.startDate)}`
      )
    }
    mutedText(
      doc,
      `Progress: ${snapshot.fundingApproval.appointmentsAttended} of ${
        snapshot.fundingApproval.appointmentsApproved ?? "?"
      } appointments attended`
    )
  }

  const phq9Results = getPhq9ResultsFromSnapshot(snapshot)
  const gad7Results = getGad7ResultsFromSnapshot(snapshot)
  const asqResults = getAsqResultsFromSnapshot(snapshot)
  const assistResults = getAssistResultsFromSnapshot(snapshot)
  const btpResults = getBtpResultsFromSnapshot(snapshot)

  function scoreCell(score: number, maxScore?: number | null): string {
    return maxScore != null ? `${score} / ${maxScore}` : String(score)
  }

  if (phq9Results.length > 0) {
    sectionHeading(doc, "PHQ-9 results")
    drawTable(
      doc,
      [
        { header: "Date", width: 95 },
        { header: "Score", width: 65 },
        { header: "Severity", width: 200 },
        { header: "Functional Impairment", width: 135 },
      ],
      phq9Results.map((r) => [
        formatShortDate(r.date),
        scoreCell(r.score, r.maxScore),
        r.severity ?? "—",
        r.functionalImpairmentLabel ?? "—",
      ])
    )
  }

  if (gad7Results.length > 0) {
    sectionHeading(doc, "GAD-7 results")
    drawTable(
      doc,
      [
        { header: "Date", width: 95 },
        { header: "Score", width: 65 },
        { header: "Severity", width: 200 },
        { header: "Functional Impairment", width: 135 },
      ],
      gad7Results.map((r) => [
        formatShortDate(r.date),
        scoreCell(r.score, r.maxScore),
        r.severity ?? "—",
        r.functionalImpairmentLabel ?? "—",
      ])
    )
  }

  if (asqResults.length > 0) {
    sectionHeading(doc, "ASQ results")
    drawTable(
      doc,
      [
        { header: "Date", width: 95 },
        { header: "Score", width: 65 },
        { header: "Screen outcome", width: 335 },
      ],
      asqResults.map((r) => [
        formatShortDate(r.date),
        scoreCell(r.score, r.maxScore),
        r.acuteRiskRating ?? "—",
      ])
    )
  }

  if (assistResults.length > 0) {
    sectionHeading(doc, "ASSIST results")
    drawTable(
      doc,
      [
        { header: "Date", width: 95 },
        { header: "Score", width: 65 },
        { header: "Risk Level", width: 335 },
      ],
      assistResults.map((r) => [
        formatShortDate(r.date),
        scoreCell(r.score, r.maxScore),
        r.severity ?? "—",
      ])
    )
  }

  if (btpResults.length > 0) {
    sectionHeading(doc, "Behavioural Targets Progress")

    const targetMap = new Map<
      string,
      Array<{
        date: string
        score: number
        maxScore?: number | null
        ratingLabel: string
      }>
    >()
    for (const result of btpResults) {
      for (const target of result.targets) {
        const rows = targetMap.get(target.target) ?? []
        rows.push({
          date: result.date,
          score: target.score,
          maxScore: target.maxScore,
          ratingLabel: target.ratingLabel,
        })
        targetMap.set(target.target, rows)
      }
    }

    for (const [target, rows] of targetMap.entries()) {
      doc.moveDown(0.4)
      doc
        .font("Helvetica-Oblique")
        .fontSize(BASE_FONT_SIZE)
        .fillColor(TEXT_COLOR)
        .text(target, { lineGap: LINE_GAP })
      doc.moveDown(0.2)
      drawTable(
        doc,
        [
          { header: "Date", width: 95 },
          { header: "Score", width: 65 },
          { header: "Rating", width: 335 },
        ],
        rows.map((r) => [
          formatShortDate(r.date),
          scoreCell(r.score, r.maxScore),
          r.ratingLabel,
        ])
      )
    }
  }

  if (snapshot.clinicalSummaryText?.trim()) {
    sectionHeading(doc, "Clinical summary")
    bodyText(doc, snapshot.clinicalSummaryText.trim())
  }

  if (snapshot.recommendationsText?.trim()) {
    sectionHeading(doc, "Recommendations")
    bodyText(doc, snapshot.recommendationsText.trim())
  }
}

function drawReferralAcknowledgementBody(
  doc: PDFKit.PDFDocument,
  snapshot: ReportSnapshot
) {
  const clientName = `${snapshot.client.firstName} ${snapshot.client.lastName}`
  const dob = snapshot.client.dateOfBirth
    ? ` (DOB ${formatDisplayDate(snapshot.client.dateOfBirth)})`
    : ""
  const fa = snapshot.fundingApproval
  const recipientName = snapshot.recipient?.name?.trim()
  const salutation = recipientName ? `Dear ${recipientName},` : "Dear Colleague,"
  const notes = snapshot.clinicalSummaryText?.trim()

  doc.moveDown(0.5)
  bodyText(doc, `Re: ${clientName}${dob}`)
  doc.moveDown(0.5)
  bodyText(doc, salutation)
  doc.moveDown(0.5)

  const approvalClause = fa
    ? ` under the ${fa.approvalTypeName}${
        fa.startDate ? `, dated ${formatDisplayDate(fa.startDate)}` : ""
      }${
        fa.appointmentsApproved != null
          ? `, approving ${fa.appointmentsApproved} session${
              fa.appointmentsApproved === 1 ? "" : "s"
            }`
          : ""
      }`
    : ""

  bodyText(
    doc,
    `Thank you for your referral of ${clientName} to ${snapshot.practice.practiceName}. I am writing to confirm that the referral has been received${approvalClause}.`
  )
  doc.moveDown(0.5)
  bodyText(
    doc,
    `An appointment has been arranged and ${clientName} will be contacted to commence treatment. I will provide progress reports in accordance with the referral's reporting requirements.`
  )

  if (notes) {
    doc.moveDown(0.5)
    bodyText(doc, notes)
  }

  doc.moveDown(0.5)
  bodyText(
    doc,
    "Please do not hesitate to contact me should you require any further information."
  )
}

function drawSignature(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot) {
  const practitionerLines = [snapshot.practitioner.title, snapshot.practitioner.fullName]
    .filter(Boolean)
    .join(" ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)

  doc.moveDown(2)

  if (snapshot.practitioner.signatureDataUrl) {
    try {
      const base64Data = snapshot.practitioner.signatureDataUrl.replace(
        /^data:image\/\w+;base64,/,
        ""
      )
      const imgBuffer = Buffer.from(base64Data, "base64")
      doc.image(imgBuffer, PAGE_MARGIN, doc.y, { height: 48 })
      doc.y = doc.y + 56
    } catch {
      doc.moveDown(2)
    }
  } else {
    doc.moveDown(2)
  }

  for (let i = 0; i < practitionerLines.length; i++) {
    if (i === 0) {
      doc
        .font("Helvetica-Bold")
        .fontSize(BASE_FONT_SIZE)
        .fillColor(TEXT_COLOR)
        .text(practitionerLines[i], { lineGap: LINE_GAP })
    } else {
      mutedText(doc, practitionerLines[i])
    }
  }
}

export function generateReportPdf(snapshot: ReportSnapshot): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN })
    const chunks: Buffer[] = []

    doc.on("data", (chunk) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    const templateKey = resolveTemplateKey(snapshot.templateKey)

    drawLetterHeader(doc, snapshot)

    if (templateKey === "referral_acknowledgement") {
      drawReferralAcknowledgementBody(doc, snapshot)
    } else {
      drawProgressReportBody(doc, snapshot)
    }

    drawSignature(doc, snapshot)
    doc.end()
  })
}
