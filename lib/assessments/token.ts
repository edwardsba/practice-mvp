import { createHash } from "crypto"

export function hashAssessmentToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex")
}
