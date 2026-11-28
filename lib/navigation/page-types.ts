/**
 * Page types and NV-2 parent rules (design guide section 13).
 */

export const PAGE_TYPES = [
  "home",
  "main-list",
  "entity",
  "sub-list",
  "section",
  "record",
  "record-form",
  "guided-form",
] as const

export type PageType = (typeof PAGE_TYPES)[number]

/** Forms are never a parent (NV-2). */
export const NEVER_PARENT_TYPES: ReadonlySet<PageType> = new Set([
  "record-form",
  "guided-form",
])

export type FormMode = "new" | "edit"

/**
 * NV-2: default parent type(s) and also-allowed parent types.
 * Record-form rules differ for New vs Edit (formMode).
 */
export type ParentRule = {
  /** Types that may be the default parent. Empty = no back arrow. */
  defaultParentTypes: readonly PageType[]
  /** Extra types allowed as remembered parents (beyond defaults). */
  alsoAllowed: readonly PageType[]
}

const ENTITY_RULE: ParentRule = {
  defaultParentTypes: ["main-list"],
  // Entity→entity (NV-2): e.g. professional ↔ organisation, professional → referred client.
  alsoAllowed: ["home", "main-list", "record", "entity"],
}

const SUB_LIST_RULE: ParentRule = {
  defaultParentTypes: ["entity"],
  alsoAllowed: [],
}

const SECTION_RULE: ParentRule = {
  defaultParentTypes: ["entity", "sub-list"],
  alsoAllowed: ["record"],
}

const RECORD_RULE: ParentRule = {
  // Client records default to their Sub-list; practice-wide settings/funding
  // records default to their Main list (13B).
  defaultParentTypes: ["sub-list", "main-list"],
  alsoAllowed: [
    "entity",
    "section",
    "record",
    "main-list",
    "home",
  ],
}

const RECORD_FORM_EDIT_RULE: ParentRule = {
  defaultParentTypes: ["record", "entity"],
  alsoAllowed: [],
}

/** New form: default is the list it adds to; also any parent the created record allows. */
const RECORD_FORM_NEW_RULE: ParentRule = {
  defaultParentTypes: [
    "sub-list",
    "main-list",
    "entity",
    "record",
  ],
  alsoAllowed: [
    "entity",
    "section",
    "record",
    "main-list",
    "home",
    "sub-list",
  ],
}

const GUIDED_FORM_RULE: ParentRule = {
  defaultParentTypes: ["section", "sub-list"],
  alsoAllowed: ["record"],
}

const NO_PARENT_RULE: ParentRule = {
  defaultParentTypes: [],
  alsoAllowed: [],
}

export function parentRuleFor(
  type: PageType,
  options?: { formMode?: FormMode; menuEntity?: boolean }
): ParentRule {
  if (type === "home" || type === "main-list") return NO_PARENT_RULE
  if (type === "entity" && options?.menuEntity) return NO_PARENT_RULE
  if (type === "entity") return ENTITY_RULE
  if (type === "sub-list") return SUB_LIST_RULE
  if (type === "section") return SECTION_RULE
  if (type === "record") return RECORD_RULE
  if (type === "record-form") {
    return options?.formMode === "edit"
      ? RECORD_FORM_EDIT_RULE
      : RECORD_FORM_NEW_RULE
  }
  if (type === "guided-form") return GUIDED_FORM_RULE
  return NO_PARENT_RULE
}

/** True if openerType may be a remembered parent of the destination (NV-2 / NV-3). */
export function isAllowedParentType(
  destinationType: PageType,
  openerType: PageType,
  options?: { formMode?: FormMode; menuEntity?: boolean }
): boolean {
  if (NEVER_PARENT_TYPES.has(openerType)) return false
  const rule = parentRuleFor(destinationType, options)
  if (rule.defaultParentTypes.length === 0 && rule.alsoAllowed.length === 0) {
    return false
  }
  return (
    rule.defaultParentTypes.includes(openerType) ||
    rule.alsoAllowed.includes(openerType)
  )
}

/**
 * NV-7: links into pages with no back arrow are always allowed
 * (Home, Main lists, Practice details, Practitioner profile).
 */
export function isAlwaysAllowedLinkDestination(
  type: PageType,
  options?: { menuEntity?: boolean }
): boolean {
  return !hasBackArrow(type, options)
}

/**
 * NV-7 link check: destination must allow the source as a parent (NV-2),
 * except links into pages with no back arrow (always allowed).
 */
export function isAllowedLink(
  destinationType: PageType,
  sourceType: PageType,
  destinationOptions?: { formMode?: FormMode; menuEntity?: boolean }
): boolean {
  if (isAlwaysAllowedLinkDestination(destinationType, destinationOptions)) {
    return true
  }
  return isAllowedParentType(destinationType, sourceType, destinationOptions)
}

export function hasBackArrow(
  type: PageType,
  options?: { menuEntity?: boolean }
): boolean {
  if (type === "home" || type === "main-list") return false
  if (type === "entity" && options?.menuEntity) return false
  return true
}
