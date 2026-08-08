import { afterAll, describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { readInstalledPlugins } from '../pluginDirs'

describe('readInstalledPlugins', () => {
  const home = mkdtempSync(join(tmpdir(), 'plugin-test-'))

  afterAll(() => {
    rmSync(home, { recursive: true, force: true })
  })

  it('devuelve vacío si el archivo no existe', () => {
    const result = readInstalledPlugins(home)
    expect(result).toEqual([])
  })

  it('devuelve vacío si el JSON es inválido, sin lanzar', () => {
    mkdirSync(join(home, '.claude', 'plugins'), { recursive: true })
    writeFileSync(join(home, '.claude', 'plugins', 'installed_plugins.json'), '{ no soy json')
    const result = readInstalledPlugins(home)
    expect(result).toEqual([])
  })

  it('devuelve las entradas parseadas si el archivo es válido', () => {
    const validHome = mkdtempSync(join(tmpdir(), 'plugin-valid-'))
    mkdirSync(join(validHome, '.claude', 'plugins'), { recursive: true })
    writeFileSync(
      join(validHome, '.claude', 'plugins', 'installed_plugins.json'),
      JSON.stringify({
        version: 2,
        plugins: {
          'superpowers@claude-plugins-official': [{
            scope: 'user',
            installPath: '/home/u/.claude/plugins/cache/claude-plugins-official/superpowers/6.2.0',
            version: '6.2.0',
          }],
        },
      }),
    )
    const result = readInstalledPlugins(validHome)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      name: 'superpowers',
      marketplace: 'claude-plugins-official',
      installPath: '/home/u/.claude/plugins/cache/claude-plugins-official/superpowers/6.2.0',
      scope: 'user',
    })
    rmSync(validHome, { recursive: true, force: true })
  })
})
