import { useEffect, useState } from 'react'
import { fetchImageAsBlob } from '../../api/authUrl'
import { apiOrigin } from '../../api/origin'

/**
 * Renders an auth-gated server image (photos, memories-provider assets — see
 * the callers) that a plain `<img src>` cannot load in the Android shell.
 *
 * The shell serves the bundle from `https://localhost` and talks to the real
 * TREK origin, so once `src` is absolutized the image request is cross-site.
 * `trek_session` is `SameSite=Lax`, so a browser withholds it on a cross-site
 * `<img>` fetch and the server answers 403 — even though the URL is correct.
 * `CapacitorHttp` patches `fetch()`, not `<img>`, so routing the request
 * through `fetchImageAsBlob()` (`fetch(src, { credentials: 'include' })`)
 * carries the cookie from the native jar instead, then hands the image back
 * as a blob object URL.
 *
 * `src` must already be resolved by the caller (`apiUrl()` /
 * `resolveServerUrl()`). On the web build `apiOrigin()` is empty and the
 * request is same-origin, so this renders a plain `<img>` — no blob fetch, no
 * behaviour change: same native lazy-loading/caching, same `onError` handling
 * as before this component existed.
 *
 * `fallbackSrc`, when given, is tried (also via blob fetch) if the primary
 * fetch fails — the native-build equivalent of an `onError` src swap, since a
 * blob URL that loaded successfully essentially never fires `onError`.
 */
export function AuthedPhoto({ src, fallbackSrc, onError, ...imgProps }: {
  src: string
  fallbackSrc?: string
  onError?: React.ReactEventHandler<HTMLImageElement>
} & Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'onError' | 'src'>) {
  const needsBlob = !!apiOrigin()
  const [blobSrc, setBlobSrc] = useState('')

  useEffect(() => {
    if (!needsBlob) return
    let cancelled = false
    let created = ''
    setBlobSrc('')
    ;(async () => {
      let url = await fetchImageAsBlob(src)
      if (!url && fallbackSrc) url = await fetchImageAsBlob(fallbackSrc)
      if (cancelled) {
        if (url) URL.revokeObjectURL(url)
        return
      }
      created = url
      setBlobSrc(url)
    })()
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [needsBlob, src, fallbackSrc])

  if (!needsBlob) return <img src={src} onError={onError} {...imgProps} />
  return blobSrc ? <img src={blobSrc} {...imgProps} /> : null
}
