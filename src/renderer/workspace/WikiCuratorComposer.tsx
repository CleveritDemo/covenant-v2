import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { ClipboardEvent } from 'react'
import { useT } from '@i18n/useT'
import {
  AGENT_CLI_PROVIDER_IDS,
  agentCliSpec,
  isAgentCliProvider,
  type AgentCliProvider,
} from '@shared/agentCliProviders'
import { modelsForProvider, type AgentModelOption } from '@shared/agentCliModels'
import { WIKI_CURATOR_INIT_COMMAND, type WikiCuratorConfig } from '@shared/wikiCurator'
import {
  appendWikiCuratorHistoryEntry,
  parseWikiCuratorHistory,
  wikiCuratorHistoryStorageKey,
  type WikiCuratorHistoryEntry,
} from '@shared/wikiCuratorHistory'
import { stripAgentControlFences } from '../components/ai/assistantBodySegments'
import { DictationListeningOverlay } from '../components/DictationListeningOverlay'
import { PendingImageThumb } from '../components/PendingImageThumb'
import { Button, Icon, Input, Select, Spinner, TextArea, Tooltip } from '../components/ui'
import {
  extensionForMime,
  imagesFromClipboard,
  materializeClipboardImage,
  MAX_PENDING_IMAGES,
  pendingImageFromBlob,
  pendingImagesToAttachments,
  type ComposerPendingImage,
} from '../agent/composerImages'
import { usePushToTalkSpeech, classifyDictationError } from '../pushToTalkSpeech'
import { PlaneChatComposerShell } from './PlaneChatComposerShell'
import { PlaneSketchButton } from './PlaneSketchButton'
import { SketchModal } from './SketchModal'
import './PlaneChatComposer.css'
import './WikiCuratorComposer.css'

export interface WikiCuratorComposerProps {
  cwd: string
  /** El curador pidió abrir pages (fence view, ya parseado en main). */
  onViewSlugs: (slugs: string[]) => void
  /** Hubo ingest aplicado: el grafo debe refetchear. */
  onWikiChanged: () => void
  /** Sonido de inicio de dictado; default true. */
  systemSoundsEnabled?: boolean
  /** Incrementar tras bootstrap wiki dispara /init automático (guard thinking). */
  bootstrapInitToken?: number
}

/** CLI por defecto del curador cuando AppConfig no trae provider. */
const DEFAULT_CURATOR_PROVIDER: AgentCliProvider = 'claude'

const IMAGE_ONLY_USER_TEXT = '(imagen adjunta)'

/**
 * Composer flotante del curador de la wiki dentro del mapa 3D.
 * Reutiliza PlaneChatComposerShell (textarea + send/stop/mic + thumbs) sin
 * badges/listbox de agentes. Historial, config popover e IPC del curador viven aquí.
 * Escape con foco dentro solo hace blur/cierra el popover — nunca cierra el mapa.
 */
export const WikiCuratorComposer: React.FC<WikiCuratorComposerProps> = ({
  cwd,
  onViewSlugs,
  onWikiChanged,
  systemSoundsEnabled = true,
  bootstrapInitToken = 0,
}) => {
  const { t, i18n } = useT()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const historyWrapRef = useRef<HTMLDivElement>(null)
  const historyPanelRef = useRef<HTMLDivElement>(null)
  const rawReplyRef = useRef('')
  const pendingImagesRef = useRef<ComposerPendingImage[]>([])
  const [draft, setDraft] = useState('')
  const [pendingImages, setPendingImages] = useState<ComposerPendingImage[]>([])
  const [dictationError, setDictationError] = useState('')
  const [sketchOpen, setSketchOpen] = useState(false)
  const [reply, setReply] = useState('')
  const [errorText, setErrorText] = useState('')
  const [thinking, setThinking] = useState(false)
  const [history, setHistory] = useState<WikiCuratorHistoryEntry[]>([])
  const [configOpen, setConfigOpen] = useState(false)
  const [config, setConfig] = useState<WikiCuratorConfig>({})
  const [nameDraft, setNameDraft] = useState('')
  const [rulesDraft, setRulesDraft] = useState('')
  const [models, setModels] = useState<AgentModelOption[]>(() => (
    modelsForProvider(DEFAULT_CURATOR_PROVIDER)
  ))

  pendingImagesRef.current = pendingImages

  // Callbacks por ref: la suscripción IPC vive solo por cwd.
  const onViewSlugsRef = useRef(onViewSlugs)
  onViewSlugsRef.current = onViewSlugs
  const onWikiChangedRef = useRef(onWikiChanged)
  onWikiChangedRef.current = onWikiChanged

  const selectedProvider: AgentCliProvider = config.provider ?? DEFAULT_CURATOR_PROVIDER

  const persistHistory = useCallback((entries: WikiCuratorHistoryEntry[]): void => {
    const key = cwd.trim()
    if (!key) return
    try {
      localStorage.setItem(wikiCuratorHistoryStorageKey(key), JSON.stringify(entries))
    } catch {
      // quota o modo privado
    }
  }, [cwd])

  const appendHistoryEntry = useCallback((
    entry: Omit<WikiCuratorHistoryEntry, 'at'> & { at?: number },
  ): void => {
    const full: WikiCuratorHistoryEntry = { ...entry, at: entry.at ?? Date.now() }
    setHistory(previous => {
      const next = appendWikiCuratorHistoryEntry(previous, full)
      persistHistory(next)
      return next
    })
  }, [persistHistory])

  const appendHistoryEntryRef = useRef(appendHistoryEntry)
  appendHistoryEntryRef.current = appendHistoryEntry

  const clearHistory = useCallback((): void => {
    rawReplyRef.current = ''
    setReply('')
    setErrorText('')
    setHistory([])
    const key = cwd.trim()
    if (!key) return
    try {
      localStorage.removeItem(wikiCuratorHistoryStorageKey(key))
    } catch {
      // ignore
    }
  }, [cwd])

  useEffect(() => {
    return () => {
      pendingImagesRef.current.forEach(image => URL.revokeObjectURL(image.previewUrl))
    }
  }, [])

  useEffect(() => {
    const key = cwd.trim()
    if (!key) return
    try {
      const raw = localStorage.getItem(wikiCuratorHistoryStorageKey(key))
      if (raw) setHistory(parseWikiCuratorHistory(raw))
      else setHistory([])
    } catch {
      setHistory([])
    }
  }, [cwd])

  useEffect(() => {
    const key = cwd.trim()
    if (!key) return
    return window.api.onWikiCuratorEvent(key, event => {
      if (event.type === 'delta') {
        rawReplyRef.current += event.text
        setReply(stripAgentControlFences(rawReplyRef.current))
        return
      }
      if (event.type === 'final') {
        rawReplyRef.current = event.text
        const stripped = stripAgentControlFences(event.text)
        if (stripped.trim()) {
          appendHistoryEntryRef.current({ role: 'curator', text: stripped })
        }
        setReply('')
        return
      }
      if (event.type === 'view') {
        onViewSlugsRef.current(event.slugs)
        return
      }
      if (event.type === 'applied') {
        onWikiChangedRef.current()
        return
      }
      if (event.type === 'error') {
        setErrorText(event.message)
        appendHistoryEntryRef.current({ role: 'error', text: event.message })
        return
      }
      rawReplyRef.current = ''
      setReply('')
      setErrorText('')
      setThinking(false)
    })
  }, [cwd])

  const loadModelsForProvider = (provider: AgentCliProvider, cancelled?: () => boolean): void => {
    setModels(modelsForProvider(provider))
    void window.api.listAgentCliModels(provider).then(result => {
      if (cancelled?.() || result.models.length === 0) return
      setModels(result.models)
    }).catch(() => undefined)
  }

  useEffect(() => {
    const key = cwd.trim()
    if (!key) return
    let cancelled = false
    void window.api.getWikiCuratorConfig(key).then(result => {
      if (cancelled || !result.ok) return
      setConfig(result.config)
      setNameDraft(result.config.name ?? '')
      setRulesDraft((result.config.rules ?? []).join('\n'))
      const provider = result.config.provider ?? DEFAULT_CURATOR_PROVIDER
      loadModelsForProvider(provider, () => cancelled)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [cwd])

  useEffect(() => {
    if (!configOpen) return
    setNameDraft(config.name ?? '')
    setRulesDraft((config.rules ?? []).join('\n'))
  }, [configOpen, config.name, config.rules])

  const persistConfig = (next: WikiCuratorConfig): void => {
    setConfig(next)
    const key = cwd.trim()
    if (key) void window.api.setWikiCuratorConfig(key, next).catch(() => undefined)
  }

  const changeProvider = (value: string): void => {
    if (!isAgentCliProvider(value)) return
    const next: WikiCuratorConfig = { ...config, provider: value }
    // Default vacío se mantiene; modelo custom se conserva (no crashea el Select).
    persistConfig(next)
    loadModelsForProvider(value)
  }

  const appendPendingImages = useCallback((images: ComposerPendingImage[]): void => {
    if (!images.length) return
    setPendingImages(previous => {
      const room = Math.max(0, MAX_PENDING_IMAGES - previous.length)
      if (!room) {
        images.forEach(image => URL.revokeObjectURL(image.previewUrl))
        return previous
      }
      const accepted = images.slice(0, room)
      images.slice(room).forEach(image => URL.revokeObjectURL(image.previewUrl))
      return [...previous, ...accepted]
    })
  }, [])

  const removePendingImage = useCallback((id: string): void => {
    setPendingImages(previous => {
      const target = previous.find(image => image.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return previous.filter(image => image.id !== id)
    })
  }, [])

  const handlePaste = useCallback((event: ClipboardEvent<HTMLTextAreaElement>): void => {
    const files = imagesFromClipboard(event.clipboardData)
    if (!files.length) return
    event.preventDefault()
    const jobs = files.map((file, index) =>
      materializeClipboardImage(
        file,
        `paste-${index + 1}${extensionForMime(file.type || 'image/png')}`,
      ),
    )
    void Promise.all(jobs).then(results => {
      appendPendingImages(results.filter((image): image is ComposerPendingImage => image != null))
    })
  }, [appendPendingImages])

  const handleSketchAttach = useCallback((blob: Blob): void => {
    void pendingImageFromBlob(blob, `sketch-${Date.now()}.png`).then(image => {
      if (image) appendPendingImages([image])
    })
  }, [appendPendingImages])

  const send = useCallback((overrideText?: string): void => {
    const message = (overrideText ?? draft).trim()
    const key = cwd.trim()
    const imagesSnapshot = pendingImages
    if ((!message && imagesSnapshot.length === 0) || !key || thinking) return
    const userText = message || IMAGE_ONLY_USER_TEXT
    appendHistoryEntry({ role: 'user', text: userText })
    rawReplyRef.current = ''
    setReply('')
    setErrorText('')
    setThinking(true)
    setDraft('')
    setPendingImages([])
    void pendingImagesToAttachments(imagesSnapshot).then(attachments => {
      imagesSnapshot.forEach(image => URL.revokeObjectURL(image.previewUrl))
      window.api.startWikiCuratorTurn({
        cwd: key,
        message,
        ...(attachments.length ? { images: attachments } : {}),
      })
    })
  }, [appendHistoryEntry, cwd, draft, pendingImages, thinking])

  const sendRef = useRef(send)
  sendRef.current = send
  const lastBootstrapInitTokenRef = useRef(0)

  useEffect(() => {
    if (bootstrapInitToken === 0 || bootstrapInitToken === lastBootstrapInitTokenRef.current) return
    lastBootstrapInitTokenRef.current = bootstrapInitToken
    if (thinking) return
    sendRef.current(WIKI_CURATOR_INIT_COMMAND)
  }, [bootstrapInitToken, thinking])

  const stop = (): void => {
    const key = cwd.trim()
    if (key) window.api.stopWikiCuratorTurn(key)
    setThinking(false)
  }

  const mapDictationError = useCallback((code: string): string => {
    const kind = classifyDictationError(code)
    if (kind === 'unsupported') return t('agentPane.dictationUnsupported')
    if (kind === 'helperMissing') return t('agentPane.dictationHelperMissing')
    if (kind === 'startFailed') return t('agentPane.dictationStartFailed')
    if (kind === 'permission') return t('agentPane.dictationPermissionDenied')
    if (kind === 'electronUnavailable') return t('agentPane.dictationUnavailableElectron')
    if (kind === 'noSpeech') return t('agentPane.dictationNoSpeech')
    if (kind === 'tooShort') return t('agentPane.dictationTooShort')
    if (kind === 'noAudio') return t('agentPane.dictationNoAudio')
    return t('agentPane.dictationError')
  }, [t])

  const speechLang = i18n.language?.toLowerCase().startsWith('es') ? 'es-ES' : 'en-US'
  const { listening, interim, level, start: startDictation, stop: stopDictation } =
    usePushToTalkSpeech({
      lang: speechLang,
      systemSoundsEnabled,
      onTranscript: text => {
        send(text)
      },
      onError: code => {
        setDictationError(mapDictationError(code))
        window.setTimeout(() => setDictationError(''), 5000)
      },
    })

  const canSend = Boolean(draft.trim() || pendingImages.length > 0)
  const micMode = Boolean(!thinking && !draft.trim() && pendingImages.length === 0)

  const handleSendClick = (): void => {
    if (thinking) {
      stop()
      return
    }
    if (canSend) send()
  }

  // Escape dentro del composer nunca llega al listener global del mapa:
  // primero cierra el popover de config; si no, hace blur del control con foco.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    if (configOpen) {
      setConfigOpen(false)
      inputRef.current?.focus()
      return
    }
    const active = document.activeElement
    if (active instanceof HTMLElement && rootRef.current?.contains(active)) {
      active.blur()
    }
  }

  const selectedModel = config.model?.trim() ?? ''
  const modelIsCustom = Boolean(selectedModel && !models.some(option => option.id === selectedModel))
  const showLive = Boolean(reply || errorText || thinking)
  const showHistoryPanel = history.length > 0 || showLive

  useEffect(() => {
    const panel = historyPanelRef.current
    if (!panel) return
    panel.scrollTop = panel.scrollHeight
  }, [history, reply, errorText, thinking])

  const scrollHistoryToEnd = useCallback((): void => {
    const panel = historyPanelRef.current
    if (!panel) return
    panel.scrollTop = panel.scrollHeight
  }, [])

  const handleHistoryWrapMouseLeave = useCallback((): void => {
    scrollHistoryToEnd()
  }, [scrollHistoryToEnd])

  const handleHistoryTransitionEnd = useCallback((event: React.TransitionEvent<HTMLDivElement>): void => {
    if (event.propertyName === 'max-height') {
      scrollHistoryToEnd()
    }
  }, [scrollHistoryToEnd])

  return (
    <div
      ref={rootRef}
      className="wiki-curator-composer"
      role="group"
      aria-label={t('tabs.wikiCuratorName')}
      onKeyDown={handleKeyDown}
    >
      {configOpen ? (
        <div
          className="wiki-curator-composer__config"
          role="dialog"
          aria-label={t('tabs.wikiCuratorConfigTitle')}
        >
          <header className="wiki-curator-composer__config-head">
            <h3 className="wiki-curator-composer__config-title">
              {t('tabs.wikiCuratorConfigTitle')}
            </h3>
            <Button
              variant="icon"
              size="xs"
              aria-label={t('tabs.wikiCuratorConfigClose')}
              onClick={() => setConfigOpen(false)}
            >
              <Icon name="close" size={11} aria-hidden />
            </Button>
          </header>
          <label className="wiki-curator-composer__config-field">
            <span className="wiki-curator-composer__config-label">
              {t('tabs.wikiCuratorConfigNameLabel')}
            </span>
            <Input
              size="sm"
              value={nameDraft}
              maxLength={40}
              onChange={event => setNameDraft(event.target.value)}
              onBlur={() => {
                const name = nameDraft.trim()
                persistConfig({ ...config, name: name || undefined })
              }}
            />
          </label>
          <label className="wiki-curator-composer__config-field">
            <span className="wiki-curator-composer__config-label">
              {t('tabs.wikiCuratorConfigRulesLabel')}
            </span>
            <TextArea
              size="sm"
              rows={3}
              spellCheck={false}
              value={rulesDraft}
              onChange={event => setRulesDraft(event.target.value)}
              onBlur={() => {
                const rules = rulesDraft
                  .split('\n')
                  .map(line => line.trim())
                  .filter(Boolean)
                persistConfig({ ...config, rules: rules.length ? rules : undefined })
              }}
            />
            <span className="wiki-curator-composer__config-hint">
              {t('tabs.wikiCuratorConfigRulesHint')}
            </span>
          </label>
        </div>
      ) : null}

      {showHistoryPanel ? (
        <div
          ref={historyWrapRef}
          className="wiki-curator-composer__history-wrap"
          onMouseLeave={handleHistoryWrapMouseLeave}
        >
          {history.length > 0 ? (
            <div className="wiki-curator-composer__history-toolbar">
              <Tooltip content={t('tabs.wikiCuratorHistoryClear')}>
                <Button
                  variant="icon"
                  size="xs"
                  aria-label={t('tabs.wikiCuratorHistoryClear')}
                  onClick={clearHistory}
                >
                  <Icon name="close" size={11} aria-hidden />
                </Button>
              </Tooltip>
            </div>
          ) : null}
          <div
            ref={historyPanelRef}
            className="wiki-curator-composer__history"
            aria-label={t('tabs.wikiCuratorHistoryLabel')}
            onTransitionEnd={handleHistoryTransitionEnd}
          >
            {history.map((entry, index) => (
              <p
                key={`${entry.at}-${index}`}
                className={[
                  'wiki-curator-composer__entry',
                  `wiki-curator-composer__entry--${entry.role}`,
                ].join(' ')}
              >
                {entry.text}
              </p>
            ))}
            {showLive ? (
              <div className="wiki-curator-composer__live" role="status" aria-live="polite">
                {errorText ? (
                  <p className="wiki-curator-composer__entry wiki-curator-composer__entry--error">
                    {errorText}
                  </p>
                ) : null}
                {reply ? (
                  <p className="wiki-curator-composer__entry wiki-curator-composer__entry--curator">
                    {reply}
                  </p>
                ) : null}
                {thinking && !reply && !errorText ? (
                  <span className="wiki-curator-composer__thinking">
                    <Spinner aria-label={t('tabs.wikiCuratorThinking')} />
                    {t('tabs.wikiCuratorThinking')}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className={[
          'plane-chat-composer',
          'plane-chat-composer--embedded',
          thinking ? 'plane-chat-composer--working' : '',
        ].filter(Boolean).join(' ')}
      >
        <div className="plane-chat-composer__body">
          <DictationListeningOverlay
            active={listening}
            level={level}
            text={interim.trim() || t('agentPane.dictationLive')}
          />
          <div className="wiki-curator-composer__quick-config">
            <Select
              variant="badge"
              size="sm"
              value={selectedProvider}
              aria-label={t('tabs.wikiCuratorConfigProviderLabel')}
              onChange={changeProvider}
              options={AGENT_CLI_PROVIDER_IDS.map(id => ({
                value: id,
                label: agentCliSpec(id).label,
              }))}
            />
            <Select
              variant="badge"
              size="sm"
              value={selectedModel}
              aria-label={t('tabs.wikiCuratorConfigModelLabel')}
              onChange={value => persistConfig({ ...config, model: value || undefined })}
              options={[
                { value: '', label: t('tabs.wikiCuratorConfigModelDefault') },
                ...models.map(option => ({
                  value: option.id,
                  label: option.label,
                  hint: option.label === option.id ? undefined : option.id,
                })),
                ...(modelIsCustom ? [{ value: selectedModel, label: selectedModel }] : []),
              ]}
            />
          </div>
          <PlaneChatComposerShell
            value={draft}
            onChange={setDraft}
            placeholder={t('tabs.wikiCuratorPlaceholder')}
            inputLabel={t('tabs.wikiCuratorInputLabel')}
            sendLabel={
              thinking
                ? t('tabs.wikiCuratorStop')
                : micMode
                  ? (listening ? t('agentPane.dictationListening') : t('agentPane.dictationHold'))
                  : t('tabs.wikiCuratorSend')
            }
            sendMode={thinking ? 'stop' : micMode ? 'mic' : 'send'}
            sendDisabled={!thinking && !micMode && !canSend}
            listening={listening}
            disabled={false}
            onSendClick={handleSendClick}
            onMicStart={startDictation}
            onMicStop={stopDictation}
            onPaste={handlePaste}
            inputRef={inputRef}
            leading={(
              <>
                <PlaneSketchButton
                  label={t('sketch.open')}
                  disabled={thinking || pendingImages.length >= MAX_PENDING_IMAGES}
                  onClick={() => setSketchOpen(true)}
                />
                <Tooltip content={t('tabs.wikiCuratorConfigOpen')}>
                  <Button
                    variant="icon"
                    size="sm"
                    pressed={configOpen}
                    aria-label={t('tabs.wikiCuratorConfigOpen')}
                    aria-expanded={configOpen}
                    aria-haspopup="dialog"
                    onClick={() => setConfigOpen(open => !open)}
                  >
                    <Icon name="settings" size={14} aria-hidden />
                  </Button>
                </Tooltip>
              </>
            )}
            shellAside={pendingImages.length > 0 ? (
              <div
                className="plane-chat-composer__attachments"
                aria-label={t('agentPane.imagesAttached', { n: pendingImages.length })}
              >
                {pendingImages.map(image => (
                  <PendingImageThumb
                    key={image.id}
                    src={image.previewUrl}
                    name={image.name}
                    onRemove={() => removePendingImage(image.id)}
                  />
                ))}
              </div>
            ) : null}
          />
          {!listening && dictationError ? (
            <p className="plane-chat-composer__dictation-error" role="status">
              {dictationError}
            </p>
          ) : null}
        </div>
      </div>

      <SketchModal
        open={sketchOpen}
        onClose={() => setSketchOpen(false)}
        onAttach={handleSketchAttach}
      />
    </div>
  )
}
