import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('PlaneMap wheel guard', () => {
  it('cede el wheel a overlays con data-plane-native-scroll', () => {
    const src = readFileSync(join(here, '../PlaneMap.tsx'), 'utf8')
    expect(src).toMatch(
      /closest\(\s*['"][^'"]*\[data-plane-native-scroll\]/,
    )
  })
})
