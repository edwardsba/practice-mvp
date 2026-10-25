import { BackgroundQuestionnaireForm } from "@/app/q/[token]/background-questionnaire-form"
import { InvalidLink } from "@/app/q/[token]/invalid-link"
import { QuestionnaireForm } from "@/app/q/[token]/questionnaire-form"
import { loadBatteryNavContext } from "@/lib/assessments/battery-nav"
import {
  loadAssessmentCodeForToken,
  loadQuestionnaireForToken,
  recordQuestionnaireOpened,
} from "@/lib/assessments/load-questionnaire"
import { BACKGROUND_ASSESSMENT_CODE } from "@/lib/background-questionnaire/types"

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

  const codeLookup = await loadAssessmentCodeForToken(token, { allowSubmitted })
  if (!codeLookup.ok) {
    return <InvalidLink />
  }

  if (codeLookup.assessmentCode === BACKGROUND_ASSESSMENT_CODE) {
    const recorded = await recordQuestionnaireOpened(token, { allowSubmitted })
    if (!recorded) {
      return <InvalidLink />
    }
    return <BackgroundQuestionnaireForm token={token} />
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
