import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { tmpdir } from 'node:os'
import { CliError } from '../utils/errors.js'
import { downloadWithApkeep } from './apkeep.js'

export type FireTvLauncher = {
  packageName: string
  name: string
  description: string
  source: 'github' | 'apk-pure'
  releaseApi?: string
}

export const fireTvLaunchers: FireTvLauncher[] = [
  {
    packageName: 'com.spocky.projengmenu',
    name: 'Projectivy Launcher',
    description: 'Customizable launcher; downloaded from the official GitHub release',
    source: 'github',
    releaseApi: 'https://api.github.com/repos/spocky/miproja1/releases/latest',
  },
  {
    packageName: 'com.wolf.firelauncher',
    name: 'Wolf Launcher',
    description: 'Popular Fire TV launcher with a highly customizable layout',
    source: 'apk-pure',
  },
  {
    packageName: 'me.efesser.flauncher',
    name: 'FLauncher',
    description: 'Lightweight Android TV launcher with a simple app grid',
    source: 'apk-pure',
  },
  {
    packageName: 'com.amazon.tv.leanbacklauncher',
    name: 'Leanback on Fire',
    description: 'Fire TV-oriented Leanback launcher with D-pad navigation',
    source: 'apk-pure',
  },
]

type GitHubAsset = { name: string; browser_download_url: string; digest?: string }

async function downloadProjectivy(launcher: FireTvLauncher): Promise<string> {
  const response = await fetch(launcher.releaseApi!, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'firetv-cli' },
  })
  if (!response.ok) throw new CliError(`Projectivy release request failed: HTTP ${response.status}`)
  const release = (await response.json()) as { assets: GitHubAsset[] }
  const asset = release.assets.find((item) => item.name.toLowerCase().endsWith('.apk'))
  if (!asset) throw new CliError('The Projectivy release contains no APK')
  const apk = await fetch(asset.browser_download_url)
  if (!apk.ok) throw new CliError(`Projectivy APK request failed: HTTP ${apk.status}`)
  const bytes = Buffer.from(await apk.arrayBuffer())
  if (asset.digest?.startsWith('sha256:')) {
    const hash = createHash('sha256').update(bytes).digest('hex')
    if (hash !== asset.digest.slice('sha256:'.length).toLowerCase())
      throw new CliError('Projectivy APK hash mismatch')
  }
  const directory = join(tmpdir(), 'firetv-projectivy')
  await mkdir(directory, { recursive: true })
  const path = join(directory, basename(asset.name))
  await writeFile(path, bytes)
  return path
}

export async function downloadFireTvLauncher(launcher: FireTvLauncher): Promise<string> {
  return launcher.source === 'github'
    ? downloadProjectivy(launcher)
    : downloadWithApkeep(launcher.packageName, launcher.source)
}
