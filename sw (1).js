const CACHE = 'foodflow-v1'
const STATIC = [
  '/',
  '/index.html',
]

// Установка — кэшируем основное
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  )
})

// Активация — чистим старый кэш
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Fetch — сеть приоритет, кэш как резерв
self.addEventListener('fetch', e => {
  // Supabase запросы — всегда из сети
  if (e.request.url.includes('supabase.co')) return

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Кэшируем успешные GET-запросы
        if (e.request.method === 'GET' && res.status === 200) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }
        return res
      })
      .catch(() => caches.match(e.request))
  )
})
