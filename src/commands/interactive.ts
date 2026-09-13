import blessed from 'blessed'
import type { Command } from 'commander'
import { rm } from 'node:fs/promises'
import { CliError } from '../utils/errors.js'
import { send, type RemoteAction } from '../services/remote.js'
import { listLaunchers, type Launcher } from '../services/launcher.js'
import { discoverDevices } from '../services/device.js'
import { appService, type App } from '../services/apps.js'
import { downloadFireTvLauncher, fireTvLaunchers } from '../services/launcherCatalog.js'
import { status as deviceStatus } from '../services/device.js'

type MenuAction = () => Promise<void>
export type InteractiveMenuItem = { key: string; label: string; hint: string; action: MenuAction }
export type InteractiveSubmenuItem = { label: string; args: string[] }

const orange = '#FF9900'
const red = '#F14C4C'
const green = '#6BCB77'
export const busyFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
export const selectionEvents = ['enter', 'select'] as const
export const appSearchLabel = ' Search '
export const appInitialFocus = 'results'

export const headerAsciiArt = `  ███████╗██╗██████╗ ███████╗████████╗██╗   ██╗
  ██╔════╝██║██╔══██╗██╔════╝╚══██╔══╝██║   ██║
  █████╗  ██║██████╔╝█████╗     ██║   ██║   ██║
  ██╔══╝  ██║██╔══██╗██╔══╝     ██║   ╚██╗ ██╔╝
  ██║     ██║██║  ██║███████╗   ██║    ╚████╔╝
  ╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝     ╚═══╝`

export function formatResult(title: string, lines: string[], elapsedMs: number, error?: string) {
  const body = error ? `{${red}-fg}${error}{/}` : lines.join('\n').trim() || '{gray-fg}No output returned.{/gray-fg}'
  const sections = new Set(['Connection', 'Software', 'Hardware', 'Display', 'Storage', 'Packages', 'Settings', 'Telemetry', 'Backups'])
  const formatted = error ? body : body.split('\n').map((line, index) => {
    if (!line.trim()) return ''
    const value = line.trim()
    const field = value.match(/^([^:]{1,48}):\s*(.*)$/)
    if (field) {
      const status = /\b(disabled|failed|error|offline|not found)\b/i.test(field[2]) ? `{${red}-fg}` : /\b(enabled|success|connected|device|ok)\b/i.test(field[2]) ? `{${green}-fg}` : ''
      return `  {gray-fg}${field[1]}:{/gray-fg} ${status}${field[2]}${status ? '{/}' : ''}`
    }
    if (value.includes(' · ')) return `  {${green}-fg}•{/} ${value.replaceAll(' · ', '  ·  ')}`
    const looksLikePath = /[\\/]/.test(value) || value.endsWith('.tar.gz')
    if ((!line.startsWith(' ') && !line.startsWith('\t')) && ((index === 0 && !looksLikePath) || sections.has(value))) return `{bold}{${orange}-fg}▸ ${value}{/}{/bold}`
    if (!line.startsWith(' ') && !line.startsWith('\t')) return `  {${orange}-fg}•{/} ${value}`
    return `  ${value}`
  }).join('\n')
  return `{bold}{${error ? red : green}-fg}${error ? '✖ Failed' : '✓ Complete'}{/}  {gray-fg}${title} · ${elapsedMs}ms{/gray-fg}{/bold}\n\n${formatted}`
}

export function createActionLock() {
  let locked = false
  return {
    get locked() { return locked },
    async run(action: () => Promise<unknown>): Promise<boolean> {
      if (locked) return false
      locked = true
      try { await action(); return true }
      finally { locked = false }
    },
  }
}

const actionLock = createActionLock()

export const interactivePanelLayout = {
  output: { right: 2, top: 17, width: '48%', bottom: 2 },
  device: { right: 2, top: 9, width: '48%', height: 7 },
} as const

export const interactiveSubmenus: Record<string, InteractiveSubmenuItem[]> = {
  devices: [
    { label: 'Connect new device', args: [] },
    { label: 'Refresh devices', args: [] },
    { label: 'Back', args: [] },
  ],
  debloat: [
    { label: 'List packages', args: ['debloat', 'list'] },
    { label: 'Package status', args: ['debloat', 'status'] },
    { label: 'Run safe preset', args: ['debloat', 'run', '--preset', 'safe'] },
    { label: 'Disable package', args: [] },
    { label: 'Enable package', args: [] },
    { label: 'Back', args: [] },
  ],
  telemetry: [
    { label: 'Show status', args: ['telemetry', 'status'] },
    { label: 'Strip telemetry', args: ['telemetry', 'strip'] },
    { label: 'Back', args: [] },
  ],
  settings: [
    { label: 'Show status', args: ['settings', 'status'] },
    { label: 'Apply tweaks', args: ['settings', 'apply'] },
    { label: 'Back', args: [] },
  ],
  launchers: [
    { label: 'List launchers', args: ['launcher', 'list'] },
    { label: 'Current launcher', args: ['launcher', 'status'] },
    { label: 'Install third-party launcher', args: [] },
    { label: 'Choose launcher from list', args: [] },
    { label: 'Restore launcher', args: [] },
    { label: 'Back', args: [] },
  ],
  backups: [
    { label: 'Create backup', args: ['backup', 'create'] },
    { label: 'List backups', args: ['backup', 'list'] },
    { label: 'Restore backup', args: [] },
    { label: 'Back', args: [] },
  ],
}

export function interactiveCommandForChoice(choice: string): string[] | undefined {
  return ['screenshot', 'status'].includes(choice) ? [choice] : undefined
}

export function launcherChoices(launchers: Launcher[]) {
  return launchers.map((item) => ({ name: `${item.packageName}/${item.activity || ''}`, value: item.packageName }))
}

export function filterApps(apps: App[], query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return apps
  return apps.filter((app) => app.label?.toLowerCase().includes(normalized) || app.packageName.toLowerCase().includes(normalized))
}

export function requiresTuiConfirmation(args: string[]) {
  return [
    ['settings', 'apply'], ['telemetry', 'strip'], ['debloat', 'run'],
    ['debloat', 'disable'], ['debloat', 'enable'], ['launcher', 'set'],
    ['launcher', 'restore'], ['restore'], ['close'], ['uninstall'], ['clear'],
  ].some((prefix) => prefix.every((part, index) => args[index] === part))
}

const remoteActions: Array<{ key: string; label: string; action: RemoteAction }> = [
  { key: 'h', label: 'Home', action: 'home' }, { key: 'b', label: 'Back', action: 'back' },
  { key: '↑', label: 'Up', action: 'up' }, { key: '↓', label: 'Down', action: 'down' },
  { key: '←', label: 'Left', action: 'left' }, { key: '→', label: 'Right', action: 'right' },
  { key: '⏎', label: 'Select', action: 'select' }, { key: 'p', label: 'Play / Pause', action: 'play-pause' },
  { key: 'n', label: 'Next', action: 'next' }, { key: 'r', label: 'Previous', action: 'previous' },
  { key: '+', label: 'Volume up', action: 'volume-up' }, { key: '-', label: 'Volume down', action: 'volume-down' },
  { key: 'm', label: 'Mute', action: 'mute' }, { key: 'w', label: 'Wake', action: 'wake' }, { key: 's', label: 'Sleep', action: 'sleep' },
]

export const interactiveMenuItems: InteractiveMenuItem[] = [
  { key: 'r', label: 'Remote control', hint: 'Navigate, play, and adjust volume', action: async () => {} },
  { key: 'a', label: 'Apps', hint: 'List installed applications', action: async () => {} },
  { key: 't', label: 'Type text', hint: 'Send text to the active screen', action: async () => {} },
  { key: 's', label: 'Screenshot', hint: 'Save the current TV screen locally', action: async () => {} },
  { key: 'd', label: 'Device status', hint: 'Check the ADB connection', action: async () => {} },
  { key: 'v', label: 'Devices', hint: 'Discover and connect Fire TV devices', action: async () => {} },
  { key: 'b', label: 'Debloat', hint: 'Preview safe package cleanup', action: async () => {} },
  { key: 'e', label: 'Telemetry', hint: 'Preview telemetry controls', action: async () => {} },
  { key: 'g', label: 'Settings', hint: 'Preview quality-of-life tweaks', action: async () => {} },
  { key: 'l', label: 'Launchers', hint: 'List installed HOME launchers', action: async () => {} },
  { key: 'k', label: 'Backups', hint: 'Create or list device backups', action: async () => {} },
  { key: 'c', label: 'Run a command', hint: 'Use any firetv command', action: async () => {} },
  { key: 'o', label: 'Reboot', hint: 'Restart the Fire TV', action: async () => {} },
  { key: 'x', label: 'Disconnect', hint: 'Disconnect the active device', action: async () => {} },
  { key: 'q', label: 'Quit', hint: 'Leave interactive mode', action: async () => {} },
]

export const interactiveShortcuts = Object.fromEntries(
  interactiveMenuItems.map((item) => [item.key, item.label]),
)

function createScreen() {
  const screen = blessed.screen({ smartCSR: true, title: 'firetv' })
  screen.key(['q', 'C-c'], () => process.exit(0))
  return screen
}

function frame(screen: blessed.Widgets.Screen, title: string, log?: blessed.Widgets.Log) {
  for (const child of [...screen.children]) if (child !== log) child.destroy()
  blessed.box({ parent: screen, top: 0, left: 0, width: '100%', height: 9, tags: true,
    content: `{bold}{${orange}-fg}${headerAsciiArt}{/}\n  {gray-fg}${title}{/gray-fg}{/bold}`, style: { bg: '#161616', fg: 'white' } })
  blessed.box({ parent: screen, bottom: 0, left: 0, width: '100%', height: 1, tags: true,
    content: '{gray-fg} ↑↓ navigate  enter select  esc back  q quit{/gray-fg}', style: { bg: '#161616' } })
}

function clearActivity(log: blessed.Widgets.Log) {
  log.setContent('')
}

async function withBusy<T>(screen: blessed.Widgets.Screen, log: blessed.Widgets.Log, label: string, action: () => Promise<T>) {
  clearActivity(log)
  let frameIndex = 0
  const update = () => {
    log.setLabel(` Activity ${busyFrames[frameIndex]} ${label.slice(0, 24)} `)
    screen.render()
    frameIndex = (frameIndex + 1) % busyFrames.length
  }
  update()
  const timer = setInterval(update, 120)
  try { return await action() }
  finally { clearInterval(timer); log.setLabel(' Activity '); screen.render() }
}

async function devicePanel(screen: blessed.Widgets.Screen) {
  const panel = blessed.box({ parent: screen, ...interactivePanelLayout.device, border: 'line', label: ' Device ', tags: true,
    content: '{yellow-fg}●{/yellow-fg}  Checking connection…', style: { border: { fg: '#444' }, fg: 'white' } })
  try {
    const status = await deviceStatus()
    const stateColor = status.state === 'device' ? green : red
    panel.setContent(`{${stateColor}-fg}●{/}  ${status.state}\n  ${status.name ?? 'Fire TV'}\n  ${status.address}\n  ${status.model ?? 'Model unavailable'}`)
  } catch (error: unknown) {
    panel.setContent(`{${red}-fg}●  Disconnected{/}\n  ${error instanceof Error ? error.message : 'No device selected'}`)
  }
}

async function command(screen: blessed.Widgets.Screen, program: Command, args: string[], log: blessed.Widgets.Log) {
  const originalLog = console.log
  const originalError = console.error
  const output: string[] = []
  const write = (value: unknown) => output.push(String(value))
  console.log = write; console.error = write
  const started = Date.now()
  let errorMessage: string | undefined
  try { await withBusy(screen, log, args.join(' '), () => program.parseAsync(['node', 'firetv', ...args], { from: 'node' })) }
  catch (error: unknown) { errorMessage = error instanceof CliError || error instanceof Error ? error.message : String(error) }
  finally {
    console.log = originalLog; console.error = originalError
    log.setContent(formatResult(args.join(' '), output, Date.now() - started, errorMessage))
    screen.render()
  }
}

async function confirmAction(screen: blessed.Widgets.Screen, label: string) {
  return new Promise<boolean>((resolve) => {
    const dialog = blessed.list({ parent: screen, top: 'center', left: 'center', width: '55%', height: 7, keys: true, items: ['Yes, apply changes', 'Cancel'], border: 'line', label: ` Confirm ${label} `, style: { selected: { bg: orange, fg: 'black' }, item: { fg: 'white' }, border: { fg: orange } } })
    const finish = (accepted: boolean) => { dialog.destroy(); resolve(accepted); screen.render() }
    dialog.focus()
    dialog.on('select', (_item, index: number) => finish(index === 0))
    dialog.key('escape', () => finish(false))
    screen.render()
  })
}

async function runTuiCommand(screen: blessed.Widgets.Screen, args: string[], log: blessed.Widgets.Log) {
  if (requiresTuiConfirmation(args)) {
    const confirmed = await confirmAction(screen, args.join(' '))
    if (!confirmed) {
      log.setContent(formatResult('cancelled', ['No changes were applied.'], 0))
      screen.render()
      return
    }
    args = [...args, '--yes']
  }
  await command(screen, programRef!, args, log)
}

async function listScreen(screen: blessed.Widgets.Screen, title: string, items: Array<{ name: string; action: MenuAction }>, log: blessed.Widgets.Log, onBack: () => void = () => mainMenu(screen, log), shortcuts: Array<{ key: string; index: number }> = []) {
  frame(screen, title, log)
  await devicePanel(screen)
  const list = blessed.list({ parent: screen, top: 9, left: 2, width: '42%', bottom: 2, keys: true, vi: true, mouse: true,
    items: items.map((item) => item.name), style: { selected: { bg: orange, fg: 'black' }, item: { fg: 'white' } }, border: 'line', label: ` ${title} ` })
  list.focus()
  const activate = async () => {
    await actionLock.run(async () => {
      clearActivity(log)
      const item = items[(list as blessed.Widgets.ListElement & { selected: number }).selected]
      if (item) await item.action()
      screen.render()
    })
  }
  list.key(selectionEvents[0], activate)
  list.on(selectionEvents[1], (_item, index: number) => { list.select(index); void activate() })
  for (const shortcut of shortcuts) list.key(shortcut.key, () => { list.select(shortcut.index); void activate() })
  screen.key('escape', onBack)
  screen.render()
}

async function remoteScreen(screen: blessed.Widgets.Screen, log: blessed.Widgets.Log) {
  await listScreen(screen, 'Remote control', [...remoteActions.map((item) => ({ name: `${item.key.padEnd(3)} ${item.label}`, action: async () => {
    try { await withBusy(screen, log, item.label, async () => { await send(item.action); log.add(`{${green}-fg}Sent{/}: ${item.label}`) }) }
    catch (error) { log.add(`{${red}-fg}${error instanceof Error ? error.message : String(error)}{/}`) }
  }})), { name: 'Back to main menu', action: () => mainMenu(screen, log) }], log, () => mainMenu(screen, log), remoteActions.map((item, index) => ({ key: item.key, index })))
}

async function submenuScreen(screen: blessed.Widgets.Screen, title: string, submenu: InteractiveSubmenuItem[], log: blessed.Widgets.Log) {
  await listScreen(screen, title, submenu.map((item) => ({
    name: item.label,
    action: async () => {
      if (item.label === 'Back') return mainMenu(screen, log)
      if (title === 'Launchers' && item.label === 'Install third-party launcher') return launcherScreen(screen, log, 'install')
      if (title === 'Launchers' && item.label === 'Choose launcher from list') return launcherScreen(screen, log, 'choose')
      if (title === 'Debloat' && (item.label === 'Disable package' || item.label === 'Enable package')) {
        const packageName = await promptInput(screen, `${item.label} (package name)`)
        if (packageName?.trim()) await runTuiCommand(screen, ['debloat', item.label.startsWith('Disable') ? 'disable' : 'enable', packageName.trim()], log)
        return
      }
      if (title === 'Launchers' && item.label === 'Restore launcher') {
        const activity = await promptInput(screen, 'Restore launcher activity')
        if (activity?.trim()) await runTuiCommand(screen, ['launcher', 'restore', '--activity', activity.trim()], log)
        return
      }
      if (title === 'Backups' && item.label === 'Restore backup') {
        const input = await promptInput(screen, 'Backup path')
        if (input?.trim()) await runTuiCommand(screen, ['restore', '--input', input.trim()], log)
        return
      }
      await runTuiCommand(screen, item.args, log)
    },
  })), log)
}

async function appScreen(screen: blessed.Widgets.Screen, log: blessed.Widgets.Log) {
  try {
    const apps = await withBusy(screen, log, 'Loading apps', async () => (await appService()).list())
    await appListScreen(screen, apps, log)
  } catch (error: unknown) {
    log.add(`{${red}-fg}Error: ${error instanceof Error ? error.message : String(error)}{/}`)
    await mainMenu(screen, log)
  }
}

async function appListScreen(screen: blessed.Widgets.Screen, apps: App[], log: blessed.Widgets.Log) {
  frame(screen, 'Apps', log)
  await devicePanel(screen)
  const search = blessed.textbox({ parent: screen, top: 9, left: 2, width: '42%', height: 3, inputOnFocus: true, keys: true, border: 'line', label: appSearchLabel, style: { border: { fg: orange }, fg: 'white' } })
  const list = blessed.list({ parent: screen, top: 13, left: 2, width: '42%', bottom: 2, keys: true, vi: true, mouse: true, style: { selected: { bg: orange, fg: 'black' }, item: { fg: 'white' } }, border: 'line', label: ' Results ' })
  const refresh = () => {
    const filteredApps = filterApps(apps, search.getValue())
    list.setItems([...filteredApps.map((app) => `${app.system ? '○' : '●'} ${app.label ?? app.packageName}`), 'Install APK', 'Back to main menu'])
    list.select(0)
    screen.render()
  }
  const openSelected = async () => {
    await actionLock.run(async () => {
      clearActivity(log)
      const filteredApps = filterApps(apps, search.getValue())
      const index = (list as blessed.Widgets.ListElement & { selected: number }).selected
      const app = filteredApps[index]
      if (!app) {
        if (index === filteredApps.length) {
          const apkPath = await promptInput(screen, 'APK path')
          if (apkPath?.trim()) await runTuiCommand(screen, ['install', apkPath.trim()], log)
          return appListScreen(screen, apps, log)
        }
        return mainMenu(screen, log)
      }
      await listScreen(screen, app.label ?? app.packageName, [
        { name: 'Open app', action: () => command(screen, programRef!, ['open', app.packageName], log) },
        { name: 'Close app', action: () => runTuiCommand(screen, ['close', app.packageName], log) },
        { name: 'Show app info', action: () => command(screen, programRef!, ['app-info', app.packageName], log) },
        { name: 'Uninstall app', action: () => runTuiCommand(screen, ['uninstall', app.packageName], log) },
        { name: 'Clear app data', action: () => runTuiCommand(screen, ['clear', app.packageName], log) },
        { name: 'Back to app list', action: () => appListScreen(screen, apps, log) },
      ], log, () => appListScreen(screen, apps, log))
    })
  }
  search.on('keypress', () => setTimeout(refresh, 0))
  search.key(['enter', 'down', 'tab'], () => list.focus())
  list.key(selectionEvents[0], openSelected)
  list.on(selectionEvents[1], (_item, index: number) => { list.select(index); void openSelected() })
  list.key('/', () => search.focus())
  search.key('escape', () => mainMenu(screen, log))
  screen.key('escape', () => mainMenu(screen, log))
  refresh()
  list.focus()
  screen.render()
}

async function launcherScreen(screen: blessed.Widgets.Screen, log: blessed.Widgets.Log, action: 'choose' | 'install') {
  if (action === 'choose') {
    const launchers = await withBusy(screen, log, 'Loading launchers', listLaunchers)
    await listScreen(screen, 'Choose launcher', launcherChoices(launchers).map((item) => ({
      name: item.name,
      action: () => runTuiCommand(screen, ['launcher', 'set', item.value], log),
    })), log, () => submenuScreen(screen, 'Launchers', interactiveSubmenus.launchers, log))
    return
  }
  await listScreen(screen, 'Install launcher', fireTvLaunchers.map((launcher) => ({
    name: launcher.name,
    action: async () => {
      let apkPath: string | undefined
      try {
        apkPath = await withBusy(screen, log, `Downloading ${launcher.name}`, () => downloadFireTvLauncher(launcher))
        await runTuiCommand(screen, ['launcher', 'set', launcher.packageName, '--apk', apkPath], log)
      } catch (error: unknown) {
        log.add(`{${red}-fg}Error: ${error instanceof Error ? error.message : String(error)}{/}`)
      } finally {
        if (apkPath) await rm(apkPath, { force: true })
      }
    },
  })), log, () => submenuScreen(screen, 'Launchers', interactiveSubmenus.launchers, log))
}

function promptInput(screen: blessed.Widgets.Screen, title: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const input = blessed.textbox({ parent: screen, top: 'center', left: 'center', width: '60%', height: 3, inputOnFocus: true, keys: true, border: 'line', label: ` ${title} `, style: { border: { fg: orange }, fg: 'white' } })
    input.focus(); screen.render()
    input.once('submit', (value) => { input.destroy(); resolve(value) })
    input.key('escape', () => { input.destroy(); resolve(undefined) })
  })
}

async function devicesScreen(screen: blessed.Widgets.Screen, log: blessed.Widgets.Log) {
  try {
    const devices = await withBusy(screen, log, 'Discovering devices', discoverDevices)
    await listScreen(screen, 'Devices', [
      ...devices.map((device) => ({
        name: `${device.state === 'device' ? '●' : '○'} ${device.address}${device.model ? ` · ${device.model}` : ''}`,
        action: () => command(screen, programRef!, ['device', 'use', device.address], log),
      })),
      {
        name: 'Connect new device',
        action: async () => {
          const address = await promptInput(screen, 'IP address or host:port')
          if (!address?.trim()) return
          const name = await promptInput(screen, 'Device name (optional)')
          const args = ['connect', address.trim()]
          if (name?.trim()) args.push('--name', name.trim())
          await command(screen, programRef!, args, log)
          await devicesScreen(screen, log)
        },
      },
      { name: 'Refresh devices', action: () => devicesScreen(screen, log) },
      { name: 'Back to main menu', action: () => mainMenu(screen, log) },
    ], log)
  } catch (error: unknown) {
    log.add(`{${red}-fg}Error: ${error instanceof Error ? error.message : String(error)}{/}`)
    await mainMenu(screen, log)
  }
}

let programRef: Command | undefined

async function textInput(screen: blessed.Widgets.Screen, log: blessed.Widgets.Log) {
  const input = blessed.textbox({ parent: screen, top: 'center', left: 'center', width: '60%', height: 3, inputOnFocus: true, keys: true, border: 'line', label: ' Type text (enter to send) ', style: { border: { fg: orange }, fg: 'white' } })
  input.focus(); screen.render()
  input.once('submit', async (value) => { input.destroy(); await command(screen, programRef!, ['type', value], log); mainMenu(screen, log) })
  input.key('escape', () => { input.destroy(); mainMenu(screen, log) })
}

async function runCommandInput(screen: blessed.Widgets.Screen, log: blessed.Widgets.Log) {
  const input = blessed.textbox({ parent: screen, top: 'center', left: 'center', width: '60%', height: 3, inputOnFocus: true, keys: true, border: 'line', label: ' firetv command (enter to run) ', style: { border: { fg: orange }, fg: 'white' } })
  input.focus(); screen.render()
  input.once('submit', async (value) => {
    input.destroy()
    const args = value.trim().split(/\s+/).filter(Boolean)
    if (args.length) await command(screen, programRef!, args, log)
    mainMenu(screen, log)
  })
  input.key('escape', () => { input.destroy(); mainMenu(screen, log) })
}

async function screenshotInput(screen: blessed.Widgets.Screen, log: blessed.Widgets.Log) {
  const destination = await promptInput(screen, 'Screenshot path (optional)')
  if (destination === undefined) return mainMenu(screen, log)
  await runTuiCommand(screen, ['screenshot', ...(destination.trim() ? [destination.trim()] : [])], log)
  mainMenu(screen, log)
}

async function mainMenu(screen: blessed.Widgets.Screen, log: blessed.Widgets.Log) {
  frame(screen, 'Control your Fire TV', log)
  await devicePanel(screen)
  const list = blessed.list({ parent: screen, top: 9, left: 2, width: '45%', bottom: 2, keys: true, vi: true, mouse: true,
    items: interactiveMenuItems.map((item) => `${item.key}  ${item.label}`), style: { selected: { bg: orange, fg: 'black' }, item: { fg: 'white' } }, border: 'line', label: ' Menu ' })
  list.focus()
  const activate = async () => {
    await actionLock.run(async () => {
      clearActivity(log)
      const item = interactiveMenuItems[(list as blessed.Widgets.ListElement & { selected: number }).selected]
      if (!item || item.key === 'q') return process.exit(0)
      if (item.key === 'r') return remoteScreen(screen, log)
      if (item.key === 't') return textInput(screen, log)
      if (item.key === 'c') return runCommandInput(screen, log)
      if (item.key === 'v') return devicesScreen(screen, log)
      if (item.key === 's') return screenshotInput(screen, log)
      if (item.key === 'o') return runTuiCommand(screen, ['reboot'], log)
      if (item.key === 'x') return runTuiCommand(screen, ['disconnect'], log)
      const submenu = item.key === 'b' ? 'debloat' : item.key === 'e' ? 'telemetry' : item.key === 'g' ? 'settings' : item.key === 'l' ? 'launchers' : item.key === 'k' ? 'backups' : undefined
      if (item.key === 'a') return appScreen(screen, log)
      if (submenu) return submenuScreen(screen, submenu[0].toUpperCase() + submenu.slice(1), interactiveSubmenus[submenu], log)
      if (item.key === 'd') await runTuiCommand(screen, ['status'], log)
      screen.render()
    })
  }
  list.key(selectionEvents[0], activate)
  list.on(selectionEvents[1], (_item, index: number) => { list.select(index); void activate() })
  interactiveMenuItems.forEach((item, index) => list.key(item.key, () => { list.select(index); void activate() }))
  screen.key('escape', () => {})
  screen.render()
}

export async function runInteractive(program: Command) {
  programRef = program
  const screen = createScreen()
  const log = blessed.log({ parent: screen, top: interactivePanelLayout.output.top, right: interactivePanelLayout.output.right, width: interactivePanelLayout.output.width, bottom: interactivePanelLayout.output.bottom, border: 'line', label: ' Activity ', tags: true, scrollable: true, alwaysScroll: true, style: { border: { fg: '#444' }, fg: 'white' } })
  await mainMenu(screen, log)
}
