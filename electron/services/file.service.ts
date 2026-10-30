import { promises as fs } from 'node:fs'
import { dirname, basename, join, relative, isAbsolute, extname } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import type { DiskDocument, FileNode, Workspace } from '../../shared/types'

export class StudioError extends Error {
  constructor(message: string, public code: string) { super(message) }
}
export function stringArgument(value: unknown, max = 32768): string {
  if (typeof value !== 'string' || value.length > max || value.includes('\0')) throw new StudioError('Argument invalide.', 'INVALID')
  return value
}
export function validName(value: unknown): string {
  const name = stringArgument(value, 200).trim()
  if (!name || name === '.' || name === '..' || /[<>:"/\\|?*\x00-\x1f]/.test(name) || /[. ]$/.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(name)) throw new StudioError('Nom de fichier invalide.', 'INVALID')
  return name
}
export function revision(content: Buffer): string { return createHash('sha256').update(content).digest('hex') }
export function inside(root: string, path: string): boolean {
  const rel = relative(root, path)
  return rel === '' || (!rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && rel !== '..' && !isAbsolute(rel))
}
export class FileService {
  workspace: string | null = null
  private grants = new Set<string>()
  private queues = new Map<string, Promise<unknown>>()
  async grantFile(path: string): Promise<string> {
    const canonical = await fs.realpath(path)
    if (!/\.md$/i.test(canonical) || !(await fs.stat(canonical)).isFile()) throw new StudioError('Choisissez un fichier Markdown (.md).', 'INVALID')
    this.grants.add(canonical)
    return canonical
  }
  async openWorkspace(path: string): Promise<Workspace> {
    const canonical = await fs.realpath(path)
    if (!(await fs.stat(canonical)).isDirectory()) throw new StudioError('Dossier invalide.', 'INVALID')
    this.workspace = canonical
    return { path: canonical, tree: await this.tree() }
  }
  async authorize(path: unknown, directory = false): Promise<string> {
    const canonical = await fs.realpath(stringArgument(path))
    if (!(this.workspace && inside(this.workspace, canonical)) && !(!directory && this.grants.has(canonical))) throw new StudioError('Accès non autorisé. Ouvrez ce fichier ou dossier.', 'DENIED')
    return canonical
  }
  async read(path: unknown): Promise<DiskDocument> {
    const canonical = await this.authorize(path)
    if (!/\.md$/i.test(canonical)) throw new StudioError('Seuls les fichiers .md sont éditables.', 'INVALID')
    const stat = await fs.stat(canonical)
    if (!stat.isFile() || stat.size > 20 * 1024 * 1024) throw new StudioError('Fichier invalide ou supérieur à 20 Mo.', 'INVALID')
    const content = await fs.readFile(canonical)
    return { path: canonical, content: content.toString('utf8'), revision: revision(content) }
  }
  async save(input: unknown): Promise<DiskDocument> {
    if (!input || typeof input !== 'object') throw new StudioError('Document invalide.', 'INVALID')
    const doc = input as DiskDocument
    const path = await this.authorize(doc.path)
    stringArgument(doc.content, 20 * 1024 * 1024)
    stringArgument(doc.revision, 64)
    const previous = this.queues.get(path) ?? Promise.resolve()
    const job = previous.catch(() => {}).then(async () => {
      const current = await this.read(path)
      if (current.revision !== doc.revision) throw new StudioError('Le fichier a changé sur disque. Rechargez-le ou enregistrez une copie.', 'CONFLICT')
      const temp = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`)
      try {
        const stat = await fs.stat(path)
        const handle = await fs.open(temp, 'wx', stat.mode)
        try { await handle.writeFile(doc.content, 'utf8'); await handle.sync() } finally { await handle.close() }
        if ((await this.read(path)).revision !== doc.revision) throw new StudioError('Le fichier a changé pendant la sauvegarde.', 'CONFLICT')
        await fs.rename(temp, path)
        return { path, content: doc.content, revision: revision(Buffer.from(doc.content)) }
      } finally { await fs.rm(temp, { force: true }).catch(() => {}) }
    })
    this.queues.set(path, job)
    try { return await job } finally { if (this.queues.get(path) === job) this.queues.delete(path) }
  }
  async create(parent: unknown, input: unknown, kind: unknown): Promise<string> {
    const dir = await this.authorize(parent, true)
    let name = validName(input)
    if (kind !== 'file' && kind !== 'directory') throw new StudioError('Type invalide.', 'INVALID')
    if (kind === 'file' && !/\.md$/i.test(name)) name += '.md'
    const path = join(dir, name)
    if (kind === 'directory') await fs.mkdir(path)
    else await fs.writeFile(path, '', { flag: 'wx' })
    return path
  }
  async rename(path: unknown, input: unknown): Promise<string> {
    const source = await this.authorize(path, true)
    if (source === this.workspace) throw new StudioError('Le dossier racine ne peut pas être renommé ici.', 'INVALID')
    const name = validName(input)
    if ((await fs.stat(source)).isFile() && extname(name).toLowerCase() !== '.md') throw new StudioError('Conservez l’extension .md.', 'INVALID')
    const dest = join(dirname(source), name)
    if (source === dest) return source
    try { await fs.lstat(dest); throw new StudioError('Ce nom existe déjà.', 'EXISTS') } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    await fs.rename(source, dest)
    return dest
  }
  async removable(path: unknown): Promise<string> {
    const canonical = await this.authorize(path, true)
    if (canonical === this.workspace) throw new StudioError('Le workspace ne peut pas être supprimé.', 'INVALID')
    return canonical
  }
  async tree(): Promise<FileNode[]> {
    if (!this.workspace) return []
    let count = 0
    const visit = async (dir: string, depth: number): Promise<FileNode[]> => {
      if (depth > 24) return []
      const entries = await fs.readdir(dir, { withFileTypes: true })
      const nodes: FileNode[] = []
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.isSymbolicLink()) continue
        if (++count > 20000) throw new StudioError('Workspace trop volumineux (20 000 entrées maximum).', 'LIMIT')
        const path = join(dir, entry.name)
        if (entry.isDirectory()) nodes.push({ path, name: entry.name, kind: 'directory', children: await visit(path, depth + 1) })
        else if (entry.isFile() && /\.md$/i.test(entry.name)) nodes.push({ path, name: entry.name, kind: 'file' })
      }
      return nodes.sort((a, b) => a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1)
    }
    return visit(this.workspace, 0)
  }
  async asset(path: string): Promise<Buffer> {
    const canonical = await this.authorize(path)
    if (!/\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(canonical)) throw new StudioError('Image non prise en charge.', 'INVALID')
    if ((await fs.stat(canonical)).size > 20 * 1024 * 1024) throw new StudioError('Image trop volumineuse.', 'LIMIT')
    return fs.readFile(canonical)
  }
}
