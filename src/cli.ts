#!/usr/bin/env node
import { Command } from 'commander'
import { registerDeviceCommands } from './commands/device.js'
import { registerAppCommands } from './commands/apps.js'
import { registerRemoteCommands } from './commands/remote.js'
import { registerMediaCommands } from './commands/media.js'
import { runInteractive } from './commands/interactive.js'
import { registerManagementCommands } from './commands/management.js'
import { registerBackupCommands } from './commands/backup.js'
import { registerRestoreCommand } from './commands/restore.js'
import { registerLauncherCommands } from './commands/launcher.js'
import { fail } from './utils/output.js'
import { CliError } from './utils/errors.js'
export const program = new Command()
  .name('firetv')
  .description('Control an Amazon Fire TV through ADB')
  .version('1.0.0')
registerDeviceCommands(program)
registerAppCommands(program)
registerRemoteCommands(program)
registerMediaCommands(program)
registerManagementCommands(program)
registerBackupCommands(program)
registerRestoreCommand(program)
registerLauncherCommands(program)
program
  .command('interactive')
  .alias('shell')
  .description('Open an interactive Fire TV command prompt')
  .action(() => runInteractive(program))

const invocation = process.argv[2] ? program.parseAsync() : runInteractive(program)
invocation.catch((e: unknown) => {
  fail(e instanceof CliError ? e.message : e instanceof Error ? e.message : String(e))
  process.exitCode = e instanceof CliError ? e.exitCode : 1
})
