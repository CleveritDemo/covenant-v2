import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useT } from '@i18n/useT'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import './PlaneGithubAccountButton.css'

type GithubAccount = { id: string; label: string }

const DEFAULT_VALUE = ''

function panelPlacement(trigger: DOMRect): {
  top: number | 'auto'
  bottom: number | 'auto'
  maxHeight: number
} {
  const GAP = 4
  const below = window.innerHeight - trigger.bottom - GAP * 2
  const above = trigger.top - GAP * 2
  if (below < 180 && above > below) {
    return {
      top: 'auto',
      bottom: window.innerHeight - trigger.top + GAP,
      maxHeight: Math.min(above, 320),
    }
  }
  return { top: trigger.bottom + GAP, bottom: 'auto', maxHeight: Math.min(below, 320) }
}

export interface PlaneGithubAccountButtonProps {
  projectFolder: string
  onChanged?: (accountId: string | null) => void
}

/**
 * Selector de cuenta GitHub del workspace en el chrome superior izquierdo.
 * `accountId` null = cadena global (cuenta por defecto / env / helper).
 */
export const PlaneGithubAccountButton: React.FC<PlaneGithubAccountButtonProps> = ({
  projectFolder,
  onChanged,
}) => {
  const { t } = useT()
  const cwd = projectFolder.trim()
  const panelId = `plane-github-account-panel-${useId().replace(/:/g, '')}`
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState<React.CSSProperties>({})
  const [accounts, setAccounts] = useState<GithubAccount[]>([])
  const [accountId, setAccountId] = useState<string | null>(null)

  const load = useCallback(async (): Promise<void> => {
    if (!cwd) return
    const listFn = window.api?.githubAccountsList
    const getFn = window.api?.githubWorkspaceAccountGet
    if (typeof listFn !== 'function' || typeof getFn !== 'function') return
    const [list, bound] = await Promise.all([listFn(), getFn(cwd)])
    if (list.ok) setAccounts(list.accounts)
    if (bound.ok) {
      setAccountId(bound.accountId)
      onChanged?.(bound.accountId)
    }
  }, [cwd, onChanged])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const onToggle = (event: Event): void => {
      const nowOpen = (event as ToggleEvent).newState === 'open'
      setOpen(nowOpen)
      if (!nowOpen) return
      const trigger = triggerRef.current?.getBoundingClientRect()
      if (!trigger) return
      const { top, bottom, maxHeight } = panelPlacement(trigger)
      setBox({
        top,
        bottom,
        left: trigger.left,
        right: 'auto',
        minWidth: trigger.width,
        maxWidth: Math.min(280, window.innerWidth - trigger.left - 8),
        maxHeight,
      })
    }
    panel.addEventListener('toggle', onToggle)
    return () => panel.removeEventListener('toggle', onToggle)
  }, [])

  const close = (): void => {
    setOpen(false)
    const panel = panelRef.current
    if (!panel) return
    try {
      if (typeof panel.hidePopover === 'function') panel.hidePopover()
    } catch {
      /* popover ya cerrado */
    }
  }

  const pick = async (nextId: string | null): Promise<void> => {
    const setFn = window.api?.githubWorkspaceAccountSet
    if (typeof setFn !== 'function') return
    const result = await setFn(cwd, nextId)
    if (result.ok) {
      setAccountId(nextId)
      onChanged?.(nextId)
    }
    close()
  }

  if (!cwd) return null

  const active = accounts.find(account => account.id === accountId)
  const displayLabel = active ? active.label : t('tabs.planeGithubAccountDefault')
  const selectedValue = accountId ?? DEFAULT_VALUE

  return (
    <div className="plane-github-account">
      <Tooltip content={t('tabs.planeGithubAccount')} hint={displayLabel}>
        <button
          ref={triggerRef}
          type="button"
          className="plane-github-account__btn"
          aria-label={t('tabs.planeGithubAccount')}
          aria-haspopup="listbox"
          aria-expanded={open}
          popovertarget={panelId}
        >
          <Icon name="git-branch" size={12} />
          <span className="plane-github-account__label">{displayLabel}</span>
          <Icon name="chevron-down" size={10} />
        </button>
      </Tooltip>
      <div
        ref={panelRef}
        id={panelId}
        popover="auto"
        className="plane-github-account__panel"
        style={box}
        role="listbox"
        tabIndex={-1}
        aria-label={t('tabs.planeGithubAccount')}
      >
        <div
          role="option"
          aria-selected={selectedValue === DEFAULT_VALUE}
          className="plane-github-account__option"
          onPointerDown={event => event.preventDefault()}
          onClick={event => {
            event.preventDefault()
            event.stopPropagation()
            void pick(null)
          }}
        >
          {t('tabs.planeGithubAccountUseDefault')}
        </div>
        {accounts.map(account => (
          <div
            key={account.id}
            role="option"
            aria-selected={account.id === selectedValue}
            className="plane-github-account__option"
            onPointerDown={event => event.preventDefault()}
            onClick={event => {
              event.preventDefault()
              event.stopPropagation()
              void pick(account.id)
            }}
          >
            {account.label}
          </div>
        ))}
      </div>
    </div>
  )
}
