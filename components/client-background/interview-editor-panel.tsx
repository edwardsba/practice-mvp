"use client"

import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"

/**
 * Shared interview editor shell: opens under the item list; Done flushes then closes.
 */
export function InterviewEditorPanel({
  onDone,
  children,
}: {
  onDone: () => void | Promise<void>
  children: ReactNode
}) {
  return (
    <div className="space-y-3 rounded-md border border-dashed px-3 py-3">
      {children}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => {
            void Promise.resolve(onDone())
          }}
        >
          Done
        </Button>
      </div>
    </div>
  )
}
