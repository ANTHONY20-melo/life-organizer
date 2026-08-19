/* LIFE ORGANIZER — Notifications (planejamento puro + ponte com o Service Worker). */
'use strict'

const Notifications = (() => {
  // ---------- planejamento puro (testável em Node) ----------
  // Gera lembretes de compromissos: evento com notifyBefore minutos antes; horário no dia.
  // Planejamento PURO — não filtra por Date.now() (timestamp passado é tratado pelo SW com fallback now+5s).
  function planEventReminders(events, refDate, opts = {}) {
    const ref = refDate || DB.todayStr()
    const daysAhead = opts.daysAhead || 3
    const out = []
    events.forEach(ev => {
      if (ev.date < ref || ev.date > DB.addDays(ref, daysAhead)) return
      const [h, m] = (ev.startTime || '').split(':').map(Number)
      if (!Number.isFinite(h) || !Number.isFinite(m)) return
      const fire = new Date(ev.date + 'T00:00:00')
      fire.setHours(h, m, 0, 0)
      const before = Number.isFinite(ev.notifyBefore) ? ev.notifyBefore : 30
      const at = fire.getTime() - before * 60000
      out.push({
        id: 'evt-' + ev.id + '-' + ev.date,
        tag: 'lo-reminder-' + ev.id + '-' + ev.date,
        title: '⏰ ' + (before >= 1440 ? `${Math.round(before / 1440)} dia(s) antes` : `Daqui a ${before} minutos`),
        body: ev.title + (ev.location ? ' em ' + ev.location : ''),
        timestamp: at,
        important: true
      })
    })
    return out.sort((a, b) => a.timestamp - b.timestamp)
  }

  // Lembretes de contas a pagar: configuração de dias antes (5/3/2/1/personalizado)
  function planBillReminders(unpaidTxs, refDate, daysBefore, opts = {}) {
    const ref = refDate || DB.todayStr()
    const days = Array.isArray(daysBefore) ? daysBefore.filter(n => Number.isInteger(n) && n >= 0) : (Number.isInteger(daysBefore) && daysBefore >= 0 ? [daysBefore] : [])
    if (days.length === 0) return []
    const out = []
    unpaidTxs.forEach(t => {
      if (t.date < ref) return
      const daysUntil = Math.round((DB.dateFromStr(t.date) - DB.dateFromStr(ref)) / 86400000)
      const fire = new Date(t.date + 'T09:00:00')
      // vencimento hoje (daysUntil 0) sempre gera o lembrete crítico; senão, usa os dias configurados
      const ds = daysUntil === 0 ? [0] : days.filter(d => d > 0 && daysUntil === d)
      ds.forEach(d => {
        const at = fire.getTime() - d * 86400000
        out.push({
          id: 'bill-' + t.id + '-' + d,
          tag: 'lo-bill-' + t.id + '-' + d,
          title: d === 0 ? '🚨 Sua conta vence hoje' : d === 1 ? '⚠️ Sua conta vence amanhã' : `💰 Sua conta vence em ${d} dias`,
          body: t.description + ' — ' + DB.money(t.amount) + (d === 0 ? ' (vence hoje)' : d === 1 ? ' (amanhã)' : ''),
          timestamp: at,
          important: d <= 1
        })
      })
    })
    return out.sort((a, b) => a.timestamp - b.timestamp)
  }

  // Resumo matinal: quantas atividades o usuário tem hoje
  function morningSummary(events, tasks, unpaidTxs, refDate) {
    const date = refDate || DB.todayStr()
    const evCount = events.filter(e => e.date === date).length
    const taskCount = tasks.filter(t => t.date === date && !['done', 'cancelled'].includes(t.status)).length
    const billCount = unpaidTxs.filter(t => t.date === date).length
    const total = evCount + taskCount + billCount
    if (total === 0) return []
    return [{
      id: 'morning-' + date,
      tag: 'lo-morning-' + date,
      title: '☀️ Bom dia!',
      body: `Você possui ${total} atividade(s) hoje` + (evCount ? ` (${evCount} compromisso(s))` : '') + (taskCount ? `, ${taskCount} tarefa(s)` : '') + (billCount ? `, ${billCount} conta(s) vencendo` : '') + '.',
      timestamp: new Date(date + 'T08:00:00').getTime(),
      important: false
    }]
  }

  function planAll(events, tasks, unpaidTxs, settings, refDate) {
    const prefs = (settings && settings.notificationPrefs) || {}
    if (prefs.enabled === false) return []
    const daysBefore = (prefs.daysBefore && prefs.daysBefore.length ? prefs.daysBefore : [5, 3, 2, 1]).concat(prefs.customDays && prefs.customDays > 0 ? [prefs.customDays] : [])
    return []
      .concat(planEventReminders(events, refDate))
      .concat(planBillReminders(unpaidTxs, refDate, daysBefore))
      .concat(morningSummary(events, tasks, unpaidTxs, refDate))
  }

  return { planEventReminders, planBillReminders, morningSummary, planAll }
})()

if (typeof module !== 'undefined' && module.exports) module.exports = { Notifications }