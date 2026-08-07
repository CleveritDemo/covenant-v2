import React, { useMemo } from 'react'
import { Icon } from '../components/ui/Icon'
import { useT } from '@i18n/useT'

export interface CmdSnippet {
  label: string
  cmd: string
}

interface CmdSuggestHighlightParts {
  before: string
  match: string
  after: string
}

interface UnifiedCmdItem {
  key: string
  display: string
  pickValue: string
  source: 'snippet' | 'recent'
}

function normCmd(cmd: string): string {
  return cmd.trim().toLowerCase()
}

function mergeCmdSuggestItems(recent: string[], snippets: CmdSnippet[]): UnifiedCmdItem[] {
  const seen = new Set<string>()
  const out: UnifiedCmdItem[] = []

  for (const s of snippets) {
    const n = normCmd(s.cmd)
    if (!n || seen.has(n)) continue
    seen.add(n)
    out.push({
      key: `snippet:${s.cmd}`,
      display: s.label,
      pickValue: s.cmd,
      source: 'snippet',
    })
  }

  for (const cmd of recent) {
    const n = normCmd(cmd)
    if (!n || seen.has(n)) continue
    seen.add(n)
    out.push({
      key: `recent:${cmd}`,
      display: cmd,
      pickValue: cmd,
      source: 'recent',
    })
  }

  return out
}

function splitHighlight(display: string, draft: string): CmdSuggestHighlightParts | null {
  const d = draft.trim()
  if (!d) return null
  const dl = d.toLowerCase()
  const fl = display.toLowerCase()
  let n = 0
  while (n < display.length && n < d.length && display[n].toLowerCase() === d[n].toLowerCase()) n++
  if (n > 0) return { before: '', match: display.slice(0, n), after: display.slice(n) }
  const i = fl.indexOf(dl)
  if (i >= 0) {
    const end = i + d.length
    return { before: display.slice(0, i), match: display.slice(i, end), after: display.slice(end) }
  }
  return null
}

interface CmdHighlightLabelProps {
  display: string
  draft: string
}

const CmdHighlightLabel: React.FC<CmdHighlightLabelProps> = ({ display, draft }) => {
  const parts = splitHighlight(display, draft)
  if (!parts) return <span className="cmd-suggest-label">{display}</span>
  const { before, match, after } = parts
  return (
    <span className="cmd-suggest-label">
      {before !== '' && <span className="cmd-suggest-label__rest">{before}</span>}
      <span className="cmd-suggest-label__typed">{match}</span>
      {after !== '' && <span className="cmd-suggest-label__rest">{after}</span>}
    </span>
  )
}

interface CmdSuggestProps {
  visibleRecentMatches: string[]
  visibleSnippets: CmdSnippet[]
  cmdSuggestCmd: string | null
  cmdSuggestDraft: string
  onPickRecent: (cmd: string) => void
  onPickSnippet: (cmd: string) => void
}

export const CmdSuggest: React.FC<CmdSuggestProps> = ({
  visibleRecentMatches,
  visibleSnippets,
  cmdSuggestCmd,
  cmdSuggestDraft,
  onPickRecent,
  onPickSnippet,
}) => {
  const { t } = useT()

  const items = useMemo(
    () => mergeCmdSuggestItems(visibleRecentMatches, visibleSnippets),
    [visibleRecentMatches, visibleSnippets],
  )

  const label =
    visibleRecentMatches.length > 0 && visibleSnippets.length > 0
      ? t('cmdSuggest.ariaRecentsAndSuggestions', { cmd: cmdSuggestCmd ?? '' })
      : visibleRecentMatches.length > 0
        ? t('cmdSuggest.ariaRecents')
        : cmdSuggestCmd
          ? t('cmdSuggest.ariaSuggestions', { cmd: cmdSuggestCmd })
          : t('cmdSuggest.ariaOnlySuggestions')

  if (items.length === 0) return null

  return (
    <div className="cmd-suggest" role="listbox" aria-label={label}>
      <div className="cmd-suggest-list">
        {items.map(item => (
          <CmdSuggestItem
            key={item.key}
            display={item.display}
            draft={cmdSuggestDraft}
            itemTitle={t('cmdSuggest.itemTitle')}
            onPick={() => {
              if (item.source === 'snippet') onPickSnippet(item.pickValue)
              else onPickRecent(item.pickValue)
            }}
          />
        ))}
      </div>
    </div>
  )
}

interface CmdSuggestItemProps {
  display: string
  draft: string
  itemTitle: string
  onPick: () => void
}

const CmdSuggestItem: React.FC<CmdSuggestItemProps> = ({ display, draft, itemTitle, onPick }) => (
  <button
    type="button"
    className="cmd-suggest-item"
    onMouseDown={e => { e.preventDefault(); onPick() }}
    role="option"
    aria-label={itemTitle}
  >
    <span className="cmd-suggest-script-icon" aria-hidden="true">
      <Icon name="terminal" size={12} />
    </span>
    <CmdHighlightLabel display={display} draft={draft} />
  </button>
)
