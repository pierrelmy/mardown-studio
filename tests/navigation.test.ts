import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FileService } from '../electron/services/file.service'
import { WorkspaceSearchService } from '../electron/services/search.service'
import { findTextMatches } from '../shared/search'
import { createHeadingSlugger, extractHeadings } from '../src/services/headings'
import { matchesQuery, workspaceFiles } from '../src/services/workspace'

describe('literal text search', () => {
  it('reports repeated occurrences, CRLF lines and original character positions', () => {
    const matches = findTextMatches('Bonjour Bonjour\r\nDeuxième BONJOUR', 'bonjour', 'note.md')
    expect(matches.map(({ line, column }) => [line, column])).toEqual([
      [1, 1],
      [1, 9],
      [2, 10],
    ])
    expect(findTextMatches('Bonjour bonjour', 'Bonjour', 'note.md', true)).toHaveLength(1)
    expect(findTextMatches('x [a.*] y', '[a.*]', 'note.md')[0].column).toBe(3)
    expect(findTextMatches('abc', ' ', 'note.md')).toEqual([])
    expect(findTextMatches('abc', 'a\nb', 'note.md')).toEqual([])
  })
  it('centers excerpts around long-line matches and honors the result cap', () => {
    const match = findTextMatches(
      'x'.repeat(500) + 'needle' + 'y'.repeat(500),
      'needle',
      'note.md',
    )[0]
    expect(match.column).toBe(501)
    expect(match.excerpt.slice(match.from, match.to)).toBe('needle')
    expect(match.excerpt.length).toBeLessThan(200)
    expect(findTextMatches('a a a a', 'a', 'note.md', false, 2)).toHaveLength(2)
  })
})
describe('document outline', () => {
  it('ignores fenced code and math, supports Setext, nested headings and source lines', () => {
    const content =
      '# Premier\n\n```md\n# Faux\n```\n\n$$\n# Faux aussi\n$$\n\nSecond\n------\n\n> ## Dans une citation\n\n- ### Dans une liste\n'
    expect(extractHeadings(content)).toEqual([
      { id: 'premier', title: 'Premier', level: 1, line: 1 },
      { id: 'second', title: 'Second', level: 2, line: 11 },
      { id: 'dans-une-citation', title: 'Dans une citation', level: 2, line: 14 },
      { id: 'dans-une-liste', title: 'Dans une liste', level: 3, line: 16 },
    ])
  })
  it('allocates collision-free anchors and resets them for every document', () => {
    const headings = extractHeadings(
      '# Intro\n\n## Intro\n\n## Intro-2\n\n## **Été** &amp; [notes](https://example.com)\n\n## !!!\n',
    )
    expect(headings.map((heading) => heading.id)).toEqual([
      'intro',
      'intro-2',
      'intro-2-2',
      'été-notes',
      'section',
    ])
    expect(headings[3].title).toBe('Été & notes')
    expect(extractHeadings('# Intro')[0].id).toBe('intro')
    const slug = createHeadingSlugger()
    expect(slug('Intro-2')).toBe('intro-2')
    expect(slug('Intro')).toBe('intro')
    expect(slug('Intro')).toBe('intro-3')
  })
})
describe('quick navigation matching', () => {
  it('matches accent-insensitive words in any order and traverses nested files', () => {
    expect(matchesQuery('Personnaliser le thème du document', 'document theme')).toBe(true)
    expect(matchesQuery('notes/projet.md', 'autre')).toBe(false)
    expect(
      workspaceFiles([
        {
          name: 'notes',
          path: '/notes',
          kind: 'directory',
          children: [{ name: 'a.md', path: '/notes/a.md', kind: 'file' }],
        },
      ]).map((file) => file.path),
    ).toEqual(['/notes/a.md'])
  })
})
describe('authorized workspace search', () => {
  let root: string
  let files: FileService
  let search: WorkspaceSearchService
  beforeEach(async () => {
    root = await fs.mkdtemp(join(tmpdir(), 'studio-search-'))
    files = new FileService()
    await files.openWorkspace(root)
    search = new WorkspaceSearchService(files)
  })
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })
  it('searches Markdown recursively and excludes hidden and unrelated files', async () => {
    await fs.mkdir(join(root, 'nested'))
    await fs.writeFile(join(root, 'one.md'), 'needle\nNeedle')
    await fs.writeFile(join(root, 'nested/two.md'), 'A needle')
    await fs.writeFile(join(root, '.hidden.md'), 'needle')
    await fs.writeFile(join(root, 'other.txt'), 'needle')
    const result = await search.search('needle', false)
    expect(result.matches).toHaveLength(3)
    expect(result.scannedFiles).toBe(2)
    expect((await search.search('Needle', true)).matches).toHaveLength(1)
    await expect(search.search('', false)).rejects.toMatchObject({ code: 'INVALID' })
    await expect(search.search('needle', 'yes')).rejects.toMatchObject({ code: 'INVALID' })
  })
  it('cancels obsolete requests and refuses searches without a workspace', async () => {
    await fs.writeFile(join(root, 'one.md'), 'needle')
    const pending = search.search('needle', false)
    search.cancel()
    await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' })
    files.workspace = null
    await expect(search.search('needle', false)).rejects.toMatchObject({ code: 'INVALID' })
  })
  it('reports bounded results and skips files beyond the read budget', async () => {
    await fs.writeFile(join(root, 'many.md'), 'needle\n'.repeat(500))
    const result = await search.search('needle', false)
    expect(result.matches).toHaveLength(300)
    expect(result.limited).toBe(true)
    await fs.unlink(join(root, 'many.md'))
    await fs.writeFile(join(root, 'large.md'), '')
    await fs.truncate(join(root, 'large.md'), 51 * 1024 * 1024)
    const limited = await search.search('needle', false)
    expect(limited.limited).toBe(true)
    expect(limited.skippedFiles).toBe(1)
  })
})
