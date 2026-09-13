import { ADBService, selectedAdb } from './adb.js'
import { loadConfig } from '../config/config.js'
import { CliError } from '../utils/errors.js'
export type App = { packageName: string; label?: string; sizeBytes?: number; system: boolean }
export type PackageInfo = Record<string, string | undefined>
export class AppService {
  constructor(
    private readonly adb: ADBService,
    private readonly config: Awaited<ReturnType<typeof loadConfig>>,
  ) {}
  async list(scope: 'all' | 'user' | 'system' = 'all'): Promise<App[]> {
    const flag = scope === 'user' ? '-3' : scope === 'system' ? '-s' : ''
    const text = await this.adb.shell(['pm', 'list', 'packages', ...(flag ? [flag] : [])])
    const packages = text
      .split('\n')
      .filter(Boolean)
      .map((x: string) => x.replace(/^package:/, ''))
    const systemPackages =
      scope === 'system'
        ? new Set(packages)
        : scope === 'user'
          ? new Set<string>()
          : new Set(
              (await this.adb.shell(['pm', 'list', 'packages', '-s']))
                .split('\n')
                .filter(Boolean)
                .map((line) => line.replace(/^package:/, '')),
            )
    const apps = packages.map((packageName: string) => ({
      packageName,
      system: systemPackages.has(packageName),
    }))
    return Promise.all(
      apps.map(async (app) => {
        const details = await this.detailsFor(app.packageName)
        return {
          ...app,
          label: details.label || friendlyPackageName(app.packageName),
          sizeBytes: details.sizeBytes,
        }
      }),
    )
  }

  private async detailsFor(packageName: string) {
    const details = await this.adb.shell(['dumpsys', 'package', packageName]).catch(() => '')
    const match = details.match(
      /(?:application-label|nonLocalizedLabel)\s*[=:]\s*['"]?([^,'"}\n]+)/i,
    )
    const sizes = ['codeSize', 'dataSize', 'cacheSize'].map((key) => {
      const value = details.match(new RegExp(`${key}=(\\d+)`, 'i'))?.[1]
      return value ? Number(value) : 0
    })
    let sizeBytes = sizes.some(Boolean)
      ? sizes.reduce((total, value) => total + value, 0)
      : undefined
    if (sizeBytes === undefined) {
      const apkPaths = await this.adb
        .shell(['pm', 'path', packageName])
        .then((output) => output.split('\n').map((line) => line.replace(/^package:/, '').trim()))
        .catch(() => [])
      const dataPath = details.match(/^\s*dataDir=([^\n]+)/m)?.[1]?.trim()
      const paths = [...apkPaths, ...(dataPath ? [dataPath] : [])].filter(Boolean)
      const measured = await Promise.all(
        paths.map(async (path) => {
          const output = await this.adb.shell(['du', '-k', path]).catch(() => '')
          return Number(output.match(/^(\d+)/)?.[1] ?? 0) * 1024
        }),
      )
      const total = measured.reduce((sum, value) => sum + value, 0)
      sizeBytes = total > 0 ? total : undefined
    }
    return {
      label: match?.[1]?.trim(),
      sizeBytes,
    }
  }
  async resolve(query: string) {
    const apps = await this.list()
    const alias = this.config.aliases?.[query.toLowerCase()]
    if (alias) query = alias
    const exact = apps.find((a) => a.packageName === query)
    if (exact) return exact.packageName
    const normalized = query.toLowerCase()
    const matches = apps.filter(
      (a) =>
        a.packageName.toLowerCase().includes(normalized) ||
        a.label?.toLowerCase().includes(normalized),
    )
    if (matches.length === 1) return matches[0].packageName
    if (!matches.length) throw new CliError(`App not found: ${query}`)
    throw new CliError(
      `Multiple apps match "${query}": ${matches
        .slice(0, 5)
        .map((a) => a.packageName)
        .join(', ')}`,
    )
  }
}

function friendlyPackageName(packageName: string) {
  const ignored = new Set(['android', 'app', 'client', 'ftv', 'service', 'tv'])
  const part = packageName
    .split('.')
    .reverse()
    .find((value) => value.length > 2 && !ignored.has(value.toLowerCase()))
  if (!part) return packageName
  return part
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}
export async function appService() {
  const { adb } = await selectedAdb()
  return new AppService(adb, await loadConfig())
}
export async function resolveApp(query: string) {
  return (await appService()).resolve(query)
}

export function parsePackageInfo(packageName: string, details: string): PackageInfo {
  const value = (key: string) =>
    details.match(new RegExp(`^\\s*${key}=([^\\n]+)`, 'm'))?.[1]?.trim()
  const label = details
    .match(/(?:application-label|nonLocalizedLabel)\s*[=:]\s*['"]?([^,'"}\n]+)/i)?.[1]
    ?.trim()
  return {
    label: label || friendlyPackageName(packageName),
    packageName,
    versionName: value('versionName'),
    versionCode: details.match(/versionCode=([^\s]+)/)?.[1],
    targetSdk: details.match(/targetSdk(?:Version)?[= ](\d+)/i)?.[1],
    apkPath: value('codePath'),
    dataPath: value('dataDir'),
    installer: value('installerPackageName'),
    firstInstalled: value('firstInstallTime'),
    lastUpdated: value('lastUpdateTime'),
  }
}
