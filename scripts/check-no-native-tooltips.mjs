#!/usr/bin/env node
/**
 * Falla si un elemento HTML del renderer usa `title=`: eso pinta el tooltip
 * gris del sistema, con su retardo y su tipografía, en vez de la burbuja de la
 * app (`components/ui/Tooltip`). Ver `.cursor/rules/frontend-components.mdc`.
 *
 * `title` sobre un componente propio (`<Foo title=…>`) suele ser una prop
 * normal (`ContextCheckOption` la usa de `aria-label`), así que no se toca —
 * salvo que el componente reparta `{...rest}` sobre un elemento del DOM, en
 * cuyo caso el `title` acaba siendo igual de nativo.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptsDir = path.dirname(fileURLToPath(import.meta.url))
const rendererDir = path.join(scriptsDir, '../src/renderer')
const uiDir = path.join(rendererDir, 'components/ui')

/** `title` legítimo: no genera tooltip nativo. */
const ALLOWED_TAGS = new Set(['svg', 'iframe', 'dialog'])

/** Componentes del UI kit que reenvían props sueltas al DOM. */
const FORWARDING = new Set(
  fs.readdirSync(uiDir)
    .filter(file => file.endsWith('.tsx'))
    .filter(file => /\{\.\.\.(rest|props)\}/.test(fs.readFileSync(path.join(uiDir, file), 'utf8')))
    .map(file => path.basename(file, '.tsx')),
)

function tsxFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return tsxFiles(full)
    return entry.name.endsWith('.tsx') ? [full] : []
  })
}

/**
 * Etiqueta que abre el atributo de `index`: el último `<Nombre` anterior.
 * Las props van una por línea bajo su etiqueta, así que basta con mirar atrás.
 */
function owningTag(text, index) {
  const before = text.slice(0, index)
  const opens = [...before.matchAll(/<([A-Za-z][\w.]*)/g)]
  return opens.length ? opens[opens.length - 1][1] : null
}

const violations = []
for (const file of tsxFiles(rendererDir)) {
  const text = fs.readFileSync(file, 'utf8')
  for (const match of text.matchAll(/(?<=[\s{])title=/g)) {
    const tag = owningTag(text, match.index)
    if (!tag) continue
    // Mayúscula inicial = componente propio: solo importa si reenvía al DOM.
    const isDomElement = tag[0] === tag[0].toLowerCase()
    if (!isDomElement && !FORWARDING.has(tag)) continue
    if (isDomElement && ALLOWED_TAGS.has(tag)) continue
    const line = text.slice(0, match.index).split('\n').length
    violations.push(`${path.relative(process.cwd(), file)}:${line}: <${tag} title=…> → usa <Tooltip>`)
  }
}

if (violations.length) {
  console.error(
    'Tooltips nativos (usa components/ui/Tooltip):\n'
    + violations.map(v => `  - ${v}`).join('\n'),
  )
  process.exit(1)
}
console.log('Sin tooltips nativos en el renderer')
