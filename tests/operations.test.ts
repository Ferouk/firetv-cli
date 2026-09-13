import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createPlan } from '../src/services/operations.js'

describe('operation plans', () => {
  it('previews empty plans and warnings', () => {
    const plan = createPlan('Demo', [], ['Nothing selected'])
    assert.match(plan.preview(), /No changes required/)
    assert.match(plan.preview(), /Nothing selected/)
  })

  it('applies changes in order and stops after a failure', async () => {
    const applied: string[] = []
    const plan = createPlan('Demo', [
      { description: 'one', reversible: true, apply: async () => applied.push('one') },
      {
        description: 'two',
        reversible: true,
        apply: async () => {
          throw new Error('broken')
        },
      },
      { description: 'three', reversible: true, apply: async () => applied.push('three') },
    ])
    const result = await plan.apply()
    assert.deepEqual(applied, ['one'])
    assert.deepEqual(
      result.map((item) => item.status),
      ['applied', 'failed'],
    )
    assert.equal(result[1].error, 'broken')
  })
})
