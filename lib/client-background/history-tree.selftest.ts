import assert from "node:assert/strict"

import { buildHistoryTree, type HistoryTreeNode } from "@/lib/client-background/history-tree"
import { tomEvents, tomRelationships, tomScreening } from "@/lib/reports/tom-example-fixture"
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
})

function shape(node: HistoryTreeNode): unknown {
  if (node.kind === "note") return node.text
  if (node.kind === "row") return node.children.length > 0 ? { line: node.line, children: node.children.map(shape) } : node.line
  if (node.kind === "band") return { heading: node.heading, meta: node.meta, children: node.children.map(shape) }
  return { title: node.title, children: node.children.map(shape) }
}

assert.deepEqual(tree.client.children.map(shape), [
  {
    title: "Mental health",
    children: [
      {
        heading: "Depression · current",
        meta: "2 episodes · 2000–2002, and since 2025",
        children: [
          {
            line: "Current episode · since 2025 · from age 55",
            children: ["Medication · sertraline · since 2025 · ongoing · Dr Harry TestDoc, GP"],
          },
          {
            line: "Episode · 2000–2002 · age 30 to 32",
            children: [
              "Hospital admission · psychiatric inpatient · 2001 · age 31 · 2 weeks",
              "Therapy · psychologist · 2001–2002 · age 31 to 32",
            ],
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
        meta: "1988–2000 · age 18 to 30",
        children: ["Residential rehab · 2000 · age 30"],
      },
    ],
  },
  {
    title: "Physical health",
    children: [
      {
        heading: "Broken leg",
        meta: "1982 · age 12",
        children: ["No treatment recorded"],
      },
    ],
  },
  { title: "Self-harm", children: ["Cutting · 1984–1986 · age 14 to 16"] },
  { title: "Traumatic events", children: ["Serious car accident · 1989 · age 19"] },
  { title: "Other significant events", children: ["Moved interstate · 1985 · age 15"] },
])

assert.deepEqual(tree.family.children.map(shape), [
  {
    title: "Mother (Sally)",
    children: [
      {
        heading: "Depression · emotional problems",
        meta: "",
        children: ["No treatment recorded"],
      },
    ],
  },
  {
    title: "Father (John, deceased)",
    children: [
      {
        heading: "Alcohol · substance use",
        meta: "",
        children: ["No treatment recorded"],
      },
    ],
  },
  {
    title: "Close friend",
    children: [
      {
        heading: "Alcohol · substance use",
        meta: "",
        children: ["No treatment recorded"],
      },
    ],
  },
])

console.log("history tree selftest passed")
