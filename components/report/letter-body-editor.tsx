"use client"

import Heading from "@tiptap/extension-heading"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import type { LetterBodyDoc } from "@/lib/reports/letter-body-types"
import { cn } from "@/lib/utils"

const NumberedHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      numbered: {
        default: false,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-numbered") === "true",
        renderHTML: (attributes: { numbered?: boolean }) => {
          if (!attributes.numbered) return {}
          return { "data-numbered": "true" }
        },
      },
    }
  },
})

const NUMBERED_PARAGRAPH_STYLES = `
.report-letter-body { counter-reset: report-section report-item; }
.report-letter-body h2[data-numbered="true"] {
  counter-increment: report-section;
  counter-set: report-item 0;
}
.report-letter-body h2[data-numbered="true"]::before {
  content: counter(report-section) ". ";
}
.report-letter-body ol {
  list-style: none;
  margin: 0.5rem 0;
  padding: 0;
}
.report-letter-body ol > li {
  position: relative;
  margin: 0.35rem 0;
  padding-left: 2.75rem;
  counter-increment: report-item;
}
.report-letter-body ol > li::before {
  content: counter(report-section) "." counter(report-item) ".";
  position: absolute;
  left: 0;
  width: 2.5rem;
  font-weight: 600;
}
`

export function LetterBodyEditor({
  value,
  onChange,
  editable = true,
  className,
}: {
  value: LetterBodyDoc | null
  onChange?: (value: LetterBodyDoc) => void
  editable?: boolean
  className?: string
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      NumberedHeading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
    ],
    content: value ?? { type: "doc", content: [{ type: "paragraph" }] },
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "report-letter-body prose prose-sm max-w-none text-sm leading-relaxed focus:outline-none",
          "[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2",
          "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
        ),
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange?.(currentEditor.getJSON() as LetterBodyDoc)
    },
  })

  useEffect(() => {
    if (!editor || !value) return
    const current = JSON.stringify(editor.getJSON())
    const next = JSON.stringify(value)
    if (current !== next) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [editor, value])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(editable)
  }, [editor, editable])

  if (!editor) {
    return null
  }

  const headingNumbered = Boolean(editor.getAttributes("heading").numbered)

  function toggleNumberedParagraphs() {
    if (editor?.isActive("heading", { level: 2 })) {
      editor.chain().focus().updateAttributes("heading", { numbered: !headingNumbered }).run()
      return
    }
    editor?.chain().focus().toggleOrderedList().run()
  }

  return (
    <div className={cn("space-y-2", className)}>
      <style>{NUMBERED_PARAGRAPH_STYLES}</style>
      {editable ? (
        <div className="no-print flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={editor.isActive("bold") ? "default" : "outline"}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            Bold
          </Button>
          <Button
            type="button"
            size="sm"
            variant={
              editor.isActive("heading", { level: 2 }) ? "default" : "outline"
            }
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            Heading
          </Button>
          <Button
            type="button"
            size="sm"
            variant={editor.isActive("bulletList") ? "default" : "outline"}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            Bullet list
          </Button>
          <Button
            type="button"
            size="sm"
            variant={
              editor.isActive("orderedList") || (editor.isActive("heading", { level: 2 }) && headingNumbered)
                ? "default"
                : "outline"
            }
            onClick={toggleNumberedParagraphs}
          >
            Numbered paragraphs
          </Button>
        </div>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  )
}
