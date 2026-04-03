import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { RESTAURANT_CONFIG } from './config'

const STATUS_LABELS = {
  new: { text: '🆕 Новый', color: '#f59e0b', bg: '#fef3c7' },
  confirmed: { text: '✅ Подтверждён', color: '#22c55e', bg: '#f0fdf4' },
  cooking: { text: '👨‍🍳 Готовится', color: '#3b82f6', bg: '#eff6ff' },
  ready: { text: '🎉 Готово', color: '#22c55e', bg: '#f0fdf4' },
  cancelled: { text: '❌ Отменён', color: '#ef4444', bg: '#fef2f2' },
}

const NEXT_STATUS = {
  new: 'confirmed',
  confirmed: 'cooking',
  cooking: 'ready',
}

const DEMO_NAMES = ['Амир К.', 'Зара И.', 'Рустам А.', 'Малика Т.', 'Ибрагим С.', 'Нилуфар Р.']
const DEMO_ITEMS = [
  [{ name: 'Бешбармак на одного', price: 450, qty: 1 }, { name: 'Тай-чай', price: 200, qty: 1 }],
  [{ name: 'Шашлык из баранины', price: 800, qty: 2 }, { name: 'Лепёшка', price: 50, qty: 2 }],
  [{ name: 'Лагман', price: 350, qty: 1 }, { name: 'Греческий салат', price: 450, qty: 1 }],
  [{ name: 'Плов', price: 350, qty: 2 }, { name: 'Боорсок', price: 200, qty: 1 }],
  [{ name: 'Жареные манты', price: 450, qty: 3 }, { name: 'Тай-чай', price: 200, qty: 2 }],
]

const PAYMENT_LABELS = { cash: '💵 Наличные', card: '💳 Карта', sbp: '📱 СБП' }

export default function Admin() {
  const [orders, setOrders] = useState([])
  const [filter, setFilter] = useState('all')
  const [demoMode, setDemoMode] = useState(false)
  const [logs, setLogs] = useState([])
  const [notify, setNotify] = useState(null)
  const demoRef = useRef(null)

  useEffect(() => {
    loadOrders()
    const channel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        loadOrders()
        if (payload.eventType === 'INSERT') {
          playSound()
          setNotify(payload.new.customer_name)
          addLog('🔔 Новый заказ от ' + payload.new.customer_name + ' — ' + payload.new.total + ' ₽')
          setTimeout(() => setNotify(null), 3000)
        }
        if (payload.eventType === 'UPDATE') {
          addLog('📝 Статус → ' + (STATUS_LABELS[payload.new.status]?.text || payload.new.status))
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  useEffect(() => {
    if (demoMode) {
      addLog('🎥 Демо-режим включён')
      demoRef.current = setInterval(generateDemoOrder, 4000)
    } else {
      if (demoRef.current) { clearInterval(demoRef.current); addLog('⏹ Демо выключен') }
    }
    return () => { if (demoRef.current) clearInterval(demoRef.current) }
  }, [demoMode])

  function addLog(text) {
    const time = new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLogs(l => [{ time, text }, ...l].slice(0, 20))
  }

  function playSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4)
    } catch(e) {}
  }

  async function generateDemoOrder() {
    const name = DEMO_NAMES[Math.floor(Math.random() * DEMO_NAMES.length)]
    const items = DEMO_ITEMS[Math.floor(Math.random() * DEMO_ITEMS.length)]
    const total = items.reduce((s, i) => s + i.price * i.qty, 0)
    const types = ['here', 'takeaway', 'delivery']
    const payments = ['cash', 'card', 'sbp']
    await supabase.from('orders').insert({
      customer_name: name,
      customer_phone: '+7 (9xx) xxx-xx-xx',
      order_type: types[Math.floor(Math.random() * types.length)],
      payment_method: payments[Math.floor(Math.random() * payments.length)],
      items, total, status: 'new',
      guests: Math.floor(Math.random() * 4) + 1,
    })
  }

  async function loadOrders() {
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
    setOrders(data || [])
  }

  async function updateStatus(id, status) {
    await supabase.from('orders').update({ status }).eq('id', id)
  }

  async function clearOrders() {
    await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    setOrders([]); setLogs([]); addLog('🗑 База очищена')
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)
  const todayRevenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0)
  const avgCheck = orders.length ? Math.round(todayRevenue / orders.length) : 0
  const newCount = orders.filter(o => o.status === 'new').length

  return (
    <div style={s.page}>

      {notify && <div style={s.notifyBanner}>🔔 Новый заказ от {notify}!</div>}

      <div style={s.header}>
        <div>
          <div style={s.logo}>{RESTAURANT_CONFIG.name}</div>
          <div style={{ fontSize: 10, color: '#a8906e' }}>Панель администратора</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {newCount > 0 && <div style={s.badge}>{newCount} новых</div>}
          <button
            style={{ ...s.demoBtn, background: demoMode ? '#ef4444' : '#8b4513' }}
            onClick={() => setDemoMode(d => !d)}>
            {demoMode ? '⏹ Стоп' : '🎥 Демо'}
          </button>
        </div>
      </div>

      <div style={s.stats}>
        {[
          { label: 'Заказов', val: orders.length, color: '#1a1208' },
          { label: 'Новых', val: newCount, color: '#f59e0b' },
          { label: 'Выручка', val: todayRevenue.toLocaleString('ru') + ' ₽', color: '#8b4513' },
          { label: 'Ср. чек', val: avgCheck.toLocaleString('ru') + ' ₽', color: '#2d6a4f' },
        ].map(st => (
          <div key={st.label} style={s.statCard}>
            <div style={{ fontFamily: 'Georgia,serif', fontSize: 16, fontWeight: 700, color: st.color }}>{st.val}</div>
            <div style={{ fontSize: 10, color: '#a8906e' }}>{st.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '0 18px 10px', display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0 }}>
        {[
          { key: 'all', label: 'Все' },
          { key: 'new', label: '🆕 Новые' },
          { key: 'confirmed', label: '✅ Подтверждённые' },
          { key: 'cooking', label: '👨‍🍳 Готовятся' },
          { key: 'ready', label: '🎉 Готовы' },
        ].map(f => (
          <div key={f.key} onClick={() => setFilter(f.key)} style={{
            flexShrink: 0, fontSize: 11, fontWeight: 700,
            padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
            background: filter === f.key ? '#8b4513' : '#f7f0e4',
            color: filter === f.key ? '#fff' : '#6b5740',
            border: '1px solid rgba(0,0,0,.1)',
          }}>{f.label}</div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px' }}>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#a8906e' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
            <div style={{ marginBottom: 16 }}>Заказов нет</div>
            <button style={{ ...s.btnConfirm, padding: '10px 20px', borderRadius: 10 }}
              onClick={() => setDemoMode(true)}>
              🎥 Запустить демо
            </button>
          </div>
        )}

        {filtered.map(order => {
          const sl = STATUS_LABELS[order.status] || STATUS_LABELS.new
          const next = NEXT_STATUS[order.status]
          return (
            <div key={order.id} style={{ ...s.orderCard, borderLeft: `4px solid ${sl.color}` }}>

              {/* ШАПКА ЗАКАЗА */}
              <div style={s.orderHead}>
                <div>
                  <div style={s.orderName}>{order.customer_name}</div>
                  <div style={s.orderPhone}>{order.customer_phone}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Georgia,serif', fontSize: 17, fontWeight: 700, color: '#8b4513' }}>
                    {order.total?.toLocaleString('ru')} ₽
                  </div>
                  <div style={{ fontSize: 10, color: '#a8906e' }}>
                    {new Date(order.created_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              {/* БЛЮДА */}
              <div style={{ marginBottom: 10 }}>
                {(order.items || []).map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b5740', padding: '3px 0', borderBottom: '1px dashed rgba(0,0,0,.06)' }}>
                    <span>{item.name} × {item.qty}</span>
                    <span style={{ fontWeight: 700 }}>{(item.price * item.qty).toLocaleString('ru')} ₽</span>
                  </div>
                ))}
              </div>

              {/* ДЕТАЛИ */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: sl.bg, color: sl.color }}>{sl.text}</span>
                <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: '#f7f0e4', color: '#6b5740' }}>
                  {order.order_type === 'here' ? '🍽️ В зале' : order.order_type === 'takeaway' ? '🥡 Самовывоз' : '🚗 Доставка'}
                </span>
                {order.payment_method && (
                  <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: '#f7f0e4', color: '#6b5740' }}>
                    {PAYMENT_LABELS[order.payment_method] || order.payment_method}
                  </span>
                )}
                {order.guests && (
                  <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: '#f7f0e4', color: '#6b5740' }}>
                    👥 {order.guests} гостей
                  </span>
                )}
                {order.table_number && (
                  <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: '#f7f0e4', color: '#6b5740' }}>
                    🪑 {RESTAURANT_CONFIG.tables.find(t => String(t.id) === String(order.table_number))?.name || 'Стол'}
                  </span>
                )}
              </div>

              {/* ПРЕДЗАКАЗ */}
              {order.booking_time && (
                <div style={{ background: '#fef9ec', border: '1px solid rgba(201,130,10,.2)', borderRadius: 8, padding: '7px 12px', marginBottom: 8, fontSize: 12, fontWeight: 700, color: '#c9820a' }}>
                  ⏰ Предзаказ на {order.booking_time} · {order.preorder_date === 'today' ? 'Сегодня' : 'Завтра'}
                </div>
              )}

              {/* АДРЕС */}
              {order.address && (
                <div style={{ fontSize: 11, color: '#6b5740', marginBottom: 8 }}>
                  📍 {order.address}
                </div>
              )}

              {/* КОММЕНТАРИЙ */}
              {order.comment && (
                <div style={{ background: '#f7f0e4', borderRadius: 8, padding: '7px 12px', marginBottom: 8, fontSize: 12, color: '#6b5740' }}>
                  💬 {order.comment}
                </div>
              )}

              {/* КНОПКИ */}
              <div style={{ display: 'flex', gap: 6 }}>
                {next && (
                  <button style={s.btnConfirm} onClick={() => updateStatus(order.id, next)}>
                    {next === 'confirmed' ? '✅ Принять' : next === 'cooking' ? '👨‍🍳 Готовить' : '🎉 Готово'}
                  </button>
                )}
                {order.status !== 'cancelled' && order.status !== 'ready' && (
                  <button style={s.btnCancel} onClick={() => updateStatus(order.id, 'cancelled')}>Отменить</button>
                )}
              </div>
            </div>
          )
        })}

        {/* ЛОГ */}
        {logs.length > 0 && (
          <div style={{ background: '#1a1208', borderRadius: 14, padding: 14, marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#a8906e', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
              📡 Лог событий
            </div>
            {logs.map((log, i) => (
              <div key={i} style={{ fontSize: 11, color: i === 0 ? '#fff' : 'rgba(255,255,255,.4)', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                <span style={{ color: '#a8906e', marginRight: 8 }}>{log.time}</span>{log.text}
              </div>
            ))}
          </div>
        )}

        {orders.length > 0 && (
          <button style={{ width: '100%', background: 'transparent', border: '1px solid rgba(0,0,0,.1)', borderRadius: 10, padding: 10, fontSize: 11, color: '#a8906e', cursor: 'pointer', marginBottom: 10 }}
            onClick={clearOrders}>
            🗑 Очистить все заказы
          </button>
        )}

        <div style={{ height: 20 }} />
      </div>
    </div>
  )
}

const s = {
  page: { maxWidth: 780, margin: '0 auto', minHeight: '100vh', background: '#fdf8f0', fontFamily: 'Nunito, sans-serif', display: 'flex', flexDirection: 'column', position: 'relative' },
  notifyBanner: { position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', background: '#22c55e', color: '#fff', padding: '10px 24px', borderRadius: '0 0 16px 16px', fontSize: 13, fontWeight: 800, zIndex: 1000, boxShadow: '0 4px 16px rgba(34,197,94,.4)', maxWidth: 780, width: '100%', textAlign: 'center' },
  header: { padding: '14px 18px', background: '#fdf8f0', borderBottom: '1px solid rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  logo: { fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700, color: '#8b4513' },
  badge: { background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 20 },
  demoBtn: { color: '#fff', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 11, fontWeight: 800, cursor: 'pointer' },
  stats: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, padding: '12px 18px', flexShrink: 0 },
  statCard: { background: '#fff', border: '1px solid rgba(0,0,0,.08)', borderRadius: 12, padding: '10px 8px', textAlign: 'center' },
  orderCard: { background: '#fff', border: '1px solid rgba(0,0,0,.08)', borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: '0 2px 8px rgba(139,69,19,.06)' },
  orderHead: { display: 'flex', justifyContent: 'space-between', marginBottom: 10 },
  orderName: { fontFamily: 'Georgia,serif', fontSize: 14, fontWeight: 700, color: '#1a1208' },
  orderPhone: { fontSize: 11, color: '#a8906e' },
  btnConfirm: { flex: 1, background: '#8b4513', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 0', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'Nunito,sans-serif' },
  btnCancel: { background: '#fef2f2', color: '#ef4444', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, padding: '9px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito,sans-serif' },
}
