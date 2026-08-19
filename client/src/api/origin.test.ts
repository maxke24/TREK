import { describe, it, expect, vi, afterEach } from 'vitest'
import { apiOrigin, apiUrl, wsUrl } from './origin'

/**
 * The web build must stay relative — a regression here would break every
 * deployment that is not the Android shell, silently, by making requests
 * absolute to the wrong host.
 */
describe('api origin', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('is empty when VITE_TREK_ORIGIN is unset', () => {
    vi.stubEnv('VITE_TREK_ORIGIN', '')
    expect(apiOrigin()).toBe('')
    expect(apiUrl('/api/health')).toBe('/api/health')
  })

  it('prefixes paths when an origin is configured', () => {
    vi.stubEnv('VITE_TREK_ORIGIN', 'https://trek.example.test')
    expect(apiUrl('/api/health')).toBe('https://trek.example.test/api/health')
  })

  it('strips a trailing slash so paths never double up', () => {
    vi.stubEnv('VITE_TREK_ORIGIN', 'https://trek.example.test/')
    expect(apiUrl('/api/health')).toBe('https://trek.example.test/api/health')
  })

  it('derives a wss url from an https origin', () => {
    vi.stubEnv('VITE_TREK_ORIGIN', 'https://trek.example.test')
    expect(wsUrl('abc')).toBe('wss://trek.example.test/ws?token=abc')
  })

  it('falls back to the page location when no origin is configured', () => {
    vi.stubEnv('VITE_TREK_ORIGIN', '')
    expect(wsUrl('abc')).toBe(`ws://${location.host}/ws?token=abc`)
  })
})
