import { Button } from "@/components/ui/button"

export function SessionNotePdfDownloadLink({
  sessionNoteId,
}: {
  sessionNoteId: string
}) {
  return (
    <Button variant="link" size="sm" className="h-auto p-0 text-sm" asChild>
      <a href={`/api/session-notes/${sessionNoteId}/pdf`} download>
        Download
      </a>
    </Button>
  )
}
