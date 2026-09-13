import { Command } from 'commander'
import { selectedAdb } from '../services/adb.js'
import { info } from '../utils/output.js'
import { resolve } from 'node:path'
import { homedir } from 'node:os'
import type { RemoteAction } from '../services/remote.js'
export function registerMediaCommands(program: Command) {
  program
    .command('screenshot [destination]')
    .description('Capture a screenshot')
    .action(async (destination) => {
      const local = resolve(
        (
          destination ??
          `firetv-${new Date()
            .toISOString()
            .replace(/[-:TZ.]/g, '')
            .slice(0, 15)}.png`
        ).replace(/^~(?=$|\/)/, homedir()),
      )
      const remote = `/sdcard/firetv-${Date.now()}.png`
      const { adb } = await selectedAdb()
      try {
        await adb.shell(['screencap', '-p', remote])
        await adb.pull(remote, local)
        info(local)
      } finally {
        await adb.remove(remote).catch(() => {})
      }
    })
  program
    .command('remote')
    .description('Open interactive terminal remote')
    .action(async () => {
      info(
        'Interactive remote: arrows navigate, Enter select, Esc back, H home, Space play/pause, +/- volume, M mute, Q quit.',
      )
      const { stdin } = process
      if (!stdin.isTTY) throw new Error('Interactive remote requires a TTY')
      stdin.setRawMode(true)
      stdin.resume()
      const cleanup = () => {
        stdin.setRawMode?.(false)
        stdin.pause()
      }
      const onKey = async (b: Buffer) => {
        const k = b.toString()
        if (k.toLowerCase() === 'q' || k === '\u0003') {
          cleanup()
          process.exit(0)
        }
        const map: Record<string, RemoteAction> = {
          '\u001b[A': 'up',
          '\u001b[B': 'down',
          '\u001b[C': 'right',
          '\u001b[D': 'left',
          '\r': 'select',
          '\u001b': 'back',
          h: 'home',
          ' ': 'play-pause',
          '+': 'volume-up',
          '-': 'volume-down',
          m: 'mute',
        }
        if (map[k]) await (await import('../services/remote.js')).send(map[k])
      }
      stdin.on('data', onKey)
      process.once('SIGINT', cleanup)
    })
}
