import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { practitionerProfiles } from "@/db/schema"
import { getPractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { getSignatureAsDataUrl } from "@/lib/practitioner/signature"
import { createAdminClient } from "@/lib/supabase/admin"

const BUCKET = "signature-images"

export async function GET() {
  const context = await getPractitionerContext()
  if (!context) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const [profile] = await db
    .select({ signatureImagePath: practitionerProfiles.signatureImagePath })
    .from(practitionerProfiles)
    .where(
      eq(
        practitionerProfiles.practitionerProfileId,
        context.practitionerProfileId
      )
    )
    .limit(1)

  if (!profile?.signatureImagePath) {
    return NextResponse.json({ dataUrl: null })
  }

  const dataUrl = await getSignatureAsDataUrl(profile.signatureImagePath)
  return NextResponse.json({ dataUrl })
}

export async function POST(request: Request) {
  const context = await getPractitionerContext()
  if (!context) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get("file") as File | null

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    return NextResponse.json(
      { error: "File must be PNG, JPEG, or WebP" },
      { status: 400 }
    )
  }

  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File must be under 2MB" },
      { status: 400 }
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg"
  const path = `${context.practitionerProfileId}/signature.${ext}`

  const supabase = createAdminClient()
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  await db
    .update(practitionerProfiles)
    .set({ signatureImagePath: path, updatedAt: new Date() })
    .where(
      eq(
        practitionerProfiles.practitionerProfileId,
        context.practitionerProfileId
      )
    )

  return NextResponse.json({ ok: true, path })
}
