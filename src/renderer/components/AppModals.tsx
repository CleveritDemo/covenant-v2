import React from 'react'
import type { AppConfig } from '@shared/configSchema'
import type { AgentCliProvider } from '../../shared/tabSession'
import {
  AgentProviderPickerModal,
  type AgentPickerCloneSource,
} from '../agent/AgentProviderPickerModal'
import { AgentCreateNameModal } from '../agent/AgentCreateNameModal'
import { SettingsModal } from './SettingsModal'
import { ThemePickerModal } from './ThemePickerModal'

interface Props {
  config: AppConfig
  settingsOpen: boolean
  themePickerOpen: boolean
  agentPicker: { tabId: string; fromPaneId?: string } | null
  agentCreate: { tabId: string; fromPaneId?: string; provider: AgentCliProvider } | null
  agentCloneSources: AgentPickerCloneSource[]
  onCloseSettings: () => void
  onCloseThemePicker: () => void
  onCloseAgentPicker: () => void
  onCloseAgentCreate: () => void
  onConfigSaved: (cfg: AppConfig) => void
  onThemeChange: (themeId: string) => void
  onAgentProviderSelect: (provider: AgentCliProvider) => void
  onAgentCloneSelect: (sourcePaneId: string) => void
  onAgentCreateConfirm: (name: string) => void
}

export const AppModals: React.FC<Props> = ({
  config,
  settingsOpen,
  themePickerOpen,
  agentPicker,
  agentCreate,
  agentCloneSources,
  onCloseSettings,
  onCloseThemePicker,
  onCloseAgentPicker,
  onCloseAgentCreate,
  onConfigSaved,
  onThemeChange,
  onAgentProviderSelect,
  onAgentCloneSelect,
  onAgentCreateConfirm,
}) => (
  <>
    <AgentProviderPickerModal
      open={agentPicker !== null}
      cloneSources={agentCloneSources}
      onClose={onCloseAgentPicker}
      onSelect={onAgentProviderSelect}
      onClone={onAgentCloneSelect}
    />

    <AgentCreateNameModal
      open={agentCreate !== null}
      onClose={onCloseAgentCreate}
      onConfirm={onAgentCreateConfirm}
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
