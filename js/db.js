/* LIFE ORGANIZER — DB (CRUD + agregações + motor financeiro). Sem DOM, testável em Node. */
'use strict'

const DB = (() => {
  const PRIORITIES = ['alta', 'media', 'baixa']
  const EVENT_CATEGORIES = ['Trabalho', 'Estudos', 'Pessoal', 'Saúde', 'Exercício', 'Família', 'Finanças', 'Igreja', 'Viagem', 'Outros']
  const TASK_STATUS = ['pending', 'in_progress', 'done', 'overdue', 'cancelled']
  const RECURRENCE = ['none', 'daily', 'weekly', 'monthly', 'yearly', 'specific']
  const TRANSACTION_TYPES = ['income', 'expense']
  const ACCOUNT_TYPES = ['current', 'savings', 'cash', 'digital', 'investment']
  const CARD_TYPES = ['credit', 'debit']
  const DEFAULT_CATEGORIES = [
    { id: 'cat_alimentacao', name: 'Alimentação', type: 'expense', icon: '🍽️', subcategories: ['Mercado', 'Restaurante', 'Delivery', 'Lanches'] },
    { id: 'cat_casa', name: 'Casa', type: 'expense', icon: '🏠', subcategories: ['Aluguel', 'Energia', 'Água', 'Internet', 'Gás', 'Condomínio'] },
    { id: 'cat_transporte', name: 'Transporte', type: 'expense', icon: '🚗', subcategories: ['Combustível', 'Uber', 'Ônibus', 'Manutenção'] },
    { id: 'cat_saude', name: 'Saúde', type: 'expense', icon: '💊', subcategories: ['Farmácia', 'Consulta', 'Exames', 'Plano de saúde'] },
    { id: 'cat_educacao', name: 'Educação', type: 'expense', icon: '📚', subcategories: ['Faculdade', 'Cursos', 'Livros', 'Material'] },
    { id: 'cat_lazer', name: 'Lazer', type: 'expense', icon: '🎬', subcategories: ['Cinema', 'Viagens', 'Jogos', 'Eventos'] },
    { id: 'cat_outros', name: 'Outros', type: 'expense', icon: '📦', subcategories: [] },
    { id: 'cat_salario', name: 'Salário', type: 'income', icon: '💼', subcategories: ['CLT', 'PJ'] },
    { id: 'cat_freelance', name: 'Freelance', type: 'income', icon: '🧑‍💻', subcategories: [] },
    { id: 'cat_extra', name: 'Renda extra', type: 'income', icon: '💰', subcategories: ['Comissão', 'Venda', 'Outros'] }
  ]
  const MAX_INSTALLMENTS = 48

  // ---------- helpers ----------
  function uid(prefix) { return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8) }
  function pad(n) { return String(n).padStart(2, '0') }
  function todayStr() { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) }
  function monthStr(dateStr) { return (dateStr || todayStr()).slice(0, 7) }
  function nowISO() { return new Date().toISOString() }
  function money(n) { return 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
  function num(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback }
  function clampDay(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() }
  function dateFromStr(s) {
    if (!s || typeof s !== 'string') return null
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!m) return null
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    return isNaN(d) ? null : d
  }
  function fmtDateBR(s) { const d = dateFromStr(s); return d ? d.toLocaleDateString('pt-BR') : s }
  function addDays(dateStr, n) { const d = dateFromStr(dateStr); if (!d) return null; d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) }
  function weekday(dateStr) { const d = dateFromStr(dateStr); return d ? d.getDay() : -1 } // 0=dom..6=sáb
  function monthDays(month) { const [y, m] = month.split('-').map(Number); return new Date(y, m, 0).getDate() }

  // ---------- coleções ----------
  const COLLECTIONS = ['settings', 'events', 'tasks', 'habits', 'notifications', 'categories', 'accounts', 'transactions', 'recurring', 'cards', 'cardPurchases', 'budgets', 'goals', 'debts', 'assets', 'transfers']

  function list(name) { return Storage.get(name, []) }
  function save(name, arr) { return Storage.set(name, arr) }
  function getById(name, id) { return list(name).find(x => x.id === id) || null }
  function insert(name, item) { const arr = list(name); arr.push(item); save(name, arr); return item }
  function update(name, id, patch) {
    const arr = list(name)
    const i = arr.findIndex(x => x.id === id)
    if (i < 0) return null
    arr[i] = Object.assign({}, arr[i], patch, { updatedAt: nowISO() })
    save(name, arr)
    return arr[i]
  }
  function remove(name, id) {
    const arr = list(name)
    const next = arr.filter(x => x.id !== id)
    save(name, next)
    return next.length !== arr.length
  }

  // ---------- sanitização zero-trust ----------
  function sanitizeEvent(e) {
    if (!e || typeof e.title !== 'string' || !e.title.trim()) return null
    const rec = RECURRENCE.includes(e.recurrence) ? e.recurrence : 'none'
    return {
      id: typeof e.id === 'string' ? e.id : uid('evt'),
      title: e.title.trim().slice(0, 200),
      description: (typeof e.description === 'string' ? e.description : '').slice(0, 2000),
      date: typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : todayStr(),
      startTime: typeof e.startTime === 'string' ? e.startTime.slice(0, 5) : '',
      endTime: typeof e.endTime === 'string' ? e.endTime.slice(0, 5) : '',
      location: (typeof e.location === 'string' ? e.location : '').slice(0, 200),
      category: EVENT_CATEGORIES.includes(e.category) ? e.category : 'Outros',
      priority: PRIORITIES.includes(e.priority) ? e.priority : 'media',
      recurrence: rec,
      daysOfWeek: Array.isArray(e.daysOfWeek) ? e.daysOfWeek.filter(n => Number.isInteger(n) && n >= 0 && n <= 6).sort() : [],
      notifyBefore: Number.isFinite(num(e.notifyBefore)) ? Math.max(0, Math.min(10080, Math.round(num(e.notifyBefore)))) : 30,
      observations: (typeof e.observations === 'string' ? e.observations : '').slice(0, 2000),
      status: e.status === 'done' ? 'done' : 'scheduled',
      gcalEventId: typeof e.gcalEventId === 'string' ? e.gcalEventId.slice(0, 200) : '',
      gcalSyncedAt: typeof e.gcalSyncedAt === 'string' ? e.gcalSyncedAt : '',
      gcalImported: !!e.gcalImported,
      createdAt: e.createdAt || nowISO(),
      updatedAt: e.updatedAt || nowISO()
    }
  }

  function sanitizeTask(t) {
    if (!t || typeof t.title !== 'string' || !t.title.trim()) return null
    return {
      id: typeof t.id === 'string' ? t.id : uid('tsk'),
      title: t.title.trim().slice(0, 200),
      description: (typeof t.description === 'string' ? t.description : '').slice(0, 1000),
      date: typeof t.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : todayStr(),
      time: typeof t.time === 'string' ? t.time.slice(0, 5) : '',
      priority: PRIORITIES.includes(t.priority) ? t.priority : 'media',
      category: (typeof t.category === 'string' ? t.category : 'Outros').slice(0, 60),
      deadline: typeof t.deadline === 'string' ? t.deadline.slice(0, 16) : '',
      status: TASK_STATUS.includes(t.status) ? t.status : 'pending',
      recurring: RECURRENCE.includes(t.recurring) ? t.recurring : 'none',
      createdAt: t.createdAt || nowISO(),
      updatedAt: t.updatedAt || nowISO()
    }
  }

  function sanitizeHabit(h) {
    if (!h || typeof h.name !== 'string' || !h.name.trim()) return null
    return {
      id: typeof h.id === 'string' ? h.id : uid('hab'),
      name: h.name.trim().slice(0, 80),
      icon: (typeof h.icon === 'string' ? h.icon : '⭐').slice(0, 4),
      color: (typeof h.color === 'string' ? h.color : '#2563eb').slice(0, 9),
      frequency: h.frequency === 'weekly' ? 'weekly' : 'daily',
      targetPerWeek: Number.isInteger(num(h.targetPerWeek)) ? Math.max(1, Math.min(7, Math.round(num(h.targetPerWeek)))) : 7,
      entries: Array.isArray(h.entries) ? h.entries.filter(x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)).sort() : [],
      createdAt: h.createdAt || nowISO(),
      updatedAt: h.updatedAt || nowISO()
    }
  }

  function sanitizeTransaction(t) {
    if (!t || typeof t.description !== 'string' || !t.description.trim()) return null
    const rawAmount = num(t.amount)
    if (!(rawAmount > 0)) return null
    const type = TRANSACTION_TYPES.includes(t.type) ? t.type : 'expense'
    let installment = null
    if (t.installment && typeof t.installment.groupId === 'string' && Number.isInteger(num(t.installment.number)) && Number.isInteger(num(t.installment.total))) {
      const n = Math.round(num(t.installment.number)), total = Math.round(num(t.installment.total))
      if (n >= 1 && n <= total && total <= MAX_INSTALLMENTS) installment = { groupId: t.installment.groupId, number: n, total }
    }
    return {
      id: typeof t.id === 'string' ? t.id : uid('txn'),
      description: t.description.trim().slice(0, 200),
      amount: rawAmount,
      type,
      category: (typeof t.category === 'string' ? t.category : 'Outros').slice(0, 60),
      subcategory: (typeof t.subcategory === 'string' ? t.subcategory : '').slice(0, 60),
      date: typeof t.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : todayStr(),
      account: (typeof t.account === 'string' ? t.account : '').slice(0, 60),
      method: (typeof t.method === 'string' ? t.method : '').slice(0, 60),
      installment,
      recurringId: typeof t.recurringId === 'string' ? t.recurringId : null,
      paid: type === 'expense' ? t.paid === true || t.paid === 'true' : true,
      status: ['paid', 'pending', 'overdue', 'scheduled'].includes(t.status) ? t.status : (type === 'expense' ? (t.paid === true || t.paid === 'true' ? 'paid' : 'pending') : 'paid'),
      observations: (typeof t.observations === 'string' ? t.observations : '').slice(0, 1000),
      createdAt: t.createdAt || nowISO(),
      updatedAt: t.updatedAt || nowISO()
    }
  }

  function sanitizeAccount(a) {
    if (!a || typeof a.name !== 'string' || !a.name.trim()) return null
    return {
      id: typeof a.id === 'string' ? a.id : uid('acc'),
      name: a.name.trim().slice(0, 80),
      type: ACCOUNT_TYPES.includes(a.type) ? a.type : 'current',
      bank: (typeof a.bank === 'string' ? a.bank : '').slice(0, 80),
      balance: num(a.balance),
      createdAt: a.createdAt || nowISO(),
      updatedAt: a.updatedAt || nowISO()
    }
  }

  function sanitizeRecurring(r) {
    if (!r || typeof r.description !== 'string' || !r.description.trim()) return null
    if (!(num(r.amount) > 0)) return null
    const freq = ['monthly', 'weekly', 'yearly'].includes(r.frequency) ? r.frequency : 'monthly'
    const minDay = freq === 'weekly' ? 0 : 1
    return {
      id: typeof r.id === 'string' ? r.id : uid('rec'),
      description: r.description.trim().slice(0, 200),
      amount: num(r.amount),
      type: TRANSACTION_TYPES.includes(r.type) ? r.type : 'expense',
      category: (typeof r.category === 'string' ? r.category : 'Outros').slice(0, 60),
      account: (typeof r.account === 'string' ? r.account : '').slice(0, 60),
      day: Number.isInteger(num(r.day)) ? Math.max(minDay, Math.min(freq === 'weekly' ? 6 : 31, Math.round(num(r.day)))) : (freq === 'weekly' ? 0 : 5),
      frequency: freq,
      startDate: typeof r.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.startDate) ? r.startDate : todayStr(),
      active: r.active !== false,
      notes: (typeof r.notes === 'string' ? r.notes : '').slice(0, 1000),
      createdAt: r.createdAt || nowISO(),
      updatedAt: r.updatedAt || nowISO()
    }
  }

  function sanitizeCard(c) {
    if (!c || typeof c.name !== 'string' || !c.name.trim()) return null
    return {
      id: typeof c.id === 'string' ? c.id : uid('card'),
      name: c.name.trim().slice(0, 80),
      bank: (typeof c.bank === 'string' ? c.bank : '').slice(0, 80),
      type: CARD_TYPES.includes(c.type) ? c.type : 'credit',
      limit: Math.max(0, num(c.limit)),
      closingDay: Number.isInteger(num(c.closingDay)) ? Math.max(1, Math.min(31, Math.round(num(c.closingDay)))) : 10,
      dueDay: Number.isInteger(num(c.dueDay)) ? Math.max(1, Math.min(31, Math.round(num(c.dueDay)))) : 17,
      createdAt: c.createdAt || nowISO(),
      updatedAt: c.updatedAt || nowISO()
    }
  }

  function sanitizeBudget(b) {
    if (!b || typeof b.category !== 'string' || !b.category.trim()) return null
    if (!(num(b.limit) > 0)) return null
    return {
      id: typeof b.id === 'string' ? b.id : uid('bud'),
      category: b.category.trim().slice(0, 60),
      month: typeof b.month === 'string' && /^\d{4}-\d{2}$/.test(b.month) ? b.month : monthStr(),
      limit: num(b.limit),
      createdAt: b.createdAt || nowISO(),
      updatedAt: b.updatedAt || nowISO()
    }
  }

  function sanitizeGoal(g) {
    if (!g || typeof g.name !== 'string' || !g.name.trim()) return null
    if (!(num(g.targetAmount) > 0)) return null
    return {
      id: typeof g.id === 'string' ? g.id : uid('goal'),
      name: g.name.trim().slice(0, 120),
      targetAmount: num(g.targetAmount),
      currentAmount: Math.max(0, num(g.currentAmount)),
      deadline: typeof g.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(g.deadline) ? g.deadline : null,
      monthlyContribution: Math.max(0, num(g.monthlyContribution)),
      createdAt: g.createdAt || nowISO(),
      updatedAt: g.updatedAt || nowISO()
    }
  }

  function sanitizeDebt(d) {
    if (!d || typeof d.creditor !== 'string' || !d.creditor.trim()) return null
    if (!(num(d.originalAmount) > 0)) return null
    return {
      id: typeof d.id === 'string' ? d.id : uid('dbt'),
      creditor: d.creditor.trim().slice(0, 120),
      originalAmount: num(d.originalAmount),
      currentAmount: num(d.currentAmount) > 0 ? num(d.currentAmount) : num(d.originalAmount),
      interestRate: Math.max(0, num(d.interestRate)),
      installments: Math.max(1, Math.round(num(d.installments)) || 1),
      dueDate: typeof d.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.dueDate) ? d.dueDate : null,
      status: ['open', 'paid', 'negotiating'].includes(d.status) ? d.status : 'open',
      createdAt: d.createdAt || nowISO(),
      updatedAt: d.updatedAt || nowISO()
    }
  }

  function sanitizeAsset(a) {
    if (!a || typeof a.name !== 'string' || !a.name.trim()) return null
    return {
      id: typeof a.id === 'string' ? a.id : uid('ast'),
      name: a.name.trim().slice(0, 120),
      type: (typeof a.type === 'string' ? a.type : 'Outros').slice(0, 60),
      value: Math.max(0, num(a.value)),
      createdAt: a.createdAt || nowISO(),
      updatedAt: a.updatedAt || nowISO()
    }
  }

  function sanitizeTransfer(t) {
    if (!t || typeof t.fromAccount !== 'string' || !t.fromAccount.trim()) return null
    if (!(num(t.amount) > 0)) return null
    return {
      id: typeof t.id === 'string' ? t.id : uid('trf'),
      fromAccount: t.fromAccount.trim().slice(0, 60),
      toAccount: (typeof t.toAccount === 'string' ? t.toAccount : '').slice(0, 60),
      amount: num(t.amount),
      date: typeof t.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : todayStr(),
      observations: (typeof t.observations === 'string' ? t.observations : '').slice(0, 500),
      createdAt: t.createdAt || nowISO(),
      updatedAt: t.updatedAt || nowISO()
    }
  }

  // ---------- CRUD exposto ----------
  const Events = {
    list: () => list('events'), get: id => getById('events', id),
    add: e => { const s = sanitizeEvent(e); return s ? insert('events', s) : { success: false, error: 'Evento inválido: título obrigatório.' } },
    update: (id, patch) => { const s = sanitizeEvent(Object.assign({}, getById('events', id), patch)); return s ? update('events', id, s) : null },
    remove: id => remove('events', id)
  }
  const Tasks = {
    list: () => list('tasks'), get: id => getById('tasks', id),
    add: t => { const s = sanitizeTask(t); return s ? insert('tasks', s) : { success: false, error: 'Tarefa inválida: título obrigatório.' } },
    update: (id, patch) => { const s = sanitizeTask(Object.assign({}, getById('tasks', id), patch)); return s ? update('tasks', id, s) : null },
    remove: id => remove('tasks', id)
  }
  const Habits = {
    list: () => list('habits'), get: id => getById('habits', id),
    add: h => { const s = sanitizeHabit(h); return s ? insert('habits', s) : { success: false, error: 'Hábito inválido: nome obrigatório.' } },
    update: (id, patch) => { const s = sanitizeHabit(Object.assign({}, getById('habits', id), patch)); return s ? update('habits', id, s) : null },
    remove: id => remove('habits', id)
  }
  const Notifications = {
    list: () => list('notifications').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    get: id => getById('notifications', id),
    add: n => insert('notifications', {
      id: uid('not'), type: (n.type || 'info').slice(0, 20), title: String(n.title || '').slice(0, 200),
      body: String(n.body || '').slice(0, 1000), read: !!n.read, important: !!n.important,
      createdAt: n.createdAt || nowISO(), scheduledAt: n.scheduledAt || null
    }),
    markRead: id => update('notifications', id, { read: true }),
    markAllRead: () => { const arr = list('notifications').map(n => Object.assign({}, n, { read: true })); save('notifications', arr); return arr.length },
    unreadCount: () => list('notifications').filter(n => !n.read).length,
    remove: id => remove('notifications', id),
    clearAll: () => save('notifications', [])
  }
  const Categories = {
    list: () => list('categories'),
    byType: type => list('categories').filter(c => c.type === type),
    ensureDefaults: () => { if (list('categories').length === 0) save('categories', DEFAULT_CATEGORIES.map(c => Object.assign({}, c))) },
    add: c => {
      if (!c || typeof c.name !== 'string' || !c.name.trim()) return { success: false, error: 'Categoria inválida.' }
      const type = TRANSACTION_TYPES.includes(c.type) ? c.type : 'expense'
      const exists = list('categories').some(x => x.name.toLowerCase() === c.name.trim().toLowerCase() && x.type === type)
      if (exists) return { success: false, error: 'Categoria já existe.' }
      return insert('categories', { id: uid('cat'), name: c.name.trim().slice(0, 60), type, icon: (c.icon || '🏷️').slice(0, 4), subcategories: Array.isArray(c.subcategories) ? c.subcategories : [] })
    },
    remove: id => remove('categories', id)
  }
  const Accounts = {
    list: () => list('accounts'), get: id => getById('accounts', id),
    add: a => { const s = sanitizeAccount(a); return s ? insert('accounts', s) : { success: false, error: 'Conta inválida: nome obrigatório.' } },
    update: (id, patch) => { const s = sanitizeAccount(Object.assign({}, getById('accounts', id), patch)); return s ? update('accounts', id, s) : null },
    remove: id => remove('accounts', id)
  }
  const Transactions = {
    list: () => list('transactions'), get: id => getById('transactions', id),
    add: t => {
      const inst = num(t.installments)
      if (t.installments !== undefined && t.installments !== null && t.installments !== '' && inst !== 1) {
        if (!Number.isInteger(inst) || inst < 2 || inst > MAX_INSTALLMENTS) return { success: false, error: 'Número de parcelas inválido (2 a 48).' }
        return addInstallments(t, inst)
      }
      const s = sanitizeTransaction(t)
      return s ? insert('transactions', s) : { success: false, error: 'Transação inválida: descrição e valor positivo obrigatórios.' }
    },
    update: (id, patch) => {
      const cur = getById('transactions', id)
      if (!cur) return null
      if (patch.paid === undefined) patch.paid = cur.paid
      const s = sanitizeTransaction(Object.assign({}, cur, patch))
      return s ? update('transactions', id, s) : null
    },
    remove: id => remove('transactions', id),
    removeInstallmentGroup: groupId => {
      const arr = list('transactions').filter(t => !(t.installment && t.installment.groupId === groupId))
      save('transactions', arr)
      return true
    },
    getInstallmentGroup: groupId => list('transactions').filter(t => t.installment && t.installment.groupId === groupId).sort((a, b) => a.installment.number - b.installment.number),
    togglePaid: id => { const t = getById('transactions', id); if (!t || t.type !== 'expense') return null; return update('transactions', id, { paid: !t.paid }) }
  }
  const Recurring = {
    list: () => list('recurring').filter(r => r.active),
    all: () => list('recurring'),
    get: id => getById('recurring', id),
    add: r => { const s = sanitizeRecurring(r); return s ? insert('recurring', s) : { success: false, error: 'Lançamento recorrente inválido.' } },
    update: (id, patch) => { const s = sanitizeRecurring(Object.assign({}, getById('recurring', id), patch)); return s ? update('recurring', id, s) : null },
    remove: id => remove('recurring', id),
    toggle: id => { const r = getById('recurring', id); return r ? update('recurring', id, { active: !r.active }) : null }
  }
  const Cards = {
    list: () => list('cards'), get: id => getById('cards', id),
    add: c => { const s = sanitizeCard(c); return s ? insert('cards', s) : { success: false, error: 'Cartão inválido: nome obrigatório.' } },
    update: (id, patch) => { const s = sanitizeCard(Object.assign({}, getById('cards', id), patch)); return s ? update('cards', id, s) : null },
    remove: id => { remove('cardPurchases', undefined); return remove('cards', id) }
  }
  const CardPurchases = {
    list: () => list('cardPurchases'),
    add: p => {
      if (!p || typeof p.description !== 'string' || !p.description.trim()) return { success: false, error: 'Compra inválida.' }
      const total = num(p.installments && p.installments.total) || 1
      const amount = total > 1 ? num(p.amount) / total : num(p.amount)
      const raw = { description: p.description.trim(), amount, type: 'expense', category: p.category || 'Outros', cardId: p.cardId || '', installment: total > 1 ? { groupId: uid('cgrp'), number: 1, total } : null, paid: false, date: p.date || todayStr(), observations: p.observations || '' }
      return insert('cardPurchases', raw)
    },
    remove: id => remove('cardPurchases', id)
  }
  const Budgets = {
    list: () => list('budgets'), get: id => getById('budgets', id),
    add: b => { const s = sanitizeBudget(b); return s ? insert('budgets', s) : { success: false, error: 'Orçamento inválido.' } },
    update: (id, patch) => { const s = sanitizeBudget(Object.assign({}, getById('budgets', id), patch)); return s ? update('budgets', id, s) : null },
    remove: id => remove('budgets', id)
  }
  const Goals = {
    list: () => list('goals'), get: id => getById('goals', id),
    add: g => { const s = sanitizeGoal(g); return s ? insert('goals', s) : { success: false, error: 'Meta inválida: nome e valor objetivo obrigatórios.' } },
    update: (id, patch) => { const s = sanitizeGoal(Object.assign({}, getById('goals', id), patch)); return s ? update('goals', id, s) : null },
    remove: id => remove('goals', id),
    contribute: (id, amount) => {
      const g = getById('goals', id)
      if (!g) return null
      const a = num(amount)
      if (!(a > 0)) return { success: false, error: 'Valor de aporte inválido.' }
      return update('goals', id, { currentAmount: g.currentAmount + a })
    }
  }
  const Debts = {
    list: () => list('debts'), get: id => getById('debts', id),
    add: d => { const s = sanitizeDebt(d); return s ? insert('debts', s) : { success: false, error: 'Dívida inválida.' } },
    update: (id, patch) => { const s = sanitizeDebt(Object.assign({}, getById('debts', id), patch)); return s ? update('debts', id, s) : null },
    remove: id => remove('debts', id)
  }
  const Assets = {
    list: () => list('assets'), get: id => getById('assets', id),
    add: a => { const s = sanitizeAsset(a); return s ? insert('assets', s) : { success: false, error: 'Bem inválido.' } },
    update: (id, patch) => { const s = sanitizeAsset(Object.assign({}, getById('assets', id), patch)); return s ? update('assets', id, s) : null },
    remove: id => remove('assets', id)
  }
  const Transfers = {
    list: () => list('transfers'), get: id => getById('transfers', id),
    add: t => { const s = sanitizeTransfer(t); return s ? insert('transfers', s) : { success: false, error: 'Transferência inválida.' } },
    remove: id => remove('transfers', id)
  }

  // ---------- parcelas ----------
  function addInstallments(t, total) {
    const s = sanitizeTransaction(Object.assign({}, t, { installment: null }))
    if (!s) return { success: false, error: 'Transação inválida.' }
    const groupId = uid('grp')
    const base = { description: s.description, amount: s.amount / total, type: s.type, category: s.category, subcategory: s.subcategory, account: s.account, method: s.method, observations: s.observations, recurringId: null, paid: s.paid }
    const start = dateFromStr(s.date)
    for (let i = 0; i < total; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
      const max = clampDay(d)
      d.setDate(Math.min(start.getDate(), max))
      const dateStr = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
      insert('transactions', sanitizeTransaction(Object.assign({}, base, { id: uid('txn'), date: dateStr, installment: { groupId, number: i + 1, total } })))
    }
    return { success: true, groupId, count: total }
  }
  function installmentDate(startDate, index) {
    const d = dateFromStr(startDate)
    if (!d) return null
    const nd = new Date(d.getFullYear(), d.getMonth() + index, 1)
    const max = clampDay(nd)
    nd.setDate(Math.min(d.getDate(), max))
    return nd.getFullYear() + '-' + pad(nd.getMonth() + 1) + '-' + pad(nd.getDate())
  }

  // ---------- recorrentes ----------
  function nextRecurringDate(r, fromDate) {
    const from = dateFromStr(fromDate || todayStr())
    if (!from) return null
    const start = dateFromStr(r.startDate)
    if (r.frequency === 'weekly') {
      let anchor = start && start > from ? start : from
      const target = r.day
      if (anchor.getDay() > target) anchor.setDate(anchor.getDate() + (7 - anchor.getDay() + target))
      else if (anchor.getDay() < target) anchor.setDate(anchor.getDate() + (target - anchor.getDay()))
      return anchor.getFullYear() + '-' + pad(anchor.getMonth() + 1) + '-' + pad(anchor.getDate())
    }
    let y = from.getFullYear(), m = from.getMonth()
    if (r.frequency === 'yearly') {
      let d = new Date(y, (start ? start.getMonth() : 0), r.day)
      if (d < from) d = new Date(y + 1, start ? start.getMonth() : 0, r.day)
      const max = clampDay(d)
      if (d.getDate() > max) d.setDate(max)
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
    }
    let d = new Date(y, m, r.day)
    if (d < from) d = new Date(y, m + 1, r.day)
    const max = clampDay(d)
    if (d.getDate() > max) d.setDate(max)
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
  }
  function upcomingRecurring(fromDate, daysAhead) {
    const from = fromDate || todayStr()
    const horizon = addDays(from, daysAhead || 90)
    const out = []
    Recurring.all().forEach(r => {
      if (!r.active) return
      let d = nextRecurringDate(r, from)
      let guard = 0
      while (d && d <= horizon && guard < 200) {
        const already = list('transactions').some(t => t.recurringId === r.id && t.date === d)
        if (!already) out.push(Object.assign({}, r, { nextDate: d }))
        d = nextRecurringDate(Object.assign({}, r, { startDate: addDays(d, 1) }), addDays(d, 1))
        guard++
      }
    })
    return out.sort((a, b) => a.nextDate.localeCompare(b.nextDate))
  }
  function generateRecurring(r, dateStr) {
    const exists = list('transactions').some(t => t.recurringId === r.id && t.date === dateStr)
    if (exists) return { success: false, error: 'Lançamento já gerado para esta data.' }
    return insert('transactions', sanitizeTransaction({
      description: r.description, amount: r.amount, type: r.type, category: r.category,
      account: r.account, date: dateStr, paid: r.type === 'income', recurringId: r.id,
      observations: 'Gerado automaticamente'
    }))
  }

  // ---------- agenda ----------
  function expandRecurrence(event, fromStr, toStr) {
    const out = []
    const from = dateFromStr(fromStr), to = dateFromStr(toStr)
    if (!from || !to) return out
    const base = dateFromStr(event.date)
    if (!base) return out
    const push = d => {
      const s = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
      out.push(Object.assign({}, event, { date: s, occurrenceOf: event.id }))
    }
    if (event.recurrence === 'none') {
      if (base >= from && base <= to) push(base)
      return out
    }
    if (event.recurrence === 'specific') {
      const days = event.daysOfWeek || []
      let cur = new Date(from)
      while (cur <= to) {
        if (days.includes(cur.getDay())) push(cur)
        cur.setDate(cur.getDate() + 1)
      }
      return out
    }
    if (event.recurrence === 'daily') {
      let cur = new Date(base)
      if (cur < from) cur = new Date(from)
      while (cur <= to) { push(cur); cur.setDate(cur.getDate() + 1) }
      return out
    }
    if (event.recurrence === 'weekly') {
      let cur = new Date(base)
      if (cur < from) {
        const diff = Math.ceil((from - cur) / 86400000 / 7) * 7
        cur = new Date(cur.getTime() + diff * 86400000)
      }
      while (cur <= to) { push(cur); cur.setDate(cur.getDate() + 7) }
      return out
    }
    if (event.recurrence === 'monthly') {
      const day = base.getDate()
      let cur = new Date(from.getFullYear(), from.getMonth(), 1)
      while (cur <= to) {
        // cria no dia 1 e faz clamp — `new Date(y, m, 31)` em fev overflow para março antes do clamp
        let d = new Date(cur.getFullYear(), cur.getMonth(), 1)
        d.setDate(Math.min(day, clampDay(d)))
        if (d >= from && d <= to && d >= base) push(d)
        cur.setMonth(cur.getMonth() + 1)
      }
      return out
    }
    if (event.recurrence === 'yearly') {
      let cur = new Date(from.getFullYear(), base.getMonth(), 1)
      if (cur < base) cur = new Date(from.getFullYear() + 1, base.getMonth(), 1)
      while (cur <= to) {
        const d = new Date(cur.getFullYear(), cur.getMonth(), 1)
        d.setDate(Math.min(base.getDate(), clampDay(d)))
        if (d >= from && d >= base) push(d)
        cur = new Date(cur.getFullYear() + 1, base.getMonth(), 1)
      }
      return out
    }
    return out
  }
  function eventsByDate(dateStr) {
    return expandRecurrenceAll(dateStr, dateStr).sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'))
  }
  function expandRecurrenceAll(fromStr, toStr) {
    return Events.list().reduce((acc, e) => acc.concat(expandRecurrence(e, fromStr, toStr)), [])
  }
  function weekDates(startDate) {
    const d = dateFromStr(startDate)
    const out = []
    for (let i = 0; i < 7; i++) {
      const nd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i)
      out.push(nd.getFullYear() + '-' + pad(nd.getMonth() + 1) + '-' + pad(nd.getDate()))
    }
    return out
  }
  function monthGrid(month) {
    const [y, m] = month.split('-').map(Number)
    const first = new Date(y, m - 1, 1)
    const startOffset = (first.getDay() + 6) % 7 // segunda=0
    const total = new Date(y, m, 0).getDate()
    const cells = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    for (let d = 1; d <= total; d++) cells.push(y + '-' + pad(m) + '-' + pad(d))
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }

  // ---------- tarefas ----------
  function tasksByDate(dateStr) { return Tasks.list().filter(t => t.date === dateStr && t.status !== 'cancelled') }
  function taskStats() {
    const all = Tasks.list()
    const done = all.filter(t => t.status === 'done').length
    const pending = all.filter(t => ['pending', 'in_progress'].includes(t.status)).length
    return { total: all.length, done, pending, overdue: all.filter(t => isOverdue(t)).length }
  }
  function isOverdue(t) {
    if (['done', 'cancelled', 'overdue'].includes(t.status)) return false
    if (!t.date) return false
    const d = dateFromStr(t.date)
    const today = dateFromStr(todayStr())
    if (!d || !today) return false
    if (d < today) return true
    if (d.getTime() === today.getTime()) {
      const now = new Date()
      const hm = (t.time || '').split(':').map(Number)
      if (hm.length === 2 && now.getHours() * 60 + now.getMinutes() > hm[0] * 60 + hm[1]) return true
    }
    return false
  }
  function normalizeTaskOverdue() {
    Tasks.list().forEach(t => {
      if (isOverdue(t)) update('tasks', t.id, { status: 'overdue' })
    })
  }

  // ---------- hábitos ----------
  function habitStreak(h) {
    let streak = 0
    let cur = dateFromStr(todayStr())
    if (!h.entries.includes(todayStr())) cur.setDate(cur.getDate() - 1)
    while (h.entries.includes(cur.getFullYear() + '-' + pad(cur.getMonth() + 1) + '-' + pad(cur.getDate()))) {
      streak++
      cur.setDate(cur.getDate() - 1)
    }
    return streak
  }
  function habitToggle(h, dateStr) {
    // busca o estado ATUAL do storage (o objeto passado pode estar desatualizado após toggles anteriores)
    const cur = (h && h.id && getById('habits', h.id)) || h
    if (!cur) return null
    const date = dateStr || todayStr()
    const entries = cur.entries.includes(date) ? cur.entries.filter(x => x !== date) : cur.entries.concat([date]).sort()
    return update('habits', cur.id, { entries })
  }
  function habitCompletionsThisWeek(h, refDate) {
    const ref = dateFromStr(refDate || todayStr())
    const monday = new Date(ref)
    monday.setDate(ref.getDate() - ((ref.getDay() + 6) % 7))
    let count = 0
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)
      count += h.entries.includes(d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())) ? 1 : 0
    }
    return count
  }

  // ---------- finanças: agregações ----------
  function transactionsByMonth(month) {
    const m = month || monthStr()
    return Transactions.list().filter(t => t.date.slice(0, 7) === m)
  }
  function transactionsByRange(fromStr, toStr) {
    return Transactions.list().filter(t => t.date >= fromStr && t.date <= toStr)
  }
  function monthlySummary(month) {
    const txs = transactionsByMonth(month)
    const incomes = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return { month: month || monthStr(), incomes, expenses, balance: incomes - expenses, count: txs.length }
  }
  function allTimeSummary() {
    const txs = Transactions.list()
    const incomes = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return { incomes, expenses, balance: incomes - expenses }
  }
  function accountBalance(accountId) {
    const txs = Transactions.list().filter(t => !t.account || t.account === accountId)
    const base = Accounts.get(accountId)
    let balance = base ? base.balance : 0
    balance += txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    balance -= txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return balance
  }
  function totalBalance() {
    const accounts = Accounts.list()
    const sum = accounts.reduce((s, a) => s + a.balance, 0)
    const txs = Transactions.list()
    const inc = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const exp = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return sum + inc - exp
  }
  function unpaidExpenses(refDate) {
    const today = refDate || todayStr()
    return Transactions.list()
      .filter(t => t.type === 'expense' && !t.paid)
      .map(t => {
        const d = dateFromStr(t.date)
        const daysOverdue = d ? Math.round((dateFromStr(today) - d) / 86400000) : 0
        return Object.assign({}, t, { daysOverdue })
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  }
  function pendingSummary() {
    const up = unpaidExpenses()
    return { total: up.reduce((s, t) => s + t.amount, 0), count: up.length, overdueCount: up.filter(t => t.daysOverdue > 0).length, overdueTotal: up.filter(t => t.daysOverdue > 0).reduce((s, t) => s + t.amount, 0) }
  }
  function upcomingPayments(daysAhead) {
    const today = todayStr()
    const horizon = addDays(today, daysAhead || 7)
    return unpaidExpenses().filter(t => t.date >= today && t.date <= horizon)
  }
  function expensesByCategory(month) {
    const txs = transactionsByMonth(month).filter(t => t.type === 'expense')
    const map = {}
    txs.forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount })
    return Object.keys(map).map(name => ({ name, total: map[name] })).sort((a, b) => b.total - a.total)
  }
  function monthlySeries(months) {
    const out = []
    const today = new Date()
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const m = d.getFullYear() + '-' + pad(d.getMonth() + 1)
      out.push(Object.assign({ month: m }, monthlySummary(m)))
    }
    return out
  }
  function budgetProgress(month) {
    const budgets = Budgets.list().filter(b => b.month === (month || monthStr()))
    return budgets.map(b => {
      const spent = transactionsByMonth(b.month).filter(t => t.type === 'expense' && t.category === b.category).reduce((s, t) => s + t.amount, 0)
      const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0
      return Object.assign({}, b, { spent, pct, available: b.limit - spent, level: pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'ok' })
    })
  }
  function budgetAlerts(month) {
    return budgetProgress(month).map(b => ({
      level: b.level,
      category: b.category,
      pct: Math.round(b.pct),
      spent: b.spent,
      limit: b.limit,
      message: b.level === 'danger' ? `Você já utilizou ${Math.round(b.pct)}% do orçamento de ${b.category} (estourou em ${money(b.spent - b.limit)}).`
        : b.level === 'warning' ? `Atenção: você já utilizou ${Math.round(b.pct)}% do orçamento de ${b.category}.` : null
    })).filter(a => a.message)
  }
  function cardUtilization(cardId) {
    const card = Cards.get(cardId)
    if (!card) return null
    const purchases = CardPurchases.list().filter(p => p.cardId === cardId && !p.paid)
    const used = purchases.reduce((s, p) => s + p.amount, 0)
    return Object.assign({}, card, { used, available: Math.max(0, card.limit - used), pct: card.limit > 0 ? (used / card.limit) * 100 : 0 })
  }
  function currentInvoice(cardId) {
    const card = Cards.get(cardId)
    if (!card) return null
    const purchases = CardPurchases.list().filter(p => p.cardId === cardId)
    const total = purchases.reduce((s, p) => s + p.amount, 0)
    return { card, purchases, total, closingDay: card.closingDay, dueDay: card.dueDay }
  }
  function goalProgress(g) {
    const pct = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0
    return Object.assign({}, g, { pct, remaining: Math.max(0, g.targetAmount - g.currentAmount), isComplete: g.currentAmount >= g.targetAmount })
  }
  function netWorth() {
    const assets = Assets.list().reduce((s, a) => s + a.value, 0)
    const cash = totalBalance()
    const debts = Debts.list().filter(d => d.status !== 'paid').reduce((s, d) => s + d.currentAmount, 0)
    return { assets, cash, debts, total: assets + cash - debts }
  }
  function transfer(fromId, toId, amount, date, obs) {
    const a = num(amount)
    if (!(a > 0)) return { success: false, error: 'Valor inválido.' }
    if (fromId === toId) return { success: false, error: 'Contas de origem e destino devem ser diferentes.' }
    const from = Accounts.get(fromId), to = Accounts.get(toId)
    if (!from || !to) return { success: false, error: 'Conta não encontrada.' }
    update('accounts', fromId, { balance: from.balance - a })
    update('accounts', toId, { balance: to.balance + a })
    return insert('transfers', sanitizeTransfer({ fromAccount: fromId, toAccount: toId, amount: a, date: date || todayStr(), observations: obs || '' }))
  }

  // ---------- previsão ----------
  function forecast(days) {
    const today = todayStr()
    const horizon = addDays(today, days || 30)
    const expectedIncomes = upcomingRecurring(today, days).filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0)
    const expectedExpenses = upcomingRecurring(today, days).filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0)
    const unpaid = unpaidExpenses().filter(t => t.date >= today && t.date <= horizon).reduce((s, t) => s + t.amount, 0)
    const cardDue = Cards.list().reduce((s, c) => {
      const inv = currentInvoice(c.id)
      return inv && inv.dueDay >= 1 ? s + inv.total : s
    }, 0)
    const start = totalBalance()
    return {
      days, start, expectedIncomes, expectedExpenses, unpaid, cardDue,
      projected: start + expectedIncomes - expectedExpenses - unpaid - cardDue
    }
  }

  // ---------- export/import ----------
  function exportAllData() {
    const data = { app: 'life-organizer', version: '1.0', exportedAt: nowISO() }
    COLLECTIONS.forEach(name => { data[name] = list(name) })
    return data
  }
  function sanitizeCollection(name, arr) {
    const map = {
      events: sanitizeEvent, tasks: sanitizeTask, habits: sanitizeHabit,
      transactions: sanitizeTransaction, recurring: sanitizeRecurring,
      accounts: sanitizeAccount, cards: sanitizeCard, budgets: sanitizeBudget,
      goals: sanitizeGoal, debts: sanitizeDebt, assets: sanitizeAsset,
      transfers: sanitizeTransfer
    }
    if (!map[name]) return arr.filter(Boolean)
    return arr.map(map[name]).filter(Boolean)
  }
  function importAllData(data) {
    if (!data || typeof data !== 'object') return { success: false, error: 'Dados inválidos: esperado um objeto de backup.' }
    const ignored = {}
    COLLECTIONS.forEach(name => {
      if (data[name] === undefined) return
      const arr = Array.isArray(data[name]) ? data[name] : null
      if (!arr) { ignored[name] = 0; return }
      const cleaned = sanitizeCollection(name, arr)
      ignored[name] = arr.length - cleaned.length
      save(name, cleaned)
    })
    return { success: true, ignored }
  }
  function clearAllData() { Storage.clearAll(); return true }

  // ---------- init ----------
  function init() {
    Categories.ensureDefaults()
    if (!Storage.get('settings')) Storage.set('settings', defaultSettings())
    if (list('accounts').length === 0) {
      save('accounts', [
        { id: 'acc_carteira', name: 'Carteira', type: 'cash', bank: '', balance: 0, createdAt: nowISO(), updatedAt: nowISO() },
        { id: 'acc_conta', name: 'Conta corrente', type: 'current', bank: '', balance: 0, createdAt: nowISO(), updatedAt: nowISO() }
      ])
    }
    normalizeTaskOverdue()
    return true
  }
  function defaultSettings() {
    return {
      name: 'Anthony',
      theme: 'dark',
      currency: 'BRL',
      timezone: Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'America/Sao_Paulo',
      notificationPrefs: { enabled: true, daysBefore: [5, 3, 2, 1], sound: true, vibration: true, banner: true, silent: false, customDays: 0 },
      greeting: true
    }
  }
  function getSettings() { return Object.assign({}, defaultSettings(), Storage.get('settings', {})) }
  function saveSettings(patch) { const s = Object.assign({}, getSettings(), patch); Storage.set('settings', s); return s }

  return {
    uid, todayStr, monthStr, nowISO, money, num, pad, dateFromStr, fmtDateBR, addDays, weekday, monthDays,
    DEFAULT_CATEGORIES, PRIORITIES, EVENT_CATEGORIES, TASK_STATUS, RECURRENCE, TRANSACTION_TYPES, MAX_INSTALLMENTS,
    list, save, getById, insert, update, remove,
    Events, Tasks, Habits, Notifications, Categories, Accounts, Transactions, Recurring, Cards, CardPurchases,
    Budgets, Goals, Debts, Assets, Transfers,
    addInstallments, installmentDate, nextRecurringDate, upcomingRecurring, generateRecurring,
    expandRecurrence, expandRecurrenceAll, eventsByDate, weekDates, monthGrid,
    tasksByDate, taskStats, isOverdue, normalizeTaskOverdue,
    habitStreak, habitToggle, habitCompletionsThisWeek,
    transactionsByMonth, transactionsByRange, monthlySummary, allTimeSummary, accountBalance, totalBalance,
    unpaidExpenses, pendingSummary, upcomingPayments, expensesByCategory, monthlySeries,
    budgetProgress, budgetAlerts, cardUtilization, currentInvoice, goalProgress, netWorth, transfer,
    forecast, exportAllData, importAllData, clearAllData,
    getSettings, saveSettings, init
  }
})()

if (typeof module !== 'undefined' && module.exports) module.exports = { DB }