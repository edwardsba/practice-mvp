export type MseQuestion = {
  elementId: string
  elementKey: string
  questionText: string
  groupLabel: string | null
  subgroupLabel: string | null
  options: { value: string; label: string; isDefaultSelection: boolean }[]
}

export type MseQuestionGroup = {
  groupLabel: string
  subgroups: {
    subgroupLabel: string | null
    questions: MseQuestion[]
  }[]
}

export function groupMseQuestions(questions: MseQuestion[]): MseQuestionGroup[] {
  const groups: MseQuestionGroup[] = []
  const groupIndex = new Map<string, number>()

  for (const question of questions) {
    const groupLabel = question.groupLabel ?? "Other"
    let group = groups[groupIndex.get(groupLabel) ?? -1]
    if (!group) {
      group = { groupLabel, subgroups: [] }
      groupIndex.set(groupLabel, groups.length)
      groups.push(group)
    }

    const subgroupKey = question.subgroupLabel
    let subgroup = group.subgroups.find((s) => s.subgroupLabel === subgroupKey)
    if (!subgroup) {
      subgroup = { subgroupLabel: subgroupKey, questions: [] }
      group.subgroups.push(subgroup)
    }
    subgroup.questions.push(question)
  }

  return groups
}
