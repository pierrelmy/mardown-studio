import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { ChildProcess } from 'node:child_process'
import { runUpdate, validateConfig, type UpdateConfig } from '../electron/update-helper.cjs'
import {
  selectMacAsset,
  validateArchiveEntries,
  createMacUpdateBackend,
  cleanupMacUpdateFiles,
} from '../electron/services/mac-update.service'
let root: string
let config: UpdateConfig
beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), 'studio-installer-test-'))
  await fs.mkdir(join(root, 'updates'))
  const appPath = join(root, 'Markdown Studio.app')
  const stagingRoot = join(root, '.staging')
  const token = '12345678-1234-1234-1234-123456789abc'
  const stagedApp = join(stagingRoot, 'Markdown Studio.app')
  await fs.mkdir(appPath)
  await fs.mkdir(stagedApp, { recursive: true })
  await fs.writeFile(join(appPath, 'version'), 'old')
  await fs.writeFile(join(stagedApp, 'version'), 'new')
  config = {
    userData: root,
    parentPid: 123,
    token,
    version: '1.1.0',
    appPath,
    stagingRoot,
    stagedApp,
    backupPath: `${appPath}.backup-${token}`,
    receiptPath: join(root, 'updates', `${token}.ready`),
    resultPath: join(root, 'updates', 'result.json'),
  }
})
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})
describe('macOS transactional installer', () => {
  const child = {} as ChildProcess
  const ports = () => ({
    waitForExit: vi.fn(async () => {}),
    launch: vi.fn(async () => child),
    waitForReady: vi.fn(async () => {}),
    terminate: vi.fn(async () => {}),
  })
  it('replaces the bundle and removes its backup only after a successful readiness handshake', async () => {
    const io = ports()
    io.waitForReady.mockImplementation(async () => {
      expect(await fs.readFile(join(config.backupPath, 'version'), 'utf8')).toBe('old')
      expect(await fs.readFile(join(config.appPath, 'version'), 'utf8')).toBe('new')
    })
    expect(await runUpdate(config, io)).toBe(true)
    await expect(fs.stat(config.backupPath)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(io.launch).toHaveBeenCalledWith(config.appPath, [
      `--studio-update-token=${config.token}`,
      `--user-data-dir=${config.userData}`,
    ])
    expect(JSON.parse(await fs.readFile(config.resultPath, 'utf8')).ok).toBe(true)
  })
  it('restores and relaunches the original bundle if the replacement fails to start', async () => {
    const io = ports()
    io.waitForReady.mockRejectedValue(new Error('startup failed'))
    expect(await runUpdate(config, io)).toBe(false)
    expect(io.terminate).toHaveBeenCalledWith(child)
    expect(await fs.readFile(join(config.appPath, 'version'), 'utf8')).toBe('old')
    expect(io.launch).toHaveBeenLastCalledWith(config.appPath, [
      '--studio-update-failed',
      `--user-data-dir=${config.userData}`,
    ])
    expect(JSON.parse(await fs.readFile(config.resultPath, 'utf8')).error).toBe('startup failed')
  })
  it('does not replace anything if the parent refuses to quit or config is invalid', async () => {
    const io = ports()
    io.waitForExit.mockRejectedValue(new Error('still running'))
    expect(await runUpdate(config, io)).toBe(false)
    expect(await fs.readFile(join(config.appPath, 'version'), 'utf8')).toBe('old')
    expect(io.launch).not.toHaveBeenCalled()
    expect(() => validateConfig({ ...config, backupPath: root })).toThrow()
    expect(() => validateConfig({ ...config, parentPid: 0 })).toThrow()
  })
})
describe('deferred installer cleanup', () => {
  it('cleans only updater-owned adjacent bundles and never follows a manifest outside the app folder', async () => {
    await fs.mkdir(config.backupPath)
    await fs.writeFile(join(root, 'updates', 'cleanup.json'), JSON.stringify([config.backupPath]))
    await cleanupMacUpdateFiles(root, config.appPath)
    await expect(fs.stat(config.backupPath)).rejects.toMatchObject({ code: 'ENOENT' })
    const keep = join(root, 'Documents')
    await fs.mkdir(keep)
    await fs.writeFile(join(root, 'updates', 'cleanup.json'), JSON.stringify([keep]))
    await cleanupMacUpdateFiles(root, config.appPath)
    expect((await fs.stat(keep)).isDirectory()).toBe(true)
  })
})
describe('macOS download validation', () => {
  const repository = 'owner/repo'
  const asset = {
    name: 'Markdown Studio-1.1.0-mac-universal.zip',
    browser_download_url: `https://github.com/${repository}/releases/download/v1.1.0/update.zip`,
    digest: `sha256:${'a'.repeat(64)}`,
    size: 3,
  }
  it('selects only compatible archives with a GitHub digest and blocks path traversal', () => {
    expect(selectMacAsset([asset], 'arm64', repository)).toEqual(asset)
    expect(() => selectMacAsset([{ ...asset, digest: null }], 'arm64', repository)).toThrow()
    expect(() =>
      selectMacAsset(
        [{ ...asset, browser_download_url: 'https://evil.test/update.zip' }],
        'arm64',
        repository,
      ),
    ).toThrow()
    expect(() =>
      selectMacAsset([{ ...asset, name: 'update-win-x64.zip' }], 'arm64', repository),
    ).toThrow()
    validateArchiveEntries(['Markdown Studio.app/Contents/Info.plist'], 'Markdown Studio.app')
    for (const entry of [
      '../escape',
      '/tmp/evil',
      'Markdown Studio.app/../evil',
      'other.app/Contents/x',
    ])
      expect(() => validateArchiveEntries([entry], 'Markdown Studio.app')).toThrow()
  })
  it('rejects altered downloads before extraction or any application replacement', async () => {
    const download = new Response('bad')
    Object.defineProperty(download, 'url', { value: asset.browser_download_url })
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ tag_name: 'v1.1.0', assets: [asset], draft: false, prerelease: false }),
        ),
      )
      .mockResolvedValueOnce(download)
    const backend = createMacUpdateBackend({
      repository,
      version: '1.0.0',
      appPath: config.appPath,
      userData: root,
      resourcesPath: root,
      executable: 'unused',
      arch: 'arm64',
      quit: vi.fn(),
      request,
    })
    expect(await backend.check()).toBe('1.1.0')
    await expect(backend.download()).rejects.toThrow('empreinte')
    expect(await fs.readFile(join(config.appPath, 'version'), 'utf8')).toBe('old')
    await expect(backend.install()).rejects.toThrow('Aucun paquet')
  })
})
