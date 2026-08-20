/* LIFE ORGANIZER — Crypto (Web Crypto API + PIN lock). Protege dados sensíveis no localStorage. */
'use strict'

const Crypto = (() => {
  const SALT_KEY = 'lifeorganizer_salt'
  const VERIFY_KEY = 'lifeorganizer_verify'
  const PIN_HASH_KEY = 'lifeorganizer_pin_hash'

  let _key = null

  // ---------- helpers ----------
  function buf2hex(buf) { return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('') }
  function hex2buf(hex) { const bytes = new Uint8Array(hex.length / 2); for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16); return bytes }

  // ---------- PIN ----------
  function isPinSet() {
    return localStorage.getItem(PIN_HASH_KEY) !== null
  }

  async function hashPin(pin, saltHex) {
    const enc = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits({
      name: 'PBKDF2',
      salt: hex2buf(saltHex),
      iterations: 100000,
      hash: 'SHA-256'
    }, keyMaterial, 256)
    return buf2hex(bits)
  }

  async function setupPin(pin) {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const saltHex = buf2hex(salt)
    localStorage.setItem(SALT_KEY, saltHex)
    const hash = await hashPin(pin, saltHex)
    localStorage.setItem(PIN_HASH_KEY, hash)
    // token de verificação para saber se a chave está correta
    const verifyPlain = 'life-organizer-verify-ok'
    const verifyEnc = await encryptValue(verifyPlain)
    localStorage.setItem(VERIFY_KEY, verifyEnc)
    return true
  }

  async function verifyPin(pin) {
    const saltHex = localStorage.getItem(SALT_KEY)
    if (!saltHex) return false
    const hash = await hashPin(pin, saltHex)
    const stored = localStorage.getItem(PIN_HASH_KEY)
    if (hash !== stored) return false
    // Deriva a chave de criptografia a partir do PIN
    const enc = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey'])
    _key = await crypto.subtle.deriveKey({
      name: 'PBKDF2',
      salt: hex2buf(saltHex),
      iterations: 100000,
      hash: 'SHA-256'
    }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    // Verifica se a chave funciona
    const verifyEnc = localStorage.getItem(VERIFY_KEY)
    if (verifyEnc) {
      try { await decryptValue(verifyEnc); return true } catch { _key = null; return false }
    }
    return true
  }

  async function changePin(oldPin, newPin) {
    const ok = await verifyPin(oldPin)
    if (!ok) return false
    // Re-encrypt verify token with new key
    await setupPin(newPin)
    _key = null
    await verifyPin(newPin)
    return true
  }

  async function removePin(pin) {
    const ok = await verifyPin(pin)
    if (!ok) return false
    localStorage.removeItem(PIN_HASH_KEY)
    localStorage.removeItem(SALT_KEY)
    localStorage.removeItem(VERIFY_KEY)
    _key = null
    return true
  }

  // ---------- encrypt / decrypt ----------
  async function encryptValue(value) {
    if (!_key) return value
    const enc = new TextEncoder()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, _key, enc.encode(value))
    return buf2hex(iv) + ':' + buf2hex(ciphertext)
  }

  async function decryptValue(value) {
    if (!_key) return value
    if (!value || typeof value !== 'string') return value
    const parts = value.split(':')
    if (parts.length !== 2) return value
    try {
      const iv = hex2buf(parts[0])
      const data = hex2buf(parts[1])
      const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, _key, data)
      return new TextDecoder().decode(plainBuf)
    } catch {
      return value // não criptografado ou chave errada
    }
  }

  function isLocked() { return _key === null && isPinSet() }
  function isEncryptionActive() { return _key !== null }
  function lock() { _key = null }

  return {
    isPinSet, setupPin, verifyPin, changePin, removePin,
    encryptValue, decryptValue, isLocked, isEncryptionActive, lock
  }
})()

if (typeof module !== 'undefined' && module.exports) module.exports = { Crypto }
