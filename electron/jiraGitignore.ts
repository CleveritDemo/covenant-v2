/**
 * Gobernanza del dato: los `.md` de las issues caen dentro del repo del
 * usuario, así que descripciones y comentarios de Jira acabarían commiteados
 * por el primer `git add .` que pase.
 *
 * Decisión: ignorar por defecto al conectar. Quien quiera compartir los
 * snapshots con su equipo borra la línea — es una línea, en su repo, visible
 * en el diff del propio connect. Lo contrario (compartir por defecto) filtra
 * datos que nadie eligió publicar y no se puede deshacer con un `git rm`.
 *
 * Alcance deliberadamente mínimo: se AÑADE una línea al final, nunca se
 * reescribe el `.gitignore` existente, y no se crea uno donde el proyecto no
 * tiene repo git (ahí no hay nada de lo que protegerse y el archivo sería
 * basura ajena). Nada fuera del proyecto se toca.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { projectDirName } from './projectDir'

export type JiraGitignoreOutcome =
  /** Se añadió la línea al `.gitignore` del proyecto. */
  | 'appended'
  /** Ya estaba ignorado (por la línea exacta o por la carpeta del proyecto entera). */
  | 'already-ignored'
  /** Sin `.gitignore` y sin repo git, o el archivo no se pudo leer/escribir. */
  | 'skipped'

/**
 * ¿Alguna línea ya cubre los snapshots? Cuentan tanto `<dir>/jira` como el
 * `<dir>` entero: si el proyecto ignora `.gravity/` completo, añadir una
 * segunda regla más específica sería ruido sin efecto.
 *
 * Se normalizan las barras de inicio y fin porque `.gravity/jira/`,
 * `/.gravity/jira` y `.gravity/jira` son la misma regla para git. Las líneas
 * de comentario y las negaciones (`!`) no cuentan como cobertura.
 */
function alreadyIgnores(content: string, dirName: string): boolean {
  const targets = new Set([`${dirName}/jira`, dirName])
  return content.split(/\r?\n/).some(line => {
    const entry = line.trim()
    if (!entry || entry.startsWith('#') || entry.startsWith('!')) return false
    return targets.has(entry.replace(/^\/+/, '').replace(/\/+$/, ''))
  })
}

/**
 * Asegura que `<projectDir>/jira/` esté ignorado. Nunca lanza: esto corre
 * dentro de `connectJira`, y un `.gitignore` de solo lectura no puede tumbar
 * una conexión que ya se probó contra Jira.
 */
export function ensureJiraGitignore(cwd: string): JiraGitignoreOutcome {
  const root = (cwd ?? '').trim()
  if (!root) return 'skipped'
  try {
    const projectRoot = resolve(root)
    const dirName = projectDirName(projectRoot)
    const gitignorePath = join(projectRoot, '.gitignore')
    const rule = `${dirName}/jira/`

    if (!existsSync(gitignorePath)) {
      // Sin `.gitignore` y sin `.git`: no es un repo, no hay commit accidental
      // que evitar, y dejar un archivo nuevo en una carpeta que no versiona
      // nadie es ensuciar el proyecto de otro.
      if (!existsSync(join(projectRoot, '.git'))) return 'skipped'
      writeFileSync(
        gitignorePath,
        `# Snapshots de issues de Jira: descripciones y comentarios del ticket.\n${rule}\n`,
        'utf8',
      )
      return 'appended'
    }

    const content = readFileSync(gitignorePath, 'utf8')
    if (alreadyIgnores(content, dirName)) return 'already-ignored'
    // `\n` de guarda solo si hace falta: un `.gitignore` que ya termina en
    // salto no gana una línea en blanco por pasar por aquí.
    const separator = !content || content.endsWith('\n') ? '' : '\n'
    writeFileSync(
      gitignorePath,
      `${content}${separator}\n# Snapshots de issues de Jira: descripciones y comentarios del ticket.\n${rule}\n`,
      'utf8',
    )
    return 'appended'
  } catch {
    return 'skipped'
  }
}
