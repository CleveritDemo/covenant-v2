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
