export const packageProfiles = [
  { packageName: 'com.amazon.device.metrics', tier: 'TELEMETRY', reason: 'Device metrics' },
  { packageName: 'com.amazon.tv.acr', tier: 'TELEMETRY', reason: 'Automatic Content Recognition' },
  {
    packageName: 'com.amazon.hybridadidservice',
    tier: 'TELEMETRY',
    reason: 'Advertising identity',
  },
  { packageName: 'com.amazon.sneakpeek', tier: 'TELEMETRY', reason: 'Recommendations telemetry' },
  {
    packageName: 'com.amazon.ftvads.deeplinking',
    tier: 'TELEMETRY',
    reason: 'Advertising/deep links',
  },
  {
    packageName: 'com.amazon.bueller.music',
    tier: 'SAFE',
    reason: 'Optional Amazon music component',
  },
  { packageName: 'com.amazon.tv.launcher', tier: 'NEVER_TOUCH', reason: 'System launcher' },
  { packageName: 'android', tier: 'NEVER_TOUCH', reason: 'Android framework' },
  { packageName: 'com.android.systemui', tier: 'NEVER_TOUCH', reason: 'System UI' },
  {
    packageName: 'com.android.providers.downloads',
    tier: 'NEVER_TOUCH',
    reason: 'System download manager',
  },
] as const
