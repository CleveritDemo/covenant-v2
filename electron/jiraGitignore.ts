/**
 * Gobernanza del dato: los `.md` de las issues caen dentro del repo del
 * usuario, así que descripciones y comentarios acabarían commiteados por el
 * primer `git add .` que pase.
 *
 * Decisión: ignorar por defecto. Quien quiera compartir los snapshots con su
 * equipo borra la línea — es una línea, en su repo, visible en el diff.
 * Lo contrario (compartir por defecto) filtra datos que nadie eligió publicar
 * y no se puede deshacer con un `git rm`.
 *
 * Parametrizado por subdir (`jira` | `github`): el monorepo no duplica el
 * helper; cada kind ignora su carpeta.
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

export type IssueSnapshotSubdir = 'jira' | 'github'

function snapshotComment(subdir: IssueSnapshotSubdir): string {
  return subdir === 'github'
    ? '# Snapshots de issues de GitHub: descripciones y comentarios del ticket.'
    : '# Snapshots de issues de Jira: descripciones y comentarios del ticket.'
}

function alreadyIgnores(content: string, dirName: string, subdir: IssueSnapshotSubdir): boolean {
  const targets = new Set([`${dirName}/${subdir}`, dirName])
  return content.split(/\r?\n/).some(line => {
    const entry = line.trim()
    if (!entry || entry.startsWith('#') || entry.startsWith('!')) return false
    return targets.has(entry.replace(/^\/+/, '').replace(/\/+$/, ''))
  })
}

/**
 * Asegura que `<projectDir>/<subdir>/` esté ignorado. Nunca lanza.
 */
export function ensureIssueSnapshotsGitignore(
  cwd: string,
  subdir: IssueSnapshotSubdir,
): JiraGitignoreOutcome {
  const root = (cwd ?? '').trim()
  if (!root) return 'skipped'
  try {
    const projectRoot = resolve(root)
    const dirName = projectDirName(projectRoot)
    const gitignorePath = join(projectRoot, '.gitignore')
    const rule = `${dirName}/${subdir}/`

    if (!existsSync(gitignorePath)) {
      if (!existsSync(join(projectRoot, '.git'))) return 'skipped'
      writeFileSync(
        gitignorePath,
        `${snapshotComment(subdir)}\n${rule}\n`,
        'utf8',
      )
      return 'appended'
    }

    const content = readFileSync(gitignorePath, 'utf8')
    if (alreadyIgnores(content, dirName, subdir)) return 'already-ignored'
    const separator = !content || content.endsWith('\n') ? '' : '\n'
    writeFileSync(
      gitignorePath,
      `${content}${separator}\n${snapshotComment(subdir)}\n${rule}\n`,
      'utf8',
    )
    return 'appended'
  } catch {
    return 'skipped'
  }
}

export function ensureJiraGitignore(cwd: string): JiraGitignoreOutcome {
  return ensureIssueSnapshotsGitignore(cwd, 'jira')
}
