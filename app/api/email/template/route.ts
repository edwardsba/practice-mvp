import { NextResponse } from "next/server"

import { getPractitionerContext } from "@/lib/auth"
import { getEmailTemplateByKey } from "@/lib/email/template-loader"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get("key")
  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 })
  }

  const context = await getPractitionerContext()
  if (!context) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const template = await getEmailTemplateByKey(context.practiceId, key)

  if (!template) {
    return NextResponse.json({})
  }

  return NextResponse.json({
    subject: template.subject,
    message: template.message,
  })
}
