import { Command } from 'commander'
import { createBackup, listBackups } from '../services/backup.js'
import { info, success } from '../utils/output.js'
export function registerBackupCommands(program: Command) {
  const backup = program.command('backup').description('Create and list device backups')
  backup.command('create').action(async () => success(await createBackup()))
  backup.command('list').action(async () => (await listBackups()).forEach(info))
}
