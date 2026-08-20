import { describe, expect, it } from 'vitest'
import {
  buildJiraIssuePlanFromClosing,
  flattenJiraIssuePlan,
} from '../jiraIssuePlan'

const TYPE_NAMES = {
  epic: 'Epic',
  story: 'Story',
  task: 'Task',
  subtask: 'Sub-task',
}

describe('buildJiraIssuePlanFromClosing', () => {
  it('sprint planning: stories with subtasks and one root task', () => {
    const plan = buildJiraIssuePlanFromClosing({
      topic: 'Sprint 12 planning',
      ceremony: 'sprintPlanning',
      fields: {
        committed: [
          '- S1 — Login flow',
          '- S2 — Billing page',
        ].join('\n'),
        tasks: [
          '- S1.1 — Wire auth form',
          '- S2.1 — Add invoice table',
          '- Algo suelto',
        ].join('\n'),
      },
    })

    expect(plan.nodes).toHaveLength(3)
    expect(plan.nodes[0]).toMatchObject({ type: 'story', summary: 'S1 — Login flow' })
    expect(plan.nodes[1]).toMatchObject({ type: 'story', summary: 'S2 — Billing page' })
    expect(plan.nodes[2]).toMatchObject({ type: 'task', summary: 'Algo suelto' })

    expect(plan.nodes[0].children).toHaveLength(1)
    expect(plan.nodes[0].children[0]).toMatchObject({
      type: 'subtask',
      summary: 'S1.1 — Wire auth form',
    })

    expect(plan.nodes[1].children).toHaveLength(1)
    expect(plan.nodes[1].children[0]).toMatchObject({
      type: 'subtask',
      summary: 'S2.1 — Add invoice table',
    })

    expect(plan.nodes[0].tempId).toBe('n1')
    expect(plan.nodes[0].children[0].tempId).toBe('n1.1')
    expect(plan.nodes[1].tempId).toBe('n2')
    expect(plan.nodes[1].children[0].tempId).toBe('n2.1')
    expect(plan.nodes[2].tempId).toBe('n3')
  })

  it('only tasks without committed → all root tasks', () => {
    const plan = buildJiraIssuePlanFromClosing({
      topic: 'Backlog grooming',
      ceremony: 'free',
      fields: {
        tasks: '- Fix cache\n- Update docs',
      },
    })

    expect(plan.nodes).toEqual([
      expect.objectContaining({ type: 'task', summary: 'Fix cache', children: [] }),
      expect.objectContaining({ type: 'task', summary: 'Update docs', children: [] }),
    ])
  })

  it('strips code spans from summary', () => {
    const plan = buildJiraIssuePlanFromClosing({
      topic: 'Room',
      ceremony: 'free',
      fields: {
        tasks: '- Ship `auth.ts` handler',
      },
    })

    expect(plan.nodes[0].summary).toBe('Ship auth.ts handler')
  })

  it('puts continuation lines in description with provenance at the end', () => {
    const plan = buildJiraIssuePlanFromClosing({
      topic: 'Auth hardening',
      ceremony: 'free',
      fields: {
        tasks: '- Rotate keys\n  Include staging\n  Notify ops',
      },
    })

    expect(plan.nodes[0].summary).toBe('Rotate keys')
    expect(plan.nodes[0].description).toBe(
      '  Include staging\n  Notify ops\n\nFrom Gravity room: Auth hardening',
    )
  })

  it('dedupes bullets with the same summary', () => {
    const plan = buildJiraIssuePlanFromClosing({
      topic: 'Room',
      ceremony: 'free',
      fields: {
        tasks: '- Same item\n- same   item',
      },
    })

    expect(plan.nodes).toHaveLength(1)
    expect(plan.nodes[0].summary).toBe('Same item')
  })

  it('caps the plan at 50 nodes', () => {
    const bullets = Array.from({ length: 60 }, (_, index) => `- Task ${index + 1}`)
    const plan = buildJiraIssuePlanFromClosing({
      topic: 'Large room',
      ceremony: 'free',
      fields: { tasks: bullets.join('\n') },
    })

    const countNodes = (nodes: typeof plan.nodes): number =>
      nodes.reduce((total, node) => total + 1 + countNodes(node.children), 0)

    expect(countNodes(plan.nodes)).toBe(50)
  })

  it('returns empty plan when committed, tasks and next are absent', () => {
    expect(
      buildJiraIssuePlanFromClosing({
        topic: 'Empty room',
        ceremony: 'free',
        fields: { open: 'none' },
      }),
    ).toEqual({ nodes: [] })
  })
})

describe('flattenJiraIssuePlan', () => {
  it('walks parents before children and maps all four types', () => {
    const plan = buildJiraIssuePlanFromClosing({
      topic: 'Sprint',
      ceremony: 'sprintPlanning',
      fields: {
        committed: '- S1 — Story',
        tasks: '- S1.1 — Sub',
      },
    })

    const flat = flattenJiraIssuePlan(plan, TYPE_NAMES)
    expect(flat.map(row => row.tempId)).toEqual(['n1', 'n1.1'])
    expect(flat[0]).toMatchObject({
      issueTypeName: 'Story',
      summary: 'S1 — Story',
      parentTempId: undefined,
    })
    expect(flat[1]).toMatchObject({
      issueTypeName: 'Sub-task',
      summary: 'S1.1 — Sub',
      parentTempId: 'n1',
    })

    const epicPlan = {
      nodes: [{
        tempId: 'n1',
        type: 'epic' as const,
        summary: 'Epic one',
        description: '  ',
        children: [{
          tempId: 'n1.1',
          type: 'task' as const,
          summary: 'Child task',
          description: 'Details',
          children: [],
        }],
      }],
    }
    const epicFlat = flattenJiraIssuePlan(epicPlan, TYPE_NAMES)
    expect(epicFlat[0].issueTypeName).toBe('Epic')
    expect(epicFlat[1].issueTypeName).toBe('Task')
    expect(epicFlat[0].description).toBeUndefined()
    expect(epicFlat[1].description).toBe('Details')
  })
})
