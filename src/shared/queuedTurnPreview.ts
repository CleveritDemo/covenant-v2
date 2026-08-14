import type { DelegateResultStatus } from './agentOrchestration'
import { parseDelegationResultCards } from './delegationResultCards'
import {
  formatCatalogAgentDelegationLabel,
  type ProjectAgentDefinition,
} from './projectAgentCatalog'

export interface QueuedTurnPreviewInput {
  text: string
  orchestrationFollowUp?: boolean
  delegation?: { id: string; fromPaneId: string; toAgentId: string }
}

export interface QueuedTurnPreviewAgentItem {
  agentLabel: string
  instanceTag?: string
  status: DelegateResultStatus
  summarySnippet?: string
}

export type QueuedTurnPreview =
  | { kind: 'human'; fallbackText?: string }
  | { kind: 'delegation_task'; agentLabel: string; instanceTag?: string }
  | ({ kind: 'delegation_result' } & QueuedTurnPreviewAgentItem)
  | { kind: 'delegation_results_batch'; items: QueuedTurnPreviewAgentItem[] }

export function resolveAgentLabel(
  agentId: string,
  catalog: readonly ProjectAgentDefinition[],
): { agentLabel: string; instanceTag?: string } {
  const to = agentId.trim()
  if (!to) return { agentLabel: agentId }
  const agentLabel = catalog.length
    ? formatCatalogAgentDelegationLabel(to, catalog)
    : to
  return { agentLabel }
}

function stripMarkdownInline(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim()
}

function firstUsefulSummaryLine(summary: string): string {
  for (const raw of summary.split('\n')) {
    const line = stripMarkdownInline(raw.trim())
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
  const { agentLabel, instanceTag } = agentId
    ? resolveAgentLabel(agentId, catalog)
    : { agentLabel: 'agent' }
  const snippet = card.summary ? summarySnippet(card.summary) : undefined
  return {
    agentLabel,
    ...(instanceTag ? { instanceTag } : {}),
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
    const { agentLabel, instanceTag } = resolveAgentLabel(item.delegation.toAgentId, cat)
    return {
      kind: 'delegation_task',
      agentLabel,
      ...(instanceTag ? { instanceTag } : {}),
    }
  }

  if (item.orchestrationFollowUp) {
    const cards = parseDelegationResultCards(item.text)
    if (cards.length === 0) {
      const cleaned = stripDelegationHeaders(item.text)
      const truncated = truncateText(stripMarkdownInline(cleaned), 120)
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

  return { kind: 'human' }
}
