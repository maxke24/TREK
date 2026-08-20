import { render, screen, waitFor } from '@testing-library/react'
import { AuthedPhoto } from './AuthedPhoto'
import { fetchImageAsBlob } from '../../api/authUrl'

vi.mock('../../api/authUrl', () => ({
  fetchImageAsBlob: vi.fn(),
}))

describe('AuthedPhoto', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.mocked(fetchImageAsBlob).mockReset()
  })

  it('renders a plain <img> and never calls fetchImageAsBlob on the web build (no-op)', () => {
    vi.stubEnv('VITE_TREK_ORIGIN', '')
    render(<AuthedPhoto src="/api/photos/1/thumbnail" alt="a photo" />)
    const img = screen.getByAltText('a photo') as HTMLImageElement
    expect(img.src).toContain('/api/photos/1/thumbnail')
    expect(fetchImageAsBlob).not.toHaveBeenCalled()
  })

  it('fetches a blob and swaps the src in the native shell build', async () => {
    vi.stubEnv('VITE_TREK_ORIGIN', 'https://trek.example.test')
    vi.mocked(fetchImageAsBlob).mockResolvedValue('blob:https://localhost/abc-123')
    render(<AuthedPhoto src="https://trek.example.test/api/photos/1/thumbnail" alt="a photo" />)

    await waitFor(() => expect(screen.getByAltText('a photo')).toBeTruthy())
    const img = screen.getByAltText('a photo') as HTMLImageElement
    expect(img.src).toBe('blob:https://localhost/abc-123')
    expect(fetchImageAsBlob).toHaveBeenCalledWith('https://trek.example.test/api/photos/1/thumbnail')
  })

  it('falls back to fallbackSrc when the primary blob fetch fails', async () => {
    vi.stubEnv('VITE_TREK_ORIGIN', 'https://trek.example.test')
    vi.mocked(fetchImageAsBlob)
      .mockResolvedValueOnce('') // thumbnail fetch fails
      .mockResolvedValueOnce('blob:https://localhost/original-456')
    render(
      <AuthedPhoto
        src="https://trek.example.test/api/photos/1/thumbnail"
        fallbackSrc="https://trek.example.test/api/photos/1/original"
        alt="a photo"
      />
    )

    await waitFor(() => expect(screen.getByAltText('a photo')).toBeTruthy())
    expect(fetchImageAsBlob).toHaveBeenNthCalledWith(1, 'https://trek.example.test/api/photos/1/thumbnail')
    expect(fetchImageAsBlob).toHaveBeenNthCalledWith(2, 'https://trek.example.test/api/photos/1/original')
    const img = screen.getByAltText('a photo') as HTMLImageElement
    expect(img.src).toBe('blob:https://localhost/original-456')
  })

  it('renders nothing until the blob resolves in the native shell build', () => {
    vi.stubEnv('VITE_TREK_ORIGIN', 'https://trek.example.test')
    vi.mocked(fetchImageAsBlob).mockReturnValue(new Promise(() => {})) // never resolves
    render(<AuthedPhoto src="https://trek.example.test/api/photos/1/thumbnail" alt="a photo" />)
    expect(screen.queryByAltText('a photo')).toBeNull()
  })
})
