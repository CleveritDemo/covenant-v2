# Clases and methods
<!-- iaterminal:context {"version":1,"id":"iaterminal:symbols:Clases-and-methods","name":"Clases and methods","fileName":"Clases-and-methods.md","kind":"symbols","icon":"code","color":"#2dd4bf","symbolKinds":["class","method"]} -->

<!-- iaterminal:auto -->
### electron/agentCliModelsList.ts
- parseCursorModelsStdout
- parseClaudeModelsStdout
- parseCopilotModelsStdout
- parseOpencodeModelsStdout
- parsePiModelsStdout
- parseModelsStdout
- runCliCapture
- extractCopilotModelsFromPackage
- listAgentCliModels

### electron/agentCliResolve.ts
- parseCliVersion
- resolveAgentCli
- clearAgentCliVersionCache

### electron/agentCliRuntime.ts
- registerTurnCleanup
- recordTurnUsage
- getContextDeliveryMetrics
- clearContextDeliveryMetrics
- shouldForceFullContextRefresh
- resolveProjectCwd
- clearAgentContextDeliveryState
- clearAgentContextDeliveryForSession
- materializeClipboardImages
- shouldFinishOnProcessClose
- closeAgentCliStdin
- claudeTurnUsage
- normalizeClaudeEvent

### electron/agentFileOps.ts
- resolveSafeProjectPath
- readProjectFile
- writeProjectFile
- readProjectFileLines
- applyProjectPatch

### electron/agentHeadlessRun.ts
- headlessRunKey
- runHeadlessAgentTurn
- stopHeadlessAgentRuns

### electron/agentMd.ts
- resolveAgentMdPath
- readAgentMdForCwd
- writeAgentMdForCwd
- gatherShallowFolderTree

### electron/agentShellOps.ts
- runAgentShellCommand

### electron/aiAgentDelegate.ts
- extractAiAgentDelegates
- buildAiAgentDelegateInstruction
- buildAiAgentProductOwnerInstruction

### electron/aiAgentResults.ts
- agentResultSlug
- resolveResultsAgentId
- agentResultFileName
- agentResultContextId
- resolveAiAgentResultsPath
- extractAiAgentResults
- formatLatestBody
- formatCompactResultLogLine
- formatAiAgentResultsDocument
- rewriteProjectAgentContextIds
- pruneOrphanAgentResults
- pruneProjectAgentContextIds
- migrateLegacyAgentResults

### electron/aiChangelog.ts
- extractAiChangelog
- resolveAiChangelogPath
- readAiChangelog
- formatAiChangelogDocument
- ensureAiChangelog
- writeAiChangelogDocument
- appendAiChangelog
- buildAiChangelogInstruction

### electron/brainstormCatalogOps.ts
- listBrainstormRooms
- upsertBrainstormRoom
- deleteBrainstormRoom
- pruneBrainstormRooms
- exportBrainstormRoomMarkdown

### electron/brainstormRoom.ts
- defaultRunBrainstormSpeakerTurn
- resolveWorkingSetContexts
- readWorkingSetFiles
- brainstormWorkingSetLabels
- runBrainstormSequence
- startBrainstormRoom

### electron/cdRecentCapture.ts
- ensureSessionCdState
- clearSessionCdState
- clearPersistedSessionCwd
- getSessionCwd
- initSessionCwd
- recordCdFromUserLine

### electron/cdRecentMd.ts
- getCdRecentFilePath
- readCdRecentFolders
- appendCdRecentFolder

### electron/covenantApi.ts
- CovenantApiError:
- exchange
- status
- signOut
- initCovenantSession
- listOrgs
- createOrg
- listMembers
- listMemberLogins
- addMember
- removeMember
- listDefaults
- setDefault
- unsetDefault
- listWorkspaces
- createWorkspace
- renameWorkspace
- deleteWorkspace
- addAssignee
- removeAssignee
- addWorkspaceAdmin
- removeWorkspaceAdmin
- listWorkspaceAgents
- upsertWorkspaceAgent
- deleteWorkspaceAgent
- listWorkspaceContexts
- upsertWorkspaceContext
- deleteWorkspaceContext
- renameWorkspaceContext
- listWikiPages
- upsertWikiPage
- deleteWikiPage
- appendWikiLog
- listWikiLog
- mapWorkspaceRepoRecord
- listWorkspaceRepos

### electron/covenantSession.ts
- persistCovenantSession
- clearCovenantSession
- loadCovenantSession

### electron/dictationRuntime.ts
- DictationRuntime: setEmit, lastHelperStderr, availability, requestMicrophoneAccess, start, stop, dispose, ensureProcessReady, spawnProcess, writeCommand, onStdout, handleEvent
- parseDictationHelperLine
- parsePeakFromMessage
- isSilentDictationPeak
- classifyEmptyDictationStop
- isValidDictationAudioFormat
- resolveMacDictationHelperPath
- dictationAvailabilityForPlatform

### electron/discordPresence.ts
- setPresence
- clearPresence

### electron/fileExplorerClipboardOps.ts
- isPathInside
- copyPathsForExplorer
- cutPathsForExplorer
- pasteIntoExplorer

### electron/fileExplorerOps.ts
- listDirChildren
- loadFileForExplorer
- saveFileForExplorer
- createFileForExplorer
- createDirForExplorer
- deletePathForExplorer
- renamePathForExplorer
- movePathForExplorer
- revealPathForExplorer
- searchProjectFiles

### electron/fileExplorerWatcher.ts
- pauseFileExplorerWatchesForCwd
- startFileExplorerWatch
- stopFileExplorerWatch
- stopAllFileExplorerWatches

### electron/githubActionsOps.ts
- parseGitHubRemoteUrl
- githubRunJobsForSession
- githubActionsListForSession

### electron/githubApi.ts
- GitHubApiError:
- githubFetch
- fetchRunJobs
- fetchGitHubIdentity
- mapRestWorkflowRun
- fetchWorkflowRuns

### electron/githubToken.ts
- readGithubTokenFromGitCredential
- resolveGithubToken

### electron/gitSessionOps.ts
- resolveWorkingDir
- gitListRepos
- gitCollectUniqueRepos
- runGit
- repoAndBranch
- getRepoRoot
- gitGetRepoStatus
- gitDiffForAi
- validateCommitMessage
- gitPull
- gitPush
- gitCommit
- gitStageAll
- gitStageFile
- gitUnstageAll

### electron/gitWorktreeOps.ts
- gitCurrentBranch
- gitWorktreeAdd
- gitWorktreeMerge
- gitWorktreeAbortMerge
- gitWorktreeRemove
- gitWorktreeList

### electron/headlessTurnQueue.ts
- acquireHeadlessTurnSlot
- releaseHeadlessTurnSlot
- clearHeadlessTurnQueueForTests

### electron/httpFetch.ts
- httpFetch
- describeFetchError

### electron/jiraClient.ts
- clearJiraCache
- jiraMyself
- jiraSearch
- jiraGetIssue

### electron/jiraConfig.ts
- readJiraConfig
- writeJiraConfig
- readJiraCredentials
- writeJiraCredentials
- deleteJiraCredentials

### electron/jiraContextRefresh.ts
- clearJiraRefreshFailures
- refreshStaleJiraContexts

### electron/jiraGitignore.ts
- ensureJiraGitignore

### electron/jiraIpcOps.ts
- jiraStatusFor
- connectJira
- disconnectJira
- previewJiraIssue
- searchJiraQuick

### electron/loopChainRun.ts
- defaultRunLoopChainTurn
- runLoopChainSequence
- startLoopChainRun
- stopLoopChainRun
- stopLoopChainRunsForWindow
- stopAllLoopChainRuns
- getLoopChainRunState
- getLoopChainTranscript
- clearLoopChainRunsForTests

### electron/loopChainTranscript.ts
- loadLoopChainTranscript
- appendLoopChainTranscriptEntry
- resetLoopChainTranscriptForTests

### electron/lsp/framing.ts
- FrameDecoder: push
- encodeFrame

### electron/lsp/install.ts
- installRoot
- entryPath
- isInstalled
- installedSize
- removeInstall
- installFromBytes
- downloadServer
- npmInstallServer
- copyDirAll

### electron/lsp/lspOps.ts
- initLspEngine
- lspServerStatus
- lspRecheckRuntimes
- lspDownloadServer
- lspListInstalled
- lspDeleteServer
- lspStart
- lspSend
- lspStop
- stopAllLspServers

### electron/lsp/registry.ts
- allSpecs
- specForLanguage
- platformKey
- artifactFor
- installKind

### electron/lsp/root.ts
- detectRoot

### electron/lsp/runtimeDetect.ts
- detectRuntime
- detectRuntimeCached
- clearRuntimeCache
- extractVersion
- versionGe
- pickNewestSatisfying
- suggestRuntimeFix
- runtimeBinDir

### electron/lsp/serverProcess.ts
- spawnLspServer

### electron/mcpConfigFile.ts
- writeScopedMcpConfig
- readProjectMcpConfig
- readCopilotMcpConfig
- readMcpConfigFor
- mcpConfigPathFor
- ensureMcpConfigFile
- mcpServerNames
- mcpServersToDisable
- readMcpConfigText
- writeMcpConfigText

### electron/mcpProbe.ts
- copilotMcpOAuthCached
- withMcpServerLiveness

### electron/onboardingCliDetect.ts
- detectOnboardingClis

### electron/openExternalUrl.ts
- isHttpUrl
- openExternalHttpUrl

### electron/orgWorkspaceClone.ts
- sanitizeSlug
- lastPathSegment
- buildWorkspaceDir
- cloneOrgWorkspace

### electron/otelEnv.ts
- otelEnvFromConfig

### electron/persistence.ts
- loadSession
- saveSession
- loadAiChat
- saveAiChat
- deleteAiChat
- loadCmdHistory
- saveCmdHistory
- deleteCmdHistory
- loadInteractionsLog
- saveInteractionsLog
- deleteInteractionsLog
- loadScrollback
- saveScrollback
- deleteScrollback
- loadAgentChat
- saveAgentChat
- deleteAgentChat

### electron/pluginDirs.ts
- readInstalledPlugins

### electron/projectAgentCatalogOps.ts
- listProjectAgents
- upsertProjectAgent
- deleteProjectAgent
- renameProjectAgent
- migratePersistedSessionAgents

### electron/projectAiContext.ts
- gatherProjectAiContextForCwd

### electron/projectDir.ts
- projectDirName
- projectDirPath

### electron/pulseStore.ts
- recordPulseEvent
- parsePulseLines
- readPulseEvents
- pulseSnapshot

### electron/safeStorageUtils.ts
- encryptField
- decryptField
- isEncryptedField

### electron/selfUpdate.ts
- isInstallingUpdate
- setAutoUpdatesEnabled
- registerSelfUpdate

### electron/shellCwdSync.ts
- extractOsc7CwdFromChunk
- isExistingDirectory
- resolveCdTarget
- patchEnvForCwdReporting

### electron/shellPathEnv.ts
- splitPath
- mergePathEntries
- defaultExtraBinDirsUnix
- defaultExtraBinDirsWin
- defaultExtraBinDirs
- readLoginShellEnv
- parseShellEnv
- mergeShellEnv
- readWindowsPersistentPath
- applyLoginShellPath
- resolveCliExecutable
- resolveCommandAbsolutePath
- formatCliSpawnFailure

### electron/tabContextReveal.ts
- resolveTabContextRevealPath

### electron/turnFileChanges.ts
- beginTurnFileBaseline
- captureWorkspaceSnapshotMetadata
- resolveTurnChangedPaths
- captureWorkspaceSnapshot
- changedWorkspacePaths

### electron/wikiCurator.ts
- wikiCuratorPaneId
- readWikiCuratorConfig
- writeWikiCuratorConfig
- isWikiCuratorConfigEmpty
- wikiCuratorConfigFromApp
- applyWikiCuratorConfigToApp
- maybeMigrateWikiCuratorFromProject
- startWikiCuratorTurn
- stopWikiCuratorTurn
- clearWikiCuratorForTests

### electron/wikiIngest.ts
- applyWikiIngestFromFinalText

### electron/wikiStore.ts
- wikiRootPath
- hasWiki
- ensureWiki
- ensureWikiWithSeed
- readWikiPages
- readWikiLogTail
- replaceWikiLogFromServer
- replaceWikiPagesFromServer
- applyWikiIngest

### src/ai/aiClient.ts
- chatAI
- suggestGitCommitMessage
- aiOptionsFromConfig

### src/ai/anthropicClient.ts
- chatAnthropic

### src/ai/ollamaClient.ts
- chatOllama

### src/ai/openaiClient.ts
- chatOpenAI

### src/ai/sseStream.ts
- readSSEStream

### src/i18n/index.ts
- initI18n

### src/i18n/modKeyLabel.ts
- modKeyLabel
- shortcutLabel

### src/i18n/useT.ts
- useT

### src/renderer/agent/activeParentDelegation.ts
- rememberActiveParentDelegation
- peekActiveParentDelegation
- clearActiveParentDelegation
- resetActiveParentDelegationsForTests

### src/renderer/agent/AgentChatBubbles.tsx
- AgentChatBubbles

### src/renderer/agent/agentChatSaveSchedule.ts
- createAgentChatSaveSchedule
- scheduleAgentChatSave
- flushAgentChatSave
- cancelAgentChatSave
- resetAgentChatSaveScheduleForTests

### src/renderer/agent/AgentConfigContextSummary.tsx
- AgentConfigContextSummary

### src/renderer/agent/AgentConfigFolderChip.tsx
- AgentConfigFolderChip

### src/renderer/agent/AgentConfigHero.tsx
- AgentConfigHero

### src/renderer/agent/AgentConfigIdentityColumn.tsx
- AgentConfigIdentityColumn

### src/renderer/agent/AgentConfigLockBanner.tsx
- AgentConfigLockBanner

### src/renderer/agent/AgentConfigModal.tsx
- AgentConfigModal

### src/renderer/agent/AgentConfigSectionRail.tsx
- AgentConfigSectionRail

### src/renderer/agent/AgentConfigSettingsPane.tsx
- AgentConfigSettingsPane

### src/renderer/agent/AgentConfigSlugField.tsx
- AgentConfigSlugField

### src/renderer/agent/AgentCreateNameModal.tsx
- AgentCreateNameModal

### src/renderer/agent/AgentDelegateToPolicyEditor.tsx
- AgentDelegateToPolicyEditor

### src/renderer/agent/AgentDelegatingIndicator.tsx
- AgentDelegatingIndicator

### src/renderer/agent/agentInputGuards.ts
- isAgentHumanInputBlocked
- canStartHumanTurnNow
- canDrainAgentQueue
- shouldShowComposerStop
- shouldPromoteHumanSendToVisibleQueue

### src/renderer/agent/AgentLoopIntervalModal.tsx
- AgentLoopIntervalModal

### src/renderer/agent/AgentPane.tsx
- collectRunningThreadIds
- lastUserPromptFromMessages
- collectRunningThreadActivities
- mergePaneReportedRunningThreadIds

### src/renderer/agent/AgentPaneFooter.tsx
- AgentPaneFooter

### src/renderer/agent/AgentPaneMessages.tsx
- AgentPaneMessages

### src/renderer/agent/AgentPaneSendButton.tsx
- AgentPaneSendButton

### src/renderer/agent/agentPlaneStatusIdle.ts
- queuedTurnsPlaneStatusEqual
- resolvePlaneStatusMessages

### src/renderer/agent/AgentProviderGrid.tsx
- AgentProviderGrid

### src/renderer/agent/AgentProviderPickerModal.tsx
- AgentProviderPickerModal

### src/renderer/agent/AgentRulesEditor.tsx
- AgentRulesEditor

### src/renderer/agent/agentTurnContextPayload.ts
- buildAgentTurnContextPayload

### src/renderer/agent/assistantDeltaThrottle.ts
- createAssistantDeltaThrottler

### src/renderer/agent/composerImages.ts
- publishedQueueImagePreviewUrl
- extensionForMime
- blobToBase64
- optimizeImageForModel
- blobToThumbnailDataUrl
- imagesFromClipboard
- pendingImageFromBlob
- materializeClipboardImage
- pendingImagesToAttachments
- attachmentsToPendingImages

### src/renderer/agent/consumedSendIds.ts
- wasSendIdConsumed
- rememberConsumedSendId

### src/renderer/agent/contextsToRematerializeAfterTurn.ts
- contextsToRematerializeAfterTurn

### src/renderer/agent/DelegationResultCard.tsx
- DelegationResultCard

### src/renderer/agent/Gravity.tsx
- Gravity

### src/renderer/agent/McpConfigEditor.tsx
- McpConfigEditor

### src/renderer/agent/McpToolShelf.tsx
- McpToolShelf

### src/renderer/agent/mergeQueuedTurns.ts
- mergeQueuedTurns

### src/renderer/agent/newThreadIntent.ts
- shouldDeferNewThread
- canApplyDeferredNewThread

### src/renderer/agent/paneThreadLanes.ts
- getLane
- startLane
- appendLaneText
- setLaneActivity
- endLane

### src/renderer/agent/paneWorkActive.ts
- isPaneWorkActive
- collectBusyTabIds

### src/renderer/agent/parentDelegationNotify.ts
- decideParentDelegationNotify

### src/renderer/agent/planeStatusThrottle.ts
- createPlaneStatusThrottler

### src/renderer/agent/preferSendIntake.ts
- planPreferSendIntake

### src/renderer/agent/queuedTurnDedup.ts
- isHumanQueuedTurn
- queuedTurnHumanKey
- queuedTurnSourceSendIds
- shouldClearPlaneSendForRemovedQueuedTurn
- appendQueuedTurnIfRoom
- removeQueuedTurnById

### src/renderer/agent/QueuedTurnEditModal.tsx
- QueuedTurnEditModal

### src/renderer/agent/QueuedTurnPreviewLabel.tsx
- formatQueuedTurnPreviewText
- QueuedTurnPreviewLabel

### src/renderer/agent/shouldResumeCliSessionForTurn.ts
- shouldResumeCliSessionForTurn

### src/renderer/agent/TabContextAppearancePopup.tsx
- TabContextAppearancePopup

### src/renderer/agent/TabContextBudgetMeter.tsx
- TabContextBudgetMeter

### src/renderer/agent/TabContextColorSwatch.tsx
- TabContextColorSwatch

### src/renderer/agent/TabContextFormModal.tsx
- jiraDraftFromKey
- TabContextFormModal

### src/renderer/agent/TabContextIconSwatch.tsx
- TabContextIconSwatch

### src/renderer/agent/TabContextKindCard.tsx
- TabContextKindCard

### src/renderer/agent/tabContextKindIcons.ts
- contextIconName
- appearanceIconName

### src/renderer/agent/TabContextRootPathField.tsx
- TabContextRootPathField

### src/renderer/agent/TabContextsEditor.tsx
- TabContextsEditor

### src/renderer/agent/TabContextsList.tsx
- agentFaceColor
- AgentFace
- TabContextsList

### src/renderer/agent/TabContextsListPreview.tsx
- TabContextsListPreview

### src/renderer/agent/TabContextsModal.tsx
- TabContextsModal

### src/renderer/agent/turnFailureState.ts
- turnFailedAfter

### src/renderer/agent/useAgentCliStatuses.ts
- useAgentCliStatuses

### src/renderer/App.tsx
- App

### src/renderer/arrayReorder.ts
- moveItemToIndex
- swapItemsAtIndices
- computeTabInsertIndex
- dropPlaceFromPointer
- isDragLeaveForContainer
- reorderPaneIdsByKind
- insertIndexFromPointerY
- previewInsertIndexFromPointerY
- orderWithDragInsert

### src/renderer/components/AgentCliTable.tsx
- AgentCliTable

### src/renderer/components/ai/aiMessagesScroll.ts
- getAiMessagesMaxScrollTop
- isAiMessagesNearBottom
- scrollAiMessagesToBottom

### src/renderer/components/ai/assistantBodySegments.ts
- stripAgentControlFences
- findAssistantBodyLiveStart
- splitAssistantBody

### src/renderer/components/ai/AssistantFormattedBody.tsx
- AssistantFormattedBody

### src/renderer/components/ai/ChatBubble.tsx
- ChatBubble

### src/renderer/components/ai/DelegationAssemblingPlaceholder.tsx
- DelegationAssemblingPlaceholder

### src/renderer/components/ai/useAiMessagesFollowScroll.ts
- useAiMessagesFollowScroll

### src/renderer/components/AiCodeBlock.tsx
- AiCodeBlock

### src/renderer/components/AiMarkdown.tsx
- splitChatSentences
- parseAiMarkdownBlocks
- parseAiMarkdownBlocksIncremental
- AiMarkdown

### src/renderer/components/AppModals.tsx
- AppModals

### src/renderer/components/ConfirmTerminalModal.tsx
- ConfirmTerminalModal

### src/renderer/components/DictationListeningOverlay.tsx
- DictationListeningOverlay

### src/renderer/components/FontSizeControl.tsx
- FontSizeControl

### src/renderer/components/git/GitBranchBadge.tsx
- GitBranchBadge

### src/renderer/components/git/gitDiffNumStat.ts
- parseGitNumStat
- gitEntryAreaStats
- gitAreaTotals
- gitFileLineStats

### src/renderer/components/git/GitDiffPane.tsx
- GitDiffPane

### src/renderer/components/git/gitErrorI18n.ts
- gitErrorMessage
- formatGitCommandResult

### src/renderer/components/git/GitFileList.tsx
- GitFileList

### src/renderer/components/git/GitHubActionsJobList.tsx
- GitHubActionsJobList

### src/renderer/components/git/GitHubActionsPanel.tsx
- GitHubActionsPanel

### src/renderer/components/git/GitHubActionsRunRow.tsx
- GitHubActionsRunRow

### src/renderer/components/git/gitPathUtils.ts
- gitWorktreePath
- isGitEntryFullyStaged
- canGitUnstageEntry
- canGitStageEntry
- hasGitStagedChanges
- hasGitUnstagedChanges
- splitGitFilesByArea
- gitDisplayFileName
- shortPathTail
- gitSplitDisplayPath
- filterGitEntries
- gitStatusKind

### src/renderer/components/git/gitWorktreeOptions.ts
- gitWorktreeOptions

### src/renderer/components/GitHubTokenField.tsx
- GitHubTokenField

### src/renderer/components/GitPanelModal.tsx
- GitPanelModal

### src/renderer/components/GitRepoPickerModal.tsx
- GitRepoPickerModal

### src/renderer/components/GravityHeroCanvas.tsx
- GravityHeroCanvas

### src/renderer/components/HeroConfirmOverlay.tsx
- HeroConfirmOverlay

### src/renderer/components/JiraConnectionField.tsx
- JiraConnectionField

### src/renderer/components/JsonTree.tsx
- parseJsonTree
- JsonTree

### src/renderer/components/MusicSpectrum.tsx
- MusicSpectrum

### src/renderer/components/onboarding/OnboardingModal.tsx
- OnboardingModal

### src/renderer/components/onboarding/OnboardingStepFirstMessage.tsx
- OnboardingStepFirstMessage

### src/renderer/components/onboarding/OnboardingStepFolder.tsx
- OnboardingStepFolder

### src/renderer/components/onboarding/OnboardingStepper.tsx
- OnboardingStepper

### src/renderer/components/onboarding/OnboardingStepRequirements.tsx
- OnboardingStepRequirements

### src/renderer/components/onboarding/OnboardingStepTeam.tsx
- OnboardingStepTeam

### src/renderer/components/onboarding/OnboardingStepWelcome.tsx
- OnboardingStepWelcome

### src/renderer/components/OrganizationsModal.tsx
- OrganizationsModal

### src/renderer/components/OrgSectionStatus.tsx
- SectionStatus
- MemberPickRow

### src/renderer/components/OrgSettingsPanel.tsx
- OrgSettingsPanel

### src/renderer/components/OrgWorkspaceRequirementModal.tsx
- OrgWorkspaceRequirementModal

### src/renderer/components/OrgWorkspaceTabPickerModal.tsx
- OrgWorkspaceTabPickerModal

### src/renderer/components/PendingImageThumb.tsx
- PendingImageThumb

### src/renderer/components/SettingsFontFamilyField.tsx
- SettingsFontFamilyField

### src/renderer/components/SettingsModal.tsx
- SettingsModal

### src/renderer/components/SettingsSection.tsx
- SettingsSection
- SettingsField

### src/renderer/components/TabAddButton.tsx
- TabAddButton

### src/renderer/components/TabBar.tsx
- TabBar

### src/renderer/components/TabItem.tsx
- TabItem

### src/renderer/components/TerminalFindModal.tsx
- TerminalFindModal

### src/renderer/components/TerminalModal.tsx
- TerminalModal

### src/renderer/components/ThemeChip.tsx
- ThemeChip

### src/renderer/components/ThemePickerAudioControls.tsx
- ThemePickerAudioControls

### src/renderer/components/ThemePickerModal.tsx
- ThemePickerModal

### src/renderer/components/ThemePickerTrigger.tsx
- ThemePickerTrigger

### src/renderer/components/ThemePreview.tsx
- ThemePreview

### src/renderer/components/Titlebar.tsx
- Titlebar

### src/renderer/components/TitlebarClock.tsx
- TitlebarClock

### src/renderer/components/TitlebarMusicControls.tsx
- TitlebarMusicControls

### src/renderer/components/ui/Badge.tsx
- Badge

### src/renderer/components/ui/BrandIcon.tsx
- BrandIcon

### src/renderer/components/ui/Button.tsx
- Button

### src/renderer/components/ui/ChoiceCard.tsx
- ChoiceCard

### src/renderer/components/ui/ContextCheckOption.tsx
- ContextCheckOption

### src/renderer/components/ui/Input.tsx
- Input

### src/renderer/components/ui/SegmentedControl.tsx
- SegmentedControl

### src/renderer/components/ui/Select.tsx
- Select

### src/renderer/components/ui/SettingToggle.tsx
- SettingToggle

### src/renderer/components/ui/Spinner.tsx
- Spinner

### src/renderer/components/ui/TextArea.tsx
- TextArea

### src/renderer/components/ui/Toggle.tsx
- Toggle

### src/renderer/components/ui/Tooltip.tsx
- Tooltip

### src/renderer/components/UpdateBanner.tsx
- UpdateBanner

### src/renderer/components/WorkspaceDetailPanel.tsx
- WorkspaceDetailPanel

### src/renderer/covenantApi.ts
- getCovenantApi
- hasCovenantMemberLoginsApi
- hasCovenantOrgAdminsApi
- hasCovenantWorkspacesApi
- hasCovenantWorkspaceContentApi
- hasCovenantWikiApi
- hasCovenantWorkspaceReposApi
- slugifyOrgName

### src/renderer/dragThumbnailUtils.ts
- buildTabDragThumbnail

### src/renderer/fontAvailability.ts
- isFontInstalled
- isMonospaced
- availableFonts

### src/renderer/history/feedCompletedUserLines.ts
- backwardKillWordDraft
- feedCompletedUserLines

### src/renderer/lsp/client.ts
- LspClient: initialize, didOpen, openSolution, openProject, didChange, didClose, definition, hover, references, completion, rename, codeAction, executeCommand, onDiagnostics, dispose, request, notify, handleMessage

### src/renderer/lsp/cm6.ts
- LightbulbMarker: eq, toDOM
- lspExtensions
- lspCompletionSource
- applyLspDiagnostics

### src/renderer/lsp/CodeIntelligenceSettings.tsx
- CodeIntelligenceSettings

### src/renderer/lsp/CodeIntelServerRow.tsx
- CodeIntelServerRow

### src/renderer/lsp/edits.ts
- applyTextEdits
- editsByUri
- countFiles
- applyWorkspaceEdit

### src/renderer/lsp/lru.ts
- LruIdlePolicy: touch, evictIfOverCap, release, sweep, remove

### src/renderer/lsp/LspRuntimeHint.tsx
- LspRuntimeHint

### src/renderer/lsp/LspStatusBanner.tsx
- LspStatusBanner

### src/renderer/lsp/manager.ts
- IpcTransport: send, onMessage, deliver, dispose
- LspDoc: changeIncremental, close, onDiagnostics
- LspManager: ensureSweepTimer, maybeClearSweepTimer, status, download, createEntry, open, dropServer
- codeIntelEnabled
- setCodeIntelEnabled
- consentState
- grantConsentFor
- onCodeIntelChange

### src/renderer/lsp/positions.ts
- offsetToLsp
- lspToOffset
- lspRangeToCm
- pathToUri
- uriToPath

### src/renderer/onboardingGate.ts
- shouldOpenOnboarding
- mapCliRows

### src/renderer/orchestrationAbort.ts
- clearPlaneSendsForOrchestrationAbort
- shouldDiscardAbortedDelegationFifoHead
- filterQueuedTurnsAfterOrchestrationAbort
- filterQueuedTurnsAfterSingleDelegationAbort
- clearPlaneSendsForSingleDelegationAbort
- resolveSingleDelegationLaneStop
- collectOrchestratorPendingLaneStops
- applyDelegationLaneStop

### src/renderer/orgWikiSync.ts
- orgWikiSyncScopeKey
- hasOrgWikiSyncScope
- clearOrgWikiSyncScope
- orgWikiPageHash
- seedOrgWikiSyncScope
- wikiLogEntryLines
- wikiLogEntryForMatch
- wikiLogEntryForServer
- syncOrgWikiPush

### src/renderer/orgWorkspaceMaterialize.ts
- wikiPullPagesFromRecords
- downloadOrgWorkspaceToLocal
- uploadOrgWorkspaceFromLocal

### src/renderer/presence.ts
- composePresence
- startDiscordPresence
- setDiscordPresenceEnabled

### src/renderer/projectAgentsStore.ts
- resolveTabAgentMeta
- upsertAgentInList
- mergeRemoteAgentsWithLocalOnly
- syncTabAgentsFromCatalog

### src/renderer/pushToTalkSpeech.ts
- isPushToTalkSpeechSupported
- usePushToTalkSpeech

### src/renderer/reduceMotion.ts
- isReduceMotionActive
- syncReduceMotionDomFlag

### src/renderer/sessionSanitize.ts
- stripOrgTabAgentCliSessionIds
- deriveTabCounter
- sanitizePersistedSession

### src/renderer/splash.ts
- markSplashUiReady
- whenSplashDismissed
- dismissSplash
- replaySplash

### src/renderer/tabFileExplorer.ts
- resolveTabTerminalPaneId
- tabExplorerSessionId
- resolveTabExplorerSessionId
- migrateExplorerStateByTab

### src/renderer/tabSplitSizes.ts
- getDefaultSplitSizes
- normalizeSplitSizes
- normalizeTabSession

### src/renderer/terminal/CdSuggest.tsx
- CdSuggest

### src/renderer/terminal/CmdSuggest.tsx
- CmdSuggest

### src/renderer/terminal/explorer/ExplorerConfirmHost.tsx
- ExplorerConfirmHost

### src/renderer/terminal/explorer/explorerListCache.ts
- sortExplorerEntries
- mergeListDirIntoCache

### src/renderer/terminal/explorer/explorerPathUtils.ts
- expandedPathsKey
- normalizeSessionCwd
- sessionCwdPaneLabel
- sessionCwdFolderName
- parentDirForCreate
- buildNewRelPath
- parentRelPath
- pasteDestRelPath
- remapChildRelPath
- isRelPathInside
- relPathFromCwd
- resolveExplorerActionPaths
- pathsAffectOpenFile
- seedMultiSelect
- ancestorRelPaths
- filterRowsKeepingAncestors

### src/renderer/terminal/explorer/ExplorerToast.tsx
- ExplorerToast

### src/renderer/terminal/explorer/ExplorerToolButton.tsx
- ExplorerToolButton

### src/renderer/terminal/explorer/FileCodeEditor.tsx
- FileCodeEditor

### src/renderer/terminal/explorer/FileEditorActionButton.tsx
- FileEditorActionButton

### src/renderer/terminal/explorer/FileEditorContextMenu.tsx
- FileEditorContextMenu

### src/renderer/terminal/explorer/FileEditorPanel.tsx
- FileEditorPanel

### src/renderer/terminal/explorer/FileExplorerContextMenu.tsx
- FileExplorerContextMenu

### src/renderer/terminal/explorer/FileExplorerCreateAction.tsx
- FileExplorerCreateAction

### src/renderer/terminal/explorer/FileExplorerEntryIcon.tsx
- FileExplorerEntryIcon

### src/renderer/terminal/explorer/fileExplorerErrorI18n.ts
- fileExplorerErrorMessage

### src/renderer/terminal/explorer/fileExplorerGitStatus.ts
- repoPrefixFromStatus
- buildGitStatusMap
- gitStatusFromMap
- sameGitStatusMap

### src/renderer/terminal/explorer/FileExplorerMenuItem.tsx
- FileExplorerMenuItem

### src/renderer/terminal/explorer/FileExplorerNewMenu.tsx
- FileExplorerNewMenu

### src/renderer/terminal/explorer/FileExplorerSidebar.tsx
- FileExplorerSidebar

### src/renderer/terminal/explorer/FileExplorerTree.tsx
- FileExplorerTree

### src/renderer/terminal/explorer/FileExplorerTreeNode.tsx
- FileExplorerTreeNode

### src/renderer/terminal/explorer/languageFromPath.ts
- languageExtensionForPath

### src/renderer/terminal/explorer/preview/CsvPreview.tsx
- CsvPreview

### src/renderer/terminal/explorer/preview/DocxPreview.tsx
- DocxPreview

### src/renderer/terminal/explorer/preview/FilePreview.tsx
- FilePreviewStatus
- FilePreview

### src/renderer/terminal/explorer/preview/useFileBytes.ts
- useFileBytes
- useBlobUrl

### src/renderer/terminal/explorer/preview/XlsxPreview.tsx
- XlsxPreview

### src/renderer/terminal/explorer/useExplorerResize.ts
- useExplorerResize

### src/renderer/terminal/isClearCommand.ts
- isClearCommandLine

### src/renderer/terminal/PaneToolbar.tsx
- PaneToolbar
- PaneToolbarButton

### src/renderer/terminal/PaneToolbarQuickOpen.tsx
- PaneToolbarQuickOpen

### src/renderer/terminal/quickOpenScore.ts
- scoreQuickOpenPath
- rankQuickOpenPaths
- splitPathHighlight

### src/renderer/terminal/terminalCanvasRepaint.ts
- repaintTerminalCanvas
- createTerminalRepaintScheduler

### src/renderer/terminal/terminalFindInBuffer.ts
- findMatchesInTerminalBuffer
- findMatchesInCommandHistory

### src/renderer/terminal/terminalScrollbackRestore.ts
- trimRestoredScrollback

### src/renderer/terminal/TerminalScrollDown.tsx
- TerminalScrollDown

### src/renderer/terminal/TerminalSuggestStack.tsx
- TerminalSuggestStack

### src/renderer/themeMusicEnergy.ts
- themeMusicBandEdges
- getThemeMusicEnergy
- getThemeMusicBands
- getThemeMusicBeat
- resumeThemeMusicEnergyContext
- attachThemeMusicAnalyser
- detachThemeMusicAnalyser
- __resetThemeMusicEnergyForTests

### src/renderer/uiSounds.ts
- playVoiceMessageSound
- resetVoiceMessageSoundForTests
- playAgentFinishSound
- resetAgentFinishSoundForTests

### src/renderer/updateBannerPreview.ts
- getUpdateBannerPreviewState
- getReleaseNotesPreviewToken
- previewReleaseNotes
- isUpdateBannerPreviewActive
- subscribeUpdateBannerPreview
- clearUpdateBannerPreview
- previewUpdateBanner

### src/renderer/workspace/BrainstormAgentPane.tsx
- BrainstormAgentPane

### src/renderer/workspace/BrainstormBriefFields.tsx
- BrainstormBriefFields

### src/renderer/workspace/BrainstormClosingCard.tsx
- BrainstormClosingCard

### src/renderer/workspace/BrainstormEditRoomModal.tsx
- BrainstormEditRoomModal

### src/renderer/workspace/BrainstormHumanComposer.tsx
- BrainstormHumanComposer

### src/renderer/workspace/BrainstormInviteGrid.tsx
- BrainstormInviteGrid

### src/renderer/workspace/brainstormLiveState.ts
- createInitialBrainstormLiveState
- createBrainstormLiveSummary
- reduceBrainstormLiveEvent

### src/renderer/workspace/BrainstormModuleTabs.tsx
- BrainstormModuleTabs

### src/renderer/workspace/BrainstormOverlay.tsx
- BrainstormOverlay

### src/renderer/workspace/BrainstormRoomMenu.tsx
- BrainstormRoomMenu

### src/renderer/workspace/BrainstormRoomsView.tsx
- BrainstormRoomsView

### src/renderer/workspace/BrainstormRoomView.tsx
- BrainstormRoomView

### src/renderer/workspace/BrainstormRoundsSlider.tsx
- BrainstormRoundsSlider

### src/renderer/workspace/BrainstormSeatCard.tsx
- BrainstormInviteSeatCard
- BrainstormLiveSeatCard

### src/renderer/workspace/BrainstormSentence.tsx
- BrainstormSentence

### src/renderer/workspace/BrainstormSpeakerWaiting.tsx
- BrainstormSpeakerWaiting

### src/renderer/workspace/BrainstormStartModal.tsx
- BrainstormStartModal

### src/renderer/workspace/brainstormUiGuards.ts
- canAdvanceBrainstormInviteStep
- tryCreateBrainstormSession

### src/renderer/workspace/brainstormViewClose.ts
- isBrainstormStoppable
- canPauseBrainstorm
- canResumeBrainstorm
- isBrainstormLive

### src/renderer/workspace/BrainstormWikiCard.tsx
- BrainstormWikiCard

### src/renderer/workspace/BrainstormWorkingSetField.tsx
- BrainstormWorkingSetField

### src/renderer/workspace/ceremonyLabels.ts
- ceremonyGateKey

### src/renderer/workspace/CeremonyPicker.tsx
- CeremonyPicker

### src/renderer/workspace/ContextBadge.tsx
- ContextBadge

### src/renderer/workspace/ContextContentPreviewModal.tsx
- ContextPreviewBody

### src/renderer/workspace/ContextReport.tsx
- contextReportMetaText
- ContextReport

### src/renderer/workspace/JiraIssueChip.tsx
- JiraIssueChip

### src/renderer/workspace/JiraMentionPicker.tsx
- JiraMentionPicker

### src/renderer/workspace/LoopChainTranscriptPanel.tsx
- LoopChainTranscriptPanel

### src/renderer/workspace/miniExpandSuppress.ts
- armMiniExpandSuppress
- isMiniExpandSuppressed
- setMiniExpandLocked

### src/renderer/workspace/orchestrationBridge.ts
- listOrchestrationTargets
- listDelegationTargetsForMeta
- resolveDelegationTargetPaneId

### src/renderer/workspace/PaneWindow.tsx
- clearPaneMorphNodeStyles
- resetPaneZoomSurfaceState
- PaneWindow

### src/renderer/workspace/PlaneAgentBadge.tsx
- PlaneAgentBadge

### src/renderer/workspace/PlaneAgentContextNodes.tsx
- PlaneAgentContextNodes

### src/renderer/workspace/PlaneAgentThreadNodes.tsx
- PlaneAgentThreadNodes

### src/renderer/workspace/PlaneBootstrapAgentsButton.tsx
- PlaneBootstrapAgentsButton

### src/renderer/workspace/PlaneBrainstormDock.tsx
- PlaneBrainstormDock

### src/renderer/workspace/PlaneBrainstormsListButton.tsx
- PlaneBrainstormsListButton

### src/renderer/workspace/PlaneBusyDot.tsx
- PlaneBusyDot

### src/renderer/workspace/PlaneChatCloseButton.tsx
- PlaneChatCloseButton

### src/renderer/workspace/PlaneChatComposer.tsx
- PlaneChatComposer

### src/renderer/workspace/PlaneChatComposerShell.tsx
- resizeComposerTextarea
- PlaneChatComposerShell

### src/renderer/workspace/PlaneChatContextsBar.tsx
- PlaneChatContextsBar

### src/renderer/workspace/PlaneChatDock.tsx
- PlaneChatDock

### src/renderer/workspace/PlaneChatQueueEditButton.tsx
- PlaneChatQueueEditButton

### src/renderer/workspace/PlaneChatRemoveChipButton.tsx
- PlaneChatRemoveChipButton

### src/renderer/workspace/PlaneChatSendButton.tsx
- PlaneChatSendButton

### src/renderer/workspace/PlaneChatThreadHistoryButton.tsx
- PlaneChatThreadHistoryButton

### src/renderer/workspace/PlaneColumnOverflowPill.tsx
- PlaneColumnOverflowPill

### src/renderer/workspace/planeColumnReorder.ts
- shouldCommitReorder
- usePlaneColumnReorder

### src/renderer/workspace/PlaneComposerAurora.tsx
- PlaneComposerAurora

### src/renderer/workspace/PlaneComposerAuroraParticles.tsx
- PlaneComposerAuroraParticles

### src/renderer/workspace/planeContextAssignmentLinkGeometry.ts
- buildContextAssignmentEdges
- focusedContextEdges
- contextConnectorAnchors
- contextConnectorPath
- buildContextConnectorPaths
- renderedContextLinksEqual

### src/renderer/workspace/PlaneContextAssignmentLinks.tsx
- PlaneContextAssignmentLinks

### src/renderer/workspace/PlaneContextAssignModal.tsx
- PlaneContextAssignModal

### src/renderer/workspace/PlaneContextCard.tsx
- PlaneContextCard

### src/renderer/workspace/PlaneContextChipMenu.tsx
- PlaneContextChipMenu

### src/renderer/workspace/planeContextDrag.ts
- setPlaneContextDragData
- hasPlaneContextDrag
- readPlaneContextDragData

### src/renderer/workspace/PlaneContextPool.tsx
- PlaneContextPool

### src/renderer/workspace/planeContextPoolLayout.ts
- assignedPaneIdsByContext
- listPoolContexts
- splitPoolContexts

### src/renderer/workspace/PlaneExplorerButton.tsx
- PlaneExplorerButton

### src/renderer/workspace/PlaneFab.tsx
- PlaneFab

### src/renderer/workspace/PlaneFabStack.tsx
- PlaneFabStack

### src/renderer/workspace/PlaneGitButton.tsx
- PlaneGitButton

### src/renderer/workspace/PlaneIdleGravity.tsx
- PlaneIdleGravity

### src/renderer/workspace/PlaneLoopModalSection.tsx
- PlaneLoopModalSection

### src/renderer/workspace/PlaneLoopsButton.tsx
- PlaneLoopsButton

### src/renderer/workspace/PlaneLoopsSection.tsx
- PlaneLoopsSection

### src/renderer/workspace/PlaneMap.tsx
- planeFloorAuroraActive
- computeColumnOverflowBandAnchors
- buildSlotOrigins
- PlaneMap

### src/renderer/workspace/PlaneMapBackdrop.tsx
- PlaneMapBackdrop

### src/renderer/workspace/PlaneMapGridParticles.tsx
- baseSizeForFrequencyBand
- easeVisualBeatPulse
- driftSpeedForBpm
- colorForFrequencyBand
- particleGridDims
- randomGridCell
- positionInGridCell
- assignRandomGridSlot
- PlaneMapGridParticles

### src/renderer/workspace/PlaneMiniActions.tsx
- PlaneMiniActions

### src/renderer/workspace/planeMiniCardOpen.ts
- isPlaneMiniInteractiveTarget
- openPlaneMiniCardFromPointerDown
- shouldSkipPlaneMiniCardClick
- markPlaneMiniCardOpenedFromPointer

### src/renderer/workspace/PlaneMiniFace.tsx
- PlaneMiniFace

### src/renderer/workspace/PlaneMiniFolderBadge.tsx
- PlaneMiniFolderBadge

### src/renderer/workspace/PlanePaneWindow.tsx
- PlanePaneWindow

### src/renderer/workspace/PlaneProjectFolder.tsx
- PlaneProjectFolder

### src/renderer/workspace/PlanePulseButton.tsx
- PlanePulseButton

### src/renderer/workspace/PlaneQueueFullNotice.tsx
- PlaneQueueFullNotice

### src/renderer/workspace/PlaneQuickChat.tsx
- PlaneQuickChat

### src/renderer/workspace/PlaneResyncButton.tsx
- PlaneResyncButton

### src/renderer/workspace/PlaneRevealFolderButton.tsx
- PlaneRevealFolderButton

### src/renderer/workspace/PlaneSketchButton.tsx
- PlaneSketchButton

### src/renderer/workspace/PlaneToolsRail.tsx
- PlaneToolsRail

### src/renderer/workspace/PlaneUploadButton.tsx
- PlaneUploadButton

### src/renderer/workspace/planeWheelTargets.ts
- hasNativeScrollAncestor

### src/renderer/workspace/PlaneWikiMapButton.tsx
- PlaneWikiMapButton

### src/renderer/workspace/PulseView.tsx
- PulseView

### src/renderer/workspace/resolveAssignedContextChips.ts
- resolveTabContextById
- resolveAssignedContextChips
- contextIdsEqual

### src/renderer/workspace/sketchGeometry.ts
- arrowHeadPoints
- boxFromDrag
- ellipseFromDrag

### src/renderer/workspace/SketchModal.tsx
- SketchModal

### src/renderer/workspace/TabFileExplorerWindow.tsx
- TabFileExplorerWindow

### src/renderer/workspace/useJiraMention.tsx
- useJiraMention

### src/renderer/workspace/useLoopChainLiveState.ts
- useLoopChainLiveState

### src/renderer/workspace/useWikiGraphScene.ts
- isLightAppearance
- edgeOpacityForAppearance
- boltLightIntensityMult
- boltGlowsEnabled
- resolveBoltVisualColor
- resolveBoltLightColor
- boltBlendingForAppearance
- useWikiGraphScene

### src/renderer/workspace/WikiCuratorComposer.tsx
- WikiCuratorComposer

### src/renderer/workspace/wikiGraph.ts
- createSeededRandom
- layoutWikiGraph
- wikiGraphMockData

### src/renderer/workspace/wikiGraphBoltTiming.ts
- computeInitialNodeFireAt
- computeNextNodeFireAt

### src/renderer/workspace/WikiGraphView.tsx
- wikiTypeLabelKey
- WikiGraphView

### src/shared/agentChatPersistence.ts
- agentChatKeyDigest
- resolveAgentChatStorageKey
- agentChatRefFor
- normalizeAgentChatRef
- shouldDeleteAgentChatOnCatalogCleanup
- planAgentChatCleanupForRemovedPanes

### src/shared/agentCliModels.ts
- modelsForProvider

### src/shared/agentCliProviders.ts
- isAgentCliProvider
- agentCliSpec
- providerCapabilities
- agentCliCommand

### src/shared/agentContextPicker.ts
- contextGroupId
- contextUsageByAgent
- filterAgentContexts
- groupAgentContexts

### src/shared/agentIdentity.ts
- sanitizeAgentMonogram
- sanitizeAgentTextDraft
- sanitizeAgentRulesDraft
- applyAgentIdentityDraft
- sanitizeAgentRulesEnabledDraft
- agentRulesForPrompt
- normalizeAgentRules
- buildAgentIdentityPrompt

### src/shared/agentLoop.ts
- loopIntervalPresetByMs
- formatLoopIntervalMs
- buildLoopPrompt
- stripLoopDoneMarker

### src/shared/agentModeHandoff.ts
- buildModeHandoffPrompt

### src/shared/agentOrchestration.ts
- isOrchestrationRoundsUnlimited
- orchestrationRoundsAtCap
- formatOrchestrationRoundLabel
- sanitizeOrchestrationMaxRounds
- resolveOrchestrationMaxRounds
- sanitizeOrchestrationWorkStyle
- resolveOrchestrationWorkStyle
- shouldAbortOnHumanTurn
- sanitizeAgentCoordination
- isOrchestrator
- isProductOwner
- coordinationCanDelegate
- defaultDelegateToPolicy
- sanitizeDelegateToPolicy
- delegateToPoliciesEqual
- resolveDelegateToPolicy
- persistableDelegateTo
- agentMatchesDelegateGroups
- listDelegationTargets
- listOrchestrationTargets
- listProductOwnerTargets
- sanitizeDelegateRequest
- parseDelegatePayload
- buildOrchestratorAgentsBlock

### src/shared/agentResultsDoc.ts
- parseAgentResultsDoc
- withAgentResultsNotes
- isAgentResultsDocEmpty
- formatLogTime
- groupLogEntriesByDay

### src/shared/agentRunKey.ts
- buildRunKey
- parseRunKey
- isRunKeyForPane

### src/shared/agentShellGuard.ts
- isDestructiveShellCommand
- requiresShellConfirmation

### src/shared/agentThreads.ts
- isThreadId
- threadTitleFrom
- activeThreadOf
- sortThreadsByRecency
- chipVisibleThreadIds
- threadHistoryCandidates
- paginateThreadHistory
- sanitizeThreadState
- threadPatch
- newThread
- isHumanThread
- humanThreadsByRecency
- resolvePreferredHumanThreadId
- resolveCardOpenThreadId
- markThreadOpened
- selectThread
- selectThreadOpened
- pruneCompletedDelegationThreads
- deleteThread
- setActiveThreadSession
- renameThread
- touchActiveThread
- stripThreadSessions

### src/shared/agileCeremonies.ts
- isCeremonyRoleId
- sanitizeCeremonyRoleId
- sanitizeCeremonyRoleIds
- sanitizeCeremonyId
- ceremonyById
- ceremoniesInPipelineOrder
- ceremoniesByStage
- ceremonyUsesFreeOutcome

### src/shared/brainstormCatalog.ts
- normalizeBrainstormSlug
- brainstormFileName
- serializeBrainstormRoom
- parseBrainstormRoomDefinition
- buildBrainstormMarkdown

### src/shared/brainstormContextLabel.ts
- brainstormContextLabel

### src/shared/brainstormListing.ts
- brainstormPrimaryAction
- brainstormTone
- brainstormRoundsDone
- groupBrainstormRooms
- brainstormAge
- filterBrainstormRooms
- brainstormContextFileName
- brainstormRoomContext

### src/shared/brainstormMessageParts.ts
- splitBrainstormMessage

### src/shared/brainstormRoom.ts
- isBrainstormHumanMessage
- sanitizeBrainstormMaxRounds
- brainstormRoundStopIndex
- brainstormRunMinutes
- dedupeAgentIdsPreservingOrder
- isExpertReplicaAgent
- isBrainstormInvitableAgent
- filterBrainstormInvitableAgents
- findBrainstormCatalogAgent
- brainstormCatalogAgentLabel
- remapBrainstormParticipantId
- resolveBrainstormParticipantDisplay
- resolveBrainstormParticipantIds
- sanitizeBrainstormInviteIds
- stripBrainstormProtocolFences
- sanitizeBrainstormWorkingSet
- sanitizeBrainstormOutcome
- createBrainstormRoom

### src/shared/brainstormSeatCell.ts
- brainstormSeatCellHeight
- brainstormSeatTier

### src/shared/brainstormSeatTail.ts
- brainstormSeatTail

### src/shared/changelog.ts
- changelogSection
- changelogRecentModifications

### src/shared/composerHistory.ts
- rememberComposerEntry
- recallStep

### src/shared/configSchema.ts
- sanitizeMusicVolume
- sanitizeTerminalLineHeight
- sanitizeOnboardingCompletedVersion
- migrateAgentCliCommands
- mergeWithDefaults
- validateConfig

### src/shared/contextBudget.ts
- deliveryModeFor
- summarizeContextBudget

### src/shared/contextDraftDirty.ts
- isContextDraftDirty

### src/shared/contextReportDoc.ts
- stripContextMetadataComment
- resolveNotesPreviewContent
- parseContextDoc
- splitFences
- parseFolderTree
- countFolderNodes
- parseDeps
- parseGit
- contextReportCounts

### src/shared/contextSections.ts
- extractSection
- markdownSections
- folderTreeSections
- dependencySections
- wikiSections
- gitSections
- sectionsForContext

### src/shared/covenantRetry.ts
- retryCovenantResult

### src/shared/covenantTypes.ts
- covenantWorkspaceCatalogKey
- tabAgentCatalogKey
- shouldReplaceOrgAgentCatalog

### src/shared/csvTable.ts
- parseCsv
- serializeCsv
- csvDelimiterForPath
- csvEolForText
- csvColumnCount

### src/shared/delegationLanes.ts
- resolveDelegationLane

### src/shared/delegationResultCards.ts
- looksLikeDelegationResultFollowUp
- parseDelegationResultCards

### src/shared/delegationRuntimeRegistry.ts
- registerDelegationRuntime
- getDelegationRuntime
- attachDelegationWorktree
- markDelegationRuntimeStatus
- deleteDelegationRuntime
- listNestedDelegations
- resolveDelegationDelivery

### src/shared/delegationTargets.ts
- parseExpertReplicaRequest
- shouldSyncOrgWorkspaceAgentDefinition
- shouldFinalizeWorktreeFromOrchestrator

### src/shared/delegationTurnSummary.ts
- isDelegationSummaryPlaceholder
- buildDelegationTurnSummary
- isBetterDelegationSummary

### src/shared/dictation.ts
- dictationStopErrorCode
- classifyDictationError
- isIgnorableDictationError

### src/shared/fileExplorerPersistedState.ts
- normalizeFileExplorerState

### src/shared/filePreviewKind.ts
- filePreviewKindForPath
- previewNeedsBytes
- previewHasSource

### src/shared/fontStacks.ts
- fontStack

### src/shared/gitDiff.ts
- parseGitUnifiedDiff

### src/shared/githubRunTimeline.ts
- isScaffoldStep
- durationSeconds
- formatDuration
- foldScaffoldSteps
- runTimeline
- statusKind

### src/shared/installedPlugins.ts
- parseInstalledPlugins
- resolvePluginDirs

### src/shared/jiraConfig.ts
- isJiraProjectKey
- parseJiraConfig

### src/shared/jiraIssue.ts
- normalizeIssueKey
- parseIssueKeys
- parsePartialIssueKey
- isSnapshotStale
- issueKeyFor
- mentionRangeAt
- mentionQueryAt

### src/shared/jiraIssueDoc.ts
- jiraContextMetadataLine
- adfToText
- issueAutoMarkdown
- withJiraAutoBlock
- parseJiraResumenBlock
- jiraSnapshotHasContent
- parseJiraIssuePreview

### src/shared/jiraQuickJql.ts
- buildJiraQuickJql

### src/shared/loopChainEvents.ts
- sanitizeLoopChainId

### src/shared/lspLanguages.ts
- lspLanguageId

### src/shared/mcpCapabilityPrompt.ts
- buildMcpCapabilityPrompt
- buildJiraAttachedPrompt

### src/shared/mcpConfigText.ts
- validateMcpConfigText

### src/shared/mcpContext.ts
- mcpServerSummaries
- formatMcpServers
- mcpConfigLabelFor
- providerUsesProjectMcpConfig
- providerSupportsMcp
- mcpScopeModeFor
- mcpServerDefinition
- withMcpServer
- buildMcpToolRows
- mcpsNeedingAuth

### src/shared/mcpProbe.ts
- mcpServerRemoteUrl
- mcpServerAuthHeaders
- isLegacyAtlassianMcpUrl
- classifyMcpHttpProbe
- mcpConnectHint

### src/shared/orchestrationAwaiting.ts
- orchestrationAwaitingSignature
- shortWorktreeHint
- buildOrchestrationAwaitingView

### src/shared/orchestrationJobs.ts
- shouldWakeJob
- dedupeDelegateResultsById
- createOrchestrationJob
- supersedeOrchestrationJobsForHumanTurn
- resolveOrchestrationJobIdForTurn
- decideJobForTurn
- abortOrchestrationJob
- shouldDeliverOrchestrationJobFollowUp
- findJobByDelegation
- occupiedPaneIdsAcrossJobs
- isJobAwaiting
- listJobsForPane
- jobRoundsAtCap
- flattenAwaitingItemsFromJobs
- upsertOrchestrationWaveItem
- awaitingOrchestratorPaneIds
- occupiedTargetPaneIdsAcrossAllJobs
- pendingOrchestratorIdsFromJobs
- orchestratorPanesWithDeferredForPane
- findPendingDelegationByToPane
- markPendingSawBusyForPane
- canReconcileIdlePending
- abortOneDelegationInJob

### src/shared/orgPeople.ts
- orgPeopleRows
- workspacePeopleRows

### src/shared/orgWorkspaceCatalog.ts
- normalizeGithubLogin
- sameGithubLogin
- catalogHasWorkspaces
- catalogForLogin
- isCatalogFresh
- canRenameOrgWorkspace
- canAccessOrgWorkspace
- matchesWorkspaceQuery
- buildOrgWorkspaceCatalog
- parseOrgWorkspaceCatalog
- findOrgWorkspaceCatalogEntry
- syncTabTitlesFromOrgWorkspaceCatalog
- patchOrgWorkspaceCatalogName

### src/shared/orgWorkspaceCloneError.ts
- diagnoseCloneError

### src/shared/orgWorkspaceContent.ts
- sanitizeSlugSegment
- workspaceContextBodyScopeKey
- clearWorkspaceContextBodies
- rememberWorkspaceContextBody
- forgetWorkspaceContextBody
- workspaceContextBody
- contextContentsForNotes
- workspaceContextUpsertPayload
- renameWorkspaceContext
- renameWorkspaceContextFromTab
- orgWorkspacePersistContext
- projectAgentsFromWorkspaceAgents
- tabContextsFromWorkspaceContexts

### src/shared/orgWorkspaceLocalSync.ts
- isSyncableOrgWorkspaceAgent
- isSyncableOrgWorkspaceContext
- filterSyncableOrgWorkspaceAgents
- filterSyncableOrgWorkspaceContexts
- localContextsToWipeOnOrgResync
- orgWorkspaceRemoteIdsToDelete
- orgWorkspaceLocalIdsToUpsert
- orderedAgentIdsFromTab
- stampProjectAgentsPlaneOrder
- canUploadOrgWorkspaceChanges
- isAgentResultContextId
- pickLocalAgentResultContextIds
- mergeRemoteAgentPreservingLocalResultContextIds
- stripAgentResultContextIdsForUpload
- filterContextIdsAfterDiscover

### src/shared/paneWindows.ts
- computePlaneMiniSlotCell
- computePlaneChatColumnWidth
- computePlaneMiniSlotPadX
- clampPlaneColumnScroll
- computePlaneAgentContextIconsPerRow
- estimatePlaneAgentContextGridHeight
- readPlaneMiniAgentLayoutHeight
- estimatePlaneAgentMiniHeight
- maxPaneWindowZ
- minimizeOtherPaneWindows
- computeStandardPaneWindowGeometry
- createPaneWindowState
- sanitizePaneWindowState
- collapseAllPaneWindows
- ensurePaneWindows
- ensureTabPaneLayout

### src/shared/planeColumnWindowing.ts
- centerProximityScale
- computePlaneColumnWindowing

### src/shared/planeHumanSendFifo.ts
- enqueueHumanSend
- takeNextHumanSend

### src/shared/planeLoopChain.ts
- clampLoopChainIntervalMs
- activeLoopChainAgentIds
- agentIdsUsedInLoopChains
- chainHasAgent
- canAppendLoopStep
- createLoopChain
- appendLoopStep
- moveLoopStep
- setLoopStepObjective
- sanitizePlaneLoopChains
- planeLoopChainsForPersist
- removeAgentFromLoopChains

### src/shared/planeLoopGraph.ts
- wouldCreateLoopCycle
- hasLoopLink
- createLoopLink
- outgoingLoopTargets
- outgoingLoopLinks
- defaultLoopNodePosition
- resolveLoopNodePosition
- loopNodePort
- loopEdgePath
- sanitizePlaneLoopLinks
- sanitizePlaneLoopNodePositions

### src/shared/projectAgentBootstrap.ts
- buildBootstrapProjectAgentDefinitions

### src/shared/projectAgentCatalog.ts
- threadStateOf
- stripBindingCliSessions
- normalizeAgentSlug
- projectAgentFileName
- allocateAgentSlug
- buildNewProjectAgentDefinition
- agentResultContextIdForSlug
- tabContextForAgentResult
- withCatalogAgentResultContexts
- isAgentOwnResultContext
- remapAgentBindingsInTabs
- remapAgentResultContextIds
- remapAgentResultIdsInCatalog
- remapAgentResultTabContexts
- sanitizeNativeSkills
- sanitizeMcpsAllowed
- sanitizeAgentOrder
- sortProjectAgentsByPlaneOrder
- parseProjectAgentDefinition

### src/shared/ptyInputSanitize.ts
- stripAnsiInputSequences

### src/shared/pulseEvents.ts
- pulseWorkspaceTag
- normalizePulseEvent
- filterPulseEvents
- pulseScopeOptions
- aggregateAgents
- dayFromMs
- shiftDay
- aggregatePulse
- heatmapGrid
- intensityLevels
- levelFor

### src/shared/pulseReplicas.ts
- foldPulseReplicas

### src/shared/pulseWorkspaceLabels.ts
- pulseWorkspaceLabel

### src/shared/queuedTurnPreview.ts
- resolveAgentLabel
- resolveQueuedTurnPreview

### src/shared/relativeTime.ts
- relativeTime
- relativeTimeFromIso

### src/shared/repoFullName.ts
- normalizeRepoFullName
- repoFullNameFromCloneUrl

### src/shared/settingsSearch.ts
- normalizeSearchText
- filterSettingsEntries

### src/shared/shortenHome.ts
- shortenHome

### src/shared/tabContext.ts
- normalizeContextFileName
- normalizeContextRootPath
- creatableContextStem
- canonicalContextId
- canonicalContextFileName
- canonicalContextName
- contextDefinitionKey
- applyCanonicalContextIdentity
- synthesizeTabContextFromId
- isCanonicalContextId
- isProjectContext
- normalizeAnnotation

### src/shared/tabContextAgentUsage.ts
- agentsUsingContext
- agentsAssignableToContext
- toggleAgentContextId
- filterTabContexts
- unusedContextCount
- presentContextKinds

### src/shared/tabContextAppearance.ts
- TAB_CONTEXT_ICON_NAMES
- filterContextIconGroups
- defaultIconForKind
- defaultColorForKind
- normalizeContextIcon
- normalizeContextColor
- resolveContextIcon
- resolveContextColor
- agentMonogram
- paletteColorForSeed

### src/shared/tabSession.ts
- setPaneTitle

### src/shared/textHighlight.ts
- highlightParts

### src/shared/themeMusic.ts
- resolveThemeMusic

### src/shared/updateBannerPreview.ts
- buildUpdateBannerPreviewTimeline

### src/shared/updateState.ts
- formatReleaseNotes
- shouldScheduleSilentUpdateChecks

### src/shared/wikiCurator.ts
- isWikiCuratorInitCommand
- sanitizeWikiCuratorConfig
- parseWikiCuratorConfig
- buildWikiInitGuidance
- buildWikiCuratorPrompt
- extractWikiViewRequest

### src/shared/wikiCuratorHistory.ts
- appendWikiCuratorHistoryEntry
- parseWikiCuratorHistory
- wikiCuratorHistoryStorageKey

### src/shared/wikiDoc.ts
- buildWikiWritingGuidance
- normalizeWikiSlug
- normalizeWikiPageType
- parseWikiLinks
- composeWikiPage
- parseWikiPage
- buildWikiPromptIndex
- buildWikiIndex
- formatWikiLogEntry
- extractWikiIngest

### src/shared/wikiGraph.ts
- getMostRecentlyUpdatedWikiSlugs
- buildWikiGraphData

### src/shared/wikiLint.ts
- lintWikiPages

### src/shared/wikiModalPositions.ts
- computeWikiModalDeadZone
- modalOverlapsWikiDeadZone
- wikiModalDockSide
- computeWikiModalPositionNearPoint
- computeWikiModalSpreadPositions

### src/shared/wikiNodeModalOpen.ts
- mergeWikiNodeModalsOpen

### src/shared/wikiPagePlain.ts
- formatWikiPageBodyForHuman

### src/shared/worktreeDelegation.ts
- sanitizeDelegationSlug
- worktreeBranchFor
- worktreeRelPathFor
- planWorktreeMergeOrder
- buildMergeCommitMessage
- buildConflictFollowUp
- shouldUseWorktreeForDelegation
- planDelegationWorktrees

### src/themes/codeMirrorTheme.ts
- createCodeMirrorTheme
<!-- /iaterminal:auto -->

<!-- iaterminal:notes -->
(no annotations yet)
<!-- /iaterminal:notes -->
