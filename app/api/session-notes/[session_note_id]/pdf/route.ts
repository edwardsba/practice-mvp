import { NextResponse } from "next/server"

import { requirePractitionerContext } from "@/lib/auth"
import { buildSessionNotePdfData } from "@/lib/session-notes/build-pdf-data"
import { loadSessionNoteViewContext } from "@/lib/session-notes/load-context"
import { loadSessionNoteForPractice } from "@/lib/session-notes/load"
import { uploadSessionNotePdf } from "@/lib/session-notes/upload-pdf"
import { createAdminClient } from "@/lib/supabase/admin"

const BUCKET = "session-note-pdfs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ session_note_id: string }> }
) {
  const { session_note_id: sessionNoteId } = await params
  const context = await requirePractitionerContext()

  const note = await loadSessionNoteForPractice(sessionNoteId, context.practiceId)
  if (!note) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (note.status !== "finalised") {
    return NextResponse.json(
      { error: "This session note has not been finalised yet." },
      { status: 400 }
    )
  }

  const filename = `${note.sessionDate}_Confidential_Session_Note_${note.clientLastName}_${note.clientFirstName?.[0] ?? ""}.pdf`

  const supabase = createAdminClient()
  let pdfBuffer: Buffer

  async function regenerateAndUpload(): Promise<Buffer> {
    const viewContext = await loadSessionNoteViewContext(note)
    const pdfData = await buildSessionNotePdfData(note, viewContext)
    const result = await uploadSessionNotePdf(sessionNoteId, context.practiceId, pdfData)
    if (!result.ok) {
      throw new Error(result.error)
    }
    const { data } = await supabase.storage.from(BUCKET).download(result.path)
    if (!data) {
      throw new Error("PDF generation failed")
    }
    return Buffer.from(await data.arrayBuffer())
  }

  try {
    if (note.pdfStoragePath) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .download(note.pdfStoragePath)

      pdfBuffer =
        !error && data
          ? Buffer.from(await data.arrayBuffer())
          : await regenerateAndUpload()
    } else {
      pdfBuffer = await regenerateAndUpload()
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PDF generation failed" },
      { status: 500 }
    )
  }

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
