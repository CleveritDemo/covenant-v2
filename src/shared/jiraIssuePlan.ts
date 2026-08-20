import { stripBrainstormProtocolFences } from './brainstormRoom'

export type JiraPlanNodeType = 'epic' | 'story' | 'task' | 'subtask'

export interface JiraPlanNode {
  tempId: string
  type: JiraPlanNodeType
  summary: string
  description: string
  children: JiraPlanNode[]
}

export interface JiraIssuePlan {
  nodes: JiraPlanNode[]
}

const MAX_NODES = 50
const MAX_SUMMARY_LENGTH = 255
const MAX_TOPIC_LENGTH = 200

interface ParsedBullet {
  firstLine: string
  continuationLines: string[]
}

interface BulletContent {
  summary: string
  description: string
}

function escapeRegExp(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function lineIndent(line: string): number {
  const match = /^(\s*)/.exec(line)
  return match ? match[1].length : 0
}

function isBulletLine(line: string): boolean {
  const trimmed = line.trimStart()
  if (!trimmed) return false
  const first = trimmed[0]
  if (first === '-' || first === '*' || first === '•') return true
  return /^\d+[.)]/.test(trimmed)
}

function stripBulletMarker(line: string): string {
  return line
    .trim()
    .replace(/^[-*•]\s+/, '')
    .replace(/^\d+[.)]\s*/, '')
    .trim()
}

function parseBullets(text: string): ParsedBullet[] {
  if (!text.trim()) return []

  const bullets: ParsedBullet[] = []
  let current: ParsedBullet | null = null
  let currentIndent = 0

  for (const rawLine of text.split('\n')) {
    if (!rawLine.trim()) {
      if (current) current.continuationLines.push(rawLine)
      continue
    }

    const indent = lineIndent(rawLine)
    if (isBulletLine(rawLine) && (!current || indent <= currentIndent)) {
      current = { firstLine: rawLine, continuationLines: [] }
      currentIndent = indent
      bullets.push(current)
      continue
    }

    if (current && (indent > currentIndent || !isBulletLine(rawLine))) {
      current.continuationLines.push(rawLine)
      continue
    }

    if (isBulletLine(rawLine)) {
      current = { firstLine: rawLine, continuationLines: [] }
      currentIndent = indent
      bullets.push(current)
    }
  }

  return bullets
}

function stripCodeSpans(text: string): string {
  return text.replace(/`([^`]+)`/g, '$1')
}

function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function normalizeSummaryKey(summary: string): string {
  return collapseSpaces(summary).toLowerCase()
}

function bulletSummary(firstLine: string): string {
  const stripped = stripCodeSpans(stripBulletMarker(firstLine))
  return collapseSpaces(stripped).slice(0, MAX_SUMMARY_LENGTH)
}

function provenanceLine(topic: string): string {
  const trimmedTopic = topic.trim().slice(0, MAX_TOPIC_LENGTH)
  return `From Gravity room: ${trimmedTopic}`
}

function bulletDescription(
  continuationLines: string[],
  topic: string,
): string {
  const body = continuationLines.join('\n').trimEnd()
  const footer = provenanceLine(topic)
  return body ? `${body}\n\n${footer}` : footer
}

function extractStoryId(firstLine: string): string | null {
  const stripped = stripBulletMarker(firstLine)
  const match = /^([A-Za-z0-9]{1,4})(?:\s|[—\-:.])/.exec(stripped)
  return match ? match[1] : null
}

function taskBelongsToStory(taskFirstLine: string, storyId: string): boolean {
  const stripped = stripBulletMarker(taskFirstLine).trim()
  if (stripped.startsWith(`${storyId}.`)) return true
  return new RegExp(`^${escapeRegExp(storyId)}(?:\\s|[—\\-:.])`).test(stripped)
}

function bulletContent(bullet: ParsedBullet, topic: string): BulletContent | null {
  const summary = bulletSummary(bullet.firstLine)
  if (!summary) return null
  return {
    summary,
    description: bulletDescription(bullet.continuationLines, topic),
  }
}

function createNode(
  type: JiraPlanNodeType,
  content: BulletContent,
): JiraPlanNode {
  return {
    tempId: '',
    type,
    summary: content.summary,
    description: content.description,
    children: [],
  }
}

function assignTempIds(nodes: JiraPlanNode[]): void {
  let rootIndex = 0
  for (const node of nodes) {
    rootIndex += 1
    node.tempId = `n${rootIndex}`
    let childIndex = 0
    for (const child of node.children) {
      childIndex += 1
      child.tempId = `${node.tempId}.${childIndex}`
    }
  }
}

export function buildJiraIssuePlanFromClosing(input: {
  topic: string
  ceremony: string
  fields: Readonly<Record<string, string>>
}): JiraIssuePlan {
  const topic = input.topic.trim()
  const committedText = stripBrainstormProtocolFences(input.fields.committed ?? '')
  const tasksText = stripBrainstormProtocolFences(input.fields.tasks ?? '')
  const nextText = stripBrainstormProtocolFences(input.fields.next ?? '')

  const committedBullets = parseBullets(committedText)
  const taskBullets = parseBullets(tasksText)
  const nextBullets = parseBullets(nextText)

  const seenSummaries = new Set<string>()
  const nodes: JiraPlanNode[] = []
  let nodeCount = 0

  const tryAddNode = (node: JiraPlanNode): boolean => {
    const key = normalizeSummaryKey(node.summary)
    if (seenSummaries.has(key)) return false
    if (nodeCount >= MAX_NODES) return false
    seenSummaries.add(key)
    nodeCount += 1
    nodes.push(node)
    return true
  }

  const tryAddChild = (parent: JiraPlanNode, node: JiraPlanNode): boolean => {
    const key = normalizeSummaryKey(node.summary)
    if (seenSummaries.has(key)) return false
    if (nodeCount >= MAX_NODES) return false
    seenSummaries.add(key)
    nodeCount += 1
    parent.children.push(node)
    return true
  }

  const stories: Array<{ node: JiraPlanNode; storyId: string | null }> = []

  if (committedBullets.length > 0) {
    for (const bullet of committedBullets) {
      if (nodeCount >= MAX_NODES) break
      const content = bulletContent(bullet, topic)
      if (!content) continue
      const story = createNode('story', content)
      if (tryAddNode(story)) {
        stories.push({ node: story, storyId: extractStoryId(bullet.firstLine) })
      }
    }
  }

  if (taskBullets.length > 0) {
    for (const bullet of taskBullets) {
      if (nodeCount >= MAX_NODES) break
      const content = bulletContent(bullet, topic)
      if (!content) continue

      if (stories.length > 0) {
        let attached = false
        for (const { node, storyId } of stories) {
          if (storyId && taskBelongsToStory(bullet.firstLine, storyId)) {
            tryAddChild(node, createNode('subtask', content))
            attached = true
            break
          }
        }
        if (!attached) tryAddNode(createNode('task', content))
      } else {
        tryAddNode(createNode('task', content))
      }
    }
  } else if (committedBullets.length === 0 && taskBullets.length === 0 && nextBullets.length > 0) {
    for (const bullet of nextBullets) {
      if (nodeCount >= MAX_NODES) break
      const content = bulletContent(bullet, topic)
      if (!content) continue
      tryAddNode(createNode('task', content))
    }
  }

  assignTempIds(nodes)
  return { nodes }
}

export function flattenJiraIssuePlan(
  plan: JiraIssuePlan,
  typeNames: { epic: string; story: string; task: string; subtask: string },
): Array<{
  tempId: string
  parentTempId?: string
  issueTypeName: string
  summary: string
  description?: string
}> {
  const out: Array<{
    tempId: string
    parentTempId?: string
    issueTypeName: string
    summary: string
    description?: string
  }> = []

  const visit = (node: JiraPlanNode, parentTempId?: string) => {
    const description = node.description.trim()
    out.push({
      tempId: node.tempId,
      parentTempId,
      issueTypeName: typeNames[node.type],
      summary: node.summary,
      ...(description ? { description } : {}),
    })
    for (const child of node.children) visit(child, node.tempId)
  }

  for (const node of plan.nodes) visit(node)
  return out
}
