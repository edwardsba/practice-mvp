export type LetterBodyMark = {
  type: string
  attrs?: Record<string, unknown>
}

export type LetterBodyNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: LetterBodyNode[]
  text?: string
  marks?: LetterBodyMark[]
}

export type LetterBodyDoc = {
  type: "doc"
  content: LetterBodyNode[]
}

export function isLetterBodyDoc(value: unknown): value is LetterBodyDoc {
  if (!value || typeof value !== "object") return false
  const doc = value as LetterBodyDoc
  return doc.type === "doc" && Array.isArray(doc.content)
}

export function parseLetterBodyJson(value: unknown): LetterBodyDoc | null {
  if (typeof value === "string") {
    try {
      return parseLetterBodyJson(JSON.parse(value))
    } catch {
      return null
    }
  }
  return isLetterBodyDoc(value) ? value : null
}
