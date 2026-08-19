'use strict'
const test = require('node:test')
const assert = require('node:assert')
const { loadApp } = require('./helpers/load-app.js')

function fresh() { const s = loadApp(); s.DB.init(); return s }

test('toCSV: escapa vírgula, ponto-e-vírgula e aspas', () => {
  const s = fresh()
  const csv = s.Export.toCSV([{ nome: 'João, Silva', valor: 'R$ 100;50', obs: 'diz "oi"' }])
  assert.ok(csv.includes('"João, Silva"'))
  assert.ok(csv.includes('"R$ 100;50"'))
  assert.ok(csv.includes('diz ""oi""'))
})

test('transactionsToCSV: colunas esperadas', () => {
  const s = fresh()
  s.DB.Transactions.add({ description: 'Aluguel', amount: 1500, type: 'expense', category: 'Casa', date: '2026-08-05', paid: true })
  const csv = s.Export.transactionsToCSV(s.DB.Transactions.list())
  assert.ok(csv.includes('Data;Tipo;Descricao'))
  assert.ok(csv.includes('2026-08-05'))
  assert.ok(csv.includes('Despesa'))
  assert.ok(csv.includes('1500,00'))
})

test('eventsToCSV: gera linha com recorrência', () => {
  const s = fresh()
  s.DB.Events.add({ title: 'Aula', date: '2026-08-10', startTime: '19:00', category: 'Estudos', recurrence: 'weekly' })
  const csv = s.Export.eventsToCSV(s.DB.Events.list())
  assert.ok(csv.includes('Aula'))
  assert.ok(csv.includes('weekly'))
})

test('exportJSON: inclui app e versão', () => {
  const s = fresh()
  const data = s.DB.exportAllData()
  assert.strictEqual(data.app, 'life-organizer')
  assert.strictEqual(data.version, '1.0')
  assert.ok(Array.isArray(data.transactions))
})