import { beforeAll } from 'vitest'

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
