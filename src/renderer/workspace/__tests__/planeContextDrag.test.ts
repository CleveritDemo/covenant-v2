import { describe, expect, it } from 'vitest'
import {
  PLANE_CONTEXT_DRAG_MIME,
  hasPlaneContextDrag,
  readPlaneContextDragData,
  setPlaneContextDragData,
} from '../planeContextDrag'

function mockDataTransfer(): DataTransfer {
  const store = new Map<string, string>()
  return {
    types: {
      [Symbol.iterator]: function* () {
        yield* store.keys()
      },
      length: 0,
      contains: (type: string) => store.has(type),
      item: (index: number) => [...store.keys()][index] ?? '',
    } as unknown as DOMStringList,
    get typesList() {
      return [...store.keys()]
    },
    getData: (format: string) => store.get(format) ?? '',
    setData: (format: string, data: string) => {
      store.set(format, data)
    },
    clearData: (format?: string) => {
      if (format) store.delete(format)
      else store.clear()
    },
    effectAllowed: 'uninitialized' as DataTransfer['effectAllowed'],
    dropEffect: 'none' as DataTransfer['dropEffect'],
    files: {} as FileList,
    items: {} as DataTransferItemList,
    setDragImage: () => undefined,
  } as unknown as DataTransfer & { types: DOMStringList }
}

describe('planeContextDrag', () => {
  it('sets, detects and reads the plane context MIME', () => {
    const raw = mockDataTransfer()
    // hasPlaneContextDrag itera dataTransfer.types — en mock usamos un array iterable.
    const dt = {
      ...raw,
      types: [] as string[],
      setData(format: string, data: string) {
        raw.setData(format, data)
        if (!this.types.includes(format)) this.types.push(format)
      },
      getData: (format: string) => raw.getData(format),
    } as unknown as DataTransfer

    expect(hasPlaneContextDrag(dt)).toBe(false)
    setPlaneContextDragData(dt, 'iaterminal:result:qa')
    // `copyMove` y no `copy`: la papelera del pool necesita el move (v0.32.0).
    expect(dt.effectAllowed).toBe('copyMove')
    expect(hasPlaneContextDrag(dt)).toBe(true)
    expect(Array.from(dt.types)).toContain(PLANE_CONTEXT_DRAG_MIME)
    expect(readPlaneContextDragData(dt)).toBe('iaterminal:result:qa')
  })
})
