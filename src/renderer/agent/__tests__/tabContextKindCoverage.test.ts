import { describe, expect, it } from 'vitest'
import { ALL_CONTEXT_KINDS } from '@shared/tabContext'
import { defaultIconForKind } from '@shared/tabContextAppearance'
import en from '@i18n/locales/en'
import es from '@i18n/locales/es'
import { KIND_ICONS } from '../tabContextKindIcons'

function kindLabel(
  locale: { tabContexts: Record<string, unknown> },
  kind: string,
): unknown {
  return locale.tabContexts[`kind_${kind}`]
}

describe('cobertura de kinds de contexto', () => {
  it('cada kind tiene glifo, i18n y icono por defecto', () => {
    for (const kind of ALL_CONTEXT_KINDS) {
      const icon = KIND_ICONS[kind]
      expect(icon, `KIND_ICONS[${kind}]`).toBeDefined()
      expect(icon, `KIND_ICONS[${kind}]`).not.toBeUndefined()

      const esLabel = kindLabel(es, kind)
      expect(typeof esLabel, `es tabContexts.kind_${kind}`).toBe('string')
      expect(String(esLabel).length, `es tabContexts.kind_${kind}`).toBeGreaterThan(0)

      const enLabel = kindLabel(en, kind)
      expect(typeof enLabel, `en tabContexts.kind_${kind}`).toBe('string')
      expect(String(enLabel).length, `en tabContexts.kind_${kind}`).toBeGreaterThan(0)

      expect(defaultIconForKind(kind), `KIND_DEFAULT_ICON[${kind}]`).toBeDefined()
    }
  })
})
