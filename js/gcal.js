/* LIFE ORGANIZER — Google Agenda (Google Calendar API v3 via Google Identity Services)
 * Integração 100% client-side: o usuário autoriza com a conta Google dele (OAuth 2.0),
 * o token fica no navegador e os eventos são sincronizados bidirecionalmente.
 * Sem backend: tudo roda no browser (CORS suportado pela Calendar API).
 * Escopo mínimo: https://www.googleapis.com/auth/calendar.events (só eventos do calendário principal).
 */
'use strict'

const GCAL = (() => {
  const SCOPE = 'https://www.googleapis.com/auth/calendar.events'
  const CAL_BASE = 'https://www.googleapis.com/calendar/v3'
  const CAL_ID = 'primary'
  const SDK_URL = 'https://accounts.google.com/gsi/client'
  const SYNC_HORIZON_DAYS = 30 // eventos a partir de hoje-30d são enviados; o resto é ignorado

  let sdkLoaded = false
  let sdkLoading = null
  let tokenClient = null
  let tokenPromise = null
  let accessToken = ''
  let tokenExpiresAt = 0
  let profile = null

  // ---------- helpers ----------
  function cfg() { return (typeof GCAL_CONFIG !== 'undefined' && GCAL_CONFIG && GCAL_CONFIG.clientId) ? GCAL_CONFIG : null }
  function isConfigured() { return !!(cfg() && cfg().clientId) }
  function settings() { return Object.assign({ autoSync: false, lastSync: null, lastResult: null }, Storage.get('gcal', {})) }
  function saveSettings(patch) { const s = Object.assign({}, settings(), patch); Storage.set('gcal', s); return s }
  function isAuthed() { return !!accessToken && Date.now() < tokenExpiresAt - 30000 }
  function nowISO() { return new Date().toISOString() }
  function dateDaysAgoStr(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }

  // ---------- funções puras (testáveis em Node) ----------
  // Monta start/end do Google Calendar a partir de 'YYYY-MM-DD' + 'HH:MM'.
  // Sem hora → evento de dia inteiro ({date}); data inválida → null.
  function buildDateTime(dateStr, timeStr) {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
    if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return { date: dateStr }
    return { dateTime: dateStr + 'T' + timeStr + ':00', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
  }

  // Converte evento do app → payload da Calendar API. Se o evento já tem gcalEventId,
  // o mesmo id é usado (update). Guarda o id interno em extendedProperties (round-trip).
  function toGCalEvent(ev) {
    if (!ev || !ev.title || !ev.date) return null
    const start = buildDateTime(ev.date, ev.startTime)
    if (!start) return null
    const end = buildDateTime(ev.date, ev.endTime) || start
    const g = {
      summary: ev.title.slice(0, 200),
      start: start,
      end: end,
      description: [ev.description, ev.observations].filter(Boolean).join('\n').slice(0, 8000),
      extendedProperties: { private: { loId: ev.id || '', loCategory: ev.category || '', loPriority: ev.priority || '' } }
    }
    if (ev.gcalEventId) g.id = ev.gcalEventId
    if (ev.location) g.location = ev.location.slice(0, 200)
    return g
  }

  // Converte evento da Calendar API → dados do app. Extrai o id interno (loId) se existir.
  function fromGCalEvent(g) {
    if (!g || !g.id) return null
    const priv = (g.extendedProperties && g.extendedProperties.private) || {}
    const dt = (g.start && (g.start.dateTime || g.start.date)) || ''
    const dtEnd = (g.end && (g.end.dateTime || g.end.date)) || ''
    return {
      id: g.id,
      title: (g.summary || '').slice(0, 200),
      date: dt.slice(0, 10),
      startTime: (g.start && g.start.dateTime) ? dt.slice(11, 16) : '',
      endTime: (g.end && g.end.dateTime) ? dtEnd.slice(11, 16) : '',
      description: ((g.description || '').split('\n')[0]).slice(0, 2000),
      location: (g.location || '').slice(0, 200),
      loId: priv.loId || '',
      loCategory: priv.loCategory || 'Outros',
      loPriority: priv.loPriority || 'media'
    }
  }

  // Precisa reenviar? Sim se nunca foi enviado OU se mudou depois da última sync.
  function needsSync(ev) {
    return !!(ev && ev.title && ev.date && (!ev.gcalEventId || !ev.gcalSyncedAt || (ev.updatedAt || '') > ev.gcalSyncedAt))
  }

  // ---------- SDK + OAuth ----------
  function loadSDK() {
    if (sdkLoaded) return Promise.resolve()
    if (sdkLoading) return sdkLoading
    if (typeof window === 'undefined' || typeof document === 'undefined') return Promise.reject(new Error('Ambiente sem DOM.'))
    sdkLoading = new Promise((resolve, reject) => {
      if (window.google && window.google.accounts) { sdkLoaded = true; resolve(); return }
      const s = document.createElement('script')
      s.src = SDK_URL
      s.async = true
      s.onload = () => { sdkLoaded = true; resolve() }
      s.onerror = () => { sdkLoading = null; reject(new Error('Falha ao carregar o SDK do Google.')) }
      document.head.appendChild(s)
    })
    return sdkLoading
  }

  // Obtém access token válido (pede autorização ao usuário na 1ª vez / quando expira).
  function getToken() {
    if (isAuthed()) return Promise.resolve(accessToken)
    if (tokenPromise) return tokenPromise
    if (!isConfigured()) return Promise.reject(new Error('Google Agenda não configurado. Preencha o Client ID.'))
    tokenPromise = new Promise((resolve, reject) => {
      loadSDK().then(() => {
        if (!tokenClient) {
          tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: cfg().clientId,
            scope: SCOPE,
            callback: resp => {
              tokenPromise = null
              if (resp && resp.access_token) {
                accessToken = resp.access_token
                tokenExpiresAt = Date.now() + (resp.expires_in || 3600) * 1000
                resolve(accessToken)
              } else {
                reject(new Error((resp && resp.error_description) ? resp.error_description : 'Autorização cancelada.'))
              }
            }
          })
        }
        tokenClient.requestAccessToken()
      }).catch(err => { tokenPromise = null; reject(err) })
    })
    return tokenPromise
  }

  function signOut() {
    return new Promise(resolve => {
      if (accessToken && typeof window !== 'undefined' && window.google && window.google.accounts && window.google.accounts.oauth2) {
        try { window.google.accounts.oauth2.revoke(accessToken, () => {}) } catch (e) { /* ignore */ }
      }
      accessToken = ''
      tokenExpiresAt = 0
      tokenClient = null
      tokenPromise = null
      profile = null
      resolve()
    })
  }

  function getProfile() {
    if (profile) return Promise.resolve(profile)
    return getToken().then(token =>
      fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token))
        .then(r => r.json())
        .then(j => {
          profile = { email: j.email || 'conta Google', name: j.email ? j.email.split('@')[0] : 'usuário' }
          if (j.email) saveSettings({ lastEmail: j.email })
          return profile
        })
    )
  }

  // ---------- Calendar API ----------
  function api(method, path, body) {
    return getToken().then(token =>
      fetch(CAL_BASE + path, {
        method: method,
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      }).then(res => {
        if (res.status === 401) { accessToken = ''; tokenExpiresAt = 0; throw new Error('Sessão expirada. Reconecte e tente novamente.') }
        if (!res.ok) {
          return res.json().catch(() => ({})).then(j => { throw new Error((j.error && j.error.message) || ('Erro ' + res.status)) })
        }
        return res.status === 204 ? null : res.json()
      })
    )
  }

  function eventPath(id) { return '/calendars/' + CAL_ID + '/events/' + encodeURIComponent(id) }

  // ---------- sync ----------
  // Envia eventos do app para o Google (cria novos, atualiza os que já existem).
  // Só envia eventos a partir de hoje-30d (horizonte) ou que já foram sincronizados antes.
  async function syncOut(events) {
    const cutoff = dateDaysAgoStr(SYNC_HORIZON_DAYS)
    const candidates = (Array.isArray(events) ? events : [])
      .filter(ev => ev && ev.title && ev.date && (ev.gcalEventId || ev.date >= cutoff))
    const out = { sent: 0, updated: 0, skipped: 0, errors: [] }
    for (const ev of candidates) {
      try {
        const payload = toGCalEvent(ev)
        let res
        if (ev.gcalEventId) {
          try { res = await api('PATCH', eventPath(ev.gcalEventId), payload) }
          catch (e) {
            // sumiu do Google (apagado lá fora) → recria
            if (String(e.message).indexOf('404') >= 0) { res = await api('POST', eventPath(''), payload) }
            else throw e
          }
          out.updated++
        } else {
          res = await api('POST', eventPath(''), payload)
          out.sent++
        }
        if (res && res.id) DB.Events.update(ev.id, { gcalEventId: res.id, gcalSyncedAt: nowISO() })
      } catch (e) { out.errors.push(ev.title + ': ' + e.message) }
    }
    saveSettings({ lastSync: nowISO(), lastResult: out })
    return out
  }

  // Importa/atualiza eventos do Google no app (round-trip):
  // - eventos com loId → atualiza o local com o que foi editado no Google;
  // - eventos sem loId → cria um evento local novo (importado).
  async function syncIn() {
    const out = { imported: 0, updated: 0, skipped: 0, errors: [] }
    const timeMin = new Date(); timeMin.setDate(timeMin.getDate() - SYNC_HORIZON_DAYS)
    const params = 'timeMin=' + encodeURIComponent(timeMin.toISOString()) + '&maxResults=250&singleEvents=true&orderBy=startTime&fields=items(id,summary,start,end,location,description,extendedProperties)'
    let items = []
    try { const data = await api('GET', '/calendars/' + CAL_ID + '/events?' + params); items = data.items || [] }
    catch (e) { out.errors.push(e.message); saveSettings({ lastSync: nowISO(), lastResult: out }); return out }
    const byRemote = new Map(DB.Events.list().filter(e => e.gcalEventId).map(e => [e.gcalEventId, e]))
    for (const g of items) {
      try {
        const m = fromGCalEvent(g)
        if (!m || !m.title || !m.date) { out.skipped++; continue }
        const local = byRemote.get(g.id)
        const synced = nowISO()
        if (local) {
          const patch = { title: m.title, date: m.date, startTime: m.startTime, endTime: m.endTime, gcalSyncedAt: synced }
          if (m.location) patch.location = m.location
          if (m.description) patch.description = m.description
          DB.Events.update(local.id, patch)
          out.updated++
        } else {
          DB.Events.add({
            title: m.title, date: m.date, startTime: m.startTime, endTime: m.endTime,
            description: m.description, location: m.location, category: m.loCategory,
            priority: m.loPriority, gcalEventId: g.id, gcalSyncedAt: synced, gcalImported: true
          })
          out.imported++
        }
      } catch (e) { out.errors.push((g.summary || '?') + ': ' + e.message) }
    }
    saveSettings({ lastSync: nowISO(), lastResult: out })
    return out
  }

  // Apaga o evento no Google (fire-and-forget pelo app ao excluir localmente).
  async function deleteRemote(ev) {
    if (!ev || !ev.gcalEventId) return { ok: true, skipped: true }
    try { await api('DELETE', eventPath(ev.gcalEventId)); return { ok: true } }
    catch (e) { return { ok: false, error: e.message } }
  }

  return {
    SCOPE, isConfigured, isAuthed, settings, saveSettings, getToken, signOut, getProfile,
    syncOut, syncIn, deleteRemote, loadSDK,
    buildDateTime, toGCalEvent, fromGCalEvent, needsSync, dateDaysAgoStr
  }
})()

if (typeof module !== 'undefined' && module.exports) module.exports = { GCAL }