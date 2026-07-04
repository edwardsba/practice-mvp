import PDFDocument from "pdfkit"

import type { CrisisPlanPdfData } from "@/lib/crisis-plan/build-pdf-data"

const PAGE_MARGIN = 50
const PAGE_WIDTH = 595.28
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2
const COLUMN_GAP = 20
const COLUMN_WIDTH = (CONTENT_WIDTH - COLUMN_GAP) / 2
const BASE_FONT_SIZE = 10
const LINE_GAP = 4
const TEXT_COLOR = "#111111"
const MUTED_COLOR = "#666666"
const RULE_COLOR = "#cccccc"
const SECTION_GAP = 12

function pageTitle(doc: PDFKit.PDFDocument, text: string) {
  doc.font("Helvetica-Bold").fontSize(22).fillColor(TEXT_COLOR).text(text, {
    lineGap: LINE_GAP,
  })
}

function subtitle(doc: PDFKit.PDFDocument, text: string) {
  doc.font("Helvetica").fontSize(11).fillColor("#444444").text(text, {
    lineGap: LINE_GAP,
  })
  doc.moveDown(0.75)
}

function sectionHeading(doc: PDFKit.PDFDocument, text: string) {
  doc.moveDown(0.5)
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(TEXT_COLOR)
    .text(text, { lineGap: LINE_GAP })
  doc.moveDown(0.25)
}

function bulletListAt(
  doc: PDFKit.PDFDocument,
  x: number,
  startY: number,
  width: number,
  items: string[]
): number {
  let y = startY
  if (items.length === 0) {
    doc.font("Helvetica-Oblique").fontSize(BASE_FONT_SIZE).fillColor(MUTED_COLOR)
    doc.text("None selected", x, y, { width })
    y = doc.y
    doc.fillColor(TEXT_COLOR)
    return y
  }
  doc.font("Helvetica").fontSize(BASE_FONT_SIZE).fillColor(TEXT_COLOR)
  for (const item of items) {
    doc.text(`•  ${item}`, x, y, { width, lineGap: LINE_GAP })
    y = doc.y
  }
  return y
}

function drawTwoColumnSection(
  doc: PDFKit.PDFDocument,
  leftTitle: string,
  leftItems: string[],
  rightTitle: string,
  rightItems: string[]
) {
  const leftX = PAGE_MARGIN
  const rightX = PAGE_MARGIN + COLUMN_WIDTH + COLUMN_GAP
  const startY = doc.y

  doc.font("Helvetica-Bold").fontSize(BASE_FONT_SIZE).fillColor(TEXT_COLOR)
  doc.text(leftTitle, leftX, startY, { width: COLUMN_WIDTH, lineGap: LINE_GAP })
  const leftListY = doc.y + 4
  const leftEndY = bulletListAt(doc, leftX, leftListY, COLUMN_WIDTH, leftItems)

  doc.font("Helvetica-Bold").fontSize(BASE_FONT_SIZE).fillColor(TEXT_COLOR)
  doc.text(rightTitle, rightX, startY, { width: COLUMN_WIDTH, lineGap: LINE_GAP })
  const rightListY = doc.y + 4
  const rightEndY = bulletListAt(doc, rightX, rightListY, COLUMN_WIDTH, rightItems)

  doc.x = PAGE_MARGIN
  doc.y = Math.max(leftEndY, rightEndY) + SECTION_GAP * 0.5
}

function drawEmergencyContactsTable(
  doc: PDFKit.PDFDocument,
  contacts: CrisisPlanPdfData["contacts"]
) {
  if (contacts.length === 0) {
    doc.font("Helvetica-Oblique").fontSize(BASE_FONT_SIZE).fillColor(MUTED_COLOR)
    doc.text("No emergency contacts listed.", { lineGap: LINE_GAP })
    doc.fillColor(TEXT_COLOR)
    return
  }

  const columns = [
    { header: "Role", width: CONTENT_WIDTH * 0.18 },
    { header: "Name", width: CONTENT_WIDTH * 0.24 },
    { header: "Phone", width: CONTENT_WIDTH * 0.24 },
    { header: "Email", width: CONTENT_WIDTH * 0.34 },
  ]

  const startX = PAGE_MARGIN
  let y = doc.y

  doc.font("Helvetica-Bold").fontSize(BASE_FONT_SIZE).fillColor(TEXT_COLOR)
  let x = startX
  for (const col of columns) {
    doc.text(col.header, x, y, { width: col.width })
    x += col.width
  }
  y = doc.y + 4
  doc.moveTo(startX, y).lineTo(startX + CONTENT_WIDTH, y).strokeColor(RULE_COLOR).lineWidth(0.75).stroke()
  y += 6

  doc.font("Helvetica").fontSize(BASE_FONT_SIZE).fillColor(TEXT_COLOR)
  for (const contact of contacts) {
    const row = [
      contact.role || "—",
      contact.name,
      contact.phone || "—",
      contact.email || "—",
    ]
    const rowStartY = y
    let maxHeight = 0
    x = startX
    for (let i = 0; i < columns.length; i++) {
      const h = doc.heightOfString(row[i], { width: columns[i].width })
      maxHeight = Math.max(maxHeight, h)
    }
    for (let i = 0; i < columns.length; i++) {
      doc.text(row[i], x, rowStartY, { width: columns[i].width })
      x += columns[i].width
    }
    y = rowStartY + maxHeight + 6
  }

  doc.x = startX
  doc.y = y
}

export function generateCrisisPlanPdf(data: CrisisPlanPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN })
    const chunks: Buffer[] = []

    doc.on("data", (chunk) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    // Page 1
    pageTitle(doc, "Crisis Plan")
    subtitle(doc, `${data.clientName} — ${data.dateOfPlan}`)

    sectionHeading(doc, "Emergency Contacts")
    drawEmergencyContactsTable(doc, data.contacts)

    sectionHeading(doc, "Emergency Numbers")
    bulletListAt(doc, PAGE_MARGIN, doc.y, CONTENT_WIDTH, data.emergencyNumbers)
    doc.x = PAGE_MARGIN

    doc.moveDown(0.5)
    sectionHeading(doc, "Doing Well / Staying Well")
    drawTwoColumnSection(
      doc,
      "Signs that I am doing well",
      data.doingWell,
      "Things I need to do to stay well",
      data.stayWell
    )

    // Page 2
    doc.addPage()

    sectionHeading(doc, "Becoming Unwell / Getting Better")
    drawTwoColumnSection(
      doc,
      "Signs that I am becoming unwell",
      data.becomingUnwell,
      "Things I need to do to get better",
      data.getBetter
    )

    sectionHeading(doc, "Unwell / Crisis Response")
    drawTwoColumnSection(
      doc,
      "Signs that I am unwell or in crisis",
      data.unwell,
      "Things to do when I am unwell",
      data.crisisResponse
    )

    doc.end()
  })
}
