import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { apkeepArgs } from '../src/services/apkeep.js'

describe('apkeep downloader', () => {
  it('builds an F-Droid download command', () => {
    assert.deepEqual(apkeepArgs('com.conreo.couchytv', '/tmp/apks'), [
      '-a',
      'com.conreo.couchytv',
      '-d',
      'f-droid',
      '/tmp/apks',
    ])
  })
})
