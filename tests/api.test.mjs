import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Store } from '../src/store.mjs'
import { createApp } from '../src/app.mjs'

let server, base, dir
const TOKEN = 'test-token'
const today = new Date().toISOString().slice(0, 10)

async function api(method, path, body, { auth = true } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${TOKEN}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'paincave-'))
  server = createServer(createApp({ store: new Store(join(dir, 'data.json')), token: TOKEN }))
  await new Promise((r) => server.listen(0, r))
  base = `http://127.0.0.1:${server.address().port}`
})
after(() => {
  server.close()
  rmSync(dir, { recursive: true, force: true })
})

test('health is open, everything else needs the token', async () => {
  assert.equal((await api('GET', '/api/health', null, { auth: false })).status, 200)
  assert.equal((await api('GET', '/api/gyms', null, { auth: false })).status, 401)
})

test('reference data', async () => {
  const gyms = (await api('GET', '/api/gyms')).body
  assert.deepEqual(gyms.map((g) => g.id).sort(), ['planet-fitness', 'ymca'])
  const pf = (await api('GET', '/api/gyms/planet-fitness')).body
  assert.equal(pf.equipment.find((e) => e.id === 'lap_pool').available, false)
  const pfEx = (await api('GET', '/api/exercises?gym=planet-fitness')).body
  assert.ok(!pfEx.some((e) => e.id === 'barbell_back_squat'))
  assert.equal((await api('GET', '/api/exercises/nope')).status, 404)
})

test('program needs a profile, then works end to end', async () => {
  assert.equal((await api('GET', '/api/today')).status, 409)
  assert.equal((await api('PUT', '/api/profile', { daysPerWeek: 9 })).status, 400)
  const p = await api('PUT', '/api/profile', { name: 'Me', sex: 'male', age: 38, heightIn: 70, weightLb: 210, goalWeightLb: 185, startDate: today, daysPerWeek: 5 })
  assert.equal(p.status, 200)
  assert.deepEqual(p.body.gyms, ['planet-fitness', 'ymca'])

  const prog = (await api('GET', '/api/program')).body
  assert.equal(prog.progress.length, 12)
  assert.equal(prog.now.status, 'active')
  const week1 = (await api('GET', '/api/program/weeks/1')).body
  assert.equal(week1.days.length, 7)
  assert.equal((await api('GET', '/api/program/weeks/13')).status, 400)

  const t = (await api('GET', '/api/today')).body
  assert.equal(t.status, 'active')
  assert.ok(t.sessionKey.startsWith('w1d'))

  const lower = (await api('GET', '/api/sessions/lower?week=1')).body
  const squat = lower.exercises[0]
  const logged = await api('POST', '/api/workouts', {
    date: today, sessionKey: 'w1d0', type: 'lower',
    exercises: [{ exerciseId: squat.exerciseId, sets: [{ reps: 12, weight: 95 }, { reps: 12, weight: 95 }, { reps: 12, weight: 95 }] }],
  })
  assert.equal(logged.status, 201)
  const next = (await api('GET', '/api/sessions/lower?week=2')).body
  assert.equal(next.exercises[0].suggestion.weight, 100)
  const hist = (await api('GET', `/api/exercises/${squat.exerciseId}/history`)).body
  assert.equal(hist[0].topWeight, 95)
  // One lift logged: the day is not done yet
  assert.equal((await api('GET', '/api/program/weeks/1')).body.days[0].completed, false)
  for (const e of lower.exercises.slice(1)) {
    await api('POST', '/api/workouts', { date: today, sessionKey: 'w1d0', type: 'lower', exercises: [{ exerciseId: e.exerciseId, slot: e.slot, sets: [{ reps: 10, weight: 20 }] }] })
  }
  assert.equal((await api('GET', '/api/program/weeks/1')).body.days[0].completed, true)

  const lifts = (await api('GET', '/api/stats/lifts')).body
  assert.equal(lifts.streakWeeks, 1)
  assert.equal(lifts.lifts.find((l) => l.exerciseId === squat.exerciseId).pr, 95)
  assert.ok(lifts.weekVolume >= 95 * 36)
  const entries = (await api('GET', `/api/exercises/${squat.exerciseId}/entries`)).body
  assert.equal(entries[0].isPr, true)
  assert.equal(entries[0].setCount, 3)
})

test('swim tracking: log, edit, stats, CSS', async () => {
  const bad = await api('POST', '/api/swims', { date: today })
  assert.equal(bad.status, 400)
  const s = await api('POST', '/api/swims', { date: today, poolLength: 25, poolUnit: 'yd', lengths: 40, duration: '22:00', strokesPerLength: 17, type: 'endurance', rpe: 6 })
  assert.equal(s.status, 201)
  assert.equal(s.body.metrics.distanceYards, 1000)
  assert.equal(s.body.metrics.pacePer100Text, '2:12 /100yd')

  const upd = await api('PUT', `/api/swims/${s.body.id}`, { ...s.body, lengths: 44 })
  assert.equal(upd.body.distance, 1100)

  const css = await api('POST', '/api/swims/css-test', { date: today, t400: '8:00', t200: '3:40' })
  assert.equal(css.status, 201)
  assert.equal(css.body.css.per100, 130)

  const stats = (await api('GET', '/api/swims/stats')).body
  assert.equal(stats.sessions, 2)
  assert.equal(stats.css.per100, 130)
  assert.equal(stats.thisWeek.sessions, 2)

  // CSS now drives endurance targets: 130 + 6 s = 2:16 per 100 in the base phase
  const end = (await api('GET', '/api/sessions/swim_endurance?week=2')).body
  assert.match(end.swim.blocks[1].sets[0].target, /2:16/)

  assert.equal((await api('DELETE', `/api/swims/${s.body.id}`)).status, 204)
  assert.equal((await api('GET', `/api/swims/${s.body.id}`)).status, 404)
})

test('hikes, body, nutrition, dashboard, export', async () => {
  assert.equal((await api('POST', '/api/hikes', { date: today, distanceMi: 6.2, elevationGainFt: 1800, durationMin: 160, packLb: 15, trail: 'Ridge loop' })).status, 201)
  assert.equal((await api('GET', '/api/hikes/stats')).body.totalElevationFt, 1800)

  await api('POST', '/api/body', { date: '2026-01-01', weightLb: 212, waistIn: 40 })
  await api('POST', '/api/body', { date: '2026-02-01', weightLb: 205, waistIn: 38.5 })
  const body = (await api('GET', '/api/body/stats')).body
  assert.equal(body.waist.change, -1.5)
  assert.equal(body.waistToHeight, 0.55)
  assert.equal(body.waistTargetIn, 35)

  const n = (await api('GET', '/api/nutrition')).body
  assert.ok(n.ready && n.calories < n.maintenanceCalories)
  assert.equal(n.macros.proteinG, 150)

  const d = (await api('GET', '/api/dashboard')).body
  assert.ok(d.today && d.week && d.swim && d.nutrition.ready)

  const exp = (await api('GET', '/api/export')).body
  assert.equal(exp.hikes.length, 1)
  // data is on disk
  const disk = JSON.parse(readFileSync(join(dir, 'data.json'), 'utf8'))
  assert.equal(disk.body.length, 2)
})

test('unknown routes and methods', async () => {
  assert.equal((await api('GET', '/api/nope')).status, 404)
  assert.equal((await api('PATCH', '/api/swims')).status, 405)
})

test('serves the app shell and falls back to it for unknown pages', async () => {
  const { createServer } = await import('node:http')
  const { fileURLToPath } = await import('node:url')
  const publicDir = fileURLToPath(new URL('../public', import.meta.url))
  const srv = createServer(createApp({ store: new Store(null), publicDir }))
  await new Promise((r) => srv.listen(0, r))
  const at = `http://127.0.0.1:${srv.address().port}`
  try {
    const home = await fetch(at + '/')
    assert.equal(home.status, 200)
    assert.match(await home.text(), /The PainCave/)
    assert.match((await fetch(at + '/app.js')).headers.get('content-type'), /javascript/)
    assert.match(await (await fetch(at + '/plan')).text(), /The PainCave/)
    assert.equal((await fetch(at + '/api/nope')).status, 404)
  } finally {
    srv.close()
  }
})
