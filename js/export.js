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

  // ---------- ICS (Google/Outlook/Apple Calendar) ----------
  function escapeICS(s) {
    return String(s === null || s === undefined ? '' : s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,')
  }

  // data local YYYY-MM-DD [+ HH:MM] → ISO 8601 local (sem Z) para DTSTART/DTEND
  function icsDateTime(date, time) {
    const d = String(date).replace(/[-:]/g, '')
    if (time && /^\d{2}:\d{2}$/.test(time)) return d + 'T' + time.replace(':', '') + '00'
    return d
  }

  // DTEND: evento com hora → 1h depois; sem hora → dia seguinte (inclusivo all-day no ICS)
  function icsEndDate(date, time) {
    const base = new Date(date + (time ? 'T' + time : 'T12:00:00'))
    base.setDate(base.getDate() + 1)
    const pad = n => String(n).padStart(2, '0')
    const d = base.getFullYear() + pad(base.getMonth() + 1) + pad(base.getDate())
    return time && /^\d{2}:\d{2}$/.test(time) ? d + 'T' + time.replace(':', '') + '00' : d
  }

  function eventsToICS(events) {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Life Organizer//JARVIS//PT-BR', 'CALSCALE:GREGORIAN']
    ;(events || []).forEach(e => {
      const dtstart = icsDateTime(e.date, e.startTime)
      const dtend = icsEndDate(e.date, e.startTime)
      lines.push('BEGIN:VEVENT')
      lines.push('UID:' + (e.id || 'evt-' + Math.random().toString(36).slice(2)) + '@life-organizer')
      lines.push('DTSTAMP:' + icsDateTime(DB.todayStr(), '') + 'T000000')
      lines.push('DTSTART' + (/T\d{6}$/.test(dtstart) ? '' : ';VALUE=DATE') + ':' + dtstart)
      lines.push('DTEND' + (/T\d{6}$/.test(dtend) ? '' : ';VALUE=DATE') + ':' + dtend)
      lines.push('SUMMARY:' + escapeICS(e.title || ''))
      if (e.description) lines.push('DESCRIPTION:' + escapeICS(e.description))
      if (e.location) lines.push('LOCATION:' + escapeICS(e.location))
      if (e.category) lines.push('CATEGORIES:' + escapeICS(e.category))
      if (e.priority === 'alta') lines.push('PRIORITY:1')
      else if (e.priority === 'baixa') lines.push('PRIORITY:9')
      lines.push('END:VEVENT')
    })
    lines.push('END:VCALENDAR')
    return lines.join('\r\n')
  }

  function exportEventsICS() {
    const events = DB.Events.list().filter(e => e.date >= DB.todayStr())
    download('life-organizer-agenda.ics', eventsToICS(events), 'text/calendar;charset=utf-8')
    return { count: events.length }
  }

  return { toCSV, transactionsToCSV, eventsToCSV, escapeICS, icsDateTime, icsEndDate, eventsToICS, download, exportJSON, exportTransactionsCSV, exportEventsCSV, exportEventsICS }
})()

if (typeof module !== 'undefined' && module.exports) module.exports = { Export }