import assert from "node:assert/strict"

import { backgroundChecks, type BackgroundCheckInput } from "@/lib/client-background/checks"
import { entryDetailMessage } from "@/lib/client-background/history-links"
import { sanitizeReasonForAttending } from "@/lib/client-background/sanitize"
import {
  emptyClientRelationshipStatus,
  emptyDemographics,
  emptyEvent,
  emptyReasonForAttending,
  emptyRisk,
  emptyStressors,
  type ClientBackgroundData,
  type EventRecord,
  type RelationshipRecord,
} from "@/lib/client-background/types"

const REFERRER = "11111111-1111-4111-8111-111111111111"

function person(
  partial: Partial<RelationshipRecord> & Pick<RelationshipRecord, "relationshipRecordId" | "relationshipToClient">
): RelationshipRecord {
  return {
    sex: "",
    givenName: "",
    displayOrder: 0,
    dateOfBirth: "",
    approximateAge: null,
    approximateAgeRecordedOn: "",
    healthStatus: "",
    deceased: false,
    ageAtDeath: null,
    dateOfDeath: "",
    healthOrCauseOfDeath: "",
    childType:
      partial.relationshipToClient === "child_step"
        ? "step_child"
        : partial.relationshipToClient === "child_biological"
          ? "biological"
          : "",
    childTypeDetail: "",
    supportive: "",
    conflict: "",
    qualityOfRelationship: "",
    dependency: "",
    livingSituation: "",
    caregiverRelationship: "",
    caregiverRelationshipDetail: "",
    notKnown: false,
    ...partial,
  }
}

function event(partial: Partial<EventRecord> & Pick<EventRecord, "eventType">): EventRecord {
  return {
    ...emptyEvent(partial.eventType, 0),
    eventRecordId: "event-1",
    ...partial,
  }
}

function data(overrides: Partial<ClientBackgroundData> = {}): ClientBackgroundData {
  const demographics = emptyDemographics()
  return {
    dateOfBirth: "1990-01-01",
    backgroundCapturedAt: null,
    relationshipStatus: emptyClientRelationshipStatus(),
    stressors: emptyStressors(),
    reason: { ...emptyReasonForAttending(), referralType: "self" },
    relationships: [],
    events: [],
    risk: emptyRisk(),
    ...overrides,
    demographics: {
      identity: { ...demographics.identity, ...overrides.demographics?.identity },
      livingSituation: { ...demographics.livingSituation, ...overrides.demographics?.livingSituation },
      education: { ...demographics.education, ...overrides.demographics?.education },
      occupation: { ...demographics.occupation, ...overrides.demographics?.occupation },
    },
  }
}

function input(partial: Partial<BackgroundCheckInput> = {}): BackgroundCheckInput {
  return {
    data: partial.data ?? data(),
    numberOfChildren: partial.numberOfChildren ?? null,
    screening: partial.screening ?? null,
  }
}

function ids(partial: Partial<BackgroundCheckInput>) {
  return backgroundChecks(input(partial)).map((check) => check.id)
}

const cleared = sanitizeReasonForAttending({
  referredByMedicalProfessional: "yes",
  referrerProfessionalId: REFERRER,
  referralDate: "2026-10-03",
  referrerConcerns: "Sleep",
  familyInvolvement: "Drove them",
  clientMotivation: "Wants to sleep",
})
assert.equal(cleared.referralType, "")
assert.equal(cleared.referrerProfessionalId, null)
assert.equal(cleared.referralDate, "")
assert.equal(cleared.referrerConcerns, "")
assert.equal(cleared.theirConcerns, "")

const kept = sanitizeReasonForAttending({
  referralType: "medical",
  referrerProfessionalId: REFERRER,
  referralDate: "2026-10-03",
  referrerConcerns: "Sleep",
})
assert.equal(kept.referralType, "medical")
assert.equal(kept.referrerProfessionalId, REFERRER)
assert.equal(kept.referralDate, "2026-10-03")
assert.equal(kept.referrerConcerns, "Sleep")
assert.equal(sanitizeReasonForAttending({ referralType: "medical", referrerProfessionalId: "nope" }).referrerProfessionalId, null)

const missingReferral = backgroundChecks(input({ data: data({ reason: emptyReasonForAttending() }) }))
assert.deepEqual(
  missingReferral.map((check) => ({ id: check.id, message: check.message, target: check.target })),
  [{ id: "referral-type", message: "Referral type not recorded", target: "reason" }]
)

assert.deepEqual(backgroundChecks(input()), [])

const partnerMissing = backgroundChecks(
  input({
    data: data({ relationshipStatus: { relationshipStatus: "defacto", relationshipStatusOther: "" } }),
  })
)
assert.deepEqual(
  partnerMissing.map((check) => check.message),
  ["Relationship status is De facto, but no current partner is recorded."]
)
assert.equal(partnerMissing[0]?.target, "relationships")
assert.deepEqual(
  ids({
    data: data({
      relationshipStatus: { relationshipStatus: "defacto", relationshipStatusOther: "" },
      relationships: [person({ relationshipRecordId: "partner", relationshipToClient: "current_partner", givenName: "Sam" })],
    }),
  }),
  []
)

const partnerUnexpected = backgroundChecks(
  input({
    data: data({
      relationshipStatus: { relationshipStatus: "single", relationshipStatusOther: "" },
      relationships: [person({ relationshipRecordId: "partner", relationshipToClient: "current_partner", givenName: "Sam" })],
    }),
  })
)
assert.equal(partnerUnexpected[0]?.message, "Relationship status is Single, but a current partner is recorded.")
assert.equal(partnerUnexpected[0]?.id, "partner-unexpected")
assert.deepEqual(ids({ data: data({ relationshipStatus: { relationshipStatus: "single", relationshipStatusOther: "" } }) }), [])

const childrenMismatch = backgroundChecks(
  input({
    numberOfChildren: 2,
    data: data({
      relationships: [person({ relationshipRecordId: "child", relationshipToClient: "child_biological", givenName: "Ari" })],
    }),
  })
)
assert.equal(
  childrenMismatch.find((check) => check.id === "children-count")?.message,
  "Client reported 2 children; 1 recorded."
)
assert.equal(childrenMismatch.find((check) => check.id === "children-count")?.target, "relationships")
assert.deepEqual(
  ids({
    numberOfChildren: 2,
    data: data({
      relationships: [
        person({
          relationshipRecordId: "child-1",
          relationshipToClient: "child_biological",
          givenName: "Ari",
        }),
        person({
          relationshipRecordId: "child-2",
          relationshipToClient: "child_biological",
          givenName: "Bo",
        }),
      ],
    }),
  }),
  []
)
assert.deepEqual(
  ids({
    data: data({
      relationships: [
        person({
          relationshipRecordId: "child",
          relationshipToClient: "child_biological",
        }),
      ],
    }),
  }),
  []
)

const livesWith = backgroundChecks(
  input({
    data: data({
      demographics: {
        ...emptyDemographics(),
        livingSituation: { ...emptyDemographics().livingSituation, livesWith: "with_partner" },
      },
      relationships: [
        person({
          relationshipRecordId: "partner",
          relationshipToClient: "current_partner",
          livingSituation: "does_not_live_with_client",
        }),
      ],
    }),
  })
)
assert.equal(livesWith[0]?.message, "Lives with partner, but no one is marked as living with the client.")
assert.equal(livesWith[0]?.target, "living")
for (const [livesWithOption, message] of [
  ["with_partner_and_children", "Lives with partner and children, but no one is marked as living with the client."],
  ["with_children_sole_parent", "Lives with children (sole parent), but no one is marked as living with the client."],
  ["with_parents", "Lives with parents, but no one is marked as living with the client."],
] as const) {
  const found = backgroundChecks(
    input({
      data: data({
        demographics: {
          ...emptyDemographics(),
          livingSituation: { ...emptyDemographics().livingSituation, livesWith: livesWithOption },
        },
      }),
    })
  )
  assert.equal(found[0]?.message, message)
}
assert.deepEqual(
  ids({
    data: data({
      demographics: {
        ...emptyDemographics(),
        livingSituation: { ...emptyDemographics().livingSituation, livesWith: "with_partner" },
      },
      relationships: [
        person({
          relationshipRecordId: "partner",
          relationshipToClient: "current_partner",
          livingSituation: "lives_with_client_full_time",
        }),
      ],
    }),
  }),
  []
)

const workRole = backgroundChecks(
  input({
    data: data({
      demographics: {
        ...emptyDemographics(),
        occupation: { ...emptyDemographics().occupation, workStatus: "full_time", role: "" },
      },
    }),
  })
)
assert.equal(workRole[0]?.message, "Work status is Full-time, but no role is recorded.")
assert.equal(workRole[0]?.target, "occupation")
assert.deepEqual(
  ids({
    data: data({
      demographics: {
        ...emptyDemographics(),
        occupation: { ...emptyDemographics().occupation, workStatus: "full_time", role: "Teacher" },
      },
    }),
  }),
  []
)

const previousJob = backgroundChecks(
  input({
    data: data({
      demographics: {
        ...emptyDemographics(),
        occupation: { ...emptyDemographics().occupation, workStatus: "unemployed" },
      },
    }),
  })
)
assert.equal(previousJob[0]?.message, "Unemployed, but no previous job is recorded.")
assert.deepEqual(
  ids({
    data: data({
      demographics: {
        ...emptyDemographics(),
        occupation: {
          ...emptyDemographics().occupation,
          workStatus: "unemployed",
          previousJobs: [{ id: "job", role: "Teacher", employer: "School", started: "2019", ended: "2024" }],
        },
      },
    }),
  }),
  []
)

const historyYes = backgroundChecks(input({ screening: { emotional_problems: "yes" } }))
assert.equal(historyYes[0]?.message, "Emotional problems is Yes, with no entries.")
assert.equal(historyYes[0]?.id, "history-emotional_problems")
assert.equal(historyYes[0]?.target, "history")
assert.deepEqual(
  ids({
    screening: { emotional_problems: "yes" },
    data: data({
      events: [
        event({
          eventType: "emotional_problems",
          title: "Anxiety",
          startPrecision: "year",
          startValue: "2010",
        }),
      ],
    }),
  }),
  []
)

const disability = backgroundChecks(
  input({
    data: data({
      demographics: {
        ...emptyDemographics(),
        identity: { ...emptyDemographics().identity, disability: true, disabilityDetail: "" },
      },
    }),
  })
)
assert.equal(disability[0]?.message, "Disability is Yes, with no description.")
assert.equal(disability[0]?.target, "identity")
assert.deepEqual(
  ids({
    data: data({
      demographics: {
        ...emptyDemographics(),
        identity: { ...emptyDemographics().identity, disability: true, disabilityDetail: "Hearing" },
      },
    }),
  }),
  []
)

const unlinked = backgroundChecks(
  input({
    data: data({
      relationships: [person({ relationshipRecordId: "step-child", relationshipToClient: "child_step", givenName: "Alex" })],
    }),
  })
)
assert.equal(
  unlinked.some((check) => check.message.includes("needs linking")),
  false
)

const ben01 = backgroundChecks(
  input({
    numberOfChildren: 2,
    data: data({
      relationshipStatus: { relationshipStatus: "defacto", relationshipStatusOther: "" },
      relationships: [person({ relationshipRecordId: "child", relationshipToClient: "child_biological", givenName: "Ari" })],
    }),
  })
)
assert.deepEqual(
  ben01.map((check) => check.message),
  [
    "Relationship status is De facto, but no current partner is recorded.",
    "Client reported 2 children; 1 recorded.",
  ]
)

const datedDepression = { ...emptyEvent("emotional_problems", 0), eventRecordId: "dated", title: "Depression", startPrecision: "year" as const, startValue: "2000", about: "self" as const }
assert.equal(entryDetailMessage(datedDepression, "1970-03-12"), null)

const familyDepression = {
  ...emptyEvent("emotional_problems", 1),
  eventRecordId: "family",
  title: "Depression",
  about: "significant_other" as const,
}
assert.equal(entryDetailMessage(familyDepression, "1970-03-12"), null)

console.log("client background checks selftest passed")
