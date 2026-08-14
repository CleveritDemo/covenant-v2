import { beforeAll } from 'vitest'

// Node >= 25 expone un `localStorage` global sin implementar (avisa por
// `--localstorage-file`) que tapa al de jsdom, y cualquier test que lo use
// revienta con "clear is not a function". CI va en Node 20 y no lo ve.
// ponytail: Storage sobre Map; si algún test necesita eventos `storage`, hay
// que instalar jsdom-global o subir a un vitest que ya no lo herede.
if (typeof window !== 'undefined' && typeof globalThis.localStorage?.clear !== 'function') {
  const store = new Map<string, string>()
  const storage: Storage = {
    get length() { return store.size },
    key: (index: number) => [...store.keys()][index] ?? null,
    getItem: (key: string) => store.get(String(key)) ?? null,
    setItem: (key: string, value: string) => { store.set(String(key), String(value)) },
    removeItem: (key: string) => { store.delete(String(key)) },
    clear: () => { store.clear() },
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage })
}

beforeAll(() => {
  if (typeof globalThis.PointerEvent === 'undefined' && typeof MouseEvent !== 'undefined') {
    globalThis.PointerEvent = class PointerEvent extends MouseEvent {
      readonly pointerId: number
      readonly pointerType: string
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params)
        this.pointerId = params.pointerId ?? 0
        this.pointerType = params.pointerType ?? 'mouse'
      }
    } as unknown as typeof PointerEvent
  }
  if (typeof HTMLElement !== 'undefined') {
    // jsdom no implementa scrollIntoView; los listbox lo usan al moverse con flechas.
    HTMLElement.prototype.scrollIntoView = function scrollIntoView() { /* no-op */ }
    HTMLElement.prototype.scrollTo = function scrollTo(this: HTMLElement, opts?: ScrollToOptions) {
      if (opts && typeof opts.top === 'number') {
        this.scrollTop = opts.top
      } else {
        this.scrollTop = this.scrollHeight
      }
    }
  }
})
