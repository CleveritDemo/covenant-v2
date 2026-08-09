/**
 * Manifiesto de language servers. Es data, no código: para subir una versión se
 * cambian `version`, `url` y `sha256` aquí y nada más.
 *
 * Va como const de TS (no un `.json` aparte) para que el bundle de main lo lleve
 * incrustado — un `.json` habría que copiarlo a `out/` y a los recursos del DMG.
 */

export type ArchiveKind = 'gzip' | 'zip' | 'targz'

export interface Artifact {
  url: string
  sha256: string
  kind: ArchiveKind
}

/** Runtime que el server necesita en la máquina del usuario (node, dotnet, java). */
export interface RuntimeSpec {
  name: string
  minVersion: string
  versionArg: string
}

/** Cómo se baja un server que se instala con `npm install` en vez de un binario. */
export interface NpmSpec {
  packages: string[]
  /** Entry point JS relativo al dir de instalación. */
  binEntry: string
}

export type InstallKind = 'binary' | 'npm'

export interface ServerSpec {
  language: string
  name: string
  version: string
  /** Entry point relativo al dir de instalación. */
  cmd: string
  args: string[]
  rootMarkers: string[]
  approxSizeMb: number
  artifacts?: Record<string, Artifact>
  runtime?: RuntimeSpec
  npm?: NpmSpec
  /**
   * Entry relativo a `installRoot` cuando el ejecutable vive anidado dentro del
   * archivo desempaquetado (el nupkg de Roslyn lo pone en
   * `content/LanguageServer/<rid>/...`). Ausente = el entry es `installRoot/cmd`
   * directo (rust-analyzer: un binario plano gzipeado).
   */
  entrySubpath?: string
  /**
   * Dir de configuración que acompaña al entry en un launcher JVM (el
   * `config_mac_arm` de jdtls, que el launcher equinox lee vía `-configuration`).
   * Ausente en todos los demás.
   */
  configSubpath?: string
}

const SERVERS: ServerSpec[] = [
  {
    language: 'rust',
    name: 'rust-analyzer',
    version: '2026-07-06',
    cmd: 'rust-analyzer',
    args: [],
    rootMarkers: ['Cargo.toml'],
    approxSizeMb: 12,
    artifacts: {
      'macos-aarch64': {
        url: 'https://github.com/rust-lang/rust-analyzer/releases/download/2026-07-06/rust-analyzer-aarch64-apple-darwin.gz',
        sha256: '0fb2229496105666460d22d062a55e154c862bb8004c464a38c6ffaff6fd68fe',
        kind: 'gzip',
      },
      'macos-x86_64': {
        url: 'https://github.com/rust-lang/rust-analyzer/releases/download/2026-07-06/rust-analyzer-x86_64-apple-darwin.gz',
        sha256: '3a6bc5b42c27d3f8d308dacb25fdbe9bba0577be2970500cdb936e53c21c3496',
        kind: 'gzip',
      },
    },
  },
  {
    language: 'typescript',
    name: 'typescript-language-server',
    version: '5.3.0',
    cmd: 'typescript-language-server',
    args: ['--stdio'],
    rootMarkers: ['tsconfig.json', 'jsconfig.json', 'package.json'],
    approxSizeMb: 40,
    runtime: { name: 'node', minVersion: '18', versionArg: '--version' },
    npm: {
      packages: ['typescript-language-server@5.3.0', 'typescript@6.0.3'],
      binEntry: 'node_modules/typescript-language-server/lib/cli.mjs',
    },
  },
  {
    language: 'csharp',
    name: 'roslyn-language-server',
    version: '5.4.0-2.26179.14',
    cmd: 'Microsoft.CodeAnalysis.LanguageServer',
    args: [],
    rootMarkers: ['*.sln', '*.csproj', 'global.json'],
    approxSizeMb: 57,
    runtime: { name: 'dotnet', minVersion: '10', versionArg: '--version' },
    entrySubpath: 'content/LanguageServer/osx-arm64/Microsoft.CodeAnalysis.LanguageServer',
    artifacts: {
      'macos-aarch64': {
        url: 'https://pkgs.dev.azure.com/azure-public/vside/_packaging/vs-impl/nuget/v3/flat2/microsoft.codeanalysis.languageserver.osx-arm64/5.4.0-2.26179.14/microsoft.codeanalysis.languageserver.osx-arm64.5.4.0-2.26179.14.nupkg',
        sha256: 'b8583ea7571767b8b6b157cdbece5aa8945aece55cca151040c747a134052a9d',
        kind: 'zip',
      },
    },
  },
  {
    language: 'java',
    name: 'jdtls',
    version: '1.60.0',
    cmd: 'jdtls',
    args: [],
    rootMarkers: ['pom.xml', 'build.gradle', 'settings.gradle', '.project'],
    approxSizeMb: 51,
    runtime: { name: 'java', minVersion: '21', versionArg: '--version' },
    entrySubpath: 'plugins/org.eclipse.equinox.launcher_1.7.200.v20260619-2039.jar',
    configSubpath: 'config_mac_arm',
    artifacts: {
      'macos-aarch64': {
        url: 'https://download.eclipse.org/jdtls/milestones/1.60.0/jdt-language-server-1.60.0-202606262232.tar.gz',
        sha256: 'e94c303d8198f977930803582738771fd18c52c5492878410bf222b1aa81ef1d',
        kind: 'targz',
      },
    },
  },
]

export function allSpecs(): ServerSpec[] {
  return SERVERS
}

export function specForLanguage(language: string): ServerSpec | null {
  return SERVERS.find(s => s.language === language) ?? null
}

export function platformKey(): string {
  const { platform, arch } = process
  if (platform === 'darwin') return arch === 'arm64' ? 'macos-aarch64' : 'macos-x86_64'
  if (platform === 'win32') return 'windows-x86_64'
  return arch === 'arm64' ? 'linux-aarch64' : 'linux-x86_64'
}

export function artifactFor(spec: ServerSpec): Artifact | null {
  return spec.artifacts?.[platformKey()] ?? null
}

/** Npm sólo si el manifiesto declara `npm`; si no, se baja como artefacto binario. */
export function installKind(spec: ServerSpec): InstallKind {
  return spec.npm ? 'npm' : 'binary'
}

export { lspLanguageId } from '../../src/shared/lspLanguages'
