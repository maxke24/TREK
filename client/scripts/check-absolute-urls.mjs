#!/usr/bin/env node
/**
 * Fails when production source gains a bare `/api` or `/uploads` literal.
 *
 * Those work on the web and fail silently in the Android shell, where the page
 * is served from https://localhost and a relative path resolves to the local
 * asset server instead of the TREK backend. Route new paths through
 * src/api/origin.ts instead.
 */
import { readFileSync, globSync } from 'node:fs'
import path from 'node:path'

const files = globSync('src/**/*.{ts,tsx}', { cwd: process.cwd() })
  .filter(f => !f.includes('.test.'))
  .filter(f => f !== path.join('src', 'api', 'origin.ts'))

const pattern = /['"`]\/(api|uploads)[/'"`]/
const offenders = []

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (pattern.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim()}`)
  })
}

if (offenders.length) {
  console.error('Absolute server paths must go through apiUrl() in src/api/origin.ts:\n')
  console.error(offenders.join('\n'))
  process.exit(1)
}
console.log(`check-absolute-urls: clean (${files.length} files)`)
