import { ADBService, selectedAdb } from './adb.js'
import { loadConfig, saveConfig } from '../config/config.js'
import { CliError } from '../utils/errors.js'
export function normalizeAddress(input: string) {
  return input.includes(':') ? input : `${input}:5555`
}
export type DeviceRecord = {
  address: string
  state: string
  model?: string
  fireOs?: string
  androidVersion?: string
  usb: boolean
}
export async function discoverDevices(): Promise<DeviceRecord[]> {
  const adb = new ADBService()
  return Promise.all(
    (await adb.devices()).map(async (item) => {
      const base: DeviceRecord = { ...item, usb: !item.address.includes(':') }
      if (item.state !== 'device') return base
      const prop = async (key: string) =>
        adb.shellOn(item.address, ['getprop', key]).catch(() => '')
      return {
        ...base,
        model: (await prop('ro.product.model')) || undefined,
        fireOs: (await prop('ro.build.version.incremental')) || undefined,
        androidVersion: (await prop('ro.build.version.release')) || undefined,
      }
    }),
  )
}
export async function selectDevice(address: string) {
  const devices = await discoverDevices()
  if (!devices.some((device) => device.address === address))
    throw new CliError(`Device not found: ${address}`)
  const config = await loadConfig()
  await saveConfig({ ...config, device: { ...config.device, address } })
}
export async function connectDevice(input: string, name?: string) {
  const address = normalizeAddress(input)
  const adb = new ADBService()
  const result = await adb.connect(address)
  if (/failed|cannot|unable/i.test(result)) throw new CliError(result)
  const current = await loadConfig()
  await saveConfig({
    ...current,
    device: {
      address,
      ...(name ? { name } : current.device?.name ? { name: current.device.name } : {}),
    },
  })
  return address
}
export async function status() {
  const { adb, address, config } = await selectedAdb()
  const item = (await adb.devices()).find(
    (d: { address: string; state: string }) => d.address === address,
  )
  const prop = async (key: string) => adb.shell(['getprop', key]).catch(() => '')
  const fireOs = await prop('ro.build.version.name')
  const androidVersion = await prop('ro.build.version.release')
  const sdk = await prop('ro.build.version.sdk')
  const model = await prop('ro.product.model')
  const manufacturer = await prop('ro.product.manufacturer')
  const serial =
    (await prop('ro.serialno')) || (await prop('ro.boot.serialno'))
  return {
    address,
    name: config.device?.name,
    state: item?.state ?? 'not found',
    fireOs,
    androidVersion,
    sdk,
    model,
    manufacturer,
    serial,
    resolution: await adb.shell(['wm', 'size']).catch(() => ''),
    storage: await adb.shell(['df', '/data']).catch(() => ''),
  }
}
export async function props() {
  const { adb, address } = await selectedAdb()
  const p = async (key: string) => adb.shell(['getprop', key]).catch(() => '')
  return {
    address,
    state: (await status()).state,
    model: await p('ro.product.model'),
    manufacturer: await p('ro.product.manufacturer'),
    os: await p('ro.build.version.release'),
    sdk: await p('ro.build.version.sdk'),
    resolution: await adb.shell(['wm', 'size']).catch(() => ''),
    storage: await adb.shell(['df', '/data']).catch(() => ''),
  }
}
export async function reboot() {
  const { adb } = await selectedAdb()
  await adb.shell(['reboot'])
}
