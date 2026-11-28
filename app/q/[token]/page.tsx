import { ClientAssessmentForm } from "@/app/q/[token]/client-assessment-form"
import { InvalidLink } from "@/app/q/[token]/invalid-link"
import { QuestionnaireForm } from "@/app/q/[token]/questionnaire-form"
import { loadBatteryNavContext } from "@/lib/assessments/battery-nav"
import {
  assessmentUsesSharedClientForm,
  loadClientFormForToken,
} from "@/lib/assessments/load-client-form"
import {
  loadAssessmentCodeForToken,
  loadQuestionnaireForToken,
} from "@/lib/assessments/load-questionnaire"

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

  const codeResult = await loadAssessmentCodeForToken(token, {
    allowSubmitted,
  })
  if (!codeResult.ok) {
    return <InvalidLink />
  }

  if (await assessmentUsesSharedClientForm(codeResult.assessmentCode)) {
    const shared = await loadClientFormForToken(token, { allowSubmitted })
    if (!shared.ok) {
      return <InvalidLink />
    }
    return <ClientAssessmentForm token={token} {...shared.data} />
  }

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
