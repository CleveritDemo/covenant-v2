import { describe, expect, it, vi } from 'vitest'
import { LspClient, type LspDiagnostic, type Transport } from '../client'

class FakeTransport implements Transport {
  sent: string[] = []
  private cb: (m: string) => void = () => {}

  send(message: string): void {
    this.sent.push(message)
  }

  onMessage(cb: (message: string) => void): void {
    this.cb = cb
  }

  deliver(msg: unknown): void {
    this.cb(JSON.stringify(msg))
  }

  deliverRaw(raw: string): void {
    this.cb(raw)
  }

  dispose(): void {}

  /** Último mensaje enviado, ya parseado. */
  last(): { id?: number; method?: string; params?: Record<string, unknown>; error?: unknown } {
    return JSON.parse(this.sent[this.sent.length - 1])
  }

  parsed(i: number): { id?: number; method?: string; params?: Record<string, unknown> } {
    return JSON.parse(this.sent[i])
  }
}

describe('LspClient', () => {
  it('correlaciona la respuesta con el request por id', async () => {
    const tr = new FakeTransport()
    const client = new LspClient(tr)
    const pending = client.hover('file:///a.rs', { line: 0, character: 0 })
    const { id } = tr.last()
    tr.deliver({ jsonrpc: '2.0', id, result: { contents: { value: 'fn main()' } } })
    await expect(pending).resolves.toBe('fn main()')
  })

  it('una respuesta de error rechaza con su mensaje', async () => {
    const tr = new FakeTransport()
    const client = new LspClient(tr)
    const pending = client.definition('file:///a.rs', { line: 0, character: 0 })
    tr.deliver({ jsonrpc: '2.0', id: tr.last().id, error: { message: 'boom' } })
    await expect(pending).rejects.toThrow('boom')
  })

  it('un mensaje malformado no rompe el pump ni la respuesta siguiente', async () => {
    const tr = new FakeTransport()
    const client = new LspClient(tr)
    const pending = client.hover('file:///a.rs', { line: 0, character: 0 })
    tr.deliverRaw('{ esto no es json')
    tr.deliver({ jsonrpc: '2.0', id: tr.last().id, result: { contents: 'ok' } })
    await expect(pending).resolves.toBe('ok')
  })

  it('declina los requests server→cliente para que el server no quede colgado', () => {
    const tr = new FakeTransport()
    // eslint-disable-next-line no-new
    new LspClient(tr)
    tr.deliver({ jsonrpc: '2.0', id: 42, method: 'window/showMessageRequest', params: {} })
    expect(tr.last()).toMatchObject({ id: 42, error: { code: -32601 } })
  })

  it('reparte publishDiagnostics a los suscriptores', () => {
    const tr = new FakeTransport()
    const client = new LspClient(tr)
    const seen: Array<[string, LspDiagnostic[]]> = []
    client.onDiagnostics((uri, diags) => seen.push([uri, diags]))

    const diags: LspDiagnostic[] = [
      { range: { start: { line: 1, character: 0 }, end: { line: 1, character: 4 } }, message: 'oops' },
    ]
    tr.deliver({
      jsonrpc: '2.0',
      method: 'textDocument/publishDiagnostics',
      params: { uri: 'file:///a.rs', diagnostics: diags },
    })
    expect(seen).toEqual([['file:///a.rs', diags]])
  })

  it('didChange incrementa la versión del documento en cada envío', () => {
    const tr = new FakeTransport()
    const client = new LspClient(tr)
    client.didOpen('file:///a.rs', 'rust', 'fn main() {}')
    client.didChange('file:///a.rs', [{ text: 'fn main() {}' }])
    client.didChange('file:///a.rs', [{ text: 'fn main() { }' }])

    expect((tr.parsed(0).params as { textDocument: { version: number } }).textDocument.version).toBe(1)
    expect((tr.parsed(1).params as { textDocument: { version: number } }).textDocument.version).toBe(2)
    expect((tr.parsed(2).params as { textDocument: { version: number } }).textDocument.version).toBe(3)
  })

  it('normaliza LocationLink y Location a la misma forma', async () => {
    const tr = new FakeTransport()
    const client = new LspClient(tr)
    const range = { start: { line: 3, character: 0 }, end: { line: 3, character: 5 } }

    const asLink = client.definition('file:///a.rs', { line: 0, character: 0 })
    tr.deliver({
      jsonrpc: '2.0',
      id: tr.last().id,
      result: [{ targetUri: 'file:///b.rs', targetSelectionRange: range, targetRange: range }],
    })
    await expect(asLink).resolves.toEqual([{ uri: 'file:///b.rs', range }])

    const asLocation = client.definition('file:///a.rs', { line: 0, character: 0 })
    tr.deliver({ jsonrpc: '2.0', id: tr.last().id, result: { uri: 'file:///b.rs', range } })
    await expect(asLocation).resolves.toEqual([{ uri: 'file:///b.rs', range }])
  })

  it('distingue un Command pelado de un CodeAction por la forma de `command`', async () => {
    const tr = new FakeTransport()
    const client = new LspClient(tr)
    const range = { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }
    const pending = client.codeAction('file:///a.rs', range, [])
    tr.deliver({
      jsonrpc: '2.0',
      id: tr.last().id,
      result: [
        { title: 'Comando pelado', command: 'rust-analyzer.run', arguments: [1] },
        { title: 'Quick fix', edit: { changes: {} }, command: { command: 'x.y', arguments: [] } },
      ],
    })
    await expect(pending).resolves.toEqual([
      { title: 'Comando pelado', command: { command: 'rust-analyzer.run', arguments: [1] } },
      { title: 'Quick fix', edit: { changes: {} }, command: { command: 'x.y', arguments: [] } },
    ])
  })

  it('un request sin respuesta se rechaza por timeout', async () => {
    vi.useFakeTimers()
    try {
      const client = new LspClient(new FakeTransport())
      const pending = client.hover('file:///a.rs', { line: 0, character: 0 })
      const assertion = expect(pending).rejects.toThrow(/lsp timeout/)
      await vi.advanceTimersByTimeAsync(10_001)
      await assertion
    } finally {
      vi.useRealTimers()
    }
  })

  it('dispose rechaza todo lo pendiente en vez de dejarlo colgado', async () => {
    const tr = new FakeTransport()
    const client = new LspClient(tr)
    const pending = client.hover('file:///a.rs', { line: 0, character: 0 })
    client.dispose()
    await expect(pending).rejects.toThrow(/disposed/)
  })
})
