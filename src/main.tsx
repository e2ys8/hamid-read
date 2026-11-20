import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/400-italic.css'
import '@fontsource/figtree/400.css'
import '@fontsource/figtree/500.css'
import '@fontsource/figtree/600.css'
import './styles.css'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { starteSync } from './sync/sync'

registerSW({ immediate: true })
starteSync()
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
