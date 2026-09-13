import { selectedAdb } from './adb.js'
import { createPlan, type OperationPlan } from './operations.js'
import { disablePlan } from './packageState.js'
export const telemetrySettings = [
  ['global', 'amazon:device_metrics_opt_in', '0', 'Device metrics'],
  ['global', 'limit_ad_tracking', '1', 'Advertising tracking'],
  ['global', 'amazon:interest_based_ads', '0', 'Interest-based ads'],
  ['global', 'amazon:sidewalk_enabled', '0', 'Amazon Sidewalk'],
  ['secure', 'usage_stats', '0', 'Usage statistics'],
  ['global', 'amazon:data_monitoring_consent', '0', 'Data monitoring consent'],
  ['global', 'amazon:acr_enabled', '0', 'Automatic Content Recognition'],
] as const
export async function telemetryStatus() {
  const { adb } = await selectedAdb()
  return Promise.all(
    telemetrySettings.map(async ([namespace, key, target, description]) => ({
      namespace,
      key,
      target,
      description,
      current: await adb.shell(['settings', 'get', namespace, key]).catch(() => 'unavailable'),
    })),
  )
}
export async function telemetryPlan(): Promise<OperationPlan> {
  const { adb } = await selectedAdb()
  const settings = await telemetryStatus()
  const packages = [
    'com.amazon.device.metrics',
    'com.amazon.tv.acr',
    'com.amazon.hybridadidservice',
    'com.amazon.sneakpeek',
    'com.amazon.ftvads.deeplinking',
  ]
  const packagePlan = await disablePlan(packages).catch(() =>
    createPlan('Telemetry services', [], ['Some telemetry packages are unavailable']),
  )
  return createPlan(
    'Strip telemetry',
    [
      ...settings
        .filter((item) => item.current !== item.target)
        .map((item) => ({
          description: `${item.description}: ${item.current} → ${item.target}`,
          reversible: true,
          apply: () =>
            adb
              .shell(['settings', 'put', item.namespace, item.key, item.target])
              .then(() => undefined),
        })),
      ...packagePlan.changes,
    ],
    packagePlan.warnings,
  )
}
