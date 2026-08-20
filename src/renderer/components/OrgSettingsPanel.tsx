import React from 'react'
import { useT } from '@i18n/useT'
import type { CovenantMember, CovenantOrg } from '../covenantApi'
import { SettingsField } from './SettingsSection'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { SectionStatus } from './OrgSectionStatus'
import { orgPeopleRows } from '../../shared/orgPeople'

/**
 * Columna de detalle en modo "ajustes de la organización".
 * People es una sola tabla con el rol como celda; zona de riesgo al final.
 */

export interface OrgPeopleSectionProps {
  members: CovenantMember[]
  orgAdmins: string[]
  canManageMembers: boolean
  /** El rol se compone de orgAdminAdd/Remove: sin esa API la celda es de solo lectura. */
  canManageRoles: boolean
  membersForbidden: boolean
  loading: boolean
  error: string | null
  busy: boolean
  loginDraft: string
  onLoginDraftChange: (value: string) => void
  onAdd: () => void
  onRemove: (login: string) => void
  onRoleChange: (login: string, role: 'admin' | 'member') => void
}

function OrgPeopleSection(props: OrgPeopleSectionProps): React.ReactElement {
  const { t } = useT()
  const rows = orgPeopleRows(props.members, props.orgAdmins)
  const canMutate = props.canManageMembers && !props.busy
  const canAdd = canMutate && props.loginDraft.trim().length > 0
  const showError = props.error && !props.membersForbidden

  return (
    <section className="orgs-section" aria-label={t('organizations.membersSection')}>
      <h3 className="orgs-section__title">{t('organizations.membersSection')}</h3>
      <SectionStatus
        loading={props.loading}
        error={showError ? props.error : null}
        loadingLabel={t('organizations.loading')}
      />
      {props.membersForbidden || !props.canManageMembers ? (
        <p className="orgs-notice">{t('organizations.membersAdminsOnly')}</p>
      ) : (
        <>
          {rows.length === 0 && !props.loading ? (
            <p className="orgs-empty">{t('organizations.noMembers')}</p>
          ) : (
            <table className="orgs-table">
              <thead>
                <tr>
                  <th scope="col">{t('organizations.personColumn')}</th>
                  <th scope="col">{t('organizations.roleColumn')}</th>
                  <th scope="col">
                    <span className="orgs-visually-hidden">{t('organizations.removeMember')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.login}>
                    <td>
                      <span className="orgs-person">
                        {row.avatarUrl ? (
                          <img className="orgs-person__avatar" src={row.avatarUrl} alt="" width={24} height={24} />
                        ) : (
                          <span className="orgs-person__avatar orgs-person__avatar--letter" aria-hidden>
                            {row.login.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <span className="orgs-person__login">{row.login}</span>
                      </span>
                    </td>
                    <td>
                      {row.role === 'owner' ? (
                        <span className="orgs-row__meta">{t('organizations.roleOwner')}</span>
                      ) : (
                        <Select
                          size="sm"
                          value={row.role}
                          disabled={!canMutate || !props.canManageRoles}
                          aria-label={t('organizations.roleFor', { login: row.login })}
                          onChange={next => props.onRoleChange(row.login, next as 'admin' | 'member')}
                          options={[
                            { value: 'admin', label: t('organizations.roleAdmin') },
                            { value: 'member', label: t('organizations.roleUser') },
                          ]}
                        />
                      )}
                    </td>
                    <td>
                      {row.role === 'owner' ? null : (
                        <Button
                          variant="ghost"
                          size="xs"
                          disabled={!canMutate}
                          onClick={() => props.onRemove(row.login)}
                        >
                          <span className="orgs-danger-text">{t('organizations.removeMember')}</span>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="orgs-inline-form__row">
            <div className="orgs-inline-form__grow">
              <SettingsField label={t('organizations.memberLogin')} compact>
                <Input
                  type="text"
                  size="sm"
                  value={props.loginDraft}
                  disabled={!canMutate}
                  onChange={e => props.onLoginDraftChange(e.target.value)}
                  placeholder={t('organizations.memberLoginPlaceholder')}
                  spellCheck={false}
                  aria-label={t('organizations.memberLogin')}
                />
              </SettingsField>
            </div>
            <Button variant="secondary" size="sm" disabled={!canAdd} onClick={props.onAdd}>
              {t('organizations.addMember')}
            </Button>
          </div>
        </>
      )}
    </section>
  )
}

export function OrgSettingsPanel({
  org,
  isOwner,
  canLeave,
  canDelete,
  leaveError,
  leaveBusy,
  deleteBusy,
  onBack,
  onLeaveClick,
  onDeleteClick,
  peopleProps,
}: {
  org: CovenantOrg
  isOwner: boolean
  canLeave: boolean
  canDelete: boolean
  leaveError: string | null
  leaveBusy: boolean
  deleteBusy: boolean
  onBack: () => void
  onLeaveClick: () => void
  onDeleteClick: () => void
  peopleProps: OrgPeopleSectionProps
}): React.ReactElement {
  const { t } = useT()

  return (
    <section className="orgs-panel" aria-label={t('organizations.orgSettingsTitle', { name: org.name })}>
      <header className="orgs-panel__head">
        <Button variant="ghost" size="xs" onClick={onBack}>
          {t('organizations.back')}
        </Button>
        <div className="orgs-panel__title-block">
          <h2 className="orgs-panel__title">
            {t('organizations.orgSettingsTitle', { name: org.name })}
          </h2>
          <p className="orgs-panel__meta">
            {org.slug}
            {org.role ? ` · ${org.role}` : ''}
          </p>
        </div>
      </header>
      <div className="orgs-panel__body">
        <OrgPeopleSection {...peopleProps} />
        <section className="orgs-section" aria-label={t('organizations.dangerZone')}>
          <h3 className="orgs-section__title">{t('organizations.dangerZone')}</h3>
          {leaveError ? <p className="orgs-section-error" role="alert">{leaveError}</p> : null}
          <div className="orgs-danger-zone">
            <div className="orgs-danger-row">
              <div className="orgs-row__main">
                <p className="orgs-row__title">{t('organizations.leaveOrg')}</p>
                <p className="orgs-row__meta">
                  {isOwner ? t('organizations.ownerCannotLeave') : t('organizations.leaveOrgDetail')}
                </p>
              </div>
              <Button variant="ghost" size="sm" disabled={!canLeave || leaveBusy} onClick={onLeaveClick}>
                <span className="orgs-danger-text">{t('organizations.leaveOrg')}</span>
              </Button>
            </div>
            {canDelete ? (
              <div className="orgs-danger-row">
                <div className="orgs-row__main">
                  <p className="orgs-row__title">{t('organizations.deleteOrg')}</p>
                  <p className="orgs-row__meta">{t('organizations.deleteOrgDetail')}</p>
                </div>
                <Button variant="ghost" size="sm" disabled={deleteBusy} onClick={onDeleteClick}>
                  <span className="orgs-danger-text">{t('organizations.deleteOrg')}</span>
                </Button>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  )
}
