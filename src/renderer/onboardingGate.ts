import { ONBOARDING_VERSION, type OnboardingCliStatus } from '@shared/onboarding'
import type { OnboardingCliRow } from './components/onboarding/onboardingTypes'

/** True solo cuando la sesión/config están listas y el flag no coincide con la versión actual. */
export function shouldOpenOnboarding(completedVersion: string, ready: boolean): boolean {
  return ready && completedVersion.trim() !== ONBOARDING_VERSION
}

/** Mapea el contrato IPC a la fila local del wizard (orden y nulls intactos). */
export function mapCliRows(statuses: OnboardingCliStatus[]): OnboardingCliRow[] {
  return statuses.map(status => ({
    provider: status.provider,
    label: status.label,
    command: status.command,
    installed: status.installed,
    version: status.version,
  }))
}
