import { _electron as electron } from '@playwright/test'
import { promises as fs, createReadStream } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import assert from 'node:assert/strict'
import { createMacUpdateBackend } from '../electron/services/mac-update.service.ts'

if (process.platform !== 'darwin') {
  console.log('Test installateur macOS ignoré sur cette plateforme.')
  process.exit(0)
}
const execute = promisify(execFile)
let source
for (const folder of ['mac-arm64', 'mac', 'mac-universal']) {
  const candidate = resolve('release', folder, 'Markdown Studio.app')
  try {
    await fs.access(candidate)
    source = candidate
    break
  } catch {
    /* next architecture */
  }
}
assert.ok(source, 'Exécutez npm run pack avant le test installateur.')
const root = await fs.realpath(await fs.mkdtemp(join(tmpdir(), 'studio-install-real-')))
const appPath = join(root, 'Markdown Studio.app')
const profile = join(root, 'profile')
await fs.mkdir(profile)
await execute('/bin/cp', ['-cR', source, appPath])
const archive = join(root, 'candidate.zip')
await execute('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', source, archive])
const hash = createHash('sha256')
for await (const chunk of createReadStream(archive)) hash.update(chunk)
const digest = `sha256:${hash.digest('hex')}`
const size = (await fs.stat(archive)).size
const executable = join(appPath, 'Contents', 'MacOS', 'Markdown Studio')
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
let app
let newPid
try {
  app = await electron.launch({
    executablePath: executable,
    args: [`--user-data-dir=${profile}`],
    env,
  })
  assert.equal(await fs.realpath(await app.evaluate(({ app }) => app.getPath('userData'))), profile)
  const parentPid = await app.evaluate(() => process.pid)
  const version = await app.evaluate(({ app }) => app.getVersion())
  const assetURL = `https://github.com/test/repo/releases/download/v${version}/update.zip`
  const backend = createMacUpdateBackend({
    repository: 'test/repo',
    version: '0.0.0',
    appPath,
    userData: profile,
    resourcesPath: join(appPath, 'Contents', 'Resources'),
    executable,
    arch: process.arch,
    parentPid,
    request: async (url) => {
      if (String(url).endsWith('/releases/latest'))
        return new Response(
          JSON.stringify({
            tag_name: `v${version}`,
            assets: [
              {
                name: `Markdown Studio-${version}-mac-${process.arch}.zip`,
                browser_download_url: assetURL,
                size,
                digest,
              },
            ],
            draft: false,
            prerelease: false,
          }),
        )
      assert.equal(String(url), assetURL)
      const response = new Response(Readable.toWeb(createReadStream(archive)))
      Object.defineProperty(response, 'url', { value: assetURL })
      return response
    },
    quit: () => {
      void app.evaluate(({ app }) => app.exit())
    },
  })
  assert.equal(await backend.check(), version)
  await backend.download()
  console.log('OK archive réelle : SHA-256, extraction, identité, signature ad hoc et architecture')
  const stagedRoot = (await fs.readdir(root)).find((name) =>
    name.startsWith('.markdown-studio-update-'),
  )
  assert.ok(stagedRoot)
  const stagedInode = (await fs.stat(join(root, stagedRoot, 'Markdown Studio.app'))).ino
  const resultPath = join(profile, 'updates', 'last-result.json')
  const closed = app.waitForEvent('close')
  await backend.install()
  await closed
  app = null
  let result
  for (let i = 0; i < 750; i++) {
    try {
      result = JSON.parse(await fs.readFile(resultPath, 'utf8'))
      break
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  assert.ok(result, 'Le helper n’a pas terminé dans le délai imparti')
  newPid = result.pid
  assert.equal(result.ok, true, JSON.stringify(result))
  assert.equal(result.version, version)
  assert.equal((await fs.stat(appPath)).ino, stagedInode)
  for (let i = 0; i < 100; i++) {
    if (!(await fs.readdir(root)).some((name) => name.includes('.app.backup-'))) break
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  assert.equal(
    (await fs.readdir(root)).some((name) => name.includes('.app.backup-')),
    false,
    JSON.stringify(result.cleanupErrors),
  )
  console.log('OK paquet macOS réel remplacé, relancé et confirmé prêt avec profil isolé')
  console.log(`Diagnostic installateur : ${root}`)
} finally {
  if (app) await app.evaluate(({ app }) => app.exit()).catch(() => {})
  if (newPid) {
    try {
      process.kill(newPid, 'SIGTERM')
    } catch {
      /* already stopped */
    }
  }
}
