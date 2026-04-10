import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { RESTAURANT_CONFIG, isOpen, getEarliestPreorder, getTimeSlots, calcDishPrice, getDeliveryZone, getTakeawayDiscount, getUpsellSuggestions } from './config'

const MENU = [
  { id: 1,  name: 'Фирменное блюдо',    price: 450, emoji: '🍖', category: 'Основное',  halal: true, modifierGroups: ['meat', 'sauce'] },
  { id: 2,  name: 'Шашлык из баранины', price: 800, emoji: '🍢', category: 'Основное',  halal: true, modifierGroups: ['size', 'sauce'] },
  { id: 3,  name: 'Рёбрышки на углях',  price: 800, emoji: '🦴', category: 'Основное',  halal: true, modifierGroups: ['sauce', 'extras'] },
  { id: 4,  name: 'Суп дня',            price: 350, emoji: '🍲', category: 'Супы',      halal: true, modifierGroups: ['extras'] },
  { id: 5,  name: 'Лагман',             price: 350, emoji: '🍜', category: 'Супы',      halal: true, modifierGroups: ['extras'] },
  { id: 6,  name: 'Плов',              price: 350, emoji: '🍚', category: 'Основное',  halal: true, modifierGroups: [] },
  { id: 7,  name: 'Манты',             price: 450, emoji: '🥟', category: 'Основное',  halal: true, modifierGroups: ['sauce', 'extras'] },
  { id: 8,  name: 'Казан-кебаб',       price: 450, emoji: '🫕', category: 'Основное',  halal: true, modifierGroups: ['meat'] },
  { id: 9,  name: 'Свежий салат',      price: 350, emoji: '🥗', category: 'Салаты',    halal: true, modifierGroups: [] },
  { id: 10, name: 'Хлеб',             price: 50,  emoji: '🍞', category: 'Прочее',    halal: true, modifierGroups: [] },
  { id: 11, name: 'Выпечка дня',      price: 200, emoji: '🥐', category: 'Прочее',    halal: true, modifierGroups: [] },
  { id: 12, name: 'Чай / Кофе',       price: 150, emoji: '☕', category: 'Напитки',   halal: true, modifierGroups: ['drink_size'] },
  { id: 13, name: 'Холодный напиток', price: 100, emoji: '🧃', category: 'Напитки',   halal: true, modifierGroups: ['drink_size'] },
]

const CATEGORIES = ['Все', 'Основное', 'Супы', 'Салаты', 'Напитки', 'Прочее']

const STATUS_CONFIG = {
  new:       { text: '⏳ Ожидает подтверждения', short: 'Ожидает',    color: '#f59e0b', bg: '#fef3c7', step: 1 },
  confirmed: { text: '✅ Заказ подтверждён',     short: 'Подтверждён', color: '#3b82f6', bg: '#eff6ff', step: 2 },
  cooking:   { text: '👨‍🍳 Готовится...',          short: 'Готовится',  color: '#8b5cf6', bg: '#f5f3ff', step: 3 },
  ready:     { text: '🎉 Готово! Забирайте',     short: 'Готово!',    color: '#22c55e', bg: '#f0fdf4', step: 4 },
  delivered: { text: '🤲 Выдан',                short: 'Выдан',      color: '#6b7280', bg: '#f3f4f6', step: 5 },
  cancelled: { text: '❌ Отменён',              short: 'Отменён',    color: '#ef4444', bg: '#fef2f2', step: 0 },
}

const LS_KEY = 'ff_my_orders'

function getCurrentTime() {
  return new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
}

function itemTotal(item) {
  return calcDishPrice(item.price, item.selectedModifiers) * item.qty
}

function loadSavedOrders() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}

function saveOrders(orders) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(orders)) } catch {}
}

export default function Client() {
  const [tab, setTab] = useState('menu')
  const [screen, setScreen] = useState('menu')
  const [cart, setCart] = useState({})
  const [category, setCategory] = useState('Все')
  const [name, setName] = useState(() => localStorage.getItem('ff_name') || '')
  const [phone, setPhone] = useState(() => localStorage.getItem('ff_phone') || '')
  const [orderType, setOrderType] = useState('here')
  const [address, setAddress] = useState('')
  const [deliveryZoneId, setDeliveryZoneId] = useState(RESTAURANT_CONFIG.delivery?.zones?.[0]?.id || null)
  const [payment, setPayment] = useState('cash')
  const [comment, setComment] = useState('')
  const [isPreorder, setIsPreorder] = useState(false)
  const [preorderTime, setPreorderTime] = useState(getEarliestPreorder())
  const [tableId, setTableId] = useState(null)
  const [guests, setGuests] = useState(2)
  const [myOrders, setMyOrders] = useState(loadSavedOrders)
  const [statusNotify, setStatusNotify] = useState(null)
  const [currentTime, setCurrentTime] = useState(getCurrentTime())
  const [modifierModal, setModifierModal] = useState(null)

  const open = isOpen()
  const slots = getTimeSlots()

  useEffect(() => { localStorage.setItem('ff_name', name) }, [name])
  useEffect(() => { localStorage.setItem('ff_phone', phone) }, [phone])
  useEffect(() => { saveOrders(myOrders) }, [myOrders])
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(getCurrentTime()), 60000)
    return () => clearInterval(t)
  }, [])

  // Realtime подписка на все активные заказы
  useEffect(() => {
    const activeIds = myOrders.filter(o => !['delivered','cancelled'].includes(o.status)).map(o => o.id)
    if (!activeIds.length) return
    const channels = activeIds.map(id =>
      supabase.channel('order-' + id)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, payload => {
          const newStatus = payload.new.status
          setMyOrders(prev => { const u = prev.map(o => o.id === id ? { ...o, status: newStatus } : o); saveOrders(u); return u })
          if (newStatus === 'confirmed') { playSound('confirmed'); setStatusNotify('✅ Заказ подтверждён!'); setTimeout(() => setStatusNotify(null), 4000) }
          if (newStatus === 'ready') { playSound('ready'); setStatusNotify('🎉 Ваш заказ готов! Забирайте!'); setTimeout(() => setStatusNotify(null), 5000) }
        }).subscribe()
    )
    return () => channels.forEach(c => supabase.removeChannel(c))
  }, [myOrders.map(o => o.id).join(',')])

  const cartItems = Object.values(cart)
  const subtotal = cartItems.reduce((s, i) => s + itemTotal(i), 0)
  const deliveryZone = orderType === 'delivery' ? getDeliveryZone(deliveryZoneId) : null
  const deliveryCost = deliveryZone?.price || 0
  const takeawayDiscount = orderType === 'takeaway' ? getTakeawayDiscount(subtotal) : 0
  const total = subtotal + deliveryCost - takeawayDiscount
  const count = cartItems.reduce((s, i) => s + i.qty, 0)
  const filtered = category === 'Все' ? MENU : MENU.filter(i => i.category === category)
  const upsellItems = getUpsellSuggestions(cartItems.map(i => ({ ...MENU.find(m => m.id === i.id), ...i })), MENU)
  const activeOrders = myOrders.filter(o => !['delivered','cancelled'].includes(o.status))
  const doneOrders = myOrders.filter(o => ['delivered','cancelled'].includes(o.status))

  function playSound(type) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      if (type === 'confirmed') { osc.frequency.setValueAtTime(660, ctx.currentTime); osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15) }
      else if (type === 'ready') { osc.frequency.setValueAtTime(880, ctx.currentTime); osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1); osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.2) }
      gain.gain.setValueAtTime(0.3, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5)
    } catch(e) {}
  }

  function handleAddItem(item) {
    const groups = item.modifierGroups || []
    if (!groups.length) { addItemDirect(item, {}); return }
    const pending = {}
    groups.forEach(gId => {
      const g = RESTAURANT_CONFIG.modifierGroups?.[gId]
      if (!g) return
      pending[gId] = g.required ? (g.multiSelect ? [g.options[0].id] : g.options[0].id) : (g.multiSelect ? [] : g.options[0].id)
    })
    setModifierModal({ item, pendingMods: pending })
  }

  function addItemDirect(item, selectedModifiers) {
    const key = item.id + '_' + JSON.stringify(selectedModifiers)
    setCart(c => ({ ...c, [key]: c[key] ? { ...c[key], qty: c[key].qty + 1 } : { ...item, qty: 1, selectedModifiers, cartKey: key } }))
  }

  function removeItem(cartKey) {
    setCart(c => { const n = { ...c }; if (n[cartKey].qty > 1) n[cartKey] = { ...n[cartKey], qty: n[cartKey].qty - 1 }; else delete n[cartKey]; return n })
  }

  function toggleModOption(groupId, optId, multiSelect) {
    setModifierModal(m => {
      const prev = m.pendingMods[groupId]
      const next = multiSelect ? (Array.isArray(prev) ? prev : []).includes(optId) ? prev.filter(x => x !== optId) : [...(Array.isArray(prev) ? prev : []), optId] : optId
      return { ...m, pendingMods: { ...m.pendingMods, [groupId]: next } }
    })
  }

  function confirmModifiers() {
    if (!modifierModal) return
    const { item, pendingMods } = modifierModal
    for (const gId of (item.modifierGroups || [])) {
      const g = RESTAURANT_CONFIG.modifierGroups?.[gId]
      if (!g?.required) continue
      const val = pendingMods[gId]
      if (!val || (Array.isArray(val) && !val.length)) { alert(`Выберите: ${g.name}`); return }
    }
    addItemDirect(item, pendingMods); setModifierModal(null)
  }

  function getModsLabel(selectedModifiers) {
    if (!selectedModifiers) return ''
    return Object.entries(selectedModifiers).flatMap(([gId, val]) => {
      const g = RESTAURANT_CONFIG.modifierGroups?.[gId]; if (!g) return []
      const ids = Array.isArray(val) ? val : [val]
      return ids.map(id => g.options.find(o => o.id === id)?.label).filter(Boolean)
    }).join(' · ')
  }

  async function placeOrder() {
    if (!name.trim()) return alert('Введите ваше имя')
    if (!phone.trim()) return alert('Введите номер телефона')
    if (orderType === 'here' && !tableId) return alert('Выберите столик')
    if (orderType === 'delivery' && !address.trim()) return alert('Введите адрес доставки')
    if (orderType === 'delivery' && deliveryZone && subtotal < deliveryZone.minOrder) return alert(`Мин. заказ: ${deliveryZone.minOrder} ₽`)
    const items = cartItems.map(i => ({ name: i.name, price: calcDishPrice(i.price, i.selectedModifiers), qty: i.qty, modifiers: getModsLabel(i.selectedModifiers) || undefined }))
    const { data, error } = await supabase.from('orders').insert({
      customer_name: name, customer_phone: phone, order_type: orderType, items, total,
      address: orderType === 'delivery' ? address : null,
      delivery_zone: orderType === 'delivery' ? deliveryZoneId : null,
      table_number: tableId ? String(tableId) : null,
      booking_time: isPreorder ? preorderTime : null, status: 'new', comment,
      payment_method: payment, guests: orderType === 'here' ? guests : null,
    }).select().single()
    if (error) return alert('Ошибка: ' + error.message)
    const newOrder = { id: data.id, status: 'new', total, items, orderType, tableId, address: orderType === 'delivery' ? address : null, deliveryZone: orderType === 'delivery' ? deliveryZoneId : null, payment, isPreorder, preorderTime: isPreorder ? preorderTime : null, createdAt: new Date().toISOString(), customerName: name }
    setMyOrders(prev => [newOrder, ...prev])
    setCart({}); setComment(''); setScreen('menu'); setTab('orders')
  }

  // Модальное окно модификаторов
  if (modifierModal) {
    const { item, pendingMods } = modifierModal
    const extraCost = calcDishPrice(item.price, pendingMods) - item.price
    return (
      <div style={s.page}>
        <div style={s.header}><div style={s.logo}>{RESTAURANT_CONFIG.name}</div></div>
        <div style={s.backRow}>
          <button style={s.backBtn} onClick={() => setModifierModal(null)}>← Назад</button>
          <div style={s.sectionTitle}>{item.emoji} {item.name}</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>
          <div style={{ fontSize: 13, color: '#a8906e', marginBottom: 16 }}>Базовая цена: {item.price} ₽{extraCost > 0 ? ` + ${extraCost} ₽` : ''}</div>
          {(item.modifierGroups || []).map(gId => {
            const g = RESTAURANT_CONFIG.modifierGroups?.[gId]; if (!g) return null
            const val = pendingMods[gId]
            return (
              <div key={gId} style={{ marginBottom: 20 }}>
                <div style={s.label}>{g.name}{g.required ? ' *' : ''}{g.multiSelect ? ' (несколько)' : ''}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {g.options.map(opt => {
                    const selected = g.multiSelect ? (Array.isArray(val) && val.includes(opt.id)) : val === opt.id
                    return (
                      <div key={opt.id} onClick={() => toggleModOption(gId, opt.id, g.multiSelect)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: selected ? '#fdf0e8' : '#f7f0e4', border: `1.5px solid ${selected ? 'rgba(139,69,19,.4)' : 'rgba(0,0,0,.1)'}`, borderRadius: 12, padding: '11px 14px', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 18, height: 18, borderRadius: g.multiSelect ? 4 : '50%', border: `2px solid ${selected ? '#8b4513' : 'rgba(0,0,0,.2)'}`, background: selected ? '#8b4513' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {selected && <span style={{ color: '#fff', fontSize: 10, fontWeight: 900 }}>✓</span>}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: selected ? '#8b4513' : '#1a1208' }}>{opt.label}</span>
                        </div>
                        {opt.priceAdd !== 0 && <span style={{ fontSize: 12, fontWeight: 700, color: opt.priceAdd > 0 ? '#8b4513' : '#22c55e' }}>{opt.priceAdd > 0 ? `+${opt.priceAdd}` : opt.priceAdd} ₽</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ padding: '12px 18px 24px' }}>
          <button style={s.btnPrimary} onClick={confirmModifiers}>Добавить · {calcDishPrice(item.price, pendingMods)} ₽</button>
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      {statusNotify && <div style={s.notifyBanner}>{statusNotify}</div>}

      {/* ШАПКА */}
      <div style={s.header}>
        <div>
          <div style={s.logo}>{RESTAURANT_CONFIG.name}</div>
          <div style={{ fontSize: 10, color: open ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
            {open ? `● Открыто · ${RESTAURANT_CONFIG.openTime}–${RESTAURANT_CONFIG.closeTime}` : '● Закрыто'}
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#a8906e', fontWeight: 700 }}>{currentTime}</div>
      </div>

      {/* ТАБЫ */}
      <div style={s.tabBar}>
        <button onClick={() => { setTab('menu'); setScreen('menu') }} style={{ ...s.tabBtn, borderBottom: tab === 'menu' ? '2px solid #8b4513' : '2px solid transparent', color: tab === 'menu' ? '#8b4513' : '#a8906e', fontWeight: tab === 'menu' ? 800 : 600 }}>
          🍽️ Меню
          {count > 0 && <span style={s.tabBadge}>{count}</span>}
        </button>
        <button onClick={() => setTab('orders')} style={{ ...s.tabBtn, borderBottom: tab === 'orders' ? '2px solid #8b4513' : '2px solid transparent', color: tab === 'orders' ? '#8b4513' : '#a8906e', fontWeight: tab === 'orders' ? 800 : 600 }}>
          📋 Мои заказы
          {activeOrders.length > 0 && <span style={{ ...s.tabBadge, background: '#22c55e' }}>{activeOrders.length}</span>}
        </button>
      </div>

      {/* ── ВКЛАДКА МОИ ЗАКАЗЫ ── */}
      {tab === 'orders' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>
          {myOrders.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#a8906e' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
              <div style={{ fontFamily: 'Georgia,serif', fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Заказов пока нет</div>
              <div style={{ fontSize: 13, marginBottom: 24 }}>Сделайте заказ — он появится здесь</div>
              <button style={s.btnPrimary} onClick={() => setTab('menu')}>Перейти в меню</button>
            </div>
          )}
          {activeOrders.length > 0 && (
            <>
              <div style={s.label}>Активные заказы</div>
              {activeOrders.map(order => <OrderCard key={order.id} order={order} />)}
            </>
          )}
          {doneOrders.length > 0 && (
            <>
              <div style={{ ...s.label, marginTop: 20 }}>Завершённые</div>
              {doneOrders.map(order => <OrderCard key={order.id} order={order} done />)}
              <button style={{ width: '100%', background: 'transparent', border: '1px solid rgba(0,0,0,.1)', borderRadius: 10, padding: 10, fontSize: 11, color: '#a8906e', cursor: 'pointer', marginTop: 8, marginBottom: 20 }}
                onClick={() => setMyOrders(prev => prev.filter(o => !['delivered','cancelled'].includes(o.status)))}>
                Очистить историю
              </button>
            </>
          )}
        </div>
      )}

      {/* ── ВКЛАДКА МЕНЮ — экран меню ── */}
      {tab === 'menu' && screen === 'menu' && (
        <>
          {!open && <div style={{ margin: '10px 18px', background: '#fef3c7', border: '1px solid rgba(217,119,6,.2)', borderRadius: 12, padding: 12, fontSize: 12, color: '#d97706', fontWeight: 600 }}>⏰ Заведение закрыто. Вы можете оформить предзаказ.</div>}
          <div style={{ padding: '10px 18px 0', display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0 }}>
            {CATEGORIES.map(cat => (
              <div key={cat} onClick={() => setCategory(cat)} style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 20, cursor: 'pointer', background: category === cat ? '#8b4513' : '#f7f0e4', color: category === cat ? '#fff' : '#6b5740', border: '1px solid rgba(0,0,0,.1)' }}>{cat}</div>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>
            {filtered.map(item => (
              <div key={item.id} style={s.dishRow}>
                <div style={s.dishEmoji}>{item.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <div style={s.dishName}>{item.name}</div>
                    {item.halal && <span style={{ fontSize: 9, fontWeight: 800, color: '#22c55e', background: '#f0fdf4', border: '1px solid rgba(34,197,94,.2)', borderRadius: 4, padding: '1px 5px' }}>ХАЛЯЛЬ</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={s.dishPrice}>{item.price} ₽</div>
                    {item.modifierGroups?.length > 0 && <span style={{ fontSize: 10, color: '#a8906e' }}>· на выбор</span>}
                  </div>
                </div>
                {cart[item.id + '_{}'] && !item.modifierGroups?.length ? (
                  <div style={s.counter}>
                    <button style={s.counterBtn} onClick={() => removeItem(item.id + '_{}')}> −</button>
                    <span style={s.counterNum}>{cart[item.id + '_{}']?.qty || 0}</span>
                    <button style={s.counterBtn} onClick={() => handleAddItem(item)}>+</button>
                  </div>
                ) : (
                  <button style={s.addBtn} onClick={() => handleAddItem(item)}>+</button>
                )}
              </div>
            ))}
            <div style={{ height: 80 }} />
          </div>
          {count > 0 && <div style={s.fab} onClick={() => setScreen('cart')}>🛒 Корзина · {total.toLocaleString('ru')} ₽ ({count})</div>}
        </>
      )}

      {/* ── ВКЛАДКА МЕНЮ — экран корзины ── */}
      {tab === 'menu' && screen === 'cart' && (
        <>
          <div style={s.backRow}>
            <button style={s.backBtn} onClick={() => setScreen('menu')}>← Меню</button>
            <div style={s.sectionTitle}>Оформление заказа</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px' }}>
            {/* ТИП ЗАКАЗА */}
            <div style={{ marginBottom: 12, marginTop: 12 }}>
              <div style={s.label}>Тип заказа</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[{ id: 'here', label: '🍽️ В зале' }, { id: 'takeaway', label: '🥡 Самовывоз' }, { id: 'delivery', label: '🚗 Доставка' }].map(t => (
                  <button key={t.id} onClick={() => setOrderType(t.id)} style={{ padding: '8px 16px', borderRadius: 20, border: '1.5px solid', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: orderType === t.id ? '#fdf0e8' : '#f7f0e4', borderColor: orderType === t.id ? 'rgba(139,69,19,.4)' : 'rgba(0,0,0,.1)', color: orderType === t.id ? '#8b4513' : '#6b5740' }}>{t.label}</button>
                ))}
              </div>
              {orderType === 'takeaway' && RESTAURANT_CONFIG.delivery?.takeawayDiscountPercent > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#22c55e', fontWeight: 700 }}>🎁 Скидка {RESTAURANT_CONFIG.delivery.takeawayDiscountPercent}% на самовывоз — −{takeawayDiscount} ₽</div>
              )}
            </div>
            {/* СТОЛИК */}
            {orderType === 'here' && (
              <div style={{ marginBottom: 12 }}>
                <div style={s.label}>Выберите столик</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
                  {RESTAURANT_CONFIG.tables.map(t => (
                    <div key={t.id} onClick={() => setTableId(t.id)} style={{ background: tableId === t.id ? '#fdf0e8' : '#f7f0e4', border: `1.5px solid ${tableId === t.id ? 'rgba(139,69,19,.4)' : 'rgba(0,0,0,.1)'}`, borderRadius: 10, padding: '10px 6px', textAlign: 'center', cursor: 'pointer' }}>
                      <div style={{ fontSize: 20, marginBottom: 3 }}>🪑</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: tableId === t.id ? '#8b4513' : '#1a1208' }}>{t.name}</div>
                      <div style={{ fontSize: 10, color: '#a8906e' }}>{t.seats} мест</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f7f0e4', borderRadius: 10, padding: '10px 14px' }}>
                  <span style={{ fontSize: 12, color: '#6b5740', fontWeight: 600 }}>Гостей:</span>
                  <button style={s.counterBtn} onClick={() => setGuests(g => Math.max(1, g - 1))}>−</button>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#8b4513', minWidth: 20, textAlign: 'center' }}>{guests}</span>
                  <button style={s.counterBtn} onClick={() => setGuests(g => Math.min(12, g + 1))}>+</button>
                </div>
              </div>
            )}
            {/* ДОСТАВКА */}
            {orderType === 'delivery' && (
              <div style={{ marginBottom: 12 }}>
                <div style={s.label}>Зона доставки</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                  {(RESTAURANT_CONFIG.delivery?.zones || []).map(zone => (
                    <div key={zone.id} onClick={() => setDeliveryZoneId(zone.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: deliveryZoneId === zone.id ? '#fdf0e8' : '#f7f0e4', border: `1.5px solid ${deliveryZoneId === zone.id ? 'rgba(139,69,19,.4)' : 'rgba(0,0,0,.1)'}`, borderRadius: 12, padding: '11px 14px', cursor: 'pointer' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: deliveryZoneId === zone.id ? '#8b4513' : '#1a1208' }}>{zone.name}</div>
                        <div style={{ fontSize: 11, color: '#a8906e' }}>{zone.description} · ~{zone.etaMinutes} мин</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: zone.price === 0 ? '#22c55e' : '#8b4513' }}>{zone.price === 0 ? 'Бесплатно' : `${zone.price} ₽`}</div>
                    </div>
                  ))}
                </div>
                <div style={s.label}>Адрес доставки</div>
                <input style={s.input} placeholder="Улица, дом, квартира" value={address} onChange={e => setAddress(e.target.value)} />
                {deliveryZone && subtotal > 0 && subtotal < deliveryZone.minOrder && (
                  <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700, marginTop: -6, marginBottom: 8 }}>⚠️ Ещё {(deliveryZone.minOrder - subtotal).toLocaleString('ru')} ₽ до минимума</div>
                )}
              </div>
            )}
            {/* ПРЕДЗАКАЗ */}
            <div style={{ background: isPreorder ? '#fdf0e8' : '#f7f0e4', border: `1.5px solid ${isPreorder ? 'rgba(139,69,19,.3)' : 'rgba(0,0,0,.1)'}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isPreorder ? 12 : 0 }}>
                <div><div style={{ fontSize: 13, fontWeight: 700, color: '#1a1208' }}>⏰ Предзаказ</div><div style={{ fontSize: 10, color: '#a8906e' }}>Закажите заранее — придёте, всё готово</div></div>
                <div onClick={() => setIsPreorder(p => !p)} style={{ width: 40, height: 22, borderRadius: 11, background: isPreorder ? '#8b4513' : '#e2d5c0', position: 'relative', cursor: 'pointer', transition: 'background .2s' }}>
                  <div style={{ position: 'absolute', top: 2, left: isPreorder ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                </div>
              </div>
              {isPreorder && (
                <div>
                  <div style={s.label}>Время готовности</div>
                  <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                    {slots.map(slot => (
                      <div key={slot} onClick={() => setPreorderTime(slot)} style={{ flexShrink: 0, padding: '7px 14px', borderRadius: 20, cursor: 'pointer', background: preorderTime === slot ? '#8b4513' : '#f7f0e4', color: preorderTime === slot ? '#fff' : '#6b5740', fontSize: 12, fontWeight: 700, border: '1px solid rgba(0,0,0,.1)' }}>{slot}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* ОПЛАТА */}
            <div style={{ marginBottom: 12 }}>
              <div style={s.label}>Способ оплаты</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {RESTAURANT_CONFIG.paymentMethods.map(m => (
                  <button key={m.id} onClick={() => setPayment(m.id)} style={{ flex: 1, padding: '10px 8px', borderRadius: 12, border: '1.5px solid', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: payment === m.id ? '#fdf0e8' : '#f7f0e4', borderColor: payment === m.id ? 'rgba(139,69,19,.4)' : 'rgba(0,0,0,.1)', color: payment === m.id ? '#8b4513' : '#6b5740' }}>{m.label}</button>
                ))}
              </div>
            </div>
            {/* БЛЮДА */}
            <div style={s.label}>Ваш заказ</div>
            {cartItems.map(item => (
              <div key={item.cartKey} style={s.cartItem}>
                <div style={{ fontSize: 22, marginRight: 10 }}>{item.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{item.name}</div>
                  {getModsLabel(item.selectedModifiers) && <div style={{ fontSize: 10, color: '#a8906e', marginTop: 1 }}>{getModsLabel(item.selectedModifiers)}</div>}
                  <div style={{ fontSize: 12, color: '#8b4513', fontWeight: 700 }}>{itemTotal(item).toLocaleString('ru')} ₽</div>
                </div>
                <div style={s.counter}>
                  <button style={s.counterBtn} onClick={() => removeItem(item.cartKey)}>−</button>
                  <span style={s.counterNum}>{item.qty}</span>
                  <button style={s.counterBtn} onClick={() => setCart(c => ({ ...c, [item.cartKey]: { ...c[item.cartKey], qty: c[item.cartKey].qty + 1 } }))}>+</button>
                </div>
              </div>
            ))}
            {/* UPSELL */}
            {upsellItems.length > 0 && (
              <div style={{ background: '#fef9ec', border: '1px solid rgba(201,130,10,.15)', borderRadius: 14, padding: 14, marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#c9820a', marginBottom: 10 }}>{upsellItems[0]._upsellLabel}</div>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
                  {upsellItems.map(item => (
                    <div key={item.id} style={{ flexShrink: 0, background: '#fff', border: '1px solid rgba(0,0,0,.08)', borderRadius: 12, padding: '10px 12px', textAlign: 'center', cursor: 'pointer', minWidth: 90 }} onClick={() => handleAddItem(item)}>
                      <div style={{ fontSize: 24, marginBottom: 4 }}>{item.emoji}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1208', marginBottom: 3 }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: '#8b4513', fontWeight: 800 }}>{item.price} ₽</div>
                      <div style={{ marginTop: 6, background: '#8b4513', color: '#fff', borderRadius: 8, fontSize: 11, fontWeight: 800, padding: '4px 0' }}>+ Добавить</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* ИТОГО */}
            <div style={{ background: '#fdf0e8', borderRadius: 12, padding: 14, margin: '12px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#6b5740' }}>Сумма</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{subtotal.toLocaleString('ru')} ₽</span>
              </div>
              {deliveryCost > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ fontSize: 12, color: '#6b5740' }}>Доставка ({deliveryZone?.name})</span><span style={{ fontSize: 13, fontWeight: 700 }}>{deliveryCost} ₽</span></div>}
              {takeawayDiscount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ fontSize: 12, color: '#22c55e' }}>🎁 Скидка самовывоз</span><span style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>−{takeawayDiscount} ₽</span></div>}
              {isPreorder && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ fontSize: 12, color: '#6b5740' }}>Предзаказ</span><span style={{ fontSize: 13, fontWeight: 700, color: '#8b4513' }}>⏰ {preorderTime}</span></div>}
              {tableId && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ fontSize: 12, color: '#6b5740' }}>Столик</span><span style={{ fontSize: 13, fontWeight: 700 }}>{RESTAURANT_CONFIG.tables.find(t => t.id === tableId)?.name}</span></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid rgba(139,69,19,.1)' }}>
                <span style={{ fontSize: 13, fontWeight: 800 }}>Итого</span>
                <span style={{ fontFamily: 'Georgia,serif', fontSize: 20, fontWeight: 700, color: '#8b4513' }}>{total.toLocaleString('ru')} ₽</span>
              </div>
            </div>
            {/* КОНТАКТЫ */}
            <div style={s.label}>Контактные данные</div>
            <input style={s.input} placeholder="Ваше имя" value={name} onChange={e => setName(e.target.value)} />
            <input style={s.input} placeholder="Телефон" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
            <textarea style={{ ...s.input, resize: 'none', lineHeight: 1.5 }} rows={2} placeholder="Комментарий (необязательно)" value={comment} onChange={e => setComment(e.target.value)} />
            {!open && !isPreorder && <div style={{ background: '#fef2f2', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 12, color: '#ef4444', fontWeight: 600 }}>⚠️ Заведение закрыто. Включите предзаказ.</div>}
            <button style={{ ...s.btnPrimary, opacity: (!open && !isPreorder) ? 0.5 : 1 }} onClick={() => { if (!open && !isPreorder) return; placeOrder() }}>
              {isPreorder ? `Оформить предзаказ на ${preorderTime} 🤲` : 'Оформить заказ 🤲'}
            </button>
            <div style={{ height: 20 }} />
          </div>
        </>
      )}
    </div>
  )
}

function OrderCard({ order, done }) {
  const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.new
  const steps = ['new', 'confirmed', 'cooking', 'ready', 'delivered']
  const currentStep = sc.step
  const time = new Date(order.createdAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
  const typeLabel = order.orderType === 'here' ? '🍽️ В зале' : order.orderType === 'takeaway' ? '🥡 Самовывоз' : '🚗 Доставка'
  return (
    <div style={{ background: '#fff', border: `1.5px solid ${done ? 'rgba(0,0,0,.06)' : sc.color + '40'}`, borderRadius: 16, padding: 16, marginBottom: 12, opacity: done ? 0.7 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#1a1208' }}>Заказ от {time}</div>
          <div style={{ fontSize: 11, color: '#a8906e' }}>{typeLabel}</div>
        </div>
        <div style={{ fontFamily: 'Georgia,serif', fontSize: 16, fontWeight: 700, color: '#8b4513' }}>{order.total?.toLocaleString('ru')} ₽</div>
      </div>
      {!done && order.status !== 'cancelled' && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {steps.slice(0, 5).map((step, i) => {
              const stepCfg = STATUS_CONFIG[step]
              const isActive = stepCfg.step <= currentStep
              const isCurrent = step === order.status
              return (
                <div key={step} style={{ display: 'flex', alignItems: 'center', flex: i < 4 ? 1 : 0 }}>
                  <div style={{ width: isCurrent ? 28 : 20, height: isCurrent ? 28 : 20, borderRadius: '50%', background: isActive ? sc.color : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isCurrent ? 13 : 9, transition: 'all .3s', flexShrink: 0, boxShadow: isCurrent ? `0 0 0 3px ${sc.color}30` : 'none', color: '#fff', fontWeight: 900 }}>
                    {isActive ? (isCurrent ? '●' : '✓') : ''}
                  </div>
                  {i < 4 && <div style={{ flex: 1, height: 2, background: stepCfg.step < currentStep ? sc.color : '#e5e7eb', transition: 'background .3s' }} />}
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: sc.color, marginTop: 8, textAlign: 'center' }}>{sc.text}</div>
        </div>
      )}
      {done && <div style={{ fontSize: 12, fontWeight: 700, color: sc.color, background: sc.bg, borderRadius: 8, padding: '5px 10px', display: 'inline-block', marginBottom: 10 }}>{sc.text}</div>}
      <div style={{ borderTop: '1px dashed rgba(0,0,0,.08)', paddingTop: 10 }}>
        {(order.items || []).map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b5740', padding: '3px 0' }}>
            <span>{item.name} × {item.qty}{item.modifiers && <span style={{ color: '#a8906e' }}> · {item.modifiers}</span>}</span>
            <span style={{ fontWeight: 700 }}>{(item.price * item.qty).toLocaleString('ru')} ₽</span>
          </div>
        ))}
      </div>
      {order.isPreorder && order.preorderTime && <div style={{ marginTop: 8, fontSize: 11, color: '#d97706', fontWeight: 700 }}>⏰ Предзаказ на {order.preorderTime}</div>}
    </div>
  )
}

const s = {
  page: { width: '100%', maxWidth: 420, margin: '0 auto', minHeight: '100vh', background: '#fdf8f0', fontFamily: 'Nunito,sans-serif', display: 'flex', flexDirection: 'column', position: 'relative' },
  notifyBanner: { position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', background: '#22c55e', color: '#fff', padding: '10px 24px', borderRadius: '0 0 16px 16px', fontSize: 13, fontWeight: 800, zIndex: 1000, boxShadow: '0 4px 16px rgba(34,197,94,.4)', maxWidth: 420, width: '100%', textAlign: 'center' },
  header: { padding: '12px 18px', background: '#fdf8f0', borderBottom: '1px solid rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  logo: { fontFamily: 'Georgia,serif', fontSize: 15, fontWeight: 700, color: '#8b4513' },
  tabBar: { display: 'flex', background: '#fff', borderBottom: '1px solid rgba(0,0,0,.08)', flexShrink: 0 },
  tabBtn: { flex: 1, padding: '12px 8px', background: 'none', border: 'none', borderBottom: '2px solid transparent', fontSize: 13, cursor: 'pointer', fontFamily: 'Nunito,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'color .2s' },
  tabBadge: { background: '#8b4513', color: '#fff', fontSize: 10, fontWeight: 900, padding: '2px 7px', borderRadius: 20, lineHeight: 1.4 },
  label: { fontSize: 10, fontWeight: 700, color: '#a8906e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  dishRow: { display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid rgba(0,0,0,.08)', borderRadius: 14, padding: '12px 14px', marginBottom: 8 },
  dishEmoji: { width: 48, height: 48, borderRadius: 10, background: 'linear-gradient(135deg,#f5e6c8,#e8d0a0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 },
  dishName: { fontFamily: 'Georgia,serif', fontSize: 14, fontWeight: 700, color: '#1a1208' },
  dishPrice: { fontFamily: 'Georgia,serif', fontSize: 15, fontWeight: 700, color: '#8b4513' },
  addBtn: { width: 32, height: 32, borderRadius: '50%', background: '#8b4513', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 },
  counter: { display: 'flex', alignItems: 'center', gap: 8 },
  counterBtn: { width: 28, height: 28, borderRadius: '50%', background: '#f7f0e4', border: '1px solid rgba(0,0,0,.1)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  counterNum: { fontSize: 14, fontWeight: 800, color: '#8b4513', minWidth: 16, textAlign: 'center' },
  fab: { position: 'sticky', bottom: 16, margin: '0 18px 16px', background: '#8b4513', color: '#fff', borderRadius: 24, padding: '12px 20px', fontSize: 13, fontWeight: 800, cursor: 'pointer', textAlign: 'center', boxShadow: '0 4px 20px rgba(139,69,19,.35)' },
  backRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', flexShrink: 0, borderBottom: '1px solid rgba(0,0,0,.06)' },
  backBtn: { background: '#f7f0e4', border: '1px solid rgba(0,0,0,.1)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#6b5740' },
  sectionTitle: { fontFamily: 'Georgia,serif', fontSize: 16, fontWeight: 700, color: '#1a1208' },
  cartItem: { display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid rgba(0,0,0,.08)', borderRadius: 12, padding: '10px 12px', marginBottom: 8 },
  input: { width: '100%', background: '#f7f0e4', border: '1.5px solid rgba(0,0,0,.12)', borderRadius: 10, padding: '11px 13px', fontSize: 13, fontFamily: 'Nunito,sans-serif', outline: 'none', marginBottom: 10, boxSizing: 'border-box', color: '#1a1208' },
  btnPrimary: { width: '100%', background: '#8b4513', color: '#fff', fontFamily: 'Nunito,sans-serif', fontSize: 13, fontWeight: 800, padding: 14, borderRadius: 12, border: 'none', cursor: 'pointer', boxSizing: 'border-box' },
}
