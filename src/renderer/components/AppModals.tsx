import React, { useCallback } from 'react'
import { mergeWithDefaults, type AppConfig } from '@shared/configSchema'
import type { OrgWorkspaceCatalogEntry } from '../../shared/orgWorkspaceCatalog'
import type { AgentCliProvider } from '../../shared/tabSession'
import {
  AgentProviderPickerModal,
  type AgentPickerCloneSource,
} from '../agent/AgentProviderPickerModal'
import { AgentCreateNameModal } from '../agent/AgentCreateNameModal'
import { SettingsModal } from './SettingsModal'
import { OrganizationsView } from './OrganizationsView'
import {
  OrgWorkspaceTabPickerModal,
  type OrgWorkspaceSelection,
} from './OrgWorkspaceTabPickerModal'
import { ThemePickerModal } from './ThemePickerModal'
import {
  PromoteWorkspaceModal,
  type PromoteWorkspaceConfirmPayload,
  type PromoteWorkspaceOrgOption,
  type PromoteWorkspaceRepoOption,
} from './PromoteWorkspaceModal'
import type { ThemePickerAudioPartial } from './ThemePickerAudioControls'

interface Props {
  config: AppConfig
  /** cwd de la pestaña activa: `jira.json` es por proyecto, no de la app. */
  settingsCwd: string
  settingsOpen: boolean
  orgModalOpen: boolean
  orgWorkspacePickerOpen: boolean
  orgWorkspacePickerAccountId?: string
  orgWorkspaceCatalogEntries?: OrgWorkspaceCatalogEntry[]
  themePickerOpen: boolean
  agentPicker: { tabId: string; fromPaneId?: string } | null
  agentCreate: { tabId: string; fromPaneId?: string; provider: AgentCliProvider } | null
  agentCloneSources: AgentPickerCloneSource[]
  onCloseSettings: () => void
  onCloseOrganizations: () => void
  onOrgWorkspacesMutated?: () => void
  onOpenOrgWorkspace: (selection: OrgWorkspaceSelection) => void
  onCloseOrgWorkspacePicker: () => void
  onConfirmOrgWorkspacePicker: (selection: OrgWorkspaceSelection) => void
  promoteWorkspaceOpen: boolean
  promoteWorkspaceFolderPath: string
  promoteWorkspaceOrgs: PromoteWorkspaceOrgOption[]
  promoteWorkspaceOrgsReason?: 'signedOut' | 'noAdminOrg'
  promoteWorkspaceRepos: PromoteWorkspaceRepoOption[]
  promoteWorkspaceBusy: boolean
  promoteWorkspacePhase?: 'create' | 'repos' | 'upload' | 'wiki'
  promoteWorkspaceError?: string
  onClosePromoteWorkspace: () => void
  onConfirmPromoteWorkspace: (payload: PromoteWorkspaceConfirmPayload) => void
  onCloseThemePicker: () => void
  onCloseAgentPicker: () => void
  onCloseAgentCreate: () => void
  onConfigSaved: (cfg: AppConfig) => void
  onThemeChange: (themeId: string) => void
  onAgentProviderSelect: (provider: AgentCliProvider) => void
  onAgentCloneSelect: (sourcePaneId: string) => void
  onAgentCreateConfirm: (name: string) => void
  onReplayOnboarding?: () => void
  onAccountDeleted?: (accountId: string) => void
}

export const AppModals: React.FC<Props> = ({
  config,
  settingsCwd,
  settingsOpen,
  orgModalOpen,
  orgWorkspacePickerOpen,
  orgWorkspacePickerAccountId,
  orgWorkspaceCatalogEntries,
  themePickerOpen,
  agentPicker,
  agentCreate,
  agentCloneSources,
  onCloseSettings,
  onCloseOrganizations,
  onOrgWorkspacesMutated,
  onOpenOrgWorkspace,
  onCloseOrgWorkspacePicker,
  onConfirmOrgWorkspacePicker,
  promoteWorkspaceOpen,
  promoteWorkspaceFolderPath,
  promoteWorkspaceOrgs,
  promoteWorkspaceOrgsReason,
  promoteWorkspaceRepos,
  promoteWorkspaceBusy,
  promoteWorkspacePhase,
  promoteWorkspaceError,
  onClosePromoteWorkspace,
  onConfirmPromoteWorkspace,
  onCloseThemePicker,
  onCloseAgentPicker,
  onCloseAgentCreate,
  onConfigSaved,
  onThemeChange,
  onAgentProviderSelect,
  onAgentCloneSelect,
  onAgentCreateConfirm,
  onReplayOnboarding,
  onAccountDeleted,
}) => {
  const handleThemeAudioConfigChange = useCallback((partial: ThemePickerAudioPartial) => {
    onConfigSaved(mergeWithDefaults({
      ...config,
      ...partial,
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
          onReplayOnboarding={onReplayOnboarding}
          onAccountDeleted={onAccountDeleted}
        />
      )}

      {orgModalOpen && (
        <OrganizationsView
          onClose={onCloseOrganizations}
          onOrgWorkspacesMutated={onOrgWorkspacesMutated}
          onOpenWorkspace={onOpenOrgWorkspace}
        />
      )}

      <OrgWorkspaceTabPickerModal
        open={orgWorkspacePickerOpen}
        accountId={orgWorkspacePickerAccountId}
        onClose={onCloseOrgWorkspacePicker}
        onConfirm={onConfirmOrgWorkspacePicker}
        catalog={orgWorkspaceCatalogEntries}
      />

      <PromoteWorkspaceModal
        open={promoteWorkspaceOpen}
        folderPath={promoteWorkspaceFolderPath}
        orgs={promoteWorkspaceOrgs}
        orgsEmptyReason={promoteWorkspaceOrgsReason}
        repos={promoteWorkspaceRepos}
        busy={promoteWorkspaceBusy}
        phase={promoteWorkspacePhase}
        error={promoteWorkspaceError}
        onClose={onClosePromoteWorkspace}
        onConfirm={onConfirmPromoteWorkspace}
      />

      <ThemePickerModal
        open={themePickerOpen}
        currentThemeId={config.themeId}
        musicEnabled={config.musicEnabled}
        onSelectTheme={onThemeChange}
        onAudioConfigChange={handleThemeAudioConfigChange}
        onClose={onCloseThemePicker}
      />
    </>
  )
}
