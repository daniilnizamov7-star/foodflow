export const RESTAURANT_CONFIG = {
  name: 'FoodFlow',
  openTime: '11:30',
  closeTime: '21:00',
  minPreorderMinutes: 30,
  tables: [
    { id: 1, name: 'Стол 1', seats: 2 },
    { id: 2, name: 'Стол 2', seats: 2 },
    { id: 3, name: 'Стол 3', seats: 4 },
    { id: 4, name: 'Стол 4', seats: 4 },
    { id: 5, name: 'Диван 1', seats: 4 },
    { id: 6, name: 'Диван 2', seats: 6 },
    { id: 7, name: 'Беседка', seats: 8 },
  ],
  paymentMethods: [
    { id: 'cash', label: '💵 Наличные' },
    { id: 'card', label: '💳 Карта' },
    { id: 'sbp', label: '📱 СБП' },
  ]
}

// Проверка — открыто ли заведение сейчас
export function isOpen() {
  const now = new Date()
  const [oh, om] = RESTAURANT_CONFIG.openTime.split(':').map(Number)
  const [ch, cm] = RESTAURANT_CONFIG.closeTime.split(':').map(Number)
  const openMin = oh * 60 + om
  const closeMin = ch * 60 + cm
  const nowMin = now.getHours() * 60 + now.getMinutes()
  return nowMin >= openMin && nowMin <= closeMin - 30
}

// Ближайшее доступное время предзаказа
export function getEarliestPreorder() {
  const now = new Date()
  const [oh, om] = RESTAURANT_CONFIG.openTime.split(':').map(Number)
  const openMin = oh * 60 + om + 30
  const nowMin = now.getHours() * 60 + now.getMinutes() + 30
  const earliest = Math.max(openMin, nowMin)
  const h = Math.floor(earliest / 60)
  const m = earliest % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}

// Генерация временных слотов
export function getTimeSlots() {
  const [oh, om] = RESTAURANT_CONFIG.openTime.split(':').map(Number)
  const [ch, cm] = RESTAURANT_CONFIG.closeTime.split(':').map(Number)
  const slots = []
  let cur = oh * 60 + om + 30
  const end = ch * 60 + cm - 30
  while (cur <= end) {
    const h = Math.floor(cur / 60)
    const m = cur % 60
    slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`)
    cur += 30
  }
  return slots
}