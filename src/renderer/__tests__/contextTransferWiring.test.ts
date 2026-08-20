import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContextTransferTarget } from '@shared/contextTransfer'
import type { TabContext } from '@shared/tabContext'
import { executeContextTransfer } from '../contextTransferWiring'

const previewTabContext = vi.fn()
const materializeTabContext = vi.fn()
const refreshTabContexts = vi.fn()

const target: ContextTransferTarget = {
  tabId: 'tab-dest',
  title: 'Other workspace',
  cwd: '/dest/project',
}

beforeEach(() => {
  previewTabContext.mockReset()
  materializeTabContext.mockReset()
  refreshTabContexts.mockReset().mockResolvedValue(undefined)
})

describe('executeContextTransfer', () => {
  it('materializa notes con notesContent como content en el cwd destino', async () => {
    const context: TabContext = {
      id: 'iaterminal:notes:rules',
      name: 'Rules',
      fileName: 'context/rules.md',
      kind: 'notes',
    }
    previewTabContext.mockResolvedValue({
      ok: true,
      content: 'ignored host body',
      notesContent: '## Durable rules',
    })
    materializeTabContext.mockResolvedValue({ ok: true })

    await executeContextTransfer({
      context,
      sourceCwd: '/src/project',
      target,
      api: { previewTabContext, materializeTabContext },
      refreshTabContexts,
    })

    expect(previewTabContext).toHaveBeenCalledWith({ context, cwd: '/src/project' })
    expect(materializeTabContext).toHaveBeenCalledWith({
      context,
      cwd: '/dest/project',
      content: '## Durable rules',
    })
    expect(refreshTabContexts).toHaveBeenCalledWith('tab-dest')
  })

  it('materializa files sin campo content', async () => {
    const context: TabContext = {
      id: 'iaterminal:files:Front-folders',
      name: 'Front folders',
      fileName: 'context/Front-folders.md',
      kind: 'files',
      paths: ['src/App.tsx'],
    }
    previewTabContext.mockResolvedValue({
      ok: true,
      content: '# generated listing',
      notesContent: 'side notes',
    })
    materializeTabContext.mockResolvedValue({ ok: true })

    await executeContextTransfer({
      context,
      sourceCwd: '/src/project',
      target,
      api: { previewTabContext, materializeTabContext },
      refreshTabContexts,
    })

    expect(materializeTabContext).toHaveBeenCalledWith({
      context,
      cwd: '/dest/project',
    })
    expect(materializeTabContext.mock.calls[0][0]).not.toHaveProperty('content')
    expect(refreshTabContexts).toHaveBeenCalledWith('tab-dest')
  })
})
