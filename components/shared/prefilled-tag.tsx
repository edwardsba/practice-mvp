export function PrefilledTag({ className }: { className?: string }) {
  return (
    <span className={className ?? "ml-2 align-middle text-xs font-normal text-amber-800"}>
      Pre-filled
    </span>
  )
}
