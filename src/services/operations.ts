export type OperationStatus = 'applied' | 'failed' | 'skipped'
export type OperationResult = { description: string; status: OperationStatus; error?: string }
export type OperationChange = {
  description: string
  reversible: boolean
  warning?: string
  apply: () => Promise<void>
}

export class OperationPlan {
  constructor(
    readonly title: string,
    readonly changes: OperationChange[],
    readonly warnings: string[] = [],
  ) {}

  preview() {
    return formatOperationPlan(this)
  }

  async apply(): Promise<OperationResult[]> {
    const results: OperationResult[] = []
    for (const change of this.changes) {
      try {
        await change.apply()
        results.push({ description: change.description, status: 'applied' })
      } catch (error) {
        results.push({
          description: change.description,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        })
        break
      }
    }
    return results
  }
}

export function createPlan(title: string, changes: OperationChange[], warnings: string[] = []) {
  return new OperationPlan(title, changes, warnings)
}

export function formatOperationPlan(plan: OperationPlan) {
  const lines = [`${plan.title}:`]
  if (!plan.changes.length) lines.push('  No changes required.')
  plan.changes.forEach((change, index) => {
    lines.push(`  ${index + 1}. ${change.description}${change.reversible ? ' (reversible)' : ''}`)
    if (change.warning) lines.push(`     Warning: ${change.warning}`)
  })
  for (const warning of plan.warnings) lines.push(`  Warning: ${warning}`)
  return lines.join('\n')
}
