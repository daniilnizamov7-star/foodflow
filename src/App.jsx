import { useState, useEffect } from 'react'
import Client from './client'
import Admin from './admin'
import './index.css'

const ADMIN_PASSWORD = 'foodflow2026'

function AdminGate() {
  const [pwd, setPwd] = useState('')
  const [auth, setAuth] = useState(() => sessionStorage.getItem('ff_admin') === '1')
  const [error, setError] = useState(false)

  function login() {
    if (pwd === ADMIN_PASSWORD) {
      sessionStorage.setItem('ff_admin', '1')
      setAuth(true)
      setError(false)
    } else {
      setError(true)
      setPwd('')
    }
  }

  if (auth) return <Admin />

  return (
    <div style={{
      minHeight: '100vh', background: '#fdf8f0',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Nunito, sans-serif', padding: 24,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: 32,
        width: '100%', maxWidth: 360,
        boxShadow: '0 8px 32px rgba(139,69,19,.12)',
        border: '1px solid rgba(0,0,0,.08)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
          <div style={{ fontFamily: 'Georgia,serif', fontSize: 20, fontWeight: 700, color: '#1a1208', marginBottom: 4 }}>
            Панель администратора
          </div>
          <div style={{ fontSize: 12, color: '#a8906e' }}>FoodFlow</div>
        </div>
        <input
          type="password"
          placeholder="Введите пароль"
          value={pwd}
          onChange={e => { setPwd(e.target.value); setError(false) }}
          onKeyDown={e => e.key === 'Enter' && login()}
          style={{
            width: '100%', background: error ? '#fef2f2' : '#f7f0e4',
            border: `1.5px solid ${error ? 'rgba(239,68,68,.4)' : 'rgba(0,0,0,.12)'}`,
            borderRadius: 10, padding: '12px 14px', fontSize: 14,
            fontFamily: 'Nunito,sans-serif', outline: 'none',
            marginBottom: 8, boxSizing: 'border-box', color: '#1a1208',
          }}
          autoFocus
        />
        {error && (
          <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 8, fontWeight: 600 }}>
            ❌ Неверный пароль
          </div>
        )}
        <button
          onClick={login}
          style={{
            width: '100%', background: '#8b4513', color: '#fff',
            border: 'none', borderRadius: 12, padding: 14,
            fontSize: 14, fontWeight: 800, cursor: 'pointer',
            fontFamily: 'Nunito,sans-serif', marginTop: 4,
          }}
        >
          Войти
        </button>
      </div>
    </div>
  )
}

function App() {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768)
  const isAdmin = window.location.pathname.startsWith('/admin')

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  if (!isDesktop) {
    return isAdmin ? <AdminGate /> : <Client />
  }

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
        <AdminGate />
      </div>
    </div>
  )
}

export default App
