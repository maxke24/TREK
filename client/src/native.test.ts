import { describe, it, expect } from 'vitest'
import { saveAndOpen } from './native'

describe('saveAndOpen', () => {
  it('declines on web so the caller keeps its anchor download', async () => {
    expect('Capacitor' in window).toBe(false)
    expect(await saveAndOpen('trip.ics', new Blob(['x']))).toBe(false)
  })
})
