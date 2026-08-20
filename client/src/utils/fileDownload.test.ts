import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { downloadFile } from './fileDownload'
import { isEffectivelyOffline } from '../sync/networkMode'
import { getCachedBlob } from '../db/offlineDb'

vi.mock('../sync/networkMode', () => ({ isEffectivelyOffline: vi.fn(() => false) }))
vi.mock('../db/offlineDb', () => ({ getCachedBlob: vi.fn(() => Promise.resolve(null)) }))

/**
 * assertRelativeUrl() exists so credentials: 'include' never ships the
 * session cookie to an attacker-controlled host. It's exercised indirectly
 * through downloadFile(), the exported entry point — a regression here would
 * either break every attachment download in the Android shell (too strict)
 * or open a cookie-exfiltration hole (too loose).
 */
describe('fileDownload assertRelativeUrl (via downloadFile)', () => {
  const originalFetch = global.fetch
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  beforeEach(() => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['x'])) } as Response)
    )
    URL.createObjectURL = vi.fn(() => 'blob:mock')
    URL.revokeObjectURL = vi.fn()
    vi.mocked(isEffectivelyOffline).mockReturnValue(false)
    vi.mocked(getCachedBlob).mockResolvedValue(null)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    global.fetch = originalFetch
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  })

  it('web build (no origin): a relative path is fetched as-is, unchanged', async () => {
    vi.stubEnv('VITE_TREK_ORIGIN', '')
    await downloadFile('/api/files/1/download')
    expect(global.fetch).toHaveBeenCalledWith('/api/files/1/download', { credentials: 'include' })
  })

  it('web build: still rejects a protocol-relative //host escape', async () => {
    vi.stubEnv('VITE_TREK_ORIGIN', '')
    await expect(downloadFile('//evil.example.com/x')).rejects.toThrow(/non-relative/)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('web build: still rejects a backslash /\\ escape', async () => {
    vi.stubEnv('VITE_TREK_ORIGIN', '')
    await expect(downloadFile('/\\evil.example.com/x')).rejects.toThrow(/non-relative/)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('web build: still rejects an arbitrary absolute URL', async () => {
    vi.stubEnv('VITE_TREK_ORIGIN', '')
    await expect(downloadFile('https://evil.example.com/x')).rejects.toThrow(/non-relative/)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('Android shell build: a relative path is resolved against apiOrigin() and fetched absolute', async () => {
    vi.stubEnv('VITE_TREK_ORIGIN', 'https://trek.example.test')
    await downloadFile('/api/files/1/download')
    expect(global.fetch).toHaveBeenCalledWith('https://trek.example.test/api/files/1/download', { credentials: 'include' })
  })

  it('Android shell build: still rejects an unrelated absolute origin', async () => {
    vi.stubEnv('VITE_TREK_ORIGIN', 'https://trek.example.test')
    await expect(downloadFile('https://evil.example.com/x')).rejects.toThrow(/non-relative/)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('Android shell build: still rejects a lookalike host that merely starts with the trusted origin', async () => {
    vi.stubEnv('VITE_TREK_ORIGIN', 'https://trek.example.test')
    await expect(downloadFile('https://trek.example.test.evil.com/x')).rejects.toThrow(/non-relative/)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('Android shell build: a leading // in the input is neutralized by resolution, not a host escape', async () => {
    // resolveServerUrl() string-concats apiOrigin() + value here (value still
    // starts with '/'), producing "https://trek.example.test//evil.../x" — a
    // URL that already has a scheme and host, so the leading "//" is just a
    // same-origin path segment, not a new authority the way a bare "//host"
    // would be interpreted when handed to fetch() with no scheme at all.
    vi.stubEnv('VITE_TREK_ORIGIN', 'https://trek.example.test')
    await downloadFile('//evil.example.com/x')
    expect(global.fetch).toHaveBeenCalledWith('https://trek.example.test//evil.example.com/x', { credentials: 'include' })
  })
})
