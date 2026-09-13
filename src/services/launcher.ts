import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { selectedAdb } from './adb.js'
import { createPlan, type OperationPlan } from './operations.js'
import { CliError } from '../utils/errors.js'
export type Launcher = {
  packageName: string
  activity?: string
  installed: boolean
  source: 'builtin' | 'device'
}

export function launcherActivity(launchers: Launcher[], packageName: string) {
  return launchers.find((item) => item.packageName === packageName)?.activity || '.MainActivity'
}

export async function listLaunchers(): Promise<Launcher[]> {
  const { adb } = await selectedAdb()
  const output = await adb
    .shell([
      'cmd',
      'package',
      'query-activities',
      '--brief',
      '-a',
      'android.intent.action.MAIN',
      '-c',
      'android.intent.category.HOME',
    ])
    .catch(() => '')
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes('/'))
    .map((line) => {
      const value = line.replace(/^ActivityInfo\{/, '').split(/[}\s]/)[0]
      const [packageName, activity] = value.split('/')
      return { packageName, activity, installed: true, source: 'device' as const }
    })
}
export async function currentLauncher() {
  const { adb } = await selectedAdb()
  return adb
    .shell([
      'cmd',
      'package',
      'resolve-activity',
      '--brief',
      '-a',
      'android.intent.action.MAIN',
      '-c',
      'android.intent.category.HOME',
    ])
    .catch(() => '')
}
export async function launcherPlan(packageName: string, apkPath?: string): Promise<OperationPlan> {
  if (apkPath && !existsSync(resolve(apkPath))) throw new CliError(`APK does not exist: ${apkPath}`)
  const { adb } = await selectedAdb()
  const activity = launcherActivity(await listLaunchers(), packageName)
  const changes = []
  if (apkPath)
    changes.push({
      description: `Install ${apkPath}`,
      reversible: false,
      apply: () => adb.run(['install', resolve(apkPath)]).then(() => undefined),
    })
  changes.push({
    description: `Set HOME activity for ${packageName}`,
    reversible: true,
    apply: async () => {
      const selectedActivity = apkPath
        ? launcherActivity(await listLaunchers(), packageName)
        : activity
      await adb.shell(['cmd', 'package', 'set-home-activity', `${packageName}/${selectedActivity}`])
    },
  })
  changes.push({
    description: 'Verify HOME activity',
    reversible: true,
    apply: async () => {
      const current = await currentLauncher()
      if (!current.includes(packageName))
        throw new Error(`HOME resolved to ${current || 'unknown activity'}`)
    },
  })
  return createPlan('Set launcher', changes)
}
export async function restoreLauncherPlan(activity: string): Promise<OperationPlan> {
  const { adb } = await selectedAdb()
  return createPlan('Restore launcher', [
    {
      description: `Set HOME activity to ${activity}`,
      reversible: true,
      apply: () =>
        adb.shell(['cmd', 'package', 'set-home-activity', activity]).then(() => undefined),
    },
  ])
}
