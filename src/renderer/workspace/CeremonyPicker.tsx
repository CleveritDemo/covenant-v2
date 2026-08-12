import React, { useMemo, useState } from 'react'
import {
  CEREMONY_STAGES,
  ceremoniesByStage,
  sanitizeCeremonyId,
  type AgileCeremony,
  type CeremonyId,
  type CeremonyStage,
} from '@shared/agileCeremonies'
import { useT } from '@i18n/useT'
import { Icon, Input, ChoiceCard } from '../components/ui'
import { CEREMONY_GOAL_KEY, CEREMONY_STAGE_KEY } from './ceremonyLabels'
import './CeremonyPicker.css'

export interface CeremonyPickerProps {
  value: CeremonyId
  onChange: (id: CeremonyId) => void
  autoFocus?: boolean
}

/**
 * Paso 1 de una sala nueva: qué ceremonia es. Las tarjetas van agrupadas por
 * etapa del pipeline (descubrimiento → alineación → especificación → entrega)
 * porque la posición en el pipeline es lo que decide la elección; con once
 * opciones un filtro por etapa sobraría.
 */
export const CeremonyPicker: React.FC<CeremonyPickerProps> = ({
  value,
  onChange,
  autoFocus = false,
}) => {
  const { t } = useT()
  const [query, setQuery] = useState('')
  const selected = sanitizeCeremonyId(value)

  const goalOf = (ceremony: AgileCeremony): string => t(CEREMONY_GOAL_KEY[ceremony.id])

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matches = (ceremony: AgileCeremony): boolean => {
      if (!needle) return true
      return [ceremony.name, goalOf(ceremony), ...ceremony.deliverables]
        .some(text => text.toLowerCase().includes(needle))
    }
    return CEREMONY_STAGES
      .map(stage => ({ stage, items: ceremoniesByStage(stage).filter(matches) }))
      .filter(group => group.items.length > 0)
    // goalOf depende de `t`, que es estable por render de i18n.
  }, [query, t])

  return (
    <div className="ceremony-picker">
      <p className="ceremony-picker__hint">{t('tabs.ceremonyPickHint')}</p>
      <div className="ceremony-picker__search">
        <Icon name="search" size={14} aria-hidden />
        <Input
          size="sm"
          variant="inline"
          value={query}
          autoFocus={autoFocus}
          placeholder={t('tabs.ceremonySearchPlaceholder')}
          aria-label={t('tabs.ceremonySearchPlaceholder')}
          onChange={event => setQuery(event.target.value)}
        />
      </div>
      {groups.length === 0 ? (
        <p className="ceremony-picker__empty">{t('tabs.ceremonyFilterEmpty')}</p>
      ) : (
        <div className="ceremony-picker__groups" role="radiogroup" aria-label={t('tabs.ceremonyLabel')}>
          {groups.map(group => (
            <section key={group.stage} className="ceremony-picker__group">
              <h4 className="ceremony-picker__stage">{t(CEREMONY_STAGE_KEY[group.stage])}</h4>
              <ul className="ceremony-picker__list">
                {group.items.map(ceremony => (
                  <li
                    key={ceremony.id}
                    className={`ceremony-picker__item ceremony-picker__item--${group.stage as CeremonyStage}`}
                  >
                    <ChoiceCard
                      role="radio"
                      aria-checked={ceremony.id === selected}
                      selected={ceremony.id === selected}
                      onClick={() => onChange(ceremony.id)}
                    >
                      {/* Nombre + objetivo y nada más: los entregables son 7
                          tokens en las ceremonias grandes y descuadraban la
                          rejilla. Se ven enteros en el paso del brief. */}
                      <span className="ceremony-picker__card">
                        <span className="ceremony-picker__name">
                          {ceremony.name}
                          {ceremony.gate?.blocking ? (
                            <span className="ceremony-picker__gate">
                              {t('tabs.ceremonyGateBlocking')}
                            </span>
                          ) : null}
                        </span>
                        <span className="ceremony-picker__goal">{goalOf(ceremony)}</span>
                      </span>
                    </ChoiceCard>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
