import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildJiraIssuePlanFromClosing,
  type JiraPlanNode,
  type JiraPlanNodeType,
} from '@shared/jiraIssuePlan'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { Button, Icon, Input, Select, Tooltip } from '../components/ui'
import type { SelectOption } from '../components/ui/Select'
import './JiraBacklogModal.css'

/** Encima del overlay del plano (670) y debajo del popup de aspecto (940). */
const JIRA_BACKLOG_MODAL_Z = 900

const PLAN_NODE_TYPES: JiraPlanNodeType[] = ['epic', 'story', 'task', 'subtask']

type FlatRow = {
  tempId: string
  parentTempId?: string
  type: JiraPlanNodeType
  summary: string
  description: string
}

type TypeNameMap = Record<JiraPlanNodeType, string>

type CreateResult = { ok: boolean; key?: string; error?: string }

interface JiraStatus {
  configured: boolean
  site: string
  email: string
  projectKeys: string[]
  connected: boolean
}

export interface JiraBacklogModalProps {
  open: boolean
  cwd: string
  topic: string
  ceremony: string
  fields: Readonly<Record<string, string>>
  onClose: () => void
}

function flattenPlanToRows(plan: { nodes: JiraPlanNode[] }): FlatRow[] {
  const rows: FlatRow[] = []
  const visit = (node: JiraPlanNode, parentTempId?: string): void => {
    rows.push({
      tempId: node.tempId,
      parentTempId,
      type: node.type,
      summary: node.summary,
      description: node.description,
    })
    for (const child of node.children) visit(child, node.tempId)
  }
  for (const node of plan.nodes) visit(node)
  return rows
}

function defaultTypeNames(
  issueTypes: Array<{ id: string; name: string; subtask: boolean }>,
): TypeNameMap {
  const nonSubtasks = issueTypes.filter(type => !type.subtask)
  const subtasks = issueTypes.filter(type => type.subtask)
  const pickByName = (needle: string): string =>
    nonSubtasks.find(type => type.name.toLowerCase() === needle)?.name
    ?? nonSubtasks[0]?.name
    ?? ''

  return {
    epic: pickByName('epic'),
    story: pickByName('story'),
    task: pickByName('task'),
    subtask: subtasks[0]?.name ?? '',
  }
}

function typeNameOptions(
  issueTypes: Array<{ id: string; name: string; subtask: boolean }>,
  subtaskOnly: boolean,
): SelectOption[] {
  const filtered = subtaskOnly
    ? issueTypes.filter(type => type.subtask)
    : issueTypes.filter(type => !type.subtask)
  return filtered.map(type => ({ value: type.name, label: type.name }))
}

function descendantIds(rows: FlatRow[], tempId: string): Set<string> {
  const out = new Set<string>()
  const walk = (parentId: string): void => {
    for (const row of rows) {
      if (row.parentTempId === parentId && !out.has(row.tempId)) {
        out.add(row.tempId)
        walk(row.tempId)
      }
    }
  }
  walk(tempId)
  return out
}

/** Árbol editable del plan Jira derivado del acta de sala. */
export const JiraBacklogModal: React.FC<JiraBacklogModalProps> = ({
  open,
  cwd,
  topic,
  ceremony,
  fields,
  onClose,
}) => {
  const { t } = useT()
  const wasOpenRef = useRef(false)
  const [status, setStatus] = useState<JiraStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [projectKey, setProjectKey] = useState('')
  const [issueTypes, setIssueTypes] = useState<Array<{ id: string; name: string; subtask: boolean }>>([])
  const [typesError, setTypesError] = useState<string | null>(null)
  const [typesLoading, setTypesLoading] = useState(false)
  const [typeNames, setTypeNames] = useState<TypeNameMap>({
    epic: '',
    story: '',
    task: '',
    subtask: '',
  })
  const [rows, setRows] = useState<FlatRow[]>([])
  const [resultsById, setResultsById] = useState<Record<string, CreateResult>>({})
  const [busy, setBusy] = useState(false)

  const loadIssueTypes = useCallback(async (key: string): Promise<void> => {
    setTypesLoading(true)
    setTypesError(null)
    const response = await window.api.jiraIssueTypes(cwd.trim(), key)
    setTypesLoading(false)
    if (!response.ok) {
      setIssueTypes([])
      setTypeNames({ epic: '', story: '', task: '', subtask: '' })
      setTypesError(response.error ?? t('tabs.jiraBacklogTypesError'))
      return
    }
    setIssueTypes(response.issueTypes)
    setTypeNames(defaultTypeNames(response.issueTypes))
  }, [cwd, t])

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const plan = buildJiraIssuePlanFromClosing({ topic, ceremony, fields })
      setRows(flattenPlanToRows(plan))
      setResultsById({})
      setBusy(false)
      setStatus(null)
      setProjectKey('')
      setIssueTypes([])
      setTypesError(null)
      setTypeNames({ epic: '', story: '', task: '', subtask: '' })

      setStatusLoading(true)
      void window.api.jiraStatus(cwd.trim()).then(nextStatus => {
        setStatus(nextStatus)
        setStatusLoading(false)
        if (nextStatus.configured && nextStatus.connected && nextStatus.projectKeys.length > 0) {
          const firstKey = nextStatus.projectKeys[0]
          setProjectKey(firstKey)
          void loadIssueTypes(firstKey)
        }
      })
    }
    wasOpenRef.current = open
  }, [open, topic, ceremony, fields, cwd, loadIssueTypes])

  const connected = Boolean(status?.configured && status?.connected)
  const typeNamesComplete = PLAN_NODE_TYPES.every(kind => typeNames[kind].trim().length > 0)
  const summariesValid = rows.every(row => row.summary.trim().length > 0)
  const canCreate = connected
    && !busy
    && !typesLoading
    && !statusLoading
    && !typesError
    && projectKey.length > 0
    && rows.length > 0
    && typeNamesComplete
    && summariesValid

  const rootRows = useMemo(
    () => rows.filter(row => !row.parentTempId),
    [rows],
  )

  const childrenByParent = useMemo(() => {
    const map = new Map<string, FlatRow[]>()
    for (const row of rows) {
      if (!row.parentTempId) continue
      const list = map.get(row.parentTempId) ?? []
      list.push(row)
      map.set(row.parentTempId, list)
    }
    return map
  }, [rows])

  const parentOptionsFor = (row: FlatRow): SelectOption[] => {
    const roots = rows.filter(
      candidate => !candidate.parentTempId && candidate.tempId !== row.tempId,
    )
    return [
      { value: '', label: t('tabs.jiraBacklogParentNone') },
      ...roots.map(candidate => ({ value: candidate.tempId, label: candidate.summary })),
    ]
  }

  const nodeTypeOptions: SelectOption[] = PLAN_NODE_TYPES.map(type => ({
    value: type,
    label: t(`tabs.jiraBacklogNodeType${type.charAt(0).toUpperCase()}${type.slice(1)}`),
  }))

  const updateRow = (tempId: string, patch: Partial<FlatRow>): void => {
    setRows(current => current.map(row => (row.tempId === tempId ? { ...row, ...patch } : row)))
  }

  const handleParentChange = (tempId: string, nextParent: string): void => {
    if (nextParent) {
      const parentRow = rows.find(row => row.tempId === nextParent)
      if (parentRow?.parentTempId) return
    }
    updateRow(tempId, { parentTempId: nextParent || undefined })
  }

  const handleDelete = (tempId: string): void => {
    const remove = descendantIds(rows, tempId)
    remove.add(tempId)
    setRows(current => current.filter(row => !remove.has(row.tempId)))
  }

  const handleProjectChange = (key: string): void => {
    setProjectKey(key)
    void loadIssueTypes(key)
  }

  const handleCreate = async (): Promise<void> => {
    if (!canCreate) return
    setBusy(true)
    const nodes = rows.map(row => {
      const description = row.description.trim()
      return {
        tempId: row.tempId,
        parentTempId: row.parentTempId,
        issueTypeName: typeNames[row.type],
        summary: row.summary.trim(),
        ...(description ? { description } : {}),
      }
    })
    const response = await window.api.jiraCreateIssues(cwd.trim(), { projectKey, nodes })
    setBusy(false)
    const nextResults: Record<string, CreateResult> = { ...resultsById }
    for (const result of response.results) {
      nextResults[result.tempId] = {
        ok: result.ok,
        key: result.key,
        error: result.error,
      }
    }
    setResultsById(nextResults)
  }

  const createdCount = Object.values(resultsById).filter(result => result.ok).length
  const failedCount = Object.values(resultsById).filter(result => result.ok === false).length
  const showResultLine = createdCount + failedCount > 0

  const renderRow = (row: FlatRow, depth: 0 | 1): React.ReactNode => {
    const result = resultsById[row.tempId]
    const rowDisabled = Boolean(result?.ok)

    return (
      <React.Fragment key={row.tempId}>
        <div
          className={depth === 1
            ? 'jira-backlog__row jira-backlog__row--child'
            : 'jira-backlog__row'}
        >
          <Input
            type="text"
            value={row.summary}
            disabled={rowDisabled}
            aria-label={t('tabs.jiraBacklogSummary')}
            onChange={event => updateRow(row.tempId, { summary: event.target.value })}
          />
          <Select
            value={row.type}
            options={nodeTypeOptions}
            disabled={rowDisabled}
            aria-label={t('tabs.jiraBacklogNodeType')}
            onChange={value => updateRow(row.tempId, { type: value as JiraPlanNodeType })}
          />
          <Select
            value={row.parentTempId ?? ''}
            options={parentOptionsFor(row)}
            disabled={rowDisabled}
            aria-label={t('tabs.jiraBacklogParent')}
            onChange={value => handleParentChange(row.tempId, value)}
          />
          {result?.ok && result.key ? (
            <Tooltip content={result.key} hint={`${status?.site ?? ''}/browse/${result.key}`}>
              <span className="jira-backlog__key">{result.key}</span>
            </Tooltip>
          ) : result?.error ? (
            <span className="jira-backlog__row-error">{result.error}</span>
          ) : (
            <Button
              size="xs"
              variant="ghost"
              disabled={rowDisabled}
              aria-label={t('tabs.jiraBacklogDelete')}
              onClick={() => handleDelete(row.tempId)}
            >
              <Icon name="trash" size={13} />
            </Button>
          )}
        </div>
        {(childrenByParent.get(row.tempId) ?? []).map(child => renderRow(child, 1))}
      </React.Fragment>
    )
  }

  const projectOptions: SelectOption[] = (status?.projectKeys ?? []).map(key => ({
    value: key,
    label: key,
  }))

  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      title={t('tabs.jiraBacklogTitle')}
      size="lg"
      zIndex={JIRA_BACKLOG_MODAL_Z}
      closeOnEscape
      footer={(
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('tabs.jiraBacklogClose')}
          </Button>
          {connected ? (
            <Button
              variant="primary"
              size="sm"
              disabled={!canCreate}
              onClick={() => { void handleCreate() }}
            >
              {t('tabs.jiraBacklogCreate')}
            </Button>
          ) : null}
        </>
      )}
    >
      <div className="jira-backlog">
        {statusLoading ? (
          <p className="jira-backlog__message">{t('tabs.jiraBacklogLoading')}</p>
        ) : !connected ? (
          <p className="jira-backlog__message">{t('tabs.jiraBacklogNotConnected')}</p>
        ) : (
          <>
            <label className="jira-backlog__field">
              <span className="jira-backlog__label">{t('tabs.jiraBacklogProject')}</span>
              <Select
                value={projectKey}
                options={projectOptions}
                disabled={busy || typesLoading}
                aria-label={t('tabs.jiraBacklogProject')}
                onChange={handleProjectChange}
              />
            </label>

            <div className="jira-backlog__types">
              <label className="jira-backlog__field">
                <span className="jira-backlog__label">{t('tabs.jiraBacklogTypeEpic')}</span>
                <Select
                  value={typeNames.epic}
                  options={typeNameOptions(issueTypes, false)}
                  disabled={busy || typesLoading || Boolean(typesError)}
                  aria-label={t('tabs.jiraBacklogTypeEpic')}
                  onChange={value => setTypeNames(current => ({ ...current, epic: value }))}
                />
              </label>
              <label className="jira-backlog__field">
                <span className="jira-backlog__label">{t('tabs.jiraBacklogTypeStory')}</span>
                <Select
                  value={typeNames.story}
                  options={typeNameOptions(issueTypes, false)}
                  disabled={busy || typesLoading || Boolean(typesError)}
                  aria-label={t('tabs.jiraBacklogTypeStory')}
                  onChange={value => setTypeNames(current => ({ ...current, story: value }))}
                />
              </label>
              <label className="jira-backlog__field">
                <span className="jira-backlog__label">{t('tabs.jiraBacklogTypeTask')}</span>
                <Select
                  value={typeNames.task}
                  options={typeNameOptions(issueTypes, false)}
                  disabled={busy || typesLoading || Boolean(typesError)}
                  aria-label={t('tabs.jiraBacklogTypeTask')}
                  onChange={value => setTypeNames(current => ({ ...current, task: value }))}
                />
              </label>
              <label className="jira-backlog__field">
                <span className="jira-backlog__label">{t('tabs.jiraBacklogTypeSubtask')}</span>
                <Select
                  value={typeNames.subtask}
                  options={typeNameOptions(issueTypes, true)}
                  disabled={busy || typesLoading || Boolean(typesError)}
                  aria-label={t('tabs.jiraBacklogTypeSubtask')}
                  onChange={value => setTypeNames(current => ({ ...current, subtask: value }))}
                />
              </label>
            </div>

            {typesError ? (
              <p className="jira-backlog__message jira-backlog__message--error">{typesError}</p>
            ) : null}

            {rows.length === 0 ? (
              <p className="jira-backlog__message">{t('tabs.jiraBacklogEmpty')}</p>
            ) : (
              <div className="jira-backlog__tree">
                {rootRows.map(row => renderRow(row, 0))}
              </div>
            )}

            {showResultLine ? (
              <p className="jira-backlog__result" role="status">
                {t('tabs.jiraBacklogResult', {
                  created: String(createdCount),
                  failed: String(failedCount),
                })}
              </p>
            ) : null}
          </>
        )}
      </div>
    </TerminalModal>
  )
}
