import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fireTvLaunchers } from '../src/services/launcherCatalog.js'

describe('Fire TV launcher catalog', () => {
  it('contains Fire TV-focused launcher packages', () => {
    assert.deepEqual(
      fireTvLaunchers.map((item) => item.packageName),
      [
        'com.spocky.projengmenu',
        'com.wolf.firelauncher',
        'me.efesser.flauncher',
        'com.amazon.tv.leanbacklauncher',
      ],
    )
  })
})
