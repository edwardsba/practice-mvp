export function buildCrisisPlanFilename(
  versionNumber: number,
  lastName: string,
  firstName: string
): string {
  const today = new Date().toISOString().slice(0, 10)
  return `${today}_Confidential_Crisis_Plan_v${versionNumber}_${lastName}_${firstName?.[0] ?? ""}.pdf`
}
