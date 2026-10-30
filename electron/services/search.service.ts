import { promises as fs } from 'node:fs'
import { FileService, inside, stringArgument, StudioError } from './file.service'
import { findTextMatches, type SearchResults } from '../../shared/search'
import type { FileNode } from '../../shared/types'
export class WorkspaceSearchService {
  private generation = 0
  constructor(private files: FileService) {}
  cancel(): void {
    this.generation++
  }
  async search(raw: unknown, matchCase: unknown): Promise<SearchResults> {
    const generation = ++this.generation
    const query = stringArgument(raw, 200)
    if (!query.trim() || /[\r\n]/.test(query) || typeof matchCase !== 'boolean')
      throw new StudioError(
        'Saisissez une recherche sur une seule ligne (200 caractères maximum).',
        'INVALID',
      )
    const root = this.files.workspace
    if (!root)
      throw new StudioError('Ouvrez un dossier pour rechercher dans le workspace.', 'INVALID')
    const result: SearchResults = { matches: [], scannedFiles: 0, skippedFiles: 0, limited: false }
    const flatten = (nodes: FileNode[]): string[] =>
      nodes.flatMap((node) => (node.kind === 'file' ? [node.path] : flatten(node.children ?? [])))
    const paths = flatten(await this.files.tree())
    let bytes = 0
    for (const path of paths) {
      if (generation !== this.generation || this.files.workspace !== root)
        throw new StudioError('Recherche annulée.', 'CANCELLED')
      if (result.matches.length >= 300) {
        result.limited = true
        break
      }
      try {
        const canonical = await this.files.authorize(path)
        if (!inside(root, canonical)) {
          result.skippedFiles++
          continue
        }
        const stat = await fs.stat(canonical)
        if (bytes + stat.size > 50 * 1024 * 1024) {
          result.limited = true
          result.skippedFiles++
          continue
        }
        bytes += stat.size
        const document = await this.files.read(canonical)
        if (!inside(root, document.path)) {
          result.skippedFiles++
          continue
        }
        result.scannedFiles++
        result.matches.push(
          ...findTextMatches(
            document.content,
            query,
            document.path,
            matchCase,
            300 - result.matches.length,
          ),
        )
        if (result.matches.length >= 300) result.limited = true
      } catch {
        result.skippedFiles++
      }
    }
    if (generation !== this.generation || this.files.workspace !== root)
      throw new StudioError('Recherche annulée.', 'CANCELLED')
    return result
  }
}
