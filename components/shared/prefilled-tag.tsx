import { attentionPrefilledTagClass } from "@/lib/ui/status-colours"

export function PrefilledTag({ className }: { className?: string }) {
  return <span className={className ?? attentionPrefilledTagClass}>Pre-filled</span>
}
