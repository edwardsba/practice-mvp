import { and, eq, inArray, isNull } from "drizzle-orm"
import { NextResponse } from "next/server"

import {
  assessmentAccessLinks,
  assessmentDefinitions,
  assessmentElements,
  assessmentInstances,
  assessmentOptions,
  assessmentResponses,
  assessmentResults,
  auditEvents,
} from "@/db/schema"
import {
  buildNextQuestionnaireUrl,
  completeBatteryIfLastLink,
  markBatteryInProgress,
  validateBatteryNextToken,
} from "@/lib/assessments/battery-chain"
import { calculateAsrsPartAScore, calculateAsrsPartBRawScores } from "@/lib/assessments/asrs"
import { evaluateAndAppendTriggers } from "@/lib/assessments/evaluate-triggers"
import { calculateLevel1XcDomainScores } from "@/lib/assessments/level1xc"
import { calculatePcPtsd5Score } from "@/lib/assessments/pcptsd5"
import { calculatePsfScore, formatPsfSeverity } from "@/lib/assessments/psf"
import { severityFromAssessmentCode } from "@/lib/assessments/severity"
import { hashAssessmentToken } from "@/lib/assessments/token"
import { db } from "@/lib/db"

type SubmitBody = {
  token?: string
  responses?: Record<string, string>
  batteryNextToken?: string
}

function isLinkSubmittable(accessStatus: string, expiresAt: Date) {
  return accessStatus === "active" && expiresAt.getTime() > Date.now()
}

export async function POST(request: Request) {
  let body: SubmitBody
  try {
    body = (await request.json()) as SubmitBody
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const rawToken = body.token?.trim()
  const responses = body.responses
  const batteryNextToken = body.batteryNextToken?.trim()

  if (!rawToken || !responses || typeof responses !== "object") {
    return NextResponse.json(
      { error: "token and responses are required." },
      { status: 400 }
    )
  }

  const tokenHash = hashAssessmentToken(rawToken)

  const [accessLink] = await db
    .select()
    .from(assessmentAccessLinks)
    .where(eq(assessmentAccessLinks.tokenHash, tokenHash))
    .limit(1)

  if (!accessLink) {
    return NextResponse.json(
      { error: "This link is no longer valid." },
      { status: 400 }
    )
  }

  const isResubmit = accessLink.accessStatus === "submitted"

  if (isResubmit) {
    if (accessLink.expiresAt.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "This link is no longer valid." },
        { status: 400 }
      )
    }
  } else if (!isLinkSubmittable(accessLink.accessStatus, accessLink.expiresAt)) {
    return NextResponse.json(
      { error: "This link is no longer valid." },
      { status: 400 }
    )
  }

  const [instance] = await db
    .select({
      assessmentInstanceId: assessmentInstances.assessmentInstanceId,
      assessmentDefinitionId: assessmentInstances.assessmentDefinitionId,
      clientId: assessmentInstances.clientId,
      practiceId: assessmentInstances.practiceId,
      practitionerProfileId: assessmentInstances.practitionerProfileId,
    })
    .from(assessmentInstances)
    .where(
      eq(assessmentInstances.assessmentInstanceId, accessLink.assessmentInstanceId)
    )
    .limit(1)

  if (!instance) {
    return NextResponse.json(
      { error: "This link is no longer valid." },
      { status: 400 }
    )
  }

  const [definition] = await db
    .select({ assessmentCode: assessmentDefinitions.assessmentCode })
    .from(assessmentDefinitions)
    .where(
      eq(assessmentDefinitions.assessmentDefinitionId, instance.assessmentDefinitionId)
    )
    .limit(1)

  if (!definition) {
    return NextResponse.json(
      { error: "This link is no longer valid." },
      { status: 400 }
    )
  }

  const isBtp = definition.assessmentCode === "BTP"
  const isPsf = definition.assessmentCode === "PSF"
  const isLevel1Xc = definition.assessmentCode === "LEVEL1_XC"
  const isPcPtsd5 = definition.assessmentCode === "PC_PTSD5"
  const isAsrsPartA = definition.assessmentCode === "ASRS_PART_A"
  const isAsrsPartB = definition.assessmentCode === "ASRS_PART_B"

  const elementIds = Object.keys(responses)
  if (elementIds.length === 0) {
    return NextResponse.json(
      { error: "Please answer all questions before submitting." },
      { status: 400 }
    )
  }

  const activeElements = await db
    .select({
      assessmentElementId: assessmentElements.assessmentElementId,
      elementKey: assessmentElements.elementKey,
      domainCode: assessmentElements.domainCode,
      dataType: assessmentElements.dataType,
    })
    .from(assessmentElements)
    .where(
      isBtp
        ? and(
            eq(
              assessmentElements.assessmentInstanceId,
              instance.assessmentInstanceId
            ),
            eq(assessmentElements.isActive, true)
          )
        : and(
            eq(
              assessmentElements.assessmentDefinitionId,
              instance.assessmentDefinitionId
            ),
            eq(assessmentElements.isActive, true),
            isNull(assessmentElements.assessmentInstanceId)
          )
    )

  const dataTypeByElementId = new Map(
    activeElements.map((row) => [row.assessmentElementId, row.dataType])
  )
  const elementMetaById = new Map(
    activeElements.map((row) => [
      row.assessmentElementId,
      { elementKey: row.elementKey, domainCode: row.domainCode },
    ])
  )
  const requiredElementIds = new Set(
    activeElements.map((row) => row.assessmentElementId)
  )

  const optionRows = await db
    .select({
      assessmentElementId: assessmentOptions.assessmentElementId,
      optionValue: assessmentOptions.optionValue,
      scoreValue: assessmentOptions.scoreValue,
    })
    .from(assessmentOptions)
    .where(
      and(
        eq(assessmentOptions.assessmentDefinitionId, instance.assessmentDefinitionId),
        inArray(assessmentOptions.assessmentElementId, elementIds)
      )
    )

  const scoreByElementAndValue = new Map<string, number>()
  for (const row of optionRows) {
    scoreByElementAndValue.set(
      `${row.assessmentElementId}:${row.optionValue}`,
      row.scoreValue
    )
  }

  const responseRows: {
    assessmentElementId: string
    responseValue: string
    scoreValue: number
  }[] = []

  let totalScore = 0
  const psfResponseScores: number[] = []

  for (const elementId of elementIds) {
    const responseValue = String(responses[elementId] ?? "").trim()
    if (!responseValue) {
      return NextResponse.json(
        { error: "Please answer all questions before submitting." },
        { status: 400 }
      )
    }

    const scoreValue = scoreByElementAndValue.get(`${elementId}:${responseValue}`)
    if (scoreValue === undefined) {
      return NextResponse.json(
        { error: "One or more responses are invalid." },
        { status: 400 }
      )
    }

    responseRows.push({
      assessmentElementId: elementId,
      responseValue,
      scoreValue,
    })

    if (
      !isBtp &&
      !isPsf &&
      !isLevel1Xc &&
      !isPcPtsd5 &&
      !isAsrsPartA &&
      !isAsrsPartB &&
      dataTypeByElementId.get(elementId) === "integer"
    ) {
      totalScore += scoreValue
    }

    if (isPsf && dataTypeByElementId.get(elementId) === "integer") {
      psfResponseScores.push(scoreValue)
    }
  }

  if (
    responseRows.length !== requiredElementIds.size ||
    !responseRows.every((row) => requiredElementIds.has(row.assessmentElementId))
  ) {
    return NextResponse.json(
      { error: "Please answer all questions before submitting." },
      { status: 400 }
    )
  }

  if (batteryNextToken) {
    const batteryValid = await validateBatteryNextToken(
      accessLink.assessmentAccessLinkId,
      instance.clientId,
      instance.practiceId,
      batteryNextToken,
      { allowSubmittedNext: isResubmit }
    )
    if (!batteryValid) {
      return NextResponse.json(
        { error: "This questionnaire link is not valid." },
        { status: 400 }
      )
    }
  }

  let resultScore: number | null
  let severity: string | null
  let structuredScore: Record<string, unknown> | null = null

  const scoredResponses = responseRows.map((row) => {
    const meta = elementMetaById.get(row.assessmentElementId)
    return {
      elementKey: meta?.elementKey ?? "",
      domainCode: meta?.domainCode ?? null,
      scoreValue: row.scoreValue,
    }
  })

  if (isBtp) {
    resultScore = 0
    severity = null
  } else if (isPsf) {
    const psfResult = calculatePsfScore(psfResponseScores)
    resultScore = psfResult.netScore
    severity = formatPsfSeverity(psfResult)
  } else if (isLevel1Xc) {
    resultScore = null
    severity = null
    structuredScore = calculateLevel1XcDomainScores(scoredResponses)
  } else if (isPcPtsd5) {
    resultScore = calculatePcPtsd5Score(scoredResponses)
    severity = null
  } else if (isAsrsPartA) {
    resultScore = null
    severity = null
    structuredScore = calculateAsrsPartAScore(scoredResponses)
  } else if (isAsrsPartB) {
    resultScore = null
    severity = null
    structuredScore = calculateAsrsPartBRawScores(scoredResponses)
  } else {
    resultScore = totalScore
    severity = severityFromAssessmentCode(definition.assessmentCode, totalScore)
  }

  const now = new Date()

  try {
    await db.transaction(async (tx) => {
      if (isResubmit) {
        for (const row of responseRows) {
          const [existing] = await tx
            .select({
              assessmentResponseId: assessmentResponses.assessmentResponseId,
            })
            .from(assessmentResponses)
            .where(
              and(
                eq(
                  assessmentResponses.assessmentInstanceId,
                  instance.assessmentInstanceId
                ),
                eq(
                  assessmentResponses.assessmentElementId,
                  row.assessmentElementId
                )
              )
            )
            .limit(1)

          if (existing) {
            await tx
              .update(assessmentResponses)
              .set({
                responseValue: row.responseValue,
                scoreValue: row.scoreValue,
              })
              .where(
                eq(
                  assessmentResponses.assessmentResponseId,
                  existing.assessmentResponseId
                )
              )
          } else {
            await tx.insert(assessmentResponses).values({
              assessmentInstanceId: instance.assessmentInstanceId,
              assessmentElementId: row.assessmentElementId,
              clientId: instance.clientId,
              practiceId: instance.practiceId,
              responseValue: row.responseValue,
              scoreValue: row.scoreValue,
            })
          }
        }

        await tx
          .update(assessmentResults)
          .set({
            score: resultScore,
            severity,
            structuredScoreJson: structuredScore,
            assessmentDate: now,
          })
          .where(
            eq(
              assessmentResults.assessmentInstanceId,
              instance.assessmentInstanceId
            )
          )

        await tx
          .update(assessmentInstances)
          .set({
            updatedAt: now,
          })
          .where(
            eq(
              assessmentInstances.assessmentInstanceId,
              instance.assessmentInstanceId
            )
          )
      } else {
        await tx.insert(assessmentResponses).values(
          responseRows.map((row) => ({
            assessmentInstanceId: instance.assessmentInstanceId,
            assessmentElementId: row.assessmentElementId,
            clientId: instance.clientId,
            practiceId: instance.practiceId,
            responseValue: row.responseValue,
            scoreValue: row.scoreValue,
          }))
        )

        await tx
          .update(assessmentInstances)
          .set({
            status: "submitted",
            submittedAt: now,
            updatedAt: now,
          })
          .where(
            eq(
              assessmentInstances.assessmentInstanceId,
              instance.assessmentInstanceId
            )
          )

        await tx
          .update(assessmentAccessLinks)
          .set({
            accessStatus: "submitted",
            submittedAt: now,
            updatedAt: now,
          })
          .where(
            eq(
              assessmentAccessLinks.assessmentAccessLinkId,
              accessLink.assessmentAccessLinkId
            )
          )

        const [result] = await tx
          .insert(assessmentResults)
          .values({
            assessmentInstanceId: instance.assessmentInstanceId,
            clientId: instance.clientId,
            practiceId: instance.practiceId,
            score: resultScore,
            severity,
            structuredScoreJson: structuredScore,
            assessmentDate: now,
          })
          .returning({ assessmentResultId: assessmentResults.assessmentResultId })

        await tx.insert(auditEvents).values({
          practiceId: instance.practiceId,
          clientId: instance.clientId,
          eventType: "assessment.submitted",
          entityType: "assessment_instance",
          entityId: instance.assessmentInstanceId,
        })

        await tx.insert(auditEvents).values({
          practiceId: instance.practiceId,
          clientId: instance.clientId,
          eventType: "assessment_result.scored",
          entityType: "assessment_result",
          entityId: result.assessmentResultId,
        })
      }
    })

    if (!isResubmit) {
      // Diagnostic battery trigger evaluation: may reactively create a new module (e.g. ASRS
      // Part B) and set nextAccessLinkId/nextRawToken on this access link — which is why
      // buildNextQuestionnaireUrl below is checked unconditionally, not just when the client
      // already knew about a next link at page-load time (batteryNextToken).
      await evaluateAndAppendTriggers({
        assessmentInstanceId: instance.assessmentInstanceId,
        assessmentCode: definition.assessmentCode,
        score: resultScore,
        structuredScore,
        clientId: instance.clientId,
        practiceId: instance.practiceId,
        practitionerProfileId: instance.practitionerProfileId,
      })

      if (batteryNextToken) {
        await markBatteryInProgress(accessLink.assessmentAccessLinkId)
      }
    }

    const nextUrl = await buildNextQuestionnaireUrl(accessLink.assessmentAccessLinkId)

    if (nextUrl) {
      return NextResponse.json({
        success: true,
        nextUrl,
      })
    }

    const batteryComplete = await completeBatteryIfLastLink(
      accessLink.assessmentAccessLinkId,
      instance.clientId,
      instance.practiceId
    )

    if (batteryComplete) {
      return NextResponse.json({ success: true, batteryComplete: true })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: "Unable to submit your responses. Please try again." },
      { status: 500 }
    )
  }
}
