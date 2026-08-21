import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const appSource = readFileSync(join(here, '../App.tsx'), 'utf8')

const BOOT_BLOCK_START = 'let firstCloneError: string | null = null'
const BOOT_BLOCK_END = 'const snapshot = buildSessionSnapshot()'

function extractBootCloneBlock(source: string): string {
  const start = source.indexOf(BOOT_BLOCK_START)
  if (start === -1) {
    throw new Error(`Marcador de inicio del bloque de boot no encontrado: ${BOOT_BLOCK_START}`)
  }
  const end = source.indexOf(BOOT_BLOCK_END, start)
  if (end === -1) {
    throw new Error(`Marcador de fin del bloque de boot no encontrado: ${BOOT_BLOCK_END}`)
  }
  return source.slice(start, end)
}

describe('App boot org clone failure is quiet', () => {
  const bootBlock = extractBootCloneBlock(appSource)

  it('solo abre el modal en boot para missing-default-dir y missing-token', () => {
    expect(bootBlock).toContain("firstCloneError === 'missing-default-dir'")
    expect(bootBlock).toContain("firstCloneError === 'missing-token'")
    expect(bootBlock).toContain('{ missingFolder: true }')
    expect(bootBlock).toContain('{ missingToken: true }')
  })

  it('el bloque de boot no usa cloneFailure', () => {
    expect(bootBlock).not.toContain('cloneFailure')
  })

  it('los flujos iniciados por el humano siguen reportando cloneError y cloneFailure', () => {
    const humanCloneCalls = appSource.match(
      /setOrgWorkspaceRequirement\(\{ cloneError: res\.error, cloneFailure: res\.failure \}\)/g,
    )
    expect(humanCloneCalls?.length ?? 0).toBeGreaterThanOrEqual(3)
  })
})
