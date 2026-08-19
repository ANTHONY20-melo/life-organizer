/* LIFE ORGANIZER — Service Worker (cache + notificações agendadas locais) */
'use strict'

const CACHE = 'lifeorganizer-v1'
const ASSETS = [
  './', './index.html', './manifest.json',
  './css/style.css',
  './js/storage.js', './js/db.js', './js/insights.js', './js/notifications.js', './js/export.js', './js/app.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable.png'
]

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  if (url.origin !== location.origin) return
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return r }).catch(() => caches.match('./index.html')))
    return
  }
  e.respondWith(caches.match(e.request).then(cached => {
    const fetched = fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r }).catch(() => cached)
    return cached || fetched
  }))
})

// ---------- notificações agendadas (TimestampTrigger) ----------
const DB_NAME = 'lo-reminders'
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore('reminders', { keyPath: 'tag' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
async function saveReminders(reminders) {
  const db = await openDB()
  const tx = db.transaction('reminders', 'readwrite')
  const store = tx.objectStore('reminders')
  store.clear()
  reminders.forEach(r => store.put(r))
  await new Promise(res => { tx.oncomplete = res })
  return reminders.length
}
async function scheduleReminders(reminders) {
  if (!('showTrigger' in Notification.prototype)) return { scheduled: 0, supported: false }
  const count = await saveReminders(reminders)
  reminders.forEach(r => {
    const when = r.timestamp <= Date.now() ? Date.now() + 5000 : r.timestamp
    self.registration.showNotification(r.title, {
      body: r.body,
      tag: r.tag,
      icon: './icons/icon-192.png',
      data: { url: './' },
      showTrigger: new TimestampTrigger(when)
    }).catch(() => {})
  })
  return { scheduled: count, supported: true }
}

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'PLAN_REMINDERS') {
    e.waitUntil(scheduleReminders(e.data.reminders || []))
  }
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    if (list.length) { list[0].focus(); return list[0].navigate('./') }
    return clients.openWindow('./')
  }))
})