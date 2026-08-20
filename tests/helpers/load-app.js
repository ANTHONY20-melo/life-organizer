/* Helper: carrega os módulos do app numa VM com localStorage mock (padrão da casa). */
'use strict'

const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.join(__dirname, '..', '..')

function createLocalStorage() {
  const store = {}
  return {
    store,
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: k => { delete store[k] },
    key: i => Object.keys(store)[i] || null,
    get length() { return Object.keys(store).length },
    clear: () => { Object.keys(store).forEach(k => delete store[k]) }
  }
}

function loadApp(extraGlobals = {}) {
  const sandbox = {
    console,
    Date,
    Math,
    JSON,
    Number,
    String,
    Object,
    Array,
    Boolean,
    Intl,
    setTimeout,
    clearTimeout,
    localStorage: createLocalStorage(),
    ...extraGlobals
  }
  vm.createContext(sandbox)
  const files = ['storage.js', 'crypto.js', 'db.js', 'insights.js', 'notifications.js', 'export.js']
  files.forEach(f => {
    const code = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8')
    vm.runInContext(code, sandbox, { filename: f })
  })
  // const/let top-level ficam no escopo lexical do contexto (não viram propriedade do sandbox);
  // promove as exports para acesso de fora (padrão da casa).
  ;['Storage', 'DB', 'Insights', 'NotificationPlanner', 'Export'].forEach(n => {
    sandbox[n] = vm.runInContext(`typeof ${n} !== 'undefined' ? ${n} : undefined`, sandbox)
  })
  return sandbox
}

module.exports = { loadApp, createLocalStorage }