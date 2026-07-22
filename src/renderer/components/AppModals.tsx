import React from 'react'
import type { AppConfig } from '@shared/configSchema'
import type { AgentCliProvider } from '../../shared/tabSession'
import {
  AgentProviderPickerModal,
  type AgentPickerCloneSource,
} from '../agent/AgentProviderPickerModal'
import { SettingsModal } from './SettingsModal'
import { ThemePickerModal } from './ThemePickerModal'

interface Props {
  config: AppConfig
  settingsOpen: boolean
  themePickerOpen: boolean
  agentPicker: { tabId: string; fromPaneId?: string } | null
  agentCloneSources: AgentPickerCloneSource[]
  onCloseSettings: () => void
  onCloseThemePicker: () => void
  onCloseAgentPicker: () => void
  onConfigSaved: (cfg: AppConfig) => void
  onThemeChange: (themeId: string) => void
  onAgentProviderSelect: (provider: AgentCliProvider) => void
  onAgentCloneSelect: (sourcePaneId: string) => void
}

export const AppModals: React.FC<Props> = ({
  config,
  settingsOpen,
  themePickerOpen,
  agentPicker,
  agentCloneSources,
  onCloseSettings,
  onCloseThemePicker,
  onCloseAgentPicker,
  onConfigSaved,
  onThemeChange,
  onAgentProviderSelect,
  onAgentCloneSelect,
}) => (
  <>
    <AgentProviderPickerModal
      open={agentPicker !== null}
      cloneSources={agentCloneSources}
      onClose={onCloseAgentPicker}
      onSelect={onAgentProviderSelect}
      onClone={onAgentCloneSelect}
    />

    {settingsOpen && (
      <SettingsModal
        config={config}
        onSave={onConfigSaved}
        onClose={onCloseSettings}
      />
    )}

    <ThemePickerModal
      open={themePickerOpen}
      currentThemeId={config.themeId}
      onSelectTheme={onThemeChange}
      onClose={onCloseThemePicker}
    />
  </>
)
