import type { ProjectAiContextForAi } from '@shared/projectAiContext'
import type { AgentShellPolicy } from '@shared/configSchema'
import { buildRichContext, type MentionedFile } from './contextBuilder'

export type { MentionedFile }
import { GIT_MAX_COMMIT_MESSAGE_CHARS } from '@shared/gitSessionTypes'
import {
  GIT_BLOCK_END,
  GIT_BLOCK_START,
  GLOB_BLOCK_END,
  GLOB_BLOCK_START,
  GREP_BLOCK_END,
  GREP_BLOCK_START,
  LIST_BLOCK_END,
  LIST_BLOCK_START,
  PATCH_BLOCK_END,
  READ_BLOCK_END,
  READ_BLOCK_START,
  RUN_BLOCK_END,
  RUN_BLOCK_START,
} from '@shared/agentFileProtocol'

export type { ChatMessage } from './types'
import type { ChatMessage } from './types'

export interface OllamaOptions {
  baseURL: string
  model: string
  onToken?: (text: string) => void
  /** Recibe los tokens de razonamiento interno (solo cuando think: true y el modelo los emite). */
  onThinkingToken?: (text: string) => void
  signal?: AbortSignal
  /** Activa thinking en modelos compatibles (qwen3, deepseek-r1, etc.). */
  think?: boolean
}

export async function chatOllama(
  messages: ChatMessage[],
  options: OllamaOptions
): Promise<string> {
  const base = options.baseURL.replace(/\/$/, '')
  const url = `${base}/api/chat`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model,
      messages,
      stream: true,
      ...(options.think ? { think: true } : {}),
    }),
    signal: options.signal,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ollama ${res.status}: ${text}`)
  }

  if (!res.body) throw new Error('No body in Ollama response')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  /** Acumula chunks hasta líneas NDJSON completas (evita perder tokens al partir JSON entre lecturas). */
  let lineBuffer = ''

  /**
   * Algunos modelos (qwen3, deepseek-r1 en ciertas versiones de Ollama) no usan
   * `message.thinking` sino que emiten los tokens de razonamiento dentro de
   * `message.content` envueltos en `<think>…</think>`. Este flag rastrea si
   * estamos dentro de ese bloque para rutear los tokens correctamente.
   */
  let insideThinkTag = false
  /**
   * Buffer parcial para detectar los marcadores `<think>` y `</think>` que
   * pueden llegar partidos entre varios tokens del stream.
   */
  let thinkTagBuf = ''

  function routeToken(token: string): void {
    let remaining = thinkTagBuf + token
    thinkTagBuf = ''

    while (remaining.length > 0) {
      if (insideThinkTag) {
        const closeIdx = remaining.indexOf('</think>')
        if (closeIdx === -1) {
          // Puede que el cierre llegue partido; guardamos el sufijo sospechoso
          const suspectLen = '</think>'.length - 1
          const safe = remaining.slice(0, Math.max(0, remaining.length - suspectLen))
          const suspect = remaining.slice(safe.length)
          if (safe) options.onThinkingToken?.(safe)
          thinkTagBuf = suspect
          return
        }
        const thinkContent = remaining.slice(0, closeIdx)
        if (thinkContent) options.onThinkingToken?.(thinkContent)
        insideThinkTag = false
        remaining = remaining.slice(closeIdx + '</think>'.length)
      } else {
        const openIdx = remaining.indexOf('<think>')
        if (openIdx === -1) {
          const suspectLen = '<think>'.length - 1
          const safe = remaining.slice(0, Math.max(0, remaining.length - suspectLen))
          const suspect = remaining.slice(safe.length)
          if (safe) { full += safe; options.onToken?.(safe) }
          thinkTagBuf = suspect
          return
        }
        const before = remaining.slice(0, openIdx)
        if (before) { full += before; options.onToken?.(before) }
        insideThinkTag = true
        remaining = remaining.slice(openIdx + '<think>'.length)
      }
    }
  }

  function consumeJsonLine(line: string): void {
    const t = line.trim()
    if (!t) return
    try {
      const json = JSON.parse(t) as { message?: { content?: string; thinking?: string } }
      // Thinking nativo de Ollama (modelos con soporte formal de think)
      const thinkToken: string = json?.message?.thinking ?? ''
      if (thinkToken) {
        options.onThinkingToken?.(thinkToken)
      }
      const token: string = json?.message?.content ?? ''
      if (token) {
        if (options.onThinkingToken) {
          // Filtrar posibles <think>…</think> embebidos en el contenido
          routeToken(token)
        } else {
          full += token
          options.onToken?.(token)
        }
      }
    } catch {
      // línea corrupta o JSON aún incompleto (no debería ocurrir tras partición correcta)
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (value) {
      lineBuffer += decoder.decode(value, { stream: !done })
    }
    if (done) {
      lineBuffer += decoder.decode()
      break
    }
    const lines = lineBuffer.split('\n')
    lineBuffer = lines.pop() ?? ''
    for (const line of lines) {
      consumeJsonLine(line)
    }
  }

  const tailLines = lineBuffer.split('\n')
  for (const line of tailLines) {
    consumeJsonLine(line)
  }

  // Vaciar lo que quedó pendiente en el buffer de detección de <think>
  if (thinkTagBuf) {
    if (insideThinkTag) {
      options.onThinkingToken?.(thinkTagBuf)
    } else {
      full += thinkTagBuf
      options.onToken?.(thinkTagBuf)
    }
  }

  return full
}

const MAX_AGENT_MD_IN_SYSTEM = 22_000
const MAX_BOOTSTRAP_TREE = 200_000
const MAX_BOOTSTRAP_LISTING = 8_000

function agentModeShellSuffix(shellPolicy: AgentShellPolicy): string {
  if (shellPolicy === 'off') {
    return (
      '\n\n**Shell:** command execution policy is **off** (no RUN blocks will be executed). ' +
      'Do not use RUN blocks; tell the user what to run manually if needed.\n'
    )
  }
  const confirmHint =
    shellPolicy === 'ask'
      ? ' Each line runs **only** after explicit user confirmation.'
      : ' Current policy runs **without** extra confirmation; avoid destructive or ambiguous commands.'
  return (
    '\n\n**Command execution** — if you need to run shell in the session cwd, at the **end** of your message you may use one or more blocks:\n' +
    `${RUN_BLOCK_START}\n` +
    'npm -s test\n' +
    `${RUN_BLOCK_END}\n` +
    '(one shell command per line inside the block; no markdown ``` fences).' +
    confirmHint +
    ' You will receive stdout/stderr and exit code on the next automatic turn.\n'
  )
}

function agentModeSystemSuffix(shellPolicy: AgentShellPolicy): string {
  return (
    '\n\n--- AGENT MODE ENABLED ---\n' +
    'You have real tools to read and write files and run shell commands under this session cwd.\n\n' +

    '**Scope (read this first):**\n' +
    '- Act ONLY on what the user asks in their **latest** message. Do not fix unrelated files.\n' +
    '- If the user asks a question (what/how/why) or wants an explanation, reply in text only — **no WRITE blocks**.\n' +
    '- If the user asks to change README.md, write **only** README.md — do not touch source files (e.g. ollamaClient.ts) unless they name them.\n' +
    '- Errors in terminal output or older turns are context only; do not repair them unless the user explicitly asks in this message.\n' +
    '- Never put internal reasoning ("let me look at line 396…") inside a WRITE block. WRITE content must be the full valid file only.\n\n' +

    '**Explore before you act** — find files yourself from the user\'s latest message:\n' +
    '1. Folder tree = map. 2. LIST/GLOB/GREP to locate files. 3. READ (or READ lines). 4. PATCH or WRITE.\n' +
    'Derive search terms from the request (symbols, errors, paths mentioned). Never guess file contents.\n\n' +

    `**List directory** — ${LIST_BLOCK_START}\nsrc/ai\nsrc/renderer\n${LIST_BLOCK_END}\n` +
    `**Find files by name** — ${GLOB_BLOCK_START}\n**/*Panel*.tsx\n*.md\n${GLOB_BLOCK_END}\n` +
    `**Search in file contents** — ${GREP_BLOCK_START}\npattern :: optional/scope\n${GREP_BLOCK_END}\n` +
    `**Git** — ${GIT_BLOCK_START}\nstatus\n${GIT_BLOCK_END} or diff / diff-staged then optional paths per line\n` +

    '**Read files** — at END of message before edits. Full file or line range:\n' +
    `${READ_BLOCK_START}\npath/to/file.ts\npath/to/big.ts:10-80\n${READ_BLOCK_END}\n` +

    '**Patch (preferred for edits)** — exact search/replace; read the file first:\n' +
    '<<<AI_TERMINAL_PATCH path="path/to/file.ts">>>\n' +
    '<<<< SEARCH\nold lines\n====\nnew lines\n>>>> REPLACE\n' +
    `${PATCH_BLOCK_END}\n` +

    '⚠️  CRITICAL — Full-file replace: when (and only when) the user explicitly asks to create or modify a named file, ' +
    'use the WRITE block below. ' +
    'Showing code in a markdown ``` fence does NOT write to disk. ' +
    'If you must change a file, the WRITE block is mandatory.\n\n' +

    '**Write / create files** — for each file use this exact block:\n' +
    '<<<AI_TERMINAL_WRITE path="relative/path/file.ext">>>\n' +
    'full file contents here\n' +
    '<<<END_AI_TERMINAL_WRITE>>>\n' +
    'Repeat the block for each distinct file. Paths are relative to cwd; never absolute or with `..`.\n' +
    'Never use folder `ia-terminal` (no dot); project fixed context lives under `.ai-terminal/` (with dot).\n\n' +

    'Example — if the user asks to create `src/utils/helper.ts`:\n' +
    '<<<AI_TERMINAL_WRITE path="src/utils/helper.ts">>>\n' +
    'export function helper(): boolean {\n' +
    '  return true\n' +
    '}\n' +
    '<<<END_AI_TERMINAL_WRITE>>>\n\n' +

    'Prefer PATCH over WRITE for small edits. WRITE only for new files or full rewrites.\n' +
    agentModeShellSuffix(shellPolicy)
  )
}

/** Si el modelo devolvió todo el documento dentro de un fence, lo quita. */
export function stripOuterMarkdownFence(raw: string): string {
  const s = raw.trim()
  if (!s.startsWith('```')) return s
  const firstNl = s.indexOf('\n')
  if (firstNl === -1) return s
  const closing = s.lastIndexOf('\n```')
  if (closing <= firstNl) return s
  return s.slice(firstNl + 1, closing).trim()
}

/** Máximo de palabras por línea de resumen en el log de interacciones (prompt + recorte). */
export const INTERACTION_LOG_SUMMARY_MAX_WORDS = 15

const MAX_USER_CHARS_FOR_LOG_SUMMARY = 2_500
const MAX_ASSISTANT_CHARS_FOR_LOG_SUMMARY = 8_000

function stripThinkingTagsForSummary(s: string): string {
  return s.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
}

function clampWords(line: string, maxWords: number): string {
  const words = line.replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return words.join(' ')
  return words.slice(0, maxWords).join(' ')
}

/**
 * Resumen de una interacción vía Ollama (una línea, inglés, ≤ {@link INTERACTION_LOG_SUMMARY_MAX_WORDS} palabras).
 */
export async function summarizeInteractionForLog(
  userMessage: string,
  assistantMessage: string,
  options: Pick<OllamaOptions, 'baseURL' | 'model'> & { signal?: AbortSignal; think?: boolean },
): Promise<string> {
  const u = userMessage.replace(/\s+/g, ' ').trim().slice(0, MAX_USER_CHARS_FOR_LOG_SUMMARY)
  const a = stripThinkingTagsForSummary(assistantMessage)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_ASSISTANT_CHARS_FOR_LOG_SUMMARY)

  const system =
    'You write one-line summaries for a developer-assistant interaction log.\n' +
    'Reply with ONE line only, in English, maximum ' +
    String(INTERACTION_LOG_SUMMARY_MAX_WORDS) +
    ' words total (count carefully).\n' +
    'No leading bullet characters, no quotes, no markdown fences, no line breaks — plain text only.\n' +
    'Capture what the user wanted and what the assistant did in a single short phrase.'

  const user = `USER MESSAGE:\n${u}\n\nASSISTANT MESSAGE:\n${a}`

  const raw = await chatOllama(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    {
      baseURL: options.baseURL,
      model: options.model,
      signal: options.signal,
      think: options.think ?? false,
    },
  )

  let line = stripOuterMarkdownFence(raw).replace(/\s+/g, ' ').trim()
  const firstLine = line.split('\n')[0] ?? ''
  line = firstLine.replace(/^[-*•]\s*/, '').trim()
  line = clampWords(line, INTERACTION_LOG_SUMMARY_MAX_WORDS)
  if (!line) line = 'interaction'
  return `- ${line}`
}

export function fallbackInteractionLogLine(userMessage: string, assistantMessage: string): string {
  const u = userMessage.replace(/\s+/g, ' ').trim().slice(0, 100)
  const a = stripThinkingTagsForSummary(assistantMessage).replace(/\s+/g, ' ').trim().slice(0, 100)
  const combined = `${u} → ${a}`.trim()
  return `- ${clampWords(combined, INTERACTION_LOG_SUMMARY_MAX_WORDS)}`
}

/**
 * Produce una línea para el log de interacciones: intenta resumen con IA; si falla, recorte local.
 */
export async function makeInteractionLogEntry(
  userMessage: string,
  assistantMessage: string,
  options: Pick<OllamaOptions, 'baseURL' | 'model'> & { signal?: AbortSignal; think?: boolean },
): Promise<string> {
  try {
    return await summarizeInteractionForLog(userMessage, assistantMessage, options)
  } catch {
    return fallbackInteractionLogLine(userMessage, assistantMessage)
  }
}

/** Sentinel: el modelo indica que agent.md no necesita cambios. */
export const NO_AGENT_MD_UPDATE = 'NO_AGENT_MD_UPDATE'

const MAX_EXISTING_AGENT_IN_REFRESH = 22_000
const MAX_LAST_USER_IN_REFRESH = 4_000
const MAX_LAST_ASSISTANT_IN_REFRESH = 12_000

/**
 * Tras un turno de chat: decide si hay que reescribir `.ai-terminal/agent.md` y con qué contenido.
 */
export function buildAgentMdRefreshMessages(
  existingAgentMd: string | null,
  folderTree: string,
  terminalContext: string,
  workspace: ProjectAiContextForAi | null,
  lastUserMessage: string,
  lastAssistantMessage: string,
): ChatMessage[] {
  const cwd = workspace?.cwd ?? '(unknown)'
  const listing = workspace?.listing?.trim() ?? ''
  const pkg = workspace?.packageJson?.trim() ?? ''
  const term = terminalContext.trim().slice(-4000)
  const existing = (existingAgentMd ?? '').trim().slice(0, MAX_EXISTING_AGENT_IN_REFRESH)
  const userSlice = lastUserMessage.replace(/\s+/g, ' ').trim().slice(0, MAX_LAST_USER_IN_REFRESH)
  let assist = stripThinkingTagsForSummary(lastAssistantMessage).slice(0, MAX_LAST_ASSISTANT_IN_REFRESH)

  const system =
    'You maintain `.ai-terminal/agent.md` for a software repository.\n\n' +
    'After one user/assistant turn, decide whether the project STRUCTURE (folders, notable files) or ' +
    'FUNCTIONALITY (what the app does, stack, main workflows, key commands) changed in a way that ' +
    'the existing agent.md should be rewritten.\n\n' +
    'Use: the fresh repository tree, root listing, package.json, terminal snippet, the current agent.md (may be empty), ' +
    'and the last user + assistant messages.\n\n' +
    'If NOTHING meaningful changed for future AI context, reply with EXACTLY one line and nothing else:\n' +
    `${NO_AGENT_MD_UPDATE}\n\n` +
    'If something meaningful changed (or agent.md was empty/incomplete and the snapshot is clearly better), ' +
    'reply with the COMPLETE NEW Markdown body for agent.md that replaces the file. Same format rules as initial creation:\n' +
    '- English only.\n' +
    '- Exactly these headings in order: `## Project description`, `## Folder structure`, `## Commands to run the project`.\n' +
    '- Do not wrap the entire document in ``` fences.\n' +
    '- Be concrete; reflect the new tree and any hints from the conversation.\n'

  let user = `Working directory (cwd): ${cwd}\n\n`
  user += 'Fresh repository tree:\n'
  user += `${folderTree.slice(0, MAX_BOOTSTRAP_TREE)}\n\n`
  if (listing) {
    user += `Root listing:\n${listing.slice(0, MAX_BOOTSTRAP_LISTING)}\n\n`
  }
  if (pkg) user += `package.json:\n${pkg.slice(0, 14_000)}\n\n`
  if (term) user += `Recent terminal output:\n${term}\n\n`
  user += 'Current `.ai-terminal/agent.md` content (may be empty):\n'
  user += `${existing || '(empty)\n'}\n\n`
  user += 'Last user message:\n'
  user += `${userSlice}\n\n`
  user += 'Last assistant message:\n'
  user += `${assist}\n`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user.trimEnd() },
  ]
}

/** Si el modelo respondió sin actualizar, devuelve `null`; si no, el cuerpo Markdown completo. */
export function parseAgentMdRefreshResponse(raw: string): string | null {
  const t = stripOuterMarkdownFence(raw).trim()
  if (!t) return null
  if (/^NO_AGENT_MD_UPDATE\s*$/i.test(t)) return null
  return t
}

/**
 * Primera petición: genera el cuerpo de `.ai-terminal/agent.md` (sin persistencia aquí).
 */
export function buildAgentMdBootstrapMessages(
  folderTree: string,
  terminalContext: string,
  workspace: ProjectAiContextForAi | null,
): ChatMessage[] {
  const cwd = workspace?.cwd ?? '(unknown)'
  const listing = workspace?.listing?.trim() ?? ''
  const pkg = workspace?.packageJson?.trim() ?? ''
  const term = terminalContext.trim().slice(-6000)

  const system =
    'You are an expert full-stack software developer (frontend and backend, APIs, databases, build tooling, and everyday DevOps). ' +
    'Write the Markdown file `.ai-terminal/agent.md` that will serve as fixed project context for future AI-assisted development in this workspace.\n\n' +
    'Strict rules:\n' +
    '- Reply ONLY with the Markdown body, no text before or after.\n' +
    '- Do not wrap the whole document in ``` fences of any kind.\n' +
    '- Language: English for the entire document (all headings, prose, and bullet text).\n' +
    '- Use exactly these level-2 headings in this order: `## Project description`, `## Folder structure`, `## Commands to run the project`.\n' +
    '- Project description: 4–10 sentences; app type, main stack (e.g. Electron, Vite), key parts and purpose. Do not be generic if the tree and package.json give concrete signals.\n' +
    '- Folder structure — this is the most important section; it must be **substantial and thorough** relative to the source tree you receive below:\n' +
    '  - Reproduce the hierarchy with **nested Markdown lists** (`-` and indentation), folder within folder, following the **entire** tree as far as the listing goes; if the listing was truncated with “…”, say so at the end of the section.\n' +
    '  - For **each folder** (each directory node), always include a line or sub-item describing what it contains or its responsibility (1–2 concrete sentences per folder, not filler).\n' +
    '  - You may cite paths in Markdown backticks (e.g. `src/renderer/`).\n' +
    '  - Include **relevant files** where helpful (main entries, configs, IPC); you do not need every file if there are many identical ones; prioritize navigational ones.\n' +
    '  - Avoid flat four-bullet summaries at the root; the section must show **real depth** (subfolders and sub-subfolders) like the source tree.\n' +
    '- Commands to run the project: concrete shell commands (install deps, dev, tests, packaging); if something is a guess, end with one line `*(Assumptions: …)*`.\n'

  let user = `Working directory (cwd): ${cwd}\n\n`
  user +=
    'Repository source tree (folders and files; indentation = nesting; ' +
    'heavy dirs like node_modules/.git/build artifacts omitted). ' +
    'Use it as ground truth for the «Folder structure» section:\n'
  user += `${folderTree.slice(0, MAX_BOOTSTRAP_TREE)}\n\n`
  if (listing) {
    user += `Root listing (names; directories end with /):\n${listing.slice(0, MAX_BOOTSTRAP_LISTING)}\n\n`
  }
  if (pkg) user += `package.json:\n${pkg.slice(0, 14_000)}\n\n`
  if (term) user += `Recent terminal output (context):\n${term}\n`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user.trimEnd() },
  ]
}

/**
 * Añade contexto del cwd de la sesión (listado, package.json),
 * `.ai-terminal/agent.md` si existe, log de interacciones previas, salida reciente del terminal
 * y (opcional) instrucciones de modo agente.
 */
export function enrichSystemWithContext(
  system: string,
  terminalContext: string,
  workspace: ProjectAiContextForAi | null = null,
  agentMdMarkdown: string | null = null,
  agentMode = false,
  agentShellPolicy: AgentShellPolicy = 'off',
  interactionsLog: string[] = [],
): string {
  let out = system

  if (workspace) {
    const list = workspace.listing.trim()
    if (list) {
      out += `\n\nSession working directory: ${workspace.cwd}\nRoot listing (like ls; names; directories end with /):\n\`\`\`\n${list}\n\`\`\``
    }
    const pkg = workspace.packageJson?.trim()
    if (pkg) {
      out += `\n\npackage.json in that directory:\n\`\`\`json\n${pkg}\n\`\`\``
    }
  }

  const agent = agentMdMarkdown?.trim()
  if (agent) {
    out += `\n\n--- start .ai-terminal/agent.md ---\n${agent.slice(0, MAX_AGENT_MD_IN_SYSTEM)}\n--- end .ai-terminal/agent.md ---`
  }

  if (interactionsLog.length > 0) {
    out +=
      `\n\n--- Prior interactions (AI-generated summaries, max ${INTERACTION_LOG_SUMMARY_MAX_WORDS} words each) ---\n` +
      `${interactionsLog.join('\n')}\n--- end prior interactions ---`
  }

  const term = terminalContext.trim()
  if (term) {
    out += `\n\nCurrent terminal context (last lines):\n\`\`\`\n${term.slice(-3000)}\n\`\`\``
  }

  if (agentMode) {
    out += agentModeSystemSuffix(agentShellPolicy)
  }

  return out
}

export function buildExplainPrompt(
  selectedText: string,
  terminalContext = '',
  workspace: ProjectAiContextForAi | null = null,
  agentMdMarkdown: string | null = null,
  agentMode = false,
  agentShellPolicy: AgentShellPolicy = 'off',
  interactionsLog: string[] = [],
): ChatMessage[] {
  return [
    {
      role: 'system',
      content: enrichSystemWithContext(
        'You are an expert full-stack software developer. Explain clearly, concisely, and briefly what the following shell/CLI output means: prefer a few short sentences or bullets; avoid rambling. If it is an error, give cause and fix in the minimum useful text. ' +
        'Supporting context later in this system message (cwd, files, recent session output) may be stale; prioritize the selected output and the user request.',
        terminalContext,
        workspace,
        agentMdMarkdown,
        agentMode,
        agentShellPolicy,
        interactionsLog,
      ),
    },
    {
      role: 'user',
      content: `Explain the following shell/CLI output:\n\`\`\`\n${selectedText}\n\`\`\``,
    },
  ]
}

export function buildCommandPrompt(
  intent: string,
  terminalContext = '',
  workspace: ProjectAiContextForAi | null = null,
  agentMdMarkdown: string | null = null,
  agentMode = false,
  agentShellPolicy: AgentShellPolicy = 'off',
  interactionsLog: string[] = [],
): ChatMessage[] {
  return [
    {
      role: 'system',
      content: enrichSystemWithContext(
        'You are an expert full-stack software developer, comfortable on macOS and Linux shells. Reply ONLY with the exact shell command, no explanations or markdown. One command per reply. ' +
        'Context later in this system message may be stale; derive the command from the user intent below.',
        terminalContext,
        workspace,
        agentMdMarkdown,
        agentMode,
        agentShellPolicy,
        interactionsLog,
      ),
    },
    {
      role: 'user',
      content: intent,
    },
  ]
}

export function buildChatSystemPrompt(
  terminalContext = '',
  workspace: ProjectAiContextForAi | null = null,
  agentMdMarkdown: string | null = null,
  agentMode = false,
  agentShellPolicy: AgentShellPolicy = 'off',
  interactionsLog: string[] = [],
  mentionedFiles: MentionedFile[] = [],
): string {
  return buildRichContext({
    baseInstruction:
      'You are an expert full-stack software developer helping inside an editor-integrated terminal session. Reply in clear, direct, concise English: prefer a few short sentences or bullets; avoid long paragraphs unless the user asks for more detail. ' +
      'Additional sections in this system message (cwd, package.json, agent.md, prior summaries, recent session output) are supporting context and may be stale; always prioritize the latest user message and the current conversation.',
    terminalContext,
    workspace,
    agentMd: agentMdMarkdown,
    agentMode,
    agentShellPolicy,
    interactionsLog,
    mentionedFiles,
  })
}

/**
 * Una sola línea de asunto para `git commit -m`, a partir de estado/diff (truncado en el caller).
 */
export async function suggestGitCommitMessage(
  diffContext: string,
  options: OllamaOptions,
): Promise<string> {
  const trimmed = diffContext.trim().slice(0, 120_000)
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You write git commit subject lines only. Reply with exactly ONE line: a concise subject ' +
        '(prefer Conventional Commits: type(scope): description). No quotes, no markdown fences, no backticks, no multiple lines.',
    },
    {
      role: 'user',
      content:
        'Propose only the commit subject line for the following repository state and diffs:\n\n' +
        trimmed,
    },
  ]
  const raw = await chatOllama(messages, { ...options, think: false })
  const cleaned = raw
    .replace(/^[`"'«»]+|[`"'«»]+$/g, '')
    .trim()
  const line = cleaned.split(/\r?\n/).map(l => l.trim()).find(l => l.length > 0) ?? ''
  return line.slice(0, GIT_MAX_COMMIT_MESSAGE_CHARS)
}
