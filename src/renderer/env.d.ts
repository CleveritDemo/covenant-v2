/// <reference types="vite/client" />

import type { API } from '../../electron/preload'
import type { CovenantApi } from './covenantApi'

export type GithubAccountRef = { id: string; label: string }

/** Contrato del llavero GitHub (main lo publica en paralelo). */
export type GithubAccountsApi = {
  githubAccountsList(): Promise<
    { ok: true; accounts: GithubAccountRef[]; defaultAccountId: string } | { ok: false; error: string }
  >
  githubAccountUpsert(payload: { id?: string; label: string; token?: string }): Promise<
    { ok: true; account?: GithubAccountRef } | { ok: false; error: string }
  >
  githubAccountDelete(id: string): Promise<{ ok: true } | { ok: false; error: string }>
  githubAccountSetDefault(id: string): Promise<{ ok: true } | { ok: false; error: string }>
  githubWorkspaceAccountGet(cwd: string): Promise<
    { ok: true; accountId: string | null } | { ok: false; error: string }
  >
  githubWorkspaceAccountSet(
    cwd: string,
    accountId: string | null,
  ): Promise<{ ok: true } | { ok: false; error: string }>
}

declare global {
  interface Window {
    api: API & GithubAccountsApi & { covenant?: CovenantApi }
  }
}

/**
 * La Popover API es HTML estándar y Chromium la soporta desde la 114 (Electron 33
 * trae la 130), pero los tipos de React 18 aún no la incluyen.
 */
declare module 'react' {
  interface HTMLAttributes<T> {
    popover?: 'auto' | 'manual'
  }
  interface ButtonHTMLAttributes<T> extends HTMLAttributes<T> {
    // En minúscula: React 18 sólo pasa al DOM los atributos desconocidos si lo son
    // (en camelCase los descarta con un warning y el popover nunca se abre).
    popovertarget?: string
    popovertargetaction?: 'toggle' | 'show' | 'hide'
  }
}

export {}
