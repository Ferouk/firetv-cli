import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import { CliError } from '../utils/errors.js'

const schema = z.object({
  device: z.object({ address: z.string().min(1), name: z.string().optional() }).optional(),
  aliases: z.record(z.string()).optional(),
})
export type Config = z.infer<typeof schema>
export const configPath = join(homedir(), '.config', 'firetv', 'config.json')
export const backupDirectory = join(dirname(configPath), 'backups')
export async function loadConfig(): Promise<Config> {
  try {
    const raw = await readFile(configPath, 'utf8')
    const parsed = schema.safeParse(JSON.parse(raw))
    if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(', '))
    return parsed.data
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return {}
    if (e instanceof SyntaxError)
      throw new CliError(`Malformed config at ${configPath}: invalid JSON`)
    if (e instanceof CliError) throw e
    throw new CliError(`Malformed config at ${configPath}: ${(e as Error).message}`)
  }
}
export async function saveConfig(config: Config) {
  const parsed = schema.parse(config)
  await mkdir(dirname(configPath), { recursive: true })
  await writeFile(configPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')
}
