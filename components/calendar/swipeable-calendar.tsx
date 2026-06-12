"use client"

import { useRouter } from "next/navigation"
import { useRef, type ReactNode } from "react"

import {
  buildCalendarUrl,
  shiftAnchorDate,
  type CalendarView,
} from "@/lib/calendar/dates"

const SWIPE_THRESHOLD_PX = 50

export function SwipeableCalendar({
  view,
  anchorDate,
  children,
}: {
  view: CalendarView
  anchorDate: string
  children: ReactNode
}) {
  const router = useRouter()
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return

    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    const deltaY = e.changedTouches[0].clientY - touchStartY.current

    if (
      Math.abs(deltaX) > SWIPE_THRESHOLD_PX &&
      Math.abs(deltaX) > Math.abs(deltaY) * 1.5
    ) {
      const direction = deltaX > 0 ? -1 : 1
      const newDate = shiftAnchorDate(anchorDate, view, direction)
      router.push(buildCalendarUrl(view, newDate))
    }

    touchStartX.current = null
    touchStartY.current = null
  }

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {children}
    </div>
  )
}
