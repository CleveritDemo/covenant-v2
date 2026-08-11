# Update Banner Status Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the titlebar update chip to personality C (status badges + functional motion) and add a Developer settings preview that cycles fake states without touching the real updater.

**Architecture:** Pure step generator in `src/shared/` drives a thin renderer preview bus (`updateBannerPreview.ts`). `UpdateBanner` merges override over IPC state, paints stage badges, and no-ops install/dismiss while previewing. Settings Developer closes the modal then starts the preview.

**Tech Stack:** React renderer, CSS colocated, Vitest, i18n en/es.

## Global Constraints

- No IPC / `electron/selfUpdate.ts` changes.
- No modal-de-novedades redesign.
- Preview is renderer-only; install/dismiss during preview must not call destructive IPC.
- UI kit: no new `className`/`style`/`title` on kit components.
- Both `en` and `es` locales updated together.
- Honor `prefers-reduced-motion: reduce`.

---

### Task 1: Pure preview timeline (shared + tests)

**Files:**
- Create: `src/shared/updateBannerPreview.ts`
- Create: `src/shared/__tests__/updateBannerPreview.test.ts`

**Interfaces:**
- Produces:
  - `UPDATE_BANNER_PREVIEW_VERSION = '0.0.0-preview'`
  - `export type UpdateBannerPreviewStep = { atMs: number; state: UpdateState | null }`
  - `export function buildUpdateBannerPreviewTimeline(opts?: { stageMs?: number; downloadTicks?: number }): UpdateBannerPreviewStep[]`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  UPDATE_BANNER_PREVIEW_VERSION,
  buildUpdateBannerPreviewTimeline,
} from '../updateBannerPreview'

describe('buildUpdateBannerPreviewTimeline', () => {
  it('walks available → downloading ticks → ready → clear', () => {
    const steps = buildUpdateBannerPreviewTimeline({ stageMs: 2000, downloadTicks: 4 })
    expect(steps[0]).toEqual({
      atMs: 0,
      state: { kind: 'available', version: UPDATE_BANNER_PREVIEW_VERSION, notes: null },
    })
    const downloading = steps.filter(s => s.state?.kind === 'downloading')
    expect(downloading).toHaveLength(4)
    expect(downloading[0]!.state).toMatchObject({ percent: 0 })
    expect(downloading.at(-1)!.state).toMatchObject({ percent: 100 })
    expect(steps.some(s => s.state?.kind === 'ready')).toBe(true)
    expect(steps.at(-1)).toEqual({ atMs: expect.any(Number), state: null })
    expect(steps.at(-1)!.atMs).toBeGreaterThan(steps.at(-2)!.atMs)
  })

  it('keeps atMs strictly non-decreasing', () => {
    const steps = buildUpdateBannerPreviewTimeline()
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]!.atMs).toBeGreaterThanOrEqual(steps[i - 1]!.atMs)
    }
  })
})
```

- [ ] **Step 2: Run test — expect FAIL (module missing)**

Run: `npx vitest run src/shared/__tests__/updateBannerPreview.test.ts`

- [ ] **Step 3: Implement timeline**

```ts
import type { UpdateState } from './updateState'

export const UPDATE_BANNER_PREVIEW_VERSION = '0.0.0-preview'

export type UpdateBannerPreviewStep = { atMs: number; state: UpdateState | null }

export function buildUpdateBannerPreviewTimeline(opts?: {
  stageMs?: number
  downloadTicks?: number
}): UpdateBannerPreviewStep[] {
  const stageMs = opts?.stageMs ?? 2000
  const downloadTicks = Math.max(2, opts?.downloadTicks ?? 5)
  const version = UPDATE_BANNER_PREVIEW_VERSION
  const steps: UpdateBannerPreviewStep[] = [
    { atMs: 0, state: { kind: 'available', version, notes: null } },
  ]
  let t = stageMs
  for (let i = 0; i < downloadTicks; i++) {
    const percent = Math.round((i / (downloadTicks - 1)) * 100)
    steps.push({ atMs: t, state: { kind: 'downloading', version, percent } })
    t += Math.round(stageMs / downloadTicks)
  }
  steps.push({ atMs: t, state: { kind: 'ready', version, notes: null } })
  t += stageMs
  steps.push({ atMs: t, state: null })
  return steps
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit** `test: update banner preview timeline`

---

### Task 2: Renderer preview bus

**Files:**
- Create: `src/renderer/updateBannerPreview.ts`

**Interfaces:**
- Consumes: `buildUpdateBannerPreviewTimeline` from `@shared/updateBannerPreview`
- Produces:
  - `getUpdateBannerPreviewState(): UpdateState | null`
  - `subscribeUpdateBannerPreview(listener: () => void): () => void`
  - `isUpdateBannerPreviewActive(): boolean`
  - `clearUpdateBannerPreview(): void`
  - `previewUpdateBanner(): void` — cancels prior run, schedules timeline via `setTimeout`

- [ ] Implement module with generation counter so stale timeouts no-op after clear/restart.
- [ ] Commit `feat: renderer bus for update banner preview`

---

### Task 3: UpdateBanner visual + preview merge

**Files:**
- Modify: `src/renderer/components/UpdateBanner.tsx`
- Modify: `src/renderer/components/UpdateBanner.css`
- Modify: `src/i18n/locales/en.ts` + `es.ts` (`update.stageAvailable|Downloading|Ready`)

**Behavior:**
- Subscribe to preview bus; `displayState = preview ?? ipcState`.
- Stage badge for available/downloading/ready.
- Enter animation class on chip; opacity pulse (not box-shadow).
- If preview active: Install/Restart → `clearUpdateBannerPreview()`; Dismiss → same; no `installUpdate`/`dismissUpdate` IPC.

- [ ] Implement + `npm run check:ui`
- [ ] Commit `feat: status-style update chip with preview override`

---

### Task 4: Developer settings field

**Files:**
- Modify: `src/renderer/components/SettingsModal.tsx`
- Modify: `src/i18n/locales/en.ts` + `es.ts` (`settings.updateBannerPreview*`)
- Update SETTINGS_INDEX termKeys for developer

**Behavior:**
- New SettingsField under quit confirmation.
- onClick: `onClose(); previewUpdateBanner()`

- [ ] Implement
- [ ] Run: `npx vitest run src/shared/__tests__/updateBannerPreview.test.ts` + `npm run check:ui`
- [ ] Commit `feat: developer preview for update banner chip`
