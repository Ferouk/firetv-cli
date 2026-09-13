import { Command } from 'commander'
import {
  filteredProfile,
  packageStates,
  disablePlan,
  enablePlan,
  type PackageTier,
} from '../services/packageState.js'
import { runPlan } from './safety.js'
import { telemetryPlan, telemetryStatus } from '../services/telemetry.js'
import { readSettings, settingsPlan } from '../services/settings.js'
import { info } from '../utils/output.js'
import { createBackup } from '../services/backup.js'
export function registerManagementCommands(program: Command) {
  const debloat = program.command('debloat').description('Safely disable optional packages')
  debloat
    .command('list')
    .option('--tier <tier>')
    .action(async (o) =>
      filteredProfile(o.tier?.toUpperCase() as PackageTier | undefined).forEach((item) =>
        info(`${item.tier} · ${item.packageName} · ${item.reason}`),
      ),
    )
  debloat
    .command('status')
    .action(async () =>
      (await packageStates()).forEach((item) =>
        info(
          `${item.disabled ? 'disabled' : 'enabled'} · ${item.packageName}${item.profile ? ` · ${item.profile.tier}` : ''}`,
        ),
      ),
    )
  debloat
    .command('disable <package>')
    .option('--apply')
    .option('--yes')
    .action(async (name, o) => {
      await runPlan(await disablePlan([name]), o, createBackup)
    })
  debloat
    .command('run')
    .requiredOption('--preset <preset>')
    .option('--apply')
    .option('--yes')
    .action(async (o) => {
      const tiers =
        o.preset === 'safe'
          ? ['SAFE']
          : o.preset === 'telemetry'
            ? ['TELEMETRY']
            : ['SAFE', 'RISKY', 'TELEMETRY']
      const names = filteredProfile()
        .filter((item) => tiers.includes(item.tier))
        .map((item) => item.packageName)
      await runPlan(await disablePlan(names), o, createBackup)
    })
  debloat
    .command('enable <package>')
    .option('--apply')
    .option('--yes')
    .action(async (name, o) => {
      await runPlan(await enablePlan([name]), o, createBackup)
    })
  const telemetry = program
    .command('telemetry')
    .description('Manage telemetry settings and services')
  telemetry
    .command('status')
    .action(async () =>
      (await telemetryStatus()).forEach((item) =>
        info(`${item.description}: ${item.current} (target ${item.target})`),
      ),
    )
  telemetry
    .command('strip')
    .option('--apply')
    .option('--yes')
    .action(async (o) => {
      await runPlan(await telemetryPlan(), o, createBackup)
    })
  const settings = program
    .command('settings')
    .description('Manage Fire TV quality-of-life settings')
  settings
    .command('status')
    .action(async () =>
      (await readSettings()).forEach((item) =>
        info(`${item.description}: ${item.current} (target ${item.target})`),
      ),
    )
  settings
    .command('apply')
    .option('--apply')
    .option('--yes')
    .action(async (o) => {
      await runPlan(await settingsPlan(), o, createBackup)
    })
}
