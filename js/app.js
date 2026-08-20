/* LIFE ORGANIZER — App (UI + estado + navegação). Único módulo que toca o DOM. */
'use strict'

const App = (() => {
  const $ = sel => document.querySelector(sel)
  const $$ = sel => Array.from(document.querySelectorAll(sel))
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const priorityBadge = p => p === 'alta' ? '<span class="badge b-red">🔴 Alta</span>' : p === 'baixa' ? '<span class="badge b-green">🟢 Baixa</span>' : '<span class="badge b-yellow">🟡 Média</span>'
  const catIcon = c => { const found = DB.Categories.list().find(x => x.name === c); return found && found.icon ? found.icon : '🏷️' }

  let currentPage = 'meu-dia'
  let agendaView = 'dia'
  let agendaCursor = DB.todayStr()
  let finTab = 'dashboard'
  let finMonth = DB.monthStr()
  let confirmResolver = null

  // ---------- toast ----------
  function toast(msg, type = 'info') {
    const el = document.createElement('div')
    el.className = 'toast toast-' + type
    el.innerHTML = esc(msg)
    $('#toast-container').appendChild(el)
    setTimeout(() => el.classList.add('show'), 10)
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300) }, 3500)
  }

  // ---------- modal ----------
  function openModal(html, opts = {}) {
    $('#modal-content').innerHTML = html
    $('#modal').classList.add('open')
    if (opts.title) $('#modal-title').textContent = opts.title
    if (opts.wide) $('#modal').classList.add('wide')
  }
  function closeModal() {
    $('#modal').classList.remove('open', 'wide')
    $('#modal-content').innerHTML = ''
  }
  function confirmModal(message, title = 'Confirmar') {
    return new Promise(resolve => {
      confirmResolver = resolve
      openModal(`
        <h3>${esc(title)}</h3>
        <p class="muted" style="margin:12px 0">${esc(message)}</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-confirm="false">Cancelar</button>
          <button class="btn btn-danger" data-confirm="true">Confirmar</button>
        </div>`)
    })
  }
  function bindModalEvents() {
    document.addEventListener('click', e => {
      if (e.target.closest('#modal-close') || (e.target.id === 'modal-overlay' && e.target === e.currentTarget)) closeModal()
      const c = e.target.closest('[data-confirm]')
      if (c && confirmResolver) { const r = c.dataset.confirm === 'true'; closeModal(); const fn = confirmResolver; confirmResolver = null; fn(r) }
    })
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal() })
  }

  // ---------- navegação ----------
  function navigate(page) {
    currentPage = page
    $$('.page').forEach(p => p.classList.remove('active'))
    const target = $('#page-' + page)
    if (target) target.classList.add('active')
    $$('[data-page]').forEach(a => a.classList.toggle('active-link', a.dataset.page === page))
    renderCurrent()
    window.scrollTo(0, 0)
    renderNotifBadge()
  }
  function renderCurrent() {
    const fn = { 'meu-dia': renderMeuDia, 'agenda': renderAgenda, 'tarefas': renderTarefas, 'habitos': renderHabitos, 'financas': renderFinancas, 'notificacoes': renderNotificacoes, 'perfil': renderPerfil, 'config': renderConfig, 'busca': renderBusca }[currentPage]
    if (fn) fn()
  }

  // ---------- PÁGINA: MEU DIA ----------
  function greeting() {
    const h = new Date().getHours()
    const name = (DB.getSettings().name || 'Anthony').split(' ')[0]
    return h < 12 ? '☀️ Bom dia, ' : h < 18 ? '🌤️ Boa tarde, ' : '🌙 Boa noite, '
  }
  function renderMeuDia() {
    const today = DB.todayStr()
    const tomorrow = DB.addDays(today, 1)
    const events = DB.eventsByDate(today)
    const eventsTomorrow = DB.eventsByDate(tomorrow)
    const tasks = DB.tasksByDate(today)
    const habits = DB.Habits.list()
    const habitsToday = habits.filter(h => h.entries.includes(today)).length
    const pending = DB.pendingSummary()
    const upcomingBills = DB.upcomingPayments(14)
    const txsToday = DB.transactionsByRange(today, today)
    const expToday = txsToday.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const incToday = txsToday.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const nextBill = upcomingBills[0]
    const balance = DB.totalBalance()
    const goals = DB.Goals.list().map(DB.goalProgress).sort((a, b) => b.pct - a.pct)
    const alerts = DB.budgetAlerts()

    let html = `<div class="hero-card">
      <h1>${greeting()}<span class="accent">${esc(DB.getSettings().name || 'Anthony')}</span> 👋</h1>
      <p class="muted">${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <div class="stat-grid">
        <div class="stat"><div class="stat-icon">📅</div><div><strong>${events.length}</strong><span>compromissos hoje</span></div></div>
        <div class="stat"><div class="stat-icon">✅</div><div><strong>${tasks.filter(t => !['done', 'cancelled'].includes(t.status)).length}</strong><span>tarefas hoje</span></div></div>
        <div class="stat"><div class="stat-icon">💰</div><div><strong>${pending.count}</strong><span>contas a pagar</span></div></div>
        <div class="stat"><div class="stat-icon">🔄</div><div><strong>${habitsToday}/${habits.length}</strong><span>hábitos hoje</span></div></div>
      </div>
    </div>`

    if (alerts.length) {
      html += `<div class="alerts-box">` + alerts.slice(0, 2).map(a => `<div class="alert alert-${a.level === 'danger' ? 'danger' : 'warning'}">${esc(a.message)}</div>`).join('') + `</div>`
    }
    if (pending.overdueCount > 0) {
      html += `<div class="alert alert-danger">🚨 Você tem ${pending.overdueCount} conta(s) atrasada(s) — ${DB.money(pending.overdueTotal)}. <button class="btn-link" data-page="financas">Ver contas →</button></div>`
    }

    html += `<div class="day-grid">
      <section class="card">
        <h2>🕐 Linha do tempo de hoje</h2>
        ${renderTimeline(events, tasks)}
        <h3 style="margin-top:18px">📅 Amanhã</h3>
        ${eventsTomorrow.length ? eventsTomorrow.map(ev => `<div class="tl-item"><span class="tl-time">${esc(ev.startTime || '--:--')}</span><div><strong>${catIcon(ev.category)} ${esc(ev.title)}</strong><span class="muted"> · ${esc(ev.category)}</span></div></div>`).join('') : '<p class="muted small">Nenhum compromisso amanhã.</p>'}
      </section>
      <section class="card">
        <h2>💰 Financeiro hoje</h2>
        <div class="big-number">${DB.money(balance)}</div>
        <p class="muted">Saldo total</p>
        <div class="mini-row"><span>📤 Despesas hoje</span><strong>${DB.money(expToday)}</strong></div>
        <div class="mini-row"><span>📥 Receitas hoje</span><strong>${DB.money(incToday)}</strong></div>
        <div class="mini-row"><span>📅 Próxima conta</span><strong>${nextBill ? esc(nextBill.description) + ' · ' + DB.money(nextBill.amount) : '—'}</strong></div>
        <div class="spacer"></div>
        <h3>🎯 Metas em andamento</h3>
        ${goals.length ? goals.slice(0, 3).map(g => `<div class="progress-line"><div class="flex-between"><span>${esc(g.name)}</span><span class="muted">${Math.round(g.pct)}%</span></div><div class="progress"><div class="progress-bar" style="width:${Math.min(100, g.pct)}%"></div></div></div>`).join('') : '<p class="muted small">Crie uma meta em Finanças → Metas.</p>'}
      </section>
    </div>`
    $('#page-meu-dia').innerHTML = html
  }
  function renderTimeline(events, tasks) {
    const items = []
    events.forEach(e => items.push({ time: e.startTime || '00:00', html: `<span class="tl-time">${esc(e.startTime || '--:--')}</span><div><strong>${catIcon(e.category)} ${esc(e.title)}</strong><span class="muted"> · ${esc(e.category)}${e.location ? ' · 📍 ' + esc(e.location) : ''}</span></div>` }))
    tasks.forEach(t => items.push({ time: t.time || '23:59', html: `<span class="tl-time">${esc(t.time || '--:--')}</span><div><strong>${t.status === 'done' ? '✅' : t.priority === 'alta' ? '🔴' : '🟡'} ${esc(t.title)}</strong><span class="muted"> · Tarefa</span></div>` }))
    items.sort((a, b) => a.time.localeCompare(b.time))
    if (!items.length) return '<p class="muted small">Nada agendado para hoje. Aproveite! 🎉</p>'
    return items.map(i => `<div class="tl-item">${i.html}</div>`).join('')
  }

  // ---------- PÁGINA: AGENDA ----------
  function renderAgenda() {
    const views = ['dia', 'semana', 'mes', 'lista']
    const viewLabel = { dia: 'Dia', semana: 'Semana', mes: 'Mês', lista: 'Lista' }
    let html = `<div class="page-head">
      <h1>📅 Agenda</h1>
      <div class="segmented">${views.map(v => `<button class="seg-btn ${agendaView === v ? 'active' : ''}" data-agenda-view="${v}">${viewLabel[v]}</button>`).join('')}</div>
      <div class="head-actions">
        <button class="btn btn-ghost" data-agenda-nav="-1">←</button>
        <button class="btn btn-ghost" data-agenda-today>Hoje</button>
        <button class="btn btn-ghost" data-agenda-nav="1">→</button>
        <button class="btn btn-primary" data-action="new-event">+ Novo evento</button>
      </div>
    </div>`
    if (agendaView === 'dia') html += renderAgendaDia()
    else if (agendaView === 'semana') html += renderAgendaSemana()
    else if (agendaView === 'mes') html += renderAgendaMes()
    else html += renderAgendaLista()
    $('#page-agenda').innerHTML = html
  }
  function renderAgendaDia() {
    const evs = DB.eventsByDate(agendaCursor)
    const header = `<div class="agenda-date-head"><h2>${new Date(agendaCursor + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</h2><span class="muted">${agendaCursor === DB.todayStr() ? 'Hoje' : ''}</span></div>`
    if (!evs.length) return header + '<p class="muted">Nenhum compromisso neste dia.</p>'
    return header + evs.map(ev => eventCard(ev, true)).join('')
  }
  function renderAgendaSemana() {
    const dates = DB.weekDates(agendaCursor)
    const byDate = {}
    dates.forEach(d => { byDate[d] = DB.eventsByDate(d) })
    let html = `<div class="agenda-date-head"><h2>Semana de ${new Date(dates[0] + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} — ${new Date(dates[6] + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</h2></div>`
    dates.forEach(d => {
      const isToday = d === DB.todayStr()
      html += `<div class="week-day ${isToday ? 'week-today' : ''}"><div class="week-day-head"><strong>${new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}</strong>${isToday ? ' <span class="badge b-blue">hoje</span>' : ''}</div>`
      html += byDate[d].length ? byDate[d].map(ev => `<div class="week-ev">${esc(ev.startTime || '--:--')} · ${catIcon(ev.category)} ${esc(ev.title)}</div>`).join('') : '<span class="muted small">—</span>'
      html += `</div>`
    })
    return html
  }
  function renderAgendaMes() {
    const month = agendaCursor.slice(0, 7)
    const cells = DB.monthGrid(month)
    let html = `<div class="agenda-date-head"><h2>${new Date(month + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h2></div>`
    html += `<div class="cal-grid">` + ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => `<div class="cal-dow">${d}</div>`).join('')
    cells.forEach(c => {
      if (!c) { html += `<div class="cal-cell cal-empty"></div>`; return }
      const evs = DB.eventsByDate(c)
      const isToday = c === DB.todayStr()
      html += `<div class="cal-cell ${isToday ? 'cal-today' : ''}"><div class="cal-num">${Number(c.slice(8))}</div>`
      html += evs.slice(0, 3).map(e => `<div class="cal-ev" title="${esc(e.title)}">${esc((e.startTime || '').slice(0, 5))} ${esc(e.title)}</div>`).join('')
      if (evs.length > 3) html += `<div class="cal-more">+${evs.length - 3}</div>`
      html += `</div>`
    })
    return html + `</div>`
  }
  function renderAgendaLista() {
    const events = DB.Events.list().filter(e => e.date >= DB.todayStr()).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
    if (!events.length) return '<p class="muted">Nenhum evento futuro.</p>'
    let html = ''
    let lastMonth = ''
    events.forEach(e => {
      const m = e.date.slice(0, 7)
      if (m !== lastMonth) { html += `<div class="list-month">${new Date(e.date + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</div>`; lastMonth = m }
      html += eventCard(e, false)
    })
    return html
  }
  function eventCard(ev, withActions) {
    return `<div class="card event-card">
      <div class="ev-time">${esc(ev.startTime || '--:--')}${ev.endTime ? ' → ' + esc(ev.endTime) : ''}</div>
      <div class="ev-body">
        <strong>${catIcon(ev.category)} ${esc(ev.title)}</strong>
        <div class="muted small">${esc(ev.description || '')}${ev.location ? ' · 📍 ' + esc(ev.location) : ''}</div>
        <div class="ev-meta">${priorityBadge(ev.priority)}${ev.recurrence !== 'none' ? `<span class="badge b-blue">🔁 ${ev.recurrence}</span>` : ''}${ev.notifyBefore ? `<span class="badge b-gray">⏰ ${ev.notifyBefore}min</span>` : ''}</div>
      </div>
      ${withActions ? `<div class="ev-actions"><button class="btn btn-sm" data-action="edit-event" data-id="${esc(ev.id)}">✏️</button><button class="btn btn-sm btn-danger" data-action="delete-event" data-id="${esc(ev.id)}">🗑️</button></div>` : ''}
    </div>`
  }

  // ---------- PÁGINA: TAREFAS ----------
  function renderTarefas() {
    const filter = $('#task-filter') ? $('#task-filter').value : 'todas'
    let all = DB.Tasks.list().slice().sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
    if (filter === 'hoje') all = all.filter(t => t.date === DB.todayStr())
    else if (filter === 'pendentes') all = all.filter(t => ['pending', 'in_progress'].includes(t.status))
    else if (filter === 'concluidas') all = all.filter(t => t.status === 'done')
    const stats = DB.taskStats()
    let html = `<div class="page-head">
      <h1>✅ Minhas Tarefas</h1>
      <div class="head-actions">
        <select id="task-filter"><option value="todas">Todas</option><option value="hoje">Hoje</option><option value="pendentes">Pendentes</option><option value="concluidas">Concluídas</option></select>
        <button class="btn btn-primary" data-action="new-task">+ Nova tarefa</button>
      </div>
    </div>
    <div class="stat-grid small">
      <div class="stat"><strong>${stats.total}</strong><span>total</span></div>
      <div class="stat"><strong>${stats.pending}</strong><span>pendentes</span></div>
      <div class="stat"><strong>${stats.done}</strong><span>concluídas</span></div>
      <div class="stat"><strong>${stats.overdue}</strong><span>atrasadas</span></div>
    </div>`
    if (!all.length) html += '<p class="muted">Nenhuma tarefa encontrada.</p>'
    all.forEach(t => {
      const overdue = t.status === 'overdue'
      const statusLabel = { pending: 'Pendente', in_progress: 'Em andamento', done: 'Concluída', overdue: 'Atrasada', cancelled: 'Cancelada' }[t.status]
      html += `<div class="card task-card ${t.status === 'done' ? 'task-done' : ''}">
        <button class="btn btn-sm ${t.status === 'done' ? 'btn-success' : 'btn-ghost'}" data-action="toggle-task" data-id="${esc(t.id)}">${t.status === 'done' ? '✓' : '○'}</button>
        <div class="task-body">
          <strong>${esc(t.title)}</strong>
          <div class="muted small">${esc(t.description || '')}${t.time ? ' · ⏰ ' + esc(t.time) : ''}</div>
          <div class="ev-meta">${priorityBadge(t.priority)}<span class="badge ${overdue ? 'b-red' : 'b-gray'}">${statusLabel}</span>${t.recurring !== 'none' ? `<span class="badge b-blue">🔁 ${t.recurring}</span>` : ''}</div>
        </div>
        <div class="ev-actions"><button class="btn btn-sm" data-action="edit-task" data-id="${esc(t.id)}">✏️</button><button class="btn btn-sm btn-danger" data-action="delete-task" data-id="${esc(t.id)}">🗑️</button></div>
      </div>`
    })
    $('#page-tarefas').innerHTML = html
  }

  // ---------- PÁGINA: HÁBITOS ----------
  function renderHabitos() {
    const habits = DB.Habits.list()
    const today = DB.todayStr()
    const weekLabels = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']
    let html = `<div class="page-head">
      <h1>🔄 Meus Hábitos</h1>
      <button class="btn btn-primary" data-action="new-habit">+ Novo hábito</button>
    </div>`
    if (!habits.length) html += '<p class="muted">Crie hábitos para construir consistência. 🔥</p>'
    habits.forEach(h => {
      const streak = DB.habitStreak(h)
      const week = DB.weekDates(DB.addDays(today, -((new Date().getDay() + 6) % 7)))
      html += `<div class="card habit-card">
        <div class="habit-head"><span class="habit-icon" style="background:${esc(h.color)}22;color:${esc(h.color)}">${esc(h.icon)}</span>
        <div class="habit-title"><strong>${esc(h.name)}</strong><span class="muted small">${h.frequency === 'weekly' ? h.targetPerWeek + 'x/semana' : 'Diário'}</span></div>
        <div class="habit-streak">🔥 ${streak} ${streak === 1 ? 'dia' : 'dias'}</div></div>
        <div class="habit-week">${week.map(d => {
          const done = h.entries.includes(d)
          return `<button class="habit-dot ${done ? 'done' : ''}" data-action="toggle-habit" data-id="${esc(h.id)}" data-date="${d}" title="${new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' })}">${done ? '✓' : ''}</button>`
        }).join('')}<span class="muted small">${week[0].slice(8) === today.slice(8) ? 'esta semana' : ''}</span></div>
        <div class="ev-actions" style="margin-top:8px"><button class="btn btn-sm" data-action="edit-habit" data-id="${esc(h.id)}">✏️</button><button class="btn btn-sm btn-danger" data-action="delete-habit" data-id="${esc(h.id)}">🗑️</button></div>
      </div>`
    })
    $('#page-habitos').innerHTML = html
  }

  // ---------- PÁGINA: FINANÇAS ----------
  const FIN_TABS = [['dashboard', '📊 Dashboard'], ['contas', '💳 Contas'], ['cartoes', '💳 Cartões'], ['orcamento', '🎯 Orçamento'], ['metas', '🏆 Metas'], ['dividas', '🧾 Dívidas'], ['patrimonio', '🏦 Patrimônio'], ['previsao', '🔮 Previsão'], ['insights', '🧠 Insights'], ['planilha', '📋 Planilha']]
  function renderFinancas() {
    let html = `<div class="page-head">
      <h1>💰 Minhas Finanças</h1>
      <div class="head-actions">
        <input type="month" id="fin-month" value="${finMonth}" class="input" style="width:auto">
        <button class="btn btn-primary" data-action="new-txn" data-type="expense">+ Despesa</button>
        <button class="btn btn-success" data-action="new-txn" data-type="income">+ Receita</button>
      </div>
    </div>
    <div class="fin-tabs">${FIN_TABS.map(([k, l]) => `<button class="fin-tab ${finTab === k ? 'active' : ''}" data-fin-tab="${k}">${l}</button>`).join('')}</div>
    <div id="fin-content"></div>`
    $('#page-financas').innerHTML = html
    renderFinTab()
  }
  function renderFinTab() {
    const el = $('#fin-content')
    if (!el) return
    const fn = { dashboard: renderFinDashboard, contas: renderFinContas, cartoes: renderFinCartoes, orcamento: renderFinOrcamento, metas: renderFinMetas, dividas: renderFinDividas, patrimonio: renderFinPatrimonio, previsao: renderFinPrevisao, insights: renderFinInsights, planilha: renderFinPlanilha }[finTab]
    if (fn) el.innerHTML = fn()
  }
  function renderFinDashboard() {
    const m = DB.monthlySummary(finMonth)
    const bal = DB.totalBalance()
    const pending = DB.pendingSummary()
    const cats = DB.expensesByCategory(finMonth)
    const budgets = DB.budgetProgress(finMonth)
    const cards = DB.Cards.list().map(c => DB.cardUtilization(c.id)).filter(Boolean)
    const goals = DB.Goals.list().map(DB.goalProgress)
    const series = DB.monthlySeries(6)
    const maxSeries = Math.max(1, ...series.map(s => Math.max(s.incomes, s.expenses)))
    const maxCat = Math.max(1, ...cats.map(c => c.total))
    let html = `
    <div class="stat-grid">
      <div class="stat stat-main"><div class="stat-icon">💰</div><div><strong>${DB.money(bal)}</strong><span>Saldo total</span></div></div>
      <div class="stat stat-inc"><div class="stat-icon">📥</div><div><strong>${DB.money(m.incomes)}</strong><span>Receitas ${finMonth}</span></div></div>
      <div class="stat stat-exp"><div class="stat-icon">📤</div><div><strong>${DB.money(m.expenses)}</strong><span>Despesas ${finMonth}</span></div></div>
      <div class="stat stat-pend"><div class="stat-icon">⏳</div><div><strong>${DB.money(pending.total)}</strong><span>${pending.count} contas a pagar</span></div></div>
    </div>
    <div class="day-grid">
      <section class="card">
        <h2>📊 Receita × Despesa (6 meses)</h2>
        <div class="bar-chart" style="height:180px">${series.map(s => `<div class="bar-group" title="${s.month}"><div class="bar-stack"><div class="bar bar-inc" style="height:${(s.incomes / maxSeries * 100)}%"></div><div class="bar bar-exp" style="height:${(s.expenses / maxSeries * 100)}%"></div></div><span class="bar-label">${s.month.slice(5)}</span></div>`).join('')}</div>
      </section>
      <section class="card">
        <h2>🍩 Gastos por categoria</h2>
        ${cats.length ? cats.slice(0, 6).map(c => `<div class="progress-line"><div class="flex-between"><span>${catIcon(c.name)} ${esc(c.name)}</span><span>${DB.money(c.total)}</span></div><div class="progress"><div class="progress-bar bar-cat" style="width:${c.total / maxCat * 100}%"></div></div></div>`).join('') : '<p class="muted small">Sem despesas neste mês.</p>'}
      </section>
      <section class="card">
        <h2>🎯 Orçamento do mês</h2>
        ${budgets.length ? budgets.map(b => `<div class="progress-line"><div class="flex-between"><span>${esc(b.category)}</span><span class="${b.level === 'danger' ? 'txt-danger' : b.level === 'warning' ? 'txt-warn' : ''}">${DB.money(b.spent)} / ${DB.money(b.limit)}</span></div><div class="progress"><div class="progress-bar ${b.level === 'danger' ? 'bar-danger' : b.level === 'warning' ? 'bar-warn' : 'bar-ok'}" style="width:${Math.min(100, b.pct)}%"></div></div></div>`).join('') : '<p class="muted small">Defina orçamentos na aba Orçamento.</p>'}
      </section>
      <section class="card">
        <h2>💳 Cartões</h2>
        ${cards.length ? cards.map(c => `<div class="progress-line"><div class="flex-between"><span>${esc(c.name)}</span><span>${DB.money(c.used)} / ${DB.money(c.limit)}</span></div><div class="progress"><div class="progress-bar ${c.pct > 80 ? 'bar-danger' : c.pct > 60 ? 'bar-warn' : 'bar-ok'}" style="width:${Math.min(100, c.pct)}%"></div></div></div>`).join('') : '<p class="muted small">Cadastre cartões na aba Cartões.</p>'}
      </section>
      <section class="card">
        <h2>🏆 Metas</h2>
        ${goals.length ? goals.slice(0, 4).map(g => `<div class="progress-line"><div class="flex-between"><span>${esc(g.name)}</span><span>${Math.round(g.pct)}% · ${DB.money(g.currentAmount)}/${DB.money(g.targetAmount)}</span></div><div class="progress"><div class="progress-bar bar-goal" style="width:${Math.min(100, g.pct)}%"></div></div></div>`).join('') : '<p class="muted small">Crie metas na aba Metas.</p>'}
      </section>
    </div>`
    return html
  }
  function renderFinContas() {
    const unpaid = DB.unpaidExpenses()
    const upcoming = DB.upcomingRecurring(DB.todayStr(), 90)
    let html = `<div class="page-head"><h2>⏳ Contas a pagar</h2><button class="btn btn-primary" data-action="new-txn" data-type="expense">+ Conta</button></div>
    <div class="stat-grid small">
      <div class="stat"><strong>${unpaid.length}</strong><span>pendentes</span></div>
      <div class="stat"><strong>${DB.money(DB.pendingSummary().total)}</strong><span>total</span></div>
      <div class="stat"><strong>${DB.pendingSummary().overdueCount}</strong><span>atrasadas</span></div>
    </div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Conta</th><th>Valor</th><th>Vencimento</th><th>Status</th><th></th></tr></thead><tbody>`
    if (!unpaid.length) html += `<tr><td colspan="5" class="muted">Nenhuma conta pendente. 🎉</td></tr>`
    unpaid.forEach(t => {
      const status = t.daysOverdue > 0 ? '<span class="badge b-red">Atrasada</span>' : t.daysOverdue === 0 ? '<span class="badge b-yellow">Vence hoje</span>' : `<span class="badge b-gray">Em ${t.daysOverdue * -1}d</span>`
      html += `<tr><td>${catIcon(t.category)} ${esc(t.description)}${t.installment ? ` <span class="badge b-blue">${t.installment.number}/${t.installment.total}</span>` : ''}</td><td><strong>${DB.money(t.amount)}</strong></td><td>${DB.fmtDateBR(t.date)}</td><td>${status}</td><td><button class="btn btn-sm btn-success" data-action="toggle-txn" data-id="${esc(t.id)}">✓ Pagar</button></td></tr>`
    })
    html += `</tbody></table></div>`
    html += `<div class="page-head" style="margin-top:24px"><h2>🔁 Lançamentos recorrentes</h2><button class="btn btn-primary" data-action="new-recurring">+ Nova recorrência</button></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Descrição</th><th>Valor</th><th>Frequência</th><th>Dia</th><th>Próximo</th><th></th></tr></thead><tbody>`
    const recs = DB.Recurring.all()
    if (!recs.length) html += `<tr><td colspan="6" class="muted">Nenhuma recorrência cadastrada.</td></tr>`
    recs.forEach(r => {
      const next = DB.nextRecurringDate(r, DB.todayStr())
      html += `<tr><td>${esc(r.description)}</td><td><strong>${DB.money(r.amount)}</strong></td><td>${r.frequency}</td><td>${r.day}</td><td>${next ? DB.fmtDateBR(next) : '—'}</td><td>
        <button class="btn btn-sm" data-action="launch-recurring" data-id="${esc(r.id)}" data-date="${next}">Lançar</button>
        <button class="btn btn-sm" data-action="edit-recurring" data-id="${esc(r.id)}">✏️</button>
        <button class="btn btn-sm btn-danger" data-action="delete-recurring" data-id="${esc(r.id)}">🗑️</button></td></tr>`
    })
    html += `</tbody></table></div>`
    html += `<div class="page-head" style="margin-top:24px"><h2>📥 Próximas recorrências (90 dias)</h2></div>`
    html += upcoming.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th>Descrição</th><th>Valor</th><th></th></tr></thead><tbody>` + upcoming.map(u => `<tr><td>${DB.fmtDateBR(u.nextDate)}</td><td>${esc(u.description)}</td><td><strong>${DB.money(u.amount)}</strong></td><td><button class="btn btn-sm" data-action="launch-recurring" data-id="${esc(u.id)}" data-date="${esc(u.nextDate)}">Lançar</button></td></tr>`).join('') + `</tbody></table></div>` : '<p class="muted small">Nenhuma recorrência futura.</p>'
    html += `<div class="page-head" style="margin-top:24px"><h2>📥 Contas a receber</h2><button class="btn btn-success" data-action="new-txn" data-type="income">+ Receita</button></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Origem</th><th>Descrição</th><th>Valor</th><th>Data</th><th>Status</th></tr></thead><tbody>`
    const incomes = DB.transactionsByMonth(finMonth).filter(t => t.type === 'income')
    if (!incomes.length) html += `<tr><td colspan="5" class="muted">Nenhuma receita neste mês.</td></tr>`
    incomes.forEach(t => html += `<tr><td>${catIcon(t.category)} ${esc(t.category)}</td><td>${esc(t.description)}</td><td><strong>${DB.money(t.amount)}</strong></td><td>${DB.fmtDateBR(t.date)}</td><td><span class="badge b-green">Recebida</span></td></tr>`)
    html += `</tbody></table></div>`
    return html
  }
  function renderFinCartoes() {
    const cards = DB.Cards.list()
    let html = `<div class="page-head"><h2>💳 Cartões de crédito</h2><button class="btn btn-primary" data-action="new-card">+ Novo cartão</button></div>`
    if (!cards.length) html += '<p class="muted">Cadastre um cartão para acompanhar limite e fatura.</p>'
    cards.forEach(c => {
      const u = DB.cardUtilization(c.id)
      const inv = DB.currentInvoice(c.id)
      html += `<div class="card">
        <div class="flex-between"><h3>${esc(c.name)} <span class="muted">· ${esc(c.bank || '')}</span></h3>
          <div><button class="btn btn-sm" data-action="new-card-purchase" data-id="${esc(c.id)}">+ Compra</button><button class="btn btn-sm" data-action="edit-card" data-id="${esc(c.id)}">✏️</button><button class="btn btn-sm btn-danger" data-action="delete-card" data-id="${esc(c.id)}">🗑️</button></div></div>
        <div class="stat-grid small">
          <div class="stat"><strong>${DB.money(u.used)}</strong><span>utilizado</span></div>
          <div class="stat"><strong>${DB.money(u.available)}</strong><span>disponível</span></div>
          <div class="stat"><strong>${DB.money(c.limit)}</strong><span>limite</span></div>
        </div>
        <div class="progress"><div class="progress-bar ${u.pct > 80 ? 'bar-danger' : u.pct > 60 ? 'bar-warn' : 'bar-ok'}" style="width:${Math.min(100, u.pct)}%"></div></div>
        <div class="spacer"></div>
        <h4>Fatura atual: <strong>${DB.money(inv.total)}</strong> <span class="muted">(fechamento dia ${c.closingDay} · vencimento dia ${c.dueDay})</span></h4>
        ${inv.purchases.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Compra</th><th>Categoria</th><th>Valor</th><th>Parcela</th><th>Status</th><th></th></tr></thead><tbody>` + inv.purchases.map(p => `<tr><td>${esc(p.description)}</td><td>${catIcon(p.category)} ${esc(p.category)}</td><td><strong>${DB.money(p.amount)}</strong></td><td>${p.installment ? p.installment.number + '/' + p.installment.total : '—'}</td><td>${p.paid ? '<span class="badge b-green">Pago</span>' : '<span class="badge b-yellow">Pendente</span>'}</td><td><button class="btn btn-sm" data-action="toggle-card-purchase" data-id="${esc(p.id)}">${p.paid ? '○' : '✓'}</button></td></tr>`).join('') + `</tbody></table></div>` : '<p class="muted small">Nenhuma compra neste cartão.</p>'}
      </div>`
    })
    return html
  }
  function renderFinOrcamento() {
    const budgets = DB.budgetProgress(finMonth)
    let html = `<div class="page-head"><h2>🎯 Orçamento mensal — ${finMonth}</h2><button class="btn btn-primary" data-action="new-budget">+ Novo orçamento</button></div>
    <div class="stat-grid small">
      <div class="stat"><strong>${budgets.length}</strong><span>categorias</span></div>
      <div class="stat"><strong>${DB.money(budgets.reduce((s, b) => s + b.limit, 0))}</strong><span>limite total</span></div>
      <div class="stat"><strong>${DB.money(budgets.reduce((s, b) => s + b.spent, 0))}</strong><span>gasto total</span></div>
    </div>`
    if (!budgets.length) html += '<p class="muted">Defina limites por categoria para acompanhar seus gastos.</p>'
    budgets.forEach(b => {
      const levelIcon = b.level === 'danger' ? '🔴' : b.level === 'warning' ? '🟡' : '🟢'
      html += `<div class="card budget-card">
        <div class="flex-between"><strong>${levelIcon} ${esc(b.category)}</strong><span class="muted">${DB.money(b.limit - b.spent)} disponível</span></div>
        <div class="progress"><div class="progress-bar ${b.level === 'danger' ? 'bar-danger' : b.level === 'warning' ? 'bar-warn' : 'bar-ok'}" style="width:${Math.min(100, b.pct)}%"></div></div>
        <div class="flex-between muted small"><span>${DB.money(b.spent)} gasto</span><span>${Math.round(b.pct)}% de ${DB.money(b.limit)}</span></div>
        <div class="ev-actions" style="margin-top:8px"><button class="btn btn-sm" data-action="edit-budget" data-id="${esc(b.id)}">✏️</button><button class="btn btn-sm btn-danger" data-action="delete-budget" data-id="${esc(b.id)}">🗑️</button></div>
      </div>`
    })
    return html
  }
  function renderFinMetas() {
    const goals = DB.Goals.list().map(DB.goalProgress).sort((a, b) => b.pct - a.pct)
    let html = `<div class="page-head"><h2>🏆 Minhas Metas</h2><button class="btn btn-primary" data-action="new-goal">+ Nova meta</button></div>`
    if (!goals.length) html += '<p class="muted">Defina metas financeiras e acompanhe o progresso.</p>'
    goals.forEach(g => {
      html += `<div class="card goal-card">
        <div class="flex-between"><strong>🎯 ${esc(g.name)}</strong><span class="${g.isComplete ? 'badge b-green' : 'muted'}">${g.isComplete ? 'Concluída!' : Math.round(g.pct) + '%'}</span></div>
        <div class="progress"><div class="progress-bar bar-goal" style="width:${Math.min(100, g.pct)}%"></div></div>
        <div class="flex-between muted small"><span>${DB.money(g.currentAmount)} guardado</span><span>meta ${DB.money(g.targetAmount)}${g.deadline ? ' · até ' + DB.fmtDateBR(g.deadline) : ''}</span></div>
        <div class="ev-actions" style="margin-top:8px">
          <button class="btn btn-sm btn-success" data-action="contribute-goal" data-id="${esc(g.id)}">+ Aporte</button>
          <button class="btn btn-sm" data-action="edit-goal" data-id="${esc(g.id)}">✏️</button>
          <button class="btn btn-sm btn-danger" data-action="delete-goal" data-id="${esc(g.id)}">🗑️</button>
        </div>
      </div>`
    })
    return html
  }
  function renderFinDividas() {
    const debts = DB.Debts.list().filter(d => d.status !== 'paid')
    let html = `<div class="page-head"><h2>🧾 Minhas Dívidas</h2><button class="btn btn-primary" data-action="new-debt">+ Nova dívida</button></div>`
    if (!debts.length) html += '<p class="muted">Nenhuma dívida em aberto. 🎉</p>'
    debts.forEach(d => {
      const pct = d.originalAmount > 0 ? ((d.originalAmount - d.currentAmount) / d.originalAmount) * 100 : 0
      html += `<div class="card">
        <div class="flex-between"><strong>🧾 ${esc(d.creditor)}</strong><span class="muted">${d.status === 'negotiating' ? 'Negociando' : 'Em aberto'}</span></div>
        <div class="stat-grid small">
          <div class="stat"><strong>${DB.money(d.currentAmount)}</strong><span>valor atual</span></div>
          <div class="stat"><strong>${DB.money(d.originalAmount)}</strong><span>original</span></div>
          <div class="stat"><strong>${d.interestRate}%</strong><span>juros</span></div>
        </div>
        <div class="progress"><div class="progress-bar bar-ok" style="width:${Math.min(100, pct)}%"></div></div>
        <div class="ev-actions" style="margin-top:8px"><button class="btn btn-sm btn-success" data-action="pay-debt" data-id="${esc(d.id)}">Quitar</button><button class="btn btn-sm" data-action="edit-debt" data-id="${esc(d.id)}">✏️</button><button class="btn btn-sm btn-danger" data-action="delete-debt" data-id="${esc(d.id)}">🗑️</button></div>
      </div>`
    })
    return html
  }
  function renderFinPatrimonio() {
    const nw = DB.netWorth()
    const assets = DB.Assets.list()
    const debts = DB.Debts.list().filter(d => d.status !== 'paid')
    const accounts = DB.Accounts.list()
    let html = `<div class="page-head"><h2>🏦 Meu Patrimônio</h2><button class="btn btn-primary" data-action="new-asset">+ Novo bem</button></div>
    <div class="stat-grid">
      <div class="stat"><div class="stat-icon">💵</div><div><strong>${DB.money(nw.cash)}</strong><span>dinheiro (contas + transações)</span></div></div>
      <div class="stat"><div class="stat-icon">🏠</div><div><strong>${DB.money(nw.assets)}</strong><span>bens e investimentos</span></div></div>
      <div class="stat"><div class="stat-icon">🧾</div><div><strong>${DB.money(nw.debts)}</strong><span>dívidas</span></div></div>
      <div class="stat stat-main"><div class="stat-icon">📈</div><div><strong>${DB.money(nw.total)}</strong><span>patrimônio líquido</span></div></div>
    </div>
    <div class="day-grid">
      <section class="card"><h3>Contas</h3>${accounts.map(a => `<div class="mini-row"><span>${esc(a.name)} <span class="muted small">(${a.type})</span></span><strong>${DB.money(DB.accountBalance(a.id))}</strong></div>`).join('')}</section>
      <section class="card"><h3>Bens e investimentos</h3>${assets.length ? assets.map(a => `<div class="mini-row"><span>${esc(a.name)} <span class="muted small">(${esc(a.type)})</span></span><strong>${DB.money(a.value)}</strong></div>`).join('') : '<p class="muted small">Adicione bens, investimentos ou outros valores.</p>'}</section>
      <section class="card"><h3>Dívidas em aberto</h3>${debts.length ? debts.map(d => `<div class="mini-row"><span>${esc(d.creditor)}</span><strong>${DB.money(d.currentAmount)}</strong></div>`).join('') : '<p class="muted small">Nenhuma dívida.</p>'}</section>
    </div>`
    return html
  }
  function renderFinPrevisao() {
    const horizons = [7, 15, 30, 90, 180, 365]
    let html = `<div class="page-head"><h2>🔮 Previsão financeira</h2><p class="muted">Saldo atual + receitas esperadas − despesas esperadas − contas a pagar − faturas</p></div>
    <div class="stat-grid small">${horizons.map(h => {
      const f = DB.forecast(h)
      return `<div class="stat ${f.healthy ? '' : 'stat-exp'}"><strong>${DB.money(f.projected)}</strong><span>${h} dias</span><span class="muted small">${f.healthy ? '✅ saudável' : '⚠️ negativo'}</span></div>`
    }).join('')}</div>
    <div class="card"><h3>Detalhe — 30 dias</h3>${(() => { const f = DB.forecast(30); return `<div class="mini-row"><span>Saldo atual</span><strong>${DB.money(f.start)}</strong></div><div class="mini-row"><span>Receitas esperadas (recorrências)</span><strong class="txt-ok">+ ${DB.money(f.expectedIncomes)}</strong></div><div class="mini-row"><span>Despesas esperadas (recorrências)</span><strong class="txt-danger">− ${DB.money(f.expectedExpenses)}</strong></div><div class="mini-row"><span>Contas a pagar no período</span><strong class="txt-danger">− ${DB.money(f.unpaid)}</strong></div><div class="mini-row"><span>Faturas de cartão</span><strong class="txt-danger">− ${DB.money(f.cardDue)}</strong></div><div class="mini-row"><span><strong>Saldo projetado</strong></span><strong>${DB.money(f.projected)}</strong></div>` })()}</div>`
    return html
  }
  function renderFinInsights() {
    const insight = Insights.analyze(DB.Transactions.list())
    const report = Insights.monthlyReport(DB.Transactions.list(), finMonth)
    let html = `<div class="page-head"><h2>🧠 Insights</h2></div>`
    html += `<div class="card"><h3>Análise de ${new Date(insight.month + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h3>`
    html += insight.messages.map(m => `<div class="alert alert-${m.type === 'success' ? 'success' : m.type === 'danger' ? 'danger' : m.type === 'warning' ? 'warning' : 'info'}">${esc(m.text)}</div>`).join('')
    html += `</div>`
    html += `<div class="card"><h3>📋 Relatório de ${new Date(report.month + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h3>
      <div class="stat-grid small">
        <div class="stat"><strong>${DB.money(report.incomes)}</strong><span>receitas</span></div>
        <div class="stat"><strong>${DB.money(report.expenses)}</strong><span>despesas</span></div>
        <div class="stat ${report.balance >= 0 ? '' : 'stat-exp'}"><strong>${DB.money(report.balance)}</strong><span>economia</span></div>
        <div class="stat"><strong>${report.savingsRate.toFixed(1)}%</strong><span>taxa de economia</span></div>
      </div>`
    if (report.biggestExpense) html += `<div class="mini-row"><span>Maior despesa</span><strong>${esc(report.biggestExpense.description)} — ${DB.money(report.biggestExpense.amount)}</strong></div>`
    if (report.smallestExpense) html += `<div class="mini-row"><span>Menor despesa</span><strong>${esc(report.smallestExpense.description)} — ${DB.money(report.smallestExpense.amount)}</strong></div>`
    if (report.topCategory) html += `<div class="mini-row"><span>Categoria com mais gastos</span><strong>${esc(report.topCategory.name)} — ${DB.money(report.topCategory.total)}</strong></div>`
    if (report.vsPrevPct !== null) html += `<div class="mini-row"><span>vs mês anterior</span><strong class="${report.vsPrevPct > 0 ? 'txt-danger' : 'txt-ok'}">${report.vsPrevPct > 0 ? '+' : ''}${report.vsPrevPct.toFixed(1)}%</strong></div>`
    html += `</div>`
    return html
  }
  function renderFinPlanilha() {
    const txs = DB.transactionsByMonth(finMonth).sort((a, b) => a.date.localeCompare(b.date))
    const recs = DB.Recurring.all()
    let html = `<div class="page-head"><h2>📋 Planilha financeira — ${finMonth}</h2>
      <div class="head-actions">
        <button class="btn btn-ghost" data-action="export-csv">⬇️ Exportar CSV</button>
        <button class="btn btn-ghost" data-action="export-json">⬇️ Backup JSON</button>
        <button class="btn btn-ghost" data-action="import-json">⬆️ Importar</button>
      </div></div>`
    html += `<div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Categoria</th><th>Conta</th><th>Valor</th><th>Status</th></tr></thead><tbody>`
    if (!txs.length) html += `<tr><td colspan="7" class="muted">Sem lançamentos neste mês.</td></tr>`
    txs.forEach(t => {
      html += `<tr><td>${DB.fmtDateBR(t.date)}</td><td>${t.type === 'income' ? '<span class="badge b-green">Receita</span>' : '<span class="badge b-red">Despesa</span>'}</td><td>${esc(t.description)}${t.installment ? ` <span class="badge b-blue">${t.installment.number}/${t.installment.total}</span>` : ''}</td><td>${catIcon(t.category)} ${esc(t.category)}</td><td>${esc(t.account || '—')}</td><td class="${t.type === 'income' ? 'txt-ok' : 'txt-danger'}"><strong>${t.type === 'income' ? '+' : '−'}${DB.money(t.amount)}</strong></td><td>${t.type === 'income' ? '<span class="badge b-green">Recebida</span>' : t.paid ? '<span class="badge b-green">Pago</span>' : '<span class="badge b-yellow">Pendente</span>'}</td></tr>`
    })
    html += `</tbody></table></div>`
    html += `<div class="spacer"></div><h3>🔁 Recorrências cadastradas</h3>`
    html += recs.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Descrição</th><th>Tipo</th><th>Valor</th><th>Frequência</th><th>Dia</th><th>Status</th></tr></thead><tbody>` + recs.map(r => `<tr><td>${esc(r.description)}</td><td>${r.type === 'income' ? 'Receita' : 'Despesa'}</td><td>${DB.money(r.amount)}</td><td>${r.frequency}</td><td>${r.day}</td><td>${r.active ? '<span class="badge b-green">Ativa</span>' : '<span class="badge b-gray">Pausada</span>'}</td></tr>`).join('') + `</tbody></table></div>` : '<p class="muted small">Nenhuma recorrência.</p>'
    return html
  }

  // ---------- PÁGINA: NOTIFICAÇÕES ----------
  function renderNotificacoes() {
    const filter = $('#notif-filter') ? $('#notif-filter').value : 'todas'
    let all = DB.Notifications.list()
    if (filter === 'naolidas') all = all.filter(n => !n.read)
    else if (filter === 'importantes') all = all.filter(n => n.important)
    const unread = DB.Notifications.unreadCount()
    let html = `<div class="page-head"><h1>🔔 Notificações</h1>
      <div class="head-actions">
        <select id="notif-filter"><option value="todas">Todas</option><option value="naolidas">Não lidas</option><option value="importantes">Importantes</option></select>
        <button class="btn btn-ghost" data-action="mark-all-read">✓ Marcar todas como lidas</button>
      </div></div>
      ${unread > 0 ? `<div class="alert alert-info">Você tem ${unread} notificação(ões) não lida(s).</div>` : ''}`
    if (!all.length) html += '<p class="muted">Nenhuma notificação ainda. As notificações geradas pelo app aparecem aqui.</p>'
    all.forEach(n => {
      html += `<div class="card notif-card ${n.read ? '' : 'notif-unread'}">
        <div class="notif-body"><strong>${n.important ? '⭐ ' : ''}${esc(n.title)}</strong><p class="muted small">${esc(n.body)}</p><span class="muted tiny">${n.createdAt ? new Date(n.createdAt).toLocaleString('pt-BR') : ''}</span></div>
        <div class="ev-actions">${n.read ? '' : `<button class="btn btn-sm" data-action="read-notif" data-id="${esc(n.id)}">✓</button>`}<button class="btn btn-sm btn-danger" data-action="delete-notif" data-id="${esc(n.id)}">🗑️</button></div>
      </div>`
    })
    $('#page-notificacoes').innerHTML = html
  }
  function renderNotifBadge() {
    const count = DB.Notifications.unreadCount()
    const badge = $('#notif-badge')
    if (badge) { badge.textContent = count > 99 ? '99+' : count; badge.style.display = count > 0 ? 'inline-flex' : 'none' }
  }

  // ---------- PÁGINA: PERFIL ----------
  function renderPerfil() {
    const s = DB.getSettings()
    const nw = DB.netWorth()
    let html = `<div class="page-head"><h1>👤 Meu Perfil</h1></div>
    <div class="day-grid">
      <section class="card">
        <div class="avatar">${esc((s.name || 'A').charAt(0).toUpperCase())}</div>
        <h2>${esc(s.name || 'Anthony')}</h2>
        <p class="muted">${esc(s.email || 'Adicione um e-mail nas configurações')}</p>
        <div class="spacer"></div>
        <div class="mini-row"><span>Moeda</span><strong>${esc(s.currency)}</strong></div>
        <div class="mini-row"><span>Fuso horário</span><strong>${esc(s.timezone)}</strong></div>
        <div class="mini-row"><span>Tema</span><strong>${s.theme === 'dark' ? '🌙 Escuro' : s.theme === 'light' ? '☀️ Claro' : '🖥️ Sistema'}</strong></div>
      </section>
      <section class="card">
        <h2>📊 Resumo</h2>
        <div class="mini-row"><span>Saldo total</span><strong>${DB.money(nw.cash)}</strong></div>
        <div class="mini-row"><span>Patrimônio líquido</span><strong>${DB.money(nw.total)}</strong></div>
        <div class="mini-row"><span>Tarefas concluídas</span><strong>${DB.taskStats().done}</strong></div>
        <div class="mini-row"><span>Hábitos em andamento</span><strong>${DB.Habits.list().length}</strong></div>
        <div class="mini-row"><span>Metas</span><strong>${DB.Goals.list().length}</strong></div>
      </section>
    </div>`
    $('#page-perfil').innerHTML = html
  }

  // ---------- PÁGINA: CONFIG ----------
  function renderConfig() {
    const s = DB.getSettings()
    const hasPin = Crypto.isPinSet()
    let html = `<div class="page-head"><h1>⚙️ Configurações</h1></div>
    <div class="day-grid">
      <section class="card"><h2>👤 Perfil</h2>
        <label>Nome</label><input id="cfg-name" class="input" value="${esc(s.name || '')}">
        <label>E-mail</label><input id="cfg-email" class="input" value="${esc(s.email || '')}">
      </section>
      <section class="card"><h2>🎨 Aparência</h2>
        <div class="segmented">${['dark', 'light', 'system'].map(t => `<button class="seg-btn ${s.theme === t ? 'active' : ''}" data-theme="${t}">${t === 'dark' ? '🌙 Escuro' : t === 'light' ? '☀️ Claro' : '🖥️ Sistema'}</button>`).join('')}</div>
      </section>
      <section class="card"><h2>🔒 Segurança</h2>
        <p class="muted small" style="margin-bottom:10px">${hasPin ? 'PIN ativo — seus dados estão criptografados.' : 'Configure um PIN para proteger seus dados financeiros.'}</p>
        ${hasPin
          ? `<div class="modal-actions" style="justify-content:flex-start;flex-direction:column;gap:8px">
              <div class="form-row"><label>Senha atual</label><input class="input" type="password" id="cfg-pin-old" placeholder="••••••"></div>
              <div class="form-row"><label>Nova senha</label><input class="input" type="password" id="cfg-pin-new" placeholder="••••••"></div>
              <button class="btn btn-primary" id="cfg-pin-change">Alterar PIN</button>
              <button class="btn btn-danger" id="cfg-pin-remove">Remover PIN</button>
            </div>`
          : `<div class="form-row"><label>Criar PIN (4-6 dígitos)</label><input class="input" type="password" id="cfg-pin-new" placeholder="••••••" maxlength="6" inputmode="numeric"></div>
            <button class="btn btn-primary" id="cfg-pin-create" style="margin-top:8px">Criar PIN</button>`
        }
      </section>
      <section class="card"><h2>🔔 Notificações</h2>
        <div class="mini-row"><span>Notificações habilitadas</span><label class="switch"><input type="checkbox" id="cfg-notif-enabled" ${s.notificationPrefs.enabled ? 'checked' : ''}><span class="slider"></span></label></div>
        <label>Lembrar antes do vencimento (dias)</label>
        <div class="chip-row">${[5, 3, 2, 1].map(d => `<label class="chip"><input type="checkbox" data-bill-day="${d}" ${(s.notificationPrefs.daysBefore || []).includes(d) ? 'checked' : ''}> ${d} dia${d > 1 ? 's' : ''}</label>`).join('')}</div>
        <div class="mini-row"><span>Som</span><label class="switch"><input type="checkbox" id="cfg-sound" ${s.notificationPrefs.sound ? 'checked' : ''}><span class="slider"></span></label></div>
        <div class="mini-row"><span>Vibração</span><label class="switch"><input type="checkbox" id="cfg-vibrate" ${s.notificationPrefs.vibration ? 'checked' : ''}><span class="slider"></span></label></div>
      </section>
      <section class="card"><h2>💾 Dados</h2>
        <div class="modal-actions" style="justify-content:flex-start">
          <button class="btn btn-primary" data-action="export-json">⬇️ Backup completo (JSON)</button>
          <button class="btn btn-ghost" data-action="export-csv">⬇️ Transações CSV</button>
          <button class="btn btn-ghost" data-action="import-json">⬆️ Restaurar backup</button>
          <button class="btn btn-danger" data-action="clear-data">🗑️ Apagar todos os dados</button>
        </div>
      </section>
    </div>`
    $('#page-config').innerHTML = html

    // Bind PIN events
    const pinCreate = document.getElementById('cfg-pin-create')
    const pinChange = document.getElementById('cfg-pin-change')
    const pinRemove = document.getElementById('cfg-pin-remove')

    if (pinCreate) {
      pinCreate.addEventListener('click', async () => {
        const pin = (document.getElementById('cfg-pin-new').value || '').trim()
        if (!pin || pin.length < 4) { toast('PIN deve ter pelo menos 4 dígitos.', 'danger'); return }
        await Crypto.setupPin(pin)
        await Storage.migrateToEncryption()
        toast('PIN criado! Dados criptografados. 🔒', 'success')
        renderConfig()
      })
    }
    if (pinChange) {
      pinChange.addEventListener('click', async () => {
        const oldPin = (document.getElementById('cfg-pin-old').value || '').trim()
        const newPin = (document.getElementById('cfg-pin-new').value || '').trim()
        if (!oldPin || !newPin) { toast('Preencha ambos os campos.', 'danger'); return }
        if (newPin.length < 4) { toast('Novo PIN deve ter pelo menos 4 dígitos.', 'danger'); return }
        const ok = await Crypto.changePin(oldPin, newPin)
        if (ok) { toast('PIN alterado! 🔒', 'success'); renderConfig() }
        else toast('PIN atual incorreto.', 'danger')
      })
    }
    if (pinRemove) {
      pinRemove.addEventListener('click', async () => {
        const pin = (document.getElementById('cfg-pin-old').value || '').trim()
        if (!pin) { toast('Digite o PIN atual para remover.', 'danger'); return }
        const ok = await Crypto.removePin(pin)
        if (ok) { toast('PIN removido. Dados não criptografados.', 'warning'); renderConfig() }
        else toast('PIN incorreto.', 'danger')
      })
    }
  }

  // ---------- BUSCA ----------
  function renderBusca() {
    const q = ($('#global-search').value || '').trim().toLowerCase()
    let html = `<div class="page-head"><h1>🔍 Busca global</h1></div>`
    if (!q) { html += '<p class="muted">Digite na caixa de busca para encontrar eventos, tarefas, contas, despesas, metas e hábitos.</p>'; $('#page-busca').innerHTML = html; return }
    const found = []
    DB.Events.list().forEach(e => { if ((e.title + ' ' + e.description + ' ' + e.category + ' ' + (e.location || '')).toLowerCase().includes(q)) found.push({ type: 'Evento', icon: '📅', text: e.title, sub: e.date + ' ' + (e.startTime || '') }) })
    DB.Tasks.list().forEach(t => { if ((t.title + ' ' + t.description + ' ' + t.category).toLowerCase().includes(q)) found.push({ type: 'Tarefa', icon: '✅', text: t.title, sub: t.date + ' ' + (t.time || '') }) })
    DB.Transactions.list().forEach(t => { if ((t.description + ' ' + t.category + ' ' + (t.subcategory || '')).toLowerCase().includes(q)) found.push({ type: t.type === 'income' ? 'Receita' : 'Despesa', icon: t.type === 'income' ? '📥' : '📤', text: t.description, sub: DB.money(t.amount) + ' · ' + t.date }) })
    DB.Goals.list().forEach(g => { if (g.name.toLowerCase().includes(q)) found.push({ type: 'Meta', icon: '🎯', text: g.name, sub: DB.money(g.currentAmount) + ' / ' + DB.money(g.targetAmount) }) })
    DB.Habits.list().forEach(h => { if (h.name.toLowerCase().includes(q)) found.push({ type: 'Hábito', icon: '🔄', text: h.name, sub: '🔥 ' + DB.habitStreak(h) + ' dias' }) })
    DB.Recurring.all().forEach(r => { if (r.description.toLowerCase().includes(q)) found.push({ type: 'Recorrência', icon: '🔁', text: r.description, sub: DB.money(r.amount) + ' · ' + r.frequency }) })
    if (!found.length) html += '<p class="muted">Nada encontrado para "' + esc(q) + '".</p>'
    else found.slice(0, 50).forEach(f => html += `<div class="card search-item">${f.icon} <div><strong>${esc(f.text)}</strong><div class="muted small">${f.type} · ${esc(f.sub)}</div></div></div>`)
    $('#page-busca').innerHTML = html
  }

  // ---------- FORMULÁRIOS (modais) ----------
  function formShell(title, body, dataForm) {
    return `<h3>${esc(title)}</h3><form data-form="${dataForm}">${body}<div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button type="submit" class="btn btn-primary">Salvar</button></div></form>`
  }
  function optionsFrom(choices, selected, labels) {
    return choices.map(c => `<option value="${esc(c)}" ${c === selected ? 'selected' : ''}>${esc(labels ? labels[c] : c)}</option>`).join('')
  }
  function categoryOptions(type, selected) {
    return DB.Categories.byType(type).map(c => `<option value="${esc(c.name)}" ${c.name === selected ? 'selected' : ''}>${esc(c.icon + ' ' + c.name)}</option>`).join('')
  }
  function accountOptions(selected) {
    return DB.Accounts.list().map(a => `<option value="${esc(a.name)}" ${a.name === selected ? 'selected' : ''}>${esc(a.name)}</option>`).join('')
  }
  function openEventForm(ev) {
    openModal(formShell(ev ? '✏️ Editar evento' : '📅 Novo evento', `
      <label>Título *</label><input class="input" name="title" required value="${esc(ev ? ev.title : '')}" maxlength="200">
      <div class="form-row"><div><label>Data *</label><input class="input" type="date" name="date" required value="${esc(ev ? ev.date : DB.todayStr())}"></div><div><label>Categoria</label><select class="input" name="category">${optionsFrom(DB.EVENT_CATEGORIES, ev ? ev.category : 'Pessoal')}</select></div></div>
      <div class="form-row"><div><label>Hora início</label><input class="input" type="time" name="startTime" value="${esc(ev ? ev.startTime : '')}"></div><div><label>Hora fim</label><input class="input" type="time" name="endTime" value="${esc(ev ? ev.endTime : '')}"></div></div>
      <label>Descrição</label><textarea class="input" name="description" rows="2">${esc(ev ? ev.description : '')}</textarea>
      <label>Local</label><input class="input" name="location" value="${esc(ev ? ev.location : '')}" maxlength="200">
      <div class="form-row"><div><label>Prioridade</label><select class="input" name="priority">${optionsFrom(DB.PRIORITIES, ev ? ev.priority : 'media')}</select></div><div><label>Notificar antes (min)</label><input class="input" type="number" name="notifyBefore" min="0" max="10080" value="${ev ? ev.notifyBefore : 30}"></div></div>
      <div class="form-row"><div><label>Repetição</label><select class="input" name="recurrence">${optionsFrom(DB.RECURRENCE, ev ? ev.recurrence : 'none', { none: 'Uma vez', daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal', yearly: 'Anual', specific: 'Dias específicos' })}</select></div><div id="daysOfWeekWrap" style="display:none"><label>Dias da semana</label><select class="input" name="daysOfWeek" multiple size="7">${optionsFrom([0, 1, 2, 3, 4, 5, 6], null, { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' })}</select></div></div>
      <label>Observações</label><textarea class="input" name="observations" rows="2">${esc(ev ? ev.observations : '')}</textarea>
      <input type="hidden" name="id" value="${ev ? esc(ev.id) : ''}">
    `, 'event'), { title: ev ? 'Editar evento' : 'Novo evento' })
    const sel = $('#modal select[name="recurrence"]')
    if (sel) sel.addEventListener('change', () => { $('#daysOfWeekWrap').style.display = sel.value === 'specific' ? 'block' : 'none' })
  }
  function openTaskForm(task) {
    openModal(formShell(task ? '✏️ Editar tarefa' : '✅ Nova tarefa', `
      <label>Título *</label><input class="input" name="title" required value="${esc(task ? task.title : '')}" maxlength="200">
      <label>Descrição</label><textarea class="input" name="description" rows="2">${esc(task ? task.description : '')}</textarea>
      <div class="form-row"><div><label>Data *</label><input class="input" type="date" name="date" required value="${esc(task ? task.date : DB.todayStr())}"></div><div><label>Hora</label><input class="input" type="time" name="time" value="${esc(task ? task.time : '')}"></div></div>
      <div class="form-row"><div><label>Prioridade</label><select class="input" name="priority">${optionsFrom(DB.PRIORITIES, task ? task.priority : 'media')}</select></div><div><label>Categoria</label><input class="input" name="category" value="${esc(task ? task.category : '')}" list="task-cat-list"><datalist id="task-cat-list">${DB.EVENT_CATEGORIES.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div></div>
      <div class="form-row"><div><label>Prazo</label><input class="input" type="datetime-local" name="deadline" value="${esc(task ? task.deadline : '')}"></div><div><label>Repetição</label><select class="input" name="recurring">${optionsFrom(DB.RECURRENCE, task ? task.recurring : 'none', { none: 'Uma vez', daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal', yearly: 'Anual' })}</select></div></div>
      <div class="form-row"><div><label>Status</label><select class="input" name="status">${optionsFrom(DB.TASK_STATUS, task ? task.status : 'pending', { pending: 'Pendente', in_progress: 'Em andamento', done: 'Concluída', overdue: 'Atrasada', cancelled: 'Cancelada' })}</select></div></div>
      <input type="hidden" name="id" value="${task ? esc(task.id) : ''}">
    `, 'task'), { title: task ? 'Editar tarefa' : 'Nova tarefa' })
  }
  function openHabitForm(habit) {
    openModal(formShell(habit ? '✏️ Editar hábito' : '🔄 Novo hábito', `
      <div class="form-row"><div><label>Nome *</label><input class="input" name="name" required value="${esc(habit ? habit.name : '')}" maxlength="80"></div><div><label>Ícone</label><input class="input" name="icon" value="${esc(habit ? habit.icon : '⭐')}" maxlength="4"></div></div>
      <div class="form-row"><div><label>Cor</label><input class="input" type="color" name="color" value="${esc(habit ? habit.color : '#2563eb')}"></div><div><label>Frequência</label><select class="input" name="frequency"><option value="daily" ${habit && habit.frequency === 'daily' ? 'selected' : ''}>Diário</option><option value="weekly" ${habit && habit.frequency === 'weekly' ? 'selected' : ''}>Semanal</option></select></div></div>
      <label>Meta por semana</label><input class="input" type="number" name="targetPerWeek" min="1" max="7" value="${habit ? habit.targetPerWeek : 7}">
      <input type="hidden" name="id" value="${habit ? esc(habit.id) : ''}">
    `, 'habit'), { title: habit ? 'Editar hábito' : 'Novo hábito' })
  }
  function openTxnForm(type, txn) {
    const isExpense = type === 'expense' || (txn && txn.type === 'expense')
    openModal(formShell(txn ? '✏️ Editar lançamento' : (isExpense ? '📤 Nova despesa' : '📥 Nova receita'), `
      <label>Descrição *</label><input class="input" name="description" required value="${esc(txn ? txn.description : '')}" maxlength="200">
      <div class="form-row"><div><label>Valor *</label><input class="input" type="number" name="amount" required step="0.01" min="0.01" value="${txn ? txn.amount : ''}"></div><div><label>Data *</label><input class="input" type="date" name="date" required value="${esc(txn ? txn.date : DB.todayStr())}"></div></div>
      <div class="form-row"><div><label>Categoria</label><select class="input" name="category">${categoryOptions(isExpense ? 'expense' : 'income', txn ? txn.category : '')}</select></div><div><label>Subcategoria</label><input class="input" name="subcategory" value="${esc(txn ? txn.subcategory : '')}" list="subcat-list"><datalist id="subcat-list"></datalist></div></div>
      <div class="form-row"><div><label>Conta</label><select class="input" name="account">${accountOptions(txn ? txn.account : '')}</select></div><div><label>Forma de pagamento</label><input class="input" name="method" value="${esc(txn ? txn.method : '')}" placeholder="Pix, cartão, dinheiro..."></div></div>
      ${isExpense && !txn ? `<div class="form-row"><div><label>Parcelas</label><select class="input" name="installments"><option value="1">À vista (1x)</option>${Array.from({ length: 47 }, (_, i) => `<option value="${i + 2}">${i + 2}x — parcelado</option>`).join('')}</select></div><div><label>Já foi pago?</label><select class="input" name="paid"><option value="false">Não (a pagar)</option><option value="true">Sim</option></select></div></div>` : `<input type="hidden" name="installments" value="1">${txn ? `<input type="hidden" name="paid" value="${txn.paid ? 'true' : 'false'}">` : '<input type="hidden" name="paid" value="true">'}`}
      <label>Observações</label><textarea class="input" name="observations" rows="2">${esc(txn ? txn.observations : '')}</textarea>
      <input type="hidden" name="type" value="${isExpense ? 'expense' : 'income'}">
      <input type="hidden" name="id" value="${txn ? esc(txn.id) : ''}">
      ${txn && txn.installment ? `<p class="muted small">⚠️ Parcela ${txn.installment.number}/${txn.installment.total} — para alterar, exclua o grupo inteiro.</p>` : ''}
    `, 'txn'), { title: txn ? 'Editar lançamento' : (isExpense ? 'Nova despesa' : 'Nova receita') })
    const cat = $('#modal select[name="category"]')
    if (cat) cat.addEventListener('change', () => updateSubcatList(cat.value))
  }
  function updateSubcatList(catName) {
    const c = DB.Categories.list().find(x => x.name === catName)
    const dl = $('#subcat-list')
    if (dl && c) dl.innerHTML = c.subcategories.map(s => `<option value="${esc(s)}">`).join('')
  }
  function openRecurringForm(r) {
    openModal(formShell(r ? '✏️ Editar recorrência' : '🔁 Nova recorrência', `
      <label>Descrição *</label><input class="input" name="description" required value="${esc(r ? r.description : '')}" maxlength="200">
      <div class="form-row"><div><label>Valor *</label><input class="input" type="number" name="amount" required step="0.01" min="0.01" value="${r ? r.amount : ''}"></div><div><label>Tipo</label><select class="input" name="type"><option value="expense" ${r && r.type === 'expense' ? 'selected' : ''}>Despesa</option><option value="income" ${r && r.type === 'income' ? 'selected' : ''}>Receita</option></select></div></div>
      <div class="form-row"><div><label>Categoria</label><select class="input" name="category">${categoryOptions(r ? r.type : 'expense', r ? r.category : '')}</select></div><div><label>Conta</label><select class="input" name="account">${accountOptions(r ? r.account : '')}</select></div></div>
      <div class="form-row"><div><label>Frequência</label><select class="input" name="frequency"><option value="monthly" ${r && r.frequency === 'monthly' ? 'selected' : ''}>Mensal</option><option value="weekly" ${r && r.frequency === 'weekly' ? 'selected' : ''}>Semanal</option><option value="yearly" ${r && r.frequency === 'yearly' ? 'selected' : ''}>Anual</option></select></div><div><label>Dia</label><input class="input" type="number" name="day" min="0" max="31" value="${r ? r.day : 5}"></div></div>
      <label>Início</label><input class="input" type="date" name="startDate" value="${esc(r ? r.startDate : DB.todayStr())}">
      <label>Observações</label><textarea class="input" name="notes" rows="2">${esc(r ? r.notes : '')}</textarea>
      <input type="hidden" name="id" value="${r ? esc(r.id) : ''}">
    `, 'recurring'), { title: r ? 'Editar recorrência' : 'Nova recorrência' })
  }
  function openAccountForm(a) {
    openModal(formShell(a ? '✏️ Editar conta' : '🏦 Nova conta', `
      <label>Nome *</label><input class="input" name="name" required value="${esc(a ? a.name : '')}" maxlength="80">
      <div class="form-row"><div><label>Tipo</label><select class="input" name="type">${optionsFrom(DB.ACCOUNT_TYPES, a ? a.type : 'current', { current: 'Conta corrente', savings: 'Poupança', cash: 'Carteira', digital: 'Conta digital', investment: 'Investimentos' })}</select></div><div><label>Banco</label><input class="input" name="bank" value="${esc(a ? a.bank : '')}" maxlength="80"></div></div>
      <label>Saldo inicial</label><input class="input" type="number" name="balance" step="0.01" value="${a ? a.balance : 0}">
      <input type="hidden" name="id" value="${a ? esc(a.id) : ''}">
    `, 'account'), { title: a ? 'Editar conta' : 'Nova conta' })
  }
  function openCardForm(c) {
    openModal(formShell(c ? '✏️ Editar cartão' : '💳 Novo cartão', `
      <label>Nome *</label><input class="input" name="name" required value="${esc(c ? c.name : '')}" maxlength="80">
      <div class="form-row"><div><label>Banco</label><input class="input" name="bank" value="${esc(c ? c.bank : '')}" maxlength="80"></div><div><label>Limite</label><input class="input" type="number" name="limit" min="0" step="0.01" value="${c ? c.limit : 3000}"></div></div>
      <div class="form-row"><div><label>Dia de fechamento</label><input class="input" type="number" name="closingDay" min="1" max="31" value="${c ? c.closingDay : 10}"></div><div><label>Dia de vencimento</label><input class="input" type="number" name="dueDay" min="1" max="31" value="${c ? c.dueDay : 17}"></div></div>
      <input type="hidden" name="id" value="${c ? esc(c.id) : ''}">
    `, 'card'), { title: c ? 'Editar cartão' : 'Novo cartão' })
  }
  function openCardPurchaseForm(cardId) {
    const card = DB.Cards.get(cardId)
    openModal(formShell('💳 Nova compra' + (card ? ' — ' + esc(card.name) : ''), `
      <label>Descrição *</label><input class="input" name="description" required value="" maxlength="200">
      <div class="form-row"><div><label>Valor total *</label><input class="input" type="number" name="amount" required step="0.01" min="0.01"></div><div><label>Categoria</label><select class="input" name="category">${categoryOptions('expense', '')}</select></div></div>
      <div class="form-row"><div><label>Parcelas</label><select class="input" name="installments"><option value="1">À vista</option>${Array.from({ length: 47 }, (_, i) => `<option value="${i + 2}">${i + 2}x</option>`).join('')}</select></div><div><label>Data</label><input class="input" type="date" name="date" value="${esc(DB.todayStr())}"></div></div>
      <label>Observações</label><textarea class="input" name="observations" rows="2"></textarea>
      <input type="hidden" name="cardId" value="${esc(cardId)}">
    `, 'cardPurchase'), { title: 'Nova compra no cartão' })
  }
  function openBudgetForm(b) {
    openModal(formShell(b ? '✏️ Editar orçamento' : '🎯 Novo orçamento', `
      <div class="form-row"><div><label>Categoria</label><select class="input" name="category">${categoryOptions('expense', b ? b.category : '')}</select></div><div><label>Mês</label><input class="input" type="month" name="month" value="${esc(b ? b.month : finMonth)}"></div></div>
      <label>Limite mensal *</label><input class="input" type="number" name="limit" required step="0.01" min="0.01" value="${b ? b.limit : ''}">
      <input type="hidden" name="id" value="${b ? esc(b.id) : ''}">
    `, 'budget'), { title: b ? 'Editar orçamento' : 'Novo orçamento' })
  }
  function openGoalForm(g) {
    openModal(formShell(g ? '✏️ Editar meta' : '🎯 Nova meta', `
      <label>Nome *</label><input class="input" name="name" required value="${esc(g ? g.name : '')}" maxlength="120">
      <div class="form-row"><div><label>Valor objetivo *</label><input class="input" type="number" name="targetAmount" required step="0.01" min="0.01" value="${g ? g.targetAmount : ''}"></div><div><label>Valor atual</label><input class="input" type="number" name="currentAmount" step="0.01" min="0" value="${g ? g.currentAmount : 0}"></div></div>
      <div class="form-row"><div><label>Prazo</label><input class="input" type="date" name="deadline" value="${esc(g ? g.deadline : '')}"></div><div><label>Aporte mensal</label><input class="input" type="number" name="monthlyContribution" step="0.01" min="0" value="${g ? g.monthlyContribution : 0}"></div></div>
      <input type="hidden" name="id" value="${g ? esc(g.id) : ''}">
    `, 'goal'), { title: g ? 'Editar meta' : 'Nova meta' })
  }
  function openDebtForm(d) {
    openModal(formShell(d ? '✏️ Editar dívida' : '🧾 Nova dívida', `
      <label>Credor *</label><input class="input" name="creditor" required value="${esc(d ? d.creditor : '')}" maxlength="120">
      <div class="form-row"><div><label>Valor original *</label><input class="input" type="number" name="originalAmount" required step="0.01" min="0.01" value="${d ? d.originalAmount : ''}"></div><div><label>Valor atual</label><input class="input" type="number" name="currentAmount" step="0.01" min="0" value="${d ? d.currentAmount : ''}"></div></div>
      <div class="form-row"><div><label>Juros (% ao mês)</label><input class="input" type="number" name="interestRate" step="0.01" min="0" value="${d ? d.interestRate : 0}"></div><div><label>Parcelas</label><input class="input" type="number" name="installments" min="1" value="${d ? d.installments : 1}"></div></div>
      <label>Vencimento</label><input class="input" type="date" name="dueDate" value="${esc(d ? d.dueDate : '')}">
      <div class="form-row"><div><label>Status</label><select class="input" name="status"><option value="open" ${d && d.status === 'open' ? 'selected' : ''}>Em aberto</option><option value="negotiating" ${d && d.status === 'negotiating' ? 'selected' : ''}>Negociando</option><option value="paid" ${d && d.status === 'paid' ? 'selected' : ''}>Paga</option></select></div></div>
      <input type="hidden" name="id" value="${d ? esc(d.id) : ''}">
    `, 'debt'), { title: d ? 'Editar dívida' : 'Nova dívida' })
  }
  function openAssetForm(a) {
    openModal(formShell(a ? '✏️ Editar bem' : '🏠 Novo bem', `
      <label>Nome *</label><input class="input" name="name" required value="${esc(a ? a.name : '')}" maxlength="120">
      <div class="form-row"><div><label>Tipo</label><input class="input" name="type" value="${esc(a ? a.type : 'Investimento')}" maxlength="60"></div><div><label>Valor</label><input class="input" type="number" name="value" step="0.01" min="0" value="${a ? a.value : 0}"></div></div>
      <input type="hidden" name="id" value="${a ? esc(a.id) : ''}">
    `, 'asset'), { title: a ? 'Editar bem' : 'Novo bem' })
  }
  function openTransferForm() {
    const accounts = DB.Accounts.list()
    if (accounts.length < 2) { toast('Cadastre pelo menos duas contas para transferir.', 'warning'); return }
    openModal(formShell('🔄 Transferência entre contas', `
      <div class="form-row"><div><label>De</label><select class="input" name="fromAccount">${accountOptions('')}</select></div><div><label>Para</label><select class="input" name="toAccount">${accountOptions('')}</select></div></div>
      <div class="form-row"><div><label>Valor *</label><input class="input" type="number" name="amount" required step="0.01" min="0.01"></div><div><label>Data</label><input class="input" type="date" name="date" value="${esc(DB.todayStr())}"></div></div>
      <label>Observações</label><textarea class="input" name="observations" rows="2"></textarea>
    `, 'transfer'), { title: 'Nova transferência' })
  }

  // ---------- handlers de formulário ----------
  function readForm(form, names) {
    const out = {}
    names.forEach(n => {
      const el = form.elements ? form.elements[n] : form.querySelector('[name="' + n + '"]')
      if (!el) return
      out[n] = el.type === 'checkbox' ? el.checked : el.value
    })
    return out
  }

  // Validação JS de formulários (fallback para required/pattern do HTML)
  function validateForm(form) {
    const requiredFields = form.querySelectorAll('[required]')
    let valid = true
    requiredFields.forEach(field => {
      // Remove erro anterior
      field.style.borderColor = ''
      const val = field.type === 'checkbox' ? field.checked : field.value.trim()
      if (!val) {
        field.style.borderColor = 'var(--danger)'
        valid = false
      }
    })
    // Valida type="number" com min/max
    const numberFields = form.querySelectorAll('input[type="number"]')
    numberFields.forEach(field => {
      const val = Number(field.value)
      if (field.value && !Number.isFinite(val)) {
        field.style.borderColor = 'var(--danger)'
        valid = false
      }
      if (field.min && val < Number(field.min)) {
        field.style.borderColor = 'var(--danger)'
        valid = false
      }
      if (field.max && val > Number(field.max)) {
        field.style.borderColor = 'var(--danger)'
        valid = false
      }
    })
    if (!valid) toast('Preencha os campos obrigatórios.', 'danger')
    return valid
  }
  function handleForm(kind, form) {
    if (!validateForm(form)) return
    if (kind === 'event') {
      const v = readForm(form, ['id', 'title', 'description', 'date', 'startTime', 'endTime', 'location', 'category', 'priority', 'notifyBefore', 'recurrence', 'observations'])
      const daysSel = form.querySelector('[name="daysOfWeek"]')
      v.daysOfWeek = daysSel ? Array.from(daysSel.selectedOptions).map(o => Number(o.value)) : []
      const res = v.id ? DB.Events.update(v.id, v) : DB.Events.add(v)
      res && res.success === false ? toast(res.error, 'danger') : (toast(v.id ? 'Evento atualizado ✓' : 'Evento criado ✓'), closeModal(), renderCurrent())
    }
    if (kind === 'task') {
      const v = readForm(form, ['id', 'title', 'description', 'date', 'time', 'priority', 'category', 'deadline', 'status', 'recurring'])
      const res = v.id ? DB.Tasks.update(v.id, v) : DB.Tasks.add(v)
      res && res.success === false ? toast(res.error, 'danger') : (toast(v.id ? 'Tarefa atualizada ✓' : 'Tarefa criada ✓'), closeModal(), renderCurrent())
    }
    if (kind === 'habit') {
      const v = readForm(form, ['id', 'name', 'icon', 'color', 'frequency', 'targetPerWeek'])
      v.targetPerWeek = Number(v.targetPerWeek) || 7
      const res = v.id ? DB.Habits.update(v.id, v) : DB.Habits.add(v)
      res && res.success === false ? toast(res.error, 'danger') : (toast(v.id ? 'Hábito atualizado ✓' : 'Hábito criado ✓'), closeModal(), renderCurrent())
    }
    if (kind === 'txn') {
      const v = readForm(form, ['id', 'description', 'amount', 'date', 'category', 'subcategory', 'account', 'method', 'installments', 'paid', 'type', 'observations'])
      v.amount = Number(v.amount)
      v.installments = v.installments === '' || v.installments === undefined ? 1 : Number(v.installments)
      v.paid = v.paid === 'true' || v.paid === true
      if (v.paid && v.status === undefined) v.status = 'paid'
      const res = v.id ? DB.Transactions.update(v.id, v) : DB.Transactions.add(v)
      res && res.success === false ? toast(res.error, 'danger') : (toast(v.id ? 'Lançamento atualizado ✓' : 'Lançamento registrado ✓'), closeModal(), renderCurrent(), refreshAll())
    }
    if (kind === 'recurring') {
      const v = readForm(form, ['id', 'description', 'amount', 'type', 'category', 'account', 'frequency', 'day', 'startDate', 'notes'])
      v.amount = Number(v.amount); v.day = Number(v.day)
      const res = v.id ? DB.Recurring.update(v.id, v) : DB.Recurring.add(v)
      res && res.success === false ? toast(res.error, 'danger') : (toast(v.id ? 'Recorrência atualizada ✓' : 'Recorrência criada ✓'), closeModal(), renderCurrent())
    }
    if (kind === 'account') {
      const v = readForm(form, ['id', 'name', 'type', 'bank', 'balance'])
      v.balance = Number(v.balance) || 0
      const res = v.id ? DB.Accounts.update(v.id, v) : DB.Accounts.add(v)
      res && res.success === false ? toast(res.error, 'danger') : (toast(v.id ? 'Conta atualizada ✓' : 'Conta criada ✓'), closeModal(), renderCurrent())
    }
    if (kind === 'card') {
      const v = readForm(form, ['id', 'name', 'bank', 'limit', 'closingDay', 'dueDay'])
      v.limit = Number(v.limit) || 0; v.closingDay = Number(v.closingDay) || 10; v.dueDay = Number(v.dueDay) || 17
      const res = v.id ? DB.Cards.update(v.id, v) : DB.Cards.add(v)
      res && res.success === false ? toast(res.error, 'danger') : (toast(v.id ? 'Cartão atualizado ✓' : 'Cartão criado ✓'), closeModal(), renderCurrent())
    }
    if (kind === 'cardPurchase') {
      const v = readForm(form, ['cardId', 'description', 'amount', 'category', 'installments', 'date', 'observations'])
      const total = Number(v.installments) || 1
      const res = DB.CardPurchases.add({ description: v.description, amount: Number(v.amount), category: v.category, cardId: v.cardId, installments: total > 1 ? { groupId: 'x', number: 1, total } : null, date: v.date, observations: v.observations })
      res ? (toast('Compra registrada ✓' + (total > 1 ? ` (${total}x de ${DB.money(Number(v.amount) / total)})` : '')), closeModal(), renderCurrent()) : toast('Erro ao registrar compra.', 'danger')
    }
    if (kind === 'budget') {
      const v = readForm(form, ['id', 'category', 'month', 'limit'])
      v.limit = Number(v.limit)
      const res = v.id ? DB.Budgets.update(v.id, v) : DB.Budgets.add(v)
      res && res.success === false ? toast(res.error, 'danger') : (toast(v.id ? 'Orçamento atualizado ✓' : 'Orçamento criado ✓'), closeModal(), renderCurrent())
    }
    if (kind === 'goal') {
      const v = readForm(form, ['id', 'name', 'targetAmount', 'currentAmount', 'deadline', 'monthlyContribution'])
      v.targetAmount = Number(v.targetAmount); v.currentAmount = Number(v.currentAmount) || 0; v.monthlyContribution = Number(v.monthlyContribution) || 0
      const res = v.id ? DB.Goals.update(v.id, v) : DB.Goals.add(v)
      res && res.success === false ? toast(res.error, 'danger') : (toast(v.id ? 'Meta atualizada ✓' : 'Meta criada ✓'), closeModal(), renderCurrent())
    }
    if (kind === 'debt') {
      const v = readForm(form, ['id', 'creditor', 'originalAmount', 'currentAmount', 'interestRate', 'installments', 'dueDate', 'status'])
      v.originalAmount = Number(v.originalAmount); v.currentAmount = Number(v.currentAmount) || v.originalAmount; v.interestRate = Number(v.interestRate) || 0; v.installments = Number(v.installments) || 1
      const res = v.id ? DB.Debts.update(v.id, v) : DB.Debts.add(v)
      res && res.success === false ? toast(res.error, 'danger') : (toast(v.id ? 'Dívida atualizada ✓' : 'Dívida registrada ✓'), closeModal(), renderCurrent())
    }
    if (kind === 'asset') {
      const v = readForm(form, ['id', 'name', 'type', 'value'])
      v.value = Number(v.value) || 0
      const res = v.id ? DB.Assets.update(v.id, v) : DB.Assets.add(v)
      res && res.success === false ? toast(res.error, 'danger') : (toast(v.id ? 'Bem atualizado ✓' : 'Bem registrado ✓'), closeModal(), renderCurrent())
    }
    if (kind === 'transfer') {
      const v = readForm(form, ['fromAccount', 'toAccount', 'amount', 'date', 'observations'])
      const fromAcc = DB.Accounts.list().find(a => a.name === v.fromAccount)
      const toAcc = DB.Accounts.list().find(a => a.name === v.toAccount)
      if (!fromAcc || !toAcc) { toast('Conta inválida.', 'danger'); return }
      const res = DB.transfer(fromAcc.id, toAcc.id, Number(v.amount), v.date, v.observations)
      res && res.success === false ? toast(res.error, 'danger') : (toast('Transferência realizada ✓ (sem duplicar receita/despesa)'), closeModal(), renderCurrent())
    }
    refreshReminders()
  }

  // ---------- quick actions (FAB) ----------
  function showQuickActions() {
    openModal(`<h3>➕ Adicionar rápido</h3>
      <div class="quick-grid">
        <button class="quick-btn" data-action="new-event">📅<span>Evento</span></button>
        <button class="quick-btn" data-action="new-task">✅<span>Tarefa</span></button>
        <button class="quick-btn" data-action="new-txn" data-type="expense">📤<span>Despesa</span></button>
        <button class="quick-btn" data-action="new-txn" data-type="income">📥<span>Receita</span></button>
        <button class="quick-btn" data-action="new-habit">🔄<span>Hábito</span></button>
        <button class="quick-btn" data-action="new-goal">🎯<span>Meta</span></button>
        <button class="quick-btn" data-action="new-recurring">🔁<span>Recorrência</span></button>
        <button class="quick-btn" data-action="new-transfer">🔄<span>Transferência</span></button>
      </div>`, { title: 'Adicionar rápido' })
  }

  // ---------- global click delegation ----------
  function handleAction(action, el) {
    const id = el.dataset.id
    if (action === 'new-event') openEventForm(null)
    else if (action === 'edit-event') openEventForm(DB.Events.get(id))
    else if (action === 'delete-event') confirmModal('Excluir este evento?').then(ok => { if (ok) { DB.Events.remove(id); toast('Evento excluído.'); renderCurrent() } })
    else if (action === 'new-task') openTaskForm(null)
    else if (action === 'edit-task') openTaskForm(DB.Tasks.get(id))
    else if (action === 'delete-task') confirmModal('Excluir esta tarefa?').then(ok => { if (ok) { DB.Tasks.remove(id); toast('Tarefa excluída.'); renderCurrent() } })
    else if (action === 'toggle-task') { const t = DB.Tasks.get(id); DB.Tasks.update(id, { status: t.status === 'done' ? 'pending' : 'done' }); renderCurrent() }
    else if (action === 'new-habit') openHabitForm(null)
    else if (action === 'edit-habit') openHabitForm(DB.Habits.get(id))
    else if (action === 'delete-habit') confirmModal('Excluir este hábito?').then(ok => { if (ok) { DB.Habits.remove(id); toast('Hábito excluído.'); renderCurrent() } })
    else if (action === 'toggle-habit') { DB.habitToggle(DB.Habits.get(id), el.dataset.date); renderCurrent(); toast('Hábito marcado! 🔥', 'success') }
    else if (action === 'new-txn') openTxnForm(el.dataset.type || 'expense', null)
    else if (action === 'edit-txn') openTxnForm(DB.Transactions.get(id).type, DB.Transactions.get(id))
    else if (action === 'delete-txn') confirmModal('Excluir este lançamento?' + (DB.Transactions.get(id) && DB.Transactions.get(id).installment ? ' (apenas esta parcela)' : '')).then(ok => { if (ok) { DB.Transactions.remove(id); toast('Lançamento excluído.'); renderCurrent(); refreshAll() } })
    else if (action === 'delete-txn-group') { const t = DB.Transactions.get(id); confirmModal(`Excluir TODAS as ${t.installment.total} parcelas deste grupo?`).then(ok => { if (ok) { DB.Transactions.removeInstallmentGroup(t.installment.groupId); toast('Grupo de parcelas excluído.'); renderCurrent(); refreshAll() } }) }
    else if (action === 'toggle-txn') { DB.Transactions.togglePaid(id); toast('Status atualizado ✓'); renderCurrent(); refreshAll() }
    else if (action === 'new-recurring') openRecurringForm(null)
    else if (action === 'edit-recurring') openRecurringForm(DB.Recurring.get(id))
    else if (action === 'delete-recurring') confirmModal('Excluir esta recorrência?').then(ok => { if (ok) { DB.Recurring.remove(id); toast('Recorrência excluída.'); renderCurrent() } })
    else if (action === 'launch-recurring') { const r = DB.Recurring.get(id); if (!r) return; const res = DB.generateRecurring(r, el.dataset.date || DB.nextRecurringDate(r, DB.todayStr())); res && res.success === false ? toast(res.error, 'danger') : (toast('Lançamento gerado ✓'), renderCurrent(), refreshAll()) }
    else if (action === 'new-card') openCardForm(null)
    else if (action === 'edit-card') openCardForm(DB.Cards.get(id))
    else if (action === 'delete-card') confirmModal('Excluir este cartão e suas compras?').then(ok => { if (ok) { DB.Cards.remove(id); toast('Cartão excluído.'); renderCurrent() } })
    else if (action === 'new-card-purchase') openCardPurchaseForm(id)
    else if (action === 'toggle-card-purchase') { const p = DB.CardPurchases.list().find(x => x.id === id); if (p) DB.update('cardPurchases', id, { paid: !p.paid }); renderCurrent() }
    else if (action === 'new-budget') openBudgetForm(null)
    else if (action === 'edit-budget') openBudgetForm(DB.Budgets.get(id))
    else if (action === 'delete-budget') confirmModal('Excluir este orçamento?').then(ok => { if (ok) { DB.Budgets.remove(id); toast('Orçamento excluído.'); renderCurrent() } })
    else if (action === 'new-goal') openGoalForm(null)
    else if (action === 'edit-goal') openGoalForm(DB.Goals.get(id))
    else if (action === 'delete-goal') confirmModal('Excluir esta meta?').then(ok => { if (ok) { DB.Goals.remove(id); toast('Meta excluída.'); renderCurrent() } })
    else if (action === 'contribute-goal') {
      const g = DB.Goals.get(id)
      openModal(formShell('💰 Aporte na meta: ' + esc(g.name), `<label>Valor do aporte *</label><input class="input" type="number" name="amount" required step="0.01" min="0.01" placeholder="0,00">`, 'goalContribute') + `<input type="hidden" id="goal-id" value="${esc(id)}">`, { title: 'Aporte' })
    }
    else if (action === 'new-debt') openDebtForm(null)
    else if (action === 'edit-debt') openDebtForm(DB.Debts.get(id))
    else if (action === 'delete-debt') confirmModal('Excluir esta dívida?').then(ok => { if (ok) { DB.Debts.remove(id); toast('Dívida excluída.'); renderCurrent() } })
    else if (action === 'pay-debt') confirmModal('Marcar esta dívida como paga?').then(ok => { if (ok) { DB.Debts.update(id, { status: 'paid', currentAmount: 0 }); toast('Dívida quitada 🎉'); renderCurrent() } })
    else if (action === 'new-asset') openAssetForm(null)
    else if (action === 'edit-asset') openAssetForm(DB.Assets.get(id))
    else if (action === 'delete-asset') confirmModal('Excluir este bem?').then(ok => { if (ok) { DB.Assets.remove(id); toast('Bem excluído.'); renderCurrent() } })
    else if (action === 'new-transfer') openTransferForm()
    else if (action === 'read-notif') { DB.Notifications.markRead(id); renderNotificacoes(); renderNotifBadge() }
    else if (action === 'delete-notif') { DB.Notifications.remove(id); renderNotificacoes(); renderNotifBadge() }
    else if (action === 'mark-all-read') { DB.Notifications.markAllRead(); toast('Todas as notificações marcadas como lidas ✓'); renderNotificacoes(); renderNotifBadge() }
    else if (action === 'export-json') { Export.exportJSON(); toast('Backup JSON exportado ✓') }
    else if (action === 'export-csv') { const r = Export.exportTransactionsCSV(finMonth); toast(`CSV exportado com ${r.count} lançamentos ✓`) }
    else if (action === 'import-json') { $('#import-file').click() }
    else if (action === 'clear-data') confirmModal('Apagar TODOS os dados? Esta ação não pode ser desfeita. Faça um backup antes.', '⚠️ Atenção').then(ok => { if (ok) { DB.clearAllData(); DB.init(); toast('Dados apagados.', 'danger'); renderCurrent(); renderNotifBadge() } })
    else if (action === 'toggle-txn-group') { const t = DB.Transactions.get(id); if (t && t.installment) { const group = DB.Transactions.getInstallmentGroup(t.installment.groupId); const allPaid = group.every(x => x.paid); group.forEach(x => DB.update('transactions', x.id, { paid: !allPaid })); renderCurrent(); refreshAll() } }
    else if (action === 'add-account') openAccountForm(null)
    else if (action === 'add-card') openCardForm(null)
  }
  function bindGlobalClicks() {
    document.addEventListener('click', e => {
      const close = e.target.closest('[data-close]')
      if (close) { closeModal(); return }
      const page = e.target.closest('[data-page]')
      if (page) { navigate(page.dataset.page); return }
      const act = e.target.closest('[data-action]')
      if (act) { handleAction(act.dataset.action, act); return }
      const view = e.target.closest('[data-agenda-view]')
      if (view) { agendaView = view.dataset.agendaView; renderAgenda(); return }
      const nav = e.target.closest('[data-agenda-nav]')
      if (nav) { agendaCursor = DB.addDays(agendaCursor, Number(nav.dataset.agendaNav) * (agendaView === 'mes' ? 30 : agendaView === 'semana' ? 7 : 1)); renderAgenda(); return }
      const today = e.target.closest('[data-agenda-today]')
      if (today) { agendaCursor = DB.todayStr(); renderAgenda(); return }
      const ft = e.target.closest('[data-fin-tab]')
      if (ft) { finTab = ft.dataset.finTab; renderFinTab(); return }
      const theme = e.target.closest('[data-theme]')
      if (theme) { DB.saveSettings({ theme: theme.dataset.theme }); applyTheme(); renderConfig() }
    })
    document.addEventListener('change', e => {
      if (e.target.id === 'fin-month') { finMonth = e.target.value || DB.monthStr(); renderFinTab() }
      if (e.target.id === 'task-filter') renderTarefas()
      if (e.target.id === 'notif-filter') renderNotificacoes()
      if (e.target.id === 'global-search') renderBusca()
      if (e.target.id === 'import-file') { handleImportFile(e.target) }
    })
    document.addEventListener('input', e => { if (e.target.id === 'global-search') renderBusca() })
    document.addEventListener('submit', e => {
      const form = e.target.closest('[data-form]')
      if (!form) return
      e.preventDefault()
      if (form.dataset.form === 'goalContribute') {
        const amount = Number(form.querySelector('[name="amount"]').value)
        const gid = $('#goal-id').value
        const res = DB.Goals.contribute(gid, amount)
        res && res.success === false ? toast(res.error, 'danger') : (toast('Aporte registrado ✓'), closeModal(), renderCurrent())
        return
      }
      handleForm(form.dataset.form, form)
    })
  }

  // ---------- notificações reais (SW) ----------
  function refreshReminders() {
    const s = DB.getSettings()
    const prefs = s.notificationPrefs || {}
    if (prefs.enabled === false) return
    const events = DB.Events.list()
    const tasks = DB.Tasks.list()
    const unpaid = DB.unpaidExpenses()
    const reminders = NotificationPlanner.planAll(events, tasks, unpaid, s)
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'PLAN_REMINDERS', reminders })
    }
    if (reminders.length) DB.Notifications.add({ type: 'reminder', title: reminders[0].title, body: reminders[0].body, important: reminders[0].important })
  }
  function setupSW() {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('./service-worker.js').then(reg => {
        if (navigator.serviceWorker.controller) refreshReminders()
        reg.addEventListener('updatefound', () => { const nw = reg.installing; if (nw) nw.addEventListener('statechange', () => { if (nw.state === 'activated') refreshReminders() }) })
      }).catch(() => {})
      // permissão de notificação pedida no 1º gesto do usuário (evita prompt automático que browsers bloqueiam)
      const askPermission = () => {
        if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {})
      }
      document.addEventListener('click', askPermission, { once: true })
    }
  }
  function handleImportFile(input) {
    const file = input.files && input.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        const res = DB.importAllData(data)
        if (res && res.success === false) { toast(res.error || 'Backup inválido.', 'danger'); return }
        toast('Backup restaurado ✓ (ignorados: ' + (res.ignored ? Object.keys(res.ignored).filter(k => res.ignored[k] > 0).map(k => k + ':' + res.ignored[k]).join(', ') || '0' : '0') + ')')
        renderCurrent(); renderNotifBadge(); refreshAll()
      } catch (err) {
        toast('Arquivo de backup inválido: ' + err.message, 'danger')
      } finally {
        input.value = ''
      }
    }
    reader.onerror = () => toast('Erro ao ler o arquivo.', 'danger')
    reader.readAsText(file)
  }
  function seedDemoData() {
    if (DB.Transactions.list().length || DB.Events.list().length) { toast('Dados já existem.'); return }
    const t = DB.todayStr()
    const m = t.slice(0, 7)
    // eventos
    const evtBase = [
      { title: 'Café da manhã', time: '07:00', cat: 'Pessoal' },
      { title: 'Trabalho', time: '08:00', cat: 'Trabalho' },
      { title: 'Almoço', time: '12:00', cat: 'Pessoal' },
      { title: 'Estudos', time: '14:00', cat: 'Estudos' },
      { title: 'Academia', time: '18:00', cat: 'Exercício' },
      { title: 'Curso', time: '20:00', cat: 'Estudos' },
      { title: 'Preparar para dormir', time: '22:00', cat: 'Pessoal' }
    ]
    evtBase.forEach((e, i) => DB.Events.add({ title: e.title, date: t, startTime: e.time, category: e.cat, priority: 'media', recurrence: 'none', notifyBefore: 30 }))
    DB.Events.add({ title: 'Estudar programação', date: DB.addDays(t, -1), startTime: '19:00', category: 'Estudos', priority: 'alta', recurrence: 'weekly', notifyBefore: 15 })
    DB.Events.add({ title: 'Reunião de planejamento', date: DB.addDays(t, 1), startTime: '10:00', endTime: '11:00', category: 'Trabalho', priority: 'alta', location: 'Escritório', notifyBefore: 30 })
    DB.Events.add({ title: 'Consulta médica', date: DB.addDays(t, 3), startTime: '15:30', category: 'Saúde', priority: 'alta', notifyBefore: 60 })
    // tarefas
    DB.Tasks.add({ title: 'Entregar relatório', date: t, time: '15:00', priority: 'alta', category: 'Trabalho', status: 'pending' })
    DB.Tasks.add({ title: 'Pagar contas', date: t, priority: 'alta', category: 'Finanças', status: 'pending' })
    DB.Tasks.add({ title: 'Organizar documentos', date: DB.addDays(t, 1), priority: 'baixa', category: 'Pessoal', status: 'pending' })
    DB.Tasks.add({ title: 'Revisar orçamento mensal', date: DB.addDays(t, 2), priority: 'media', category: 'Finanças', status: 'pending' })
    DB.Tasks.add({ title: 'Comprar presente', date: DB.addDays(t, 4), priority: 'media', category: 'Pessoal', status: 'pending' })
    DB.Tasks.add({ title: 'Lavar o carro', date: DB.addDays(t, -2), priority: 'baixa', category: 'Pessoal', status: 'done' })
    // hábitos
    DB.Habits.add({ name: 'Beber água', icon: '💧', color: '#3b82f6', frequency: 'daily', entries: [t, DB.addDays(t, -1), DB.addDays(t, -2), DB.addDays(t, -3)] })
    DB.Habits.add({ name: 'Ler', icon: '📖', color: '#8b5cf6', frequency: 'daily', entries: [t, DB.addDays(t, -1)] })
    DB.Habits.add({ name: 'Exercitar', icon: '🏋️', color: '#ef4444', frequency: 'daily', entries: [DB.addDays(t, -1), DB.addDays(t, -3), DB.addDays(t, -5)] })
    DB.Habits.add({ name: 'Meditar', icon: '🧘', color: '#10b981', frequency: 'daily', entries: [t] })
    // finanças
    const pMonth = DB.addDays(m + '-01', -1).slice(0, 7)
    const salaryDay = '05'
    const p1 = m + '-' + salaryDay
    DB.Transactions.add({ description: 'Salário', amount: 4500, type: 'income', category: 'Salário', date: p1, paid: true })
    DB.Transactions.add({ description: 'Freelance', amount: 800, type: 'income', category: 'Freelance', date: m + '-15', paid: true })
    DB.Transactions.add({ description: 'Aluguel', amount: 1500, type: 'expense', category: 'Casa', subcategory: 'Aluguel', date: m + '-05', paid: true })
    DB.Transactions.add({ description: 'Internet', amount: 100, type: 'expense', category: 'Casa', subcategory: 'Internet', date: m + '-20', paid: false })
    DB.Transactions.add({ description: 'Energia', amount: 180, type: 'expense', category: 'Casa', subcategory: 'Energia', date: m + '-22', paid: false })
    DB.Transactions.add({ description: 'Mercado', amount: 620, type: 'expense', category: 'Alimentação', subcategory: 'Mercado', date: m + '-08', paid: true })
    DB.Transactions.add({ description: 'iFood', amount: 150, type: 'expense', category: 'Alimentação', subcategory: 'Delivery', date: m + '-12', paid: true })
    DB.Transactions.add({ description: 'Combustível', amount: 220, type: 'expense', category: 'Transporte', subcategory: 'Combustível', date: m + '-10', paid: true })
    DB.Transactions.add({ description: 'Farmácia', amount: 85, type: 'expense', category: 'Saúde', subcategory: 'Farmácia', date: m + '-14', paid: true })
    DB.Transactions.add({ description: 'Netflix', amount: 55, type: 'expense', category: 'Lazer', subcategory: 'Eventos', date: m + '-18', paid: true })
    DB.Transactions.add({ description: 'Notebook novo', amount: 3600, type: 'expense', category: 'Outros', date: m + '-02', installments: 12, paid: true })
    // mês passado
    DB.Transactions.add({ description: 'Salário', amount: 4500, type: 'income', category: 'Salário', date: pMonth + '-' + salaryDay, paid: true })
    DB.Transactions.add({ description: 'Aluguel', amount: 1500, type: 'expense', category: 'Casa', subcategory: 'Aluguel', date: pMonth + '-05', paid: true })
    DB.Transactions.add({ description: 'Mercado', amount: 580, type: 'expense', category: 'Alimentação', subcategory: 'Mercado', date: pMonth + '-08', paid: true })
    DB.Transactions.add({ description: 'Energia', amount: 165, type: 'expense', category: 'Casa', subcategory: 'Energia', date: pMonth + '-22', paid: true })
    DB.Transactions.add({ description: 'Combustível', amount: 200, type: 'expense', category: 'Transporte', subcategory: 'Combustível', date: pMonth + '-10', paid: true })
    // recorrentes
    DB.Recurring.add({ description: 'Internet', amount: 100, type: 'expense', category: 'Casa', day: 20, frequency: 'monthly', startDate: t })
    DB.Recurring.add({ description: 'Aluguel', amount: 1500, type: 'expense', category: 'Casa', day: 5, frequency: 'monthly', startDate: t })
    DB.Recurring.add({ description: 'Academia', amount: 90, type: 'expense', category: 'Saúde', day: 10, frequency: 'monthly', startDate: t })
    DB.Recurring.add({ description: 'Salário', amount: 4500, type: 'income', category: 'Salário', day: 5, frequency: 'monthly', startDate: t })
    DB.Recurring.add({ description: 'Freelance', amount: 300, type: 'income', category: 'Freelance', day: 1, frequency: 'monthly', startDate: t })
    // cartões
    DB.Cards.add({ name: 'Cartão principal', bank: 'Nubank', limit: 3000, closingDay: 10, dueDay: 17 })
    DB.Cards.add({ name: 'Cartão reserva', bank: 'Inter', limit: 1500, closingDay: 5, dueDay: 12 })
    DB.CardPurchases.add({ description: 'Notebook (12x)', amount: 3600, category: 'Outros', cardId: DB.Cards.list()[0].id, installments: { groupId: 'demo', number: 1, total: 12 }, date: m + '-02' })
    DB.CardPurchases.add({ description: 'Restaurante', amount: 120, category: 'Alimentação', cardId: DB.Cards.list()[0].id, date: m + '-13' })
    DB.CardPurchases.add({ description: 'Roupas', amount: 250, category: 'Lazer', cardId: DB.Cards.list()[1].id, date: m + '-09' })
    // orçamento
    DB.Budgets.add({ category: 'Alimentação', month: m, limit: 800 })
    DB.Budgets.add({ category: 'Transporte', month: m, limit: 400 })
    DB.Budgets.add({ category: 'Casa', month: m, limit: 2000 })
    DB.Budgets.add({ category: 'Lazer', month: m, limit: 300 })
    // metas
    DB.Goals.add({ name: 'Comprar notebook', targetAmount: 5000, currentAmount: 2300, deadline: DB.addDays(t, 90), monthlyContribution: 500 })
    DB.Goals.add({ name: 'Reserva de emergência', targetAmount: 12000, currentAmount: 4500, deadline: DB.addDays(t, 365), monthlyContribution: 800 })
    DB.Goals.add({ name: 'Viagem de férias', targetAmount: 4000, currentAmount: 1200, deadline: DB.addDays(t, 180), monthlyContribution: 300 })
    // dívidas
    DB.Debts.add({ creditor: 'Cartão antigo', originalAmount: 800, currentAmount: 650, interestRate: 8, installments: 6, dueDate: DB.addDays(t, 15), status: 'open' })
    // bens
    DB.Assets.add({ name: 'Carro', type: 'Bem', value: 35000 })
    DB.Assets.add({ name: 'Investimentos (CDB)', type: 'Investimento', value: 8000 })
    toast('Dados de demonstração criados ✓', 'success')
    renderCurrent()
    refreshAll()
  }

  // ---------- tema ----------
  function applyTheme() {
    const s = DB.getSettings()
    const theme = s.theme === 'system' ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : s.theme
    document.documentElement.setAttribute('data-theme', theme)
  }

  // ---------- integração após mutações ----------
  function refreshAll() {
    refreshReminders()
    renderNotifBadge()
  }

  // ---------- init ----------
  function init() {
    DB.init()
    applyTheme()
    bindModalEvents()
    bindGlobalClicks()
    setupSW()
    setupLockScreen()
  }

  // ---------- lock screen ----------
  function setupLockScreen() {
    const lockScreen = document.getElementById('lock-screen')
    const pinInput = document.getElementById('pin-input')
    const pinSubmit = document.getElementById('pin-submit')
    const pinError = document.getElementById('pin-error')
    const pinSubtitle = document.getElementById('lock-subtitle')
    const pinSetupToggle = document.getElementById('pin-setup-toggle')

    if (!Crypto.isPinSet()) {
      // Sem PIN configurado — vai direto pro app
      startApp()
      return
    }

    // Mostra tela de lock
    lockScreen.classList.add('active')
    pinSubtitle.textContent = 'Digite seu PIN para desbloquear'
    pinSetupToggle.style.display = 'none'

    async function handlePin() {
      const pin = pinInput.value.trim()
      if (!pin) { pinError.textContent = 'Digite o PIN.'; pinError.style.display = 'block'; return }
      pinError.style.display = 'none'
      pinSubmit.disabled = true
      pinSubmit.textContent = 'Verificando...'
      try {
        const ok = await Storage.unlock(pin)
        if (ok) {
          lockScreen.classList.remove('active')
          startApp()
        } else {
          pinError.textContent = 'PIN incorreto. Tente novamente.'
          pinError.style.display = 'block'
          pinInput.value = ''
          pinInput.focus()
        }
      } catch (e) {
        pinError.textContent = 'Erro ao verificar PIN.'
        pinError.style.display = 'block'
      }
      pinSubmit.disabled = false
      pinSubmit.textContent = 'Desbloquear'
    }

    pinSubmit.addEventListener('click', handlePin)
    pinInput.addEventListener('keydown', e => { if (e.key === 'Enter') handlePin() })
  }

  function startApp() {
    const name = DB.getSettings().name
    $('#user-name').textContent = name || 'Anthony'
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); const s = $('#global-search'); if (s) { s.focus(); s.select() } }
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !$('#modal').classList.contains('open')) showQuickActions()
    })
    // Bind FAB (desktop) and bn-add (mobile) to open quick actions
    const fab = document.getElementById('fab')
    const bnAdd = document.getElementById('bn-add')
    if (fab) fab.addEventListener('click', () => showQuickActions())
    if (bnAdd) bnAdd.addEventListener('click', () => showQuickActions())
    navigate('meu-dia')
    refreshAll()
  }

  return {
    init, navigate, renderCurrent, toast, refreshReminders, seedDemoData, renderNotifBadge,
    handleAction, openEventForm, openTaskForm, openHabitForm, openTxnForm, openRecurringForm, openGoalForm,
    showQuickActions, applyTheme
  }
})()

if (typeof module !== 'undefined' && module.exports) module.exports = { App }

document.addEventListener('DOMContentLoaded', () => { App.init() })