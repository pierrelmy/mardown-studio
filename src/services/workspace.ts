import type { FileNode } from '../../shared/types'
export function workspaceFiles(nodes: FileNode[]): FileNode[] {
  return nodes.flatMap((node) =>
    node.kind === 'file' ? [node] : workspaceFiles(node.children ?? []),
  )
}
export function searchableText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()
}
export function matchesQuery(label: string, query: string): boolean {
  const text = searchableText(label)
  return searchableText(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word))
}
