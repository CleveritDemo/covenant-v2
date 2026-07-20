import React from 'react'
import type { ClipboardEvent } from 'react'
import type { AgentPaneMeta } from '@shared/tabSession'
import type { TabContext } from '@shared/tabContext'
import { useT } from '@i18n/useT'
import { Icon } from '../components/ui/Icon'

export interface AgentPanePendingImage {
  id: string
  previewUrl: string
  name: string
}

export interface AgentPaneFooterProps {
  pendingImages: AgentPanePendingImage[]
  composerDisabled: boolean
  loopMode: boolean
  busy: boolean
  loopActive: boolean
  input: string
  showStop: boolean
  showPlay: boolean
  meta: AgentPaneMeta
  diskContexts: TabContext[]
  selectedContextIds: string[]
  selectedContexts: TabContext[]
  contextsPickerOpen: boolean
  contextsPickerRef: React.Ref<HTMLDivElement>
  contextsPickerLabel: string
  contextNotice: string
  composerInputRef: React.Ref<HTMLTextAreaElement>
  onInputChange: (value: string) => void
  onComposerPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void
  onComposerKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onRemovePendingImage: (id: string) => void
  onToggleContextsPicker: () => void
  onToggleContext: (contextId: string) => void
  onOpenContextsModal: () => void
  onAutoImproveChange: (checked: boolean) => void
  onSendClick: () => void
}

export const AgentPaneFooter: React.FC<AgentPaneFooterProps> = ({
  pendingImages,
  composerDisabled,
  loopMode,
  busy,
  loopActive,
  input,
  showStop,
  showPlay,
  meta,
  diskContexts,
  selectedContextIds,
  selectedContexts,
  contextsPickerOpen,
  contextsPickerRef,
  contextsPickerLabel,
  contextNotice,
  composerInputRef,
  onInputChange,
  onComposerPaste,
  onComposerKeyDown,
  onRemovePendingImage,
  onToggleContextsPicker,
  onToggleContext,
  onOpenContextsModal,
  onAutoImproveChange,
  onSendClick,
}) => {
  const { t } = useT()

  return (
    <div className="agent-pane__footer">
      {pendingImages.length > 0 && (
        <div className="agent-pane__attachments" aria-label={t('agentPane.imagesAttached', { n: pendingImages.length })}>
          {pendingImages.map(image => (
            <div key={image.id} className="agent-pane__attachment">
              <img src={image.previewUrl} alt={image.name} />
              <button
                type="button"
                className="agent-pane__attachment-remove"
                onClick={() => onRemovePendingImage(image.id)}
                disabled={composerDisabled}
                title={t('agentPane.removeImage')}
                aria-label={t('agentPane.removeImage')}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="agent-pane__contexts">
        <div className="agent-pane__contexts-head">
          <span>{t('tabContexts.barTitle')}</span>
          <div
            className={[
              'agent-pane__contexts-picker',
              contextsPickerOpen ? 'agent-pane__contexts-picker--open' : '',
            ].filter(Boolean).join(' ')}
            ref={contextsPickerRef}
          >
            <button
              type="button"
              className="agent-pane__contexts-picker-trigger"
              aria-haspopup="listbox"
              aria-expanded={contextsPickerOpen}
              aria-label={t('tabContexts.pickerAria', { label: contextsPickerLabel })}
              disabled={busy || loopActive || diskContexts.length === 0}
              title={diskContexts.length === 0 ? t('tabContexts.empty') : contextsPickerLabel}
              onClick={onToggleContextsPicker}
              onMouseDown={event => event.stopPropagation()}
            >
              <span className="agent-pane__contexts-picker-label">{contextsPickerLabel}</span>
              {selectedContexts.length > 0 && (
                <span className="agent-pane__contexts-picker-count" aria-hidden="true">
                  {selectedContexts.length}
                </span>
              )}
              <Icon name="chevron-down" size={12} />
            </button>
            {contextsPickerOpen && (
              <div className="agent-pane__contexts-menu" role="listbox" aria-multiselectable="true">
                {diskContexts.map(context => {
                  const checked = selectedContextIds.includes(context.id)
                  return (
                    <label
                      key={context.id}
                      className={[
                        'agent-pane__contexts-option',
                        checked ? 'agent-pane__contexts-option--checked' : '',
                      ].filter(Boolean).join(' ')}
                      title={`${context.name} — ${t(`tabContexts.kind_${context.kind}`)}`}
                    >
                      <input
                        type="checkbox"
                        role="option"
                        aria-selected={checked}
                        checked={checked}
                        disabled={busy || loopActive}
                        onChange={() => onToggleContext(context.id)}
                      />
                      <span className="agent-pane__contexts-option-check" aria-hidden="true" />
                      <span className="agent-pane__contexts-option-name">{context.name}</span>
                      <span className="agent-pane__contexts-option-kind">
                        {t(`tabContexts.kind_${context.kind}`)}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
          <button
            type="button"
            className="agent-pane__contexts-manage"
            title={t('tabContexts.manage')}
            aria-label={t('tabContexts.manage')}
            onClick={onOpenContextsModal}
            disabled={loopActive}
          >
            <Icon name="settings" size={14} />
          </button>
          <label
            className="agent-pane__context-auto-improve"
            title={t('tabContexts.autoImproveHint')}
          >
            <input
              type="checkbox"
              role="switch"
              checked={meta.autoImproveContexts === true}
              disabled={busy || loopActive || !(meta.contextIds?.length)}
              onChange={event => onAutoImproveChange(event.target.checked)}
            />
            <span aria-hidden="true" />
            {t('tabContexts.autoImprove')}
          </label>
        </div>
        {contextNotice && <div className="agent-pane__context-notice">{contextNotice}</div>}
      </div>

      <div className={['agent-pane__composer', loopMode ? 'agent-pane__composer--loop' : ''].filter(Boolean).join(' ')}>
        <textarea
          ref={composerInputRef}
          value={input}
          placeholder={
            loopMode ? t('agentPane.loopPlaceholder')
              : busy ? t('agentPane.queuePlaceholder')
                : t('agentPane.placeholder')
          }
          disabled={composerDisabled}
          rows={1}
          onChange={event => onInputChange(event.target.value)}
          onPaste={onComposerPaste}
          onKeyDown={onComposerKeyDown}
        />
        <button
          className={[
            'agent-pane__send',
            showStop ? 'agent-pane__send--stop' : '',
            showPlay ? 'agent-pane__send--play' : '',
          ].filter(Boolean).join(' ')}
          disabled={!showStop && !input.trim() && pendingImages.length === 0}
          onClick={onSendClick}
          title={
            showStop ? (loopActive ? t('agentPane.loopStop') : t('agentPane.stop'))
              : showPlay ? t('agentPane.loopStart')
                : t('agentPane.send')
          }
        >
          <Icon
            name={showStop ? 'stop' : showPlay ? 'play' : 'send'}
            size={14}
          />
        </button>
      </div>
    </div>
  )
}
