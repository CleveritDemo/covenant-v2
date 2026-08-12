import React, { useCallback } from 'react'
import { mergeWithDefaults, sanitizeMusicVolume, type AppConfig } from '@shared/configSchema'
import type { OrgWorkspaceCatalogEntry } from '../../shared/orgWorkspaceCatalog'
import type { AgentCliProvider } from '../../shared/tabSession'
import {
  AgentProviderPickerModal,
  type AgentPickerCloneSource,
} from '../agent/AgentProviderPickerModal'
import { AgentCreateNameModal } from '../agent/AgentCreateNameModal'
import { SettingsModal } from './SettingsModal'
import { OrganizationsModal } from './OrganizationsModal'
import {
  OrgWorkspaceTabPickerModal,
  type OrgWorkspaceSelection,
} from './OrgWorkspaceTabPickerModal'
import { ThemePickerModal } from './ThemePickerModal'
import type { ThemePickerAudioPartial } from './ThemePickerAudioControls'

interface Props {
  config: AppConfig
  /** cwd de la pestaña activa: `jira.json` es por proyecto, no de la app. */
  settingsCwd: string
  settingsOpen: boolean
  orgModalOpen: boolean
  orgWorkspacePickerOpen: boolean
  orgWorkspaceCatalogEntries?: OrgWorkspaceCatalogEntry[]
  themePickerOpen: boolean
  agentPicker: { tabId: string; fromPaneId?: string } | null
  agentCreate: { tabId: string; fromPaneId?: string; provider: AgentCliProvider } | null
  agentCloneSources: AgentPickerCloneSource[]
  onCloseSettings: () => void
  onCloseOrganizations: () => void
  onOrgWorkspacesMutated?: () => void
  onCloseOrgWorkspacePicker: () => void
  onConfirmOrgWorkspacePicker: (selection: OrgWorkspaceSelection) => void
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
  settingsCwd,
  settingsOpen,
  orgModalOpen,
  orgWorkspacePickerOpen,
  orgWorkspaceCatalogEntries,
  themePickerOpen,
  agentPicker,
  agentCreate,
  agentCloneSources,
  onCloseSettings,
  onCloseOrganizations,
  onOrgWorkspacesMutated,
  onCloseOrgWorkspacePicker,
  onConfirmOrgWorkspacePicker,
  onCloseThemePicker,
  onCloseAgentPicker,
  onCloseAgentCreate,
  onConfigSaved,
  onThemeChange,
  onAgentProviderSelect,
  onAgentCloneSelect,
  onAgentCreateConfirm,
}) => {
  const handleThemeAudioConfigChange = useCallback((partial: ThemePickerAudioPartial) => {
    onConfigSaved(mergeWithDefaults({
      ...config,
      ...partial,
      musicVolume: partial.musicVolume !== undefined
        ? sanitizeMusicVolume(partial.musicVolume)
        : sanitizeMusicVolume(config.musicVolume),
    }))
  }, [config, onConfigSaved])

  return (
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
          cwd={settingsCwd}
          onSave={onConfigSaved}
          onClose={onCloseSettings}
        />
      )}

      {orgModalOpen && (
        <OrganizationsModal
          onClose={onCloseOrganizations}
          onOrgWorkspacesMutated={onOrgWorkspacesMutated}
        />
      )}

      <OrgWorkspaceTabPickerModal
        open={orgWorkspacePickerOpen}
        onClose={onCloseOrgWorkspacePicker}
        onConfirm={onConfirmOrgWorkspacePicker}
        catalog={orgWorkspaceCatalogEntries}
      />

      <ThemePickerModal
        open={themePickerOpen}
        currentThemeId={config.themeId}
        musicEnabled={config.musicEnabled}
        musicVolume={config.musicVolume}
        onSelectTheme={onThemeChange}
        onAudioConfigChange={handleThemeAudioConfigChange}
        onClose={onCloseThemePicker}
      />
    </>
  )
}
