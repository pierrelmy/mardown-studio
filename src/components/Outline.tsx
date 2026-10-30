import { useMemo } from 'react'
import { ListTree } from 'lucide-react'
import { extractHeadings, type Heading } from '../services/headings'
export function Outline({
  content,
  hasDocument,
  navigate,
}: {
  content: string
  hasDocument: boolean
  navigate: (heading: Heading) => void
}) {
  const headings = useMemo(() => extractHeadings(content), [content])
  return (
    <section className="outline-panel" aria-label="Sommaire du document">
      <div className="sidebar-heading">
        <span>SOMMAIRE</span>
        <ListTree size={14} />
      </div>
      {!hasDocument ? (
        <p className="sidebar-hint">Ouvrez un document pour parcourir ses titres.</p>
      ) : !headings.length ? (
        <p className="sidebar-hint">
          Ajoutez des titres Markdown avec # pour structurer votre document.
        </p>
      ) : (
        <nav aria-label="Titres du document">
          {headings.map((heading) => (
            <button
              key={heading.id}
              className="outline-entry"
              style={{ paddingLeft: 15 + (heading.level - 1) * 12 }}
              title={`Ligne ${heading.line}`}
              onClick={() => navigate(heading)}
            >
              <span className="outline-level">H{heading.level}</span>
              <span>{heading.title}</span>
            </button>
          ))}
        </nav>
      )}
    </section>
  )
}
