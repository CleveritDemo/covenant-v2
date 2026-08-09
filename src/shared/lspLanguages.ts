/**
 * Extensión de archivo → lenguaje del manifiesto LSP.
 * Vive en `shared` porque lo necesitan el main (para resolver el server que hay
 * que arrancar) y el renderer (para saber si un archivo tiene soporte antes de
 * pedir nada por IPC). `null` = archivo sin soporte.
 */
export function lspLanguageId(path: string): string | null {
  if (/\.rs$/i.test(path)) return 'rust'
  if (/\.cs$/i.test(path)) return 'csharp'
  if (/\.java$/i.test(path)) return 'java'
  // typescript-language-server también maneja JS puro (incl. JSX y variantes de
  // módulo), así que todas estas apuntan al server "typescript".
  if (/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i.test(path)) return 'typescript'
  return null
}
