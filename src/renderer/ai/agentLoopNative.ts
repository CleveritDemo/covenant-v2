/**
 * Bucle de agente con tool calling nativo para Anthropic y OpenAI.
 * Mantiene la conversación en el formato nativo de cada proveedor
 * y ejecuta herramientas reales vía window.api.
 */
import type { ChatMessage } from '@ai/types'
import type { AiOptions } from '@ai/aiClient'
import type { AgentShellPolicy } from '@shared/configSchema'
import type { ToolResult } from '@ai/agentTypes'
import { AI_TOOLS } from '@ai/toolDefinitions'
import {
  filterWritesByUserIntent,
} from '@shared/agentWriteGuard'
import {
  isDestructiveShellCommand,
  requiresShellConfirmation,
} from '@shared/agentShellGuard'
import {
  chatAnthropicAgentTurn,
  chatMessagesToAnthropicNative,
  appendAnthropicToolResults,
} from '@ai/anthropicClient'
import {
  chatOpenAIAgentTurn,
  chatMessagesToOpenAINative,
  appendOpenAIToolResults,
} from '@ai/openaiClient'

const MAX_AGENT_ROUNDS = 8
const MAX_TOOL_RESULT_CHARS = 40_000

export interface NativeAgentOptions extends AiOptions {
  shellPolicy: AgentShellPolicy
  confirmShell?: (command: string) => Promise<boolean>
}

function lastUserMessageText(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content
  }
  return ''
}

// ── Ejecutores de herramientas ────────────────────────────────────────────

async function executeReadFile(sessionId: string, input: Record<string, unknown>): Promise<string> {
  const path = String(input.path ?? '')
  if (!path) return '[ERROR: path is required]'
  try {
    const r = await window.api.agentReadFile(sessionId, path)
    if (r.ok && r.content !== undefined) return r.content
    return `[ERROR: ${r.error ?? 'could not read file'}]`
  } catch (e) {
    return `[ERROR: ${e instanceof Error ? e.message : String(e)}]`
  }
}

async function executeWriteFile(
  sessionId: string,
  input: Record<string, unknown>,
  userMessage: string,
): Promise<string> {
  const path = String(input.path ?? '')
  const content = String(input.content ?? '')
  if (!path) return '[ERROR: path is required]'
  const { allowed, rejected } = filterWritesByUserIntent(userMessage, [{ path, content }])
  if (allowed.length === 0) {
    const reason = rejected[0]?.reason ?? 'write blocked'
    return `[BLOCKED: ${reason}]`
  }
  try {
    const r = await window.api.agentWriteFile(sessionId, path, content)
    return r.ok ? `File written: ${path}` : `[ERROR: ${r.error ?? 'write failed'}]`
  } catch (e) {
    return `[ERROR: ${e instanceof Error ? e.message : String(e)}]`
  }
}

async function executeRunCommand(
  sessionId: string,
  input: Record<string, unknown>,
  policy: AgentShellPolicy,
  confirm?: (cmd: string) => Promise<boolean>,
): Promise<string> {
  const command = String(input.command ?? '')
  if (!command) return '[ERROR: command is required]'
  if (policy === 'off') return `[SKIPPED: shell execution is disabled. Command was: ${command}]`
  if (requiresShellConfirmation(command, policy)) {
    const ok = (await confirm?.(command)) === true
    if (!ok) return `[REJECTED: user did not confirm command: ${command}]`
  }
  try {
    const r = await window.api.agentRunShell(sessionId, command, {
      destructiveConfirmed: isDestructiveShellCommand(command),
    })
    if (!r.ok) return `[ERROR: ${r.error}]`
    const parts: string[] = [`exit code: ${r.exitCode ?? '(null)'}`]
    if (r.stdout.trim()) parts.push(`stdout:\n${r.stdout.trimEnd()}`)
    if (r.stderr.trim()) parts.push(`stderr:\n${r.stderr.trimEnd()}`)
    return parts.join('\n\n')
  } catch (e) {
    return `[ERROR: ${e instanceof Error ? e.message : String(e)}]`
  }
}

async function executeSearchFiles(
  sessionId: string,
  input: Record<string, unknown>,
  policy: AgentShellPolicy,
  confirm?: (cmd: string) => Promise<boolean>,
): Promise<string> {
  const pattern = String(input.pattern ?? '')
  const searchType = String(input.search_type ?? 'glob')
  if (!pattern) return '[ERROR: pattern is required]'
  if (policy === 'off') {
    return `[SKIPPED: shell execution is disabled. search_files requires shell policy ask/always.]`
  }
  const command = searchType === 'grep'
    ? `rg --no-heading -l ${JSON.stringify(pattern)} --glob '!node_modules/**' --glob '!.git/**'`
    : `rg --files -g ${JSON.stringify(pattern)} --glob '!node_modules/**' --glob '!.git/**' 2>/dev/null | head -n 60`
  if (requiresShellConfirmation(command, policy)) {
    const ok = (await confirm?.(command)) === true
    if (!ok) return `[REJECTED: user did not confirm search command: ${command}]`
  }
  try {
    const r = await window.api.agentRunShell(sessionId, command, {
      destructiveConfirmed: isDestructiveShellCommand(command),
    })
    if (!r.ok) return `[ERROR: ${r.error}]`
    return r.stdout.trim() || '(no matches found)'
  } catch (e) {
    return `[ERROR: ${e instanceof Error ? e.message : String(e)}]`
  }
}

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  sessionId: string,
  policy: AgentShellPolicy,
  confirm: ((cmd: string) => Promise<boolean>) | undefined,
  userMessage: string,
): Promise<string> {
  let result: string
  switch (name) {
    case 'read_file': result = await executeReadFile(sessionId, input); break
    case 'write_file': result = await executeWriteFile(sessionId, input, userMessage); break
    case 'run_command': result = await executeRunCommand(sessionId, input, policy, confirm); break
    case 'search_files': result = await executeSearchFiles(sessionId, input, policy, confirm); break
    default: result = `[ERROR: unknown tool "${name}"]`
  }
  return result.length > MAX_TOOL_RESULT_CHARS
    ? `${result.slice(0, MAX_TOOL_RESULT_CHARS)}\n… (result truncated)`
    : result
}

// ── Bucle de agente para Anthropic ────────────────────────────────────────

async function runAnthropicAgentLoop(
  initialMessages: ChatMessage[],
  sessionId: string,
  opts: NativeAgentOptions,
  onStreamText: (visible: string) => void,
): Promise<string> {
  const systemMsg = initialMessages.find(m => m.role === 'system')
  const systemPrompt = systemMsg?.content ?? ''
  const userMessage = lastUserMessageText(initialMessages)

  let nativeMessages = chatMessagesToAnthropicNative(initialMessages)
  const uiParts: string[] = []

  for (let round = 0; round < MAX_AGENT_ROUNDS; round++) {
    let streamedText = ''
    const { result, rawContent } = await chatAnthropicAgentTurn(
      systemPrompt,
      nativeMessages,
      AI_TOOLS,
      { apiKey: opts.anthropicApiKey, model: opts.model, signal: opts.signal },
      tok => {
        streamedText += tok
        onStreamText([...uiParts, streamedText.trimEnd()].filter(Boolean).join('\n\n'))
      },
    )

    if (result.toolCalls.length === 0) {
      uiParts.push(result.text)
      break
    }

    if (result.text.trim()) uiParts.push(result.text.trim())

    const toolResults: ToolResult[] = []
    for (const tc of result.toolCalls) {
      const content = await executeTool(
        tc.name, tc.input, sessionId, opts.shellPolicy, opts.confirmShell, userMessage,
      )
      toolResults.push({ toolCallId: tc.id, content })
    }

    nativeMessages = appendAnthropicToolResults(nativeMessages, rawContent, toolResults)
  }

  return uiParts.join('\n\n').trimEnd()
}

// ── Bucle de agente para OpenAI ───────────────────────────────────────────

async function runOpenAIAgentLoop(
  initialMessages: ChatMessage[],
  sessionId: string,
  opts: NativeAgentOptions,
  onStreamText: (visible: string) => void,
): Promise<string> {
  const userMessage = lastUserMessageText(initialMessages)
  let nativeMessages = chatMessagesToOpenAINative(initialMessages)
  const uiParts: string[] = []

  for (let round = 0; round < MAX_AGENT_ROUNDS; round++) {
    let streamedText = ''
    const { result, rawToolCalls, assistantText } = await chatOpenAIAgentTurn(
      nativeMessages,
      AI_TOOLS,
      { apiKey: opts.openaiApiKey, model: opts.model, signal: opts.signal },
      tok => {
        streamedText += tok
        onStreamText([...uiParts, streamedText.trimEnd()].filter(Boolean).join('\n\n'))
      },
    )

    if (result.toolCalls.length === 0) {
      uiParts.push(result.text)
      break
    }

    if (result.text.trim()) uiParts.push(result.text.trim())

    const toolResults: ToolResult[] = []
    for (const tc of result.toolCalls) {
      const content = await executeTool(
        tc.name, tc.input, sessionId, opts.shellPolicy, opts.confirmShell, userMessage,
      )
      toolResults.push({ toolCallId: tc.id, content })
    }

    nativeMessages = appendOpenAIToolResults(nativeMessages, rawToolCalls, assistantText, toolResults)
  }

  return uiParts.join('\n\n').trimEnd()
}

// ── Entrada pública ───────────────────────────────────────────────────────

/**
 * Bucle de agente con tool calling nativo para Anthropic y OpenAI.
 * Ejecuta hasta MAX_AGENT_ROUNDS rondas de conversación, resolviendo
 * herramientas (read_file, write_file, run_command, search_files) en cada vuelta.
 */
export async function runNativeAgentLoop(
  initialMessages: ChatMessage[],
  sessionId: string,
  opts: NativeAgentOptions,
  onStreamText: (visible: string) => void,
): Promise<string> {
  if (opts.provider === 'anthropic') {
    return runAnthropicAgentLoop(initialMessages, sessionId, opts, onStreamText)
  }
  if (opts.provider === 'openai') {
    return runOpenAIAgentLoop(initialMessages, sessionId, opts, onStreamText)
  }
  throw new Error(`runNativeAgentLoop: provider "${opts.provider}" does not support native tool calling`)
}
