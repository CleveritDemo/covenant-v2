import React from 'react'
import './JsonTree.css'

/** `undefined` si el texto no es un objeto/array JSON; los escalares no son árbol. */
export function parseJsonTree(text: string): unknown {
  try {
    const parsed: unknown = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? parsed : undefined
  } catch {
    return undefined
  }
}

function entriesOf(value: object): Array<[string, unknown]> {
  return Array.isArray(value)
    ? value.map((item, index) => [String(index), item])
    : Object.entries(value)
}

const JsonNode: React.FC<{ label: string; value: unknown }> = ({ label, value }) => {
  if (!value || typeof value !== 'object') {
    return (
      <div className="json-tree__leaf">
        <span className="json-tree__key">{label}</span>
        <span className={`json-tree__value json-tree__value--${value === null ? 'null' : typeof value}`}>
          {JSON.stringify(value)}
        </span>
      </div>
    )
  }

  const entries = entriesOf(value)
  return (
    // ponytail: <details> nativo — plegado, accesible y con teclado sin estado propio.
    // Todo cerrado al abrir: un package.json expandido es la lista que molesta.
    <details className="json-tree__node">
      <summary>
        <span className="json-tree__key">{label}</span>
        <span className="json-tree__brace">{Array.isArray(value) ? '[…]' : '{…}'}</span>
        <span className="json-tree__count">{entries.length}</span>
      </summary>
      <div className="json-tree__children">
        {entries.map(([key, item]) => (
          <JsonNode key={key} label={key} value={item} />
        ))}
      </div>
    </details>
  )
}

/** Explorador plegable para cuerpos JSON (package.json, .mcp.json, respuestas…). */
export const JsonTree: React.FC<{ value: unknown }> = ({ value }) => {
  if (!value || typeof value !== 'object') return null
  return (
    <div className="json-tree">
      {entriesOf(value).map(([key, item]) => (
        <JsonNode key={key} label={key} value={item} />
      ))}
    </div>
  )
}
