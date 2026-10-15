"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"

export type SavePhase = "saved" | "saving" | "error"

export function AutosaveFields<T>({
  saved,
  save,
  onPhase,
  registerFlush,
  children,
}: {
  saved: T
  save: (value: T) => Promise<{ error?: string; value?: T }>
  onPhase: (phase: SavePhase, retry: (() => void) | null) => void
  registerFlush: (flush: () => Promise<void>) => () => void
  children: (value: T, onChange: (value: T) => void, commit: () => void) => ReactNode
}) {
  const [draft, setDraft] = useState(saved)
  const draftRef = useRef(saved)
  const lastSaved = useRef(JSON.stringify(saved))
  const timer = useRef<number | null>(null)
  const token = useRef(0)
  const inflight = useRef<Promise<void> | null>(null)
  const saveRef = useRef(save)
  const phaseRef = useRef(onPhase)
  const rootRef = useRef<HTMLDivElement>(null)
  saveRef.current = save
  phaseRef.current = onPhase

  const runSave = useCallback(async () => {
    const payload = draftRef.current
    const serialized = JSON.stringify(payload)
    if (serialized === lastSaved.current) return
    const current = ++token.current
    phaseRef.current("saving", null)
    const work = (async () => {
      const result = await saveRef.current(payload)
      if (current !== token.current) return
      if (result.error) {
        phaseRef.current("error", () => {
          lastSaved.current = ""
          void runSave()
        })
        return
      }
      const next = result.value ?? payload
      const stillCurrent = JSON.stringify(draftRef.current) === serialized
      lastSaved.current = JSON.stringify(next)
      if (result.value !== undefined && stillCurrent) {
        draftRef.current = result.value
        setDraft(result.value)
      }
      phaseRef.current("saved", null)
    })()
    inflight.current = work
    try {
      await work
    } finally {
      if (inflight.current === work) inflight.current = null
    }
  }, [])

  const schedule = useCallback(() => {
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = null
      void runSave()
    }, 350)
  }, [runSave])

  const update = useCallback((next: T) => {
    draftRef.current = next
    setDraft(next)
  }, [])

  useEffect(() => {
    const node = rootRef.current
    if (!node) return
    function onChange() {
      window.setTimeout(() => schedule(), 0)
    }
    node.addEventListener("change", onChange)
    return () => node.removeEventListener("change", onChange)
  }, [schedule])

  useEffect(() => {
    async function flush() {
      if (timer.current != null) {
        window.clearTimeout(timer.current)
        timer.current = null
        await runSave()
      }
      if (inflight.current) await inflight.current
    }
    return registerFlush(flush)
  }, [registerFlush, runSave])

  useEffect(() => {
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current)
    }
  }, [])

  return (
    <div ref={rootRef} className="space-y-4">
      {children(draft, update, schedule)}
    </div>
  )
}
