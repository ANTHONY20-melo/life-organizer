/* LIFE ORGANIZER — Export/Import (JSON + CSV). Puro, testável. */
'use strict'

const Export = (() => {
  const COLLECTIONS = ['events', 'tasks', 'habits', 'notifications', 'categories', 'accounts', 'transactions', 'recurring', 'cards', 'cardPurchases', 'budgets', 'goals', 'debts', 'assets', 'transfers', 'settings']

  function toCSV(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return ''
    const headers = Object.keys(rows[0])
    const esc = v => {
      const s = v === null || v === undefined ? '' : String(v)
      return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
    }
    const lines = [headers.map(esc).join(';')]
    rows.forEach(r => lines.push(headers.map(h => esc(r[h])).join(';')))
    return lines.join('\r\n')
  }

  function transactionsToCSV(txs) {
    const rows = txs.map(t => ({
      Data: t.date, Tipo: t.type === 'income' ? 'Receita' : 'Despesa', Descricao: t.description,
      Categoria: t.category, Subcategoria: t.subcategory || '', Valor: t.amount.toFixed(2).replace('.', ','),
      Parcela: t.installment ? t.installment.number + '/' + t.installment.total : '', Pago: t.paid ? 'Sim' : 'Nao',
      Observacao: t.observations || ''
    }))
    return toCSV(rows)
  }

  function eventsToCSV(events) {
    const rows = events.map(e => ({
      Data: e.date, HoraInicio: e.startTime || '', HoraFim: e.endTime || '', Titulo: e.title,
      Descricao: e.description || '', Local: e.location || '', Categoria: e.category,
      Prioridade: e.priority, Repeticao: e.recurrence, Observacoes: e.observations || ''
    }))
    return toCSV(rows)
  }

  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 100)
    return true
  }

  function exportJSON() {
    const data = DB.exportAllData()
    download('life-organizer-backup-' + DB.todayStr() + '.json', JSON.stringify(data, null, 2), 'application/json')
    return data
  }

  function exportTransactionsCSV(month) {
    const txs = DB.transactionsByMonth(month)
    const csv = transactionsToCSV(txs)
    download('life-organizer-transacoes-' + month + '.csv', '\uFEFF' + csv, 'text/csv;charset=utf-8')
    return { count: txs.length }
  }

  function exportEventsCSV() {
    const csv = eventsToCSV(DB.Events.list())
    download('life-organizer-agenda.csv', '\uFEFF' + csv, 'text/csv;charset=utf-8')
    return { count: DB.Events.list().length }
  }

  return { toCSV, transactionsToCSV, eventsToCSV, download, exportJSON, exportTransactionsCSV, exportEventsCSV }
})()

if (typeof module !== 'undefined' && module.exports) module.exports = { Export }