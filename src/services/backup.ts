import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { backupDirectory } from '../config/config.js'
import { selectedAdb } from './adb.js'
import { props } from './device.js'
import { packageStates } from './packageState.js'
import { telemetryStatus } from './telemetry.js'
import { currentLauncher } from './launcher.js'
import { createPlan, type OperationPlan } from './operations.js'
import { CliError } from '../utils/errors.js'
export type BackupSnapshot = {
  schemaVersion: 1
  createdAt: string
  device: { address: string; model?: string }
  packages: string[]
  changedPackages: string[]
  settings: Record<string, string | null>
  launcher?: string
}
export async function createBackup() {
  const [device, states, settings, launcher] = await Promise.all([
    props(),
    packageStates(),
    telemetryStatus(),
    currentLauncher(),
  ])
  const snapshot: BackupSnapshot = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    device: { address: device.address, model: device.model || undefined },
    packages: states.map((item) => item.packageName),
    changedPackages: states.filter((item) => item.disabled).map((item) => item.packageName),
    settings: Object.fromEntries(
      settings.map((item) => [`${item.namespace}/${item.key}`, item.current]),
    ),
    launcher: launcher || undefined,
  }
  await mkdir(backupDirectory, { recursive: true })
  const name = `${snapshot.createdAt.replace(/[-:TZ.]/g, '').slice(0, 14)}_${snapshot.device.model || 'unknown'}.json`
  const path = join(backupDirectory, name)
  await writeFile(path, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
  return path
}
export async function listBackups() {
  return (await readdir(backupDirectory).catch(() => []))
    .filter((name) => name.endsWith('.json'))
    .sort()
    .reverse()
    .map((name) => join(backupDirectory, name))
}
export async function readBackup(path: string): Promise<BackupSnapshot> {
  try {
    const value = JSON.parse(await readFile(path, 'utf8')) as BackupSnapshot
    if (value.schemaVersion !== 1 || !Array.isArray(value.changedPackages))
      throw new Error('invalid schema')
    return value
  } catch (error) {
    throw new CliError(
      `Malformed backup at ${path}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
export async function restorePlan(snapshot: BackupSnapshot): Promise<OperationPlan> {
  const { adb } = await selectedAdb()
  const changes = snapshot.changedPackages.map((name) => ({
    description: `Enable ${name}`,
    reversible: true,
    apply: () => adb.shell(['pm', 'enable', '--user', '0', name]).then(() => undefined),
  }))
  if (snapshot.launcher)
    changes.push({
      description: `Restore HOME activity ${snapshot.launcher}`,
      reversible: true,
      apply: () =>
        adb
          .shell(['cmd', 'package', 'set-home-activity', snapshot.launcher!])
          .then(() => undefined),
    })
  return createPlan('Restore backup', changes, [
    `Backup created ${snapshot.createdAt} for ${snapshot.device.model || 'unknown'}`,
  ])
}
