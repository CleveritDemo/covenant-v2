#!/usr/bin/env node
/**
 * Falla si algún componente del UI kit expone className/style en su API pública.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const uiDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/renderer/components/ui')
const files = fs.readdirSync(uiDir).filter(f => f.endsWith('.tsx'))
const violations = []

for (const file of files) {
  const text = fs.readFileSync(path.join(uiDir, file), 'utf8')
  if (/interface \w+Props[\s\S]*?\bclassName\?\s*:/.test(text)) {
    violations.push(`${file}: public className prop`)
  }
  if (/interface \w+Props[\s\S]*?\bstyle\?\s*:/.test(text)) {
    violations.push(`${file}: public style prop`)
  }
}

if (violations.length) {
  console.error('UI contract violations:\n' + violations.map(v => `  - ${v}`).join('\n'))
  process.exit(1)
}
console.log('UI contract OK (%d files)', files.length)
