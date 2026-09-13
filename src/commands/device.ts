import { Command } from 'commander'
import {
  connectDevice,
  reboot,
  status,
  discoverDevices,
  selectDevice,
} from '../services/device.js'
import { info, success } from '../utils/output.js'

export function formatStatus(s: {
  name?: string
  address: string
  state: string
  fireOs?: string
  androidVersion?: string
  serial?: string
  sdk?: string
  model?: string
  manufacturer?: string
  resolution?: string
  storage?: string
}) {
  const version = s.fireOs?.match(/^PS(\d)(\d)(\d)(\d)/)
  const fireOs = version
    ? `${version[1]}.${version[2]}.${version[3]}.${version[4]}`
    : s.fireOs || 'Unknown'
  const value = (item?: string) => item?.trim() || 'Unknown'
  const multiline = (item?: string) => value(item).replace(/\n/g, '\n    ')
  const resolution = value(s.resolution).replace(/^Physical size:\s*/, '')
  return `Device status\n\nConnection\n  Name: ${value(s.name ?? 'Fire TV')}\n  Address: ${s.address}\n  State: ${s.state}\n\nSoftware\n  Fire OS: ${fireOs}\n  Android: ${value(s.androidVersion)}\n  Android SDK: ${value(s.sdk)}\n\nHardware\n  Manufacturer: ${value(s.manufacturer)}\n  Model: ${value(s.model)}\n  Serial: ${value(s.serial)}\n\nDisplay\n  Resolution: ${resolution}\n\nStorage\n  Data: ${multiline(s.storage)}`
}

export function registerDeviceCommands(program: Command) {
  const device = program.command('device').description('Discover and manage Fire TV devices')
  device
    .command('list')
    .description('List ADB devices')
    .action(async () => {
      for (const item of await discoverDevices())
        info(`${item.address} · ${item.state}${item.model ? ` · ${item.model}` : ''}`)
    })
  device
    .command('use <address>')
    .description('Select a configured ADB device')
    .action(async (address) => {
      await selectDevice(address)
      success(`Selected ${address}`)
    })
  program
    .command('connect <ip>')
    .description('Connect to a Fire TV over ADB')
    .option('-n, --name <name>', 'friendly device name')
    .action(async (ip, o) =>
      success(
        `Connected to ${o.name ? `${o.name} (${await connectDevice(ip, o.name)})` : await connectDevice(ip)}`,
      ),
    )
  program
    .command('disconnect')
    .description('Disconnect the configured device')
    .action(async () => {
      const { ADBService } = await import('../services/adb.js')
      const { loadConfig, saveConfig } = await import('../config/config.js')
      const c = await loadConfig()
      if (!c.device) {
        info('No device configured.')
        return
      }
      await new ADBService().disconnect(c.device.address)
      await saveConfig({ ...c, device: undefined })
      success(`Disconnected ${c.device.address}`)
    })
  program
    .command('status')
    .description('Show connection status')
    .action(async () => {
      const s = await status()
      info(formatStatus(s))
    })
  program
    .command('reboot')
    .description('Reboot the Fire TV')
    .action(async () => {
      await reboot()
      success('Reboot requested')
    })
}
