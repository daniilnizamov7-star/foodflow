import { useState, useEffect } from 'react'
import Client from './client'
import Admin from './admin'
import './index.css'

function App() {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768)
  const isAdmin = window.location.pathname === '/admin'

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // На телефоне — только одна страница
  if (!isDesktop) {
    return isAdmin ? <Admin /> : <Client />
  }

  // На десктопе — обе панели рядом
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '420px 1fr',
      minHeight: '100vh',
      background: '#fdf8f0',
      maxWidth: 1400,
      margin: '0 auto',
    }}>
      <div style={{
        borderRight: '2px solid rgba(139,69,19,.1)',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }}>
        <Client />
      </div>
      <div style={{
        height: '100vh',
        overflowY: 'auto',
        background: '#fff8f0',
      }}>
        <Admin />
      </div>
    </div>
  )
}

export default App