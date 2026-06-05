const PREVIOUS_URL_KEY_PREFIX = "battery-previous-url:"
const FORWARD_URL_KEY_PREFIX = "battery-forward-url:"

export function batteryPreviousUrlKey(token: string) {
  return `${PREVIOUS_URL_KEY_PREFIX}${token}`
}

export function batteryForwardUrlKey(token: string) {
  return `${FORWARD_URL_KEY_PREFIX}${token}`
}

export function readBatteryPreviousUrl(token: string): string | null {
  if (typeof window === "undefined") return null
  return sessionStorage.getItem(batteryPreviousUrlKey(token))
}

export function writeBatteryPreviousUrl(token: string, url: string) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(batteryPreviousUrlKey(token), url)
}

export function readBatteryForwardUrl(token: string): string | null {
  if (typeof window === "undefined") return null
  return sessionStorage.getItem(batteryForwardUrlKey(token))
}

export function writeBatteryForwardUrl(token: string, url: string) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(batteryForwardUrlKey(token), url)
}

export function extractTokenFromQuestionnairePath(path: string): string | null {
  const match = path.match(/^\/q\/([^?]+)/)
  if (!match?.[1]) return null
  return decodeURIComponent(match[1])
}

export function currentQuestionnaireUrl(): string {
  if (typeof window === "undefined") return ""
  return `${window.location.pathname}${window.location.search}`
}
