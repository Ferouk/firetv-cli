import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatStatus } from '../src/commands/device.js'

describe('device status', () => {
  it('formats the complete device status with labeled sections', () => {
    assert.equal(
      formatStatus({
        name: 'Living Room',
        address: '192.168.1.10:5555',
        state: 'device',
        fireOs: 'PS8123/1234',
        androidVersion: '11',
        serial: 'G070VM1234567890',
        model: 'Fire TV Stick 4K',
        manufacturer: 'Amazon',
        sdk: '30',
        resolution: 'Physical size: 1920x1080',
        storage: 'Filesystem      Size Used Avail Use% Mounted on\n/dev/block  8G  4G  4G  50% /data',
      }),
      'Device status\n\nConnection\n  Name: Living Room\n  Address: 192.168.1.10:5555\n  State: device\n\nSoftware\n  Fire OS: 8.1.2.3\n  Android: 11\n  Android SDK: 30\n\nHardware\n  Manufacturer: Amazon\n  Model: Fire TV Stick 4K\n  Serial: G070VM1234567890\n\nDisplay\n  Resolution: 1920x1080\n\nStorage\n  Data: Filesystem      Size Used Avail Use% Mounted on\n    /dev/block  8G  4G  4G  50% /data',
    )
  })
})
