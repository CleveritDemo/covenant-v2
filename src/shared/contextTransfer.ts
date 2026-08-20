import { type TabContextKind } from './tabContext'

export interface ContextTransferTarget {
  tabId: string
  title: string
  cwd: string
}

/** Pestañas abiertas con carpeta de proyecto que pueden recibir un contexto copiado. */
export function buildContextTransferTargets(
  tabs: ReadonlyArray<{ id: string; title: string; projectFolder?: string }>,
  currentCwd: string,
): ContextTransferTarget[] {
  const current = currentCwd.trim()
  const seen = new Set<string>()
  const targets: ContextTransferTarget[] = []

  for (const tab of tabs) {
    const cwd = tab.projectFolder?.trim() ?? ''
    if (!cwd) continue
    if (current && cwd === current) continue
    if (seen.has(cwd)) continue
    seen.add(cwd)
    targets.push({ tabId: tab.id, title: tab.title, cwd })
  }

  return targets
}

/** agentResult es la bitácora de un agente de ESE workspace; no viaja a otro. */
export function canTransferContextKind(kind: TabContextKind): boolean {
  return kind !== 'agentResult'
}
