/** Tipos del IPC de clonado de workspaces org (renderer ↔ preload). */

export type OrgWorkspaceCloneRepo = {
  repoFullName: string
  cloneUrl: string
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
  | { ok: false; error: string; workspaceDir?: string }
