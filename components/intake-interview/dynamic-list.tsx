"use client"

import { useMemo, type ReactNode } from "react"

function trailingBlankItems<T>(
  items: T[],
  createEmpty: () => T,
  isEmpty: (item: T) => boolean
): T[] {
  if (items.length === 0) return [createEmpty()]
  const last = items[items.length - 1]
  if (isEmpty(last)) return items
  return [...items, createEmpty()]
}

function withGeneratedId<T>(item: T): T {
  if (item && typeof item === "object" && "id" in item) {
    const record = item as T & { id: string }
    if (!record.id) {
      return { ...record, id: crypto.randomUUID() }
    }
  }
  return item
}

export function DynamicList<T>({
  items,
  onChange,
  createEmpty,
  isEmpty,
  renderRow,
}: {
  items: T[]
  onChange: (items: T[]) => void
  createEmpty: () => T
  isEmpty: (item: T) => boolean
  renderRow: (
    item: T,
    index: number,
    update: (patch: T) => void
  ) => ReactNode
}) {
  const visible = useMemo(
    () => trailingBlankItems(items, createEmpty, isEmpty),
    [items, createEmpty, isEmpty]
  )

  function updateAt(index: number, next: T) {
    const stamped = isEmpty(next) ? next : withGeneratedId(next)
    const copy = visible.map((item, i) => (i === index ? stamped : item))
    const withoutTrailingEmpty = isEmpty(copy[copy.length - 1])
      ? copy.slice(0, -1)
      : copy
    onChange(
      withoutTrailingEmpty.filter((item, i, all) => {
        if (i === all.length - 1) return true
        return !isEmpty(item)
      })
    )
  }

  return (
    <div className="space-y-3">
      {visible.map((item, index) => (
        <div key={index}>{renderRow(item, index, (next) => updateAt(index, next))}</div>
      ))}
    </div>
  )
}
