/* LIFE ORGANIZER — Storage (wrapper localStorage com prefixo) */
'use strict'

const Storage = (() => {
  const PREFIX = 'lifeorganizer_'

  function key(name) { return PREFIX + name }

  function get(name, fallback = null) {
    try {
      const raw = localStorage.getItem(key(name))
      return raw === null ? fallback : JSON.parse(raw)
    } catch (e) {
      console.error('Storage.get error', name, e)
      return fallback
    }
  }

  function set(name, value) {
    try {
      localStorage.setItem(key(name), JSON.stringify(value))
      return true
    } catch (e) {
      console.error('Storage.set error', name, e)
      return false
    }
  }

  function remove(name) { localStorage.removeItem(key(name)) }

  function clearAll() {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i))
    keys.filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k))
  }

  return { PREFIX, key, get, set, remove, clearAll }
})()

if (typeof module !== 'undefined' && module.exports) module.exports = { Storage }