/* LIFE ORGANIZER — Insights (motor puro de análise, previsão e relatório mensal). Sem DOM/localStorage, testável em Node. */
'use strict'

const Insights = (() => {
  function money(n) { return 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
  function num(v, f = 0) { const n = Number(v); return Number.isFinite(n) ? n : f }

  function groupByMonth(txs) {
    const map = {}
    txs.forEach(t => {
      const m = (t.date || '').slice(0, 7)
      if (!m) return
      if (!map[m]) map[m] = { month: m, incomes: 0, expenses: 0, balance: 0, count: 0 }
      map[m].incomes += t.type === 'income' ? num(t.amount) : 0
      map[m].expenses += t.type === 'expense' ? num(t.amount) : 0
      map[m].balance += t.type === 'income' ? num(t.amount) : -num(t.amount)
      map[m].count++
    })
    return Object.keys(map).sort().map(m => map[m])
  }

  function compareMonths(current, previous) {
    if (!current || !previous) return null
    const pct = previous.expenses > 0 ? ((current.expenses - previous.expenses) / previous.expenses) * 100 : null
    return { pct, increased: (current.expenses - previous.expenses) > 0, diff: current.expenses - previous.expenses }
  }

  // Análise de tendências — mensagens objetivas, sem recomendação de alto risco
  function analyze(txs, opts = {}) {
    const byMonth = groupByMonth(txs)
    const current = byMonth[byMonth.length - 1] || { month: '', incomes: 0, expenses: 0, balance: 0, count: 0 }
    const previous = byMonth[byMonth.length - 2] || null
    const insight = { month: current.month, incomes: current.incomes, expenses: current.expenses, balance: current.balance, messages: [] }

    if (current.count === 0) {
      insight.messages.push({ type: 'info', text: 'Adicione receitas e despesas para receber análises do seu mês.' })
      return insight
    }

    // Comparação com mês anterior
    const cmp = compareMonths(current, previous)
    if (cmp && cmp.pct !== null && Math.abs(cmp.diff) > 0.01) {
      if (cmp.increased) insight.messages.push({ type: 'warning', text: `Seus gastos aumentaram ${Math.abs(cmp.pct).toFixed(0)}% em relação ao mês anterior (${money(cmp.diff)} a mais).` })
      else insight.messages.push({ type: 'success', text: `Seus gastos caíram ${Math.abs(cmp.pct).toFixed(0)}% em relação ao mês anterior (${money(Math.abs(cmp.diff))} a menos).` })
    }

    // Maior categoria
    const catMap = {}
    txs.filter(t => t.type === 'expense' && (t.date || '').slice(0, 7) === current.month).forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + num(t.amount) })
    const top = Object.keys(catMap).sort((a, b) => catMap[b] - catMap[a])[0]
    if (top) {
      const pctOfExpenses = current.expenses > 0 ? (catMap[top] / current.expenses) * 100 : 0
      insight.messages.push({ type: 'info', text: `Sua maior categoria de gastos foi ${top}: ${money(catMap[top])} (${pctOfExpenses.toFixed(0)}% das despesas).` })
      insight.topCategory = { name: top, total: catMap[top] }
    }

    // Taxa de economia
    if (current.incomes > 0) {
      const rate = (current.balance / current.incomes) * 100
      if (rate > 0) insight.messages.push({ type: 'success', text: `Você economizou ${money(current.balance)} (${rate.toFixed(1)}% da sua renda) este mês.` })
      else insight.messages.push({ type: 'danger', text: `Seu saldo do mês ficou negativo (${money(current.balance)}). Despesas superaram receitas em ${money(Math.abs(current.balance))}.` })
    }

    // Gastos fixos estimados (recorrência mensal conhecida: salário/receitas recorrentes vs despesas mensais)
    const fixedExpenses = txs.filter(t => t.type === 'expense' && (t.date || '').slice(0, 7) === current.month && /aluguel|internet|energia|água|gás|condomínio|mensalidade|assinatura/i.test(t.category + ' ' + (t.subcategory || '')))
      .reduce((s, t) => s + num(t.amount), 0)
    if (current.expenses > 0 && fixedExpenses > 0) {
      insight.messages.push({ type: 'info', text: `Seus gastos fixos estimados representam ${((fixedExpenses / current.expenses) * 100).toFixed(0)}% das despesas do mês.` })
    }

    return insight
  }

  // Previsão — saldo futuro estimado a partir de dados reais (receitas/despesas esperadas e pendências)
  function forecast({ start, expectedIncomes = 0, expectedExpenses = 0, unpaid = 0, cardDue = 0, days = 30 } = {}) {
    const projected = num(start) + num(expectedIncomes) - num(expectedExpenses) - num(unpaid) - num(cardDue)
    return {
      days, start: num(start), expectedIncomes: num(expectedIncomes), expectedExpenses: num(expectedExpenses),
      unpaid: num(unpaid), cardDue: num(cardDue), projected,
      healthy: projected >= 0
    }
  }

  // Relatório mensal — indicadores do mês
  function monthlyReport(txs, month) {
    const monthTxs = txs.filter(t => (t.date || '').slice(0, 7) === month)
    const incomes = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + num(t.amount), 0)
    const expenses = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + num(t.amount), 0)
    const balance = incomes - expenses
    const expTxs = monthTxs.filter(t => t.type === 'expense')
    const catMap = {}
    expTxs.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + num(t.amount) })
    const cats = Object.keys(catMap).sort((a, b) => catMap[b] - catMap[a])
    const sorted = expTxs.slice().sort((a, b) => num(b.amount) - num(a.amount))
    const prevMonthTxs = txs.filter(t => {
      const [y, m] = month.split('-').map(Number)
      const d = new Date(y, m - 2, 1)
      return (t.date || '').slice(0, 7) === d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
    })
    const prevExpenses = prevMonthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + num(t.amount), 0)
    return {
      month, incomes, expenses, balance,
      savingsRate: incomes > 0 ? (balance / incomes) * 100 : 0,
      biggestExpense: sorted[0] || null,
      smallestExpense: sorted.length ? sorted[sorted.length - 1] : null,
      topCategory: cats.length ? { name: cats[0], total: catMap[cats[0]] } : null,
      prevExpenses,
      vsPrevPct: prevExpenses > 0 ? ((expenses - prevExpenses) / prevExpenses) * 100 : null,
      expenseCount: expTxs.length
    }
  }

  return { analyze, forecast, monthlyReport, groupByMonth, compareMonths, money }
})()

if (typeof module !== 'undefined' && module.exports) module.exports = { Insights }