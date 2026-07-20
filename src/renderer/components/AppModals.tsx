import React from 'react'
import type { AppConfig } from '@shared/configSchema'
import type { AgentCliProvider } from '../../shared/tabSession'
import { AgentProviderPickerModal } from '../agent/AgentProviderPickerModal'
import { SettingsModal } from './SettingsModal'
import { ThemePickerModal } from './ThemePickerModal'

interface Props {
  config: AppConfig
  settingsOpen: boolean
  themePickerOpen: boolean
  agentPicker: { tabId: string; fromPaneId?: string } | null
  onCloseSettings: () => void
  onCloseThemePicker: () => void
  onCloseAgentPicker: () => void
  onConfigSaved: (cfg: AppConfig) => void
  onThemeChange: (themeId: string) => void
  onAgentProviderSelect: (provider: AgentCliProvider) => void
}

export const AppModals: React.FC<Props> = ({
  config,
  settingsOpen,
  themePickerOpen,
  agentPicker,
  onCloseSettings,
  onCloseThemePicker,
  onCloseAgentPicker,
  onConfigSaved,
  onThemeChange,
  onAgentProviderSelect,
}) => (
  <>
    <AgentProviderPickerModal
      open={agentPicker !== null}
      onClose={onCloseAgentPicker}
      onSelect={onAgentProviderSelect}
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
