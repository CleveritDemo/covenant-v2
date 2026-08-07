import { mkdirSync, writeFileSync } from 'fs'
import { statSync } from 'fs'
import { join, normalize, resolve } from 'path'

/** Extrae el último cwd reportado por OSC 7 (`file://…`) en un chunk de salida del PTY. */
export function extractOsc7CwdFromChunk(chunk: string): string | null {
  const re = /\x1b\]7;file:(?:\/\/[^/]*)?([^\x07\x1b]*)/g
  let last: string | null = null
  let match: RegExpExecArray | null
  while ((match = re.exec(chunk)) !== null) {
    const raw = match[1]
    if (!raw) continue
    try {
      const decoded = decodeURIComponent(raw)
      if (decoded) last = normalize(decoded)
    } catch {
      if (raw) last = normalize(raw)
    }
  }
  return last
}

export function isExistingDirectory(dir: string): boolean {
  try {
    return statSync(dir).isDirectory()
  } catch {
    return false
  }
}

/**
 * Resuelve el destino de un `cd` y comprueba que exista en disco.
 * Prueba cwd actual y, para rutas relativas, también bajo $HOME.
 */
export function resolveCdTarget(cwd: string, argRaw: string, home: string): string | null {
  let arg = argRaw.trim()
  if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
    arg = arg.slice(1, -1).trim()
  }
  if (arg === '~') arg = home
  else if (arg.startsWith('~/')) arg = resolve(home, arg.slice(2))
  if (arg === '-' || arg === '--') return null

  const candidates: string[] = []
  if (arg.startsWith('/')) {
    candidates.push(normalize(arg))
  } else {
    candidates.push(normalize(resolve(cwd, arg)))
    const homeNorm = normalize(home)
    const cwdNorm = normalize(cwd)
    if (cwdNorm !== homeNorm) {
      candidates.push(normalize(resolve(homeNorm, arg)))
    }
  }

  for (const p of candidates) {
    if (isExistingDirectory(p)) return p
  }
  return null
}

/**
 * Enriquece el entorno del PTY para que el shell reporte el cwd via OSC 7 sin escribir
 * ningún comando al PTY (evita el echo visible en la terminal).
 *
 * - zsh:  usa `ZDOTDIR` apuntando a un directorio temporal que contiene un `.zshenv`
 *         que instala el hook `precmd` y luego restaura el `ZDOTDIR` original para que
 *         `.zshrc`, `.zprofile` etc. se lean desde `$HOME` normalmente.
 * - bash: inyecta `PROMPT_COMMAND` directamente en el entorno.
 */
export function patchEnvForCwdReporting(
  env: Record<string, string>,
  shellPath: string,
  hooksDir: string,
): Record<string, string> {
  const base = shellPath.split(/[/\\]/).pop()?.toLowerCase() ?? ''

  if (base.includes('zsh')) {
    const zshDir = join(hooksDir, 'zsh-hooks')
    mkdirSync(zshDir, { recursive: true })

    // El .zshenv temporal:
    // 1. Restaura ZDOTDIR al original (HOME si no había), para que zsh lea
    //    .zprofile / .zshrc / .zlogin del directorio correcto del usuario.
    // 2. Fuente el .zshenv real del usuario si existe.
    // 3. Instala el hook precmd que emite OSC 7 antes de cada prompt.
    const zshenv = [
      '# Covenant Gravity – OSC 7 cwd hook (auto-generado)',
      'export ZDOTDIR="${_AI_TERM_ZDOTDIR:-$HOME}"',
      'unset _AI_TERM_ZDOTDIR',
      '[[ -f "$ZDOTDIR/.zshenv" ]] && builtin source "$ZDOTDIR/.zshenv"',
      'autoload -Uz add-zsh-hook 2>/dev/null',
      '__ai_term_cwd() { printf "\\033]7;file://%s\\033\\\\" "${PWD}"; }',
      'add-zsh-hook precmd __ai_term_cwd 2>/dev/null',
    ].join('\n') + '\n'

    writeFileSync(join(zshDir, '.zshenv'), zshenv, 'utf-8')

    return {
      ...env,
      _AI_TERM_ZDOTDIR: env.ZDOTDIR ?? env.HOME ?? '',
      ZDOTDIR: zshDir,
    }
  }

  if (base.includes('bash')) {
    const existingPrompt = env.PROMPT_COMMAND?.trim() ?? ''
    const oscCmd = 'printf "\\033]7;file://%s\\033\\\\" "$PWD"'
    return {
      ...env,
      PROMPT_COMMAND: existingPrompt ? `${oscCmd}; ${existingPrompt}` : oscCmd,
    }
  }

  return env
}
