import { createRequire } from 'node:module'
import { promises as fs, constants } from 'node:fs'
import { dirname, join, basename, relative, isAbsolute } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import semver from 'semver'
import type { UpdateBackend } from './update.service'
const execute = promisify(execFile)
// Bypass Electron's virtual ASAR traversal when deleting prepared/old application bundles.
const physicalFs: typeof fs = process.versions.electron
  ? createRequire(import.meta.url)('original-fs').promises
  : fs
export interface MacAsset {
  name: string
  browser_download_url: string
  size: number
  digest: string | null
}
export function selectMacAsset(assets: MacAsset[], arch: string, repository: string): MacAsset {
  const eligible = assets.filter((asset) =>
    new RegExp(`-(?:mac|darwin)-(?:${arch}|universal)\\.zip$`).test(asset.name),
  )
  const asset = eligible.find((asset) => asset.name.endsWith(`-${arch}.zip`)) ?? eligible[0]
  if (
    !asset ||
    !/^sha256:[a-f\d]{64}$/i.test(asset.digest ?? '') ||
    !Number.isSafeInteger(asset.size) ||
    asset.size <= 0 ||
    asset.size > 2 * 1024 ** 3 ||
    !asset.browser_download_url.startsWith(`https://github.com/${repository}/releases/download/`)
  )
    throw new Error(
      'La release ne contient pas de ZIP macOS compatible avec une empreinte SHA-256 GitHub valide.',
    )
  return asset
}
export function validateArchiveEntries(entries: string[], bundleName: string): void {
  if (!entries.length) throw new Error('Archive vide.')
  for (const entry of entries) {
    if (
      entry.includes('\\') ||
      entry.startsWith('/') ||
      entry.split('/').includes('..') ||
      entry.includes('\0') ||
      !(entry === bundleName || entry.startsWith(`${bundleName}/`) || entry.startsWith('__MACOSX/'))
    )
      throw new Error('L’archive contient un chemin non autorisé.')
  }
}
async function validateBundle(bundle: string, version: string, arch: string): Promise<void> {
  if (!(await fs.lstat(bundle)).isDirectory()) throw new Error('Le bundle téléchargé est invalide.')
  const plist = join(bundle, 'Contents', 'Info.plist')
  const identifier = (
    await execute('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleIdentifier', plist])
  ).stdout.trim()
  const actualVersion = (
    await execute('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleShortVersionString', plist])
  ).stdout.trim()
  if (identifier !== 'studio.markdown.app' || semver.valid(actualVersion) !== semver.valid(version))
    throw new Error('L’identité ou la version du bundle ne correspond pas à la release.')
  await execute('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle])
  const architectures = (
    await execute('/usr/bin/lipo', ['-archs', join(bundle, 'Contents', 'MacOS', 'Markdown Studio')])
  ).stdout
  if (!architectures.split(/\s+/).includes(arch === 'x64' ? 'x86_64' : arch))
    throw new Error('Architecture incompatible.')
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isSymbolicLink()) {
        const target = await fs.realpath(path)
        const rel = relative(bundle, target)
        if (rel === '..' || rel.startsWith('../') || isAbsolute(rel))
          throw new Error('Le bundle contient un lien externe.')
      } else if (entry.isDirectory()) await visit(path)
    }
  }
  await visit(bundle)
}
export async function cleanupMacUpdateFiles(userData: string, appPath: string): Promise<void> {
  const manifest = join(userData, 'updates', 'cleanup.json')
  try {
    const targets: unknown = JSON.parse(await fs.readFile(manifest, 'utf8'))
    if (!Array.isArray(targets)) return
    const parent = await fs.realpath(dirname(appPath))
    for (const target of targets) {
      if (
        typeof target !== 'string' ||
        (await fs.realpath(dirname(target))) !== parent ||
        !(
          basename(target).startsWith(`${basename(appPath)}.backup-`) ||
          basename(target).startsWith('.markdown-studio-update-')
        )
      )
        throw new Error('Chemin de nettoyage invalide.')
      await physicalFs.rm(target, { recursive: true, force: true })
    }
    await fs.rm(manifest, { force: true })
  } catch {
    /* retry on the next timer tick after the old helper has exited */
  }
}
export function createMacUpdateBackend(options: {
  repository: string
  version: string
  appPath: string
  userData: string
  resourcesPath: string
  executable: string
  arch: string
  quit: () => void
  parentPid?: number
  request?: typeof fetch
}): UpdateBackend {
  const request = options.request ?? fetch
  const pendingPath = join(options.userData, 'updates', 'prepared.json')
  const cleanup = (async () => {
    try {
      const pending = JSON.parse(await fs.readFile(pendingPath, 'utf8')) as { stagingRoot: string }
      const appParent = await fs.realpath(dirname(options.appPath))
      if (
        typeof pending.stagingRoot === 'string' &&
        dirname(pending.stagingRoot) === appParent &&
        basename(pending.stagingRoot).startsWith('.markdown-studio-update-')
      ) {
        await physicalFs.rm(pending.stagingRoot, { recursive: true, force: true })
      }
      await fs.rm(pendingPath, { force: true })
    } catch {
      /* no abandoned prepared update */
    }
  })()
  let selected: { version: string; asset: MacAsset } | null = null
  let installation: Record<string, unknown> | null = null
  let progress = (_percent: number) => {}
  return {
    onProgress: (callback) => {
      progress = callback
    },
    onError: () => {},
    check: async () => {
      await cleanup
      const response = await request(
        `https://api.github.com/repos/${options.repository}/releases/latest`,
        {
          headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Markdown-Studio' },
          signal: AbortSignal.timeout(15000),
        },
      )
      if (!response.ok)
        throw new Error(
          response.status === 404
            ? 'Aucune release publique disponible pour le moment.'
            : `GitHub est indisponible (HTTP ${response.status}).`,
        )
      const release = (await response.json()) as {
        tag_name: string
        assets: MacAsset[]
        draft: boolean
        prerelease: boolean
      }
      const version = semver.valid(release.tag_name)
      if (
        !version ||
        release.draft ||
        release.prerelease ||
        semver.prerelease(version) ||
        !Array.isArray(release.assets)
      )
        throw new Error('Release GitHub invalide.')
      if (!semver.gt(version, options.version)) return null
      selected = {
        version,
        asset: selectMacAsset(release.assets, options.arch, options.repository),
      }
      installation = null
      return version
    },
    download: async () => {
      if (!selected) throw new Error('Vérifiez les mises à jour avant de télécharger.')
      const appPath = await fs.realpath(options.appPath)
      if (!appPath.endsWith('.app') || appPath.startsWith('/Volumes/'))
        throw new Error('Installez Markdown Studio dans Applications avant de le mettre à jour.')
      await fs.access(dirname(appPath), constants.W_OK)
      const cacheRoot = join(options.userData, 'updates')
      await fs.mkdir(cacheRoot, { recursive: true, mode: 0o700 })
      const cache = await fs.mkdtemp(join(cacheRoot, 'download-'))
      const archive = join(cache, 'update.zip')
      let stagingRoot: string | null = null
      try {
        const response = await request(selected.asset.browser_download_url, {
          signal: AbortSignal.timeout(600000),
        })
        if (!response.ok || !response.body || !response.url.startsWith('https:'))
          throw new Error('Le téléchargement a échoué.')
        const handle = await fs.open(archive, 'wx', 0o600)
        const hash = createHash('sha256')
        let bytes = 0
        try {
          for await (const chunk of response.body) {
            bytes += chunk.byteLength
            if (bytes > selected.asset.size) throw new Error('Taille de téléchargement incorrecte.')
            hash.update(chunk)
            await handle.writeFile(chunk)
            progress((bytes / selected.asset.size) * 100)
          }
          await handle.sync()
        } finally {
          await handle.close()
        }
        if (
          bytes !== selected.asset.size ||
          `sha256:${hash.digest('hex')}` !== selected.asset.digest?.toLowerCase()
        )
          throw new Error(
            'L’empreinte du téléchargement ne correspond pas à GitHub. Aucune installation n’a été effectuée.',
          )
        const entries = (
          await execute('/usr/bin/unzip', ['-Z1', archive], { maxBuffer: 32 * 1024 * 1024 })
        ).stdout
          .split('\n')
          .filter(Boolean)
        validateArchiveEntries(entries, basename(appPath))
        stagingRoot = await fs.mkdtemp(join(dirname(appPath), '.markdown-studio-update-'))
        await fs.writeFile(pendingPath, JSON.stringify({ stagingRoot }), { mode: 0o600 })
        await execute('/usr/bin/ditto', ['-x', '-k', archive, stagingRoot])
        const stagedApp = join(stagingRoot, basename(appPath))
        await validateBundle(stagedApp, selected.version, options.arch)
        const token = randomUUID()
        installation = {
          userData: options.userData,
          parentPid: options.parentPid ?? process.pid,
          token,
          version: selected.version,
          appPath,
          stagingRoot,
          stagedApp,
          backupPath: `${appPath}.backup-${token}`,
          receiptPath: join(cacheRoot, `${token}.ready`),
          resultPath: join(cacheRoot, 'last-result.json'),
        }
      } catch (error) {
        await fs.rm(pendingPath, { force: true }).catch(() => {})
        if (stagingRoot)
          await physicalFs.rm(stagingRoot, { recursive: true, force: true }).catch(() => {})
        throw error
      } finally {
        await fs.rm(cache, { recursive: true, force: true }).catch(() => {})
      }
    },
    install: async () => {
      if (!installation) throw new Error('Aucun paquet vérifié n’est prêt.')
      const config = join(options.userData, 'updates', `${installation.token}.json`)
      await fs.writeFile(config, JSON.stringify(installation), { mode: 0o600 })
      await new Promise<void>((resolve, reject) => {
        const helper = spawn(
          options.executable,
          [join(options.resourcesPath, 'update-helper.cjs'), config],
          { detached: true, stdio: 'ignore', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } },
        )
        helper.once('spawn', () => {
          helper.unref()
          resolve()
        })
        helper.once('error', reject)
      })
      options.quit()
    },
  }
}
