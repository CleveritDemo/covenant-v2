/**
 * Smoke end-to-end del motor LSP contra language servers REALES.
 *
 * Para cada lenguaje del manifiesto: instala el server (descarga binaria o npm),
 * lo arranca y hace un initialize → didOpen → hover completo. Es la única prueba
 * que cubre a la vez instalación, detección de runtime, spawn, framing,
 * correlación JSON-RPC y —en csharp— el handshake de carga de proyecto.
 *
 * Está fuera de `npm test` a propósito: descarga ~120 MB de la red y tarda
 * minutos. Para correrla:
 *
 *     LSP_SMOKE=1 npx vitest run electron/__tests__/lspSmoke.test.ts
 *
 * `LSP_SMOKE_DATA_DIR=/ruta` reutiliza las instalaciones entre corridas, que es
 * lo que hace tolerable iterar sobre esta prueba.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import {
  initLspEngine,
  lspDownloadServer,
  lspSend,
  lspServerStatus,
  lspStart,
  stopAllLspServers,
} from '../lsp/lspOps'
import type { LspServerStatus } from '../../src/shared/lspTypes'

const CHANNELS = { message: 'm', exit: 'x', downloadProgress: 'p' }
/** Los servers grandes (Roslyn, jdtls) tardan en cargar el proyecto. */
const TEST_TIMEOUT_MS = 600_000
const RESPONSE_TIMEOUT_MS = 120_000

interface JsonRpcMessage {
  id?: number
  method?: string
  params?: unknown
  result?: unknown
  error?: { message?: string }
}

interface SmokeCase {
  language: string
  /** relPath → contenido. */
  files: Record<string, string>
  openRel: string
  /** Substring del archivo abierto; el hover apunta a su primer carácter. */
  hoverNeedle: string
  /** Todo esto tiene que aparecer en el hover. */
  expectInHover: string[]
  /**
   * Handshake de carga de proyecto que el motor debería haber decidido.
   * `undefined` = no se comprueba; `null` = no debe haber ninguno.
   */
  expectSolutionKind?: 'solution' | 'project' | null
}

/** Posición LSP (0-based) del primer carácter de `needle` dentro de `text`. */
function positionOf(text: string, needle: string): { line: number; character: number } {
  const index = text.indexOf(needle)
  if (index === -1) throw new Error(`no encontré «${needle}» en el fixture`)
  const before = text.slice(0, index)
  const line = before.split('\n').length - 1
  return { line, character: index - (before.lastIndexOf('\n') + 1) }
}

const dirs: string[] = []
function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  dirs.push(dir)
  return dir
}

/** dataDir persistente si se pide, para no re-descargar en cada corrida. */
function smokeDataDir(): string {
  const fromEnv = process.env.LSP_SMOKE_DATA_DIR
  if (!fromEnv) return tempDir('gravity-lsp-smoke-data-')
  mkdirSync(fromEnv, { recursive: true })
  return fromEnv
}

async function runSmoke(testCase: SmokeCase): Promise<void> {
  const dataDir = smokeDataDir()
  const project = tempDir(`gravity-lsp-smoke-${testCase.language}-`)

  const inbox: JsonRpcMessage[] = []
  const waiters: Array<(m: JsonRpcMessage) => boolean> = []
  initLspEngine({
    dataDir,
    channels: CHANNELS,
    emit: (channel, ...args) => {
      if (channel !== CHANNELS.message) return
      const msg = JSON.parse(String(args[1])) as JsonRpcMessage
      inbox.push(msg)
      for (const w of [...waiters]) if (w(msg)) waiters.splice(waiters.indexOf(w), 1)
    },
  })

  const waitFor = (match: (m: JsonRpcMessage) => boolean, ms = RESPONSE_TIMEOUT_MS): Promise<JsonRpcMessage> =>
    new Promise((resolve, reject) => {
      const hit = inbox.find(match)
      if (hit) return resolve(hit)
      const timer = setTimeout(() => reject(new Error('timeout esperando respuesta LSP')), ms)
      waiters.push(m => {
        if (!match(m)) return false
        clearTimeout(timer)
        resolve(m)
        return true
      })
    })

  // 1. El manifiesto reporta el server y su runtime (si declara uno) presente.
  const status = lspServerStatus(testCase.language) as LspServerStatus
  expect(status).not.toHaveProperty('error')
  expect(status.runtimeMissing).toBeNull()

  // 2. Instalación real (descarga binaria verificada por sha256, o npm install).
  expect(await lspDownloadServer(testCase.language)).toEqual({ ok: true })
  expect((lspServerStatus(testCase.language) as LspServerStatus).installed).toBe(true)

  // 3. Proyecto mínimo del lenguaje.
  for (const [rel, content] of Object.entries(testCase.files)) {
    const abs = join(project, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }

  // 4. Arranque: el main resuelve la ruta y detecta la raíz por root markers.
  const started = lspStart(project, testCase.openRel)
  if (!started.ok) throw new Error(`lspStart falló: ${started.error}`)
  expect(started.language).toBe(testCase.language)
  expect(started.root).toBe(started.sessionRoot)
  if (testCase.expectSolutionKind !== undefined) {
    expect(started.solutionKind).toBe(testCase.expectSolutionKind)
  }

  const { serverId, filePath } = started
  const uri = `file://${filePath.split('/').map(encodeURIComponent).join('/')}`
  const send = (msg: unknown): void => lspSend(serverId, JSON.stringify(msg))

  // 5. Handshake.
  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      processId: null,
      rootUri: `file://${started.root}`,
      workspaceFolders: [{ uri: `file://${started.root}`, name: 'smoke' }],
      capabilities: {
        textDocument: {
          hover: { contentFormat: ['markdown', 'plaintext'] },
          synchronization: { didSave: true },
        },
        workspace: { workspaceFolders: true },
      },
    },
  })
  const initResult = await waitFor(m => m.id === 1)
  expect(initResult.error).toBeUndefined()
  expect(initResult.result).toBeTruthy()
  send({ jsonrpc: '2.0', method: 'initialized', params: {} })

  // 6. Carga de proyecto para Roslyn: `solution/open` y `project/open` NO son
  //    intercambiables, y el motor es quien decide cuál toca.
  if (started.solutionPath && started.solutionKind) {
    const solutionUri = `file://${started.solutionPath.split('/').map(encodeURIComponent).join('/')}`
    if (started.solutionKind === 'solution') {
      send({ jsonrpc: '2.0', method: 'solution/open', params: { solution: solutionUri } })
    } else {
      send({ jsonrpc: '2.0', method: 'project/open', params: { projects: [solutionUri] } })
    }
  }

  const text = testCase.files[testCase.openRel]
  send({
    jsonrpc: '2.0',
    method: 'textDocument/didOpen',
    params: { textDocument: { uri, languageId: testCase.language, version: 1, text } },
  })

  // 7. Hover, reintentando: un server recién arrancado devuelve null hasta que
  //    terminó de indexar/cargar el proyecto.
  const position = positionOf(text, testCase.hoverNeedle)
  const matches = (reply: JsonRpcMessage): boolean => {
    if (!reply.result) return false
    const body = JSON.stringify(reply.result)
    return testCase.expectInHover.every(needle => body.includes(needle))
  }

  let hover: JsonRpcMessage | null = null
  let lastResult = 'null'
  for (let attempt = 0; attempt < 40; attempt++) {
    const id = 100 + attempt
    send({
      jsonrpc: '2.0',
      id,
      method: 'textDocument/hover',
      params: { textDocument: { uri }, position },
    })
    const reply = await waitFor(m => m.id === id)
    lastResult = JSON.stringify(reply.result ?? reply.error ?? null)
    if (matches(reply)) {
      hover = reply
      break
    }
    await new Promise(r => setTimeout(r, 3000))
  }

  if (!hover) {
    throw new Error(
      `el hover nunca contuvo ${JSON.stringify(testCase.expectInHover)}; último resultado: ${lastResult}`,
    )
  }
  expect(hover.error).toBeUndefined()
}

describe.skipIf(!process.env.LSP_SMOKE)('smoke LSP contra servers reales', () => {
  afterEach(() => stopAllLspServers())

  afterAll(() => {
    stopAllLspServers()
    while (dirs.length) rmSync(dirs.pop() as string, { recursive: true, force: true })
  })

  it('typescript: instala por npm, arranca y responde un hover', async () => {
    const source = [
      'export function greet(name: string): number {',
      '  return name.length',
      '}',
      "const x = greet('hola')",
      'export default x',
      '',
    ].join('\n')
    await runSmoke({
      language: 'typescript',
      files: {
        'package.json': '{"name":"smoke","version":"1.0.0"}',
        'tsconfig.json': '{"compilerOptions":{"strict":true}}',
        'src/index.ts': source,
      },
      openRel: 'src/index.ts',
      hoverNeedle: 'greet(\'hola\')',
      expectInHover: ['greet'],
      expectSolutionKind: null,
    })
  }, TEST_TIMEOUT_MS)

  it('rust: baja el binario gzip verificado, arranca y responde un hover', async () => {
    const source = [
      'fn greet(name: &str) -> usize {',
      '    name.len()',
      '}',
      '',
      'fn main() {',
      '    let n = greet("hola");',
      '    println!("{n}");',
      '}',
      '',
    ].join('\n')
    await runSmoke({
      language: 'rust',
      files: {
        'Cargo.toml': '[package]\nname = "smoke"\nversion = "0.1.0"\nedition = "2021"\n',
        'src/main.rs': source,
      },
      openRel: 'src/main.rs',
      hoverNeedle: 'greet("hola")',
      expectInHover: ['greet', 'usize'],
      expectSolutionKind: null,
    })
  }, TEST_TIMEOUT_MS)

  // Para csharp y java el hover es CROSS-FILE a propósito: `Greet`/`greet` viven
  // en otro archivo, así que resolverlos exige que la carga de proyecto haya
  // funcionado. Un hover dentro del mismo archivo pasaría aunque el handshake de
  // Roslyn o los dirs escribibles de jdtls estuvieran rotos.

  const CSPROJ = [
    '<Project Sdk="Microsoft.NET.Sdk">',
    '  <PropertyGroup>',
    '    <OutputType>Exe</OutputType>',
    '    <TargetFramework>net10.0</TargetFramework>',
    '    <Nullable>enable</Nullable>',
    '  </PropertyGroup>',
    '</Project>',
    '',
  ].join('\n')

  const CSHARP_HELPER = [
    'internal static class Helper',
    '{',
    '    internal static int Greet(string name) => name.Length;',
    '}',
    '',
  ].join('\n')

  const CSHARP_PROGRAM = [
    'internal static class Program',
    '{',
    '    static void Main()',
    '    {',
    '        var n = Helper.Greet("hola");',
    '        System.Console.WriteLine(n);',
    '    }',
    '}',
    '',
  ].join('\n')

  it('csharp: desempaqueta el nupkg zip y resuelve cross-file con project/open', async () => {
    await runSmoke({
      language: 'csharp',
      files: { 'Smoke.csproj': CSPROJ, 'Helper.cs': CSHARP_HELPER, 'Program.cs': CSHARP_PROGRAM },
      openRel: 'Program.cs',
      hoverNeedle: 'Greet("hola")',
      expectInHover: ['Greet', 'int'],
      // Sin `.sln`: el motor tiene que elegir `project/open`, porque para un
      // `.csproj` pelado `solution/open` no carga nada.
      expectSolutionKind: 'project',
    })
  }, TEST_TIMEOUT_MS)

  it('csharp: con un .sln elige solution/open y resuelve cross-file', async () => {
    const sln = [
      'Microsoft Visual Studio Solution File, Format Version 12.00',
      'Project("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "Smoke", "Smoke.csproj", "{11111111-1111-1111-1111-111111111111}"',
      'EndProject',
      'Global',
      'EndGlobal',
      '',
    ].join('\n')
    await runSmoke({
      language: 'csharp',
      files: {
        'Smoke.sln': sln,
        'Smoke.csproj': CSPROJ,
        'Helper.cs': CSHARP_HELPER,
        'Program.cs': CSHARP_PROGRAM,
      },
      openRel: 'Program.cs',
      hoverNeedle: 'Greet("hola")',
      expectInHover: ['Greet', 'int'],
      expectSolutionKind: 'solution',
    })
  }, TEST_TIMEOUT_MS)

  it('java: desempaqueta el tar.gz, arranca jdtls y resuelve cross-file', async () => {
    await runSmoke({
      language: 'java',
      files: {
        'pom.xml': [
          '<project xmlns="http://maven.apache.org/POM/4.0.0">',
          '  <modelVersion>4.0.0</modelVersion>',
          '  <groupId>smoke</groupId>',
          '  <artifactId>smoke</artifactId>',
          '  <version>1.0</version>',
          '  <properties>',
          '    <maven.compiler.source>21</maven.compiler.source>',
          '    <maven.compiler.target>21</maven.compiler.target>',
          '  </properties>',
          '</project>',
          '',
        ].join('\n'),
        'src/main/java/Helper.java': [
          'public class Helper {',
          '    public static int greet(String name) {',
          '        return name.length();',
          '    }',
          '}',
          '',
        ].join('\n'),
        'src/main/java/App.java': [
          'public class App {',
          '    public static void main(String[] args) {',
          '        System.out.println(Helper.greet("hola"));',
          '    }',
          '}',
          '',
        ].join('\n'),
      },
      openRel: 'src/main/java/App.java',
      hoverNeedle: 'greet("hola")',
      expectInHover: ['greet', 'int'],
      expectSolutionKind: null,
    })
  }, TEST_TIMEOUT_MS)
})
