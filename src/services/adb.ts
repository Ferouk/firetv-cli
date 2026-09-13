import { execa, type Options } from 'execa'
import { getAndroidToolPath } from 'android-tools-bin'
import { CliError } from '../utils/errors.js'
import type { Config } from '../config/config.js'

export function resolveAdbExecutable() {
  return getAndroidToolPath('adb')
}

export class ADBService {
  constructor(private readonly executable = resolveAdbExecutable()) {}
  async run(args: string[], options: Options = {}) {
    try {
      return await execa(this.executable, args, { reject: true, ...options })
    } catch (e: unknown) {
      const error = e as {
        code?: string
        stderr?: unknown
        shortMessage?: unknown
        message?: unknown
        exitCode?: number
      }
      if (error.code === 'ENOENT')
        throw new CliError('adb was not found in PATH. Install Android platform tools first.')
      const detail = String(error.stderr || error.shortMessage || error.message || '').split(
        '\n',
      )[0]
      throw new CliError(
        detail || `adb failed${error.exitCode ? ` (exit code ${error.exitCode})` : ''}`,
      )
    }
  }
  async shell(args: string[]) {
    return String((await this.run(['shell', ...args])).stdout ?? '').trim()
  }
  async shellOn(address: string, args: string[]) {
    return String((await this.run(['-s', address, 'shell', ...args])).stdout ?? '').trim()
  }
  async shellLines(args: string[]) {
    const output = await this.shell(args)
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }
  async connect(address: string) {
    return String((await this.run(['connect', address])).stdout ?? '').trim()
  }
  async disconnect(address?: string) {
    return String(
      (await this.run(['disconnect', ...(address ? [address] : [])])).stdout ?? '',
    ).trim()
  }
  async devices(): Promise<Array<{ address: string; state: string }>> {
    const out = String((await this.run(['devices'])).stdout ?? '')
    return out
      .split('\n')
      .slice(1)
      .map((line: string) => line.trim().split(/\s+/))
      .filter((p: string[]) => p.length >= 2 && Boolean(p[0]))
      .map(([address, state]: string[]) => ({ address, state }))
  }
  async push(local: string, remote: string) {
    return this.run(['push', local, remote])
  }
  async pull(remote: string, local: string) {
    return this.run(['pull', remote, local])
  }
  async remove(remote: string) {
    return this.shell(['rm', '-f', remote])
  }
}
export async function selectedAdb(): Promise<{ adb: ADBService; address: string; config: Config }> {
  const { loadConfig } = await import('../config/config.js')
  const config = await loadConfig()
  if (!config.device?.address) throw new CliError('No device configured. Run: firetv connect <ip>')
  const adb = new ADBService()
  const found = (await adb.devices()).find(
    (d: { address: string; state: string }) => d.address === config.device!.address,
  )
  if (found && found.state !== 'device')
    throw new CliError(
      `Device ${config.device.address} is ${found.state}. Check ADB authorization.`,
    )
  return { adb, address: config.device.address, config }
}
