import { selectedAdb } from './adb.js'
import { createPlan, type OperationPlan } from './operations.js'
export const managedSettings = [
  ['system', 'screen_brightness_mode', '0', 'Manual brightness'],
  ['global', 'transition_animation_scale', '0.5', 'Transition animations'],
  ['global', 'window_animation_scale', '0.5', 'Window animations'],
  ['global', 'animator_duration_scale', '0.5', 'Animator duration'],
  ['global', 'stay_on_while_plugged_in', '3', 'Stay awake while charging'],
] as const
export async function readSettings() {
  const { adb } = await selectedAdb()
  return Promise.all(
    managedSettings.map(async ([namespace, key, target, description]) => ({
      namespace,
      key,
      target,
      description,
      current: await adb.shell(['settings', 'get', namespace, key]).catch(() => 'unavailable'),
    })),
  )
}
export async function settingsPlan(): Promise<OperationPlan> {
  const { adb } = await selectedAdb()
  const state = await readSettings()
  return createPlan(
    'Apply device settings',
    state
      .filter((item) => item.current !== item.target)
      .map((item) => ({
        description: `${item.description}: ${item.current} → ${item.target}`,
        reversible: true,
        apply: () =>
          adb
            .shell(['settings', 'put', item.namespace, item.key, item.target])
            .then(() => undefined),
      })),
  )
}
