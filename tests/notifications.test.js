'use strict'
const test = require('node:test')
const assert = require('node:assert')
const { loadApp } = require('./helpers/load-app.js')

function fresh() { const s = loadApp(); s.DB.init(); return s }

test('planEventReminders: gera lembrete minutos antes', () => {
  const s = fresh()
  const ev = { id: 'e1', title: 'Reunião', date: '2026-08-25', startTime: '10:00', notifyBefore: 30 }
  const out = s.NotificationPlanner.planEventReminders([ev], '2026-08-20', { daysAhead: 10 })
  assert.strictEqual(out.length, 1)
  assert.ok(out[0].body.includes('Reunião'))
  // 09:30 de 25/08
  const expected = new Date('2026-08-25T09:30:00').getTime()
  assert.strictEqual(out[0].timestamp, expected)
})

test('planEventReminders: ignora evento sem horário ou fora do horizonte', () => {
  const s = fresh()
  const out = s.NotificationPlanner.planEventReminders([
    { id: 'e1', title: 'Sem hora', date: '2026-08-25', startTime: '', notifyBefore: 30 },
    { id: 'e2', title: 'Longe', date: '2026-09-10', startTime: '10:00', notifyBefore: 30 }
  ], '2026-08-20', { daysAhead: 3 })
  assert.strictEqual(out.length, 0)
})

test('planBillReminders: 5 dias antes, 1 dia antes e no dia', () => {
  const s = fresh()
  const bill = { id: 't1', description: 'Internet', amount: 100, date: '2026-08-20' }
  const out = s.NotificationPlanner.planBillReminders([bill], '2026-08-15', [5, 3, 2, 1])
  // 5 dias antes: 15/08 09:00 (2026-08-20 - 5 dias)
  assert.strictEqual(out.length, 1)
  assert.strictEqual(out[0].timestamp, new Date('2026-08-15T09:00:00').getTime())
  const out2 = s.NotificationPlanner.planBillReminders([bill], '2026-08-19', [5, 3, 2, 1])
  assert.strictEqual(out2.length, 1)
  assert.ok(out2[0].title.includes('amanhã'))
})

test('planBillReminders: título do dia do vencimento é crítico', () => {
  const s = fresh()
  const bill = { id: 't1', description: 'Energia', amount: 180, date: '2026-08-20' }
  const out = s.NotificationPlanner.planBillReminders([bill], '2026-08-20', [5, 3, 2, 1])
  assert.strictEqual(out.length, 1)
  assert.ok(out[0].title.includes('hoje'))
  assert.strictEqual(out[0].important, true)
})

test('morningSummary: conta atividades do dia', () => {
  const s = fresh()
  const out = s.NotificationPlanner.morningSummary(
    [{ id: 'e1', title: 'A', date: '2026-08-20' }],
    [{ id: 't1', title: 'B', date: '2026-08-20', status: 'pending' }, { id: 't2', title: 'C', date: '2026-08-20', status: 'done' }],
    [{ id: 'b1', description: 'Conta', amount: 50, date: '2026-08-20' }],
    '2026-08-20'
  )
  assert.strictEqual(out.length, 1)
  assert.ok(out[0].body.includes('3 atividade(s)'))
})

test('planAll: respeita prefs desabilitadas', () => {
  const s = fresh()
  const settings = { notificationPrefs: { enabled: false } }
  const out = s.NotificationPlanner.planAll([], [], [], settings, '2026-08-20')
  assert.strictEqual(out.length, 0)
})

test('planAll: usa daysBefore da config', () => {
  const s = fresh()
  const bill = { id: 't1', description: 'Aluguel', amount: 1500, date: '2026-08-20' }
  const settings = { notificationPrefs: { enabled: true, daysBefore: [2], customDays: 0 } }
  const out = s.NotificationPlanner.planAll([], [], [bill], settings, '2026-08-18')
  assert.strictEqual(out.length, 1)
  assert.ok(out[0].title.includes('em 2 dias'))
})