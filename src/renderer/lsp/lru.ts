// Política LRU + apagado por inactividad para los servers LSP vivos. Sin reloj
// propio a propósito (cada método recibe `now`, ninguno llama a Date.now()), así
// se testea con un reloj falso. Quien lee el reloj real es el LspManager.
export interface LruIdlePolicyOpts {
  cap: number
  idleMs: number
  stop: (id: number) => void
}

export class LruIdlePolicy {
  private readonly cap: number
  private readonly idleMs: number
  private readonly stop: (id: number) => void

  // Ids vivos en orden menos-usado → más-usado. Un server queda acá esté activo
  // (con docs abiertos) o inactivo (sin docs, todavía no barrido); lo que los
  // distingue es `idleSince`.
  private mru: number[] = []
  // serverId → timestamp en que quedó inactivo (ausente mientras está activo).
  private idleSince = new Map<number, number>()

  constructor(opts: LruIdlePolicyOpts) {
    this.cap = opts.cap
    this.idleMs = opts.idleMs
    this.stop = opts.stop
  }

  /** Marca `id` como recién usado; si estaba inactivo vuelve a activo. */
  touch(id: number): void {
    this.idleSince.delete(id)
    const i = this.mru.indexOf(id)
    if (i !== -1) this.mru.splice(i, 1)
    this.mru.push(id)
    this.evictIfOverCap()
  }

  private evictIfOverCap(): void {
    if (this.mru.length <= this.cap) return
    for (let i = 0; i < this.mru.length; i++) {
      const id = this.mru[i]
      if (this.idleSince.has(id)) {
        this.mru.splice(i, 1)
        this.idleSince.delete(id)
        this.stop(id)
        return
      }
    }
    // ponytail: el tope es blando cuando todos tienen docs abiertos; uno duro
    // mataría un server en uso.
  }

  /** Se cerró el último doc de `id`: queda inactivo desde `now`. */
  release(id: number, now: number): void {
    if (this.mru.includes(id)) this.idleSince.set(id, now)
  }

  /** Para todo server inactivo hace más de `idleMs`. */
  sweep(now: number): void {
    for (const [id, since] of [...this.idleSince]) {
      if (now - since <= this.idleMs) continue
      this.idleSince.delete(id)
      const i = this.mru.indexOf(id)
      if (i !== -1) this.mru.splice(i, 1)
      this.stop(id)
    }
  }

  /** `id` ya no existe (el manager lo dio de baja): olvidarlo. */
  remove(id: number): void {
    this.idleSince.delete(id)
    const i = this.mru.indexOf(id)
    if (i !== -1) this.mru.splice(i, 1)
  }
}
