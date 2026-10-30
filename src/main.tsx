import { createRoot } from 'react-dom/client'
import App from './App'
import 'katex/dist/katex.min.css'
import './styles/preview.css'
import './styles/app.css'
createRoot(document.getElementById('root')!).render(<App />)
