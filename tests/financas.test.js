'use strict'
const test = require('node:test')
const assert = require('node:assert')
const { loadApp } = require('./helpers/load-app.js')

function fresh() { const s = loadApp(); s.DB.init(); return s }

test('parcelas: 3x gera 3 transações com badge e total dividido', () => {
  const s = fresh()
  const res = s.DB.Transactions.add({ description: 'Celular', amount: 3600, type: 'expense', date: '2026-08-15', installments: 3, paid: false })
  assert.strictEqual(res.success, true)
  const txs = s.DB.Transactions.list()
  assert.strictEqual(txs.length, 3)
  assert.ok(txs.every(t => t.installment && t.installment.total === 3))
  assert.strictEqual(txs.reduce((sum, t) => sum + t.amount, 0).toFixed(2), '3600.00')
  assert.strictEqual(txs.map(t => t.installment.number).join(','), '1,2,3')
})

test('parcelas: datas mensais com clamp (31/01 → 28/02)', () => {
  const s = fresh()
  const res = s.DB.Transactions.add({ description: 'Compra', amount: 900, type: 'expense', date: '2026-01-31', installments: 2 })
  const dates = s.DB.Transactions.list().map(t => t.date)
  assert.ok(dates.includes('2026-01-31'))
  assert.ok(dates.includes('2026-02-28'))
})

test('parcelas: rejeita 0, -1, 1.5, 49 e texto (zero-trust)', () => {
  const s = fresh()
  ;[0, -1, 1.5, 49, 'abc'].forEach(n => {
    const r = s.DB.Transactions.add({ description: 'X', amount: 100, type: 'expense', date: '2026-08-01', installments: n })
    assert.strictEqual(r.success, false, 'deveria rejeitar ' + n)
  })
})

test('deleteInstallmentGroup exclui todas as parcelas', () => {
  const s = fresh()
  s.DB.Transactions.add({ description: 'TV', amount: 2400, type: 'expense', date: '2026-08-01', installments: 4 })
  const group = s.DB.Transactions.list()[0].installment.groupId
  assert.strictEqual(s.DB.Transactions.list().length, 4)
  s.DB.Transactions.removeInstallmentGroup(group)
  assert.strictEqual(s.DB.Transactions.list().length, 0)
})

test('recorrente mensal: nextRecurringDate respeita o dia', () => {
  const s = fresh()
  const r = { id: 'r1', description: 'Internet', amount: 100, type: 'expense', category: 'Casa', day: 20, frequency: 'monthly', startDate: '2026-08-01', active: true }
  assert.strictEqual(s.DB.nextRecurringDate(r, '2026-08-15'), '2026-08-20')
  assert.strictEqual(s.DB.nextRecurringDate(r, '2026-08-21'), '2026-09-20')
})

test('recorrente semanal: próxima na semana certa', () => {
  const s = fresh()
  // 2026-08-10 = segunda
  const r = { id: 'r2', description: 'Aula', amount: 50, type: 'expense', day: 0, frequency: 'weekly', startDate: '2026-08-10', active: true } // domingo
  assert.strictEqual(s.DB.nextRecurringDate(r, '2026-08-10'), '2026-08-16')
})

test('generateRecurring deduplica mesmo mês', () => {
  const s = fresh()
  const r = s.DB.Recurring.add({ description: 'Internet', amount: 100, type: 'expense', category: 'Casa', day: 20, frequency: 'monthly', startDate: '2026-08-01' })
  const d = s.DB.nextRecurringDate(r, s.DB.todayStr())
  const a = s.DB.generateRecurring(r, d)
  assert.strictEqual(a.success, undefined)
  const b = s.DB.generateRecurring(r, d)
  assert.strictEqual(b.success, false)
})

test('upcomingRecurring lista próximos 90 dias sem duplicar gerados', () => {
  const s = fresh()
  s.DB.Recurring.add({ description: 'Internet', amount: 100, type: 'expense', category: 'Casa', day: 20, frequency: 'monthly', startDate: '2026-08-01' })
  const up = s.DB.upcomingRecurring('2026-08-01', 90)
  assert.ok(up.length >= 3)
  const dates = up.map(u => u.nextDate)
  assert.strictEqual(new Set(dates).size, dates.length)
})

test('unpaidExpenses ordena por vencimento e calcula daysOverdue', () => {
  const s = fresh()
  s.DB.Transactions.add({ description: 'Antiga', amount: 50, type: 'expense', date: '2026-08-01', paid: false })
  s.DB.Transactions.add({ description: 'Paga', amount: 80, type: 'expense', date: '2026-08-01', paid: true })
  s.DB.Transactions.add({ description: 'Futura', amount: 30, type: 'expense', date: '2026-08-30', paid: false })
  const up = s.DB.unpaidExpenses('2026-08-20')
  assert.strictEqual(up.length, 2)
  assert.strictEqual(up[0].description, 'Antiga')
  assert.ok(up[0].daysOverdue > 0)
  assert.ok(up[1].daysOverdue < 0)
})

test('pendingSummary agrega total, count e atrasadas', () => {
  const s = fresh()
  s.DB.Transactions.add({ description: 'Atrasada', amount: 100, type: 'expense', date: '2026-08-01', paid: false })
  s.DB.Transactions.add({ description: 'Futura', amount: 200, type: 'expense', date: '2026-08-30', paid: false })
  const p = s.DB.pendingSummary()
  assert.strictEqual(p.count, 2)
  assert.strictEqual(p.total, 300)
  assert.strictEqual(p.overdueCount, 1)
  assert.strictEqual(p.overdueTotal, 100)
})

test('monthlySummary calcula receitas/despesas/balanço', () => {
  const s = fresh()
  s.DB.Transactions.add({ description: 'Salário', amount: 4500, type: 'income', date: '2026-08-05' })
  s.DB.Transactions.add({ description: 'Aluguel', amount: 1500, type: 'expense', date: '2026-08-05', paid: true })
  s.DB.Transactions.add({ description: 'Mercado', amount: 500, type: 'expense', date: '2026-08-06', paid: true })
  const m = s.DB.monthlySummary('2026-08')
  assert.strictEqual(m.incomes, 4500)
  assert.strictEqual(m.expenses, 2000)
  assert.strictEqual(m.balance, 2500)
})

test('budgetProgress: percentual real sem cap', () => {
  const s = fresh()
  s.DB.Budgets.add({ category: 'Alimentação', month: '2026-08', limit: 800 })
  s.DB.Transactions.add({ description: 'iFood', amount: 900, type: 'expense', category: 'Alimentação', date: '2026-08-10', paid: true })
  const b = s.DB.budgetProgress('2026-08')[0]
  assert.strictEqual(b.level, 'danger')
  assert.strictEqual(Math.round(b.pct), 113)
})

test('budgetAlerts: gera alerta warning >= 80%', () => {
  const s = fresh()
  s.DB.Budgets.add({ category: 'Transporte', month: '2026-08', limit: 400 })
  s.DB.Transactions.add({ description: 'Uber', amount: 340, type: 'expense', category: 'Transporte', date: '2026-08-10', paid: true })
  const alerts = s.DB.budgetAlerts('2026-08')
  assert.strictEqual(alerts.length, 1)
  assert.strictEqual(alerts[0].level, 'warning')
})

test('cardUtilization calcula usado/disponível/percentual', () => {
  const s = fresh()
  const c = s.DB.Cards.add({ name: 'Principal', bank: 'Nubank', limit: 3000, closingDay: 10, dueDay: 17 })
  s.DB.CardPurchases.add({ description: 'Compra', amount: 1240, category: 'Outros', cardId: c.id, date: '2026-08-01' })
  const u = s.DB.cardUtilization(c.id)
  assert.strictEqual(u.used, 1240)
  assert.strictEqual(u.available, 1760)
  assert.ok(Math.abs(u.pct - 41.33) < 0.1)
})

test('goalProgress: percentual e restante', () => {
  const s = fresh()
  const g = s.DB.Goals.add({ name: 'Notebook', targetAmount: 5000, currentAmount: 2300 })
  const p = s.DB.goalProgress(g)
  assert.strictEqual(Math.round(p.pct), 46)
  assert.strictEqual(p.remaining, 2700)
  assert.strictEqual(p.isComplete, false)
})

test('netWorth: ativos + caixa − dívidas', () => {
  const s = fresh()
  s.DB.Assets.add({ name: 'Carro', type: 'Bem', value: 35000 })
  s.DB.Debts.add({ creditor: 'Banco', originalAmount: 800, currentAmount: 650, status: 'open' })
  const nw = s.DB.netWorth()
  assert.strictEqual(nw.assets, 35000)
  assert.strictEqual(nw.debts, 650)
  assert.strictEqual(nw.total, 34350 + s.DB.totalBalance())
})

test('forecast: projeta saldo futuro com entradas', () => {
  const s = fresh()
  const f = s.DB.forecast(30)
  assert.ok(typeof f.days === 'number')
  assert.ok(typeof f.projected === 'number')
  assert.strictEqual(f.projected, f.start + f.expectedIncomes - f.expectedExpenses - f.unpaid - f.cardDue)
})

test('monthlySeries retorna N meses', () => {
  const s = fresh()
  const series = s.DB.monthlySeries(6)
  assert.strictEqual(series.length, 6)
  assert.ok(series.every(x => /^\d{4}-\d{2}$/.test(x.month)))
})