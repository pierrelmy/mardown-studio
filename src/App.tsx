import { useState } from 'react'
import { defaultPreferences, type Preferences } from '../shared/types'
import { Toolbar } from './components/Toolbar'
import { Sidebar } from './components/Sidebar'
import { Tabs } from './components/Tabs'
import { StatusBar } from './components/StatusBar'
export default function App() {
  const [preferences, setPreferences] = useState(defaultPreferences)
  const update = (patch: Partial<Preferences>) => setPreferences(prev => ({ ...prev, ...patch }))
  const noop = () => {}
  return <div className="app" data-theme={preferences.theme}><Toolbar preferences={preferences} update={update} save={noop} openFile={noop} openFolder={noop} create={noop} exportDocument={noop} hasDocument={false} /><div className="app-body">{preferences.sidebar && <Sidebar workspace={null} open={noop} openWorkspace={noop} action={noop} refresh={noop} />}<main className="main"><Tabs tabs={[]} activeId={null} select={noop} close={noop} create={noop} /><div className="welcome"><div className="welcome-mark">M↓</div><h1>De l’idée à la page.</h1><p>Un espace calme pour écrire, organiser et donner forme à vos idées.</p><button className="primary">Ouvrir un dossier</button></div></main></div><StatusBar autosave={preferences.autosave} toggleAutosave={() => update({ autosave: !preferences.autosave })} /></div>
}
