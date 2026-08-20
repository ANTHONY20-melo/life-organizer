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

test('escapeICS: escapa barra, quebra de linha, ; e vírgula', () => {
  const s = fresh()
  assert.strictEqual(s.Export.escapeICS('Reunião, sala 2; urgente'), 'Reunião\\, sala 2\\; urgente')
  assert.strictEqual(s.Export.escapeICS('linha1\nlinha2'), 'linha1\\nlinha2')
  assert.strictEqual(s.Export.escapeICS('C:\\pasta'), 'C:\\\\pasta')
  assert.strictEqual(s.Export.escapeICS(null), '')
})

test('icsDateTime: com hora → local; sem hora → data pura', () => {
  const s = fresh()
  assert.strictEqual(s.Export.icsDateTime('2026-08-20', '09:30'), '20260820T093000')
  assert.strictEqual(s.Export.icsDateTime('2026-08-20', ''), '20260820')
  assert.strictEqual(s.Export.icsDateTime('2026-08-20', '9:30'), '20260820') // hora inválida → all-day
})

test('icsEndDate: evento com hora termina 1h depois; all-day termina no dia seguinte', () => {
  const s = fresh()
  assert.strictEqual(s.Export.icsEndDate('2026-08-20', '09:00'), '20260821T090000')
  assert.strictEqual(s.Export.icsEndDate('2026-08-20', ''), '20260821')
  assert.strictEqual(s.Export.icsEndDate('2026-08-31', '23:00'), '20260901T230000')
})

test('eventsToICS: gera VCALENDAR com VEVENT e campos', () => {
  const s = fresh()
  s.DB.Events.add({ id: 'evt-1', title: 'Reunião, importante', date: '2026-08-20', startTime: '09:30', category: 'Trabalho', description: 'Falar do projeto', location: 'Sala 2', priority: 'alta' })
  const ics = s.Export.eventsToICS(s.DB.Events.list())
  assert.ok(ics.startsWith('BEGIN:VCALENDAR'))
  assert.ok(ics.endsWith('END:VCALENDAR'))
  assert.ok(ics.includes('BEGIN:VEVENT'))
  assert.ok(ics.includes('UID:evt-1@life-organizer'))
  assert.ok(ics.includes('DTSTART:20260820T093000'))
  assert.ok(ics.includes('DTEND:20260821T093000'))
  assert.ok(ics.includes('SUMMARY:Reunião\\, importante'))
  assert.ok(ics.includes('DESCRIPTION:Falar do projeto'))
  assert.ok(ics.includes('LOCATION:Sala 2'))
  assert.ok(ics.includes('CATEGORIES:Trabalho'))
  assert.ok(ics.includes('PRIORITY:1'))
})

test('eventsToICS: evento all-day usa VALUE=DATE', () => {
  const s = fresh()
  s.DB.Events.add({ id: 'evt-2', title: 'Aniversário', date: '2026-08-25', category: 'Pessoal' })
  const ics = s.Export.eventsToICS(s.DB.Events.list())
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20260825'))
  assert.ok(ics.includes('DTEND;VALUE=DATE:20260826'))
})