import { NextResponse } from "next/server"

import { getPractitionerContext } from "@/lib/auth"
import { importSageSrReport } from "@/lib/sage-sr/import-sage-sr-report"

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024 // SAGE-SR Core Response runs ~16 pages; 20MB is a generous ceiling

export async function POST(request: Request) {
  const context = await getPractitionerContext()
  if (!context) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  const clientId = String(formData.get("client_id") ?? "").trim()

  if (!file) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 })
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "File must be a PDF." }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File is too large." }, { status: 400 })
  }
  if (!clientId) {
    return NextResponse.json({ error: "client_id is required." }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  const result = await importSageSrReport({
    buffer,
    clientId,
    practiceId: context.practiceId,
    practitionerProfileId: context.practitionerProfileId,
    userId: context.userId,
  })

  if (!result.ok) {
    const status = result.code === "client_not_found" ? 404 : result.code === "version_mismatch" ? 422 : 400
    return NextResponse.json({ error: result.error, code: result.code }, { status })
  }

  return NextResponse.json({
    ok: true,
    module: result.module,
    kind: result.kind,
    assessment_instance_id: result.assessmentInstanceId,
    merged_into_existing: result.mergedIntoExisting,
  })
}
