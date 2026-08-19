'use strict'
const test = require('node:test')
const assert = require('node:assert')
const { loadApp } = require('./helpers/load-app.js')

function fresh() { const s = loadApp(); s.DB.init(); return s }

test('habitStreak conta dias consecutivos terminando hoje', () => {
  const s = fresh()
  const h = { entries: ['2026-08-17', '2026-08-18', '2026-08-19'] }
  assert.strictEqual(s.DB.habitStreak(h), 3)
})

test('habitStreak: se hoje não feito, conta a partir de ontem', () => {
  const s = fresh()
  // 16, 17, 18 são 3 dias consecutivos; hoje (19) não feito → streak = 3 (18,17,16)
  const h = { entries: ['2026-08-16', '2026-08-17', '2026-08-18'] }
  assert.strictEqual(s.DB.habitStreak(h), 3)
})

test('habitToggle adiciona e remove data', () => {
  const s = fresh()
  const h = s.DB.Habits.add({ name: 'Ler', entries: [] })
  s.DB.habitToggle(h, '2026-08-18')
  assert.ok(s.DB.Habits.get(h.id).entries.includes('2026-08-18'))
  s.DB.habitToggle(h, '2026-08-18')
  assert.ok(!s.DB.Habits.get(h.id).entries.includes('2026-08-18'))
})

test('habitCompletionsThisWeek conta de segunda a domingo', () => {
  const s = fresh()
  const h = s.DB.Habits.add({ name: 'Meditar', entries: ['2026-08-16', '2026-08-18'] })
  // 2026-08-17 = segunda
  const c = s.DB.habitCompletionsThisWeek(h, '2026-08-17')
  assert.strictEqual(c, 1) // só 18 (segunda 17 não está; 16 era domingo da semana anterior)
})

test('habito com targetPerWeek valida faixa', () => {
  const s = fresh()
  const h = s.DB.Habits.add({ name: 'Agua', targetPerWeek: 99 })
  assert.strictEqual(h.targetPerWeek, 7)
})