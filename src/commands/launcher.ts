import { Command } from 'commander'
import {
  currentLauncher,
  launcherPlan,
  listLaunchers,
  restoreLauncherPlan,
} from '../services/launcher.js'
import { runPlan } from './safety.js'
import { info } from '../utils/output.js'
import { createBackup } from '../services/backup.js'
export function registerLauncherCommands(program: Command) {
  const launcher = program.command('launcher').description('Manage HOME launchers')
  launcher
    .command('list')
    .action(async () =>
      (await listLaunchers()).forEach((item) => info(`${item.packageName}/${item.activity || ''}`)),
    )
  launcher.command('status').action(async () => info(await currentLauncher()))
  launcher
    .command('set <package>')
    .option('--apk <path>')
    .option('--apply')
    .option('--yes')
    .action(async (pkg, o) => {
      await runPlan(await launcherPlan(pkg, o.apk), o, createBackup)
    })
  launcher
    .command('restore')
    .requiredOption('--activity <activity>')
    .option('--apply')
    .option('--yes')
    .action(async (o) => {
      await runPlan(await restoreLauncherPlan(o.activity), o, createBackup)
    })
}
