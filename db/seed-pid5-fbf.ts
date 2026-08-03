import { config } from "dotenv"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import {
  assessmentDefinitions,
  assessmentElements,
  assessmentOptions,
} from "./schema"

config({ path: ".env.local" })

// PID-5-FBF (Faceted Brief Form) — 100 items, 25 facets (4 items each). Verbatim APA item
// text, cannot be reworded without written APA permission. groupLabel carries the facet name
// for reference/display; the actual facet/domain scoring groupings are hardcoded by elementKey
// in lib/assessments/pid5-fbf.ts (same convention as DASS-21's subscale scoring), not read
// from this column at scoring time. Items are seeded in original administration order (1-100),
// not grouped by facet — that's how the instrument is presented to clients.
//
// This is now a universal Tier 1 instrument (administered to every client, every
// administration) rather than a Tier 2-triggered extension of PID-5-BF — PID-5-BF itself was
// never built and is not part of this build. See TIER_1_BASELINE_CODES in
// lib/assessments/create-diagnostic-battery-instance.ts.
const PID5_FBF_QUESTIONS = [
  { text: "Plenty of people are out to get me.", facet: "Suspiciousness" }, // Q1
  { text: "I feel like I act totally on impulse.", facet: "Impulsivity" }, // Q2
  { text: "I change what I do depending on what others want.", facet: "Submissiveness" }, // Q3
  { text: "I usually do what others think I should do.", facet: "Submissiveness" }, // Q4
  { text: "I usually do things on impulse without thinking about what might happen as a result.", facet: "Impulsivity" }, // Q5
  { text: "Even though I know better, I can't stop making rash decisions.", facet: "Impulsivity" }, // Q6
  { text: "I really don't care if I make other people suffer.", facet: "Callousness" }, // Q7
  { text: "I always do things on the spur of the moment.", facet: "Impulsivity" }, // Q8
  { text: "Nothing seems to interest me very much.", facet: "Anhedonia" }, // Q9
  { text: "People have told me that I think about things in a really strange way.", facet: "Eccentricity" }, // Q10
  { text: "I almost never enjoy life.", facet: "Anhedonia" }, // Q11
  { text: "I am easily angered.", facet: "Hostility" }, // Q12
  { text: "I have no limits when it comes to doing dangerous things.", facet: "Risk Taking" }, // Q13
  { text: "To be honest, I'm just more important than other people.", facet: "Grandiosity" }, // Q14
  { text: "It's weird, but sometimes ordinary objects seem to be a different shape than usual.", facet: "Perceptual Dysregulation" }, // Q15
  { text: "I do a lot of things that others consider risky.", facet: "Risk Taking" }, // Q16
  { text: "I worry a lot about being alone.", facet: "Separation Insecurity" }, // Q17
  { text: "I often make up things about myself to help me get what I want.", facet: "Deceitfulness" }, // Q18
  { text: "I keep approaching things the same way, even when it isn't working.", facet: "Perseveration" }, // Q19
  { text: "I do what other people tell me to do.", facet: "Submissiveness" }, // Q20
  { text: "I like to take risks.", facet: "Risk Taking" }, // Q21
  { text: "Others seem to think I'm quite odd or unusual.", facet: "Eccentricity" }, // Q22
  { text: "I love getting the attention of other people.", facet: "Attention Seeking" }, // Q23
  { text: "I worry a lot about terrible things that might happen.", facet: "Anxiousness" }, // Q24
  { text: "I have trouble changing how I'm doing something even if what I'm doing isn't going well.", facet: "Perseveration" }, // Q25
  { text: "The world would be better off if I were dead.", facet: "Depressivity" }, // Q26
  { text: "I keep my distance from people.", facet: "Withdrawal" }, // Q27
  { text: "I don't get emotional.", facet: "Restricted Affectivity" }, // Q28
  { text: "I prefer to keep romance out of my life.", facet: "Intimacy Avoidance" }, // Q29
  { text: "I don't show emotions strongly.", facet: "Restricted Affectivity" }, // Q30
  { text: "I have a very short temper.", facet: "Hostility" }, // Q31
  { text: "I get fixated on certain things and can't stop.", facet: "Perseveration" }, // Q32
  { text: "If something I do isn't absolutely perfect, it's simply not acceptable.", facet: "Rigid Perfectionism" }, // Q33
  { text: "I often have unusual experiences, such as sensing the presence of someone who isn't actually there.", facet: "Unusual Beliefs and Experiences" }, // Q34
  { text: "I'm good at making people do what I want them to do.", facet: "Manipulativeness" }, // Q35
  { text: "I'm always worrying about something.", facet: "Anxiousness" }, // Q36
  { text: "I'm better than almost everyone else.", facet: "Grandiosity" }, // Q37
  { text: "I'm always on my guard for someone trying to trick or harm me.", facet: "Suspiciousness" }, // Q38
  { text: "I have trouble keeping my mind focused on what needs to be done.", facet: "Distractibility" }, // Q39
  { text: "I'm just not very interested in having sexual relationships.", facet: "Intimacy Avoidance" }, // Q40
  { text: "I get emotional easily, often for very little reason.", facet: "Emotional Lability" }, // Q41
  { text: "Even though it drives other people crazy, I insist on absolute perfection in everything I do.", facet: "Rigid Perfectionism" }, // Q42
  { text: "I almost never feel happy about my day-to-day activities.", facet: "Anhedonia" }, // Q43
  { text: "Sweet-talking others helps me get what I want.", facet: "Manipulativeness" }, // Q44
  { text: "I fear being alone in life more than anything else.", facet: "Separation Insecurity" }, // Q45
  { text: "I get stuck on one way of doing things, even when it's clear it won't work.", facet: "Perseveration" }, // Q46
  { text: "I'm often pretty careless with my own and others' things.", facet: "Irresponsibility" }, // Q47
  { text: "I am a very anxious person.", facet: "Anxiousness" }, // Q48
  { text: "I am easily distracted.", facet: "Distractibility" }, // Q49
  { text: "It seems like I'm always getting a \"raw deal\" from others.", facet: "Suspiciousness" }, // Q50
  { text: "I don't hesitate to cheat if it gets me ahead.", facet: "Deceitfulness" }, // Q51
  { text: "I don't like spending time with others.", facet: "Withdrawal" }, // Q52
  { text: "I never know where my emotions will go from moment to moment.", facet: "Emotional Lability" }, // Q53
  { text: "I have seen things that weren't really there.", facet: "Unusual Beliefs and Experiences" }, // Q54
  { text: "I can't focus on things for very long.", facet: "Distractibility" }, // Q55
  { text: "I steer clear of romantic relationships.", facet: "Intimacy Avoidance" }, // Q56
  { text: "I'm not interested in making friends.", facet: "Withdrawal" }, // Q57
  { text: "I'll do just about anything to keep someone from abandoning me.", facet: "Separation Insecurity" }, // Q58
  { text: "Sometimes I can influence other people just by sending my thoughts to them.", facet: "Unusual Beliefs and Experiences" }, // Q59
  { text: "Life looks pretty bleak to me.", facet: "Depressivity" }, // Q60
  { text: "I think about things in odd ways that don't make sense to most people.", facet: "Eccentricity" }, // Q61
  { text: "I don't care if my actions hurt others.", facet: "Callousness" }, // Q62
  { text: "Sometimes I feel \"controlled\" by thoughts that belong to someone else.", facet: "Perceptual Dysregulation" }, // Q63
  { text: "I make promises that I don't really intend to keep.", facet: "Irresponsibility" }, // Q64
  { text: "Nothing seems to make me feel good.", facet: "Anhedonia" }, // Q65
  { text: "I get irritated easily by all sorts of things.", facet: "Hostility" }, // Q66
  { text: "I do what I want regardless of how unsafe it might be.", facet: "Risk Taking" }, // Q67
  { text: "I often forget to pay my bills.", facet: "Irresponsibility" }, // Q68
  { text: "I'm good at conning people.", facet: "Manipulativeness" }, // Q69
  { text: "Everything seems pointless to me.", facet: "Depressivity" }, // Q70
  { text: "I get emotional over every little thing.", facet: "Emotional Lability" }, // Q71
  { text: "It's no big deal if I hurt other peoples' feelings.", facet: "Callousness" }, // Q72
  { text: "I never show emotions to others.", facet: "Restricted Affectivity" }, // Q73
  { text: "I have no worth as a person.", facet: "Depressivity" }, // Q74
  { text: "I am usually pretty hostile.", facet: "Hostility" }, // Q75
  { text: "I've skipped town to avoid responsibilities.", facet: "Irresponsibility" }, // Q76
  { text: "I like being a person who gets noticed.", facet: "Attention Seeking" }, // Q77
  { text: "I'm always fearful or on edge about bad things that might happen.", facet: "Anxiousness" }, // Q78
  { text: "I never want to be alone.", facet: "Separation Insecurity" }, // Q79
  { text: "I keep trying to make things perfect, even when I've gotten them as good as they're likely to get.", facet: "Rigid Perfectionism" }, // Q80
  { text: "My emotions are unpredictable.", facet: "Emotional Lability" }, // Q81
  { text: "I don't care about other peoples' problems.", facet: "Callousness" }, // Q82
  { text: "I don't react much to things that seem to make others emotional.", facet: "Restricted Affectivity" }, // Q83
  { text: "I avoid social events.", facet: "Withdrawal" }, // Q84
  { text: "I deserve special treatment.", facet: "Grandiosity" }, // Q85
  { text: "I suspect that even my so-called \"friends\" betray me a lot.", facet: "Suspiciousness" }, // Q86
  { text: "I crave attention.", facet: "Attention Seeking" }, // Q87
  { text: "Sometimes I think someone else is removing thoughts from my head.", facet: "Perceptual Dysregulation" }, // Q88
  { text: "I simply won't put up with things being out of their proper places.", facet: "Rigid Perfectionism" }, // Q89
  { text: "I often have to deal with people who are less important than me.", facet: "Grandiosity" }, // Q90
  { text: "I get pulled off-task by even minor distractions.", facet: "Distractibility" }, // Q91
  { text: "I try to do what others want me to do.", facet: "Submissiveness" }, // Q92
  { text: "I prefer being alone to having a close romantic partner.", facet: "Intimacy Avoidance" }, // Q93
  { text: "I often have thoughts that make sense to me but that other people say are strange.", facet: "Eccentricity" }, // Q94
  { text: "I use people to get what I want.", facet: "Deceitfulness" }, // Q95
  { text: "I've had some really weird experiences that are very difficult to explain.", facet: "Unusual Beliefs and Experiences" }, // Q96
  { text: "I like to draw attention to myself.", facet: "Attention Seeking" }, // Q97
  { text: "Things around me often feel unreal, or more real than usual.", facet: "Perceptual Dysregulation" }, // Q98
  { text: "I'll stretch the truth if it's to my advantage.", facet: "Deceitfulness" }, // Q99
  { text: "It is easy for me to take advantage of others.", facet: "Manipulativeness" }, // Q100
] as const

const PID5_FBF_RESPONSE_OPTIONS = [
  { label: "Very False or Often False", value: "0", score: 0, order: 1 },
  { label: "Sometimes or Somewhat False", value: "1", score: 1, order: 2 },
  { label: "Sometimes or Somewhat True", value: "2", score: 2, order: 3 },
  { label: "Very True or Often True", value: "3", score: 3, order: 4 },
] as const

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local")
  }

  const pool = new Pool({ connectionString })
  const db = drizzle(pool)

  const [existing] = await db
    .select({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })
    .from(assessmentDefinitions)
    .where(eq(assessmentDefinitions.assessmentCode, "PID5_FBF"))
    .limit(1)

  if (existing) {
    console.log("PID-5-FBF assessment already seeded — skipping.")
    await pool.end()
    return
  }

  const [definition] = await db
    .insert(assessmentDefinitions)
    .values({
      assessmentCode: "PID5_FBF",
      assessmentName: "Personality Inventory for DSM-5 - Faceted Brief Form (PID-5-FBF)",
      assessmentType: "psychometric_assessment",
      scoringEnabled: true,
      clientCompletable: true,
      practitionerCompletable: true,
      isActive: true,
    })
    .returning({ assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId })

  for (let i = 0; i < PID5_FBF_QUESTIONS.length; i++) {
    const question = PID5_FBF_QUESTIONS[i]
    const [element] = await db
      .insert(assessmentElements)
      .values({
        assessmentDefinitionId: definition.assessmentDefinitionId,
        elementKey: `pid5_fbf_q${i + 1}`,
        questionText: question.text,
        elementType: "radio",
        dataType: "integer",
        displayOrder: i + 1,
        isRequired: true,
        isActive: true,
        groupLabel: question.facet,
      })
      .returning({ assessmentElementId: assessmentElements.assessmentElementId })

    await db.insert(assessmentOptions).values(
      PID5_FBF_RESPONSE_OPTIONS.map((option) => ({
        assessmentElementId: element.assessmentElementId,
        assessmentDefinitionId: definition.assessmentDefinitionId,
        optionLabel: option.label,
        optionValue: option.value,
        scoreValue: option.score,
        displayOrder: option.order,
      }))
    )
  }

  console.log("PID-5-FBF assessment seeded successfully (100 items across 25 facets).")
  await pool.end()
}

main().catch((error) => {
  console.error("PID-5-FBF seed failed:", error)
  process.exit(1)
})
