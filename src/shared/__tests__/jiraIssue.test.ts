import { describe, expect, it } from 'vitest'
import { isSnapshotStale, normalizeIssueKey, parseIssueKeys } from '../jiraIssue'

describe('normalizeIssueKey', () => {
  it('mayúsculas y sin espacios', () => {
    expect(normalizeIssueKey('  grav-412 ')).toBe('GRAV-412')
  })

  it('lo que no es una clave devuelve cadena vacía', () => {
    expect(normalizeIssueKey('no soy una clave')).toBe('')
    expect(normalizeIssueKey('GRAV-')).toBe('')
    expect(normalizeIssueKey('-412')).toBe('')
  })
})

describe('parseIssueKeys', () => {
  const keys = ['GRAV', 'COV']

  it('encuentra las claves de los proyectos declarados', () => {
    const text = 'arregla GRAV-412 y revisa cov-7 antes del release'
    expect(parseIssueKeys(text, keys)).toEqual(['GRAV-412', 'COV-7'])
  })

  it('ignora prefijos que no están declarados: ese es el filtro que evita falsos positivos', () => {
    const text = 'usa UTF-8, mira CVE-2023-30533 y el SHA-256 del bundle'
    expect(parseIssueKeys(text, keys)).toEqual([])
  })

  it('sin projectKeys no hay disparador', () => {
    expect(parseIssueKeys('GRAV-412', [])).toEqual([])
  })

  it('deduplica conservando el primer orden de aparición', () => {
    expect(parseIssueKeys('GRAV-412 y otra vez GRAV-412 y COV-1', keys))
      .toEqual(['GRAV-412', 'COV-1'])
  })

  it('no parte una clave dentro de una palabra ni de una URL', () => {
    expect(parseIssueKeys('XGRAV-412 y foo/GRAV-412x', keys)).toEqual([])
  })

  it('sí la reconoce dentro de una URL de Jira', () => {
    expect(parseIssueKeys('https://x.atlassian.net/browse/GRAV-412', keys)).toEqual(['GRAV-412'])
  })
})

describe('isSnapshotStale', () => {
  const now = 1_000_000

  it('un archivo recién escrito no está vencido', () => {
    expect(isSnapshotStale(now - 60_000, 900, now)).toBe(false)
  })

  it('pasado refreshSeconds sí lo está', () => {
    expect(isSnapshotStale(now - 901_000, 900, now)).toBe(true)
  })

  it('sin archivo (mtime 0) siempre está vencido', () => {
    expect(isSnapshotStale(0, 900, now)).toBe(true)
  })

  it('refreshSeconds 0 desactiva el refresco automático', () => {
    expect(isSnapshotStale(now - 10_000_000, 0, now)).toBe(false)
  })
})
