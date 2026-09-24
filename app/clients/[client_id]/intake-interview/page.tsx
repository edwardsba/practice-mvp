import { redirect } from "next/navigation"

import { requirePractitionerContext } from "@/lib/auth"
import {
  loadCurrentIntakeInterview,
  verifyClientInPractice,
} from "@/lib/intake-interview/load"

export default async function IntakeInterviewIndexPage({
  params,
}: {
  params: Promise<{ client_id: string }>
}) {
  const { client_id: clientId } = await params
  const context = await requirePractitionerContext()
  const client = await verifyClientInPractice(clientId, context.practiceId)
  if (!client) {
    redirect("/clients")
  }

  const current = await loadCurrentIntakeInterview(clientId, context.practiceId)
  if (current) {
    redirect(`/clients/${clientId}/intake-interview/${current.intakeInterviewId}`)
  }

  redirect(`/clients/${clientId}/intake-interview/new`)
}
