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

function hangingLine(
  doc: PDFKit.PDFDocument,
  label: string,
  text: string,
  labelWidth: number,
  boldText: boolean
) {
  const left = doc.page.margins.left
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right
  doc.moveDown(0.35)
  const y = doc.y
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111")
  doc.text(label, left, y, { width: labelWidth, lineGap: 4 })
  const labelBottom = doc.y
  doc.font(boldText ? "Helvetica-Bold" : "Helvetica").fontSize(10).fillColor("#111111")
  doc.text(text, left + labelWidth, y, { width: width - labelWidth, lineGap: 4 })
  if (doc.y < labelBottom) doc.y = labelBottom
  doc.x = left
}

export function renderLetterBodyPdf(
  doc: PDFKit.PDFDocument,
  letterBody: LetterBodyDoc,
  helpers: PdfTextHelpers
) {
  let section = 0

  for (const node of letterBody.content) {
    if (node.type === "heading") {
      if (node.attrs?.numbered) {
        section += 1
        hangingLine(doc, `${section}.`, nodeText(node), 28, true)
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
      let item = 0
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
