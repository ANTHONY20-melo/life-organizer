/* LIFE ORGANIZER — Storage (wrapper localStorage com prefixo + criptografia opcional) */
'use strict'

const Storage = (() => {
  const PREFIX = 'lifeorganizer_'
  const ENCRYPTED_PREFIX = 'lifeorganizer_enc_'

  // Cache em memória para dados descriptografados (mantém reads síncronos)
  let _cache = {}

  function key(name) { return PREFIX + name }
  function encKey(name) { return ENCRYPTED_PREFIX + name }

  function get(name, fallback = null) {
    try {
      // Se temos cache (PIN desbloqueado), usar ele
      if (_cache && name in _cache) return _cache[name]
      // Tenta ler descriptografado primeiro
      const encRaw = localStorage.getItem(encKey(name))
      if (encRaw && Crypto.isEncryptionActive()) {
        // Dados criptografados precisam ser lidos do cache (async decrypt já feito no unlock)
        return fallback
      }
      // Fallback para localStorage normal (sem criptografia)
      const raw = localStorage.getItem(key(name))
      return raw === null ? fallback : JSON.parse(raw)
    } catch (e) {
      console.error('Storage.get error', name, e)
      return fallback
    }
  }

  function set(name, value) {
    try {
      // Salva no cache
      _cache[name] = value
      // Se criptografia ativa, salva criptografado
      if (typeof Crypto !== 'undefined' && Crypto.isEncryptionActive()) {
        // Serializa para JSON e criptografa async, mas salva síncrono no cache
        const json = JSON.stringify(value)
        Crypto.encryptValue(json).then(enc => {
          localStorage.setItem(encKey(name), enc)
          localStorage.removeItem(key(name)) // remove versão antiga não-criptografada
        }).catch(() => {
          // Fallback: salva não-criptografado
          localStorage.setItem(key(name), json)
        })
        return true
      }
      // Sem criptografia: salva direto
      localStorage.setItem(key(name), JSON.stringify(value))
      return true
    } catch (e) {
      console.error('Storage.set error', name, e)
      return false
    }
  }

  function remove(name) {
    delete _cache[name]
    localStorage.removeItem(key(name))
    localStorage.removeItem(encKey(name))
  }

  function clearAll() {
    _cache = {}
    const keys = []
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i))
    keys.filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k))
  }

  // ---------- criptografia: unlock (descriptografa tudo para o cache) ----------
  async function unlock(pin) {
    const ok = await Crypto.verifyPin(pin)
    if (!ok) return false
    // Descriptografa todos os dados salvos no localStorage
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(ENCRYPTED_PREFIX)) keys.push(k)
    }
    for (const encName of keys) {
      const name = encName.replace(ENCRYPTED_PREFIX, '')
      const encValue = localStorage.getItem(encName)
      if (encValue) {
        try {
          const decrypted = await Crypto.decryptValue(encValue)
          _cache[name] = JSON.parse(decrypted)
        } catch {
          // Se descriptografia falhar, ignora (dado corrompido ou chave errada)
        }
      }
    }
    // Também carrega dados não-criptografados (migration)
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(PREFIX) && !k.startsWith(ENCRYPTED_PREFIX)) {
        const name = k.replace(PREFIX, '')
        if (!(name in _cache)) {
          try { _cache[name] = JSON.parse(localStorage.getItem(k)) } catch { /* skip */ }
        }
      }
    }
    return true
  }

  function lockStorage() {
    _cache = {}
    Crypto.lock()
  }

  // Migra dados existentes para criptografia
  async function migrateToEncryption() {
    if (!Crypto.isEncryptionActive()) return
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(PREFIX) && !k.startsWith(ENCRYPTED_PREFIX)) {
        keys.push(k)
      }
    }
    for (const plainKey of keys) {
      const name = plainKey.replace(PREFIX, '')
      const value = localStorage.getItem(plainKey)
      if (value) {
        try {
          const enc = await Crypto.encryptValue(value)
          localStorage.setItem(encKey(name), enc)
          localStorage.removeItem(plainKey)
          _cache[name] = JSON.parse(value)
        } catch { /* skip */ }
      }
    }
  }

  return { PREFIX, key, get, set, remove, clearAll, unlock, lockStorage, migrateToEncryption }
})()

if (typeof module !== 'undefined' && module.exports) module.exports = { Storage }
