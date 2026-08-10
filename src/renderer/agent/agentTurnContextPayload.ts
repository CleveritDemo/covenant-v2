import type { TabContext } from '@shared/tabContext'
import { contextContentsForNotes } from '@shared/orgWorkspaceContent'

/**
 * Campos de turno CLI: projectCwd + contextContents de notes (caché API / memoria).
 * Org: el body no se materializa a disco; el runtime usa contextContents.
 */
export function buildAgentTurnContextPayload(
  projectCwd: string,
  assigned: readonly TabContext[],
): {
  projectCwd?: string
  contextContents?: Record<string, string>
} {
  const cwd = projectCwd.trim()
  const notesContents = contextContentsForNotes(assigned)
  return {
    ...(cwd ? { projectCwd: cwd } : {}),
    ...(Object.keys(notesContents).length > 0 ? { contextContents: notesContents } : {}),
  }
}
