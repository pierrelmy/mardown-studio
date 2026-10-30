import { useState } from 'react'
import { defaultPreferences, type Preferences } from '../shared/types'
import { Toolbar } from './components/Toolbar'
import { Sidebar } from './components/Sidebar'
import { Editor } from './components/Editor'
import { Preview } from './components/Preview'
import { Tabs, type Tab } from './components/Tabs'
import { StatusBar } from './components/StatusBar'
export default function App() {
  const [preferences, setPreferences] = useState(defaultPreferences)
  const update = (patch: Partial<Preferences>) => setPreferences(prev => ({ ...prev, ...patch }))
  const [draft, setDraft] = useState<Tab | null>(null)
  const create = () => setDraft({ id: 'draft', path: null, name: 'Sans titre.md', content: '# Une nouvelle idée\n\nCommencez à écrire…', savedContent: '', revision: '', state: 'dirty' })
  const noop = () => {}
  return <div className="app" data-theme={preferences.theme}><Toolbar preferences={preferences} update={update} save={noop} openFile={noop} openFolder={noop} create={create} exportDocument={noop} hasDocument={false} /><div className="app-body">{preferences.sidebar && <Sidebar workspace={null} open={noop} openWorkspace={noop} action={noop} refresh={noop} />}<main className="main"><Tabs tabs={draft ? [draft] : []} activeId={draft?.id ?? null} select={noop} close={() => setDraft(null)} create={create} />{draft ? <div className="document-area">{preferences.mode !== 'preview' && <Editor id={draft.id} content={draft.content} theme={preferences.theme} change={content => setDraft({ ...draft, content })} />}{preferences.mode !== 'editor' && <Preview content={draft.content} path={null} theme={preferences.theme} />}</div> : <div className="welcome"><div className="welcome-mark">M↓</div><h1>De l’idée à la page.</h1><p>Un espace calme pour écrire, organiser et donner forme à vos idées.</p><button className="primary" onClick={create}>Nouveau document</button></div>}</main></div><StatusBar tab={draft ?? undefined} autosave={preferences.autosave} toggleAutosave={() => update({ autosave: !preferences.autosave })} /></div>
}
