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

/**
 * Turns an app-absolute path into a fully qualified URL, even on a web build
 * where `apiOrigin()` is empty. Falls back to the page's own origin, so
 * callers that need an absolute URL regardless of build configuration (a
 * `webcal://` link, an image `src` inside a printed/exported document) get
 * one instead of the empty-string prefix `apiUrl()` would produce.
 *
 * Unlike `apiUrl()`, this is never left relative — that's the point of it.
 */
export function absoluteUrl(path: string): string {
  const origin = apiOrigin() || window.location.origin
  return `${origin}${path.startsWith('/') ? '' : '/'}${path}`
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
