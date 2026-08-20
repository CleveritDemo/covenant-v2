import type { ContextTransferTarget } from '@shared/contextTransfer'
import type { TabContext, TabContextPreviewResult } from '@shared/tabContext'

export type ContextTransferMaterializeRequest = {
  context: TabContext
  cwd: string
  content?: string
}

export type ContextTransferApi = {
  previewTabContext: (request: {
    context: TabContext
    cwd: string
  }) => Promise<TabContextPreviewResult>
  materializeTabContext: (request: ContextTransferMaterializeRequest) => Promise<{ ok: boolean }>
}

/** Copia un contexto del cwd origen al destino vía preview + materialize. */
export async function executeContextTransfer(params: {
  context: TabContext
  sourceCwd: string
  target: ContextTransferTarget
  api: ContextTransferApi
  refreshTabContexts: (tabId: string) => Promise<void>
}): Promise<void> {
  const { context, sourceCwd, target, api, refreshTabContexts } = params

  const preview = await api.previewTabContext({ context, cwd: sourceCwd })
  if (!preview.ok) return

  const body = context.kind === 'skill'
    ? preview.notesContent
    : (context.kind === 'notes' ? preview.notesContent : undefined)

  const result = await api.materializeTabContext({
    context,
    cwd: target.cwd,
    ...(body != null ? { content: body } : {}),
  })
  if (!result.ok) return

  await refreshTabContexts(target.tabId)
}
