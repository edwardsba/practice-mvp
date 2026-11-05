import { precisionForPartialDate, parsePartialDate } from "@/lib/client-background/partial-date"
import {
  CHILD_TYPES,
  type ChildType,
  type RelationshipBlock,
  type RelationshipBlockAnswers,
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

function members(block: RelationshipBlock, people: RelationshipRecord[], role: string) {
  return people.filter((person) => person.relationshipBlockId === block.relationshipBlockId && person.blockRole === role)
}

function childTypeOf(person: RelationshipRecord): ChildType | "" {
  const value = person.blockRoleType || person.childType
  return (CHILD_TYPES as readonly string[]).includes(value) ? (value as ChildType) : ""
}

function agesDescending(children: RelationshipRecord[], asOf: string): number[] {
  return children
    .map((child) => (child.dateOfBirth ? personAge(child.dateOfBirth, asOf) : null))
    .filter((age): age is number => age != null)
    .sort((a, b) => b - a)
}

function agedPhrase(children: RelationshipRecord[], asOf: string): string {
  const ages = agesDescending(children, asOf)
  return ages.length > 0 ? `aged ${joinProse(ages.map(String))}` : ""
}

/** Name and age inside parentheses: "Phil, 55", "55 years old", "Phil", or "Susan, deceased". */
export function personDetail(person: RelationshipRecord, asOf: string): string {
  const name = person.givenName.trim()
  if (deceased(person)) return name ? `${name}, deceased` : "deceased"
  const age = person.dateOfBirth ? personAge(person.dateOfBirth, asOf) : null
  if (name && age != null) return `${name}, ${age}`
  if (name) return name
  if (age != null) return `${age} years old`
  return ""
}

function wrappedDetail(person: RelationshipRecord, asOf: string): string {
  const detail = personDetail(person, asOf)
  return detail ? ` (${detail})` : ""
}

function partnerNoun(person: RelationshipRecord, voice: ReportVoice, married: boolean): string {
  const sex = sexWord(person.sex)
  if (married && sex === "female") return `${voice.possessive} wife`
  if (married && sex === "male") return `${voice.possessive} husband`
  if (sex === "female") return "a woman"
  if (sex === "male") return "a man"
  return "a partner"
}

function partnerPhrase(partners: RelationshipRecord[], voice: ReportVoice, asOf: string, married: boolean): string {
  return joinProse(
    partners.map((person, index) => `${partnerNoun(person, voice, married && index === 0)}${wrappedDetail(person, asOf)}`)
  )
}

function monthNumber(value: string): number | null {
  const match = /^\d{4}-(\d{2})/.exec(value.trim())
  return match ? Number(match[1]) : null
}

/** Whole years between the dates. Under a year is months. No start date leaves it out. */
export function relationshipDuration(start: string, end: string, asOf: string): string {
  if (!start.trim()) return ""
  const startYear = Number(/^(\d{4})/.exec(start)?.[1])
  const endSource = end.trim() || asOf
  const endYear = Number(/^(\d{4})/.exec(endSource)?.[1])
  if (!startYear || !endYear) return ""
  const startMonth = monthNumber(start)
  const endMonth = monthNumber(endSource)
  if (startMonth == null || endMonth == null) {
    const years = endYear - startYear
    if (years < 1) return ""
    return years === 1 ? "1 year" : `${years} years`
  }
  const months = (endYear - startYear) * 12 + (endMonth - startMonth)
  if (months < 1) return ""
  if (months < 12) return months === 1 ? "1 month" : `${months} months`
  const years = Math.floor(months / 12)
  return years === 1 ? "1 year" : `${years} years`
}

function rangeBit(block: RelationshipBlock, current: boolean, asOf: string): string {
  const start = block.startedOn.trim() ? proseDate(block.startedOn) : ""
  const end = block.endedOn.trim() ? proseDate(block.endedOn) : ""
  const duration = relationshipDuration(block.startedOn, current ? "" : block.endedOn, asOf)
  const span = start && end ? ` from ${start} to ${end}` : start ? (current ? ` since ${start}` : ` from ${start}`) : end ? ` until ${end}` : ""
  return duration ? `${span} (${duration})` : span
}

function diedWho(partners: RelationshipRecord[], voice: ReportVoice, widowed: boolean): string {
  if (partners.length !== 1) return `${voice.possessive} partner`
  const sex = sexWord(partners[0].sex)
  if (widowed && sex === "female") return `${voice.possessive} wife`
  if (widowed && sex === "male") return `${voice.possessive} husband`
  return `${voice.possessive} partner`
}

/** Wording for one ended relationship, without a closing full stop. */
export function endedRelationshipClause(
  block: RelationshipBlock,
  partners: RelationshipRecord[],
  voice: ReportVoice,
  asOf: string
): string {
  const married = block.status === "divorced" || block.status === "married_separated" || block.status === "widowed"
  const phrase = partnerPhrase(partners, voice, asOf, false)
  const range = rangeBit(block, false, asOf)
  const to = married || block.status === "engagement_ended" ? "to" : "with"
  const bareComma = phrase.replace(/\([^)]*\)/g, "").includes(",")
  const object = phrase ? ` ${to} ${phrase}${bareComma && range ? "," : ""}${range}` : range
  const was = agree(voice, "was", "were")
  if (block.status === "divorced") return `${voice.subject} ${was} married${object}, and the marriage ended in divorce`
  if (block.status === "defacto_separated") {
    return `${voice.subject} ${was} in a de facto relationship${object}, which ended in separation`
  }
  if (block.status === "married_separated") return `${voice.subject} ${was} married${object}, and they separated`
  if (block.status === "engagement_ended") return `${voice.subject} ${was} engaged${object}`
  if (block.status === "relationship_ended") return `${voice.subject} ${was} in a relationship${object}`
  if (block.status === "widowed") {
    return `${voice.subject} ${was} married${object}, which ended when ${diedWho(partners, voice, true)} died`
  }
  if (block.status === "partner_died") {
    return `${voice.subject} ${was} in a relationship${object}, which ended when ${diedWho(partners, voice, false)} died`
  }
  return `${voice.subject} ${was} in a relationship${object}`
}

function childSexNoun(person: RelationshipRecord, typed: boolean): [string, string] {
  const sex = sexWord(person.sex)
  const base: [string, string] = sex === "female" ? ["daughter", "daughters"] : sex === "male" ? ["son", "sons"] : ["child", "children"]
  if (!typed) return base
  const type = childTypeOf(person)
  const prefix = type === "adopted" ? "adopted " : type === "foster" ? "foster " : type === "other" ? "other " : ""
  return [`${prefix}${base[0]}`, `${prefix}${base[1]}`]
}

function byAge(people: RelationshipRecord[], asOf: string): RelationshipRecord[] {
  return [...people].sort((a, b) => (personAge(b.dateOfBirth, asOf) ?? -1) - (personAge(a.dateOfBirth, asOf) ?? -1))
}

function peopleList(people: RelationshipRecord[], asOf: string, separator: "and" | "semi"): string {
  const bits = byAge(people, asOf).map((person) => personDetail(person, asOf)).filter(Boolean)
  if (bits.length === 0) return ""
  if (separator === "semi") return bits.join("; ")
  return joinProse(bits)
}

function groupedChildBits(children: RelationshipRecord[], asOf: string, typed: boolean): string[] {
  const buckets = new Map<string, { one: string; many: string; children: RelationshipRecord[] }>()
  for (const child of children) {
    const [one, many] = childSexNoun(child, typed)
    const key = one
    const bucket = buckets.get(key) ?? { one, many, children: [] }
    bucket.children.push(child)
    buckets.set(key, bucket)
  }
  return [...buckets.values()].map((group) => {
    const noun = `${countWord(group.children.length)} ${group.children.length === 1 ? group.one : group.many}`
    const listed = peopleList(group.children, asOf, "and")
    return listed ? `${noun} (${listed})` : noun
  })
}

function childrenSentences(
  children: RelationshipRecord[],
  partners: RelationshipRecord[],
  voice: ReportVoice,
  asOf: string,
  current: boolean,
  status: string
): string[] {
  if (children.length === 0) return [current ? "They do not have any children." : "They did not have any children."]
  const own = children.filter((child) => childTypeOf(child) !== "step_child")
  const step = children.filter((child) => childTypeOf(child) === "step_child")
  const sentences: string[] = []
  if (own.length > 0) {
    const bits = groupedChildBits(own, asOf, true)
    sentences.push(`They have ${joinProse(bits)}.`)
  }
  if (step.length > 0) {
    const female = partners.some((person) => sexWord(person.sex) === "female")
    const male = partners.some((person) => sexWord(person.sex) === "male")
    const whose = status === "married" && female ? "wife" : status === "married" && male ? "husband" : "partner"
    const stepBits = [...new Map(step.map((child) => {
      const [one, many] = childSexNoun(child, false)
      return [one, { one, many, children: [] as RelationshipRecord[] }]
    })).values()]
    for (const child of step) {
      const [one] = childSexNoun(child, false)
      const bucket = stepBits.find((item) => item.one === one)
      bucket?.children.push(child)
    }
    const stepText = stepBits.map((group) => {
      const listed = peopleList(group.children, asOf, "and")
      const noun = group.children.length === 1 ? `a ${group.one}` : `${countWord(group.children.length)} ${group.many}`
      return `${noun} from a previous relationship${listed ? ` (${listed})` : ""}`
    })
    sentences.push(`${voice.Possessive} ${whose} also has ${joinProse(stepText)}.`)
  }
  return sentences
}

function currentOpening(
  name: string,
  block: RelationshipBlock,
  partners: RelationshipRecord[],
  voice: ReportVoice,
  asOf: string
): string {
  const married = block.status === "married"
  const phrase = partnerPhrase(partners, voice, asOf, married)
  const range = rangeBit(block, true, asOf)
  const preposition = married || block.status === "engaged" ? " to " : block.status === "dating" ? " " : " with "
  const withPartner = phrase ? `${preposition}${phrase}${range}` : ""
  const apart = block.status === "in_relationship_not_living_together" ? " (not living together)" : ""
  const kind =
    block.status === "married"
      ? "married"
      : block.status === "defacto"
        ? "in a de facto relationship"
        : block.status === "engaged"
          ? "engaged"
          : block.status === "dating"
            ? "dating"
            : "in a relationship"
  return `${name} has been ${kind}${withPartner}${apart}`.replace(/\s{2,}/g, " ")
}

/** 4.3 Current blocks, then previous blocks from most recent to oldest. */
export function partnersFromBlocks(
  name: string,
  voice: ReportVoice,
  status: string,
  blocks: RelationshipBlock[],
  people: RelationshipRecord[],
  asOf: string
): string | null {
  const current = blocks.filter((block) => block.kind === "client_current").sort((a, b) => a.displayOrder - b.displayOrder)
  const previous = blocks
    .filter((block) => block.kind === "client_previous")
    .sort((a, b) => b.startedOn.localeCompare(a.startedOn) || a.displayOrder - b.displayOrder)
  const sentences: string[] = []
  for (const block of current) {
    const partners = members(block, people, "partner")
    const children = members(block, people, "child")
    if (partners.length === 0 && !block.status) continue
    sentences.push(`${currentOpening(name, block, partners, voice, asOf)}.`)
    sentences.push(...childrenSentences(children, partners, voice, asOf, true, block.status))
  }
  if (current.length === 0 && ["single", "separated", "divorced", "widowed"].includes(status)) {
    const label = status === "single" ? "single" : status
    sentences.push(`${name} is currently ${label}.`)
  }
  if (previous.length > 0) {
    sentences.push(
      `${name} has had ${previous.length === 1 ? "one previous significant relationship" : `${countWord(previous.length)} previous significant relationships`}.`
    )
    const leadFor = current.length > 0 ? "Prior to this current relationship, " : "Previously, "
    previous.forEach((block, index) => {
      const lines = previousBlockSentences(block, people, name, voice, asOf)
      sentences.push(`${index === 0 ? leadFor : "Before that, "}${lines[0]}`)
      sentences.push(...lines.slice(1))
    })
  }
  return sentences.length > 0 ? sentences.join(" ") : null
}

function previousBlockSentences(
  block: RelationshipBlock,
  people: RelationshipRecord[],
  name: string,
  voice: ReportVoice,
  asOf: string
): string[] {
  const partners = members(block, people, "partner")
  const children = members(block, people, "child")
  const line = endedRelationshipClause(block, partners, voice, asOf).replace(new RegExp(`^${voice.subject}\\b`), name)
  const sentences = [`${line}.`]
  sentences.push(...childrenSentences(children, partners, voice, asOf, false, block.status))
  return sentences
}

/** 4.4 Every child in every block, by type. */
export function childrenFromBlocks(name: string, blocks: RelationshipBlock[], people: RelationshipRecord[], asOf: string): string | null {
  const children = people.filter((person) => person.blockRole === "child" && blocks.some((block) => block.relationshipBlockId === person.relationshipBlockId))
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
    const listed = peopleList(group.children, asOf, "semi")
    return listed ? `${noun} (${listed})` : noun
  })
  return `In total, ${name} has ${countWord(children.length)} children: ${joinProse(bits)}.`
}

function parentRole(person: RelationshipRecord): string {
  const sex = sexWord(person.sex)
  if (person.blockRoleType === "mother" || person.relationshipToClient === "mother" || sex === "female") return "mother"
  if (person.blockRoleType === "father" || person.relationshipToClient === "father" || sex === "male") return "father"
  return "parent"
}

function parentLine(person: RelationshipRecord, owner: string, name: string, dateOfBirth: string | null, asOf: string): string | null {
  const role = parentRole(person)
  const living = wrappedDetail(person, asOf)
  const named = person.givenName.trim() ? ` (${person.givenName.trim()})` : ""
  if (person.notKnown) return `${owner} ${role} is not known.`
  if (deceased(person)) {
    const year = person.dateOfDeath ? yearOf(precisionForPartialDate(parsePartialDate(person.dateOfDeath)) ?? "", person.dateOfDeath) : ""
    const age = person.dateOfDeath ? ageOn(dateOfBirth, person.dateOfDeath) : null
    if (year && age != null) return `${owner} ${role}${named} died in ${year}, when ${name} was ${age}.`
    if (year) return `${owner} ${role}${named} died in ${year}.`
    if (age != null) return `${owner} ${role}${named} died when ${name} was ${age}.`
    return `${owner} ${role}${named || " (deceased)"} is deceased.`
  }
  const health = person.healthStatus === "good" ? "in good health" : person.healthStatus === "fair" ? "in fair health" : person.healthStatus === "poor" ? "in poor health" : ""
  if (health) return `${owner} ${role}${living} is ${health}.`
  if (living) return `${owner} ${role}${living}.`
  return null
}

function parentsBond(block: RelationshipBlock, voice: ReportVoice, name: string, dateOfBirth: string | null): string | null {
  const ended = block.endedOn.trim()
  const year = ended ? yearOf(precisionForPartialDate(parsePartialDate(ended)) ?? "", ended) : ""
  const age = ended ? ageOn(dateOfBirth, ended) : null
  const separated = block.status === "married_separated" || block.status === "defacto_separated" || block.status === "separated"
  if (block.status === "divorced" || separated) {
    const verb = block.status === "divorced" ? "divorced" : "separated"
    if (year && age != null) return `${voice.Possessive} parents ${verb} in ${year}, when ${name} was ${age}.`
    if (age != null) return `${voice.Possessive} parents ${verb} when ${name} was ${age}.`
    return `${voice.Possessive} parents are ${verb}.`
  }
  if (block.status === "married" && !ended) return `${voice.Possessive} parents are married.`
  if ((block.status === "defacto" || block.status === "in_relationship_not_living_together") && !ended) {
    return `${voice.Possessive} parents are together.`
  }
  if ((block.status === "widowed" || block.status === "partner_died") && !ended) {
    return `${voice.Possessive} parents were married until a parent's death.`
  }
  return null
}

function bareBlock(block: RelationshipBlock): boolean {
  return !block.status.trim() && !block.startedOn.trim() && !block.endedOn.trim()
}

function parentLaterClause(
  block: RelationshipBlock,
  name: string,
  voice: ReportVoice,
  dateOfBirth: string | null,
  people: RelationshipRecord[]
): string {
  const startAge = block.startedOn.trim() ? ageOn(dateOfBirth, block.startedOn) : null
  const endAge = block.endedOn.trim() ? ageOn(dateOfBirth, block.endedOn) : null
  const startYear = block.startedOn.trim() ? yearOf(precisionForPartialDate(parsePartialDate(block.startedOn)) ?? "", block.startedOn) : ""
  const endYear = block.endedOn.trim() ? yearOf(precisionForPartialDate(parsePartialDate(block.endedOn)) ?? "", block.endedOn) : ""
  const partner = members(block, people, "partner").find((person) => person.givenName.trim())
  const who = partner ? ` (${partner.givenName.trim()})` : ""
  const marriage = ["married", "divorced", "widowed", "married_separated"].includes(block.status)
  if (marriage) {
    const began = startAge != null ? `remarried${who} when ${name} was ${startAge}` : startYear ? `remarried${who} in ${startYear}` : `remarried${who}`
    if (!block.endedOn.trim() && block.status === "married") return began
    const ended = endAge != null ? `, and that marriage ended when ${voice.subject} was ${endAge}` : block.endedOn.trim() ? ", and that marriage ended" : ""
    return `${began}${ended}`
  }
  if (!block.endedOn.trim() && startYear) return `re-partnered${who} and has been in a de facto relationship since ${startYear}`
  if (startYear && endYear) return `re-partnered in a de facto relationship from ${startYear} to ${endYear}`
  if (block.status === "defacto_separated") return "re-partnered, and that relationship ended in separation"
  if (block.status === "engagement_ended") return "was engaged again"
  if (block.status === "relationship_ended") return "re-partnered, and that relationship ended"
  if (block.status === "partner_died") return `re-partnered, which ended when ${voice.possessive} partner died`
  return "re-partnered"
}

function undated(block: RelationshipBlock): boolean {
  return !block.startedOn.trim() && !block.endedOn.trim()
}

/** Two or more later relationships with the same status and no dates become one clause. */
export function combinedLaterClause(status: string, count: number): string | null {
  if (count < 2 || !status.trim()) return null
  const times = count === 2 ? "twice" : `${countWord(count)} times`
  const both = count === 2 ? "both" : "all"
  if (status === "divorced") return `has remarried ${times}, and ${both} marriages ended in divorce`
  if (status === "married_separated") return `has remarried ${times}, and ${both} marriages ended in separation`
  if (status === "widowed") return `has remarried ${times}, and ${both} marriages ended when the partner died`
  if (status === "defacto_separated") return `has re-partnered ${times}, and ${both} relationships ended in separation`
  if (status === "relationship_ended") return `has re-partnered ${times}, and ${both} relationships ended`
  if (status === "engagement_ended") return `was engaged ${times}, and ${both} engagements ended`
  if (status === "partner_died") return `has re-partnered ${times}, and ${both} relationships ended when the partner died`
  if (status === "married") return `has remarried ${times}`
  if (status === "defacto") return `has re-partnered ${times}`
  return null
}

function laterClauses(
  blocks: RelationshipBlock[],
  name: string,
  voice: ReportVoice,
  dateOfBirth: string | null,
  people: RelationshipRecord[]
): string[] {
  const dated = blocks.filter((block) => !undated(block))
  const grouped = new Map<string, RelationshipBlock[]>()
  for (const block of blocks.filter(undated)) {
    grouped.set(block.status, [...(grouped.get(block.status) ?? []), block])
  }
  const clauses: string[] = []
  for (const block of dated) clauses.push(parentLaterClause(block, name, voice, dateOfBirth, people))
  for (const [status, group] of grouped) {
    const combined = combinedLaterClause(status, group.length)
    if (combined) clauses.push(combined)
    else for (const block of group) clauses.push(parentLaterClause(block, name, voice, dateOfBirth, people))
  }
  return clauses
}

function laterSentences(
  role: "mother" | "father",
  blocks: RelationshipBlock[],
  answer: string,
  voice: ReportVoice,
  name: string,
  dateOfBirth: string | null,
  people: RelationshipRecord[]
): string[] {
  const verb = "has had"
  if (answer === "none") return [`${voice.Possessive} ${role} ${verb} no later relationships.`]
  const mine = blocks
    .filter((block) => block.kind === "parent_other" && block.parentSide === role)
    .sort((a, b) => a.startedOn.localeCompare(b.startedOn))
  if (mine.length === 0) return []
  const detailed = mine.filter((block) => !bareBlock(block))
  const bare = mine.length - detailed.length
  const counted = `${name}'s ${role} ${verb} ${countWord(mine.length)} later ${mine.length === 1 ? "relationship" : "relationships"}`
  if (detailed.length === 0) return [`${counted}.`]
  const clauses = laterClauses(detailed, name, voice, dateOfBirth, people)
  if (clauses.length === 1 && bare === 0 && clauses[0].startsWith("has ")) {
    return [`${name}'s ${role} ${clauses[0]}.`]
  }
  const pronoun = role === "mother" ? "she" : "he"
  if (mine.length === 1) return [`${voice.Possessive} ${role} ${clauses[0]}.`]
  const spoken = clauses.map((clause, index) =>
    index === 0 || clause.startsWith("has ") || clause.startsWith("re-partnered") ? `${pronoun} ${clause}` : clause
  )
  if (bare === 1) spoken.push("one other relationship")
  else if (bare > 1) spoken.push(`${countWord(bare)} other relationships`)
  return [`${counted}: ${joinProse(spoken)}.`]
}

/** 4.5 Biological parents, adoption, other care, then each parent's other relationships. */
export function parentsFromBlocks(
  name: string,
  voice: ReportVoice,
  dateOfBirth: string | null,
  blocks: RelationshipBlock[],
  people: RelationshipRecord[],
  answers: RelationshipBlockAnswers | undefined,
  asOf: string
): string | null {
  const sentences: string[] = []
  const biological = blocks.find((block) => block.kind === "biological_parents")
  if (biological) {
    const parents = members(biological, people, "parent").sort((a, b) => (parentRole(a) === "mother" ? 0 : 1) - (parentRole(b) === "mother" ? 0 : 1))
    parents.forEach((person, index) => {
      const owner = index === 0 ? `${name}'s` : voice.Possessive
      const line = parentLine(person, owner, name, dateOfBirth, asOf)
      if (line) sentences.push(line)
    })
    const bond = parentsBond(biological, voice, name, dateOfBirth)
    if (bond) sentences.push(bond)
  }
  const arrangements = blocks
    .filter((block) => block.kind === "caregiver_arrangement")
    .sort((a, b) => a.startedOn.localeCompare(b.startedOn))
  for (const block of arrangements) {
    if (block.arrangementType === "adoption") {
      const year = block.startedOn.trim() ? yearOf(precisionForPartialDate(parsePartialDate(block.startedOn)) ?? "", block.startedOn) : ""
      const age = block.startedOn.trim() ? ageOn(dateOfBirth, block.startedOn) : null
      if (year) sentences.push(`${name} was adopted in ${year}${age != null ? `, at the age of ${age}` : ""}.`)
      continue
    }
    const from = block.startedOn.trim() ? ageOn(dateOfBirth, block.startedOn) : null
    const until = block.endedOn.trim() ? ageOn(dateOfBirth, block.endedOn) : null
    const span =
      from != null && until != null ? `From the age of ${from} to ${until}` : from != null ? `From the age of ${from}` : until != null ? `Until the age of ${until}` : ""
    const caregivers = members(block, people, "caregiver")
    const caregiver = caregivers[0]
    let care = ""
    if (block.arrangementType === "foster_care") care = `${name} was in foster care`
    else if (block.arrangementType === "kinship_care") care = `${name} was in kinship care`
    else if (block.arrangementType === "residential") care = `${name} was in residential care`
    else {
      const detail =
        caregiver?.caregiverRelationshipDetail.trim() ||
        (caregiver?.blockRoleType ?? "").replaceAll("_", " ") ||
        (block.arrangementType === "grandparent_care" ? "grandparent" : "caregiver")
      const carer = caregiver?.givenName.trim() ? ` (${caregiver.givenName.trim()})` : ""
      care = `${name} was mainly cared for by ${voice.possessive} ${lowerKeepingTypedCase(detail)}${carer}`
    }
    if (span || care) sentences.push(`${span ? `${span}, ` : ""}${care}.`)
  }
  const recorded = answers ?? {
    previousRelationships: "",
    otherChildren: "",
    motherOtherRelationships: "",
    fatherOtherRelationships: "",
    caregiverArrangements: "",
  }
  sentences.push(...laterSentences("mother", blocks, recorded.motherOtherRelationships, voice, name, dateOfBirth, people))
  sentences.push(...laterSentences("father", blocks, recorded.fatherOtherRelationships, voice, name, dateOfBirth, people))
  return sentences.length > 0 ? sentences.join(" ") : null
}

function ordinalWord(value: number): string {
  const words = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth"]
  return words[value] ?? String(value)
}

function siblingGroupLabel(group: RelationshipRecord[], label: string): string {
  const sexes = new Set(group.map(siblingSex))
  if (sexes.size !== 1) return label
  const sex = [...sexes][0]
  if (sex !== "brother" && sex !== "sister") return label
  return label.replace(/sibling$/, sex)
}

function siblingSex(person: RelationshipRecord): string {
  const sex = sexWord(person.sex)
  if (sex === "female") return "sister"
  if (sex === "male") return "brother"
  return "sibling"
}

function siblingAge(person: RelationshipRecord, asOf: string): number | null {
  return person.dateOfBirth ? personAge(person.dateOfBirth, asOf) : null
}

function fullDetail(group: RelationshipRecord[], asOf: string): string {
  if (group.length === 0) return ""
  const sexes = new Set(group.map(siblingSex))
  const one = (person: RelationshipRecord) => {
    if (deceased(person) && siblingAge(person, asOf) == null) return `a ${siblingSex(person)} who has died`
    const age = siblingAge(person, asOf)
    return age == null ? `a ${siblingSex(person)}` : `a ${siblingSex(person)}, ${age}`
  }
  if (sexes.size !== 1 || group.length === 1) {
    if (group.length === 1) return one(group[0])
    if (group.length === 2) return `${one(group[0])} and ${one(group[1])}`
    return `${group.slice(0, -1).map(one).join(", ")}, and ${one(group[group.length - 1])}`
  }
  const sex = siblingSex(group[0])
  const plural = sex === "brother" ? "brothers" : sex === "sister" ? "sisters" : "siblings"
  const head = group.length === 2 ? `both ${plural}` : `all ${plural}`
  const aged = group.map((person) => siblingAge(person, asOf)).filter((age): age is number => age != null).sort((a, b) => b - a)
  const died = group.filter((person) => deceased(person) && siblingAge(person, asOf) == null)
  const bits: string[] = []
  if (aged.length === group.length) bits.push(`aged ${joinProse(aged.map(String))}`)
  else if (aged.length === 1) bits.push(`one aged ${aged[0]}`)
  else if (aged.length > 1) bits.push(`${countWord(aged.length)} aged ${joinProse(aged.map(String))}`)
  else if (died.length < group.length) bits.push("ages not recorded")
  if (died.length === 1) bits.push(died.length === group.length ? "who has died" : "one who has died")
  else if (died.length > 1) bits.push(died.length === group.length ? "who have died" : `${countWord(died.length)} who have died`)
  return bits.length > 0 ? `${head}, ${bits.join(", ")}` : head
}

/** 4.6 Siblings from every block. Side comes from the parent's block. */
export function siblingsFromBlocks(
  name: string,
  voice: ReportVoice,
  dateOfBirth: string | null,
  blocks: RelationshipBlock[],
  people: RelationshipRecord[],
  asOf: string
): string | null {
  const siblings = people.filter((person) => person.blockRole === "sibling")
  if (siblings.length === 0) return null
  const blockById = new Map(blocks.map((block) => [block.relationshipBlockId, block]))
  const full = siblings.filter((person) => {
    const block = person.relationshipBlockId ? blockById.get(person.relationshipBlockId) : undefined
    return block?.kind === "biological_parents" || person.blockRoleType === "full"
  })
  const adoptive = siblings.filter((person) => person.blockRoleType === "adoptive")
  const foster = siblings.filter((person) => person.blockRoleType === "foster")
  const other = siblings.filter((person) => person.blockRoleType === "other")
  const halves = siblings.filter((person) => person.blockRoleType === "half")
  const steps = siblings.filter((person) => person.blockRoleType === "step")
  const sentences: string[] = []
  const clientYears = dateOfBirth ? personAge(dateOfBirth, asOf) : null
  const orderPool = (adoptive.length > 0 && full.length === 0 ? adoptive : full).filter((person) => siblingAge(person, asOf) != null)
  const orderAll = adoptive.length > 0 && full.length === 0 ? adoptive : full
  const livingMissing = orderAll.some((person) => !deceased(person) && siblingAge(person, asOf) == null)
  if (clientYears != null && !livingMissing && orderPool.length > 0) {
    const older = orderPool.filter((person) => (siblingAge(person, asOf) ?? 0) > clientYears).length
    const place = older === 0 ? "the eldest" : older === orderPool.length ? "the youngest" : `the ${ordinalWord(older + 1)}`
    const family = adoptive.length > 0 && full.length === 0 ? "adoptive siblings" : "full siblings"
    sentences.push(`${name} is ${place} of ${voice.possessive} ${family}.`)
  }
  const bits: string[] = []
  const pushGroup = (group: RelationshipRecord[], label: string) => {
    if (group.length === 0) return
    const sexLabel = label.startsWith("full") ? label : siblingGroupLabel(group, label)
    const noun = `${countWord(group.length)} ${group.length === 1 ? sexLabel : sexLabel.endsWith("sibling") ? sexLabel.replace("sibling", "siblings") : sexLabel.endsWith("sister") ? sexLabel.replace(/sister$/, "sisters") : sexLabel.endsWith("brother") ? sexLabel.replace(/brother$/, "brothers") : `${sexLabel}s`}`
    const named = group.some((person) => person.givenName.trim()) ? peopleList(group, asOf, "and") : ""
    const detail = named ? "" : label.startsWith("full") || label.startsWith("adoptive sibling") ? fullDetail(group, asOf) : ""
    const ages = agesDescending(group, asOf)
    if (named) bits.push(`${noun} (${named})`)
    else if (detail) bits.push(`${noun} (${detail})`)
    else if (ages.length > 0) bits.push(`${noun} (${joinProse(ages.map(String))})`)
    else bits.push(noun)
  }
  pushGroup(full, full.length === 1 ? "full sibling" : "full sibling")
  const sideGroups = (rows: RelationshipRecord[], label: string) => {
    const buckets = new Map<string, RelationshipRecord[]>()
    for (const person of rows) {
      const block = person.relationshipBlockId ? blockById.get(person.relationshipBlockId) : undefined
      const side = block?.parentSide === "mother" ? "maternal" : block?.parentSide === "father" ? "paternal" : ""
      const key = side ? `${side} ${label}` : label
      buckets.set(key, [...(buckets.get(key) ?? []), person])
    }
    for (const [key, group] of buckets) pushGroup(group, key)
  }
  sideGroups(halves, "half-sibling")
  sideGroups(steps, "step-sibling")
  pushGroup(adoptive, "adoptive sibling")
  pushGroup(foster, "foster sibling")
  pushGroup(other, "other sibling")
  sentences.push(`${voice.Subject} ${agree(voice, "has", "have")} ${countWord(siblings.length)} ${siblings.length === 1 ? "sibling" : "siblings"} in total: ${joinProse(bits)}.`)
  const family = adoptive.length > 0 && full.length === 0 ? adoptive : full
  const brothers = family.filter((person) => siblingSex(person) === "brother")
  const sisters = family.filter((person) => siblingSex(person) === "sister")
  for (const group of [brothers, sisters]) {
    const sexName = group[0] ? siblingSex(group[0]) : ""
    const known = group
      .filter((person) => siblingAge(person, asOf) != null)
      .sort((a, b) => (siblingAge(b, asOf) ?? 0) - (siblingAge(a, asOf) ?? 0))
    const ordered = [...known]
    for (const person of group.filter(deceased)) {
      if (!ordered.some((row) => row.relationshipRecordId === person.relationshipRecordId)) ordered.push(person)
    }
    for (const person of group.filter(deceased)) {
      const age = person.dateOfDeath ? ageOn(dateOfBirth, person.dateOfDeath) : null
      const index = ordered.findIndex((row) => row.relationshipRecordId === person.relationshipRecordId)
      const place = person.givenName.trim() || !(index >= 0 && ordered.length > 1) ? "" : `${ordinalWord(index + 1)} `
      const called = person.givenName.trim() ? ` (${person.givenName.trim()})` : ""
      const when = age != null ? ` when ${name} was ${age}` : ""
      sentences.push(`${voice.Possessive} ${place}${sexName}${called} died${when}.`.replace(/\s{2,}/g, " "))
    }
  }
  return sentences.join(" ")
}

export function parentsSeparationMissingFromBlocks(blocks: RelationshipBlock[]): boolean {
  return blocks.some(
    (block) =>
      block.kind === "biological_parents" &&
      (block.status === "divorced" || block.status === "married_separated" || block.status === "defacto_separated") &&
      !block.endedOn.trim()
  )
}
