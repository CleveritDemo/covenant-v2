/**
 * Comprueba si el CLI de un proveedor existe en el PATH y con qué versión.
 * Permite avisar en Ajustes antes de asignar el agente, en vez de fallar al lanzarlo.
 */
import type { AppConfig } from '../src/shared/configSchema'
import {
  agentCliCommand,
  type AgentCliProvider,
  type AgentCliResolution,
} from '../src/shared/agentCliProviders'
import { runCliCapture } from './agentCliModelsList'
import { resolveCommandAbsolutePath } from './shellPathEnv'

// ponytail: un CLI que no contesta en 3s se da por «sin versión» y sigue contando como
// disponible. Subirlo sólo alarga el tiempo muerto al abrir Ajustes (gemini, p. ej., cuelga).
const VERSION_TIMEOUT_MS = 3_000

/** Cache por ruta absoluta: el binario no cambia mientras la app vive. */
const versionCache = new Map<string, string | null>()

/** Primer número con pinta de versión en la salida de `--version`. */
export function parseCliVersion(stdout: string): string | null {
  const match = stdout.match(/\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?/)
  return match ? match[0] : null
}

async function readVersion(path: string): Promise<string | null> {
  const cached = versionCache.get(path)
  if (cached !== undefined) return cached

  // Que el CLI no responda a --version no lo hace inválido: sólo deja la versión vacía.
  const { stdout, stderr } = await runCliCapture(path, ['--version'], VERSION_TIMEOUT_MS)
  const version = parseCliVersion(stdout) ?? parseCliVersion(stderr)
  versionCache.set(path, version)
  return version
}

export async function resolveAgentCli(
  provider: AgentCliProvider,
  command: string | undefined,
  config: Pick<AppConfig, 'agentCliCommands'>,
): Promise<AgentCliResolution> {
  const effective = command?.trim() || agentCliCommand(config.agentCliCommands, provider)
  // El PATH se re-consulta siempre (sólo son stats): instalar un CLI con la app
  // abierta tiene que notarse sin reiniciar.
  const path = resolveCommandAbsolutePath(effective)
  return {
    provider,
    command: effective,
    path,
    version: path ? await readVersion(path) : null,
  }
}

/** Sólo para tests. */
export function clearAgentCliVersionCache(): void {
  versionCache.clear()
}
