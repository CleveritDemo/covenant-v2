/**
 * Framing del protocolo base LSP: `Content-Length: N\r\n(<hdr>\r\n)*\r\n<N bytes>`.
 * `push` es incremental: bufferea entradas parciales y devuelve cada payload completo.
 */

const HEADER_END = Buffer.from('\r\n\r\n', 'ascii')

export function encodeFrame(msg: string): Buffer {
  const body = Buffer.from(msg, 'utf8')
  const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'ascii')
  return Buffer.concat([header, body])
}

export class FrameDecoder {
  private buf: Buffer = Buffer.alloc(0)

  push(bytes: Buffer): string[] {
    this.buf = this.buf.length === 0 ? Buffer.from(bytes) : Buffer.concat([this.buf, bytes])
    const out: string[] = []
    for (;;) {
      const hdrEnd = this.buf.indexOf(HEADER_END)
      if (hdrEnd === -1) break

      const headers = this.buf.subarray(0, hdrEnd).toString('utf8')
      const len = contentLength(headers)
      if (len === null) {
        // Sin Content-Length: descartamos ese bloque de headers y resincronizamos.
        this.buf = this.buf.subarray(hdrEnd + HEADER_END.length)
        continue
      }

      const bodyStart = hdrEnd + HEADER_END.length
      if (this.buf.length < bodyStart + len) break // cuerpo incompleto: esperamos más bytes

      out.push(this.buf.subarray(bodyStart, bodyStart + len).toString('utf8'))
      this.buf = this.buf.subarray(bodyStart + len)
    }
    return out
  }
}

function contentLength(headers: string): number | null {
  for (const line of headers.split(/\r?\n/)) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    if (line.slice(0, idx).trim().toLowerCase() !== 'content-length') continue
    const n = Number.parseInt(line.slice(idx + 1).trim(), 10)
    if (Number.isFinite(n) && n >= 0) return n
  }
  return null
}
