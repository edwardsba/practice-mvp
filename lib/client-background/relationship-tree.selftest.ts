import assert from "node:assert/strict"

import { NEW_CURRENT_RELATIONSHIP, NEW_PREVIOUS_RELATIONSHIP, siblingTypesForBlock } from "@/lib/client-background/relationship-blocks"
import { emptyBlockAnswers } from "@/lib/client-background/types"
import { buildRelationshipTree, moveTargets, type RelationshipTreeNode } from "@/lib/client-background/relationship-tree"
import { tomBlocks, tomExampleSource, tomRelationships, TOM_REPORT_DATE } from "@/lib/reports/tom-example-fixture"

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
})

function shape(node: RelationshipTreeNode): unknown {
  if (node.kind === "person") return node.children.length > 0 ? { line: node.line, children: node.children.map(shape) } : node.line
  if (node.kind === "note") return node.text
  if (node.kind === "group") return { label: node.label, empty: node.empty, children: node.children.map(shape) }
  if (node.kind === "section") return { title: node.title, children: node.children.map(shape) }
  return { heading: node.heading, meta: node.meta, children: node.children.map(shape) }
}

assert.deepEqual(tree.partners.children.map(shape), [
  {
    heading: "Current relationship · Married",
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
  },
  {
    heading: "Previous · De facto, separated",
    meta: "2005–2011 · 6 years",
    children: [{ line: "Pam · woman · 47", children: ["No children"] }],
  },
  {
    heading: "Previous · Divorced",
    meta: "1998–2003 · 5 years",
    children: [{ line: "Kim · woman · 52", children: ["Ella · daughter · 25 · biological"] }],
  },
  "Other children: none",
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
        children: ["Joan · maternal grandmother"],
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
const sallyTargets = moveTargets(tomBlocks(), sally?.relationshipBlockId ?? null).map((item) => item.id)
assert.deepEqual(sallyTargets, [
  "tom-current",
  "tom-pam",
  "tom-kim",
  "tom-phil",
  "tom-larry",
  "tom-joan",
  NEW_CURRENT_RELATIONSHIP,
  NEW_PREVIOUS_RELATIONSHIP,
])
assert.equal(sallyTargets.includes("tom-bio"), false)

const sample = tomBlocks()[0]
const wider = moveTargets(
  [
    ...tomBlocks(),
    { ...sample, relationshipBlockId: "tom-other", kind: "client_other_children", status: "", startedOn: "", endedOn: "" },
    { ...sample, relationshipBlockId: "tom-father", kind: "parent_other", parentSide: "father", parentRecordId: "tom-john", status: "divorced", startedOn: "1975", endedOn: "1980" },
  ],
  null
).map((item) => item.id)
assert.deepEqual(wider, [
  "tom-current",
  "tom-pam",
  "tom-kim",
  "tom-other",
  "tom-bio",
  "tom-phil",
  "tom-larry",
  "tom-father",
  "tom-joan",
  NEW_CURRENT_RELATIONSHIP,
  NEW_PREVIOUS_RELATIONSHIP,
])

console.log("relationship tree selftest passed")
