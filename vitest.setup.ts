import { beforeAll } from 'vitest'

beforeAll(() => {
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
