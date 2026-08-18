import { planContextsFromFiles } from '@shared/contextFromFile'
import type { TabContext } from '@shared/tabContext'

export type AddFileContextsResult =
  | { ok: true; created: TabContext[]; skipped: Array<{ path: string; contextId: string }> }
  | { ok: false; cancelled: true }
  | {
    ok: false
    cancelled?: false
    error: 'too-large' | 'no-cwd' | 'failed'
    message?: string
  }

export async function addFileContextsFromPicker({
  cwd,
  contexts,
  pickTitle,
}: {
  cwd: string
  contexts: TabContext[]
  pickTitle: string
}): Promise<AddFileContextsResult> {
  const workingCwd = cwd.trim()
  if (!workingCwd) {
    return { ok: false, error: 'no-cwd' }
  }

  try {
    const result = await window.api.selectProjectFiles({
      cwd: workingCwd,
      title: pickTitle,
      importOutside: true,
    })
    if (!result.ok) {
      if (result.cancelled) return { ok: false, cancelled: true }
      if (result.error === 'file too large') {
        return { ok: false, error: 'too-large' }
      }
      return { ok: false, error: 'failed', message: result.error }
    }

    const plan = planContextsFromFiles(result.paths, contexts)
    for (const context of plan.created) {
      const materialized = await window.api.materializeTabContext({
        context,
        cwd: workingCwd,
      })
      if (!materialized.ok) {
        return { ok: false, error: 'failed', message: materialized.error }
      }
    }

    return { ok: true, created: plan.created, skipped: plan.skipped }
  } catch (error) {
    return {
      ok: false,
      error: 'failed',
      message: error instanceof Error ? error.message : undefined,
    }
  }
}
