import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const cssFiles = [
  '../BrainstormOverlay.css',
  '../BrainstormRoomsView.css',
];

describe('brainstorm reduce-motion CSS', () => {
  test.each(cssFiles)('%s uses the app reduce-motion flag', (relativePath) => {
    const css = readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

    expect(css).toContain("[data-reduce-motion='true']");
    expect(css).not.toContain('prefers-reduced-motion');
  });
});
