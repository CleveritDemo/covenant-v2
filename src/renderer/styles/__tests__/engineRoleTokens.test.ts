import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(fileURLToPath(new URL('../global.css', import.meta.url)), 'utf8');

const blockFor = (selector: string): string =>
  css.match(new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{[^}]+\\}`, 'm'))?.[0] ?? '';

const ROOT_TOKENS = [
  '--engine-primary-border',
  '--engine-primary-ring',
  '--engine-primary-surface',
  '--engine-primary-text',
  '--engine-fallback-border',
  '--engine-fallback-ring',
  '--engine-fallback-surface',
  '--engine-fallback-text',
] as const;

const LIGHT_TOKENS = [
  '--engine-primary-surface',
  '--engine-fallback-border',
  '--engine-fallback-ring',
  '--engine-fallback-surface',
  '--engine-fallback-text',
] as const;

describe('engine role CSS tokens', () => {
  it('declara los 8 tokens de rol en :root', () => {
    const root = blockFor(':root');
    expect(root).toBeTruthy();
    for (const token of ROOT_TOKENS) {
      expect(root).toContain(`${token}:`);
    }
  });

  it('sobrescribe superficie primaria y los 4 de respaldo en light', () => {
    const light = blockFor(":root[data-theme-appearance='light']");
    expect(light).toBeTruthy();
    for (const token of LIGHT_TOKENS) {
      expect(light).toContain(`${token}:`);
    }
  });

  it('toma borde primario y de respaldo del tema, no de hex sueltos', () => {
    const root = blockFor(':root');
    expect(root).toMatch(/--engine-primary-border:\s*var\(--accent-border-strong\)/);
    expect(root).toMatch(/--engine-fallback-border:[^;]*var\(--theme-cyan\)/);
  });
});
