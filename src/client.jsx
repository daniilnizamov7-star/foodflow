import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { RESTAURANT_CONFIG, isOpen, getEarliestPreorder, getTimeSlots } from './config'

const MENU = [
  { id: 1,  name: 'Фирменное блюдо',     price: 450, emoji: '🍖', category: 'Основное' },
  { id: 2,  name: 'Шашлык из баранины',  price: 800, emoji: '🍢', category: 'Основное' },
  { id: 3,  name: 'Рёбрышки на углях',   price: 800, emoji: '🦴', category: 'Основное' },
  { id: 4,  name: 'Суп дня',             price: 350, emoji: '🍲', category: 'Супы' },
  { id: 5,  name: 'Лагман',              price: 350, emoji: '🍜', category: 'Супы' },
  { id: 6,  name: 'Плов',               price: 350, emoji: '🍚', category: 'Основное' },
  { id: 7,  name: 'Манты',              price: 450, emoji: '🥟', category: 'Основное' },
  { id: 8,  name: 'Казан-кебаб',        price: 450, emoji: '🫕', category: 'Основное' },
  { id: 9,  name: 'Свежий салат',       price: 350, emoji: '🥗', category: 'Салаты' },
  { id: 10, name: 'Хлеб',              price: 50,  emoji: '🍞', category: 'Прочее' },
  { id: 11, name: 'Выпечка дня',       price: 200, emoji: '🥐', category: 'Прочее' },
  { id: 12, name: 'Чай / Кофе',        price: 150, emoji: '☕', category: 'Напитки' },
  { id: 13, name: 'Холодный напиток',  price: 100, emoji: '🧃', category: 'Напитки' },
]

const CATEGORIES = ['Все', 'Основное', 'Супы', 'Салаты', 'Напитки', 'Прочее']

// Текущее время
function getCurrentTime() {
  return new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
}

export default function Client() {
  const [cart, setCart] = useState({})
  const [screen, setScreen] = useState('menu')
  const [category, setCategory] = useState('Все')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [orderType, setOrderType] = useState('here')
  const [address, setAddress] = useState('')
  const [payment, setPayment] = useState('cash')
  const [comment, setComment] = useState('')
  const [isPreorder, setIsPreorder] = useState(false)
  const [preorderTime, setPreorderTime] = useState(getEarliestPreorder())
  const [tableId, setTableId] = useState(null)
  const [guests, setGuests] = useState(2)
  const [sent, setSent] = useState(false)
  const [orderId, setOrderId] = useState(null)
  const [orderStatus, setOrderStatus] = useState('new')
  const [statusNotify, setStatusNotify] = useState(null)
  const [currentTime, setCurrentTime] = useState(getCurrentTime())
  const open = isOpen()
  const slots = getTimeSlots()

  // Обновляем время каждую минуту
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(getCurrentTime()), 60000)
    return () => clearInterval(timer)
  }, [])

  const total = Object.values(cart).reduce((s, i) => s + i.price * i.qty, 0)
  const count = Object.values(cart).reduce((s, i) => s + i.qty, 0)
  const filtered = category === 'Все' ? MENU : MENU.filter(i => i.category === category)

  function playSound(type) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      if (type === 'confirmed') {
        osc.frequency.setValueAtTime(660, ctx.currentTime)
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15)
      } else if (type === 'ready') {
        osc.frequency.setValueAtTime(880, ctx.currentTime)
        osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
        osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.2)
      }
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5)
    } catch(e) {}
  }

  function addItem(item) {
    setCart(c => ({
      ...c,
      [item.id]: c[item.id] ? { ...c[item.id], qty: c[item.id].qty + 1 } : { ...item, qty: 1 }
    }))
  }

  function removeItem(id) {
    setCart(c => {
      const n = { ...c }
      if (n[id].qty > 1) n[id] = { ...n[id], qty: n[id].qty - 1 }
      else delete n[id]
      return n
    })
  }

  async function placeOrder() {
    if (!name.trim()) return alert('Введите ваше имя')
    if (!phone.trim()) return alert('Введите номер телефона')
    if (orderType === 'here' && !tableId) return alert('Выберите столик')
    if (orderType === 'delivery' && !address.trim()) return alert('Введите адрес доставки')
    const items = Object.values(cart).map(i => ({ name: i.name, price: i.price, qty: i.qty }))
    const { data, error } = await supabase.from('orders').insert({
      customer_name: name,
      customer_phone: phone,
      order_type: orderType,
      items, total,
      address: orderType === 'delivery' ? address : null,
      table_number: tableId ? String(tableId) : null,
      booking_time: isPreorder ? preorderTime : null,
      status: 'new',
      comment,
      payment_method: payment,
      guests: orderType === 'here' ? guests : null,
    }).select().single()
    if (error) return alert('Ошибка: ' + error.message)
    setOrderId(data.id)
    setSent(true)
    setCart({})
  }

  useEffect(() => {
    if (!orderId) return
    const channel = supabase
      .channel('order-' + orderId)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders',
        filter: `id=eq.${orderId}`
      }, payload => {
        setOrderStatus(payload.new.status)
        if (payload.new.status === 'confirmed') {
          playSound('confirmed')
          setStatusNotify('✅ Ваш заказ подтверждён!')
          setTimeout(() => setStatusNotify(null), 4000)
        }
        if (payload.new.status === 'ready') {
          playSound('ready')
          setStatusNotify('🎉 Ваш заказ готов!')
          setTimeout(() => setStatusNotify(null), 4000)
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [orderId])

  const statusLabels = {
    new:       { text: '⏳ Ожидает подтверждения', color: '#f59e0b' },
    confirmed: { text: '✅ Заказ подтверждён!',    color: '#22c55e' },
    cooking:   { text: '👨‍🍳 Готовится...',          color: '#3b82f6' },
    ready:     { text: '🎉 Готово! Можно забирать', color: '#22c55e' },
    cancelled: { text: '❌ Отменён',               color: '#ef4444' },
  }

  // ЭКРАН — ЗАКАЗ ОФОРМЛЕН
  if (sent) return (
    <div style={s.page}>
      {statusNotify && <div style={s.notifyBanner}>{statusNotify}</div>}
      <div style={s.header}>
        <div style={s.logo}>{RESTAURANT_CONFIG.name}</div>
        <div style={{ fontSize: 11, color: '#a8906e' }}>{currentTime}</div>
      </div>
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🤲</div>
        <div style={{ fontFamily: 'Georgia,serif', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
          Заказ принят!
        </div>
        <div style={{ fontSize: 13, color: '#6b5740', marginBottom: 24 }}>
          Администратор свяжется с вами для подтверждения
        </div>
        {isPreorder && (
          <div style={{ background: '#fef3c7', border: '1px solid rgba(217,119,6,.2)', borderRadius: 12, padding: 12, marginBottom: 16, fontSize: 13, color: '#d97706', fontWeight: 700 }}>
            ⏰ Предзаказ на {preorderTime}
          </div>
        )}
        <div style={{ background: '#fdf0e8', border: '1.5px solid rgba(139,69,19,.2)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#a8906e', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Статус заказа
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: statusLabels[orderStatus]?.color || '#6b5740' }}>
            {statusLabels[orderStatus]?.text || orderStatus}
          </div>
        </div>
        <button style={s.btnPrimary} onClick={() => {
          setSent(false); setOrderId(null); setOrderStatus('new'); setScreen('menu')
        }}>
          Новый заказ
        </button>
      </div>
    </div>
  )

  // ОСНОВНОЙ ЭКРАН
  return (
    <div style={s.page}>
      {statusNotify && <div style={s.notifyBanner}>{statusNotify}</div>}

      <div style={s.header}>
        <div>
          <div style={s.logo}>{RESTAURANT_CONFIG.name}</div>
          <div style={{ fontSize: 10, color: open ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
            {open
              ? `● Открыто · ${RESTAURANT_CONFIG.openTime}–${RESTAURANT_CONFIG.closeTime}`
              : `● Закрыто · Открытие в ${RESTAURANT_CONFIG.openTime}`}
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#a8906e', fontWeight: 700 }}>{currentTime}</div>
      </div>

      {/* МЕНЮ */}
      {screen === 'menu' && (
        <>
          {!open && (
            <div style={{ margin: '10px 18px', background: '#fef3c7', border: '1px solid rgba(217,119,6,.2)', borderRadius: 12, padding: 12, fontSize: 12, color: '#d97706', fontWeight: 600 }}>
              ⏰ Заведение закрыто. Вы можете оформить предзаказ.
            </div>
          )}
          <div style={{ padding: '10px 18px 0', display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0 }}>
            {CATEGORIES.map(cat => (
              <div key={cat} onClick={() => setCategory(cat)} style={{
                flexShrink: 0, fontSize: 11, fontWeight: 700,
                padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
                background: category === cat ? '#8b4513' : '#f7f0e4',
                color: category === cat ? '#fff' : '#6b5740',
                border: '1px solid rgba(0,0,0,.1)',
              }}>{cat}</div>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>
            {filtered.map(item => (
              <div key={item.id} style={s.dishRow}>
                <div style={s.dishEmoji}>{item.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={s.dishName}>{item.name}</div>
                  <div style={s.dishPrice}>{item.price} ₽</div>
                </div>
                {cart[item.id] ? (
                  <div style={s.counter}>
                    <button style={s.counterBtn} onClick={() => removeItem(item.id)}>−</button>
                    <span style={s.counterNum}>{cart[item.id].qty}</span>
                    <button style={s.counterBtn} onClick={() => addItem(item)}>+</button>
                  </div>
                ) : (
                  <button style={s.addBtn} onClick={() => addItem(item)}>+</button>
                )}
              </div>
            ))}
          </div>
          {count > 0 && (
            <div style={s.fab} onClick={() => setScreen('cart')}>
              🛒 Корзина · {total.toLocaleString('ru')} ₽ ({count})
            </div>
          )}
        </>
      )}

      {/* КОРЗИНА */}
      {screen === 'cart' && (
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
                {[
                  { id: 'here',     label: '🍽️ В зале' },
                  { id: 'takeaway', label: '🥡 Самовывоз' },
                  { id: 'delivery', label: '🚗 Доставка' },
                ].map(t => (
                  <button key={t.id} onClick={() => setOrderType(t.id)} style={{
                    padding: '8px 16px', borderRadius: 20, border: '1.5px solid',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    background: orderType === t.id ? '#fdf0e8' : '#f7f0e4',
                    borderColor: orderType === t.id ? 'rgba(139,69,19,.4)' : 'rgba(0,0,0,.1)',
                    color: orderType === t.id ? '#8b4513' : '#6b5740',
                  }}>{t.label}</button>
                ))}
              </div>
            </div>

            {/* СТОЛИК */}
            {orderType === 'here' && (
              <div style={{ marginBottom: 12 }}>
                <div style={s.label}>Выберите столик</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
                  {RESTAURANT_CONFIG.tables.map(t => (
                    <div key={t.id} onClick={() => setTableId(t.id)} style={{
                      background: tableId === t.id ? '#fdf0e8' : '#f7f0e4',
                      border: `1.5px solid ${tableId === t.id ? 'rgba(139,69,19,.4)' : 'rgba(0,0,0,.1)'}`,
                      borderRadius: 10, padding: '10px 6px', textAlign: 'center', cursor: 'pointer',
                    }}>
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
                <div style={s.label}>Адрес доставки</div>
                <input style={s.input} placeholder="Улица, дом, квартира" value={address} onChange={e => setAddress(e.target.value)} />
              </div>
            )}

            {/* ПРЕДЗАКАЗ */}
            <div style={{ background: isPreorder ? '#fdf0e8' : '#f7f0e4', border: `1.5px solid ${isPreorder ? 'rgba(139,69,19,.3)' : 'rgba(0,0,0,.1)'}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isPreorder ? 12 : 0 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1208' }}>⏰ Предзаказ</div>
                  <div style={{ fontSize: 10, color: '#a8906e' }}>Закажите заранее — придёте, всё готово</div>
                </div>
                <div onClick={() => setIsPreorder(p => !p)} style={{
                  width: 40, height: 22, borderRadius: 11,
                  background: isPreorder ? '#8b4513' : '#e2d5c0',
                  position: 'relative', cursor: 'pointer', transition: 'background .2s',
                }}>
                  <div style={{
                    position: 'absolute', top: 2,
                    left: isPreorder ? 20 : 2,
                    width: 18, height: 18, borderRadius: '50%',
                    background: '#fff', transition: 'left .2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                  }} />
                </div>
              </div>
              {isPreorder && (
                <div>
                  <div style={s.label}>Время готовности</div>
                  <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                    {slots.map(slot => (
                      <div key={slot} onClick={() => setPreorderTime(slot)} style={{
                        flexShrink: 0, padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
                        background: preorderTime === slot ? '#8b4513' : '#f7f0e4',
                        color: preorderTime === slot ? '#fff' : '#6b5740',
                        fontSize: 12, fontWeight: 700, border: '1px solid rgba(0,0,0,.1)',
                      }}>{slot}</div>
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
                  <button key={m.id} onClick={() => setPayment(m.id)} style={{
                    flex: 1, padding: '10px 8px', borderRadius: 12, border: '1.5px solid',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    background: payment === m.id ? '#fdf0e8' : '#f7f0e4',
                    borderColor: payment === m.id ? 'rgba(139,69,19,.4)' : 'rgba(0,0,0,.1)',
                    color: payment === m.id ? '#8b4513' : '#6b5740',
                  }}>{m.label}</button>
                ))}
              </div>
            </div>

            {/* БЛЮДА */}
            <div style={s.label}>Ваш заказ</div>
            {Object.values(cart).map(item => (
              <div key={item.id} style={s.cartItem}>
                <div style={{ fontSize: 22, marginRight: 10 }}>{item.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: '#8b4513', fontWeight: 700 }}>{(item.price * item.qty).toLocaleString('ru')} ₽</div>
                </div>
                <div style={s.counter}>
                  <button style={s.counterBtn} onClick={() => removeItem(item.id)}>−</button>
                  <span style={s.counterNum}>{item.qty}</span>
                  <button style={s.counterBtn} onClick={() => addItem(item)}>+</button>
                </div>
              </div>
            ))}

            {/* ИТОГО */}
            <div style={{ background: '#fdf0e8', borderRadius: 12, padding: 14, margin: '12px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#6b5740' }}>Сумма</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{total.toLocaleString('ru')} ₽</span>
              </div>
              {isPreorder && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#6b5740' }}>Предзаказ</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#8b4513' }}>⏰ {preorderTime}</span>
                </div>
              )}
              {tableId && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#6b5740' }}>Столик</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{RESTAURANT_CONFIG.tables.find(t => t.id === tableId)?.name}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid rgba(139,69,19,.1)' }}>
                <span style={{ fontSize: 13, fontWeight: 800 }}>Итого</span>
                <span style={{ fontFamily: 'Georgia,serif', fontSize: 20, fontWeight: 700, color: '#8b4513' }}>{total.toLocaleString('ru')} ₽</span>
              </div>
            </div>

            {/* КОНТАКТЫ */}
            <div style={s.label}>Контактные данные</div>
            <input style={s.input} placeholder="Ваше имя" value={name} onChange={e => setName(e.target.value)} />
            <input style={s.input} placeholder="Телефон" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
            <textarea style={{ ...s.input, resize: 'none', lineHeight: 1.5 }} rows={2}
              placeholder="Комментарий к заказу (необязательно)"
              value={comment} onChange={e => setComment(e.target.value)} />

            {!open && !isPreorder && (
              <div style={{ background: '#fef2f2', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 12, color: '#ef4444', fontWeight: 600 }}>
                ⚠️ Заведение закрыто. Включите предзаказ чтобы оформить заказ.
              </div>
            )}

            <button
              style={{ ...s.btnPrimary, opacity: (!open && !isPreorder) ? 0.5 : 1 }}
              onClick={() => { if (!open && !isPreorder) return; placeOrder() }}>
              {isPreorder ? `Оформить предзаказ на ${preorderTime} 🤲` : 'Оформить заказ 🤲'}
            </button>
            <div style={{ height: 20 }} />
          </div>
        </>
      )}
    </div>
  )
}

const s = {
  page: { width: '100%', maxWidth: 420, margin: '0 auto', minHeight: '100vh', background: '#fdf8f0', fontFamily: 'Nunito,sans-serif', display: 'flex', flexDirection: 'column', position: 'relative' },
  notifyBanner: { position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', background: '#22c55e', color: '#fff', padding: '10px 24px', borderRadius: '0 0 16px 16px', fontSize: 13, fontWeight: 800, zIndex: 1000, boxShadow: '0 4px 16px rgba(34,197,94,.4)', maxWidth: 420, width: '100%', textAlign: 'center' },
  header: { padding: '12px 18px', background: '#fdf8f0', borderBottom: '1px solid rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  logo: { fontFamily: 'Georgia,serif', fontSize: 15, fontWeight: 700, color: '#8b4513' },
  label: { fontSize: 10, fontWeight: 700, color: '#a8906e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  dishRow: { display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid rgba(0,0,0,.08)', borderRadius: 14, padding: '12px 14px', marginBottom: 8 },
  dishEmoji: { width: 48, height: 48, borderRadius: 10, background: 'linear-gradient(135deg,#f5e6c8,#e8d0a0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 },
  dishName: { fontFamily: 'Georgia,serif', fontSize: 14, fontWeight: 700, color: '#1a1208', marginBottom: 2 },
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
