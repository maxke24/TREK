import { renderHook, waitFor } from '@testing-library/react'
import { useAuthedPhotoUrl } from './useAuthedPhotoUrl'
import { fetchImageAsBlob } from '../api/authUrl'

vi.mock('../api/authUrl', () => ({
  fetchImageAsBlob: vi.fn(),
}))

describe('useAuthedPhotoUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.mocked(fetchImageAsBlob).mockReset()
  })

  it('web build: returns src unchanged synchronously, no fetch', () => {
    vi.stubEnv('VITE_TREK_ORIGIN', '')
    const { result } = renderHook(() => useAuthedPhotoUrl('/api/maps/place-photo/abc/bytes'))
    expect(result.current).toBe('/api/maps/place-photo/abc/bytes')
    expect(fetchImageAsBlob).not.toHaveBeenCalled()
  })

  it('web build: null/undefined src passes through without a fetch', () => {
    vi.stubEnv('VITE_TREK_ORIGIN', '')
    const { result } = renderHook(() => useAuthedPhotoUrl(null))
    expect(result.current).toBeNull()
    expect(fetchImageAsBlob).not.toHaveBeenCalled()
  })

  it('native build: resolves src against apiOrigin() and returns the blob url', async () => {
    vi.stubEnv('VITE_TREK_ORIGIN', 'https://trek.example.test')
    vi.mocked(fetchImageAsBlob).mockResolvedValue('blob:https://localhost/abc')
    const { result } = renderHook(() => useAuthedPhotoUrl('/api/maps/place-photo/abc/bytes'))

    expect(result.current).toBeUndefined() // pending
    await waitFor(() => expect(result.current).toBe('blob:https://localhost/abc'))
    expect(fetchImageAsBlob).toHaveBeenCalledWith('https://trek.example.test/api/maps/place-photo/abc/bytes')
  })

  it('native build: falls back to fallbackSrc when the primary fetch fails', async () => {
    vi.stubEnv('VITE_TREK_ORIGIN', 'https://trek.example.test')
    vi.mocked(fetchImageAsBlob)
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('blob:https://localhost/fallback')
    const { result } = renderHook(() => useAuthedPhotoUrl('/api/photos/1/thumbnail', '/api/photos/1/original'))

    await waitFor(() => expect(result.current).toBe('blob:https://localhost/fallback'))
    expect(fetchImageAsBlob).toHaveBeenNthCalledWith(1, 'https://trek.example.test/api/photos/1/thumbnail')
    expect(fetchImageAsBlob).toHaveBeenNthCalledWith(2, 'https://trek.example.test/api/photos/1/original')
  })

  it('native build: revokes the object URL when src changes', async () => {
    vi.stubEnv('VITE_TREK_ORIGIN', 'https://trek.example.test')
    vi.mocked(fetchImageAsBlob).mockResolvedValueOnce('blob:https://localhost/first')
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const { result, rerender } = renderHook(({ src }) => useAuthedPhotoUrl(src), {
      initialProps: { src: '/api/maps/place-photo/first/bytes' },
    })
    await waitFor(() => expect(result.current).toBe('blob:https://localhost/first'))

    vi.mocked(fetchImageAsBlob).mockResolvedValueOnce('blob:https://localhost/second')
    rerender({ src: '/api/maps/place-photo/second/bytes' })
    await waitFor(() => expect(result.current).toBe('blob:https://localhost/second'))

    expect(revokeSpy).toHaveBeenCalledWith('blob:https://localhost/first')
    revokeSpy.mockRestore()
  })

  it('native build: revokes the object URL on unmount', async () => {
    vi.stubEnv('VITE_TREK_ORIGIN', 'https://trek.example.test')
    vi.mocked(fetchImageAsBlob).mockResolvedValueOnce('blob:https://localhost/first')
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const { result, unmount } = renderHook(() => useAuthedPhotoUrl('/api/maps/place-photo/first/bytes'))
    await waitFor(() => expect(result.current).toBe('blob:https://localhost/first'))

    unmount()
    expect(revokeSpy).toHaveBeenCalledWith('blob:https://localhost/first')
    revokeSpy.mockRestore()
  })
})
