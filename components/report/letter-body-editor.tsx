"use client"

import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import type { LetterBodyDoc } from "@/lib/reports/letter-body-types"
import { cn } from "@/lib/utils"

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
    extensions: [StarterKit],
    content: value ?? { type: "doc", content: [{ type: "paragraph" }] },
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none text-sm leading-relaxed focus:outline-none",
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

  return (
    <div className={cn("space-y-2", className)}>
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
        </div>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  )
}
