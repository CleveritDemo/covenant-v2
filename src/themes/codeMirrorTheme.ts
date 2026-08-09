import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import type { Extension } from '@codemirror/state'
import type { AppTheme } from './presets'

export function createCodeMirrorTheme(theme: AppTheme): Extension {
  const x = theme.xterm
  const muted = theme.vars['--text-muted'] ?? x.brightBlack
  const bg = theme.vars['--bg'] ?? x.background
  const fg = theme.vars['--text'] ?? x.foreground
  const surface = theme.vars['--surface'] ?? bg

  const highlightStyle = HighlightStyle.define([
    { tag: tags.keyword, color: x.blue },
    { tag: tags.controlKeyword, color: x.magenta },
    { tag: tags.operator, color: x.foreground },
    { tag: tags.definition(tags.variableName), color: x.cyan },
    { tag: tags.variableName, color: fg },
    { tag: tags.propertyName, color: x.cyan },
    { tag: tags.function(tags.variableName), color: x.cyan },
    { tag: tags.typeName, color: x.yellow },
    { tag: tags.className, color: x.yellow },
    { tag: tags.namespace, color: x.blue },
    { tag: tags.string, color: x.green },
    { tag: tags.special(tags.string), color: x.green },
    { tag: tags.number, color: x.yellow },
    { tag: tags.bool, color: x.magenta },
    { tag: tags.null, color: x.magenta },
    { tag: tags.comment, color: muted, fontStyle: 'italic' },
    { tag: tags.meta, color: muted },
    { tag: tags.regexp, color: x.red },
    { tag: tags.link, color: x.blue, textDecoration: 'underline' },
    { tag: tags.heading, color: x.blue, fontWeight: 'bold' },
    { tag: tags.strong, fontWeight: 'bold' },
    { tag: tags.emphasis, fontStyle: 'italic' },
    { tag: tags.strikethrough, textDecoration: 'line-through' },
    { tag: tags.invalid, color: x.red },
  ])

  return [
    EditorView.theme({
      '&': {
        height: '100%',
        backgroundColor: bg,
        color: fg,
      },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: 'var(--font-mono)',
        lineHeight: '1.45',
      },
      '.cm-content': {
        padding: '8px 0',
        caretColor: x.cursor,
      },
      '.cm-gutters': {
        backgroundColor: colorMix(surface, 0.5),
        color: muted,
        border: 'none',
        paddingRight: '4px',
      },
      '.cm-activeLineGutter': {
        backgroundColor: colorMix(surface, 0.8),
      },
      '.cm-activeLine': {
        backgroundColor: colorMix(surface, 0.35),
      },
      '&.cm-focused .cm-cursor': {
        borderLeftColor: x.cursor,
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
        backgroundColor: x.selectionBackground,
      },
      '.cm-matchingBracket': {
        backgroundColor: colorMix(x.cyan, 0.2),
        outline: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)',
      },
      '.cm-searchMatch': {
        backgroundColor: colorMix(x.yellow, 0.35),
        outline: `1px solid ${colorMix(x.yellow, 0.55)}`,
      },
      '.cm-searchMatch-selected': {
        backgroundColor: colorMix(x.yellow, 0.55),
        outline: `1px solid ${colorMix(x.yellow, 0.75)}`,
      },
      '.cm-selectionMatch': {
        backgroundColor: colorMix(x.cyan, 0.18),
      },
      // Plegado: el gutter nativo de cm6 con los triángulos del tema.
      '.cm-foldGutter span': {
        color: muted,
        padding: '0 2px',
        cursor: 'pointer',
      },
      '.cm-foldGutter span:hover': {
        color: fg,
      },
      '.cm-foldPlaceholder': {
        backgroundColor: colorMix(surface, 0.9),
        border: `1px solid ${colorMix(fg, 0.25)}`,
        borderRadius: '3px',
        color: muted,
        margin: '0 2px',
        padding: '0 4px',
      },
      // Panel de búsqueda/reemplazo nativo.
      '.cm-panels': {
        backgroundColor: colorMix(surface, 0.92),
        color: fg,
        fontFamily: 'var(--font-ui)',
        fontSize: '11px',
      },
      '.cm-panels.cm-panels-top': {
        borderBottom: `1px solid ${colorMix(fg, 0.18)}`,
      },
      '.cm-panel.cm-search': {
        padding: '6px 8px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '6px',
      },
      '.cm-panel.cm-search label': {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        fontSize: '11px',
        color: muted,
      },
      '.cm-panel.cm-search input[type=text]': {
        backgroundColor: bg,
        color: fg,
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        padding: '3px 6px',
        border: `1px solid ${colorMix(fg, 0.22)}`,
        borderRadius: '4px',
        outline: 'none',
      },
      '.cm-panel.cm-search input[type=text]:focus': {
        borderColor: colorMix(x.cyan, 0.7),
      },
      '.cm-panel.cm-search button:not([name=close])': {
        backgroundColor: colorMix(fg, 0.08),
        backgroundImage: 'none',
        color: fg,
        fontFamily: 'var(--font-ui)',
        fontSize: '11px',
        padding: '3px 8px',
        border: `1px solid ${colorMix(fg, 0.18)}`,
        borderRadius: '4px',
        cursor: 'pointer',
      },
      '.cm-panel.cm-search button:not([name=close]):hover': {
        backgroundColor: colorMix(x.cyan, 0.2),
      },
      '.cm-panel.cm-search button[name=close]': {
        color: muted,
        fontSize: '15px',
        padding: '0 6px',
        cursor: 'pointer',
      },
    }, { dark: theme.appearance !== 'light' }),
    syntaxHighlighting(highlightStyle),
  ]
}

function colorMix(color: string, alpha: number): string {
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`
}
