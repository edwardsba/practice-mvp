import { redirect } from "next/navigation"

export default async function IntakeInterviewRedirect({
  params,
}: {
  params: Promise<{ client_id: string }>
}) {
  const { client_id: clientId } = await params
  redirect(`/clients/${clientId}/background`)
}
