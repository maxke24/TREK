import { useEffect, useState } from 'react'
import { fetchImageAsBlob } from '../api/authUrl'
import { apiOrigin, resolveServerUrl } from '../api/origin'

/**
 * Resolves an auth-gated server image (a server-produced photo path — see
 * the callers) to a URL a browser can actually load in the Android shell,
 * and shares the fetch + object-URL lifecycle logic between every
 * React-component consumer that needs one:
 *
 *  - `<AuthedPhoto>` (Journey/Memories photos, and the Places sidebar photo
 *    circle — `PlaceAvatar`)
 *  - `MapView`'s per-place `MemoMarker` (a real React component, one
 *    instance per Leaflet marker, so it can call this hook directly)
 *
 * `MapViewGL`'s markers are plain DOM elements built once per reconcile pass
 * by an imperative effect, not React components — a hook can't be called
 * inside that loop (rules of hooks), so it manages its own small blob cache
 * instead, calling `fetchImageAsBlob()` directly (see the comment next to
 * that cache for why the shape has to differ there).
 *
 * `src` may be relative or already absolute — resolved internally via
 * `resolveServerUrl()`, so callers don't need to remember to wrap it
 * themselves. On the web build (`apiOrigin()` empty) this is a synchronous
 * passthrough: returns `src` unchanged, no fetch, no async work at all —
 * nothing here may start doing async blob work in the browser, where a
 * plain relative `src` already works.
 *
 * On the native shell build, fetches `src` (and, on failure, `fallbackSrc`)
 * as a blob and returns the resulting object URL once ready (`undefined`
 * while pending, `null` if both fetches failed). The object URL is revoked
 * automatically when `src`/`fallbackSrc` changes or the caller unmounts.
 */
export function useAuthedPhotoUrl(src: string | null | undefined, fallbackSrc?: string | null): string | null | undefined {
  const needsBlob = !!apiOrigin() && !!src
  const [resolved, setResolved] = useState<string | null | undefined>(needsBlob ? undefined : (src ?? null))

  useEffect(() => {
    if (!needsBlob || !src) {
      setResolved(src ?? null)
      return
    }
    let cancelled = false
    let created = ''
    setResolved(undefined)
    ;(async () => {
      let url = await fetchImageAsBlob(resolveServerUrl(src))
      if (!url && fallbackSrc) url = await fetchImageAsBlob(resolveServerUrl(fallbackSrc))
      if (cancelled) {
        if (url) URL.revokeObjectURL(url)
        return
      }
      created = url
      setResolved(url || null)
    })()
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [needsBlob, src, fallbackSrc])

  return resolved
}
