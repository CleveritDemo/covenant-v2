import React, { useState } from 'react'
import { Button } from './ui/Button'
import { Select } from './ui/Select'
import { Spinner } from './ui/Spinner'

/** Estado de carga / error compartido por los paneles de Organizations. */
export function SectionStatus({
  loading,
  error,
  loadingLabel,
  skeleton,
}: {
  loading: boolean
  error: string | null
  loadingLabel: string
  skeleton?: React.ReactNode
}): React.ReactElement | null {
  if (loading) {
    if (skeleton) {
      return <>{skeleton}</>
    }
    return (
      <p className="orgs-section-status" role="status" aria-live="polite">
        <Spinner aria-label={loadingLabel} />
        <span>{loadingLabel}</span>
      </p>
    )
  }
  if (error) {
    return (
      <p className="orgs-section-error" role="alert">
        {error}
      </p>
    )
  }
  return null
}

/** Selector de login + botón de añadir; el estado del combo es local. */
export function MemberPickRow({
  options,
  busy,
  selectLabel,
  addLabel,
  onAdd,
}: {
  options: string[]
  busy: boolean
  selectLabel: string
  addLabel: string
  onAdd: (login: string) => void
}): React.ReactElement {
  const [login, setLogin] = useState('')
  const selected = options.includes(login) ? login : (options[0] ?? '')
  const canAdd = !busy && !!selected && options.length > 0

  return (
    <div className="orgs-pick-row">
      <div className="orgs-pick-row__grow">
        <Select
          size="sm"
          value={selected}
          disabled={busy || options.length === 0}
          onChange={setLogin}
          aria-label={selectLabel}
          placeholder={selectLabel}
          options={options.map(opt => ({ value: opt, label: opt }))}
        />
      </div>
      <Button
        variant="secondary"
        size="sm"
        disabled={!canAdd}
        onClick={() => {
          if (!selected) return
          onAdd(selected)
        }}
      >
        {addLabel}
      </Button>
    </div>
  )
}
