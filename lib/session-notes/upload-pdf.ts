import { and, eq } from "drizzle-orm"

import { sessionNotes } from "@/db/schema"
import { db } from "@/lib/db"
import {
  generateSessionNotePdf,
  type SessionNotePdfData,
} from "@/lib/session-notes/generate-pdf"
import { createAdminClient } from "@/lib/supabase/admin"

const BUCKET = "session-note-pdfs"

export function buildSessionNotePdfPath(
  clientId: string,
  sessionDate: string,
  sessionNoteId: string
): string {
  return `${clientId}/${sessionDate}_${sessionNoteId}.pdf`
}

export type UploadSessionNotePdfResult =
  | { ok: true; path: string }
  | { ok: false; error: string }

export async function uploadSessionNotePdf(
  sessionNoteId: string,
  practiceId: string,
  data: SessionNotePdfData
): Promise<UploadSessionNotePdfResult> {
  try {
    const buffer = await generateSessionNotePdf(data)
    const path = buildSessionNotePdfPath(
      data.clientId,
      data.sessionDate,
      sessionNoteId
    )

    const supabase = createAdminClient()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: "application/pdf",
        upsert: true,
      })

    if (uploadError) {
      return { ok: false, error: uploadError.message }
    }

    await db
      .update(sessionNotes)
      .set({ pdfStoragePath: path, updatedAt: new Date() })
      .where(
        and(
          eq(sessionNotes.sessionNoteId, sessionNoteId),
          eq(sessionNotes.practiceId, practiceId)
        )
      )

    return { ok: true, path }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}
