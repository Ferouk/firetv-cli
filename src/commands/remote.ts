import { Command } from 'commander'
import { send, typeText, type RemoteAction } from '../services/remote.js'
import { success } from '../utils/output.js'
import { stdin } from 'node:process'
const actions = [
  'home',
  'back',
  'up',
  'down',
  'left',
  'right',
  'select',
  'play',
  'pause',
  'play-pause',
  'next',
  'previous',
  'volume-up',
  'volume-down',
  'mute',
  'wake',
  'sleep',
] as RemoteAction[]
export function registerRemoteCommands(program: Command) {
  for (const action of actions)
    program
      .command(action)
      .description(`Send ${action} remote command`)
      .action(async () => {
        await send(action)
        success(action)
      })
  program
    .command('type [text]')
    .description('Type text into the Fire TV')
    .action(async (text) => {
      if (text === undefined) {
        let data = ''
        for await (const chunk of stdin) data += chunk
        text = data.trimEnd()
      }
      await typeText(text)
    })
}
