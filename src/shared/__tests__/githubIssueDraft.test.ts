import { describe, expect, it } from 'vitest'
import type { GithubIssueRef } from '../githubIssue'
import { githubIssueDraftFromRef } from '../githubIssueDraft'

const issue: GithubIssueRef = {
  number: 86,
  title: 'Fix picker',
  state: 'open',
  repoFullName: 'CleveritDemo/covenant-v2',
  updated: '2026-08-18T00:00:00.000Z',
  author: 'gigi',
  labels: ['bug'],
}

describe('githubIssueDraftFromRef', () => {
  it('deriva id, archivo y nombre del número y el repo', () => {
    expect(githubIssueDraftFromRef(issue)).toEqual({
      id: 'iaterminal:githubissue:cleveritdemo-covenant-v2-86',
      name: 'CleveritDemo/covenant-v2#86',
      fileName: 'github/CleveritDemo-covenant-v2-86.md',
      kind: 'githubIssue',
      issueNumber: 86,
      repoFullName: 'CleveritDemo/covenant-v2',
    })
  })

  it('sin número o sin repo no hay contexto que refrescar', () => {
    expect(githubIssueDraftFromRef({ ...issue, number: 0 })).toBeNull()
    expect(githubIssueDraftFromRef({ ...issue, repoFullName: '' })).toBeNull()
    expect(githubIssueDraftFromRef({ ...issue, repoFullName: '   ' })).toBeNull()
  })
})
