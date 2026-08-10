/** Tipos del IPC de clonado de workspaces org (renderer ↔ preload). */

import type { OrgWorkspaceCloneFailure } from './orgWorkspaceCloneError'

export type { OrgWorkspaceCloneFailure, OrgWorkspaceCloneErrorKind } from './orgWorkspaceCloneError'

export type OrgWorkspaceCloneRepo = {
  repoFullName: string
  cloneUrl: string
  /** Carpeta destino opcional; si falta, se usa el último segmento de repoFullName. */
  folderName?: string
}

export type OrgWorkspaceCloneRequest = {
  orgSlug: string
  workspaceSlug: string
  repos: Array<OrgWorkspaceCloneRepo>
  /** Destino final opcional (p. ej. carpeta elegida en el picker). */
  workspaceDir?: string
}

export type OrgWorkspaceCloneResult =
  | { ok: true; workspaceDir: string; cloned: string[]; skipped: string[] }
  | { ok: false; error: string; workspaceDir?: string; failure?: OrgWorkspaceCloneFailure }
