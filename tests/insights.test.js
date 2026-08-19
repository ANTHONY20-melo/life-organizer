'use strict'
const test = require('node:test')
const assert = require('node:assert')
const { loadApp } = require('./helpers/load-app.js')

function fresh() { const s = loadApp(); s.DB.init(); return s }

test('analyze: mês vazio retorna info sem números', () => {
  const s = fresh()
  const ins = s.Insights.analyze([])
  assert.strictEqual(ins.messages.length, 1)
  assert.strictEqual(ins.messages[0].type, 'info')
})

test('analyze: mês com dados gera comparação e taxa de economia', () => {
  const s = fresh()
  const txs = [
    { description: 'Salário', amount: 4500, type: 'income', date: '2026-08-05' },
    { description: 'Aluguel', amount: 1500, type: 'expense', category: 'Casa', date: '2026-08-05' },
    { description: 'Mercado', amount: 500, type: 'expense', category: 'Alimentação', date: '2026-08-10' }
  ]
  const ins = s.Insights.analyze(txs)
  assert.strictEqual(ins.month, '2026-08')
  assert.strictEqual(ins.incomes, 4500)
  assert.strictEqual(ins.expenses, 2000)
  assert.ok(ins.messages.some(m => /economizou/.test(m.text)))
  assert.strictEqual(ins.topCategory.name, 'Casa')
})

test('analyze: aumento de gastos vs mês anterior gera warning', () => {
  const s = fresh()
  const txs = [
    { description: 'A', amount: 1000, type: 'income', date: '2026-07-05' },
    { description: 'Gasto', amount: 400, type: 'expense', date: '2026-07-10' },
    { description: 'B', amount: 1000, type: 'income', date: '2026-08-05' },
    { description: 'Gasto', amount: 800, type: 'expense', date: '2026-08-10' }
  ]
  const ins = s.Insights.analyze(txs)
  assert.ok(ins.messages.some(m => m.type === 'warning' && /aumentaram 100%/.test(m.text)))
})

test('monthlyReport: indicadores completos do mês', () => {
  const s = fresh()
  const txs = [
    { description: 'Salário', amount: 4500, type: 'income', date: '2026-08-05' },
    { description: 'Aluguel', amount: 1500, type: 'expense', category: 'Casa', date: '2026-08-05' },
    { description: 'iFood', amount: 100, type: 'expense', category: 'Alimentação', date: '2026-08-06' }
  ]
  const r = s.Insights.monthlyReport(txs, '2026-08')
  assert.strictEqual(r.incomes, 4500)
  assert.strictEqual(r.expenses, 1600)
  assert.strictEqual(r.balance, 2900)
  assert.ok(Math.abs(r.savingsRate - 64.4) < 0.1)
  assert.strictEqual(r.biggestExpense.description, 'Aluguel')
  assert.strictEqual(r.smallestExpense.description, 'iFood')
  assert.strictEqual(r.topCategory.name, 'Casa')
})

test('forecast: saudável quando projeção >= 0', () => {
  const s = fresh()
  const f = s.Insights.forecast({ start: 1000, expectedIncomes: 500, expectedExpenses: 200, unpaid: 100, cardDue: 50, days: 30 })
  assert.strictEqual(f.projected, 1150)
  assert.strictEqual(f.healthy, true)
})

test('compareMonths calcula variação percentual', () => {
  const s = fresh()
  const cmp = s.Insights.compareMonths({ expenses: 2000 }, { expenses: 1000 })
  assert.strictEqual(cmp.pct, 100)
  assert.strictEqual(cmp.increased, true)
  const cmp2 = s.Insights.compareMonths({ expenses: 500 }, { expenses: 1000 })
  assert.strictEqual(cmp2.pct, -50)
  assert.strictEqual(cmp2.increased, false)
})

test('groupByMonth agrupa e soma corretamente', () => {
  const s = fresh()
  const g = s.Insights.groupByMonth([
    { description: 'A', amount: 100, type: 'income', date: '2026-07-01' },
    { description: 'B', amount: 50, type: 'expense', date: '2026-07-02' },
    { description: 'C', amount: 200, type: 'income', date: '2026-08-01' }
  ])
  assert.strictEqual(g.length, 2)
  assert.strictEqual(g[0].month, '2026-07')
  assert.strictEqual(g[0].incomes, 100)
  assert.strictEqual(g[0].expenses, 50)
  assert.strictEqual(g[0].balance, 50)
})