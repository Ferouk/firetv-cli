import { Command } from 'commander'
import { readBackup, restorePlan } from '../services/backup.js'
import { runPlan } from './safety.js'
export function registerRestoreCommand(program: Command) {
  program
    .command('restore')
    .requiredOption('--input <path>')
    .option('--apply')
    .option('--yes')
    .action(async (o) => {
      await runPlan(await restorePlan(await readBackup(o.input)), o)
    })
}
