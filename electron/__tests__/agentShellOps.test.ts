import { afterAll, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { runAgentShellCommand } from '../agentShellOps'

describe('runAgentShellCommand destructive guard', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-shell-'))

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('blocks destructive commands without confirmation', async () => {
    const r = await runAgentShellCommand(root, 'rm -rf /tmp/foo')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/destructive/i)
  })

  it('allows destructive commands when confirmed', async () => {
    const r = await runAgentShellCommand(root, 'rm -rf ./nonexistent-agent-test-dir', {
      destructiveConfirmed: true,
    })
    expect(r.ok).toBe(true)
  })

  it('allows non-destructive commands without confirmation flag', async () => {
    const r = await runAgentShellCommand(root, 'echo hello')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.stdout).toMatch(/hello/)
  })
})
