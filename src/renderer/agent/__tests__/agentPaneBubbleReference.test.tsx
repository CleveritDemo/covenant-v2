/**
 * @vitest-environment jsdom
 *
 * AgentPane completo no se monta aquí: arrastra CLI, lanes e IPC.
 * Cubro attachBubbleReference con el mismo camino que el plano
 * (planeComposerPastedText.test.tsx): burbuja + composer, tope y ×.
 */
import React, { useCallback, useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  MAX_PENDING_PASTED_TEXTS,
  createQuotedReference,
  type ComposerPastedText,
} from '@shared/composerPastedText'
import { AgentChatBubbles } from '../AgentChatBubbles'
import { AgentPaneFooter } from '../AgentPaneFooter'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))

vi.mock('../Gravity', () => ({
  Gravity: () => <span data-testid="gravity" />,
}))

vi.mock('../../pushToTalkSpeech', () => ({
  usePushToTalkSpeech: () => ({
    listening: false,
    interim: '',
    level: 0,
    bands: [],
    start: vi.fn(),
    stop: vi.fn(),
  }),
  classifyDictationError: () => 'unsupported',
}))

vi.mock('../AgentPaneSendButton', () => ({
  AgentPaneSendButton: () => <button type="button">send</button>,
}))

vi.mock('../../components/DictationListeningOverlay', () => ({
  DictationListeningOverlay: () => null,
}))

vi.mock('../../components/TerminalModal', () => ({
  TerminalModal: () => null,
}))

afterEach(cleanup)

function PaneReferenceHarness(): React.ReactElement {
  const [pastes, setPastes] = useState<ComposerPastedText[]>([])
  const composerInputRef = useRef<HTMLTextAreaElement>(null)
  const attachBubbleReference = useCallback((content: string): void => {
    setPastes(previous =>
      previous.length >= MAX_PENDING_PASTED_TEXTS
        ? previous
        : [...previous, createQuotedReference(content)],
    )
  }, [])
  const removePendingPaste = useCallback((id: string): void => {
    setPastes(previous => previous.filter(paste => paste.id !== id))
  }, [])

  return (
    <div className="agent-pane">
      <AgentChatBubbles
        messages={[{ id: 'a1', role: 'assistant', content: 'Cita del pane.' }]}
        busy={false}
        activeAssistantId={null}
        onReferenceMessage={attachBubbleReference}
      />
      <AgentPaneFooter
        pendingImages={[]}
        pastedTexts={pastes}
        composerDisabled={false}
        busy={false}
        awaitingDelegations={false}
        delegationWorkActive={false}
        orchestratorBusy={false}
        input=""
        showStop={false}
        composerInputRef={composerInputRef}
        onInputChange={vi.fn()}
        onComposerPaste={vi.fn()}
        onComposerKeyDown={vi.fn()}
        onRemovePendingImage={vi.fn()}
        onRemovePastedText={removePendingPaste}
        onSendClick={vi.fn()}
        onDictateSend={vi.fn()}
      />
    </div>
  )
}

describe('AgentPane: citar burbuja en el composer', () => {
  it('el botón de citar adjunta una tarjeta, la × la quita y el tope no suma más', async () => {
    render(<PaneReferenceHarness />)
    const cite = screen.getByRole('button', { name: 'agentPane.referenceBubble' })

    await act(async () => {
      fireEvent.click(cite)
    })
    expect(screen.getByLabelText('agentPane.referenceTitle')).toBeTruthy()
    expect(screen.getAllByLabelText('agentPane.referenceTitle')).toHaveLength(1)

    await act(async () => {
      fireEvent.click(screen.getByLabelText('agentPane.removePastedText'))
    })
    expect(screen.queryByLabelText('agentPane.referenceTitle')).toBeNull()

    await act(async () => {
      for (let i = 0; i < MAX_PENDING_PASTED_TEXTS + 2; i += 1) {
        fireEvent.click(cite)
      }
    })
    expect(screen.getAllByLabelText('agentPane.referenceTitle')).toHaveLength(
      MAX_PENDING_PASTED_TEXTS,
    )
  })
})
