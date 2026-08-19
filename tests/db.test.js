'use strict'
const test = require('node:test')
const assert = require('node:assert')
const { loadApp } = require('./helpers/load-app.js')

function fresh() { const s = loadApp(); s.DB.init(); return s }

test('init cria categorias padrão e contas padrão', () => {
  const s = fresh()
  assert.ok(s.DB.Categories.list().length >= 8)
  assert.ok(s.DB.Accounts.list().length >= 2)
})

test('evento: adiciona com título obrigatório e valida campos', () => {
  const s = fresh()
  const bad = s.DB.Events.add({ title: '', date: '2026-08-20' })
  assert.strictEqual(bad.success, false)
  const ev = s.DB.Events.add({ title: 'Reunião', date: '2026-08-20', startTime: '10:00', category: 'Trabalho', priority: 'alta', recurrence: 'weekly', notifyBefore: 30 })
  assert.strictEqual(ev.success, undefined)
  assert.strictEqual(ev.title, 'Reunião')
  assert.strictEqual(ev.recurrence, 'weekly')
  assert.strictEqual(ev.priority, 'alta')
  const got = s.DB.Events.get(ev.id)
  assert.strictEqual(got.title, 'Reunião')
})

test('tarefa: recorrência inválida cai para none; status válido', () => {
  const s = fresh()
  const t = s.DB.Tasks.add({ title: 'Estudar', date: '2026-08-21', priority: 'media', recurring: 'bogus', status: 'pending' })
  assert.strictEqual(t.recurring, 'none')
  assert.strictEqual(t.status, 'pending')
})

test('transação: rejeita valor zero/negativo (zero-trust)', () => {
  const s = fresh()
  const r1 = s.DB.Transactions.add({ description: 'x', amount: 0, type: 'expense', date: '2026-08-01' })
  assert.strictEqual(r1.success, false)
  const r2 = s.DB.Transactions.add({ description: 'x', amount: -150, type: 'expense', date: '2026-08-01' })
  assert.strictEqual(r2.success, false)
  const ok = s.DB.Transactions.add({ description: 'Mercado', amount: 150, type: 'expense', date: '2026-08-01', paid: false })
  assert.strictEqual(ok.paid, false)
})

test('despesa nasce a pagar; receita nasce recebida', () => {
  const s = fresh()
  const e = s.DB.Transactions.add({ description: 'Internet', amount: 100, type: 'expense', date: '2026-08-20' })
  assert.strictEqual(e.paid, false)
  const i = s.DB.Transactions.add({ description: 'Salário', amount: 4500, type: 'income', date: '2026-08-05' })
  assert.strictEqual(i.paid, true)
})

test('updateTransaction preserva paid quando não enviado', () => {
  const s = fresh()
  const t = s.DB.Transactions.add({ description: 'Energia', amount: 180, type: 'expense', date: '2026-08-22' })
  s.DB.Transactions.update(t.id, { description: 'Energia nova' })
  assert.strictEqual(s.DB.Transactions.get(t.id).paid, false)
  s.DB.Transactions.update(t.id, { paid: true })
  assert.strictEqual(s.DB.Transactions.get(t.id).paid, true)
})

test('paid string "true" vinda do form é coagida para booleano (zero-trust)', () => {
  const s = fresh()
  const t = s.DB.Transactions.add({ description: 'Internet', amount: 99.9, type: 'expense', date: '2026-08-19', paid: 'true' })
  assert.strictEqual(t.paid, true)
  assert.strictEqual(t.status, 'paid')
  const t2 = s.DB.Transactions.add({ description: 'Luz', amount: 120, type: 'expense', date: '2026-08-19', paid: 'false' })
  assert.strictEqual(t2.paid, false)
  assert.strictEqual(t2.status, 'pending')
})

test('transferência NÃO cria receita/despesa e movimenta contas', () => {
  const s = fresh()
  const a1 = s.DB.Accounts.add({ name: 'Conta A', type: 'current', balance: 1000 })
  const a2 = s.DB.Accounts.add({ name: 'Conta B', type: 'poupança', balance: 0 })
  const res = s.DB.transfer(a1.id, a2.id, 300, '2026-08-10', 'poupança')
  assert.strictEqual(res.success, undefined)
  assert.strictEqual(s.DB.Accounts.get(a1.id).balance, 700)
  assert.strictEqual(s.DB.Accounts.get(a2.id).balance, 300)
  assert.strictEqual(s.DB.Transactions.list().length, 0)
  assert.strictEqual(s.DB.Transfers.list().length, 1)
})

test('transferência rejeita mesmo destino e valor inválido', () => {
  const s = fresh()
  const a1 = s.DB.Accounts.add({ name: 'A', balance: 10 })
  assert.strictEqual(s.DB.transfer(a1.id, a1.id, 5, '2026-08-10').success, false)
  assert.strictEqual(s.DB.transfer(a1.id, 'nada', 5, '2026-08-10').success, false)
})

test('export/import roundtrip com sanitização', () => {
  const s = fresh()
  s.DB.Events.add({ title: 'Aula', date: '2026-08-25', category: 'Estudos' })
  s.DB.Transactions.add({ description: 'Aluguel', amount: 1500, type: 'expense', date: '2026-08-05', paid: true })
  const data = s.DB.exportAllData()
  assert.strictEqual(data.version, '1.0')
  const s2 = loadApp()
  s2.DB.init()
  const res = s2.DB.importAllData(Object.assign({}, data, { transactions: [null, { bad: true }, ...data.transactions] }))
  assert.strictEqual(res.success, true)
  assert.ok(res.ignored.transactions >= 2)
  assert.strictEqual(s2.DB.Events.list().length, 1)
  assert.ok(s2.DB.Transactions.list().length >= 1)
})

test('clearAllData zera tudo', () => {
  const s = fresh()
  s.DB.Events.add({ title: 'X', date: '2026-08-01' })
  s.DB.clearAllData()
  assert.strictEqual(s.DB.Events.list().length, 0)
})