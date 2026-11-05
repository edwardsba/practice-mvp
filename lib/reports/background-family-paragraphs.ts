import { mapHowEnded } from "@/lib/client-background/how-ended"
import { resolvedAbout } from "@/lib/client-background/interview-history"
import { halfSiblingSide, stepParentLinks } from "@/lib/client-background/tree"
import {
  CHILD_TYPES,
  CLIENT_RELATIONSHIP_STATUS_LABELS,
  type ChildType,
  type ClientRelationshipStatus,
  type EventRecord,
  type PartnershipRecord,
  type RelationshipRecord,
} from "@/lib/client-background/types"
import {
  ageOn,
  agree,
  countWord,
  joinProse,
  lowerKeepingTypedCase,
  personAge,
  proseDate,
  yearOf,
  type ReportVoice,
} from "@/lib/reports/background-report-prose"
import { precisionForPartialDate } from "@/lib/client-background/partial-date"
import { parsePartialDate } from "@/lib/client-background/partial-date"

const CHILD_NOUN: Record<ChildType, [string, string]> = {
  biological: ["biological child", "biological children"],
  adopted: ["adopted child", "adopted children"],
  step_child: ["step-child", "step-children"],
  foster: ["foster child", "foster children"],
  other: ["other child", "other children"],
}

function deceased(person: RelationshipRecord): boolean {
  return person.deceased || person.healthStatus === "deceased"
}

function sexWord(sex: string): "female" | "male" | "" {
  const value = sex.trim().toLowerCase()
  if (value === "female") return "female"
  if (value === "male") return "male"
  return ""
}

function childTypeOf(person: RelationshipRecord): ChildType | "" {
  if (person.childType) return person.childType
  if (person.relationshipToClient === "child_step") return "step_child"
  if (person.relationshipToClient === "child_biological") return "biological"
  return ""
}

function isChild(person: RelationshipRecord): boolean {
  return person.relationshipToClient === "child_biological" || person.relationshipToClient === "child_step"
}

function isStepChild(person: RelationshipRecord): boolean {
  return person.relationshipToClient === "child_step" || person.childType === "step_child"
}

function agesDescending(children: RelationshipRecord[], asOf: string): number[] {
  return children
    .map((child) => (child.dateOfBirth ? personAge(child.dateOfBirth, asOf) : null))
    .filter((age): age is number => age != null)
    .sort((a, b) => b - a)
}

function agedPhrase(children: RelationshipRecord[], asOf: string): string {
  const ages = agesDescending(children, asOf)
  if (ages.length === 0) return ""
  return `aged ${joinProse(ages.map(String))}`
}

function withAge(label: string, person: RelationshipRecord, asOf: string): { text: string; aged: boolean } {
  const age = person.dateOfBirth ? personAge(person.dateOfBirth, asOf) : null
  if (age == null) return { text: label, aged: false }
  return { text: `${label}, ${age}`, aged: true }
}

function partnerNoun(sex: string, married: boolean, voice: ReportVoice): string {
  const value = sexWord(sex)
  if (married) {
    if (value === "female") return `${voice.possessive} wife`
    if (value === "male") return `${voice.possessive} husband`
    return `${voice.possessive} partner`
  }
  if (value === "female") return "a woman"
  if (value === "male") return "a man"
  return "a partner"
}

function relationshipRange(person: RelationshipRecord): string {
  const start = person.startedOn.trim() ? proseDate(person.startedOn) : ""
  const end = person.endedOn.trim() ? proseDate(person.endedOn) : ""
  if (start && end) return `from ${start} to ${end}`
  if (start) return `since ${start}`
  if (end) return `until ${end}`
  return ""
}

function endedClause(person: RelationshipRecord, voice: ReportVoice, married: boolean): string {
  const code = person.howEnded || mapHowEnded(person.relationshipStatus).howEnded
  if (code === "divorced" && married) return ", and the marriage ended in divorce"
  if (code === "separated") return ", which ended in separation"
  if (code === "divorced") return ", which ended in divorce"
  if (code === "partner_died") return `, which ended when ${voice.possessive} partner died`
  if (code === "other") {
    const text = person.relationshipStatus.trim().replace(/\.+$/, "")
    return text ? `, which ended in ${lowerKeepingTypedCase(text)}` : ""
  }
  return ""
}

function ownChildrenSentence(children: RelationshipRecord[], asOf: string): string {
  const groups = CHILD_TYPES.filter((type) => type !== "step_child")
    .map((type) => ({ type, children: children.filter((child) => childTypeOf(child) === type) }))
    .filter((group) => group.children.length > 0)
  const untyped = children.filter((child) => !childTypeOf(child))
  const bits = groups.map((group) => {
    const [one, many] = CHILD_NOUN[group.type]
    const noun = `${countWord(group.children.length)} ${group.children.length === 1 ? one : many}`
    const ages = agedPhrase(group.children, asOf)
    return ages ? `${noun}, ${ages}` : noun
  })
  if (untyped.length > 0) {
    const noun = `${countWord(untyped.length)} ${untyped.length === 1 ? "child" : "children"}`
    const ages = agedPhrase(untyped, asOf)
    bits.push(ages ? `${noun}, ${ages}` : noun)
  }
  if (bits.length === 0) return ""
  if (bits.length === 1) return `They have ${bits[0]}`
  return `They have ${countWord(children.length)} children: ${joinProse(bits)}`
}

function stepChildrenSentence(
  children: RelationshipRecord[],
  voice: ReportVoice,
  partner: RelationshipRecord,
  married: boolean,
  asOf: string
): string {
  const sex = sexWord(partner.sex)
  const who = married && sex === "female" ? "wife" : married && sex === "male" ? "husband" : "partner"
  const noun = children.length === 1 ? "one child" : `${countWord(children.length)} children`
  const ages = agedPhrase(children, asOf)
  return `${voice.Possessive} ${who} also has ${noun} from a previous relationship${ages ? `, ${ages}` : ""}`
}

function priorLine(
  person: RelationshipRecord,
  voice: ReportVoice,
  people: RelationshipRecord[],
  asOf: string
): string[] {
  const type = person.partnerType || ""
  const married = type === "married"
  const partner = withAge(partnerNoun(person.sex, false, voice), person, asOf)
  const range = relationshipRange(person).replace(/^since /, "from ")
  const rangeBit = range ? `${partner.aged ? "," : ""} ${range}` : ""
  const ended = endedClause(person, voice, married)
  const kind =
    type === "defacto"
      ? "a de facto relationship"
      : type === "engaged"
        ? "an engagement"
        : type === "dating"
          ? "a dating relationship"
          : married
            ? ""
            : "a relationship"
  const line = married
    ? `${voice.subject} ${agree(voice, "was", "were")} married to ${partner.text}${rangeBit}${ended}`
    : `${voice.subject} ${agree(voice, "was", "were")} in ${kind} with ${partner.text}${rangeBit}${ended}`
  const linked = people.filter((child) => isChild(child) && child.linkedPartnerRecordId === person.relationshipRecordId)
  const own = linked.filter((child) => !isStepChild(child))
  const step = linked.filter(isStepChild)
  const sentences = [`${line}${own.length === 0 && step.length === 0 ? ", with no children" : ""}.`]
  const ownText = ownChildrenSentence(own, asOf)
  if (ownText) sentences.push(`${ownText}.`)
  if (step.length > 0) sentences.push(`${stepChildrenSentence(step, voice, person, married, asOf)}.`)
  return sentences
}

/** 4.3 Current relationship, then previous ones from most recent to oldest. */
export function partnersParagraph(
  name: string,
  voice: ReportVoice,
  status: ClientRelationshipStatus | "",
  people: RelationshipRecord[],
  asOf: string
): string | null {
  const current = people.find((person) => person.relationshipToClient === "current_partner")
  const prior = people
    .filter((person) => person.relationshipToClient === "prior_partner")
    .sort((a, b) => (b.endedOn || b.startedOn).localeCompare(a.endedOn || a.startedOn))
  const sentences: string[] = []
  const statusLabel = status ? lowerKeepingTypedCase(CLIENT_RELATIONSHIP_STATUS_LABELS[status]) : ""

  if (current && status) {
    const married = status === "married"
    const partner = withAge(partnerNoun(current.sex, married, voice), current, asOf)
    const range = relationshipRange(current)
    const rangeBit = range ? `${partner.aged ? "," : ""} ${range}` : ""
    const kind =
      status === "married"
        ? "married"
        : status === "defacto"
          ? "in a de facto relationship"
          : status === "engaged"
            ? "engaged"
            : status === "dating"
              ? "dating"
              : status === "in_relationship_not_living_together"
                ? "in a relationship"
                : statusLabel
    const withPartner =
      married || status === "engaged" ? `to ${partner.text}` : status === "dating" ? partner.text : `with ${partner.text}`
    const linked = people.filter((child) => isChild(child) && child.linkedPartnerRecordId === current.relationshipRecordId)
    const own = linked.filter((child) => !isStepChild(child))
    const step = linked.filter(isStepChild)
    let opening = `${name} has been ${kind} ${withPartner}${rangeBit}`.replace(/\s{2,}/g, " ")
    if (own.length === 0 && step.length === 0) opening += ", with no children"
    sentences.push(`${opening}.`)
    const ownText = ownChildrenSentence(own, asOf)
    if (ownText) sentences.push(`${ownText}.`)
    if (step.length > 0) sentences.push(`${stepChildrenSentence(step, voice, current, married, asOf)}.`)
  } else if (status === "single" || status === "separated" || status === "divorced" || status === "widowed") {
    sentences.push(`${name} is currently ${statusLabel}.`)
  }

  if (prior.length === 1) {
    sentences.push(`${name} has had one previous significant relationship.`)
    sentences.push(...priorLine(prior[0], voice, people, asOf).map((line) => line.charAt(0).toUpperCase() + line.slice(1)))
  } else if (prior.length > 1) {
    sentences.push(
      `${name} has had ${countWord(prior.length)} previous significant relationships.`
    )
    prior.forEach((person, index) => {
      const lines = priorLine(person, voice, people, asOf)
      const lead = index === 0 ? "Most recently, " : "Before that, "
      sentences.push(`${lead}${lines[0]}`)
      sentences.push(...lines.slice(1))
    })
  }

  const specials = people.filter(
    (person) => person.relationshipToClient === "child_biological" && !person.linkedPartnerRecordId && person.otherParentKind
  )
  for (const kind of ["donor_conception", "adopted_sole", "other"] as const) {
    const rows = specials.filter((person) => person.otherParentKind === kind)
    if (rows.length === 0) continue
    if (kind === "other") {
      const detail = rows.map((person) => person.otherParentDetail.trim()).filter(Boolean).join("; ")
      const phrase = ownChildrenSentence(rows, asOf).replace(/^They have /, `${voice.subject} ${agree(voice, "has", "have")} `)
      sentences.push(`${phrase}${detail ? `, whose other parent is ${detail}` : ""}.`)
    } else {
      const ages = agedPhrase(rows, asOf)
      const noun = `${countWord(rows.length)} ${rows.length === 1 ? "child" : "children"}`
      const how = kind === "adopted_sole" ? `, adopted as a sole parent` : " by donor conception"
      sentences.push(`${voice.Subject} ${agree(voice, "has", "have")} ${noun}${how}${ages ? `, ${ages}` : ""}.`)
    }
  }

  return sentences.length > 0 ? sentences.join(" ") : null
}

/** 4.4 Every recorded child, by type. Left out when there are no children. */
export function childrenTotalParagraph(name: string, people: RelationshipRecord[], asOf: string): string | null {
  const children = people.filter(isChild)
  if (children.length === 0) return null
  if (children.length === 1) {
    const child = children[0]
    const type = childTypeOf(child)
    const noun = type ? `a ${CHILD_NOUN[type][0]}` : "a child"
    const age = child.dateOfBirth ? personAge(child.dateOfBirth, asOf) : null
    return `${name} has one child in total, ${noun}${age == null ? "" : ` aged ${age}`}.`
  }
  const groups = CHILD_TYPES.map((type) => ({
    type,
    children: children.filter((child) => childTypeOf(child) === type),
  })).filter((group) => group.children.length > 0)
  const bits = groups.map((group) => {
    const [one, many] = CHILD_NOUN[group.type]
    const noun = `${countWord(group.children.length)} ${group.children.length === 1 ? one : many}`
    const ages = agesDescending(group.children, asOf)
    return ages.length > 0 ? `${noun} (${joinProse(ages.map(String))})` : noun
  })
  return `In total, ${name} has ${countWord(children.length)} children: ${joinProse(bits)}.`
}

function parentRole(person: RelationshipRecord, adoptive: boolean): string {
  const sex = sexWord(person.sex)
  const role =
    person.relationshipToClient === "mother" || sex === "female"
      ? "mother"
      : person.relationshipToClient === "father" || sex === "male"
        ? "father"
        : "parent"
  return adoptive ? `adoptive ${role}` : role
}

function healthPhrase(status: string): string {
  if (status === "good") return "in good health"
  if (status === "fair") return "in fair health"
  if (status === "poor") return "in poor health"
  return ""
}

function parentIntro(
  person: RelationshipRecord,
  voice: ReportVoice,
  name: string,
  dateOfBirth: string | null,
  asOf: string,
  birth: boolean
): string | null {
  const known =
    person.parentType === "adoptive"
      ? parentRole(person, true)
      : birth
        ? `birth ${parentRole(person, false)}`
        : parentRole(person, false)
  if (person.notKnown) return `${voice.Possessive} ${known} is not known.`
  if (deceased(person)) {
    const year = person.dateOfDeath
      ? yearOf(precisionForPartialDate(parsePartialDate(person.dateOfDeath)) ?? "", person.dateOfDeath)
      : ""
    const age = person.dateOfDeath ? ageOn(dateOfBirth, person.dateOfDeath) : null
    if (year && age != null) return `${voice.Possessive} ${known} died in ${year}, when ${name} was ${age}.`
    if (year) return `${voice.Possessive} ${known} died in ${year}.`
    if (age != null) return `${voice.Possessive} ${known} died when ${name} was ${age}.`
    return `${voice.Possessive} ${known} is deceased.`
  }
  const age = person.dateOfBirth ? personAge(person.dateOfBirth, asOf) : null
  const health = healthPhrase(person.healthStatus)
  if (age != null && health) return `${voice.Possessive} ${known} is ${age} and ${health}.`
  if (age != null) return `${voice.Possessive} ${known} is ${age}.`
  if (health) return `${voice.Possessive} ${known} is ${health}.`
  return null
}

function originPartnerships(people: RelationshipRecord[], partnerships: PartnershipRecord[]): PartnershipRecord[] {
  const parents = new Set(
    people
      .filter((person) => ["mother", "father", "parent"].includes(person.relationshipToClient))
      .map((person) => person.relationshipRecordId)
  )
  return partnerships.filter((partnership) => parents.has(partnership.partnerAId) && parents.has(partnership.partnerBId))
}

function parentsBondSentences(
  group: RelationshipRecord[],
  partnerships: PartnershipRecord[],
  voice: ReportVoice,
  name: string,
  dateOfBirth: string | null
): string[] {
  const sentences: string[] = []
  const ids = new Set(group.map((person) => person.relationshipRecordId))
  for (const partnership of partnerships) {
    if (!ids.has(partnership.partnerAId) || !ids.has(partnership.partnerBId)) continue
    const a = group.find((person) => person.relationshipRecordId === partnership.partnerAId)
    const b = group.find((person) => person.relationshipRecordId === partnership.partnerBId)
    if (!a || !b) continue
    const status = partnership.relationshipStatus
    const ended = partnership.ended.trim()
    const endedAge = ended ? ageOn(dateOfBirth, ended) : null
    const year = ended ? yearOf(precisionForPartialDate(parsePartialDate(ended)) ?? "", ended) : ""
    const oneDead = [a, b].filter(deceased)
    const adoptive = a.parentType === "adoptive" || b.parentType === "adoptive"
    const label = adoptive && a.parentType === "adoptive" && b.parentType === "adoptive" ? "adoptive parents" : "parents"
    if (!ended && oneDead.length === 1 && (status === "married" || status === "defacto" || status === "")) {
      const role = parentRole(oneDead[0], false)
      const together = status === "defacto" ? "were together" : "were married"
      sentences.push(`${voice.Possessive} ${label} ${together} until ${voice.possessive} ${role}'s death.`)
      continue
    }
    if (status === "divorced" || status === "separated") {
      const verb = status
      if (year && endedAge != null) {
        sentences.push(`${voice.Possessive} ${label} ${verb} in ${year}, when ${name} was ${endedAge}.`)
      } else if (endedAge != null) {
        sentences.push(`${voice.Possessive} ${label} ${verb} when ${name} was ${endedAge}.`)
      } else {
        sentences.push(`${voice.Possessive} ${label} are ${verb}.`)
      }
      continue
    }
    if (status === "married" && !ended) sentences.push(`${voice.Possessive} ${label} are married.`)
    if (status === "defacto" && !ended) sentences.push(`${voice.Possessive} ${label} are together.`)
  }
  return sentences
}

function parentPronoun(person: RelationshipRecord): string {
  const sex = sexWord(person.sex)
  if (person.relationshipToClient === "mother" || sex === "female") return "she"
  if (person.relationshipToClient === "father" || sex === "male") return "he"
  return "they"
}

function laterClause(
  partnership: PartnershipRecord,
  name: string,
  voice: ReportVoice,
  dateOfBirth: string | null
): string {
  const married = partnership.relationshipStatus === "married"
  const startAge = partnership.started.trim() ? ageOn(dateOfBirth, partnership.started) : null
  const endAge = partnership.ended.trim() ? ageOn(dateOfBirth, partnership.ended) : null
  const startYear = partnership.started.trim()
    ? yearOf(precisionForPartialDate(parsePartialDate(partnership.started)) ?? "", partnership.started)
    : ""
  if (married) {
    const began =
      startAge != null ? `remarried when ${name} was ${startAge}` : startYear ? `remarried in ${startYear}` : "remarried"
    if (!partnership.ended.trim()) return began
    const ended =
      endAge != null ? `, and that marriage ended when ${voice.subject} was ${endAge}` : ", and that marriage ended"
    return `${began}${ended}`
  }
  if (!partnership.ended.trim() && startYear) return `has been in a de facto relationship since ${startYear}`
  const range = [startYear, partnership.ended.trim() ? yearOf(precisionForPartialDate(parsePartialDate(partnership.ended)) ?? "", partnership.ended) : ""]
  if (range[0] && range[1]) return `was in a de facto relationship from ${range[0]} to ${range[1]}`
  return "had a later relationship"
}

function laterRelationshipSentences(
  person: RelationshipRecord,
  voice: ReportVoice,
  name: string,
  dateOfBirth: string | null,
  people: RelationshipRecord[],
  partnerships: PartnershipRecord[]
): string[] {
  const role = parentRole(person, person.parentType === "adoptive")
  if (person.laterRelationships === "none") {
    const verb = deceased(person) ? "had" : "has had"
    return [`${voice.Possessive} ${role} ${verb} no later relationships.`]
  }
  if (person.laterRelationships !== "yes") return []
  const links = stepParentLinks(people, partnerships)
    .filter((link) => link.parent.relationshipRecordId === person.relationshipRecordId)
    .map((link) => partnerships.find((item) => item.partnershipRecordId === link.partnershipRecordId))
    .filter((item): item is PartnershipRecord => Boolean(item))
    .sort((a, b) => (a.started || "").localeCompare(b.started || ""))
  if (links.length === 0) return []
  const bare = (partnership: PartnershipRecord) =>
    !partnership.relationshipStatus.trim() && !partnership.started.trim() && !partnership.ended.trim()
  const detailed = links.filter((link) => !bare(link))
  const bareCount = links.length - detailed.length
  const verb = deceased(person) ? "had" : "has had"
  const counted = `${name}'s ${role} ${verb} ${countWord(links.length)} later ${links.length === 1 ? "relationship" : "relationships"}`
  if (detailed.length === 0) return [`${counted}.`]
  const pronoun = parentPronoun(person)
  if (links.length === 1) {
    return [`${voice.Possessive} ${role} ${laterClause(detailed[0], voice.subject, voice, dateOfBirth)}.`]
  }
  const clauses = detailed.map((link, index) => {
    const clause = laterClause(link, name, voice, dateOfBirth)
    if (index === 0) return `${pronoun} ${clause}`
    return clause.startsWith("has been") || clause.startsWith("was ") ? `${pronoun} ${clause}` : clause
  })
  if (bareCount === 1) clauses.push("one other relationship")
  else if (bareCount > 1) clauses.push(`${countWord(bareCount)} other relationships`)
  return [`${counted}: ${joinProse(clauses)}.`]
}

/** 4.5 Adoption, parents, their relationship, caregivers, then later relationships. */
export function parentsParagraph(
  name: string,
  voice: ReportVoice,
  dateOfBirth: string | null,
  people: RelationshipRecord[],
  partnerships: PartnershipRecord[],
  asOf: string
): string | null {
  const parents = people.filter((person) => ["mother", "father", "parent"].includes(person.relationshipToClient))
  const adoptive = parents.filter((person) => person.parentType === "adoptive")
  const birth = parents.filter((person) => person.parentType !== "adoptive")
  const both = adoptive.length > 0 && birth.length > 0
  const sentences: string[] = []
  const adoptedOn = adoptive.map((person) => person.adoptedOn.trim()).find(Boolean) ?? ""
  if (adoptedOn) {
    const age = ageOn(dateOfBirth, adoptedOn)
    sentences.push(`${name} was adopted in ${proseDate(adoptedOn)}${age != null ? `, at the age of ${age}` : ""}.`)
  }
  const describe = (group: RelationshipRecord[], asBirth: boolean) => {
    for (const person of group) {
      const line = parentIntro(person, voice, name, dateOfBirth, asOf, both && asBirth)
      if (line) sentences.push(line)
    }
  }
  if (both) {
    describe(adoptive, false)
    sentences.push(...parentsBondSentences(adoptive, partnerships, voice, name, dateOfBirth))
    describe(birth, true)
    sentences.push(...parentsBondSentences(birth, partnerships, voice, name, dateOfBirth))
  } else {
    describe(parents, false)
    sentences.push(...parentsBondSentences(parents, partnerships, voice, name, dateOfBirth))
  }
  const caregivers = people
    .filter((person) => person.relationshipToClient === "other_caregiver")
    .sort((a, b) => a.startedOn.localeCompare(b.startedOn))
  for (const caregiver of caregivers) {
    const from = ageOn(dateOfBirth, caregiver.startedOn)
    const until = ageOn(dateOfBirth, caregiver.endedOn)
    const span =
      from != null && until != null
        ? `From the age of ${from} to ${until}`
        : from != null
          ? `From the age of ${from}`
          : until != null
            ? `Until the age of ${until}`
            : ""
    const kind = caregiver.caregiverRelationship
    let care = ""
    if (kind === "foster_carer") care = `${name} was in foster care`
    else if (kind === "kinship_carer") care = `${name} was in kinship care`
    else if (kind === "residential") care = `${name} was in residential care`
    else {
      const detail =
        caregiver.caregiverRelationshipDetail.trim() || (kind === "grandparent" ? "grandparent" : kind.replaceAll("_", " "))
      care = `${name} was mainly cared for by ${voice.possessive} ${lowerKeepingTypedCase(detail)}`
    }
    if (span || care) sentences.push(`${span ? `${span}, ` : ""}${care}.`)
  }
  const orderedParents = both ? [...adoptive, ...birth] : parents
  for (const person of orderedParents) {
    sentences.push(...laterRelationshipSentences(person, voice, name, dateOfBirth, people, partnerships))
  }
  return sentences.length > 0 ? sentences.join(" ") : null
}

function siblingSex(person: RelationshipRecord): string {
  const sex = sexWord(person.sex)
  if (sex === "female") return "sister"
  if (sex === "male") return "brother"
  return "sibling"
}

function joinInsideBrackets(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ""
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`
}

function ordinalWord(value: number): string {
  const words = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth"]
  return words[value] ?? String(value)
}

function siblingAge(person: RelationshipRecord, asOf: string): number | null {
  if (!person.dateOfBirth) return null
  return personAge(person.dateOfBirth, asOf)
}

/** One sibling inside the full-sibling brackets, used when the group is mixed sex. */
function individualSiblingDetail(person: RelationshipRecord, asOf: string): string {
  const sex = siblingSex(person)
  if (deceased(person) && siblingAge(person, asOf) == null) return `a ${sex} who has died`
  const age = siblingAge(person, asOf)
  return age == null ? `a ${sex}` : `a ${sex}, ${age}`
}

/**
 * Same-sex full siblings: "both brothers, one aged 48" / "all sisters, ages not recorded".
 * Mixed-sex groups stay as one description per person.
 */
function fullSiblingDetail(group: RelationshipRecord[], asOf: string): string {
  if (group.length === 0) return ""
  const sexes = new Set(group.map((person) => siblingSex(person)))
  if (sexes.size !== 1 || group.length === 1) return joinInsideBrackets(group.map((person) => individualSiblingDetail(person, asOf)))
  const sex = siblingSex(group[0])
  const plural = sex === "brother" ? "brothers" : sex === "sister" ? "sisters" : "siblings"
  const head = group.length === 2 ? `both ${plural}` : `all ${plural}`
  const aged = group
    .map((person) => siblingAge(person, asOf))
    .filter((age): age is number => age != null)
    .sort((a, b) => b - a)
  const diedWithoutAge = group.filter((person) => deceased(person) && siblingAge(person, asOf) == null)
  const bits: string[] = []
  if (aged.length === group.length) bits.push(`aged ${joinProse(aged.map(String))}`)
  else if (aged.length === 1) bits.push(`one aged ${aged[0]}`)
  else if (aged.length > 1) bits.push(`${countWord(aged.length)} aged ${joinProse(aged.map(String))}`)
  else if (diedWithoutAge.length < group.length) bits.push("ages not recorded")
  if (diedWithoutAge.length === 1) bits.push(aged.length === 0 && diedWithoutAge.length === group.length ? "who has died" : "one who has died")
  else if (diedWithoutAge.length > 1) bits.push(diedWithoutAge.length === group.length ? "who have died" : `${countWord(diedWithoutAge.length)} who have died`)
  return bits.length > 0 ? `${head}, ${bits.join(", ")}` : head
}

/** 4.6 Birth order, the total including deceased siblings, then each type. */
export function siblingsParagraph(
  name: string,
  voice: ReportVoice,
  dateOfBirth: string | null,
  people: RelationshipRecord[],
  partnerships: PartnershipRecord[],
  asOf: string
): string | null {
  const adopted = people.some(
    (person) => ["mother", "father", "parent"].includes(person.relationshipToClient) && person.parentType === "adoptive"
  )
  const fullRole = adopted ? "sibling_adoptive" : "sibling_full"
  const full = people.filter((person) => person.relationshipToClient === fullRole)
  const halves = people.filter((person) => person.relationshipToClient === "sibling_half")
  const steps = people.filter((person) => person.relationshipToClient === "sibling_step")
  const adoptiveSiblings = adopted ? [] : people.filter((person) => person.relationshipToClient === "sibling_adoptive")
  const all = [...full, ...halves, ...steps, ...adoptiveSiblings]
  if (all.length === 0) return null
  const sentences: string[] = []
  const clientYears = dateOfBirth ? personAge(dateOfBirth, asOf) : null
  const orderPool = full.filter((person) => person.dateOfBirth && personAge(person.dateOfBirth, asOf) != null)
  const livingMissingAge = full.some((person) => !deceased(person) && !(person.dateOfBirth && personAge(person.dateOfBirth, asOf) != null))
  if (clientYears != null && !livingMissingAge && orderPool.length > 0) {
    const older = orderPool.filter((person) => (personAge(person.dateOfBirth, asOf) ?? 0) > clientYears).length
    const place =
      older === 0 ? "the eldest" : older === orderPool.length ? "the youngest" : `the ${ordinalWord(older + 1)}`
    const family = adopted ? "adoptive siblings" : "full siblings"
    sentences.push(`${name} is ${place} of ${voice.possessive} ${family}.`)
  }
  const bits: string[] = []
  if (full.length > 0) {
    const noun = `${countWord(full.length)} ${full.length === 1 ? (adopted ? "adoptive sibling" : "full sibling") : adopted ? "adoptive siblings" : "full siblings"}`
    const detail = fullSiblingDetail(full, asOf)
    bits.push(detail ? `${noun} (${detail})` : noun)
  }
  const sideGroups = (rows: RelationshipRecord[], label: "half-sibling" | "step-sibling") => {
    const buckets = new Map<string, RelationshipRecord[]>()
    for (const person of rows) {
      const side = label === "half-sibling" ? halfSiblingSide(person, people, partnerships) : stepSide(person, people, partnerships)
      const key = side ? `${side} ${label}` : label
      buckets.set(key, [...(buckets.get(key) ?? []), person])
    }
    for (const [key, group] of buckets) {
      const ages = agesDescending(group, asOf)
      const noun = `${countWord(group.length)} ${group.length === 1 ? key : key.replace("sibling", "siblings")}`
      bits.push(ages.length > 0 ? `${noun} (${joinProse(ages.map(String))})` : noun)
    }
  }
  sideGroups(halves, "half-sibling")
  sideGroups(steps, "step-sibling")
  if (adoptiveSiblings.length > 0) {
    const ages = agesDescending(adoptiveSiblings, asOf)
    const noun = `${countWord(adoptiveSiblings.length)} adoptive ${adoptiveSiblings.length === 1 ? "sibling" : "siblings"}`
    bits.push(ages.length > 0 ? `${noun} (${joinProse(ages.map(String))})` : noun)
  }
  sentences.push(
    `${voice.Subject} ${agree(voice, "has", "have")} ${countWord(all.length)} ${all.length === 1 ? "sibling" : "siblings"} in total: ${joinProse(bits)}.`
  )
  const brothers = full.filter((person) => siblingSex(person) === "brother")
  const sisters = full.filter((person) => siblingSex(person) === "sister")
  for (const group of [brothers, sisters]) {
    const sexName = group[0] ? siblingSex(group[0]) : ""
    const known = group
      .filter((person) => person.dateOfBirth && personAge(person.dateOfBirth, asOf) != null)
      .sort((a, b) => (personAge(b.dateOfBirth, asOf) ?? 0) - (personAge(a.dateOfBirth, asOf) ?? 0))
    const ordered = [...known]
    for (const person of group.filter(deceased)) {
      if (!ordered.some((row) => row.relationshipRecordId === person.relationshipRecordId)) ordered.push(person)
    }
    group.filter(deceased).forEach((person) => {
      const age = person.dateOfDeath ? ageOn(dateOfBirth, person.dateOfDeath) : null
      const index = ordered.findIndex((row) => row.relationshipRecordId === person.relationshipRecordId)
      const place = index >= 0 && ordered.length > 1 ? `${ordinalWord(index + 1)} ` : ""
      const when = age != null ? ` when ${name} was ${age}` : ""
      sentences.push(`${voice.Possessive} ${place}${sexName} died${when}.`.replace(/\s{2,}/g, " "))
    })
  }
  return sentences.join(" ")
}

function stepSide(
  person: RelationshipRecord,
  people: RelationshipRecord[],
  partnerships: PartnershipRecord[]
): "maternal" | "paternal" | null {
  const link = stepParentLinks(people, partnerships).find((item) => item.partnershipRecordId === person.partnershipRecordId)
  if (!link) return null
  const sex = sexWord(link.parent.sex)
  if (link.parent.relationshipToClient === "mother" || sex === "female") return "maternal"
  if (link.parent.relationshipToClient === "father" || sex === "male") return "paternal"
  return null
}

const SIGNIFICANT_ORDER = [
  "illness_injury",
  "emotional_problems",
  "substance_use",
  "self_harm",
  "psychiatric_admission",
  "traumatic_event",
  "previous_therapy",
  "medication",
  "significant_history",
] as const

function roleWord(person: RelationshipRecord): string {
  if (person.relationshipToClient === "mother") return "mother"
  if (person.relationshipToClient === "father") return "father"
  if (person.relationshipToClient === "step_parent") return "step-parent"
  if (person.relationshipToClient === "current_partner" || person.relationshipToClient === "prior_partner") return "partner"
  if (person.relationshipToClient === "sibling_full" || person.relationshipToClient === "sibling_adoptive") return siblingSex(person)
  if (person.relationshipToClient === "sibling_half") return `half-${siblingSex(person)}`
  if (person.relationshipToClient === "sibling_step") return `step-${siblingSex(person)}`
  if (isChild(person)) return "child"
  if (person.relationshipToClient === "other_caregiver") return "caregiver"
  return "relative"
}

function conditionText(event: EventRecord, role: string, kind: string): string {
  let title = lowerKeepingTypedCase(event.title.trim())
  if (role && title.startsWith(`${role} `)) title = title.slice(role.length + 1).trim()
  if (/^(died|was|has|had)\b/i.test(event.title.trim())) return event.title.trim().replace(/\.$/, "")
  if (kind === "substance_use") return `has a history of problems with ${title || "alcohol or drugs"}`
  if (kind === "self_harm") return title ? `has a history of ${title}` : "has a history of self-harm"
  if (kind === "psychiatric_admission") return "has been admitted to hospital"
  return `has a history of ${title || "significant events"}`
}

/** Section 6. One paragraph per heading. The first sentence names the client; later sentences use the pronoun. */
function sectionPersonTag(person: RelationshipRecord, asOf: string): string {
  const name = person.givenName.trim()
  if (deceased(person)) return name ? ` (${name}, deceased)` : " (deceased)"
  if (name) return ` (${name})`
  const age = person.dateOfBirth && asOf ? personAge(person.dateOfBirth, asOf) : null
  return age != null ? ` (${age} years old)` : ""
}

export function significantOtherParagraphs(
  name: string,
  people: RelationshipRecord[],
  events: EventRecord[],
  voice?: ReportVoice,
  asOf = ""
): string[] {
  const rows = events.filter((event) => resolvedAbout(event) === "significant_other")
  const paragraphs: string[] = []
  const laterOwner = voice && voice.kind !== "name" ? voice.Possessive : "Their"
  for (const kind of SIGNIFICANT_ORDER) {
    const matched = rows.filter((event) => (event.eventType === "family_events" ? "emotional_problems" : event.eventType) === kind)
    if (matched.length === 0) continue
    const sentences = matched.map((event, index) => {
      const person = event.relationshipRecordId
        ? people.find((row) => row.relationshipRecordId === event.relationshipRecordId)
        : undefined
      if (person) {
        const role = roleWord(person)
        const detail = conditionText(event, role, kind)
        const owner = index === 0 ? `${name}'s` : laterOwner
        return `${owner} ${role}${sectionPersonTag(person, asOf)} ${detail}.`
      }
      const other = event.aboutOther.trim() || event.familyRelation.trim()
      const who = other ? `A ${lowerKeepingTypedCase(other)} of ${name}'s` : `A significant other of ${name}'s`
      const detail = conditionText(event, "", kind)
      return `${who} ${detail}.`
    })
    paragraphs.push(sentences.join(" "))
  }
  return paragraphs
}

/** Origin parents' partnership only. Step-parent links are later relationships, not this date. */
export function parentsSeparationMissing(
  people: RelationshipRecord[],
  partnerships: PartnershipRecord[]
): boolean {
  return originPartnerships(people, partnerships).some(
    (partnership) =>
      (partnership.relationshipStatus === "separated" || partnership.relationshipStatus === "divorced") &&
      !partnership.ended.trim()
  )
}
