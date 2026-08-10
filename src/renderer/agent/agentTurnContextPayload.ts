import type { TabContext } from '@shared/tabContext'
import { contextContentsForNotes } from '@shared/orgWorkspaceContent'

/**
 * Campos de turno CLI para contextos: projectCwd (`.gravity`) + bodies org notes.
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
