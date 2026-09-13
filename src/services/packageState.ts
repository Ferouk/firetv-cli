import { selectedAdb } from './adb.js'
import { createPlan, type OperationPlan } from './operations.js'
import { packageProfiles } from '../data/package-profiles.js'
import { CliError } from '../utils/errors.js'
export type PackageTier = 'SAFE' | 'RISKY' | 'TELEMETRY' | 'NEVER_TOUCH'
export type PackageProfile = { packageName: string; tier: PackageTier; reason: string }
export function getProfile(): PackageProfile[] {
  return packageProfiles.map((item) => ({ ...item, tier: item.tier as PackageTier }))
}
export function filteredProfile(tier?: PackageTier) {
  return getProfile().filter((item) => !tier || item.tier === tier)
}
export function isNeverTouch(name: string) {
  return getProfile().some((item) => item.packageName === name && item.tier === 'NEVER_TOUCH')
}
export async function packageStates() {
  const { adb } = await selectedAdb()
  const [all, disabled, system] = await Promise.all([
    adb.shellLines(['pm', 'list', 'packages']),
    adb.shellLines(['pm', 'list', 'packages', '-d']),
    adb.shellLines(['pm', 'list', 'packages', '-s']),
  ])
  return all
    .map((line) => line.replace(/^package:/, ''))
    .map((packageName) => ({
      packageName,
      disabled: disabled.includes(`package:${packageName}`),
      system: system.includes(`package:${packageName}`),
      profile: getProfile().find((item) => item.packageName === packageName),
    }))
}
async function packagePlan(names: string[], verb: 'disable-user' | 'enable') {
  const { adb } = await selectedAdb()
  for (const name of names) if (isNeverTouch(name)) throw new CliError(`Protected package: ${name}`)
  return createPlan(
    `${verb === 'enable' ? 'Enable' : 'Disable'} packages`,
    names.map((name) => ({
      description: `${verb} ${name}`,
      reversible: true,
      apply: () => adb.shell(['pm', verb, '--user', '0', name]).then(() => undefined),
    })),
  )
}
export async function disablePlan(names: string[]): Promise<OperationPlan> {
  return packagePlan(names, 'disable-user')
}
export async function enablePlan(names: string[]): Promise<OperationPlan> {
  return packagePlan(names, 'enable')
}
