import React from 'react'
import {
  AGENT_MONOGRAM_MAX_LENGTH,
  AGENT_NAME_MAX_LENGTH,
  AGENT_OBJECTIVE_MAX_LENGTH,
  AGENT_ROLE_MAX_LENGTH,
  sanitizeAgentRulesEnabledDraft,
  type AgentIdentityDraft,
} from '@shared/agentIdentity'
import { agentMonogram } from '@shared/tabContextAppearance'
import {
  CEREMONY_ROLE_IDS,
  candidateCeremonyRoles,
  sanitizeCeremonyRoleIds,
} from '@shared/agileCeremonies'
import { AGENT_IDENTITY_TEMPLATES } from '@shared/agentIdentityTemplates'
import { useT } from '@i18n/useT'
import { Input, TextArea } from '../components/ui'
import { CEREMONY_ROLE_KEY } from '../workspace/ceremonyLabels'
import { AgentRulesEditor } from './AgentRulesEditor'
import { AgentConfigSlugField } from './AgentConfigSlugField'
import './AgentConfigIdentityColumn.css'

/** Secciones de identidad que renderiza este bloque. */
export type AgentConfigIdentitySection = 'identity' | 'objective' | 'rules'

export interface AgentConfigIdentityColumnProps {
  section: AgentConfigIdentitySection
  draft: AgentIdentityDraft
  /**
   * El agente está en marcha. Solo bloquea el slug (renombrar el archivo del
   * catálogo en caliente); lo demás se edita y entra en el próximo turno.
   */
  locked: boolean
  onChange: (patch: Partial<AgentIdentityDraft>) => void
  onCommit: () => void
}

/** Bloque Identidad del modal; el índice lateral elige qué sección se pinta. */
export const AgentConfigIdentityColumn: React.FC<AgentConfigIdentityColumnProps> = ({
  section,
  draft,
  locked,
  onChange,
  onCommit,
}) => {
  const { t } = useT()
  // Tolera la ficha antigua de un solo rol, que el draft aún puede traer.
  const selectedCeremonyRoles = candidateCeremonyRoles(draft)

  if (section === 'objective') {
    const used = draft.objective.length
    const nearMax = used > AGENT_OBJECTIVE_MAX_LENGTH * 0.9
    const canTemplate = !draft.objective.trim() && draft.rules.length === 0

    return (
      <div className="agent-config-identity">
        <label className="agent-config-identity__field">
          <span className="agent-config-identity__label">
            {t('agentPane.objectiveLabel')}
            <span
              className={`agent-config-identity__count${nearMax ? ' agent-config-identity__count--near' : ''}`}
            >
              {t('agentPane.objectiveCount', { n: used, max: AGENT_OBJECTIVE_MAX_LENGTH })}
            </span>
          </span>
          <TextArea
            rows={6}
            autoGrow
            value={draft.objective}
            maxLength={AGENT_OBJECTIVE_MAX_LENGTH}
            placeholder={t('agentPane.objectivePlaceholder')}
            onChange={event => onChange({ objective: event.target.value })}
            onBlur={onCommit}
          />
        </label>
        <p className="agent-config-identity__hint">{t('agentPane.objectiveHint')}</p>

        {canTemplate ? (
          <div className="agent-config-identity__templates">
            <span className="agent-config-identity__label">{t('agentPane.templatesLabel')}</span>
            <div className="agent-config-identity__template-row">
              {AGENT_IDENTITY_TEMPLATES.map(template => (
                <button
                  key={template.id}
                  type="button"
                  className="agent-config-identity__template"
                  onClick={() => {
                    const rules = template.ruleKeys.map(key => t(key))
                    onChange({
                    role: draft.role.trim() || t(template.roleKey),
                    objective: t(template.objectiveKey),
                    rules,
                    rulesEnabled: sanitizeAgentRulesEnabledDraft(rules),
                  })
                  }}
                >
                  {t(template.labelKey)}
                </button>
              ))}
            </div>
            <p className="agent-config-identity__hint">{t('agentPane.templatesHint')}</p>
          </div>
        ) : null}
      </div>
    )
  }

  if (section === 'rules') {
    return (
      <div className="agent-config-identity">
        <AgentRulesEditor
          rules={draft.rules}
          rulesEnabled={draft.rulesEnabled}
          onChange={(rules, rulesEnabled) => onChange({ rules, rulesEnabled })}
          onCommit={onCommit}
        />
      </div>
    )
  }

  return (
    <div className="agent-config-identity">
      <div className="agent-config-identity__row agent-config-identity__row--identity">
        <label className="agent-config-identity__field">
          <span className="agent-config-identity__label">{t('agentPane.monogramLabel')}</span>
          <Input
            type="text"
            value={draft.monogram}
            maxLength={AGENT_MONOGRAM_MAX_LENGTH}
            placeholder={agentMonogram(draft.name || draft.id)}
            onChange={event => onChange({ monogram: event.target.value })}
            onBlur={onCommit}
          />
        </label>

        <label className="agent-config-identity__field">
          <span className="agent-config-identity__label">{t('agentPane.nameLabel')}</span>
          <Input
            type="text"
            value={draft.name}
            maxLength={AGENT_NAME_MAX_LENGTH}
            placeholder={t('agentPane.namePlaceholder')}
            onChange={event => onChange({ name: event.target.value })}
            onBlur={onCommit}
          />
        </label>

        <label className="agent-config-identity__field">
          <span className="agent-config-identity__label">{t('agentPane.roleLabel')}</span>
          <Input
            type="text"
            value={draft.role}
            maxLength={AGENT_ROLE_MAX_LENGTH}
            placeholder={t('agentPane.rolePlaceholder')}
            onChange={event => onChange({ role: event.target.value })}
            onBlur={onCommit}
          />
        </label>

      </div>

      {/* Fuera de la fila de identidad: esa rejilla es de 3 columnas (68px 1fr
          1fr) y un cuarto campo caía en la de 68px, estrujado.

          Varios roles a la vez: en un equipo real un Tech Lead también programa
          y prueba. Se marcan los que el agente puede cubrir; la sala reparte
          antes de doblar, así que declarar de más no le quita el sitio a nadie. */}
      <div className="agent-config-identity__field agent-config-identity__field--ceremony">
        <span className="agent-config-identity__label">
          {t('agentPane.ceremonyRolesLabel')}
        </span>
        <div
          className="agent-config-identity__roles"
          role="group"
          aria-label={t('agentPane.ceremonyRolesLabel')}
        >
          {CEREMONY_ROLE_IDS.map(id => {
            const on = selectedCeremonyRoles.includes(id)
            return (
              <button
                key={id}
                type="button"
                className={[
                  'agent-config-identity__role',
                  on ? 'agent-config-identity__role--on' : '',
                ].filter(Boolean).join(' ')}
                aria-pressed={on}
                disabled={locked}
                onClick={() => {
                  onChange({
                    ceremonyRoles: sanitizeCeremonyRoleIds(
                      on
                        ? selectedCeremonyRoles.filter(role => role !== id)
                        : [...selectedCeremonyRoles, id],
                    ),
                  })
                  onCommit()
                }}
              >
                {t(CEREMONY_ROLE_KEY[id])}
              </button>
            )
          })}
        </div>
        <span className="agent-config-identity__hint">
          {selectedCeremonyRoles.length
            ? t('agentPane.ceremonyRolesHint')
            : t('agentPane.ceremonyRolesEmptyHint')}
        </span>
      </div>

      <AgentConfigSlugField
        value={draft.id}
        locked={locked}
        onChange={id => onChange({ id })}
        onCommit={onCommit}
      />
      {locked ? (
        <p className="agent-config-identity__hint">{t('agentPane.lockedWhileRunning')}</p>
      ) : null}
    </div>
  )
}
