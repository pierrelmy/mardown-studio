import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FileService, validName } from '../electron/services/file.service'
import { parseSession, loadSession, writeSession } from '../electron/services/session.service'
let root: string
let service: FileService
beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), 'studio-unit-'))
  service = new FileService()
  await service.openWorkspace(root)
})
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})
describe('workspace capabilities and file operations', () => {
  it('creates, reads, atomically saves and renames Markdown files', async () => {
    const dir = await service.create(root, 'Notes', 'directory')
    const path = await service.create(dir, 'Idée', 'file')
    const doc = await service.read(path)
    const saved = await service.save({ ...doc, content: '# Bonjour\nété 🍁' })
    expect(await fs.readFile(path, 'utf8')).toBe(saved.content)
    expect(saved.revision).not.toBe(doc.revision)
    const next = await service.rename(path, 'Bonjour.md')
    expect((await service.read(next)).content).toBe(saved.content)
    expect((await service.tree())[0].children?.[0].name).toBe('Bonjour.md')
    expect((await fs.readdir(dir)).filter((name) => name.endsWith('.tmp'))).toEqual([])
  })
  it('rejects external edits, including concurrent saves with the same revision', async () => {
    const path = await service.create(root, 'note', 'file')
    const doc = await service.read(path)
    await fs.writeFile(path, 'external')
    await expect(service.save({ ...doc, content: 'mine' })).rejects.toMatchObject({
      code: 'CONFLICT',
    })
    expect(await fs.readFile(path, 'utf8')).toBe('external')
    const latest = await service.read(path)
    const results = await Promise.allSettled([
      service.save({ ...latest, content: 'first' }),
      service.save({ ...latest, content: 'second' }),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect(['first', 'second']).toContain(await fs.readFile(path, 'utf8'))
  })
  it('denies ungranted files and symlinks that escape the workspace', async () => {
    const outside = await fs.mkdtemp(join(tmpdir(), 'studio-outside-'))
    try {
      const path = join(outside, 'secret.md')
      await fs.writeFile(path, 'private')
      await expect(service.read(path)).rejects.toMatchObject({ code: 'DENIED' })
      await fs.symlink(
        outside,
        join(root, 'escape'),
        process.platform === 'win32' ? 'junction' : 'dir',
      )
      await expect(service.read(join(root, 'escape/secret.md'))).rejects.toMatchObject({
        code: 'DENIED',
      })
      expect(await service.tree()).toEqual([])
      await service.grantFile(path)
      expect((await service.read(path)).content).toBe('private')
      await expect(service.create(outside, 'unauthorized', 'file')).rejects.toMatchObject({
        code: 'DENIED',
      })
    } finally {
      await fs.rm(outside, { recursive: true, force: true })
    }
  })
  it('protects the root, existing targets, names and file types', async () => {
    for (const name of ['../escape', '..', 'a/b', 'a\\b', 'CON', 'nul.md', 'bad.'])
      expect(() => validName(name)).toThrow()
    const a = await service.create(root, 'a.md', 'file')
    await service.create(root, 'b.md', 'file')
    await expect(service.rename(a, 'b.md')).rejects.toMatchObject({ code: 'EXISTS' })
    await expect(service.rename(a, 'a.js')).rejects.toMatchObject({ code: 'INVALID' })
    await expect(service.removable(root)).rejects.toThrow()
    await expect(service.create(root, 'a.md', 'file')).rejects.toThrow()
    await fs.writeFile(join(root, 'script.js'), 'bad')
    await expect(service.read(join(root, 'script.js'))).rejects.toMatchObject({ code: 'INVALID' })
  })
  it('returns useful errors for deleted files and handles empty files', async () => {
    const path = await service.create(root, 'empty', 'file')
    const doc = await service.read(path)
    expect(doc.content).toBe('')
    await fs.unlink(path)
    await expect(service.save({ ...doc, content: 'new' })).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
describe('session persistence', () => {
  it('normalizes corrupt preferences and persists metadata only', async () => {
    const normalized = parseSession({
      preferences: { theme: 'unknown', mode: 'unknown', split: Infinity },
      paths: [12, 'note.md'],
    })
    expect(normalized.preferences).toEqual({
      theme: 'dark',
      mode: 'split',
      autosave: true,
      sidebar: true,
      split: 50,
    })
    expect(normalized.paths).toEqual(['note.md'])
    const path = join(root, 'session.json')
    await writeSession(path, normalized)
    expect(await loadSession(path)).toEqual(normalized)
    await fs.writeFile(path, '{bad json')
    expect((await loadSession(path)).paths).toEqual([])
  })
})
