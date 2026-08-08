import { describe, expect, it } from 'vitest'
import { parseInstalledPlugins, resolvePluginDirs } from '../installedPlugins'

/** Forma real de ~/.claude/plugins/installed_plugins.json (version 2). */
const raw = {
  version: 2,
  plugins: {
    'superpowers@claude-plugins-official': [{
      scope: 'user',
      installPath: '/home/u/.claude/plugins/cache/claude-plugins-official/superpowers/6.2.0',
      version: '6.2.0',
    }],
    'frontend-design@claude-code-plugins': [{
      scope: 'user',
      installPath: '/home/u/.claude/plugins/cache/claude-code-plugins/frontend-design/1.1.0',
      version: '1.1.0',
    }],
  },
}

describe('parseInstalledPlugins', () => {
  it('parte la clave en nombre y marketplace', () => {
    const list = parseInstalledPlugins(raw)
    expect(list).toHaveLength(2)
    expect(list[0]).toMatchObject({
      name: 'superpowers',
      marketplace: 'claude-plugins-official',
      scope: 'user',
    })
  })

  it('tolera basura sin lanzar', () => {
    expect(parseInstalledPlugins(null)).toEqual([])
    expect(parseInstalledPlugins({ plugins: 'no' })).toEqual([])
    expect(parseInstalledPlugins({ plugins: { 'sinArroba': [{ installPath: '/x' }] } })).toEqual([])
    expect(parseInstalledPlugins({ plugins: { 'a@b': [{ scope: 'user' }] } })).toEqual([])
  })
})

describe('resolvePluginDirs', () => {
  const installed = parseInstalledPlugins(raw)

  it('devuelve la ruta del namespace pedido', () => {
    expect(resolvePluginDirs(['superpowers'], installed))
      .toEqual(['/home/u/.claude/plugins/cache/claude-plugins-official/superpowers/6.2.0'])
  })

  it('ignora namespaces que no están instalados, sin lanzar', () => {
    expect(resolvePluginDirs(['ponytail'], installed)).toEqual([])
  })

  it('conserva el orden pedido y no duplica', () => {
    expect(resolvePluginDirs(['frontend-design', 'superpowers', 'frontend-design'], installed))
      .toEqual([
        '/home/u/.claude/plugins/cache/claude-code-plugins/frontend-design/1.1.0',
        '/home/u/.claude/plugins/cache/claude-plugins-official/superpowers/6.2.0',
      ])
  })

  it('lista vacía devuelve vacío', () => {
    expect(resolvePluginDirs([], installed)).toEqual([])
  })
})
