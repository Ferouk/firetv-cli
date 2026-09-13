import { execa } from 'execa'
import { mkdir, mkdtemp, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { CliError } from '../utils/errors.js'

export function apkeepArgs(packageName: string, outputPath: string, source = 'f-droid') {
  return ['-a', packageName, '-d', source, outputPath]
}

export async function downloadWithApkeep(packageName: string, source = 'f-droid'): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'firetv-apkeep-'))
  await mkdir(directory, { recursive: true })
  try {
    await execa('apkeep', apkeepArgs(packageName, directory, source), { reject: true })
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message.split('\n')[0] : String(error)
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      throw new CliError('apkeep was not found in PATH. Install apkeep first.')
    throw new CliError(`apkeep failed: ${detail}`)
  }
  const files = (await readdir(directory)).filter((name) => name.toLowerCase().endsWith('.apk'))
  if (!files.length) throw new CliError(`apkeep downloaded no APK for ${packageName}`)
  return join(directory, files[0])
}
