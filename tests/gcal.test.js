'use strict'
const test = require('node:test')
const assert = require('node:assert')
const { loadApp } = require('./helpers/load-app.js')

function fresh() {
  const s = loadApp({ GCAL_CONFIG: { clientId: 'test.apps.googleusercontent.com' } })
  s.DB.init()
  return s
}

test('buildDateTime: com hora monta dateTime + timeZone', () => {
  const s = fresh()
  const r = s.GCAL.buildDateTime('2026-08-20', '09:30')
  assert.ok(r.dateTime === '2026-08-20T09:30:00')
  assert.ok(typeof r.timeZone === 'string' && r.timeZone.length > 0)
})

test('buildDateTime: sem hora → dia inteiro (all-day)', () => {
  const s = fresh()
  const r = s.GCAL.buildDateTime('2026-08-20', '')
  assert.strictEqual(r.date, '2026-08-20')
  assert.strictEqual(r.dateTime, undefined)
})

test('buildDateTime: data inválida → null; hora mal formatada → fallback all-day', () => {
  const s = fresh()
  assert.strictEqual(s.GCAL.buildDateTime('', '10:00'), null)
  assert.strictEqual(s.GCAL.buildDateTime('20/08/2026', '10:00'), null)
  const r1 = s.GCAL.buildDateTime('2026-08-20', '9:30') // sem zero à esquerda → fallback all-day
  assert.strictEqual(r1.date, '2026-08-20')
  const r2 = s.GCAL.buildDateTime('2026-08-20', 'xx:yy')
  assert.strictEqual(r2.date, '2026-08-20')
  assert.strictEqual(r2.dateTime, undefined)
})

test('toGCalEvent: mapeia campos do app para a Calendar API', () => {
  const s = fresh()
  const ev = { id: 'evt1', title: 'Reunião', date: '2026-08-20', startTime: '10:00', endTime: '11:00', description: 'Planejamento', observations: 'Levar relatório', location: 'Escritório', category: 'Trabalho', priority: 'alta' }
  const g = s.GCAL.toGCalEvent(ev)
  assert.strictEqual(g.summary, 'Reunião')
  assert.strictEqual(g.start.dateTime, '2026-08-20T10:00:00')
  assert.strictEqual(g.end.dateTime, '2026-08-20T11:00:00')
  assert.strictEqual(g.location, 'Escritório')
  assert.ok(g.description.includes('Planejamento') && g.description.includes('Levar relatório'))
  assert.strictEqual(g.extendedProperties.private.loId, 'evt1')
  assert.strictEqual(g.extendedProperties.private.loCategory, 'Trabalho')
})

test('toGCalEvent: com gcalEventId inclui id (update); sem hora → all-day', () => {
  const s = fresh()
  const ev = { id: 'evt2', title: 'Aniversário', date: '2026-08-25', gcalEventId: 'abc123' }
  const g = s.GCAL.toGCalEvent(ev)
  assert.strictEqual(g.id, 'abc123')
  assert.strictEqual(g.start.date, '2026-08-25')
  assert.strictEqual(g.start.dateTime, undefined)
})

test('toGCalEvent: evento inválido → null', () => {
  const s = fresh()
  assert.strictEqual(s.GCAL.toGCalEvent(null), null)
  assert.strictEqual(s.GCAL.toGCalEvent({ title: '' }), null)
  assert.strictEqual(s.GCAL.toGCalEvent({ title: 'X', date: 'invalida' }), null)
})

test('fromGCalEvent: com dateTime extrai data e horas + loId', () => {
  const s = fresh()
  const g = {
    id: 'g1',
    summary: 'Consulta',
    start: { dateTime: '2026-08-21T15:30:00-03:00' },
    end: { dateTime: '2026-08-21T16:00:00-03:00' },
    location: 'Hospital',
    description: 'Rotina\nObservações extra',
    extendedProperties: { private: { loId: 'evt9', loCategory: 'Saúde', loPriority: 'alta' } }
  }
  const m = s.GCAL.fromGCalEvent(g)
  assert.strictEqual(m.id, 'g1')
  assert.strictEqual(m.title, 'Consulta')
  assert.strictEqual(m.date, '2026-08-21')
  assert.strictEqual(m.startTime, '15:30')
  assert.strictEqual(m.endTime, '16:00')
  assert.strictEqual(m.location, 'Hospital')
  assert.strictEqual(m.loId, 'evt9')
  assert.strictEqual(m.loCategory, 'Saúde')
})

test('fromGCalEvent: all-day e sem extendedProperties', () => {
  const s = fresh()
  const m = s.GCAL.fromGCalEvent({ id: 'g2', summary: 'Feriado', start: { date: '2026-09-07' } })
  assert.strictEqual(m.date, '2026-09-07')
  assert.strictEqual(m.startTime, '')
  assert.strictEqual(m.loId, '')
  assert.strictEqual(m.loCategory, 'Outros')
})

test('fromGCalEvent: sem id → null', () => {
  const s = fresh()
  assert.strictEqual(s.GCAL.fromGCalEvent(null), null)
  assert.strictEqual(s.GCAL.fromGCalEvent({ summary: 'x' }), null)
})

test('needsSync: nunca enviado → true', () => {
  const s = fresh()
  assert.strictEqual(s.GCAL.needsSync({ id: 'a', title: 'X', date: '2026-08-20' }), true)
})

test('needsSync: sincronizado e sem mudanças → false', () => {
  const s = fresh()
  const ev = { id: 'a', title: 'X', date: '2026-08-20', gcalEventId: 'g1', gcalSyncedAt: '2026-08-20T10:00:00.000Z', updatedAt: '2026-08-20T09:00:00.000Z' }
  assert.strictEqual(s.GCAL.needsSync(ev), false)
})

test('needsSync: mudou depois da sync → true', () => {
  const s = fresh()
  const ev = { id: 'a', title: 'X', date: '2026-08-20', gcalEventId: 'g1', gcalSyncedAt: '2026-08-20T10:00:00.000Z', updatedAt: '2026-08-20T11:00:00.000Z' }
  assert.strictEqual(s.GCAL.needsSync(ev), true)
})

test('needsSync: evento inválido → false', () => {
  const s = fresh()
  assert.strictEqual(s.GCAL.needsSync(null), false)
  assert.strictEqual(s.GCAL.needsSync({ title: '' }), false)
})

test('dateDaysAgoStr: formato YYYY-MM-DD', () => {
  const s = fresh()
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(s.GCAL.dateDaysAgoStr(30)))
})

test('isConfigured: com clientId → true; sem → false', () => {
  const s = fresh()
  assert.strictEqual(s.GCAL.isConfigured(), true)
  const s2 = loadApp({ GCAL_CONFIG: { clientId: '' } })
  assert.strictEqual(s2.GCAL.isConfigured(), false)
})

test('syncOut: sem eventos → contadores zerados e lastSync gravado', async () => {
  const s = fresh()
  s.GCAL.settings = () => ({ autoSync: false, lastSync: null, lastResult: null })
  const out = await s.GCAL.syncOut([])
  assert.strictEqual(out.sent, 0)
  assert.strictEqual(out.updated, 0)
  assert.ok(s.Storage.get('gcal').lastSync)
})

test('syncOut: eventos antigos (fora do horizonte) são ignorados', async () => {
  const s = fresh()
  s.DB.Events.add({ title: 'Antigo', date: '2026-01-01', startTime: '10:00' })
  const out = await s.GCAL.syncOut(s.DB.Events.list())
  assert.strictEqual(out.sent, 0)
  assert.strictEqual(out.errors.length, 0)
})

test('deleteRemote: evento sem gcalEventId → skipped', async () => {
  const s = fresh()
  const r = await s.GCAL.deleteRemote({ id: 'a', title: 'X', date: '2026-08-20' })
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.skipped, true)
})