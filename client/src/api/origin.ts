/**
 * Where the TREK server lives, as a build-time constant.
 *
 * Empty on every web build, which keeps every request app-relative exactly as
 * before. The Android shell serves its bundle from https://localhost, so it
 * builds with VITE_TREK_ORIGIN set and the same code emits absolute URLs.
 */
export function apiOrigin(): string {
  return (import.meta.env.VITE_TREK_ORIGIN ?? '').replace(/\/$/, '')
}

/** Prefixes an app-absolute path such as `/api/health` or `/uploads/x.png`. */
export function apiUrl(path: string): string {
  return `${apiOrigin()}${path}`
}

/** Full websocket URL. Falls back to the page's own host on web builds. */
export function wsUrl(token: string): string {
  const origin = apiOrigin()
  if (!origin) {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
    return `${protocol}://${location.host}/ws?token=${token}`
  }
  return `${origin.replace(/^http/, 'ws')}/ws?token=${token}`
}
