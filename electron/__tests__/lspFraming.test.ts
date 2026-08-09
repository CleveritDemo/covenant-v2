import { describe, expect, it } from 'vitest'
import { encodeFrame, FrameDecoder } from '../lsp/framing'

const push = (d: FrameDecoder, s: string): string[] => d.push(Buffer.from(s, 'utf8'))

describe('framing LSP', () => {
  it('codifica con cabecera Content-Length en bytes', () => {
    expect(encodeFrame('{"a":1}').toString('utf8')).toBe('Content-Length: 7\r\n\r\n{"a":1}')
  })

  it('cuenta bytes, no caracteres, con contenido no ASCII', () => {
    // "ñ" son 2 bytes en UTF-8: un Content-Length basado en `String.length`
    // truncaría el cuerpo y el server dejaría de responder.
    const frame = encodeFrame('{"a":"ñ"}').toString('utf8')
    expect(frame.startsWith('Content-Length: 10\r\n\r\n')).toBe(true)
  })

  it('decodifica un mensaje completo', () => {
    const d = new FrameDecoder()
    expect(push(d, 'Content-Length: 7\r\n\r\n{"a":1}')).toEqual(['{"a":1}'])
  })

  it('decodifica un mensaje partido entre varios push', () => {
    const d = new FrameDecoder()
    expect(push(d, 'Content-Le')).toEqual([])
    expect(push(d, 'ngth: 7\r\n\r\n{"a"')).toEqual([])
    expect(push(d, ':1}')).toEqual(['{"a":1}'])
  })

  it('decodifica dos mensajes en un solo push', () => {
    const d = new FrameDecoder()
    expect(push(d, 'Content-Length: 2\r\n\r\n{}Content-Length: 7\r\n\r\n{"a":1}'))
      .toEqual(['{}', '{"a":1}'])
  })

  it('tolera cabeceras extra y mayúsculas distintas', () => {
    const d = new FrameDecoder()
    const raw = 'content-length: 2\r\nContent-Type: application/vscode-jsonrpc; charset=utf-8\r\n\r\n{}'
    expect(push(d, raw)).toEqual(['{}'])
  })

  it('descarta un bloque de cabeceras sin Content-Length y resincroniza', () => {
    const d = new FrameDecoder()
    expect(push(d, 'Garbage: x\r\n\r\nContent-Length: 2\r\n\r\n{}')).toEqual(['{}'])
  })

  it('reconstruye un cuerpo UTF-8 partido a mitad de un carácter multibyte', () => {
    // El pump de stdout corta por tamaño de chunk, no por límite de carácter:
    // decodificar cada chunk por separado rompería la "ñ" en dos reemplazos.
    const d = new FrameDecoder()
    const body = Buffer.from('{"a":"ñ"}', 'utf8')
    const frame = Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`), body])
    expect(d.push(frame.subarray(0, frame.length - 1))).toEqual([])
    expect(d.push(frame.subarray(frame.length - 1))).toEqual(['{"a":"ñ"}'])
  })
})
