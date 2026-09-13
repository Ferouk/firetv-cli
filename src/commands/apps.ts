import { Command } from 'commander'
import { appService, parsePackageInfo, resolveApp } from '../services/apps.js'
import { selectedAdb } from '../services/adb.js'
import { info, success } from '../utils/output.js'
import { confirm } from '@inquirer/prompts'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
export function registerAppCommands(program: Command) {
  program
    .command('apps')
    .description('List installed apps')
    .option('--user')
    .option('--system')
    .action(async (o) => {
      const list = await (await appService()).list(o.user ? 'user' : o.system ? 'system' : 'all')
      list.forEach((a) => {
        const size = a.sizeBytes === undefined ? '' : ` · ${formatSize(a.sizeBytes)}`
        info(`${a.label ?? a.packageName} (${a.packageName})${size}`)
      })
    })
  program
    .command('open <app>')
    .description('Open an app')
    .action(async (app) => {
      const { adb } = await selectedAdb()
      const pkg = await resolveApp(app)
      await adb.shell(['monkey', '-p', pkg, '1'])
      success(`Opened ${pkg}`)
    })
  program
    .command('close <app>')
    .description('Force-stop an app')
    .action(async (app) => {
      const { adb } = await selectedAdb()
      const pkg = await resolveApp(app)
      await adb.shell(['am', 'force-stop', pkg])
      success(`Closed ${pkg}`)
    })
  program
    .command('app-info <app>')
    .description('Show package information')
    .option('--raw', 'show the complete Android package dump')
    .action(async (app, options) => {
      const { adb } = await selectedAdb()
      const pkg = await resolveApp(app)
      const details = await adb.shell(['dumpsys', 'package', pkg])
      if (options.raw) {
        info(details)
        return
      }
      const parsed = parsePackageInfo(pkg, details)
      info(`App: ${parsed.label}`)
      info(`Package: ${parsed.packageName}`)
      if (parsed.versionName || parsed.versionCode)
        info(
          `Version: ${parsed.versionName ?? 'unknown'}${parsed.versionCode ? ` (${parsed.versionCode})` : ''}`,
        )
      if (parsed.targetSdk) info(`Target SDK: ${parsed.targetSdk}`)
      if (parsed.apkPath) info(`APK: ${parsed.apkPath}`)
      if (parsed.dataPath) info(`Data: ${parsed.dataPath}`)
      if (parsed.installer) info(`Installed by: ${parsed.installer}`)
      if (parsed.firstInstalled) info(`First installed: ${parsed.firstInstalled}`)
      if (parsed.lastUpdated) info(`Last updated: ${parsed.lastUpdated}`)
    })
  program
    .command('install <apk>')
    .description('Install an APK')
    .action(async (apk) => {
      const path = resolve(apk.replace(/^~(?=$|\/)/, process.env.HOME ?? ''))
      if (!existsSync(path)) throw new Error(`APK does not exist: ${path}`)
      const { adb } = await selectedAdb()
      await adb.run(['install', path])
      success(`Installed ${path}`)
    })
  for (const [name, verb] of [
    ['uninstall', 'uninstall'],
    ['clear', 'clear app data'],
  ] as const)
    program
      .command(`${name} <app>`)
      .description(`${verb} for an app`)
      .option('-y, --yes')
      .action(async (app, o) => {
        if (
          !o.yes &&
          !(await confirm({ message: `${verb[0].toUpperCase() + verb.slice(1)} ${app}?` }))
        )
          return
        const { adb } = await selectedAdb()
        const pkg = await resolveApp(app)
        await adb.shell([
          name === 'uninstall' ? 'pm' : 'pm',
          name === 'uninstall' ? 'uninstall' : 'clear',
          pkg,
        ])
        success(`${name === 'uninstall' ? 'Uninstalled' : 'Cleared'} ${pkg}`)
      })
}

function formatSize(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}
