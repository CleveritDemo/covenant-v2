import { describe, expect, it } from 'vitest'
import { parseGitUnifiedDiff } from '../gitDiff'

const SAMPLE = `diff --git a/src/foo.ts b/src/foo.ts
index 1234567..89abcde 100644
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -10,6 +10,7 @@ export function foo() {
   const a = 1
-  const b = 2
+  const b = 3
+  const c = 4
   return a
 }
`

describe('parseGitUnifiedDiff', () => {
  it('numbers lines from the hunk header', () => {
    const diff = parseGitUnifiedDiff(SAMPLE)
    expect(diff.hunks).toHaveLength(1)
    expect(diff.hunks[0]?.header).toContain('@@ -10,6 +10,7 @@')
    expect(diff.hunks[0]?.lines.map(l => [l.kind, l.oldLine, l.newLine])).toEqual([
      ['context', 10, 10],
      ['del', 11, null],
      ['add', null, 11],
      ['add', null, 12],
      ['context', 12, 13],
      ['context', 13, 14],
    ])
  })

  it('counts insertions and deletions', () => {
    const diff = parseGitUnifiedDiff(SAMPLE)
    expect(diff.insertions).toBe(2)
    expect(diff.deletions).toBe(1)
  })

  it('ignores the preamble instead of rendering it as content', () => {
    const diff = parseGitUnifiedDiff(SAMPLE)
    const texts = diff.hunks[0]?.lines.map(l => l.text) ?? []
    expect(texts.some(t => t.startsWith('diff --git') || t.startsWith('index '))).toBe(false)
  })

  it('handles several hunks with their own counters', () => {
    const diff = parseGitUnifiedDiff(`@@ -1,2 +1,2 @@
-a
+b
@@ -100,2 +100,2 @@ context tail
-c
+d
`)
    expect(diff.hunks).toHaveLength(2)
    expect(diff.hunks[1]?.lines.map(l => l.oldLine ?? l.newLine)).toEqual([100, 100])
    expect(diff.hunks[1]?.header).toContain('context tail')
  })

  it('flags binary files and leaves no hunks', () => {
    const diff = parseGitUnifiedDiff(
      'diff --git a/img.png b/img.png\nBinary files a/img.png and b/img.png differ\n',
    )
    expect(diff.binary).toBe(true)
    expect(diff.hunks).toHaveLength(0)
  })

  it('keeps "no newline at end of file" as meta, out of the counters', () => {
    const diff = parseGitUnifiedDiff('@@ -1 +1 @@\n-a\n+b\n\\ No newline at end of file\n')
    const last = diff.hunks[0]?.lines.at(-1)
    expect(last?.kind).toBe('meta')
    expect(last?.text).toBe('No newline at end of file')
    expect(diff.insertions).toBe(1)
  })

  it('is empty for an empty diff', () => {
    expect(parseGitUnifiedDiff('')).toEqual({
      hunks: [],
      binary: false,
      insertions: 0,
      deletions: 0,
    })
  })
})
