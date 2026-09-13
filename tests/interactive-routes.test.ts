import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  launcherChoices,
  interactiveMenuItems,
  interactivePanelLayout,
  interactiveSubmenus,
  busyFrames,
  createActionLock,
  filterApps,
  appSearchLabel,
  headerAsciiArt,
  formatResult,
  selectionEvents,
  requiresTuiConfirmation,
} from '../src/commands/interactive.js'
import { launcherActivity } from '../src/services/launcher.js'

describe('interactive command routing', () => {
  it('uses the discovered launcher activity and falls back to MainActivity', () => {
    assert.equal(
      launcherActivity([{ packageName: 'com.example', activity: '.Home', installed: true, source: 'device' }], 'com.example'),
      '.Home',
    )
    assert.equal(launcherActivity([], 'com.example'), '.MainActivity')
  })

  it('turns discovered launchers into selectable choices', () => {
    assert.deepEqual(
      launcherChoices([
        { packageName: 'com.amazon.tv.launcher', activity: '.Home', installed: true, source: 'device' },
      ]),
      [{ name: 'com.amazon.tv.launcher/.Home', value: 'com.amazon.tv.launcher' }],
    )
  })

  it('exposes a keyboard-friendly menu model for the full-screen TUI', () => {
    assert.deepEqual(
      interactiveMenuItems.slice(0, 3).map(({ key, label }) => ({ key, label })),
      [
        { key: 'r', label: 'Remote control' },
        { key: 'a', label: 'Apps' },
        { key: 't', label: 'Type text' },
      ],
    )
    assert.equal(interactiveMenuItems.at(-1)?.key, 'q')
  })

  it('keeps command output visible in the activity panel', () => {
    assert.deepEqual(interactivePanelLayout.output, { right: 2, top: 17, width: '48%', bottom: 2 })
    assert.deepEqual(interactivePanelLayout.device, { right: 2, top: 9, width: '48%', height: 7 })
  })

  it('uses the status view as the single device information view', () => {
    assert.equal(interactiveMenuItems.some(({ label }) => label === 'Device information'), false)
  })

  it('defines navigable submenus for grouped actions', () => {
    assert.deepEqual(Object.keys(interactiveSubmenus).sort(), ['backups', 'debloat', 'launchers', 'settings', 'telemetry'])
    assert.ok(interactiveSubmenus.debloat.some(({ label }) => label === 'Run safe preset'))
    assert.ok(interactiveSubmenus.launchers.some(({ label }) => label === 'Install third-party launcher'))
    assert.ok(interactiveSubmenus.launchers.some(({ label }) => label === 'Choose launcher from list'))
    assert.ok(interactiveSubmenus.backups.some(({ label }) => label === 'Create backup'))
  })

  it('provides animated frames for long-running actions', () => {
    assert.deepEqual(busyFrames, ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'])
  })

  it('ignores a second action while the first action is running', async () => {
    const lock = createActionLock()
    let completions = 0
    let release!: () => void
    const first = lock.run(() => new Promise<void>((resolve) => { release = resolve }).then(() => { completions++ }))
    assert.equal(await lock.run(async () => { completions++ }), false)
    release()
    assert.equal(await first, true)
    assert.equal(completions, 1)
  })

  it('exposes the remaining non-interactive operations in the TUI', () => {
    assert.ok(interactiveMenuItems.some(({ label }) => label === 'Reboot'))
    assert.ok(interactiveMenuItems.some(({ label }) => label === 'Disconnect'))
    assert.ok(interactiveSubmenus.debloat.some(({ label }) => label === 'Disable package'))
    assert.ok(interactiveSubmenus.debloat.some(({ label }) => label === 'Enable package'))
    assert.ok(interactiveSubmenus.launchers.some(({ label }) => label === 'Restore launcher'))
    assert.ok(interactiveSubmenus.backups.some(({ label }) => label === 'Restore backup'))
  })

  it('filters apps by label and package name', () => {
    const apps = [
      { label: 'Plex', packageName: 'com.plexapp.android', system: false },
      { label: 'Settings', packageName: 'com.android.settings', system: true },
    ]
    assert.deepEqual(filterApps(apps, 'plex'), [apps[0]])
    assert.deepEqual(filterApps(apps, 'android.settings'), [apps[1]])
    assert.deepEqual(filterApps(apps, ''), apps)
  })

  it('keeps the app search border label compact', () => {
    assert.equal(appSearchLabel, ' Search ')
  })

  it('renders the requested block-character header logo', () => {
    assert.match(headerAsciiArt, /███████╗██╗██████╗/)
    assert.match(headerAsciiArt, /╚═╝\s+╚═╝╚═╝\s+╚═╝/)
  })

  it('formats activity output as a result card', () => {
    const result = formatResult('status', ['Device status', '', 'Connection', '  State: device'], 125)
    assert.match(result, /✓ Complete/)
    assert.match(result, /status · 125ms/)
    assert.match(result, /Connection/)
    assert.match(result, /State:/)
    assert.match(result, /gray-fg/)
    assert.match(formatResult('settings status', ['Ambient display: 0 (target 1)'], 20), /Ambient display/)
    assert.match(formatResult('backup list', ['/tmp/firetv-backup.tar.gz'], 20), /•/)
  })

  it('handles both keyboard and mouse menu selection', () => {
    assert.deepEqual(selectionEvents, ['enter', 'select'])
  })

  it('identifies mutating commands that need an in-TUI confirmation', () => {
    assert.equal(requiresTuiConfirmation(['settings', 'apply']), true)
    assert.equal(requiresTuiConfirmation(['telemetry', 'strip']), true)
    assert.equal(requiresTuiConfirmation(['settings', 'status']), false)
  })

})
