/**
 * Orquestador puro: publicar un workspace local en una org.
 * Orden inviolable: create → repos → upload → wiki.
 * No importa download/pull: un pull contra el workspace recién creado borraría wiki y agentes locales.
 */

export type PromoteRepoInput = { repoFullName: string; cloneUrl: string; folderName?: string }
export type PromotePhase = 'create' | 'repos' | 'upload' | 'wiki'
export type PromoteLocalWorkspaceParams = {
  orgSlug: string
  workspaceName: string
  cwd: string
  repos: readonly PromoteRepoInput[]
}
export type PromoteLocalWorkspaceDeps = {
  createWorkspace(
    orgSlug: string,
    name: string,
  ): Promise<{ ok: true; workspaceId: string } | { ok: false; error: string }>
  addRepo(
    orgSlug: string,
    workspaceId: string,
    repo: PromoteRepoInput & { position: number },
  ): Promise<{ ok: boolean; error?: string }>
  upload(
    orgSlug: string,
    workspaceId: string,
    cwd: string,
  ): Promise<{ ok: boolean; error?: string; cancelled?: boolean }>
  pushWiki(
    orgSlug: string,
    workspaceId: string,
    cwd: string,
  ): Promise<{ ok: boolean; error?: string }>
  onPhase?(phase: PromotePhase): void
  shouldCancel?(): boolean
}
export type PromoteLocalWorkspaceResult =
  | { ok: true; workspaceId: string; reposAdded: number; reposFailed: string[] }
  | { ok: false; stage: PromotePhase; error: string; workspaceId?: string; cancelled?: boolean }

function lastPathSegment(path: string): string {
  const trimmed = path.trim().replace(/[/\\]+$/, '')
  if (!trimmed) return ''
  const parts = trimmed.split(/[/\\]+/).filter(Boolean)
  return parts[parts.length - 1] ?? ''
}

export function defaultPromotedWorkspaceName(folderPath: string): string {
  return lastPathSegment(folderPath)
}

export function promoteReposFromDetected(
  detected: readonly { name: string; path: string; remoteUrl: string; repoFullName: string }[],
): PromoteRepoInput[] {
  const out: PromoteRepoInput[] = []
  for (const row of detected) {
    const repoFullName = row.repoFullName.trim()
    const remoteUrl = row.remoteUrl.trim()
    if (!repoFullName || !remoteUrl) continue
    out.push({
      repoFullName,
      cloneUrl: remoteUrl,
      folderName: lastPathSegment(row.path),
    })
  }
  return out
}

function cancelled(
  stage: PromotePhase,
  workspaceId?: string,
): PromoteLocalWorkspaceResult {
  return {
    ok: false,
    stage,
    error: 'cancelled',
    cancelled: true,
    ...(workspaceId ? { workspaceId } : {}),
  }
}

export async function promoteLocalWorkspaceToOrg(
  params: PromoteLocalWorkspaceParams,
  deps: PromoteLocalWorkspaceDeps,
): Promise<PromoteLocalWorkspaceResult> {
  const orgSlug = params.orgSlug.trim()
  const workspaceName = params.workspaceName.trim()
  const cwd = params.cwd.trim()
  if (!orgSlug) return { ok: false, stage: 'create', error: 'missing orgSlug' }
  if (!workspaceName) return { ok: false, stage: 'create', error: 'missing workspaceName' }
  if (!cwd) return { ok: false, stage: 'create', error: 'missing cwd' }

  if (deps.shouldCancel?.()) return cancelled('create')

  deps.onPhase?.('create')
  const created = await deps.createWorkspace(orgSlug, workspaceName)
  if (!created.ok) return { ok: false, stage: 'create', error: created.error }
  const workspaceId = created.workspaceId

  if (deps.shouldCancel?.()) return cancelled('repos', workspaceId)
  deps.onPhase?.('repos')
  const reposFailed: string[] = []
  let reposAdded = 0
  for (let i = 0; i < params.repos.length; i++) {
    if (deps.shouldCancel?.()) return cancelled('repos', workspaceId)
    const repo = params.repos[i]!
    if (!repo.repoFullName.trim() || !repo.cloneUrl.trim()) {
      reposFailed.push(repo.repoFullName)
      continue
    }
    const added = await deps.addRepo(orgSlug, workspaceId, { ...repo, position: i })
    if (!added.ok) {
      reposFailed.push(repo.repoFullName)
      continue
    }
    reposAdded++
  }

  if (deps.shouldCancel?.()) return cancelled('upload', workspaceId)
  deps.onPhase?.('upload')
  const uploaded = await deps.upload(orgSlug, workspaceId, cwd)
  if (uploaded.cancelled) {
    return { ok: false, stage: 'upload', error: 'cancelled', cancelled: true, workspaceId }
  }
  if (!uploaded.ok) {
    return { ok: false, stage: 'upload', error: uploaded.error ?? '', workspaceId }
  }

  if (deps.shouldCancel?.()) return cancelled('wiki', workspaceId)
  deps.onPhase?.('wiki')
  const wiki = await deps.pushWiki(orgSlug, workspaceId, cwd)
  if (!wiki.ok) {
    return { ok: false, stage: 'wiki', error: wiki.error ?? '', workspaceId }
  }

  return { ok: true, workspaceId, reposAdded, reposFailed }
}
