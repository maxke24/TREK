#!/usr/bin/env node
/**
 * Fails when production source gains a bare `/api` or `/uploads` literal.
 *
 * Those work on the web and fail silently in the Android shell, where the page
 * is served from https://localhost and a relative path resolves to the local
 * asset server instead of the TREK backend. Route new paths through
 * src/api/origin.ts instead.
 *
 * A literal already wrapped in apiUrl(...) is fine, so it's stripped out before
 * matching — `apiUrl('/api/health')` does not trip this check the way a bare
 * `'/api/health'` would.
 *
 * A literal that must legitimately stay relative — e.g. it's compared against
 * a value the server itself produced, rather than used to build a request —
 * can opt out with a trailing `// relative-ok` comment giving a short reason.
 * Use it sparingly: it silences the whole line, not just the one match.
 */
import { readFileSync, globSync } from 'node:fs'
import path from 'node:path'

const files = globSync('src/**/*.{ts,tsx}', { cwd: process.cwd() })
  .filter(f => !f.includes('.test.'))
  .filter(f => f !== path.join('src', 'api', 'origin.ts'))

const WRAPPED = /apiUrl\(\s*(['"`])(?:(?!\1).)*\1/g
const pattern = /['"`]\/(api|uploads)[/'"`]/
const offenders = []

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (/\/\/\s*relative-ok/.test(line)) return
    const stripped = line.replace(WRAPPED, '')
    if (pattern.test(stripped)) offenders.push(`${file}:${i + 1}: ${line.trim()}`)
  })
}

if (offenders.length) {
  console.error('Absolute server paths must go through apiUrl() in src/api/origin.ts:\n')
  console.error(offenders.join('\n'))
  process.exit(1)
}
console.log(`check-absolute-urls: clean (${files.length} files)`)
