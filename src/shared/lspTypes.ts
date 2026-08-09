/**
 * Tipos compartidos main ↔ renderer para el motor LSP.
 *
 * El renderer nunca construye rutas absolutas: pide `lspStart(sessionId, relPath)`
 * y el main resuelve el path real dentro de la raíz de la sesión. Los URIs que
 * viajan de vuelta son absolutos porque el protocolo LSP los exige, pero el
 * renderer los trata como opacos y cualquier lectura/escritura vuelve al main
 * validada contra la raíz del workspace que el propio main calculó.
 */

/** Sugerencia accionable cuando falta el runtime (node / dotnet / java). */
export type LspRuntimeSuggestion =
  | { kind: 'onDiskNotOnPath'; version: string; dir: string }
  | { kind: 'install'; hint: string }

export interface LspRuntimeMissing {
  name: string
  min: string
  /** `null` = no se encontró el binario; string = se encontró pero es viejo. */
  found: string | null
  suggestion: LspRuntimeSuggestion | null
}

export interface LspServerStatus {
  language: string
  name: string
  version: string
  installed: boolean
  approxSizeMb: number
  /** Sólo para servers que declaran `runtime` en el manifiesto y no lo tienen. */
  runtimeMissing: LspRuntimeMissing | null
}

export interface LspInstalledServer {
  language: string
  name: string
  version: string
  sizeBytes: number
  installed: boolean
}

export interface LspStartResult {
  serverId: number
  /** Raíz del workspace detectada por el main (marcadores → .git → dir padre). */
  root: string
  /** Path absoluto del archivo pedido, ya validado contra la raíz de la sesión. */
  filePath: string
  /** Raíz del explorador de la sesión, para mapear absoluto → relativo al abrir. */
  sessionRoot: string
  language: string
  /**
   * `.sln`/`.slnx` (o `.csproj`) bajo `root`, para el handshake post-initialize
   * que Roslyn necesita. `null` para todo lo que no sea csharp.
   */
  solutionPath: string | null
  /** `'solution'` para `.sln`/`.slnx`, `'project'` para un `.csproj` pelado. */
  solutionKind: 'solution' | 'project' | null
}

/** Progreso de descarga binaria (`received`/`total`) o de `npm install` (`message`). */
export type LspDownloadProgress =
  | { received: number; total: number | null }
  | { message: string }

export interface LspFileReadResult {
  ok: boolean
  content?: string
  error?: string
}

export interface LspFileWriteResult {
  ok: boolean
  error?: string
}

export type LspStartFailure = { ok: false; error: string }
export type LspStartOk = { ok: true } & LspStartResult
export type LspStartResponse = LspStartOk | LspStartFailure
