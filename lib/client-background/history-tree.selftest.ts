import assert from "node:assert/strict"

import { buildHistoryTree, type HistoryTreeNode } from "@/lib/client-background/history-tree"
import { tomEvents, tomIssues, tomRelationships, tomScreening } from "@/lib/reports/tom-example-fixture"
import type { ProfessionalOption } from "@/lib/client-background/professionals"

const professionals: ProfessionalOption[] = [
  {
    professionalId: "tom-prescriber",
    title: "Dr",
    firstName: "Harry",
    lastName: "TestDoc",
    professionName: "GP",
  },
]

const tree = buildHistoryTree({
  events: tomEvents(),
  relationships: tomRelationships(),
  dateOfBirth: "1970-03-12",
  screening: tomScreening(),
  professionals,
  issues: tomIssues(),
})

function shape(node: HistoryTreeNode): unknown {
  if (node.kind === "note") return node.text
  if (node.kind === "actions") return { actions: true, issueId: node.issueId }
  if (node.kind === "row") {
    const body =
      node.children.length > 0
        ? { line: node.line, tag: node.tag, children: node.children.map(shape) }
        : { line: node.line, tag: node.tag }
    return body
  }
  if (node.kind === "band") {
    return {
      heading: node.heading,
      meta: node.meta,
      treatmentAnswer: node.treatmentAnswer,
      children: node.children.map(shape),
    }
  }
  return { title: node.title, children: node.children.map(shape) }
}

assert.deepEqual(tree.client.children.map(shape), [
  {
    title: "Mental health",
    children: [
      {
        heading: "Depression",
        meta: "2000 – ongoing · 2 episodes",
        treatmentAnswer: "yes",
        children: [
          { line: "Episode 1 · 2000–2002 · age 30 to 32", tag: "Episode" },
          { line: "Hospital admission · psychiatric inpatient · 2001 · 2 weeks", tag: "Treatment" },
          { line: "Therapy · psychologist · 2001–2002", tag: "Treatment" },
          { line: "Episode 2 · since 2025 · from age 55", tag: "Episode" },
          {
            line: "Medication · sertraline · since 2025 · ongoing · Dr Harry TestDoc, GP",
            tag: "Treatment",
          },
        ],
      },
    ],
  },
  {
    title: "Substance use",
    children: [
      {
        heading: "Alcohol",
        meta: "1988 – 2000",
        treatmentAnswer: "yes",
        children: [
          { line: "Episode 1 · 1988–2000 · age 18 to 30", tag: "Episode" },
          { line: "Residential rehab · 2000", tag: "Treatment" },
        ],
      },
    ],
  },
  {
    title: "Physical health",
    children: [
      {
        heading: "Broken leg",
        meta: "1982",
        treatmentAnswer: "not_asked",
        children: [{ line: "Episode 1 · 1982 · age 12", tag: "Episode" }],
      },
    ],
  },
  {
    title: "Self-harm",
    children: [{ line: "Cutting · 1984–1986 · age 14 to 16", tag: undefined }],
  },
  {
    title: "Traumatic events",
    children: [{ line: "Serious car accident · 1989 · age 19", tag: undefined }],
  },
  {
    title: "Other significant events",
    children: [{ line: "Moved interstate · 1985 · age 15", tag: undefined }],
  },
  {
    title: "Other treatment not linked to an issue",
    children: ["None"],
  },
])

assert.deepEqual(tree.family.children.map(shape), [
  {
    title: "Mental health",
    children: [
      {
        heading: "Depression · Sally (mother)",
        meta: "",
        treatmentAnswer: "not_asked",
        children: [{ line: "Episode 1", tag: "Episode" }],
      },
    ],
  },
  {
    title: "Substance use",
    children: [
      {
        heading: "Alcohol · John (father)",
        meta: "",
        treatmentAnswer: "none",
        children: [{ line: "Episode 1", tag: "Episode" }],
      },
      {
        heading: "Alcohol · close friend",
        meta: "",
        treatmentAnswer: "none",
        children: [{ line: "Episode 1", tag: "Episode" }],
      },
    ],
  },
  { title: "Physical health", children: ["None"] },
  { title: "Self-harm", children: ["None"] },
  { title: "Significant events", children: ["None"] },
])

console.log("history tree selftest passed")
