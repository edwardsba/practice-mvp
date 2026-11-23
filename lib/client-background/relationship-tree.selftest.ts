import assert from "node:assert/strict"

import { NEW_CURRENT_RELATIONSHIP, NEW_PREVIOUS_RELATIONSHIP, siblingTypesForBlock } from "@/lib/client-background/relationship-blocks"
import { emptyBlockAnswers } from "@/lib/client-background/types"
import { buildRelationshipTree, moveTargets, type RelationshipTreeNode } from "@/lib/client-background/relationship-tree"
import { tomBlocks, tomExampleSource, tomRelationships, TOM_REPORT_DATE } from "@/lib/reports/tom-example-fixture"
import type { RelationshipBlock } from "@/lib/client-background/types"

assert.deepEqual(siblingTypesForBlock("biological_parents"), ["full", "adopted"])

const clientId = "0a546f0c-a164-46a1-a766-47f36216a229"
const source = tomExampleSource()
const decoy = {
  ...tomRelationships()[0],
  relationshipRecordId: clientId,
  givenName: "Tom",
  relationshipBlockId: "tom-bio",
  blockRole: "sibling" as const,
  blockRoleType: "full",
  dateOfBirth: "1970-03-12",
}
const tree = buildRelationshipTree({
  blocks: tomBlocks(),
  relationships: [...tomRelationships(), decoy],
  blockAnswers: source.data.blockAnswers ?? emptyBlockAnswers(),
  dateOfBirth: source.dateOfBirth,
  asOf: TOM_REPORT_DATE,
  clientId,
  relationshipStatus: source.data.relationshipStatus,
})

function shape(node: RelationshipTreeNode): unknown {
  if (node.kind === "person") return node.children.length > 0 ? { line: node.line, children: node.children.map(shape) } : node.line
  if (node.kind === "note") return node.text
  if (node.kind === "group") return { label: node.label, empty: node.empty, children: node.children.map(shape) }
  if (node.kind === "section") return { title: node.title, children: node.children.map(shape) }
  return { heading: node.heading, meta: node.meta, children: node.children.map(shape), interactive: node.interactive }
}

assert.equal(tree.partners.title, "Intimate relationships and children")
assert.equal(tree.parents.title, "Primary caregivers and siblings")

assert.deepEqual(tree.partners.children.map(shape), [
  {
    title: "Current intimate relationship and children",
    children: [
      {
        heading: "Married",
        meta: "since 2014 · 12 years",
        children: [
          {
            line: "Jordan · wife · 49",
            children: [
              "Henry · son · 9 · biological",
              "Lily · daughter · 7 · biological",
              "Max · son · 6 · adopted",
              "Sam · son · 14 · step-child (Jordan's)",
            ],
          },
        ],
        interactive: undefined,
      },
    ],
  },
  {
    title: "Previous intimate relationships and children",
    children: [
      {
        heading: "De facto, separated",
        meta: "2005–2011 · 6 years",
        children: [{ line: "Pam · woman · 47", children: ["No children"] }],
        interactive: undefined,
      },
      {
        heading: "Divorced",
        meta: "1998–2003 · 5 years",
        children: [{ line: "Kim · woman · 52", children: ["Ella · daughter · 25 · biological"] }],
        interactive: undefined,
      },
    ],
  },
])

assert.deepEqual(tree.parents.children.map(shape), [
  {
    title: "Biological parents",
    children: [
      {
        heading: "Divorced",
        meta: "1965–1978 · client aged 8",
        children: [
          "Sally · mother · 76",
          {
            line: "John · father · died 1998 (client 28)",
            children: [
              "Harry · brother · 58 · full",
              "Ann · sister · 52 · full",
              "Michael · brother · died 1989 (client 19) · full",
            ],
          },
        ],
        interactive: undefined,
      },
    ],
  },
  {
    title: "Mother (Sally) · other relationships",
    children: [
      {
        heading: "De facto · current",
        meta: "since 2010 · from client aged 40",
        children: [{ line: "Larry · step-father · 70", children: ["No siblings"] }],
        interactive: undefined,
      },
      {
        heading: "Divorced",
        meta: "1981–1990 · client aged 11 to 20",
        children: [
          {
            line: "Phil · step-father · 76",
            children: ["Bob · brother · 45 · step", "Rose · sister · 40 · half"],
          },
        ],
        interactive: undefined,
      },
    ],
  },
  {
    title: "Father (John) · other relationships",
    children: ["None"],
  },
  {
    title: "Other caregiver arrangements",
    children: [
      {
        heading: "Grandparent care",
        meta: "1978–1982 · client aged 8 to 12",
        children: [{ line: "Joan · maternal grandmother", children: ["No siblings"] }],
        interactive: undefined,
      },
    ],
  },
])

function people(nodes: RelationshipTreeNode[]): Extract<RelationshipTreeNode, { kind: "person" }>[] {
  return nodes.flatMap((node) => {
    if (node.kind === "person") return [node, ...people(node.children)]
    if (node.kind === "block" || node.kind === "group" || node.kind === "section") return people(node.children)
    return []
  })
}

const listed = people([...tree.partners.children, ...tree.parents.children])
assert.equal(
  listed.some((person) => person.id === clientId || person.name === "Tom" || person.line.startsWith("Tom ")),
  false
)
const siblings = listed.filter((person) => person.line.includes("· full") || person.line.includes("· half") || person.line.includes("· step"))
const biological = siblings.filter((person) => person.context === "Biological parents").map((person) => person.line)
assert.deepEqual(biological, ["Harry · brother · 58 · full", "Ann · sister · 52 · full", "Michael · brother · died 1989 (client 19) · full"])

function assertNoGroupLabels(nodes: RelationshipTreeNode[]) {
  for (const node of nodes) {
    assert.notEqual(node.kind, "group")
    if (node.kind === "person" || node.kind === "block" || node.kind === "section") assertNoGroupLabels(node.children)
  }
}
assertNoGroupLabels([...tree.partners.children, ...tree.parents.children])
assert.deepEqual(
  tree.parents.children.map((node) => (node.kind === "section" ? node.title : "")),
  [
    "Biological parents",
    "Mother (Sally) · other relationships",
    "Father (John) · other relationships",
    "Other caregiver arrangements",
  ]
)

const sally = tomRelationships().find((person) => person.givenName === "Sally")
const sallyTargets = moveTargets(tomBlocks(), sally?.relationshipBlockId ?? null, tomRelationships()).map((item) => item.id)
assert.deepEqual(sallyTargets, [
  "tom-current",
  "tom-pam",
  "tom-kim",
  "tom-larry",
  "tom-phil",
  "tom-joan",
  NEW_PREVIOUS_RELATIONSHIP,
])
assert.equal(sallyTargets.includes(NEW_CURRENT_RELATIONSHIP), false)
assert.equal(sallyTargets.includes("tom-bio"), false)

const sample = tomBlocks()[0]
const widerBlocks = [
  ...tomBlocks(),
  { ...sample, relationshipBlockId: "tom-other", kind: "client_other_children" as const, status: "", statusDetail: "IVF with a donor", startedOn: "", endedOn: "" },
  {
    ...sample,
    relationshipBlockId: "tom-father",
    kind: "parent_other" as const,
    parentSide: "father" as const,
    parentRecordId: "tom-john",
    status: "divorced",
    startedOn: "1975",
    endedOn: "1980",
  },
]
const wider = moveTargets(widerBlocks, null, tomRelationships()).map((item) => item.id)
assert.deepEqual(wider, [
  "tom-current",
  "tom-pam",
  "tom-kim",
  "tom-other",
  "tom-bio",
  "tom-larry",
  "tom-phil",
  "tom-father",
  "tom-joan",
  NEW_PREVIOUS_RELATIONSHIP,
])
assert.equal(wider.includes(NEW_CURRENT_RELATIONSHIP), false)

const widerLabels = moveTargets(widerBlocks, null, tomRelationships()).map((item) => item.label)
assert.equal(widerLabels[0], "Current · Married")
assert.equal(widerLabels[1], "Previous · De facto, separated (Pam)")
assert.equal(widerLabels[2], "Previous · Divorced (Kim)")
assert.equal(widerLabels[3], "Other children · IVF with a donor")

// Single client with no current block → client's status label
const singleTree = buildRelationshipTree({
  blocks: [],
  relationships: [],
  blockAnswers: emptyBlockAnswers(),
  dateOfBirth: null,
  asOf: TOM_REPORT_DATE,
  relationshipStatus: { relationshipStatus: "single", relationshipStatusOther: "" },
})
const currentSection = singleTree.partners.children[0]
assert.equal(currentSection?.kind, "section")
if (currentSection?.kind === "section") {
  assert.equal(currentSection.title, "Current intimate relationship and children")
  assert.deepEqual(currentSection.children.map(shape), [
    { heading: "Single", meta: "", children: [], interactive: false },
  ])
}

// Current block with empty status
const emptyStatusBlock: RelationshipBlock = {
  ...tomBlocks()[0],
  relationshipBlockId: "empty-status",
  status: "",
  childrenAnswer: "not_asked",
}
const emptyStatusTree = buildRelationshipTree({
  blocks: [emptyStatusBlock],
  relationships: [],
  blockAnswers: emptyBlockAnswers(),
  dateOfBirth: null,
  asOf: TOM_REPORT_DATE,
})
const emptyCurrent = emptyStatusTree.partners.children[0]
assert.equal(emptyCurrent?.kind, "section")
if (emptyCurrent?.kind === "section") {
  assert.equal((emptyCurrent.children[0] as { heading: string }).heading, "Status not recorded")
}

// Other children with description / blank
function otherBlock(detail: string): RelationshipBlock {
  return {
    ...tomBlocks()[0],
    relationshipBlockId: "other-1",
    kind: "client_other_children",
    status: "",
    statusDetail: detail,
    startedOn: "",
    childrenAnswer: "yes",
  }
}
const otherDescribed = buildRelationshipTree({
  blocks: [otherBlock("Sole adoption")],
  relationships: [],
  blockAnswers: { ...emptyBlockAnswers(), otherChildren: "yes" },
  dateOfBirth: null,
  asOf: TOM_REPORT_DATE,
})
const otherSection = otherDescribed.partners.children.find((node) => node.kind === "section" && node.title === "Other children")
assert.ok(otherSection && otherSection.kind === "section")
if (otherSection?.kind === "section") {
  assert.equal((otherSection.children[0] as { heading: string }).heading, "Sole adoption")
}

const otherBlank = buildRelationshipTree({
  blocks: [otherBlock("")],
  relationships: [],
  blockAnswers: { ...emptyBlockAnswers(), otherChildren: "yes" },
  dateOfBirth: null,
  asOf: TOM_REPORT_DATE,
})
const blankSection = otherBlank.partners.children.find((node) => node.kind === "section" && node.title === "Other children")
assert.ok(blankSection && blankSection.kind === "section")
if (blankSection?.kind === "section") {
  assert.equal((blankSection.children[0] as { heading: string }).heading, "Unrecorded relationship")
}

// Previous hidden when empty and not answered
const noPrevious = buildRelationshipTree({
  blocks: [],
  relationships: [],
  blockAnswers: { ...emptyBlockAnswers(), previousRelationships: "" },
  dateOfBirth: null,
  asOf: TOM_REPORT_DATE,
  relationshipStatus: { relationshipStatus: "single", relationshipStatusOther: "" },
})
assert.equal(
  noPrevious.partners.children.some((node) => node.kind === "section" && node.title === "Previous intimate relationships and children"),
  false
)

console.log("relationship tree selftest passed")
