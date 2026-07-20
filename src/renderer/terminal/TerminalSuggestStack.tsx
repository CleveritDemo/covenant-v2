import React from 'react'
import { CdSuggest } from './CdSuggest'
import { CmdSuggest, type CmdSnippet } from './CmdSuggest'

export interface TerminalSuggestStackProps {
  showCdSuggestPanel: boolean
  showCmdSuggestPanel: boolean
  visibleLocalDirs: string[]
  visiblePaths: string[]
  onPickCdLocal: (dirname: string) => void
  onPickCdRecent: (path: string) => void
  visibleRecentMatches: string[]
  visibleSnippets: CmdSnippet[]
  cmdSuggestCmd: string | null
  cmdSuggestDraft: string
  onPickRecentCmd: (cmd: string) => void
  onPickCmdSnippet: (cmd: string) => void
}

export const TerminalSuggestStack: React.FC<TerminalSuggestStackProps> = ({
  showCdSuggestPanel,
  showCmdSuggestPanel,
  visibleLocalDirs,
  visiblePaths,
  onPickCdLocal,
  onPickCdRecent,
  visibleRecentMatches,
  visibleSnippets,
  cmdSuggestCmd,
  cmdSuggestDraft,
  onPickRecentCmd,
  onPickCmdSnippet,
}) => {
  if (!showCdSuggestPanel && !showCmdSuggestPanel) return null

  return (
    <div className="terminal-suggest-stack">
      {showCdSuggestPanel && (
        <CdSuggest
          visibleLocalDirs={visibleLocalDirs}
          visiblePaths={visiblePaths}
          onPickLocal={onPickCdLocal}
          onPickRecent={onPickCdRecent}
        />
      )}
      {showCmdSuggestPanel && (
        <CmdSuggest
          visibleRecentMatches={visibleRecentMatches}
          visibleSnippets={visibleSnippets}
          cmdSuggestCmd={cmdSuggestCmd}
          cmdSuggestDraft={cmdSuggestDraft}
          onPickRecent={onPickRecentCmd}
          onPickSnippet={onPickCmdSnippet}
        />
      )}
    </div>
  )
}
