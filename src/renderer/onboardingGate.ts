import type { OnboardingCliStatus } from '@shared/onboarding'

/** Fila local de CLI detectado (no importar de shared/onboarding). */
export type OnboardingCliRow = {
  provider: string
  label: string
  command: string
  installed: boolean
  version: string | null
}

/** Mapea el contrato IPC a la fila local (orden y nulls intactos). */
export function mapCliRows(statuses: OnboardingCliStatus[]): OnboardingCliRow[] {
  return statuses.map(status => ({
    provider: status.provider,
    label: status.label,
    command: status.command,
    installed: status.installed,
    version: status.version,
  }))
}

/** True solo si hay filas y ninguna está instalada. */
export function clisAllMissing(rows: OnboardingCliRow[]): boolean {
  return rows.length > 0 && rows.every(row => !row.installed)
}
