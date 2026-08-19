'use strict'
const test = require('node:test')
const assert = require('node:assert')
const { loadApp } = require('./helpers/load-app.js')

function fresh() { const s = loadApp(); s.DB.init(); return s }

test('recorrência diária expande no intervalo', () => {
  const s = fresh()
  s.DB.Events.add({ title: 'Café', date: '2026-08-10', startTime: '07:00', recurrence: 'daily' })
  const out = s.DB.expandRecurrenceAll('2026-08-10', '2026-08-12')
  assert.strictEqual(out.length, 3)
  assert.ok(out.every(e => e.date >= '2026-08-10' && e.date <= '2026-08-12'))
})

test('recorrência semanal mantém dia da semana', () => {
  const s = fresh()
  // 2026-08-10 é segunda
  s.DB.Events.add({ title: 'Aula', date: '2026-08-10', startTime: '19:00', recurrence: 'weekly' })
  const out = s.DB.expandRecurrenceAll('2026-08-10', '2026-08-30')
  const dates = out.map(e => e.date)
  // lição P4: arrays da VM não são deepStrictEqual-comparáveis; usar join
  assert.strictEqual(dates.join(','), '2026-08-10,2026-08-17,2026-08-24')
})

test('recorrência mensal com clamp de dia 31', () => {
  const s = fresh()
  s.DB.Events.add({ title: 'Pagamento', date: '2026-01-31', recurrence: 'monthly' })
  const out = s.DB.expandRecurrenceAll('2026-01-31', '2026-04-30')
  const dates = out.map(e => e.date)
  assert.ok(dates.includes('2026-02-28') || dates.includes('2026-02-29'))
  assert.ok(dates.includes('2026-03-31'))
  assert.ok(dates.includes('2026-04-30'))
})

test('recorrência dias específicos (seg, qua, sex)', () => {
  const s = fresh()
  s.DB.Events.add({ title: 'Estudar programação', date: '2026-08-10', startTime: '19:00', recurrence: 'specific', daysOfWeek: [1, 3, 5] })
  const out = s.DB.expandRecurrenceAll('2026-08-10', '2026-08-16')
  const wds = out.map(e => s.DB.weekday(e.date))
  assert.strictEqual(out.length, 3)
  assert.ok(wds.every(w => [1, 3, 5].includes(w)))
})

test('evento sem recorrência aparece uma única vez', () => {
  const s = fresh()
  s.DB.Events.add({ title: 'Consulta', date: '2026-08-20', recurrence: 'none' })
  assert.strictEqual(s.DB.expandRecurrenceAll('2026-08-01', '2026-08-31').length, 1)
  assert.strictEqual(s.DB.expandRecurrenceAll('2026-08-21', '2026-08-31').length, 0)
})

test('eventsByDate ordena por horário', () => {
  const s = fresh()
  s.DB.Events.add({ title: 'Tarde', date: '2026-08-20', startTime: '14:00' })
  s.DB.Events.add({ title: 'Manhã', date: '2026-08-20', startTime: '08:00' })
  const evs = s.DB.eventsByDate('2026-08-20')
  assert.strictEqual(evs[0].title, 'Manhã')
  assert.strictEqual(evs[1].title, 'Tarde')
})

test('monthGrid começa na segunda e cobre o mês', () => {
  const s = fresh()
  const cells = s.DB.monthGrid('2026-08')
  assert.strictEqual(cells.filter(Boolean).length, 31)
  assert.strictEqual(cells.length % 7, 0)
})

test('tarefas: isOverdue detecta data passada e não conta concluída', () => {
  const s = fresh()
  const past = s.DB.Tasks.add({ title: 'Antiga', date: '2020-01-01', status: 'pending' })
  const done = s.DB.Tasks.add({ title: 'Feita', date: '2020-01-01', status: 'done' })
  assert.strictEqual(s.DB.isOverdue(past), true)
  assert.strictEqual(s.DB.isOverdue(done), false)
})

test('taskStats soma corretamente', () => {
  const s = fresh()
  s.DB.Tasks.add({ title: 'A', date: '2026-08-20', status: 'done' })
  s.DB.Tasks.add({ title: 'B', date: '2026-08-20', status: 'pending' })
  s.DB.Tasks.add({ title: 'C', date: '2026-08-21', status: 'in_progress' })
  const st = s.DB.taskStats()
  assert.strictEqual(st.total, 3)
  assert.strictEqual(st.done, 1)
  assert.strictEqual(st.pending, 2)
})

test('normalizeTaskOverdue marca tarefas passadas como overdue', () => {
  const s = fresh()
  s.DB.Tasks.add({ title: 'Velha', date: '2020-01-01', status: 'pending' })
  s.DB.Tasks.add({ title: 'Hoje', date: s.DB.todayStr(), status: 'pending', time: '23:59' })
  s.DB.normalizeTaskOverdue()
  const velha = s.DB.Tasks.list().find(t => t.title === 'Velha')
  assert.strictEqual(velha.status, 'overdue')
})