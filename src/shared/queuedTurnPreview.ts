import type { DelegateResultStatus } from './agentOrchestration'
import { looksLikeDelegationBrief } from './delegationBriefCard'
import { parseDelegationResultCards } from './delegationResultCards'
import { firstUsefulPromptLine, stripMarkdownForSnippet } from './promptSnippet'
import {
  formatCatalogAgentDelegationLabel,
  type ProjectAgentDefinition,
} from './projectAgentCatalog'

/** Delegación encolada con contrato completo; compatible con PlaneSendDelegation. */
export interface QueuedTurnDelegationLike {
  id: string
  fromPaneId: string
  toAgentId: string
  orchestrationJobId: string
  threadId?: string
  cwd?: string
}

/** Subconjunto que el preview realmente lee de una delegación encolada. */
export type QueuedTurnDelegationPreviewLike = Pick<
  QueuedTurnDelegationLike,
  'id' | 'fromPaneId' | 'toAgentId'
>

export interface QueuedTurnPreviewInput {
  text: string
  orchestrationFollowUp?: boolean
  delegation?: QueuedTurnDelegationPreviewLike
}

/** Forma mínima de un turno encolado para dedupe humano y preview. */
export interface HumanQueuedTurnLike {
  text: string
  /** Cola local usa previewUrl; planeSend usa AgentCliImageAttachment (solo cuenta). */
  images?: readonly unknown[]
  orchestrationFollowUp?: boolean
  delegation?: QueuedTurnDelegationLike
}

export interface QueuedTurnPreviewAgentItem {
  agentLabel: string
  status: DelegateResultStatus
  summarySnippet?: string
}

export type QueuedTurnPreview =
  | { kind: 'human'; fallbackText?: string }
  | { kind: 'delegation_task'; agentLabel: string }
  | ({ kind: 'delegation_result' } & QueuedTurnPreviewAgentItem)
  | { kind: 'delegation_results_batch'; items: QueuedTurnPreviewAgentItem[] }

export function resolveAgentLabel(
  agentId: string,
  catalog: readonly ProjectAgentDefinition[],
): string {
  const to = agentId.trim()
  if (!to) return agentId
  return catalog.length
    ? formatCatalogAgentDelegationLabel(to, catalog)
    : to
}

function firstUsefulSummaryLine(summary: string): string {
  for (const raw of summary.split('\n')) {
    const line = stripMarkdownForSnippet(raw.trim())
    if (!line) continue
    if (/^#{1,6}\s/.test(raw.trim())) continue
    return line
  }
  return ''
}

function truncateText(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}…`
}

function summarySnippet(summary: string): string | undefined {
  const line = firstUsefulSummaryLine(summary)
  if (!line) return undefined
  return truncateText(line, 72)
}

function stripDelegationHeaders(text: string): string {
  return text
    .split('\n')
    .filter(line => line.trim() !== '## Delegation result')
    .join('\n')
    .trim()
}

function cardPreviewItem(
  card: ReturnType<typeof parseDelegationResultCards>[number],
  catalog: readonly ProjectAgentDefinition[],
): QueuedTurnPreviewAgentItem {
  const agentId = card.agentId?.trim() ?? ''
  const agentLabel = agentId
    ? resolveAgentLabel(agentId, catalog)
    : 'agent'
  const snippet = card.summary ? summarySnippet(card.summary) : undefined
  return {
    agentLabel,
    status: card.status,
    ...(snippet ? { summarySnippet: snippet } : {}),
  }
}

export function resolveQueuedTurnPreview(
  item: QueuedTurnPreviewInput,
  catalog?: readonly ProjectAgentDefinition[],
): QueuedTurnPreview {
  const cat = catalog ?? []

  if (item.delegation) {
    const agentLabel = resolveAgentLabel(item.delegation.toAgentId, cat)
    return {
      kind: 'delegation_task',
      agentLabel,
    }
  }

  if (item.orchestrationFollowUp) {
    const cards = parseDelegationResultCards(item.text)
    if (cards.length === 0) {
      const cleaned = stripDelegationHeaders(item.text)
      const truncated = truncateText(stripMarkdownForSnippet(cleaned), 120)
      return truncated
        ? { kind: 'human', fallbackText: truncated }
        : { kind: 'human' }
    }
    if (cards.length === 1) {
      return {
        kind: 'delegation_result',
        ...cardPreviewItem(cards[0], cat),
      }
    }
    return {
      kind: 'delegation_results_batch',
      items: cards.map(card => cardPreviewItem(card, cat)),
    }
  }

  if (looksLikeDelegationBrief(item.text)) {
    const line = firstUsefulPromptLine(item.text)
    if (line) {
      return { kind: 'human', fallbackText: truncateText(line, 120) }
    }
  }

  return { kind: 'human' }
}
