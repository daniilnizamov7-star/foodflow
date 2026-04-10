// ─────────────────────────────────────────────
//  FOODFLOW — config.js
//  Версия 2.0 | nizamov.tech
// ─────────────────────────────────────────────

export const RESTAURANT_CONFIG = {
  name: 'FoodFlow',
  openTime: '10:00',
  closeTime: '22:00',
  minPreorderMinutes: 30,

  // ── СТОЛЫ ────────────────────────────────────
  tables: [
    { id: 1, name: 'Стол 1',  seats: 2 },
    { id: 2, name: 'Стол 2',  seats: 2 },
    { id: 3, name: 'Стол 3',  seats: 4 },
    { id: 4, name: 'Стол 4',  seats: 4 },
    { id: 5, name: 'Диван 1', seats: 4 },
    { id: 6, name: 'Диван 2', seats: 6 },
    { id: 7, name: 'Беседка', seats: 8 },
  ],

  // ── ОПЛАТА ───────────────────────────────────
  paymentMethods: [
    { id: 'cash', label: '💵 Наличные' },
    { id: 'card', label: '💳 Карта' },
    { id: 'sbp',  label: '📱 СБП' },
  ],

  // ── ЗОНЫ ДОСТАВКИ ────────────────────────────
  // enabled: false → доставка отключена (только зал/самовывоз)
  delivery: {
    enabled: true,
    zones: [
      {
        id: 'center',
        name: 'Центр',
        description: 'До 3 км от заведения',
        price: 0,
        minOrder: 800,
        etaMinutes: 30,
      },
      {
        id: 'district',
        name: 'Районы',
        description: 'До 7 км',
        price: 200,
        minOrder: 1200,
        etaMinutes: 50,
      },
      {
        id: 'suburb',
        name: 'Пригород',
        description: 'До 15 км',
        price: 400,
        minOrder: 2000,
        etaMinutes: 75,
      },
    ],
    // Скидка на самовывоз (0 = отключена)
    takeawayDiscountPercent: 5,
  },

  // ── МОДИФИКАТОРЫ ─────────────────────────────
  // Глобальные группы — можно подключать к любому блюду через modifierGroups: ['size', 'sauce']
  // required: true  → клиент ОБЯЗАН выбрать
  // multiSelect: true → можно выбрать несколько опций в группе
  modifierGroups: {
    size: {
      id: 'size',
      name: 'Размер порции',
      required: true,
      multiSelect: false,
      options: [
        { id: 'size_s', label: 'Стандартный', priceAdd: 0 },
        { id: 'size_l', label: 'Большой',     priceAdd: 120 },
      ],
    },
    meat: {
      id: 'meat',
      name: 'Вид мяса',
      required: true,
      multiSelect: false,
      options: [
        { id: 'meat_lamb',    label: '🐑 Баранина',  priceAdd: 0   },
        { id: 'meat_beef',    label: '🐄 Говядина',  priceAdd: 0   },
        { id: 'meat_chicken', label: '🐔 Курица',    priceAdd: -50 },
      ],
    },
    sauce: {
      id: 'sauce',
      name: 'Соус',
      required: false,
      multiSelect: false,
      options: [
        { id: 'sauce_none',   label: 'Без соуса',  priceAdd: 0  },
        { id: 'sauce_tomato', label: 'Томатный',   priceAdd: 0  },
        { id: 'sauce_garlic', label: 'Чесночный',  priceAdd: 0  },
        { id: 'sauce_hot',    label: '🌶 Острый',   priceAdd: 0  },
      ],
    },
    extras: {
      id: 'extras',
      name: 'Добавки',
      required: false,
      multiSelect: true,
      options: [
        { id: 'extra_cheese',  label: '🧀 Сыр',           priceAdd: 80  },
        { id: 'extra_egg',     label: '🥚 Яйцо',          priceAdd: 50  },
        { id: 'extra_greens',  label: '🌿 Зелень',        priceAdd: 0   },
        { id: 'extra_onion',   label: 'Без лука',         priceAdd: 0   },
        { id: 'extra_noodle',  label: 'Двойная лапша',    priceAdd: 60  },
      ],
    },
    drink_size: {
      id: 'drink_size',
      name: 'Объём',
      required: true,
      multiSelect: false,
      options: [
        { id: 'ds_250', label: '250 мл', priceAdd: 0   },
        { id: 'ds_500', label: '500 мл', priceAdd: 80  },
        { id: 'ds_1000', label: '1 л',   priceAdd: 180 },
      ],
    },
  },

  // ── UPSELL — рекомендации в корзине ──────────
  // Когда клиент добавляет блюдо из группы,
  // показываем рекомендации из recommendWhen
  upsell: {
    enabled: true,
    // Пары: «если в корзине есть блюдо из categoryFrom → предлагать из categoryTo»
    rules: [
      { categoryFrom: 'main',    categoryTo: 'drinks',  label: '🧃 Добавить напиток?' },
      { categoryFrom: 'main',    categoryTo: 'salads',  label: '🥗 Добавить салат?' },
      { categoryFrom: 'salads',  categoryTo: 'bread',   label: '🫓 Взять хлеб?' },
      { categoryFrom: 'shashlik',categoryTo: 'sauces',  label: '🫙 Добавить соус?' },
    ],
    maxSuggestions: 3, // сколько карточек показывать за раз
  },

  // ── ОТЗЫВ РУКОВОДСТВУ ─────────────────────────
  // Кнопка появляется через N минут после оформления заказа
  // Отзыв приходит ТОЛЬКО в приватный чат владельца — не публично
  feedback: {
    enabled: true,
    showAfterMinutes: 2,     // через сколько минут показать кнопку
    telegramPrivateChatId: '', // заполни: ID приватного чата владельца
    questions: [
      { id: 'q1', text: 'Как вам скорость обслуживания?',  type: 'stars' },
      { id: 'q2', text: 'Оцените качество блюд',           type: 'stars' },
      { id: 'q3', text: 'Оставьте комментарий (необязательно)', type: 'text' },
    ],
    thankYouMessage: 'Спасибо! Ваш отзыв получен 🙏',
  },

  // ── ПРОГРАММА ЛОЯЛЬНОСТИ ─────────────────────
  // (Про Макс тариф) — пока структура, логика в Supabase
  loyalty: {
    enabled: false,             // включить на Про Макс
    pointsPerRuble: 0.05,       // 5 баллов за 100 ₽
    pointsToRuble: 0.01,        // 1 балл = 1 копейка
    welcomeBonus: 100,          // баллов при первом заказе
    birthdayBonus: 500,
  },
}

// ─────────────────────────────────────────────
//  УТИЛИТЫ
// ─────────────────────────────────────────────

/** Открыто ли заведение прямо сейчас */
export function isOpen() {
  const now = new Date()
  const [oh, om] = RESTAURANT_CONFIG.openTime.split(':').map(Number)
  const [ch, cm] = RESTAURANT_CONFIG.closeTime.split(':').map(Number)
  const openMin  = oh * 60 + om
  const closeMin = ch * 60 + cm
  const nowMin   = now.getHours() * 60 + now.getMinutes()
  return nowMin >= openMin && nowMin <= closeMin - 30
}

/** Ближайший доступный слот предзаказа */
export function getEarliestPreorder() {
  const now = new Date()
  const [oh, om] = RESTAURANT_CONFIG.openTime.split(':').map(Number)
  const openMin  = oh * 60 + om + 30
  const nowMin   = now.getHours() * 60 + now.getMinutes() + 30
  const earliest = Math.max(openMin, nowMin)
  const h = Math.floor(earliest / 60)
  const m = earliest % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}

/** Временные слоты с шагом 30 минут */
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

/**
 * Считает итоговую цену блюда с учётом выбранных модификаторов
 * @param {number} basePrice — базовая цена блюда
 * @param {Object} selectedModifiers — { groupId: optionId } или { groupId: [optionId, ...] }
 * @returns {number}
 */
export function calcDishPrice(basePrice, selectedModifiers = {}) {
  if (!selectedModifiers || Object.keys(selectedModifiers).length === 0) return basePrice
  const groups = RESTAURANT_CONFIG.modifierGroups
  let total = basePrice
  for (const [groupId, value] of Object.entries(selectedModifiers)) {
    const group = groups[groupId]
    if (!group) continue
    const ids = Array.isArray(value) ? value : [value]
    for (const optId of ids) {
      const opt = group.options.find(o => o.id === optId)
      if (opt) total += opt.priceAdd
    }
  }
  return Math.max(0, total)
}

/**
 * Считает стоимость доставки по зоне
 * @param {string} zoneId
 * @param {number} orderTotal — сумма заказа
 * @returns {{ price: number, etaMinutes: number, minOrder: number } | null}
 */
export function getDeliveryZone(zoneId) {
  return RESTAURANT_CONFIG.delivery.zones.find(z => z.id === zoneId) ?? null
}

/**
 * Считает скидку на самовывоз
 * @param {number} orderTotal
 * @returns {number} сумма скидки
 */
export function getTakeawayDiscount(orderTotal) {
  const pct = RESTAURANT_CONFIG.delivery.takeawayDiscountPercent
  if (!pct) return 0
  return Math.round(orderTotal * pct / 100)
}

/**
 * Возвращает upsell-предложения для текущей корзины
 * @param {Array} cartItems — [{ category: 'main', ... }, ...]
 * @param {Array} allDishes — все блюда из меню
 * @returns {Array} — до maxSuggestions блюд
 */
export function getUpsellSuggestions(cartItems, allDishes) {
  const { enabled, rules, maxSuggestions } = RESTAURANT_CONFIG.upsell
  if (!enabled || !cartItems.length) return []

  const cartCategories = new Set(cartItems.map(i => i.category))
  const cartIds = new Set(cartItems.map(i => i.id))
  const suggestions = []

  for (const rule of rules) {
    if (!cartCategories.has(rule.categoryFrom)) continue
    // уже есть нужная категория в корзине — не предлагаем
    if (cartCategories.has(rule.categoryTo)) continue
    const candidates = allDishes
      .filter(d => d.category === rule.categoryTo && !cartIds.has(d.id))
      .slice(0, 2)
    candidates.forEach(d => suggestions.push({ ...d, _upsellLabel: rule.label }))
    if (suggestions.length >= maxSuggestions) break
  }

  return suggestions.slice(0, maxSuggestions)
}
