import { selectedAdb } from './adb.js'
const keys = {
  home: 'KEYCODE_HOME',
  back: 'KEYCODE_BACK',
  up: 'KEYCODE_DPAD_UP',
  down: 'KEYCODE_DPAD_DOWN',
  left: 'KEYCODE_DPAD_LEFT',
  right: 'KEYCODE_DPAD_RIGHT',
  select: 'KEYCODE_DPAD_CENTER',
  play: 'KEYCODE_MEDIA_PLAY',
  pause: 'KEYCODE_MEDIA_PAUSE',
  'play-pause': 'KEYCODE_MEDIA_PLAY_PAUSE',
  next: 'KEYCODE_MEDIA_NEXT',
  previous: 'KEYCODE_MEDIA_PREVIOUS',
  'volume-up': 'KEYCODE_VOLUME_UP',
  'volume-down': 'KEYCODE_VOLUME_DOWN',
  mute: 'KEYCODE_VOLUME_MUTE',
  wake: 'KEYCODE_WAKEUP',
  sleep: 'KEYCODE_SLEEP',
} as const
export type RemoteAction = keyof typeof keys
export async function send(action: RemoteAction) {
  const { adb } = await selectedAdb()
  await adb.shell(['input', 'keyevent', keys[action]])
}
export async function typeText(text: string) {
  const { adb } = await selectedAdb()
  const encoded = text
    .replace(/%/g, '%25')
    .replace(/ /g, '%s')
    .replace(/'/g, "\\'")
    .replace(/([()&;<>|])/g, '\\$1')
  await adb.shell(['input', 'text', encoded])
}
