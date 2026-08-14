# Telemetría OTEL: configuración de primera clase para CLIs agente

Fecha: 2026-08-14

Issue: [#2](https://github.com/CleveritDemo/covenant-v2/issues/2)

## Problema

Los CLIs agente (Claude Code, Copilot, Gemini) soportan OpenTelemetry, pero configurarlo requiere
exportar variables de entorno en el shell profile de cada desarrollador (`~/.zshrc`,
`~/.bash_profile`). Eso trae tres problemas:

- **No es de equipo.** Cada persona configura sus propias variables. Si alguien no las pone, su
  sesión no exporta traces. No hay visibilidad central de quién tiene la telemetría activa.
- **No es visible.** No existe superficie en la UI para saber si la telemetría está configurada, qué
  endpoint recibe los datos, ni qué nivel de privacidad se eligió.
- **No es seguro.** Los headers OTLP (tokens de autenticación) quedan en texto plano en archivos de
  shell. `safeStorage` ya existe para esto — el patrón de `SECRET_FIELDS`
  (`electron/main.ts:339`) cifra campos en disco sin exponer el valor.

`applyLoginShellPath()` (`electron/shellPathEnv.ts:155`) ya muta `process.env` al arranque con los
valores del shell profile. Pero eso es accidental: lo que carga el PATH arrastra las OTEL vars de
quien las tenga puestas. No es configuración, es efecto secundario.

## Objetivo

Que la telemetría OTEL sea un campo más de Settings:

1. Seis campos nuevos en `AppConfig`: endpoint, protocolo, habilitado, headers, log de prompts, log
   de tool I/O.
2. Categoría **Telemetry** en el `SettingsModal` con controles para cada campo y advertencias de
   privacidad.
3. Helper puro `otelEnvFromConfig()` que traduce la config a un `Record<string, string>` de
   variables de entorno OTEL.
4. Inyección por spawn: `{ ...process.env, ...otelEnvFromConfig(config) }` en los dos sitios donde
   se lanza un CLI agente (`agentCliRuntime.ts`).

**La prueba de que el diseño está bien:** ningún archivo fuera de los listados abajo cambia. Si
hubo que tocar el pipeline de contextos o el turnRunner, nos salimos del carril.

## No objetivos

- **Mutación de `process.env`.** La inyección es por spawn, no global. Los cambios aplican en el
  siguiente turno sin reiniciar la app.
- **Validación de endpoint en tiempo real** (probe HTTP). Si el endpoint está mal, el CLI lo
  descubre y el usuario lo ve en el trace.
- **Exportadores por señal** (traces vs. metrics vs. logs separados). Un endpoint gobierna todo.
  Si alguien necesita separar, usa variables de shell.
- **Campo de env vars libre.** Demasiado riesgo de inyección; cada variable tiene su control
  explícito.
- **Toggle de beta/enhanced telemetry.** El toggle de Gravity es `otelEnabled`; las features
  internas de cada CLI se manejan por sus propios flags.
- **Exportar Pulse a OTLP.** Eso es otro feature; aquí se configura la telemetría del CLI, no la
  de la app.

## Arquitectura

### Variables de entorno de Claude Code

Verificadas contra la documentación oficial
(`https://code.claude.com/docs/en/monitoring-usage`):

| Variable | Qué controla |
|---|---|
| `CLAUDE_CODE_ENABLE_TELEMETRY` | Habilita la exportación OTLP |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Endpoint del collector |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `http/protobuf` o `grpc` |
| `OTEL_EXPORTER_OTLP_HEADERS` | Headers de auth (key=value,...) |
| `OTEL_LOG_USER_PROMPTS` | Incluir prompts del usuario en spans |
| `OTEL_LOG_ASSISTANT_RESPONSES` | Incluir respuestas del asistente |
| `OTEL_LOG_TOOL_DETAILS` | Incluir nombres y parámetros de tools |
| `OTEL_LOG_TOOL_CONTENT` | Incluir contenido de entrada/salida de tools |

### Decisión: inyección por spawn, no mutación global

Dos enfoques evaluados:

- **(A) Mutar `process.env` al guardar.** Simple, pero contaminante: afecta todo el proceso
  Electron, no solo los CLIs. Y cambiar un campo requiere que la mutación se rehaga — fragilidad
  innecesaria.
- **(B) Inyección per-spawn.** `otelEnvFromConfig()` es puro, testeable, sin efectos secundarios.
  El spread `{ ...process.env, ...otelEnvFromConfig(config) }` deja las variables de shell intactas
  cuando la config no las sobreescribe.

Se eligió **(B)**.

### Semántica de merge con variables de shell

Cuando la config de UI está activa (endpoint no vacío + toggle habilitado), sus valores ganan sobre
`process.env` por posición en el spread. Pero:

- Si `otelHeaders` está vacío en la UI, la clave **no se emite** → el valor de shell sobrevive.
- Si `otelEnabled` es false **o** `otelEndpoint` es vacío, `otelEnvFromConfig()` devuelve `{}`
  → el spread no toca nada y **todas las variables de shell sobreviven**.

Esto es intencional: la UI controla solo lo que ella configura. Un desarrollador que puso OTEL en su
shell no pierde la telemetría porque otro cambió un toggle.

### Headers cifrados

`otelHeaders` se agrega a `SECRET_FIELDS` (`electron/main.ts:339`). El patrón ya existe: la app
cifra el valor con `safeStorage.encryptString()` al guardar y lo descifra al leer. En la UI se
muestra como input `type="password"`.

## Piezas nuevas

| Archivo | Responsabilidad | ~líneas |
|---|---|---|
| `electron/otelEnv.ts` | Puro: `otelEnvFromConfig(config) → Record<string, string>` | 40 |
| `electron/__tests__/otelEnv.test.ts` | 20 tests del helper | 200 |

## Cambios en lo existente

| Archivo | Qué cambia |
|---|---|
| `src/shared/configSchema.ts` | `OtelProtocol` type, 6 campos en `AppConfig`, defaults en `CONFIG_DEFAULTS`, validación en `validateConfig()` |
| `electron/agentCliRuntime.ts` | Import + `env: { ...process.env, ...otelEnvFromConfig(config) }` en las dos llamadas a spawn (~L1010, ~L1173) |
| `electron/main.ts` | `'otelHeaders'` en `SECRET_FIELDS` |
| `src/renderer/components/SettingsModal.tsx` | Categoría `telemetry` (primera posición), `SEARCH_INDEX`, form state, `buildConfig()`, discard handler, render de la sección |
| `src/i18n/locales/en.ts` | 21 claves de telemetría |
| `src/i18n/locales/es.ts` | 21 claves de telemetría (español) |

## Interfaz

Categoría **Telemetry** en el SettingsModal, con icono `chart`:

- **Endpoint** — `Input` de texto. Control primario: si está vacío, el toggle se deshabilita.
- **Protocol** — `Select` con dos opciones: HTTP/Protobuf (default), gRPC.
- **Headers** — `Input` tipo `password`. Se cifra en disco vía `SECRET_FIELDS`.
- **Enable telemetry** — `SettingToggle`. Deshabilitado visualmente cuando no hay endpoint.
- **Log prompts** — `SettingToggle` + advertencia de privacidad inline (⚠).
- **Log tool I/O** — `SettingToggle` + advertencia de privacidad inline (⚠).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Endpoint mal puesto → silencio en traces | `validateConfig()` rechaza URLs que no parsean o usan protocolos distintos a `http`/`https`. Pero no hace probe: si el collector está caído, el CLI lo reporta. |
| Headers en texto plano en disco | `SECRET_FIELDS` + `safeStorage`. El valor nunca aparece en logs ni en el config JSON sin cifrar. |
| Toggle de privacidad activado por accidente | Advertencia inline en cada toggle: el texto explica qué datos se envían. |
| Variables de shell sobreescritas sin querer | `otelEnvFromConfig()` devuelve `{}` cuando está deshabilitado. Campos vacíos no emiten la clave. |

## Escenarios (Gherkin)

```gherkin
Feature: OTEL telemetry config for agent CLI spawns
  As a team lead using Gravity
  I want to configure OTEL telemetry from the Settings UI
  So my agent CLI processes export traces without per-developer shell setup

  Background:
    Given a fresh AppConfig with CONFIG_DEFAULTS

  # --- otelEnvFromConfig: the core env builder ---

  Scenario: No env vars emitted when endpoint is empty
    Given otelEndpoint is ""
    And otelEnabled is true
    When otelEnvFromConfig is called
    Then the result is an empty record

  Scenario: Endpoint set and enabled produces OTEL env vars
    Given otelEndpoint is "https://otel.example.com:4318"
    And otelProtocol is "http/protobuf"
    And otelEnabled is true
    When otelEnvFromConfig is called
    Then the result contains OTEL_EXPORTER_OTLP_ENDPOINT = "https://otel.example.com:4318"
    And the result contains OTEL_EXPORTER_OTLP_PROTOCOL = "http/protobuf"
    And the result contains CLAUDE_CODE_ENABLE_TELEMETRY = "1"

  Scenario: Disabled toggle suppresses all OTEL vars even with endpoint
    Given otelEndpoint is "https://otel.example.com:4318"
    And otelEnabled is false
    When otelEnvFromConfig is called
    Then the result is an empty record

  Scenario: Headers included when non-empty
    Given otelEndpoint is "https://otel.example.com:4318"
    And otelEnabled is true
    And otelHeaders is "Authorization=Bearer tok123"
    When otelEnvFromConfig is called
    Then the result contains OTEL_EXPORTER_OTLP_HEADERS = "Authorization=Bearer tok123"

  Scenario: Empty headers field does not override shell-profile value
    Given otelEndpoint is "https://otel.example.com:4318"
    And otelEnabled is true
    And otelHeaders is ""
    When otelEnvFromConfig is called
    Then the result does not contain key OTEL_EXPORTER_OTLP_HEADERS

  Scenario: Log-prompts privacy toggle
    Given otelEndpoint is "https://otel.example.com:4318"
    And otelEnabled is true
    And otelLogPrompts is true
    When otelEnvFromConfig is called
    Then the result contains OTEL_LOG_USER_PROMPTS = "true"
    And the result contains OTEL_LOG_ASSISTANT_RESPONSES = "true"

  Scenario: Log-prompts off does not emit the var
    Given otelEndpoint is "https://otel.example.com:4318"
    And otelEnabled is true
    And otelLogPrompts is false
    When otelEnvFromConfig is called
    Then the result does not contain key OTEL_LOG_USER_PROMPTS
    And the result does not contain key OTEL_LOG_ASSISTANT_RESPONSES

  Scenario: Log-tool-IO privacy toggle
    Given otelEndpoint is "https://otel.example.com:4318"
    And otelEnabled is true
    And otelLogToolIO is true
    When otelEnvFromConfig is called
    Then the result contains OTEL_LOG_TOOL_DETAILS = "true"
    And the result contains OTEL_LOG_TOOL_CONTENT = "true"

  Scenario: Protocol defaults to http/protobuf
    Given otelEndpoint is "https://otel.example.com:4318"
    And otelEnabled is true
    And otelProtocol is "http/protobuf"
    When otelEnvFromConfig is called
    Then the result contains OTEL_EXPORTER_OTLP_PROTOCOL = "http/protobuf"

  Scenario: gRPC protocol option
    Given otelEndpoint is "https://otel.example.com:4317"
    And otelEnabled is true
    And otelProtocol is "grpc"
    When otelEnvFromConfig is called
    Then the result contains OTEL_EXPORTER_OTLP_PROTOCOL = "grpc"

  # --- Config schema ---

  Scenario: mergeWithDefaults fills otel fields from CONFIG_DEFAULTS
    Given a partial config with no otel fields
    When mergeWithDefaults is called
    Then the result has otelEndpoint = ""
    And the result has otelProtocol = "http/protobuf"
    And the result has otelEnabled = false
    And the result has otelHeaders = ""
    And the result has otelLogPrompts = false
    And the result has otelLogToolIO = false

  Scenario: validateConfig accepts valid otel config
    Given a config with otelEndpoint = "https://otel.example.com:4318"
    And otelProtocol = "http/protobuf"
    When validateConfig is called
    Then there are no validation errors for otel fields

  Scenario: validateConfig rejects invalid otelProtocol
    Given a config with otelProtocol = "websocket"
    When validateConfig is called
    Then there is a validation error mentioning otelProtocol

  Scenario: validateConfig accepts empty endpoint (disabled)
    Given a config with otelEndpoint = ""
    When validateConfig is called
    Then there are no validation errors for otel fields

  Scenario: validateConfig rejects malformed endpoint URL
    Given a config with otelEndpoint = "not a url"
    When validateConfig is called
    Then there is a validation error mentioning otelEndpoint

  Scenario: validateConfig rejects non-http endpoint protocol
    Given a config with otelEndpoint = "ftp://otel.example.com:4318"
    When validateConfig is called
    Then there is a validation error mentioning otelEndpoint

  # --- Spawn-site injection ---

  Scenario: Spawn env merges otel vars over process.env
    Given process.env has no OTEL vars
    And config has otelEndpoint = "https://otel.example.com:4318" and otelEnabled = true
    When the spawn env is built as { ...process.env, ...otelEnvFromConfig(config) }
    Then the spawn env contains OTEL_EXPORTER_OTLP_ENDPOINT = "https://otel.example.com:4318"
    And the spawn env contains CLAUDE_CODE_ENABLE_TELEMETRY = "1"

  Scenario: Config values override shell-profile OTEL vars
    Given process.env has OTEL_EXPORTER_OTLP_ENDPOINT = "https://old.example.com"
    And config has otelEndpoint = "https://new.example.com" and otelEnabled = true
    When the spawn env is built as { ...process.env, ...otelEnvFromConfig(config) }
    Then the spawn env contains OTEL_EXPORTER_OTLP_ENDPOINT = "https://new.example.com"

  Scenario: Shell-profile OTEL_EXPORTER_OTLP_HEADERS preserved when config headers empty
    Given process.env has OTEL_EXPORTER_OTLP_HEADERS = "Authorization=Bearer shelltoken"
    And config has otelEndpoint = "https://otel.example.com:4318" and otelEnabled = true
    And config has otelHeaders = ""
    When the spawn env is built as { ...process.env, ...otelEnvFromConfig(config) }
    Then the spawn env contains OTEL_EXPORTER_OTLP_HEADERS = "Authorization=Bearer shelltoken"

  Scenario: Shell-profile OTEL vars survive when config is disabled
    Given process.env has OTEL_EXPORTER_OTLP_ENDPOINT = "https://shell.example.com"
    And process.env has CLAUDE_CODE_ENABLE_TELEMETRY = "1"
    And config has otelEndpoint = "" and otelEnabled = false
    When the spawn env is built as { ...process.env, ...otelEnvFromConfig(config) }
    Then the spawn env contains OTEL_EXPORTER_OTLP_ENDPOINT = "https://shell.example.com"
    And the spawn env contains CLAUDE_CODE_ENABLE_TELEMETRY = "1"

  # --- SECRET_FIELDS encryption ---

  Scenario: otelHeaders is encrypted on disk
    Given a config with otelHeaders = "Authorization=Bearer secret"
    When the config is written to disk
    Then the otelHeaders value on disk is encrypted
    And reading the config back yields otelHeaders = "Authorization=Bearer secret"
```
