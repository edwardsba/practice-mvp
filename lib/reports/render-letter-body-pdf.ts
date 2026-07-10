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

export function renderLetterBodyPdf(
  doc: PDFKit.PDFDocument,
  letterBody: LetterBodyDoc,
  helpers: PdfTextHelpers
) {
  for (const node of letterBody.content) {
    if (node.type === "heading") {
      helpers.groupHeading(doc, nodeText(node))
      continue
    }

    if (node.type === "paragraph") {
      const text = nodeText(node)
      if (text) {
        helpers.bodyText(doc, text)
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
    }
  }
}
