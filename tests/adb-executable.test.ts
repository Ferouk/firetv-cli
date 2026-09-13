import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { basename } from 'node:path'
import { resolveAdbExecutable } from '../src/services/adb.js'

describe('adb executable', () => {
  it('resolves the packaged adb executable when available', () => {
    const previous = process.env.USE_SYSTEM_ADB
    delete process.env.USE_SYSTEM_ADB
    try {
      assert.match(basename(resolveAdbExecutable()), /^adb(?:\.exe)?$/)
    } finally {
      if (previous === undefined) delete process.env.USE_SYSTEM_ADB
      else process.env.USE_SYSTEM_ADB = previous
    }
  })
})
