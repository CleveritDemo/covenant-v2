import React from 'react'
import type { WikiIngestOp, WikiPageType } from '@shared/wikiDoc'
import { useT } from '@i18n/useT'
import { Icon } from '../components/ui/Icon'
import './BrainstormWikiCard.css'

/** Sin anotar como `Record<_, string>`: `t` exige la clave literal. */
const WIKI_TYPE_KEY = {
  concept: 'tabs.wikiTypeConcept',
  decision: 'tabs.wikiTypeDecision',
  flow: 'tabs.wikiTypeFlow',
  reference: 'tabs.wikiTypeReference',
} as const satisfies Record<WikiPageType, string>

export interface BrainstormWikiCardProps {
  ops: WikiIngestOp[]
  /** Resumen que el propio turno dejó del cambio. */
  log?: string | null
  /** Abrir la página en el wiki; sin él las entradas no son pulsables. */
  onOpenPage?: (slug: string) => void
}

/**
 * Lo que un turno escribió en el wiki, como tarjeta.
 *
 * Antes esto era el JSON de las ops en mitad de la conversación —cientos de
 * caracteres de `{"ops":[{"op":"upsert"...` donde debía ir una frase—. Taparlo
 * a secas tampoco servía: la página se creaba y no quedaba rastro de que había
 * pasado algo.
 *
 * La tarjeta dice lo que sabe —qué páginas tocó y de qué tipo— y deja abrirlas.
 * No afirma que estén guardadas: eso lo decide el pipeline del CLI y aquí no
 * llega esa señal; abrir la página es la comprobación.
 */
export const BrainstormWikiCard: React.FC<BrainstormWikiCardProps> = ({
  ops,
  log,
  onOpenPage,
}) => {
  const { t } = useT()
  if (!ops.length) return null

  return (
    <aside className="brainstorm-wiki-card">
      <span className="brainstorm-wiki-card__head">
        <Icon name="book" size={12} aria-hidden />
        {t('tabs.brainstormWikiWrote', { count: String(ops.length) })}
      </span>

      <ul className="brainstorm-wiki-card__list">
        {ops.map(op => {
          const label = op.op === 'delete' ? op.slug : op.title
          const body = (
            <>
              <span className="brainstorm-wiki-card__kind">
                {op.op === 'delete'
                  ? t('tabs.brainstormWikiDeleted')
                  : t(WIKI_TYPE_KEY[op.type])}
              </span>
              <span className="brainstorm-wiki-card__title">{label}</span>
            </>
          )
          return (
            <li key={`${op.op}:${op.slug}`} className="brainstorm-wiki-card__item">
              {/* Borrada no se puede abrir: no hay página a la que ir. */}
              {onOpenPage && op.op !== 'delete' ? (
                <button
                  type="button"
                  className="brainstorm-wiki-card__open"
                  onClick={() => onOpenPage(op.slug)}
                >
                  {body}
                </button>
              ) : (
                <span className="brainstorm-wiki-card__open brainstorm-wiki-card__open--flat">
                  {body}
                </span>
              )}
            </li>
          )
        })}
      </ul>

      {log ? <p className="brainstorm-wiki-card__log">{log}</p> : null}
    </aside>
  )
}
