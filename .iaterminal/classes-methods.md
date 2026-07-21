# Classes and methods
<!-- iaterminal:context {"version":1,"id":"aae8bcbc-38c4-4ab2-a5da-e3906f8909e8","name":"Classes and methods","fileName":"classes-methods.md","kind":"symbols","icon":"code","color":"#c084fc","symbolKinds":["class","method"]} -->

<!-- iaterminal:auto -->
### electron/agentCliRuntime.ts
- getContextDeliveryMetrics
- clearContextDeliveryMetrics
- shouldForceFullContextRefresh
- clearAgentContextDeliveryState
- materializeClipboardImages
- shouldFinishOnProcessClose
- normalizeClaudeEvent
- describeCursorToolCall
- normalizeCursorEvent
- composePrompt
- buildContextContinuationPrompt

### electron/agentFileOps.ts
- resolveSafeProjectPath
- readProjectFile
- writeProjectFile
- readProjectFileLines
- applyProjectPatch

### electron/agentMd.ts
- resolveAgentMdPath
- readAgentMdForCwd
- writeAgentMdForCwd
- gatherShallowFolderTree

### electron/agentShellOps.ts
- runAgentShellCommand

### electron/aiAgentResults.ts
- agentResultSlug
- agentResultFileName
- agentResultContextId
- resolveAiAgentResultsPath
- extractAiAgentResults
- formatAiAgentResultsDocument
- upsertAiAgentResults
- buildAiAgentResultsInstruction

### electron/aiChangelog.ts
- extractAiChangelog
- resolveAiChangelogPath
- readAiChangelog
- formatAiChangelogDocument
- ensureAiChangelog
- writeAiChangelogDocument
- appendAiChangelog
- buildAiChangelogInstruction

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
- startFileExplorerWatch
- stopFileExplorerWatch
- stopAllFileExplorerWatches

### electron/githubActionsOps.ts
- parseGitHubRemoteUrl
- githubActionsListForSession

### electron/githubApi.ts
- GitHubApiError:
- githubFetch
- mapRestWorkflowRun
- fetchWorkflowRuns

### electron/githubToken.ts
- readGithubTokenFromGitCredential
- resolveGithubToken

### electron/gitSessionOps.ts
- gitGetRepoStatus
- gitDiffForAi
- validateCommitMessage
- gitPull
- gitPush
- gitCommit
- gitStageAll
- gitStageFile
- gitUnstageAll
- gitUnstageFile

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

### electron/projectAiContext.ts
- gatherProjectAiContextForCwd

### electron/shellCwdSync.ts
- extractOsc7CwdFromChunk
- isExistingDirectory
- resolveCdTarget
- patchEnvForCwdReporting

### electron/shellPathEnv.ts
- splitPath
- mergePathEntries
- defaultExtraBinDirs
- applyLoginShellPath

### electron/spotifyNative.ts
- assertPlaylistId
- tryResolveSpotifyPlaylistUriFromHttpUrl
- isSpotifyDesktopInstalled
- playPlaylist
- pausePlayback
- resumePlayback
- getPlaybackState

### electron/turnFileChanges.ts
- captureWorkspaceSnapshot
- changedWorkspacePaths

### src/ai/aiClient.ts
- chatAI
- suggestGitCommitMessage
- aiOptionsFromConfig

### src/ai/anthropicClient.ts
- chatAnthropic
- chatMessagesToAnthropicNative
- appendAnthropicToolResults
- chatAnthropicAgentTurn

### src/ai/contextBuilder.ts
- buildRichContext

### src/ai/ollamaClient.ts
- chatOllama
- stripOuterMarkdownFence
- summarizeInteractionForLog
- fallbackInteractionLogLine
- makeInteractionLogEntry
- buildAgentMdRefreshMessages

### src/ai/ollamaModels.ts
- fetchOllamaModelNames

### src/ai/openaiClient.ts
- chatOpenAI
- chatMessagesToOpenAINative
- appendOpenAIToolResults
- chatOpenAIAgentTurn

### src/ai/sseStream.ts
- readSSEStream

### src/ai/toolDefinitions.ts
- toAnthropicTools
- toOpenAITools

### src/i18n/index.ts
- initI18n

### src/i18n/modKeyLabel.ts
- modKeyLabel
- shortcutLabel

### src/i18n/useT.ts
- useT

### src/renderer/agent/AgentChatBubbles.tsx
- AgentChatBubbles

### src/renderer/agent/AgentConfigModal.tsx
- AgentConfigModal

### src/renderer/agent/AgentLoopIntervalModal.tsx
- AgentLoopIntervalModal

### src/renderer/agent/AgentPane.tsx
- AgentPane

### src/renderer/agent/AgentPaneFooter.tsx
- AgentPaneFooter

### src/renderer/agent/AgentPaneMessages.tsx
- AgentPaneMessages

### src/renderer/agent/AgentProviderPickerModal.tsx
- AgentProviderPickerModal

### src/renderer/agent/composerImages.ts
- extensionForMime
- blobToBase64
- optimizeImageForModel
- blobToThumbnailDataUrl
- imagesFromClipboard
- materializeClipboardImage
- pendingImagesToAttachments
- attachmentsToPendingImages

### src/renderer/agent/IaNucleus.tsx
- IaNucleus

### src/renderer/agent/QueuedTurnEditModal.tsx
- QueuedTurnEditModal

### src/renderer/agent/TabContextFormModal.tsx
- TabContextFormModal

### src/renderer/agent/tabContextKindIcons.ts
- contextIconName
- kindIconName
- appearanceIconName

### src/renderer/agent/TabContextRootPathField.tsx
- TabContextRootPathField

### src/renderer/agent/TabContextsEditor.tsx
- TabContextsEditor

### src/renderer/agent/TabContextsList.tsx
- TabContextsList

### src/renderer/agent/TabContextsListPreview.tsx
- TabContextsListPreview

### src/renderer/agent/TabContextsModal.tsx
- TabContextsModal

### src/renderer/App.tsx
- App

### src/renderer/arrayReorder.ts
- moveItemToIndex
- swapItemsAtIndices
- computeTabInsertIndex
- dropPlaceFromPointer
- isDragLeaveForContainer

### src/renderer/components/ai/aiMessagesScroll.ts
- getAiMessagesMaxScrollTop
- isAiMessagesNearBottom
- scrollAiMessagesToBottom

### src/renderer/components/ai/useAiMessagesFollowScroll.ts
- useAiMessagesFollowScroll

### src/renderer/components/AiCodeBlock.tsx
- AiCodeBlock

### src/renderer/components/AiMarkdown.tsx
- AiMarkdown

### src/renderer/components/AppModals.tsx
- AppModals

### src/renderer/components/ConfirmTerminalModal.tsx
- ConfirmTerminalModal

### src/renderer/components/FontSizeControl.tsx
- FontSizeControl

### src/renderer/components/git/GitBranchBadge.tsx
- GitBranchBadge

### src/renderer/components/git/gitDiffNumStat.ts
- parseGitNumStat
- gitFileLineStats

### src/renderer/components/git/gitErrorI18n.ts
- gitErrorMessage
- formatGitCommandResult

### src/renderer/components/git/GitFileList.tsx
- GitFileList

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

### src/renderer/components/GitPanelModal.tsx
- GitPanelModal

### src/renderer/components/MusicSpectrum.tsx
- MusicSpectrum

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

### src/renderer/components/ThemePickerModal.tsx
- ThemePickerModal

### src/renderer/components/ThemePickerTrigger.tsx
- ThemePickerTrigger

### src/renderer/components/ThemePreview.tsx
- ThemePreview

### src/renderer/components/Titlebar.tsx
- Titlebar

### src/renderer/components/TitlebarMusicControls.tsx
- TitlebarMusicControls

### src/renderer/components/ui/Badge.tsx
- Badge

### src/renderer/components/ui/Button.tsx
- Button

### src/renderer/components/ui/ChoiceCard.tsx
- ChoiceCard

### src/renderer/components/ui/Icon.tsx
- Icon

### src/renderer/components/ui/Input.tsx
- Input

### src/renderer/components/ui/Select.tsx
- Select

### src/renderer/components/ui/Spinner.tsx
- Spinner

### src/renderer/components/ui/TextArea.tsx
- TextArea

### src/renderer/components/ui/Toggle.tsx
- Toggle

### src/renderer/components/ui/Tooltip.tsx
- Tooltip

### src/renderer/dragThumbnailUtils.ts
- snapshotXtermCanvases
- buildTabDragThumbnail
- buildPaneDragThumbnail

### src/renderer/history/feedCompletedUserLines.ts
- backwardKillWordDraft
- feedCompletedUserLines

### src/renderer/sessionSanitize.ts
- deriveTabCounter
- sanitizePersistedSession

### src/renderer/tabSplitSizes.ts
- getDefaultSplitSizes
- splitSizesAfterAddingPane
- columnRatioForAgentPriority
- splitSizesAfterAddingPanePreferAgent
- normalizeSplitSizes
- normalizeTabSession
- clampColumnRatio
- clampRowRatio
- columnGridTemplate
- rowGridTemplate

### src/renderer/terminal/CdSuggest.tsx
- CdSuggest

### src/renderer/terminal/CmdSuggest.tsx
- CmdSuggest

### src/renderer/terminal/explorer/ExplorerConfirmHost.tsx
- ExplorerConfirmHost

### src/renderer/terminal/explorer/explorerPathUtils.ts
- expandedPathsKey
- normalizeSessionCwd
- sessionCwdPaneLabel
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

### src/renderer/terminal/explorer/FileEditorPanel.tsx
- FileEditorPanel

### src/renderer/terminal/explorer/fileEditorSearch.ts
- searchQueryFromTerm
- countSearchMatches
- fileFindFirst
- fileFindNext
- fileFindPrevious
- fileEditorSearchExtension

### src/renderer/terminal/explorer/FileExplorerContextMenu.tsx
- FileExplorerContextMenu

### src/renderer/terminal/explorer/FileExplorerEntryIcon.tsx
- FileExplorerEntryIcon

### src/renderer/terminal/explorer/fileExplorerErrorI18n.ts
- fileExplorerErrorMessage

### src/renderer/terminal/explorer/fileExplorerGitStatus.ts
- repoPrefixFromStatus
- buildGitStatusMap
- gitStatusFromMap

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

### src/renderer/terminal/explorer/useExplorerResize.ts
- useExplorerResize

### src/renderer/terminal/isClearCommand.ts
- isClearCommandLine

### src/renderer/terminal/PaneToolbar.tsx
- PaneToolbar

### src/renderer/terminal/PaneToolbarQuickOpen.tsx
- PaneToolbarQuickOpen

### src/renderer/terminal/quickOpenScore.ts
- scoreQuickOpenPath
- rankQuickOpenPaths
- splitPathHighlight

### src/renderer/terminal/stripShellPromptPrefix.ts
- stripLeadingShellPrompts

### src/renderer/terminal/terminalCanvasRepaint.ts
- repaintTerminalCanvas
- createTerminalRepaintScheduler

### src/renderer/terminal/terminalFindInBuffer.ts
- findMatchesInTerminalBuffer
- findMatchesInCommandHistory

### src/renderer/terminal/TerminalScrollDown.tsx
- TerminalScrollDown

### src/renderer/terminal/TerminalSuggestStack.tsx
- TerminalSuggestStack

### src/renderer/workspace/ContextBadge.tsx
- ContextBadge

### src/renderer/workspace/miniExpandSuppress.ts
- armMiniExpandSuppress
- isMiniExpandSuppressed
- setMiniExpandLocked

### src/renderer/workspace/PaneWindow.tsx
- PaneWindow

### src/renderer/workspace/PlaneAgentBadge.tsx
- PlaneAgentBadge

### src/renderer/workspace/planeAgentColor.ts
- normalizeAgentColor
- planeAgentColor
- resolveAgentColor

### src/renderer/workspace/PlaneAgentContextNodes.tsx
- PlaneAgentContextNodes

### src/renderer/workspace/PlaneChatCloseButton.tsx
- PlaneChatCloseButton

### src/renderer/workspace/PlaneChatComposer.tsx
- PlaneChatComposer

### src/renderer/workspace/PlaneChatContextsBar.tsx
- PlaneChatContextsBar

### src/renderer/workspace/PlaneChatDock.tsx
- PlaneChatDock

### src/renderer/workspace/PlaneComposerAurora.tsx
- PlaneComposerAurora

### src/renderer/workspace/PlaneContextCard.tsx
- PlaneContextCard

### src/renderer/workspace/planeContextDrag.ts
- setPlaneContextDragData
- hasPlaneContextDrag
- readPlaneContextDragData

### src/renderer/workspace/PlaneContextPool.tsx
- PlaneContextPool

### src/renderer/workspace/PlaneFabStack.tsx
- PlaneFabStack

### src/renderer/workspace/PlaneIdleNucleus.tsx
- PlaneIdleNucleus

### src/renderer/workspace/PlaneMap.tsx
- PlaneMap

### src/renderer/workspace/PlaneMiniActions.tsx
- PlaneMiniActions

### src/renderer/workspace/PlaneMiniFace.tsx
- PlaneMiniFace

### src/renderer/workspace/PlanePaneWindow.tsx
- PlanePaneWindow

### src/renderer/workspace/PlaneProjectFolder.tsx
- PlaneProjectFolder

### src/renderer/workspace/PlaneQuickChat.tsx
- PlaneQuickChat

### src/renderer/workspace/TabAgenticPlane.tsx
- TabAgenticPlane

### src/shared/agentCliModels.ts
- modelsForProvider

### src/shared/agentFileProtocol.ts
- extractRunBlocks
- extractGrepBlock
- parseReadLine
- extractReadBlock
- extractListBlock
- extractGlobBlock
- extractGitBlock
- extractPatchBlocks
- extractWriteBlocks
- fallbackExtractWrites

### src/shared/agentIdentity.ts
- buildAgentIdentityPrompt

### src/shared/agentLoop.ts
- loopIntervalPresetByMs
- formatLoopIntervalMs
- buildLoopPrompt
- stripLoopDoneMarker

### src/shared/agentModeHandoff.ts
- buildModeHandoffPrompt

### src/shared/agentShellGuard.ts
- isDestructiveShellCommand
- requiresShellConfirmation

### src/shared/agentWriteGuard.ts
- userWantsFileChanges
- pathLikelyRequested
- isSensitiveWritePath
- isSuspiciousAgentWriteContent
- stripThinkingFromAgentReply
- filterWritesByUserIntent
- filterPatchesByUserIntent

### src/shared/configSchema.ts
- parseSpotifyPlaylistId
- canonicalizeMusicPlaylistIdsByMood
- mergeWithDefaults
- validateConfig

### src/shared/fileExplorerPersistedState.ts
- normalizeFileExplorerState

### src/shared/paneWindows.ts
- computePlaneMiniSlotCell
- computePlaneChatColumnWidth
- computePlaneMiniSlotPadX
- computePlaneMiniLetterboxSize
- maxPaneWindowZ
- minimizeOtherPaneWindows
- computeStandardPaneWindowGeometry
- createPaneWindowState
- sanitizePaneWindowState
- collapseAllPaneWindows
- ensurePaneWindows
- ensureTabPaneLayout

### src/shared/ptyInputSanitize.ts
- stripAnsiInputSequences

### src/shared/tabContext.ts
- normalizeContextFileName
- isAgentResultContext
- isProjectContext
- countWords
- normalizeAnnotation
- collectAutoAnnotationKeys
- extractTabContextUpdates
- filterTabContextUpdatesByChangedPaths
- defaultAssignedContextIds
- suggestSymbolsIdentity

### src/shared/tabContextAppearance.ts
- defaultIconForKind
- defaultColorForKind
- normalizeContextIcon
- normalizeContextColor
- resolveContextIcon
- resolveContextColor

### src/themes/codeMirrorTheme.ts
- createCodeMirrorTheme
<!-- /iaterminal:auto -->

<!-- iaterminal:notes -->
(no annotations yet)
<!-- /iaterminal:notes -->
