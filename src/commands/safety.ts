import { confirm } from '@inquirer/prompts'
import { info, success } from '../utils/output.js'
import type { OperationPlan } from '../services/operations.js'
export async function runPlan(
  plan: OperationPlan,
  options: { apply?: boolean; yes?: boolean },
  beforeApply?: () => Promise<unknown>,
) {
  info(plan.preview())
  if (!options.apply) {
    if (options.yes || !(await confirm({ message: 'Apply these changes?' }))) return false
  }
  if (beforeApply) await beforeApply()
  const results = await plan.apply()
  results.forEach((item) =>
    item.status === 'applied'
      ? success(item.description)
      : info(`${item.status}: ${item.description}${item.error ? ` · ${item.error}` : ''}`),
  )
  return true
}
