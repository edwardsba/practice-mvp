import { config } from "dotenv"

import { createDiagnosticBatteryInstance } from "@/lib/assessments/create-diagnostic-battery-instance"

config({ path: ".env.local" })

async function main() {
  const clientId = process.argv[2]
  const practiceId = process.argv[3]
  const practitionerProfileId = process.argv[4]

  if (!clientId || !practiceId || !practitionerProfileId) {
    console.error(
      "Usage: npx tsx db/test-create-diagnostic-battery.ts <clientId> <practiceId> <practitionerProfileId>"
    )
    process.exit(1)
  }

  const result = await createDiagnosticBatteryInstance({
    clientId,
    practiceId,
    practitionerProfileId,
  })

  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error("Test battery creation failed:", error)
  process.exit(1)
})
