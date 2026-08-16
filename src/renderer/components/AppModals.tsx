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
import type { ThemePickerAudioPartial } from './ThemePickerAudioControls'
import type { OrchestratorPath } from '@shared/onboarding'
import type { OnboardingStepId } from '@shared/onboardingSteps'
import { OnboardingView, type OnboardingCliRow } from './onboarding'

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
  onReplayOnboarding?: () => void
  onboardingOpen: boolean
  onboardingStep: number
  onboardingSteps: OnboardingStepId[]
  onboardingPath: OrchestratorPath | ''
  onboardingClis: OnboardingCliRow[]
  onboardingCliLoading: boolean
  onboardingCliError: boolean
  onboardingTeamCreated: boolean
  onboardingFolderPath: string | null
  onboardingCanCreateTeam: boolean
  onboardingCanOpenBrainstorm: boolean
  onOnboardingNext: () => void
  onOnboardingBack: () => void
  onOnboardingSkip: () => void
  onOnboardingFinish: () => void
  onOnboardingRecheck: () => void
  onOnboardingPickFolder: () => void
  onOnboardingCreateTeam: () => void
  onOnboardingOpenBrainstorm: () => void
  onOnboardingLoadOrgWorkspace: () => void
  onOnboardingSelectPath: (path: OrchestratorPath) => void
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
  onReplayOnboarding,
  onboardingOpen,
  onboardingStep,
  onboardingSteps,
  onboardingPath,
  onboardingClis,
  onboardingCliLoading,
  onboardingCliError,
  onboardingTeamCreated,
  onboardingFolderPath,
  onboardingCanCreateTeam,
  onboardingCanOpenBrainstorm,
  onOnboardingNext,
  onOnboardingBack,
  onOnboardingSkip,
  onOnboardingFinish,
  onOnboardingRecheck,
  onOnboardingPickFolder,
  onOnboardingCreateTeam,
  onOnboardingOpenBrainstorm,
  onOnboardingLoadOrgWorkspace,
  onOnboardingSelectPath,
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
        />
      )}

      {orgModalOpen && (
        <OrganizationsView
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
        onSelectTheme={onThemeChange}
        onAudioConfigChange={handleThemeAudioConfigChange}
        onClose={onCloseThemePicker}
      />

      <OnboardingView
        open={onboardingOpen}
        stepIndex={onboardingStep}
        steps={onboardingSteps}
        path={onboardingPath}
        onSelectPath={onOnboardingSelectPath}
        onNext={onOnboardingNext}
        onBack={onOnboardingBack}
        onSkip={onOnboardingSkip}
        onFinish={onOnboardingFinish}
        cliRows={onboardingClis}
        loading={onboardingCliLoading}
        cliError={onboardingCliError}
        onRecheck={onOnboardingRecheck}
        folderPath={onboardingFolderPath}
        onPickFolder={onOnboardingPickFolder}
        canCreateTeam={onboardingCanCreateTeam}
        teamCreated={onboardingTeamCreated}
        onCreateTeam={onOnboardingCreateTeam}
        canOpenBrainstorm={onboardingCanOpenBrainstorm}
        onOpenBrainstorm={onOnboardingOpenBrainstorm}
        onLoadOrgWorkspace={onOnboardingLoadOrgWorkspace}
      />
    </>
  )
}
