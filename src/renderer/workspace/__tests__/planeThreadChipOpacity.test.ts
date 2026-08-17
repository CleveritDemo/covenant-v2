import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(fileURLToPath(new URL('../PlaneChatContextsBar.css', import.meta.url)), 'utf8');

const blockFor = (selector: string): string =>
  css.match(new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{[^}]+\\}`, 'm'))?.[0] ?? '';

describe('plane thread chip opacity CSS', () => {
  it('declara el host activo despues del host base para que conserve su acento', () => {
    expect(css.indexOf('.plane-chat-contexts-bar__chip-host--active {')).toBeGreaterThan(
      css.indexOf('.plane-chat-contexts-bar__chip-host {'),
    );
  });

  it('usa vidrio fuerte en el fondo base de chips no activos', () => {
    const chipBlock = blockFor('.plane-chat-contexts-bar__chip');
    const backgroundLine = chipBlock
      .split('\n')
      .find((line) => line.trim().startsWith('background:')) ?? '';

    expect(chipBlock).toContain('background: var(--plane-glass-strong);');
    expect(backgroundLine).not.toContain('%, transparent)');
  });

  it('resetea el chip del host con descendiente, no hijo directo, para sobrevivir al Tooltip', () => {
    expect(css).not.toContain('__chip-host > .plane-chat-contexts-bar__chip');
    expect(css).toContain('__chip-host .plane-chat-contexts-bar__chip {');
  });
});
