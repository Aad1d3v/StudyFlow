import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import Website from './Website'
import App from './app/App'
import './website.css'
import './app/styles.css'

/**
 * Lightweight hash routing: the public marketing site at `/`, the full
 * StudyFlow product (with real auth) at `#/app`. Hash routing keeps the app
 * working on any static host without server-side rewrites.
 */
function useRoute(): 'site' | 'app' {
  const [route, setRoute] = useState<'site' | 'app'>(() => (window.location.hash.startsWith('#/app') ? 'app' : 'site'))
  useEffect(() => {
    const onChange = () => {
      setRoute(window.location.hash.startsWith('#/app') ? 'app' : 'site')
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

function Root() {
  const route = useRoute()
  return route === 'app' ? <App /> : <Website />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
