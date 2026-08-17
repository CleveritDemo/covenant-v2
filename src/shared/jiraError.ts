/** Frase en español para un fallo HTTP de Jira. Claves de `headers` ya en minúscula. */

export function describeJiraFailure(
  status: number,
  detail: string,
  headers: Record<string, string>,
): string {
  let message: string
  if (status === 401) {
    message =
      'Jira 401 · credencial rechazada. Revisa el email de la cuenta y genera un API token nuevo en id.atlassian.com.'
  } else if (status === 403) {
    message =
      'Jira 403 · la credencial se aceptó pero el acceso está denegado. Causas típicas: el API token tiene scopes y no cubre este endpoint, la cuenta no tiene acceso al producto Jira en este sitio, o el sitio tiene allowlist de IP.'
  } else if (status === 404) {
    message = 'Jira 404 · el sitio o la issue no existe, o no es visible para esta cuenta.'
  } else if (status === 429) {
    message = 'Jira 429 · demasiadas peticiones.'
    const retryAfter = headers['retry-after']
    if (retryAfter) message += ` Reintenta en ${retryAfter} s.`
  } else if (status >= 500) {
    message = `Jira ${status} · el sitio de Atlassian falló.`
  } else {
    message = `Jira ${status}`
  }

  const denied = headers['x-authentication-denied-reason']
  if (denied) message += ` Motivo de Atlassian: ${denied}.`

  const seraph = headers['x-seraph-loginreason']
  if (seraph && seraph !== 'OK') message += ` X-Seraph-LoginReason: ${seraph}.`

  if (detail) message += ` Detalle: ${detail}`

  return message
}
