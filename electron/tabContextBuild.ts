import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { basename, extname, isAbsolute, join, relative, resolve } from 'path'
import ts from 'typescript'
import type {
  TabContext,
  TabContextAnnotation,
  TabContextDiscoveryResult,
  TabContextKind,
  TabContextPreviewResult,
  TabContextSymbolKind,
} from '../src/shared/tabContext'
import { normalizeAnnotation, normalizeContextFileName } from '../src/shared/tabContext'
import { gatherShallowFolderTree } from './agentMd'
import {
  writeAiChangelogDocument,
  formatAiChangelogDocument,
  readAiChangelog,
  resolveAiChangelogPath,
  DEFAULT_CHANGELOG_FILE,
} from './aiChangelog'

const MAX_CONTEXT_CHARS = 45_000
const MAX_FILE_CHARS = 16_000
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.txt', '.css',
  '.scss', '.html', '.py', '.go', '.rs', '.java', '.kt', '.swift', '.yaml', '.yml',
  '.toml', '.sh', '.sql', '.graphql',
])
const AUTO_START = '<!-- iaterminal:auto -->'
const AUTO_END = '<!-- /iaterminal:auto -->'
const NOTES_START = '<!-- iaterminal:notes -->'
const NOTES_END = '<!-- /iaterminal:notes -->'
const CONTEXT_META_RE = /<!--\s*iaterminal:context\s+(\{[^\n]*\})\s*-->/
const ANNOTATION_RE = /^-\s+`([^`]+)`\s+—\s+(.+)\s*$/gm
const CONTEXT_KINDS = new Set<TabContextKind>([
  'folderTree', 'files', 'symbols', 'notes', 'git', 'deps', 'readme', 'changelog',
])
const SYMBOL_KINDS = new Set<TabContextSymbolKind>(['class', 'method', 'variable'])
const SYMBOL_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go',
])
const SKIPPED_SCAN_DIRS = new Set([
  '.git', '.iaterminal', 'node_modules', 'out', 'dist', 'build', 'coverage',
  '.next', '.vite', 'vendor', '__pycache__',
])
const MAX_SYMBOL_FILES = 80
const MAX_REQUESTED_CONTEXT_SECTIONS = 8
const MAX_REQUESTED_CONTEXT_CHARS = 60_000

export interface TabContextSectionDescriptor {
  key: string
  label: string
  chars: number
}

export interface TabContextCatalogEntry {
  id: string
  name: string
  kind: TabContextKind
  file: string
  sections: TabContextSectionDescriptor[]
}

export interface TabContextSectionRequest {
  id: string
  sections?: string[]
}

export interface ExtractedContextSectionRequest {
  visibleText: string
  requests: TabContextSectionRequest[]
}

const CONTEXT_ENRICHMENT_RULES: Record<TabContextKind, string> = {
  folderTree:
    'Annotate important folders/files with purpose only. Do not invent missing paths. Max 10 words per annotation.',
  files:
    'Annotate each file with responsibility and key relationships. Max 10 words per annotation.',
  symbols:
    'Annotate classes (purpose), methods (purpose using signature/inputs/returns), and variables (role). Max 10 words. Never rewrite signatures.',
  git:
    'Annotate change groups with likely intent and risk. Never alter status/diff text. Max 10 words.',
  deps:
    'Annotate each dependency/script with project usage. Max 10 words.',
  readme:
    'Annotate outdated/missing/unclear sections. Max 10 words.',
  notes:
    'Simplify and deduplicate durable knowledge. Use keys note:<slug>. Max 10 words per entry.',
  changelog:
    'Read-only history. Never annotate or update this context.',
}

function safeRoot(cwd: string, requested?: string): string {
  const base = resolve(cwd)
  const candidate = resolve(base, requested?.trim() || '.')
  const rel = relative(base, candidate)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel)) ? candidate : base
}

function safeFile(root: string, path: string): string | null {
  const candidate = resolve(root, path)
  const rel = relative(root, candidate)
  if (rel.startsWith('..') || isAbsolute(rel)) return null
  try {
    return statSync(candidate).isFile() ? candidate : null
  } catch {
    return null
  }
}

function readTextFile(path: string): string | null {
  if (!TEXT_EXTENSIONS.has(extname(path).toLowerCase()) && extname(path)) return null
  try {
    const buffer = readFileSync(path)
    if (buffer.includes(0)) return null
    return buffer.toString('utf8', 0, MAX_FILE_CHARS)
  } catch {
    return null
  }
}

function buildFiles(context: TabContext, root: string): string {
  const sections: string[] = []
  for (const relPath of context.paths ?? []) {
    const path = safeFile(root, relPath)
    if (!path) {
      sections.push(`### ${relPath}\n(unavailable)`)
      continue
    }
    const content = readTextFile(path)
    sections.push(content == null
      ? `### ${relPath}\n(binary or unsupported file)`
      : `### ${relPath}\n\`\`\`${extname(path).slice(1)}\n${content}\n\`\`\``)
  }
  return sections.join('\n\n')
}

function compact(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function tsScriptKind(path: string): ts.ScriptKind {
  const ext = extname(path).toLowerCase()
  if (ext === '.tsx') return ts.ScriptKind.TSX
  if (ext === '.jsx') return ts.ScriptKind.JSX
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

function nodeName(node: ts.Node, sourceFile: ts.SourceFile): string {
  const named = node as ts.NamedDeclaration
  return named.name ? compact(named.name.getText(sourceFile)) : 'anonymous'
}

function signatureLines(
  path: string,
  name: string,
  owner: string | null,
  node: ts.SignatureDeclarationBase,
  sourceFile: ts.SourceFile,
  constructor = false,
): string[] {
  const inputs = node.parameters.map(param => compact(param.getText(sourceFile)))
  const returns = constructor
    ? 'instance'
    : node.type ? compact(node.type.getText(sourceFile)) : 'inferred/unspecified'
  const displayName = constructor ? 'constructor' : name
  const qualified = owner ? `${owner}.${displayName}` : displayName
  const keyKind = owner ? 'method' : 'function'
  const signature = `${displayName}(${inputs.join(', ')}): ${returns}`
  return [
    `- \`${path}#${keyKind}:${qualified}\``,
    `  - signature: \`${signature}\``,
    `  - inputs: ${inputs.length ? inputs.map(input => `\`${input}\``).join(', ') : '(none)'}`,
    `  - returns: \`${returns}\``,
  ]
}

function typescriptSymbolLines(
  source: string,
  path: string,
  kinds: TabContextSymbolKind[],
): string[] {
  const wanted = new Set(kinds.length ? kinds : ['class', 'method', 'variable'])
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, tsScriptKind(path))
  const out: string[] = []

  const visit = (node: ts.Node, owner: string | null): void => {
    let childOwner = owner
    if (
      ts.isClassDeclaration(node) || ts.isClassExpression(node) ||
      ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node)
    ) {
      const name = nodeName(node, sourceFile)
      childOwner = name
      if (wanted.has('class')) {
        const label = ts.isInterfaceDeclaration(node) ? 'interface'
          : ts.isTypeAliasDeclaration(node) ? 'type'
          : ts.isEnumDeclaration(node) ? 'enum'
          : 'class'
        out.push(`- \`${path}#class:${name}\` — ${label} \`${name}\``)
      }
    } else if (ts.isConstructorDeclaration(node) && wanted.has('method')) {
      out.push(...signatureLines(path, 'constructor', owner, node, sourceFile, true))
    } else if (
      (ts.isMethodDeclaration(node) || ts.isMethodSignature(node) ||
        ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) &&
      wanted.has('method')
    ) {
      out.push(...signatureLines(path, nodeName(node, sourceFile), owner, node, sourceFile))
    } else if (ts.isFunctionDeclaration(node) && wanted.has('method')) {
      out.push(...signatureLines(path, nodeName(node, sourceFile), null, node, sourceFile))
    } else if (ts.isVariableDeclaration(node)) {
      const name = nodeName(node, sourceFile)
      if (
        wanted.has('method') &&
        node.initializer &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
      ) {
        out.push(...signatureLines(path, name, null, node.initializer, sourceFile))
      } else if (wanted.has('variable')) {
        const type = node.type ? compact(node.type.getText(sourceFile)) : 'inferred'
        out.push(`- \`${path}#variable:${name}\` — variable \`${name}: ${type}\``)
      }
    }
    ts.forEachChild(node, child => visit(child, childOwner))
  }
  visit(sourceFile, null)
  return out.slice(0, 2_000)
}

function fallbackSymbolLines(
  source: string,
  path: string,
  kinds: TabContextSymbolKind[],
): string[] {
  const wanted = new Set(kinds.length ? kinds : ['class', 'method', 'variable'])
  const out: string[] = []
  source.split(/\r?\n/).forEach(line => {
    let match: RegExpExecArray | null
    if (wanted.has('class') && (match = /^\s*class\s+([A-Za-z_]\w*)/.exec(line))) {
      out.push(`- \`${path}#class:${match[1]}\` — class \`${match[1]}\``)
      return
    }
    if (wanted.has('method') && (match = /^\s*def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(?:->\s*([^:]+))?/.exec(line))) {
      const inputs = compact(match[2])
      const returns = compact(match[3] ?? 'inferred/unspecified')
      out.push(
        `- \`${path}#function:${match[1]}\``,
        `  - signature: \`${match[1]}(${inputs}): ${returns}\``,
        `  - inputs: ${inputs || '(none)'}`,
        `  - returns: \`${returns}\``,
      )
      return
    }
    if (wanted.has('method') && (match = /^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)\s*\(([^)]*)\)\s*([^{]*)/.exec(line))) {
      const inputs = compact(match[2])
      const returns = compact(match[3] || 'inferred/unspecified')
      out.push(
        `- \`${path}#function:${match[1]}\``,
        `  - signature: \`${match[1]}(${inputs}): ${returns}\``,
        `  - inputs: ${inputs || '(none)'}`,
        `  - returns: \`${returns}\``,
      )
    }
  })
  return out.slice(0, 2_000)
}

function discoverSymbolPaths(root: string): string[] {
  const out: string[] = []
  const walk = (directory: string): void => {
    if (out.length >= MAX_SYMBOL_FILES) return
    let entries
    try {
      entries = readdirSync(directory, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (out.length >= MAX_SYMBOL_FILES) return
      if (entry.name.startsWith('.') && entry.name !== '.') continue
      const absolute = join(directory, entry.name)
      if (entry.isDirectory()) {
        if (!SKIPPED_SCAN_DIRS.has(entry.name)) walk(absolute)
        continue
      }
      if (!entry.isFile()) continue
      if (!SYMBOL_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue
      // Evita ruido de builds/tests declarativos en el escaneo automático.
      if (/\.d\.ts$/i.test(entry.name) || /\.test\./i.test(entry.name) || /\.spec\./i.test(entry.name)) {
        continue
      }
      out.push(relative(root, absolute).split('\\').join('/'))
    }
  }
  walk(root)
  return out
}

function buildSymbols(context: TabContext, root: string): string {
  const requested = (context.paths ?? []).map(path => path.trim()).filter(Boolean)
  const paths = requested.length ? requested : discoverSymbolPaths(root)
  if (!paths.length) {
    return '(no source files found under root; set Root folder or list Files)'
  }
  const sections: string[] = []
  for (const relPath of paths) {
    const path = safeFile(root, relPath)
    const source = path ? readTextFile(path) : null
    if (!source) {
      sections.push(`### ${relPath}\n(unavailable or unsupported)`)
      continue
    }
    const displayPath = context.rootPath?.trim()
      ? `${context.rootPath.trim().replace(/\/+$/, '')}/${relPath}`.replace(/^\.\//, '')
      : relPath
    const ext = extname(relPath).toLowerCase()
    const symbols = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)
      ? typescriptSymbolLines(source, displayPath, context.symbolKinds ?? [])
      : fallbackSymbolLines(source, displayPath, context.symbolKinds ?? [])
    sections.push(`### ${displayPath}\n${symbols.length ? symbols.join('\n') : '(no matching symbols)'}`)
  }
  return sections.join('\n\n')
}

function buildGit(root: string): string {
  try {
    const status = execFileSync('git', ['status', '--short', '--branch'], {
      cwd: root, encoding: 'utf8', timeout: 5_000, maxBuffer: 1_000_000,
    }).trim()
    const stat = execFileSync('git', ['diff', '--stat', 'HEAD'], {
      cwd: root, encoding: 'utf8', timeout: 5_000, maxBuffer: 1_000_000,
    }).trim()
    return `Git status:\n${status || '(clean)'}\n\nDiff stat:\n${stat || '(no changes)'}`
  } catch {
    return '(not a git repository or git unavailable)'
  }
}

function firstExisting(root: string, names: string[]): string | null {
  for (const name of names) {
    const path = join(root, name)
    if (existsSync(path)) return path
  }
  return null
}

function contextFilePath(context: TabContext, cwd: string): string {
  const dir = join(resolve(cwd), '.iaterminal')
  return join(dir, normalizeContextFileName(context.fileName || context.name, context.id))
}

function extractSection(text: string, start: string, end: string): string {
  const startIdx = text.indexOf(start)
  const endIdx = text.indexOf(end)
  if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) return ''
  return text.slice(startIdx + start.length, endIdx).trim()
}

export function parseAnnotations(notes: string): TabContextAnnotation[] {
  const out: TabContextAnnotation[] = []
  const seen = new Set<string>()
  ANNOTATION_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = ANNOTATION_RE.exec(notes))) {
    const annotation = normalizeAnnotation({ key: match[1], text: match[2] })
    if (!annotation || seen.has(annotation.key)) continue
    seen.add(annotation.key)
    out.push(annotation)
  }
  return out
}

export function formatAnnotations(annotations: TabContextAnnotation[]): string {
  return annotations
    .map(item => `- \`${item.key}\` — ${item.text}`)
    .join('\n')
}

/** Conserva texto humano y elimina solo las líneas estructuradas de anotación. */
function notesWithoutAnnotations(notes: string): string {
  ANNOTATION_RE.lastIndex = 0
  return notes
    .replace(ANNOTATION_RE, '')
    .replace(/^## Orphaned\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function serializeContextMetadata(context: TabContext): string {
  const metadata = JSON.stringify({
    version: 1,
    id: context.id,
    name: context.name,
    fileName: normalizeContextFileName(context.fileName || context.name, context.id),
    kind: context.kind,
    ...(context.rootPath ? { rootPath: context.rootPath } : {}),
    ...(context.paths ? { paths: context.paths } : {}),
    ...(context.symbolKinds ? { symbolKinds: context.symbolKinds } : {}),
  })
    // Evita que datos proporcionados por el usuario puedan cerrar el comentario.
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
  return `<!-- iaterminal:context ${metadata} -->`
}

function composeDocument(context: TabContext, auto: string, notes: string): string {
  const prefix = [
    `# ${context.name}`,
    serializeContextMetadata(context),
    '',
    AUTO_START,
  ].join('\n')
  const notesBody = notes.trim() || '(no annotations yet)'
  const suffix = [
    AUTO_END,
    '',
    NOTES_START,
    notesBody,
    NOTES_END,
    '',
  ].join('\n')
  const sourceAuto = auto.trim() || '(empty)'
  const available = Math.max(0, MAX_CONTEXT_CHARS - prefix.length - suffix.length - 2)
  let autoBody = sourceAuto
  if (autoBody.length > available) {
    const candidate = autoBody.slice(0, available)
    const lastLineBreak = candidate.lastIndexOf('\n')
    autoBody = candidate.slice(0, lastLineBreak > 0 ? lastLineBreak : available).trimEnd()
  }
  // El límite solo recorta contenido generado. Los marcadores y las notas
  // humanas siempre se conservan, aunque unas notas enormes excedan el límite.
  return `${prefix}\n${autoBody}\n${suffix}`
}

function contextFromMetadata(raw: string, fileName: string): TabContext | null {
  const match = CONTEXT_META_RE.exec(raw)
  if (!match) return null
  try {
    const value = JSON.parse(match[1]) as Record<string, unknown>
    if (
      typeof value.id !== 'string' || !value.id.trim() ||
      typeof value.name !== 'string' || !value.name.trim() ||
      typeof value.kind !== 'string' || !CONTEXT_KINDS.has(value.kind as TabContextKind)
    ) return null
    const paths = Array.isArray(value.paths)
      ? value.paths.filter((item): item is string => typeof item === 'string').slice(0, 200)
      : undefined
    const symbolKinds = Array.isArray(value.symbolKinds)
      ? value.symbolKinds.filter((item): item is TabContextSymbolKind =>
          typeof item === 'string' && SYMBOL_KINDS.has(item as TabContextSymbolKind))
      : undefined
    return {
      id: value.id.trim().slice(0, 200),
      name: value.name.trim().slice(0, 200),
      // El archivo encontrado manda: permite renombrarlo fuera de la app.
      fileName,
      kind: value.kind as TabContextKind,
      ...(typeof value.rootPath === 'string' && value.rootPath.trim()
        ? { rootPath: value.rootPath.trim() }
        : {}),
      ...(paths ? { paths } : {}),
      ...(symbolKinds ? { symbolKinds } : {}),
    }
  } catch {
    return null
  }
}

function legacyContext(raw: string, fileName: string): TabContext {
  const title = raw.match(/^\s*#\s+(.+?)\s*$/m)?.[1]?.trim()
  return {
    id: `discovered-file:${encodeURIComponent(fileName.toLowerCase())}`,
    // Los documentos anteriores ya guardaban el nombre registrado como H1.
    name: title || basename(fileName, extname(fileName)),
    fileName,
    kind: 'notes',
  }
}

/** Descubre Markdown administrado y documentos Markdown heredados, sin escribirlos. */
export function discoverTabContexts(cwd: string): TabContextDiscoveryResult {
  try {
    const base = resolve(cwd)
    const dir = join(base, '.iaterminal')
    if (!existsSync(dir)) return { ok: true, contexts: [] }
    const contexts: TabContext[] = []
    const seenIds = new Set<string>()
    for (const entry of readdirSync(dir, { withFileTypes: true })
      .filter(item => item.isFile() && extname(item.name).toLowerCase() === '.md')
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const fileName = normalizeContextFileName(entry.name)
      const raw = readFileSync(join(dir, entry.name), 'utf8')
      const fromMeta = contextFromMetadata(raw, fileName)
      const context: TabContext = fromMeta?.kind === 'changelog'
        ? fromMeta
        : entry.name.toLowerCase() === DEFAULT_CHANGELOG_FILE && !fromMeta
          ? {
              id: 'iaterminal:changelog',
              name: raw.match(/^\s*#\s+(.+?)\s*$/m)?.[1]?.trim() || 'AI Changelog',
              fileName: DEFAULT_CHANGELOG_FILE,
              kind: 'changelog',
            }
          : fromMeta ?? legacyContext(raw, fileName)
      if (seenIds.has(context.id)) continue
      seenIds.add(context.id)
      contexts.push(context)
    }
    return { ok: true, contexts }
  } catch (error) {
    return {
      ok: false,
      contexts: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Elimina el Markdown materializado; el catálogo se refresca desde disco. */
export function deleteTabContext(
  context: TabContext,
  cwd: string,
): { ok: boolean; error?: string } {
  try {
    const filePath = contextFilePath(context, cwd)
    if (existsSync(filePath)) unlinkSync(filePath)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function readExistingNotes(filePath: string): string {
  if (!existsSync(filePath)) return ''
  const raw = readFileSync(filePath, 'utf8')
  const notes = extractSection(raw, NOTES_START, NOTES_END)
  if (notes && notes !== '(no annotations yet)') {
    const previousAuto = extractSection(raw, AUTO_START, AUTO_END)
    // Migra documentos creados por la versión que copiaba accidentalmente
    // toda la capa automática dentro de notes.
    if (previousAuto && notes.trim() === previousAuto.trim()) return ''
    return notes
  }
  // Compat: archivos antiguos sin marcadores se tratan como notas si no hay auto.
  if (!raw.includes(AUTO_START) && !raw.includes(NOTES_START)) return raw.trim()
  return ''
}

/** Mueve anotaciones huérfanas (clave ya no en auto) a ## Orphaned; no las borra. */
export function reconcileNotesWithAuto(auto: string, notes: string): string {
  const annotations = parseAnnotations(notes)
  if (!annotations.length) {
    const trimmed = notes.trim()
    return !trimmed || trimmed === '(no annotations yet)' ? '' : notes
  }
  const humanNotes = notesWithoutAnnotations(notes)
  const keysInAuto = new Set<string>()
  for (const match of auto.matchAll(/`([^`\n]+)`/g)) keysInAuto.add(match[1])
  const active: TabContextAnnotation[] = []
  const orphaned: TabContextAnnotation[] = []
  for (const annotation of annotations) {
    if (keysInAuto.has(annotation.key) || annotation.key.startsWith('note:')) {
      active.push(annotation)
    } else {
      orphaned.push(annotation)
    }
  }
  const parts: string[] = []
  if (humanNotes) parts.push(humanNotes)
  if (active.length) parts.push(formatAnnotations(active))
  if (orphaned.length) {
    parts.push('## Orphaned')
    parts.push(formatAnnotations(orphaned))
  }
  return parts.join('\n\n')
}

function buildAutoContent(
  context: TabContext,
  cwd: string,
  options: { content?: string },
  filePath: string,
): string {
  const root = safeRoot(cwd, context.rootPath)
  switch (context.kind) {
    case 'folderTree':
      return gatherShallowFolderTree(root)
    case 'files':
      return buildFiles(context, root)
    case 'symbols':
      return buildSymbols(context, root)
    case 'notes':
      if (typeof options.content === 'string') return options.content
      return readExistingNotes(filePath) || '(empty notes)'
    case 'git':
      return buildGit(root)
    case 'deps': {
      const path = firstExisting(root, [
        'package.json', 'pyproject.toml', 'requirements.txt', 'Cargo.toml',
        'go.mod', 'pom.xml', 'build.gradle',
      ])
      return path ? readTextFile(path) ?? '(unsupported manifest)' : '(no dependency manifest found)'
    }
    case 'readme': {
      const path = firstExisting(root, ['README.md', 'README', 'readme.md'])
      return path ? readTextFile(path) ?? '(could not read README)' : '(README not found)'
    }
    case 'changelog':
      return readTextFile(filePath) ?? '(empty changelog)'
  }
}

export function materializeTabContext(
  context: TabContext,
  cwd: string,
  options: { content?: string; write?: boolean } = {},
): TabContextPreviewResult {
  try {
    if (context.kind === 'changelog') {
      const normalized: TabContext = {
        ...context,
        name: context.name.trim() || 'AI Changelog',
        fileName: normalizeContextFileName(
          context.fileName || context.name || DEFAULT_CHANGELOG_FILE,
          'changelog',
        ),
        id: context.id || 'iaterminal:changelog',
      }
      const filePath = contextFilePath(normalized, cwd)
      const metadataLine = serializeContextMetadata(normalized)
      const previousFilePath = resolveAiChangelogPath(cwd)
      const existingEntries = existsSync(previousFilePath) ? readAiChangelog(cwd) : []
      if (options.write) {
        // Escribe primero el nuevo destino preservando el historial. Solo
        // después elimina el nombre anterior para que un fallo no pierda datos.
        writeAiChangelogDocument(cwd, {
          name: normalized.name,
          fileName: normalized.fileName,
          metadataLine,
          entries: existingEntries,
        })
        const dir = join(resolve(cwd), '.iaterminal')
        if (existsSync(dir)) {
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (!entry.isFile() || extname(entry.name).toLowerCase() !== '.md') continue
            const absolute = join(dir, entry.name)
            if (absolute === filePath) continue
            try {
              const raw = readFileSync(absolute, 'utf8')
              const meta = contextFromMetadata(raw, entry.name)
              if (meta?.kind === 'changelog' || entry.name.toLowerCase() === DEFAULT_CHANGELOG_FILE) {
                unlinkSync(absolute)
              }
            } catch { /* ignore */ }
          }
        }
      } else if (!existsSync(filePath)) {
        return {
          ok: true,
          content: formatAiChangelogDocument({
            name: normalized.name,
            metadataLine,
            entries: existingEntries,
          }),
          notesContent: '',
          filePath,
        }
      }
      return {
        ok: true,
        content: readFileSync(filePath, 'utf8'),
        notesContent: '',
        filePath,
      }
    }
    const filePath = contextFilePath(context, cwd)
    const existingNotes = readExistingNotes(filePath)
    const auto = buildAutoContent(context, cwd, options, filePath)
    let notes: string
    if (context.kind === 'notes') {
      notes = typeof options.content === 'string' ? options.content : (existingNotes || '')
    } else if (context.kind === 'symbols' || context.kind === 'files') {
      notes = reconcileNotesWithAuto(auto, existingNotes)
    } else {
      notes = existingNotes
    }
    const content = composeDocument(
      context,
      context.kind === 'notes' ? '(manual notes context)' : auto,
      notes,
    )
    if (options.write) {
      mkdirSync(join(resolve(cwd), '.iaterminal'), { recursive: true })
      writeFileSync(filePath, content, 'utf8')
    }
    return {
      ok: true,
      content,
      notesContent: notes,
      filePath,
    }
  } catch (error) {
    return { ok: false, content: '', error: error instanceof Error ? error.message : String(error) }
  }
}

export function mergeAnnotations(
  context: TabContext,
  cwd: string,
  annotations: TabContextAnnotation[],
): TabContextPreviewResult {
  try {
    if (context.kind === 'changelog') {
      return { ok: false, content: '', error: 'AI Changelog is read-only.' }
    }
    const filePath = contextFilePath(context, cwd)
    const current = materializeTabContext(context, cwd, { write: false })
    if (!current.ok) return current
    const existing = parseAnnotations(current.notesContent ?? '')
    const byKey = new Map(existing.map(item => [item.key, item]))
    for (const annotation of annotations) {
      const normalized = normalizeAnnotation(annotation)
      if (normalized) byKey.set(normalized.key, normalized)
    }
    const humanNotes = notesWithoutAnnotations(current.notesContent ?? '')
    const structuredNotes = formatAnnotations([...byKey.values()])
    const notes = [humanNotes, structuredNotes].filter(Boolean).join('\n\n')
    const auto = extractSection(current.content, AUTO_START, AUTO_END) || '(empty)'
    const content = composeDocument(context, auto, notes)
    mkdirSync(join(resolve(cwd), '.iaterminal'), { recursive: true })
    writeFileSync(filePath, content, 'utf8')
    return { ok: true, content, notesContent: notes, filePath }
  } catch (error) {
    return { ok: false, content: '', error: error instanceof Error ? error.message : String(error) }
  }
}

export function enrichmentRuleFor(kind: TabContextKind): string {
  return CONTEXT_ENRICHMENT_RULES[kind]
}

interface MaterializedContextSection extends TabContextSectionDescriptor {
  content: string
}

function markdownSections(body: string): MaterializedContextSection[] {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const headings: Array<{ index: number; level: number; key: string; label: string }> = []
  let inFence = false
  for (let index = 0; index < lines.length; index++) {
    if (/^\s*```/.test(lines[index])) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const match = lines[index].match(/^(#{2,3})\s+(.+?)\s*$/)
    if (!match) continue
    const label = match[2].trim()
    headings.push({ index, level: match[1].length, key: label, label })
  }
  if (!headings.length) {
    const content = body.trim()
    return content ? [{ key: 'all', label: 'Contenido', chars: content.length, content }] : []
  }
  return headings.map((heading, position) => {
    let end = lines.length
    for (let next = position + 1; next < headings.length; next++) {
      if (headings[next].level <= heading.level) {
        end = headings[next].index
        break
      }
    }
    const content = lines.slice(heading.index, end).join('\n').trim()
    return { key: heading.key, label: heading.label, chars: content.length, content }
  })
}

function folderTreeSections(body: string): MaterializedContextSection[] {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const starts: Array<{ index: number; key: string; label: string }> = []
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (!line.trim() || /^\s/.test(line)) continue
    const label = line.trim()
    const key = label.replace(/\s+\(.*\)$/, '').replace(/\/$/, '')
    starts.push({ index, key: key || 'root', label })
  }
  return starts.map((start, position) => {
    const end = starts[position + 1]?.index ?? lines.length
    const content = lines.slice(start.index, end).join('\n').trim()
    return { key: start.key, label: start.label, chars: content.length, content }
  })
}

function dependencySections(body: string): MaterializedContextSection[] {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>
    return Object.entries(parsed).map(([key, value]) => {
      const content = JSON.stringify({ [key]: value }, null, 2)
      return { key, label: key, chars: content.length, content }
    })
  } catch {
    return markdownSections(body)
  }
}

function gitSections(body: string): MaterializedContextSection[] {
  const marker = '\n\nDiff stat:\n'
  const split = body.indexOf(marker)
  if (split < 0) return markdownSections(body)
  const status = body.slice(0, split).trim()
  const diff = `Diff stat:\n${body.slice(split + marker.length)}`
  return [
    { key: 'status', label: 'Git status', chars: status.length, content: status },
    { key: 'diff-stat', label: 'Diff stat', chars: diff.length, content: diff },
  ]
}

function sectionsForContext(
  context: TabContext,
  materialized: TabContextPreviewResult,
): MaterializedContextSection[] {
  if (!materialized.ok) {
    const content = `(error: ${materialized.error ?? 'could not materialize context'})`
    return [{ key: 'error', label: 'Error', chars: content.length, content }]
  }
  const auto = extractSection(materialized.content, AUTO_START, AUTO_END)
  const body = context.kind === 'changelog'
    ? materialized.content
    : context.kind === 'notes'
      ? materialized.notesContent ?? ''
      : auto || materialized.content
  let sections: MaterializedContextSection[]
  if (context.kind === 'folderTree') sections = folderTreeSections(body)
  else if (context.kind === 'deps') sections = dependencySections(body)
  else if (context.kind === 'git') sections = gitSections(body)
  else sections = markdownSections(body)

  if (context.kind !== 'notes' && context.kind !== 'changelog') {
    const notes = extractSection(materialized.content, NOTES_START, NOTES_END)
    if (notes && notes !== '(no annotations yet)') {
      sections.push({ key: '__notes', label: 'Notas y anotaciones', chars: notes.length, content: notes })
    }
  }
  return sections
}

function materializedContextSections(
  contexts: TabContext[],
  cwd: string,
): Map<string, { context: TabContext; sections: MaterializedContextSection[] }> {
  const out = new Map<string, { context: TabContext; sections: MaterializedContextSection[] }>()
  for (const context of contexts) {
    const materialized = materializeTabContext(context, cwd, { write: true })
    out.set(context.id, { context, sections: sectionsForContext(context, materialized) })
  }
  return out
}

/** Catálogo ligero de contextos activados; no incluye cuerpos de secciones. */
export function buildContextSectionCatalog(
  contexts: TabContext[],
  cwd: string,
): TabContextCatalogEntry[] {
  return [...materializedContextSections(contexts, cwd).values()].map(({ context, sections }) => ({
    id: context.id,
    name: context.name,
    kind: context.kind,
    file: `.iaterminal/${normalizeContextFileName(context.fileName || context.name, context.id)}`,
    sections: sections.map(({ key, label, chars }) => ({ key, label, chars })),
  }))
}

/** Prompt inicial: catálogo JSON y contrato para pedir únicamente secciones necesarias. */
export function buildContextCatalogPrompt(
  contexts: TabContext[],
  cwd: string,
  options: { allowAnnotationUpdates?: boolean } = {},
): string {
  if (!contexts.length) return ''
  const catalog = buildContextSectionCatalog(contexts, cwd)
  const lines = [
    '## Available tab contexts (on demand)',
    'The JSON catalog below lists the contexts enabled by the user and their available sections.',
    'Context bodies are not attached yet. Request only the sections needed to answer the user.',
    'If no context is needed, answer directly without emitting a request.',
    'To request context, reply with only this machine-readable block:',
    '```ia-terminal-need-sections',
    '{"requests":[{"id":"context-id","sections":["section-key"]}]}',
    '```',
    `Limits: at most ${MAX_REQUESTED_CONTEXT_SECTIONS} sections per request. You may request context at most twice.`,
    'Use section keys exactly as provided. Omitting "sections" requests the whole context, subject to size limits.',
    '',
    '```json',
    JSON.stringify({ contexts: catalog }, null, 2),
    '```',
  ]
  const writableContexts = contexts.filter(context => context.kind !== 'changelog')
  if (options.allowAnnotationUpdates && writableContexts.length) {
    lines.push(
      '',
      '## Context maintenance',
      'After completing the user request, update ONLY durable facts that changed during this interaction.',
      'Do not emit a context update when nothing changed. Annotation upserts only; max 10 words each.',
      'Never delete human notes or modify the `iaterminal:auto` section.',
      'Allowed contexts:',
      ...writableContexts.map(context =>
        `- ${context.id}: ${context.name} (${context.kind}) — ${enrichmentRuleFor(context.kind)}`),
      'Format exactly:',
      '```ia-terminal-context',
      '{"id":"context-id","kind":"symbols","annotations":[{"key":"path#class:Name","text":"short purpose"}]}',
      '```',
    )
  }
  return lines.join('\n')
}

const NEED_SECTIONS_RE = /```ia-terminal-need-sections\s*\n([\s\S]*?)\n```/g

/** Extrae y elimina solicitudes internas de secciones de una respuesta del agente. */
export function extractContextSectionRequest(raw: string): ExtractedContextSectionRequest {
  const requests: TabContextSectionRequest[] = []
  const visibleText = raw.replace(NEED_SECTIONS_RE, (_block, json: string) => {
    try {
      const value = JSON.parse(json) as { requests?: unknown }
      if (!Array.isArray(value.requests)) return ''
      for (const item of value.requests) {
        if (requests.length >= MAX_REQUESTED_CONTEXT_SECTIONS * 2) break
        if (!item || typeof item !== 'object') continue
        const candidate = item as Record<string, unknown>
        if (typeof candidate.id !== 'string' || !candidate.id.trim()) continue
        const sections = Array.isArray(candidate.sections)
          ? candidate.sections.filter((section): section is string =>
              typeof section === 'string' && Boolean(section.trim()))
          : undefined
        requests.push({
          id: candidate.id.trim(),
          ...(sections
            ? {
                sections: sections
                  .slice(0, MAX_REQUESTED_CONTEXT_SECTIONS)
                  .map(section => section.trim()),
              }
            : {}),
        })
      }
    } catch { /* malformed request is ignored */ }
    return ''
  }).trim()
  return { visibleText, requests }
}

/** Valida la solicitud y construye un payload acotado para reanudar el agente. */
export function buildRequestedContextSections(
  contexts: TabContext[],
  cwd: string,
  requests: TabContextSectionRequest[],
): { prompt: string; sectionCount: number } {
  const available = materializedContextSections(contexts, cwd)
  const selected: string[] = []
  const errors: string[] = []
  let sectionCount = 0
  let totalChars = 0

  outer: for (const request of requests.slice(0, MAX_REQUESTED_CONTEXT_SECTIONS * 2)) {
    const found = available.get(request.id)
    if (!found) {
      errors.push(`- Unknown or disabled context id: ${request.id}`)
      continue
    }
    const wanted = request.sections?.length
      ? request.sections
      : found.sections.map(section => section.key)
    for (const key of wanted) {
      if (sectionCount >= MAX_REQUESTED_CONTEXT_SECTIONS) break outer
      const section = found.sections.find(candidate => candidate.key === key)
      if (!section) {
        errors.push(`- Unknown section "${key}" in context "${request.id}"`)
        continue
      }
      const remaining = MAX_REQUESTED_CONTEXT_CHARS - totalChars
      if (remaining <= 0) break outer
      const content = section.content.slice(0, remaining)
      selected.push([
        `### ${found.context.name} [${found.context.kind}] / ${section.label}`,
        `context-id: ${found.context.id}`,
        `section-key: ${section.key}`,
        '',
        content,
        content.length < section.content.length ? '\n[section truncated by context budget]' : '',
      ].join('\n'))
      totalChars += content.length
      sectionCount++
    }
  }

  const prompt = [
    '## Requested context sections',
    'Continue the original user request using the authoritative sections below.',
    'Do not repeat the internal context request block in your user-facing answer.',
    '',
    ...selected,
    ...(errors.length ? ['', '## Context request errors', ...errors] : []),
  ].join('\n')
  return { prompt, sectionCount }
}

export function buildAssignedContexts(
  contexts: TabContext[],
  cwd: string,
  options: { allowAnnotationUpdates?: boolean } = {},
): string {
  if (!contexts.length) return ''
  const sections = contexts.map(context => {
    const result = materializeTabContext(context, cwd, { write: true })
    const body = result.ok ? result.content : `(error: ${result.error})`
    const relFile = `.iaterminal/${normalizeContextFileName(context.fileName || context.name, context.id)}`
    return `### ${context.name} [${context.kind}]\nid: ${context.id}\nfile: ${relFile}\n\n${body}`
  })
  let out = '## Assigned tab contexts (authoritative)\n'
  out += 'The host app attached the following contexts for this turn. '
  out += 'Treat them as source of truth. When the user asks if you can see a context, '
  out += 'confirm it by name and summarize what it contains.\n\n'
  out += sections.join('\n\n')
  const writableContexts = contexts.filter(context => context.kind !== 'changelog')
  if (!options.allowAnnotationUpdates || !writableContexts.length) return out

  out += '\n\n## Context maintenance\n'
  out += 'After completing the user request, update ONLY durable facts that changed during this interaction. '
  out += 'Do not summarize or rewrite unchanged context. Do not emit a block when nothing changed. '
  out += 'The host compares the workspace before and after the turn and rejects annotations without evidence '
  out += 'in the actual changed files; use the exact auto-generated file/path key.\n'
  out += 'Updates are annotation upserts only (max 10 words each). Existing annotations and human notes '
  out += 'must never be deleted. Never emit "body" or "paths". Never rewrite, quote, or modify the '
  out += '`iaterminal:auto` section; it is owned exclusively by deterministic host generation.\n'
  out += 'Allowed contexts:\n'
  out += writableContexts.map(context =>
    `- ${context.id}: ${context.name} (${context.kind}) — ${enrichmentRuleFor(context.kind)}`,
  ).join('\n')
  out += '\nFormat exactly:\n```ia-terminal-context\n'
  out += '{"id":"context-id","kind":"symbols","annotations":[{"key":"path#class:Name","text":"short purpose"}]}\n```\n'
  return out
}
