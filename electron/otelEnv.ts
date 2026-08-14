import type { AppConfig } from '../src/shared/configSchema'

/**
 * Construye las variables de entorno OTEL a inyectar en los spawns de agente CLI.
 *
 * Reglas:
 * - Devuelve `{}` si el endpoint está vacío o `otelEnabled` es false.
 * - Solo incluye claves con valor no vacío: así `{ ...process.env, ...otelEnvFromConfig(cfg) }`
 *   no sobreescribe variables del shell del usuario cuando el campo de config está vacío.
 */
export function otelEnvFromConfig(config: AppConfig): Record<string, string> {
  if (!config.otelEnabled || !config.otelEndpoint) return {}

  const env: Record<string, string> = {
    CLAUDE_CODE_ENABLE_TELEMETRY: '1',
    OTEL_EXPORTER_OTLP_ENDPOINT: config.otelEndpoint,
    OTEL_EXPORTER_OTLP_PROTOCOL: config.otelProtocol || 'http/protobuf',
  }

  if (config.otelHeaders) {
    env.OTEL_EXPORTER_OTLP_HEADERS = config.otelHeaders
  }

  if (config.otelLogPrompts) {
    env.OTEL_LOG_USER_PROMPTS = 'true'
    env.OTEL_LOG_ASSISTANT_RESPONSES = 'true'
  }

  if (config.otelLogToolIO) {
    env.OTEL_LOG_TOOL_DETAILS = 'true'
    env.OTEL_LOG_TOOL_CONTENT = 'true'
  }

  return env
}
