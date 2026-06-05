import { InvalidLink } from "@/app/q/[token]/invalid-link"
import { QuestionnaireForm } from "@/app/q/[token]/questionnaire-form"
import { loadBatteryNavContext } from "@/lib/assessments/battery-nav"
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

  const trimmedBattery = batteryNextToken?.trim() || undefined
  const batteryNav = await loadBatteryNavContext(token, trimmedBattery)
  const allowSubmitted = batteryNav.isBatteryStep

  const result = await loadQuestionnaireForToken(token, {
    allowSubmitted,
  })

  if (!result.ok) {
    return <InvalidLink />
  }

  return (
    <QuestionnaireForm
      token={token}
      batteryNextToken={trimmedBattery}
      batteryNav={batteryNav}
      {...result.data}
    />
  )
}
