import type { ChatMessage } from '@ai/types'
import { chatAI, type AiOptions } from '@ai/aiClient'
import {
  extractGitBlock,
  extractGlobBlock,
  extractGrepBlock,
  extractListBlock,
  extractPatchBlocks,
  extractReadBlock,
  extractRunBlocks,
  extractWriteBlocks,
  fallbackExtractWrites,
  type GrepQuery,
  type GitBlockRequest,
  type ReadRequest,
} from '@shared/agentFileProtocol'
import { requiresShellConfirmation, isDestructiveShellCommand } from '@shared/agentShellGuard'
import {
  filterPatchesByUserIntent,
  filterWritesByUserIntent,
  stripThinkingFromAgentReply,
  userWantsFileChanges,
} from '@shared/agentWriteGuard'
import type { AgentShellPolicy } from '@shared/configSchema'

const MAX_AGENT_ROUNDS = 8
const MAX_WRITE_OPS = 25
const MAX_PATCH_OPS = 25
const MAX_RUN_COMMANDS = 8
const MAX_GREP_QUERIES = 6
const MAX_LIST_DIRS = 8
const MAX_GLOB_PATTERNS = 6
const MAX_GREP_OUTPUT_CHARS = 14_000

export interface AgentModeLoopOptions extends AiOptions {
  shellPolicy: AgentShellPolicy
  confirmShell?: (command: string) => Promise<boolean>
}

function lastUserMessageText(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content
  }
  return ''
}

function shellEscapePattern(pattern: string): string {
  return pattern.replace(/'/g, `'\\''`)
}

async function runGrepQuery(sessionId: string, q: GrepQuery): Promise<string> {
  const pat = shellEscapePattern(q.pattern)
  const scope = q.scope.trim() || '.'
  const rgCmd =
    `rg --no-heading -n --max-count 40 --glob '!node_modules/**' --glob '!.git/**' --glob '!out/**' --glob '!dist/**' '${pat}' ${JSON.stringify(scope)} 2>/dev/null`
  const grepCmd =
    `grep -rn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=out --exclude-dir=dist '${pat}' ${JSON.stringify(scope)} 2>/dev/null | head -n 40`
  for (const cmd of [rgCmd, grepCmd]) {
    try {
      const r = await window.api.agentRunShell(sessionId, cmd)
      if (r.ok && r.stdout.trim()) return r.stdout.trimEnd()
    } catch { /* fallback */ }
  }
  return '(no matches)'
}

async function buildGrepPayload(sessionId: string, queries: GrepQuery[]): Promise<string> {
  const lines = [
    'GREP results. Use paths from matches for READ blocks next.',
    '',
  ]
  for (const q of queries) {
    lines.push(`--- GREP: "${q.pattern}" in ${q.scope === '.' ? '.' : q.scope} ---`)
    lines.push(await runGrepQuery(sessionId, q))
    lines.push('--- END GREP ---', '')
  }
  const out = lines.join('\n')
  return out.length > MAX_GREP_OUTPUT_CHARS
    ? `${out.slice(0, MAX_GREP_OUTPUT_CHARS)}\n… (grep output truncated)`
    : out
}

async function buildListPayload(sessionId: string, dirs: string[]): Promise<string> {
  const lines = ['Directory listings (session cwd). Use to explore before READ.', '']
  for (const dir of dirs.length > 0 ? dirs : ['.']) {
    const rel = dir.trim() || '.'
    lines.push(`--- LIST: ${rel} ---`)
    try {
      const r = await window.api.fileExplorerListDir(sessionId, rel === '.' ? '' : rel)
      if (r.ok) {
        for (const e of r.entries) {
          lines.push(`${e.isDirectory ? '[dir] ' : '[file] '}${e.name}`)
        }
        if (r.entries.length === 0) lines.push('(empty)')
      } else {
        lines.push(`[ERROR: ${r.error ?? 'list failed'}]`)
      }
    } catch (e) {
      lines.push(`[ERROR: ${e instanceof Error ? e.message : String(e)}]`)
    }
    lines.push('--- END LIST ---', '')
  }
  return lines.join('\n')
}

async function runGlobPattern(sessionId: string, pattern: string): Promise<string> {
  const pat = pattern.trim()
  const cmd =
    `rg --files -g ${JSON.stringify(pat)} --glob '!node_modules/**' --glob '!.git/**' --glob '!out/**' --glob '!dist/**' 2>/dev/null | head -n 60`
  try {
    const r = await window.api.agentRunShell(sessionId, cmd)
    if (r.ok && r.stdout.trim()) return r.stdout.trimEnd()
  } catch { /* ignore */ }
  return '(no files matched)'
}

async function buildGlobPayload(sessionId: string, patterns: string[]): Promise<string> {
  const lines = ['GLOB results (file names). Use paths for READ next.', '']
  for (const pattern of patterns) {
    lines.push(`--- GLOB: ${pattern} ---`)
    lines.push(await runGlobPattern(sessionId, pattern))
    lines.push('--- END GLOB ---', '')
  }
  return lines.join('\n')
}

async function buildGitPayload(sessionId: string, req: GitBlockRequest): Promise<string> {
  if (req.command === 'status') {
    try {
      const st = await window.api.gitStatus(sessionId)
      if (!st.isRepo) return `[ERROR: ${st.error ?? 'not a git repository'}]`
      const lines = [
        `branch: ${st.branchLine ?? st.branch ?? '(unknown)'}`,
        st.ahead != null ? `ahead: ${st.ahead}` : '',
        st.behind != null ? `behind: ${st.behind}` : '',
        '',
        'Files:',
        ...st.files.map(f => `${f.status} ${f.path}`),
      ]
      if (st.diffStat?.trim()) lines.push('', 'diff --stat (unstaged):', st.diffStat.trim())
      if (st.stagedDiffStat?.trim()) lines.push('', 'diff --stat (staged):', st.stagedDiffStat.trim())
      return lines.filter(Boolean).join('\n')
    } catch (e) {
      return `[ERROR: ${e instanceof Error ? e.message : String(e)}]`
    }
  }

  const paths = req.paths.length > 0 ? req.paths.map(p => JSON.stringify(p)).join(' ') : ''
  const gitArgs =
    req.command === 'diff-staged'
      ? `git diff --cached ${paths}`.trim()
      : `git diff ${paths}`.trim()
  try {
    const r = await window.api.agentRunShell(sessionId, gitArgs)
    if (r.ok) return r.stdout.trim() || '(no diff)'
    return `[ERROR: ${r.error ?? 'git diff failed'}]`
  } catch (e) {
    return `[ERROR: ${e instanceof Error ? e.message : String(e)}]`
  }
}

async function buildReadPayload(sessionId: string, requests: ReadRequest[]): Promise<string> {
  const lines = [
    'File contents under session cwd. Use exactly as shown; do not invent.',
    '',
  ]
  for (const req of requests) {
    const label =
      req.startLine != null && req.endLine != null
        ? `${req.path} (lines ${req.startLine}-${req.endLine})`
        : req.path
    lines.push(`--- FILE START: ${label} ---`)
    try {
      if (req.startLine != null && req.endLine != null) {
        const r = await window.api.agentReadFile(sessionId, req.path, req.startLine, req.endLine)
        if (r.ok && r.content !== undefined) {
          lines.push(r.content)
          if (r.totalLines != null) lines.push(`(file has ${r.totalLines} lines total)`)
        } else lines.push(`[ERROR: ${r.error ?? 'could not read'}]`)
      } else {
        const r = await window.api.agentReadFile(sessionId, req.path)
        if (r.ok && r.content !== undefined) lines.push(r.content)
        else lines.push(`[ERROR: ${r.error ?? 'could not read'}]`)
      }
    } catch (e) {
      lines.push(`[ERROR: ${e instanceof Error ? e.message : String(e)}]`)
    }
    lines.push(`--- FILE END: ${req.path} ---`, '')
  }
  return lines.join('\n')
}

async function buildShellFollowUp(
  sessionId: string,
  commands: string[],
  policy: AgentShellPolicy,
  confirmShell?: (command: string) => Promise<boolean>,
): Promise<string> {
  const lines: string[] = []
  if (policy === 'off') {
    lines.push('Shell policy is **off**. No RUN block commands were executed.')
    for (const c of commands) lines.push(`- skipped: \`${c}\``)
    return lines.join('\n')
  }
  for (const cmd of commands) {
    if (requiresShellConfirmation(cmd, policy)) {
      const ok = (await confirmShell?.(cmd)) === true
      if (!ok) {
        lines.push(`### Not run\n\`${cmd}\`\n_(rejected)_`)
        continue
      }
    }
    try {
      const r = await window.api.agentRunShell(sessionId, cmd, {
        destructiveConfirmed: isDestructiveShellCommand(cmd),
      })
      if (r.ok) {
        lines.push(`### Command\n\`${cmd}\`\n**exit code:** ${r.exitCode ?? '(null)'}\n`)
        if (r.stdout.trim()) lines.push('**stdout:**\n```\n' + r.stdout.trimEnd() + '\n```')
        if (r.stderr.trim()) lines.push('**stderr:**\n```\n' + r.stderr.trimEnd() + '\n```')
      } else {
        lines.push(`### Run error\n\`${cmd}\`\n${r.error}`)
      }
    } catch (e) {
      lines.push(`### Run error\n\`${cmd}\`\n${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return lines.join('\n\n')
}

/**
 * Chat con bucle de herramientas: GREP/LIST/GLOB/GIT/RUN/READ y WRITE/PATCH al final.
 */
export async function runChatWithAgentFileLoop(
  initialMessages: ChatMessage[],
  sessionId: string,
  opts: AgentModeLoopOptions,
  onStreamText: (visible: string) => void,
): Promise<string> {
  const { shellPolicy, confirmShell, ...aiOpts } = opts
  const userRequest = lastUserMessageText(initialMessages)
  let chain = [...initialMessages]
  const uiParts: string[] = []
  let exitedWithPendingFollowUp = false

  for (let round = 0; round < MAX_AGENT_ROUNDS; round++) {
    let buf = ''
    await chatAI(chain, {
      ...aiOpts,
      onToken: tok => {
        buf += tok
        onStreamText([...uiParts, buf.trimEnd()].filter(Boolean).join('\n\n'))
      },
    })

    const reply = buf.trimEnd()
    let cursor = reply
    const { stripped: afterRun, commands: rawRunCmds } = extractRunBlocks(cursor)
    cursor = afterRun
    const { stripped: afterGrep, queries: rawGrepQueries } = extractGrepBlock(cursor)
    cursor = afterGrep
    const { stripped: afterList, dirs: rawListDirs } = extractListBlock(cursor)
    cursor = afterList
    const { stripped: afterGlob, patterns: rawGlobPatterns } = extractGlobBlock(cursor)
    cursor = afterGlob
    const { stripped: visStripped, requests: gitRequests } = extractGitBlock(cursor)
    cursor = visStripped
    const { stripped: afterRead, requests: readRequests } = extractReadBlock(cursor)

    const runCommands = rawRunCmds.slice(0, MAX_RUN_COMMANDS)
    const grepQueries = rawGrepQueries.slice(0, MAX_GREP_QUERIES)
    const listDirs = rawListDirs.slice(0, MAX_LIST_DIRS)
    const globPatterns = rawGlobPatterns.slice(0, MAX_GLOB_PATTERNS)

    const needsFollowUp =
      runCommands.length > 0 ||
      grepQueries.length > 0 ||
      listDirs.length > 0 ||
      globPatterns.length > 0 ||
      gitRequests.length > 0 ||
      readRequests.length > 0

    if (!needsFollowUp) {
      uiParts.push(reply)
      exitedWithPendingFollowUp = false
      break
    }

    uiParts.push(afterRead.trimEnd())
    exitedWithPendingFollowUp = true

    const additions: ChatMessage[] = [{ role: 'assistant', content: reply }]
    if (runCommands.length > 0) {
      let shellMsg = await buildShellFollowUp(sessionId, runCommands, shellPolicy, confirmShell)
      if (rawRunCmds.length > MAX_RUN_COMMANDS) {
        shellMsg += `\n\n_(${rawRunCmds.length - MAX_RUN_COMMANDS} RUN lines omitted.)_`
      }
      additions.push({ role: 'user', content: shellMsg })
    }
    if (grepQueries.length > 0) {
      additions.push({ role: 'user', content: await buildGrepPayload(sessionId, grepQueries) })
    }
    if (listDirs.length > 0) {
      additions.push({ role: 'user', content: await buildListPayload(sessionId, listDirs) })
    }
    if (globPatterns.length > 0) {
      additions.push({ role: 'user', content: await buildGlobPayload(sessionId, globPatterns) })
    }
    for (const gitRequest of gitRequests) {
      additions.push({ role: 'user', content: await buildGitPayload(sessionId, gitRequest) })
    }
    if (readRequests.length > 0) {
      additions.push({ role: 'user', content: await buildReadPayload(sessionId, readRequests) })
    }
    chain = [...chain, ...additions]
  }

  let merged = stripThinkingFromAgentReply(uiParts.join('\n\n').trimEnd())
  if (exitedWithPendingFollowUp) {
    merged +=
      '\n\n---\n_Agent round limit reached (' +
      String(MAX_AGENT_ROUNDS) +
      '). Send again or split the task._'
  }

  let { stripped, writes } = extractWriteBlocks(merged)
  let { stripped: stripped2, patches } = extractPatchBlocks(stripped)
  stripped = stripped2

  if (writes.length === 0 && userWantsFileChanges(userRequest)) {
    const fallback = fallbackExtractWrites(stripped)
    if (fallback.writes.length > 0) {
      stripped = fallback.stripped
      writes = fallback.writes
    }
  }

  const { allowed: writesToApply, rejected: blockedWrites } = filterWritesByUserIntent(
    userRequest,
    writes,
  )
  const { allowed: patchesToApply, rejected: blockedPatches } = filterPatchesByUserIntent(
    userRequest,
    patches,
  )

  let finalText = stripped.trimEnd()
  const appliedWrites: string[] = []
  const appliedPatches: string[] = []
  const writeErrs: string[] = []
  const patchErrs: string[] = []

  for (const w of writesToApply.slice(0, MAX_WRITE_OPS)) {
    try {
      const r = await window.api.agentWriteFile(sessionId, w.path, w.content)
      if (r.ok) appliedWrites.push(w.path)
      else writeErrs.push(`${w.path}: ${r.error ?? 'error'}`)
    } catch (e) {
      writeErrs.push(`${w.path}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  for (const p of patchesToApply.slice(0, MAX_PATCH_OPS)) {
    try {
      const r = await window.api.agentPatchFile(sessionId, p.path, p.hunks)
      if (r.ok) appliedPatches.push(p.path)
      else patchErrs.push(`${p.path}: ${r.error ?? 'error'}`)
    } catch (e) {
      patchErrs.push(`${p.path}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const hasFooter =
    appliedWrites.length > 0 ||
    appliedPatches.length > 0 ||
    blockedWrites.length > 0 ||
    blockedPatches.length > 0 ||
    writeErrs.length > 0 ||
    patchErrs.length > 0

  if (hasFooter) {
    finalText += '\n\n---\n'
    if (appliedWrites.length > 0) {
      finalText += `\n_✓ Files written: ${appliedWrites.map(p => `\`${p}\``).join(', ')}_\n`
    }
    if (appliedPatches.length > 0) {
      finalText += `\n_✓ Patches applied: ${appliedPatches.map(p => `\`${p}\``).join(', ')}_\n`
    }
    if (blockedWrites.length > 0) {
      finalText +=
        `\n_⊘ Writes blocked: ${blockedWrites.map(b => `\`${b.path}\` (${b.reason})`).join('; ')}_\n`
    }
    if (blockedPatches.length > 0) {
      finalText +=
        `\n_⊘ Patches blocked: ${blockedPatches.map(b => `\`${b.path}\` (${b.reason})`).join('; ')}_\n`
    }
    if (writeErrs.length > 0) {
      finalText += `\n_✗ Write errors: ${writeErrs.join('; ')}_\n`
    }
    if (patchErrs.length > 0) {
      finalText += `\n_✗ Patch errors: ${patchErrs.join('; ')}_\n`
    }
  }

  return finalText.trimEnd()
}
