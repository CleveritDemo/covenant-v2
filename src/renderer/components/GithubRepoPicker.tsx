import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useT } from '@i18n/useT'
import type { GithubRepoListResult, GithubRepoOption } from '../../shared/githubRepoPicker'
import { Badge } from './ui/Badge'
import { Input } from './ui/Input'
import { Spinner } from './ui/Spinner'
import './GithubRepoPicker.css'

export interface GithubRepoPickerProps {
  accountId: string
  disabled: boolean
  excludeFullNames: string[]
  onPick: (repo: GithubRepoOption) => void
}

const SEARCH_DEBOUNCE_MS = 250

function isLinked(fullName: string, excludeFullNames: string[]): boolean {
  const needle = fullName.toLowerCase()
  return excludeFullNames.some(name => name.toLowerCase() === needle)
}

function formatPushedAt(iso: string, locale?: string): string {
  const ms = Date.parse(iso ?? '')
  if (Number.isNaN(ms)) return ''
  return new Intl.DateTimeFormat(locale || undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(ms)
}

function firstPickableIndex(repos: GithubRepoOption[], excludeFullNames: string[]): number {
  return repos.findIndex(repo => !isLinked(repo.fullName, excludeFullNames))
}

/**
 * Lista filtrable de repos del token. El fetch vive aquí; el alta la hace el host.
 */
export function GithubRepoPicker({
  accountId,
  disabled,
  excludeFullNames,
  onPick,
}: GithubRepoPickerProps): React.ReactElement {
  const { t, i18n } = useT()
  const listId = useId()
  const inputId = useId()
  const [query, setQuery] = useState('')
  const [repos, setRepos] = useState<GithubRepoOption[]>([])
  const [loading, setLoading] = useState(true)
  const [truncated, setTruncated] = useState(false)
  const [error, setError] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const lastRequestedRef = useRef('')
  const immediateRef = useRef(true)

  useEffect(() => {
    immediateRef.current = true
  }, [accountId])

  useEffect(() => {
    if (disabled) return
    let cancelled = false
    const requested = query
    const delay = immediateRef.current ? 0 : SEARCH_DEBOUNCE_MS
    immediateRef.current = false
    const timer = window.setTimeout(() => {
      lastRequestedRef.current = requested
      setLoading(true)
      void window.api.githubReposList(accountId, requested).then((result: GithubRepoListResult) => {
        if (cancelled || lastRequestedRef.current !== requested) return
        setLoading(false)
        setRepos(result.repos ?? [])
        setTruncated(Boolean(result.truncated))
        setError((result.error ?? '').trim())
      })
    }, delay)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [accountId, disabled, query])

  useEffect(() => {
    setActiveIndex(firstPickableIndex(repos, excludeFullNames))
  }, [repos, excludeFullNames])

  const optionId = (index: number): string => `${listId}-option-${index}`

  const pickableIndexes = useMemo(
    () => repos.map((repo, index) => (isLinked(repo.fullName, excludeFullNames) ? -1 : index)).filter(index => index >= 0),
    [repos, excludeFullNames],
  )

  function moveActive(delta: number): void {
    if (pickableIndexes.length === 0) return
    const current = pickableIndexes.indexOf(activeIndex)
    const next = current < 0
      ? (delta > 0 ? 0 : pickableIndexes.length - 1)
      : (current + delta + pickableIndexes.length) % pickableIndexes.length
    setActiveIndex(pickableIndexes[next])
  }

  function pickAt(index: number): void {
    const repo = repos[index]
    if (!repo || isLinked(repo.fullName, excludeFullNames)) return
    onPick(repo)
  }

  function handleFilterKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveActive(1)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveActive(-1)
      return
    }
    if (event.key === 'Enter') {
      if (activeIndex < 0) return
      event.preventDefault()
      pickAt(activeIndex)
      return
    }
    if (event.key === 'Escape') {
      if (!query) return
      event.preventDefault()
      event.stopPropagation()
      setQuery('')
    }
  }

  const locale = i18n?.language
  const showEmpty = !loading && repos.length === 0 && !error

  return (
    <div className="github-repo-picker">
      <label className="github-repo-picker__field" htmlFor={inputId}>
        <span className="github-repo-picker__label">{t('organizations.repoPickerLabel')}</span>
        <Input
          id={inputId}
          type="text"
          size="sm"
          value={query}
          disabled={disabled}
          placeholder={t('organizations.repoPickerPlaceholder')}
          spellCheck={false}
          autoComplete="off"
          role="combobox"
          aria-expanded={repos.length > 0}
          aria-controls={listId}
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
          aria-autocomplete="list"
          onChange={event => setQuery(event.target.value)}
          onKeyDown={handleFilterKeyDown}
        />
      </label>
      {loading ? (
        <p className="github-repo-picker__status" role="status">
          <Spinner aria-label={t('organizations.loading')} />
        </p>
      ) : null}
      {error ? (
        <p className="github-repo-picker__status" role="status">{error}</p>
      ) : null}
      {showEmpty ? (
        <p className="github-repo-picker__status">{t('organizations.repoPickerEmpty')}</p>
      ) : null}
      {repos.length > 0 ? (
        <ul className="github-repo-picker__list" role="listbox" id={listId} aria-label={t('organizations.repoPickerLabel')}>
          {repos.map((repo, index) => {
            const linked = isLinked(repo.fullName, excludeFullNames)
            const when = formatPushedAt(repo.pushedAt, locale)
            const label = linked
              ? `${repo.fullName}. ${t('organizations.repoPickerAlreadyLinked')}`
              : repo.fullName
            return (
              <li key={repo.fullName} className="github-repo-picker__item" role="none">
                <button
                  type="button"
                  id={optionId(index)}
                  className={[
                    'github-repo-picker__row',
                    index === activeIndex ? 'github-repo-picker__row--active' : '',
                  ].filter(Boolean).join(' ')}
                  role="option"
                  aria-selected={index === activeIndex}
                  aria-label={label}
                  disabled={disabled || linked}
                  onMouseEnter={() => { if (!linked) setActiveIndex(index) }}
                  onClick={() => pickAt(index)}
                >
                  <span className="github-repo-picker__name">{repo.fullName}</span>
                  {repo.isPrivate ? (
                    <Badge variant="muted">{t('organizations.repoPickerPrivate')}</Badge>
                  ) : null}
                  {when ? <span className="github-repo-picker__when">{when}</span> : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
      {truncated ? (
        <p className="github-repo-picker__hint">{t('organizations.repoPickerTruncated')}</p>
      ) : null}
    </div>
  )
}
