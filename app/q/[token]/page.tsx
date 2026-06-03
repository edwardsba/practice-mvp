import { InvalidLink } from "@/app/q/[token]/invalid-link"
import { QuestionnaireForm } from "@/app/q/[token]/questionnaire-form"
import { loadQuestionnaireForToken } from "@/lib/assessments/load-questionnaire"

export default async function AssessmentQuestionnairePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ battery?: string }>
}) {
  const { token } = await params
  const { battery: batteryNextToken } = await searchParams

  if (!token?.trim()) {
    return <InvalidLink />
  }

  const result = await loadQuestionnaireForToken(token)

  if (!result.ok) {
    return <InvalidLink />
  }

  return (
    <QuestionnaireForm
      token={token}
      batteryNextToken={batteryNextToken?.trim() || undefined}
      {...result.data}
    />
  )
}
