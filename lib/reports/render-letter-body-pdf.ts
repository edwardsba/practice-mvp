import type { LetterBodyDoc, LetterBodyNode } from "@/lib/reports/letter-body-types"

type PdfTextHelpers = {
  groupHeading: (doc: PDFKit.PDFDocument, text: string) => void
  bodyText: (doc: PDFKit.PDFDocument, text: string) => void
}

function nodeText(node: LetterBodyNode): string {
  if (node.text) return node.text
  if (!node.content) return ""
  return node.content.map(nodeText).join("")
}

function renderInlineText(
  doc: PDFKit.PDFDocument,
  nodes: LetterBodyNode[] | undefined,
  bold: boolean
) {
  if (!nodes?.length) return

  for (const child of nodes) {
    if (child.type === "text") {
      const isBold = bold || child.marks?.some((mark) => mark.type === "bold")
      doc.font(isBold ? "Helvetica-Bold" : "Helvetica")
      doc.text(child.text ?? "", { continued: true, lineGap: 4 })
    } else if (child.content) {
      renderInlineText(doc, child.content, bold)
    }
  }
}

function contentBottom(doc: PDFKit.PDFDocument): number {
  return doc.page.height - doc.page.margins.bottom
}

function pageBodyHeight(doc: PDFKit.PDFDocument): number {
  return contentBottom(doc) - doc.page.margins.top
}

function measureText(doc: PDFKit.PDFDocument, text: string, textWidth: number, font: string): number {
  const y = doc.y
  const x = doc.x
  doc.font(font).fontSize(10)
  const height = doc.heightOfString(text.trim() ? text : " ", { width: textWidth, lineGap: 4 })
  doc.x = x
  doc.y = y
  return height
}

function itemGap(doc: PDFKit.PDFDocument): number {
  const y = doc.y
  const x = doc.x
  doc.font("Helvetica").fontSize(10)
  const gap = doc.currentLineHeight(true) * 0.35
  doc.x = x
  doc.y = y
  return gap
}

function atTopOfPage(doc: PDFKit.PDFDocument): boolean {
  return doc.y <= doc.page.margins.top + 1
}

function startNewPage(doc: PDFKit.PDFDocument) {
  doc.addPage()
  doc.x = doc.page.margins.left
  doc.y = doc.page.margins.top
}

function hangingLine(
  doc: PDFKit.PDFDocument,
  label: string,
  text: string,
  labelWidth: number,
  boldText: boolean
) {
  const left = doc.page.margins.left
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right
  const textWidth = width - labelWidth
  const font = boldText ? "Helvetica-Bold" : "Helvetica"
  const textHeight = measureText(doc, text, textWidth, font)
  const firstLineHeight = measureText(doc, "Ag", textWidth, font)
  const gap = itemGap(doc)
  let y = doc.y + gap
  const fitsOnOnePage = textHeight <= pageBodyHeight(doc)
  const needed = fitsOnOnePage ? textHeight : firstLineHeight
  if (y + needed > contentBottom(doc) && !atTopOfPage(doc)) {
    startNewPage(doc)
    y = doc.y
  } else {
    doc.moveDown(0.35)
    y = doc.y
  }
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111")
  doc.text(label, left, y, { width: labelWidth, lineGap: 4 })
  const labelBottom = doc.y
  doc.font(font).fontSize(10).fillColor("#111111")
  doc.text(text, left + labelWidth, y, { width: textWidth, lineGap: 4 })
  if (doc.y < labelBottom) doc.y = labelBottom
  doc.x = left
}

function firstNumberedItemText(nodes: LetterBodyNode[], from: number): { leadIn: string[]; item: string } {
  const leadIn: string[] = []
  for (let index = from; index < nodes.length; index += 1) {
    const node = nodes[index]
    if (node.type === "heading") break
    if (node.type === "paragraph") {
      const text = nodeText(node)
      if (text) leadIn.push(text)
      continue
    }
    if (node.type !== "orderedList") continue
    for (const child of node.content ?? []) {
      if (child.type !== "listItem") continue
      const text = nodeText(child)
      if (text) return { leadIn, item: text }
    }
  }
  return { leadIn, item: "" }
}

/** A numbered heading stays with the first line of its first item. */
function headingFitsWithFirstItem(doc: PDFKit.PDFDocument, heading: string, leadIn: string[], item: string): boolean {
  if (!item) return true
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right
  const gap = itemGap(doc)
  let height = gap + measureText(doc, heading, width - 28, "Helvetica-Bold")
  for (const paragraph of leadIn) {
    height += measureText(doc, paragraph, width, "Helvetica") + itemGap(doc)
  }
  height += gap + measureText(doc, "Ag", width - 36, "Helvetica")
  return doc.y + height <= contentBottom(doc)
}

export function renderLetterBodyPdf(
  doc: PDFKit.PDFDocument,
  letterBody: LetterBodyDoc,
  helpers: PdfTextHelpers
) {
  let section = 0
  let item = 0

  for (let index = 0; index < letterBody.content.length; index += 1) {
    const node = letterBody.content[index]
    if (node.type === "heading") {
      if (node.attrs?.numbered) {
        section += 1
        item = 0
        const heading = nodeText(node)
        const following = firstNumberedItemText(letterBody.content, index + 1)
        if (!headingFitsWithFirstItem(doc, heading, following.leadIn, following.item) && !atTopOfPage(doc)) {
          startNewPage(doc)
        }
        hangingLine(doc, `${section}.`, heading, 28, true)
      } else {
        helpers.groupHeading(doc, nodeText(node))
      }
      continue
    }

    if (node.type === "paragraph") {
      const text = nodeText(node)
      if (text) {
        helpers.bodyText(doc, text)
        doc.moveDown(0.4)
      } else {
        doc.moveDown(0.4)
      }
      continue
    }

    if (node.type === "bulletList") {
      for (const item of node.content ?? []) {
        if (item.type !== "listItem") continue
        const itemText = nodeText(item)
        if (itemText) {
          helpers.bodyText(doc, `• ${itemText}`)
        }
      }
      continue
    }

    if (node.type === "orderedList") {
      for (const child of node.content ?? []) {
        if (child.type !== "listItem") continue
        item += 1
        const itemText = nodeText(child)
        if (!itemText) continue
        const label = section > 0 ? `${section}.${item}.` : `${item}.`
        hangingLine(doc, label, itemText, 36, false)
      }
    }
  }
}
