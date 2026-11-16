// PainCave HTTP API. Plain node:http, no dependencies. createApp() returns a request handler so tests can drive it
// without opening a port. Every response is JSON; errors are { error: "message" } with a 4xx/5xx status.

import { readFile, stat } from 'node:fs/promises'
import { join, normalize, extname } from 'node:path'
import { timingSafeEqual } from 'node:crypto'
import { EQUIPMENT, GYMS, availableAt } from './catalog/equipment.mjs'
import { EXERCISES, SLOTS } from './catalog/exercises.mjs'
import { programOverview, weekPlan, buildSession, locate, PROGRAM_WEEKS, SESSION_INFO } from './program.mjs'
import { normalizeSwim, swimMetrics, swimStats, criticalSwimSpeed, formatTime } from './swim.mjs'
import { nutritionTargets, bodyStats } from './nutrition.mjs'

export const VERSION = '0.1.0'

// Local date (not UTC), so an evening workout in the US is not logged as tomorrow.
const today = () => new Date().toLocaleDateString('en-CA')
const DATE = /^\d{4}-\d{2}-\d{2}$/

function httpError(status, message) {
  return Object.assign(new Error(message), { status })
}

// ── Validation ──────────────────────────────────────────────────────────────────────────────────────────

const PROFILE_DEFAULTS = {
  name: 'Athlete',
  gyms: ['planet-fitness', 'ymca'],
  daysPerWeek: 5,
  poolLength: 25,
  poolUnit: 'yd',
  reportUnit: 'yd',
  equipmentOverrides: {},
  preferredGym: {},
  units: 'lbs',
  weightStep: 5,
}

export function normalizeProfile(input, existing = null) {
  const p = { ...PROFILE_DEFAULTS, ...(existing ?? {}), ...input }
  const errs = []
  if (!Array.isArray(p.gyms) || !p.gyms.length || p.gyms.some((g) => !GYMS[g])) errs.push(`gyms must be a non-empty list of: ${Object.keys(GYMS).join(', ')}`)
  p.daysPerWeek = Number(p.daysPerWeek)
  if (![3, 4, 5, 6].includes(p.daysPerWeek)) errs.push('daysPerWeek must be 3, 4, 5 or 6')
  p.startDate = p.startDate ?? today()
  if (!DATE.test(p.startDate)) errs.push('startDate must be YYYY-MM-DD')
  if (!['yd', 'm'].includes(p.poolUnit)) errs.push('poolUnit must be "yd" or "m"')
  if (!['yd', 'm'].includes(p.reportUnit)) errs.push('reportUnit must be "yd" or "m"')
  p.poolLength = Number(p.poolLength)
  if (!(p.poolLength > 0)) errs.push('poolLength must be positive')
  for (const k of ['age', 'heightIn', 'weightLb', 'goalWeightLb']) {
    if (p[k] != null) {
      p[k] = Number(p[k])
      if (!(p[k] > 0)) errs.push(`${k} must be positive`)
    }
  }
  if (!['lbs', 'kg'].includes(p.units)) errs.push('units must be "lbs" or "kg"')
  p.weightStep = Number(p.weightStep)
  if (![1, 2.5, 5, 10].includes(p.weightStep)) errs.push('weightStep must be 1, 2.5, 5 or 10')
  if (p.sex != null && !['male', 'female'].includes(p.sex)) errs.push('sex must be "male" or "female" (used only for calorie estimates)')
  for (const [gym, map] of Object.entries(p.equipmentOverrides ?? {})) {
    if (!GYMS[gym]) errs.push(`equipmentOverrides: unknown gym ${gym}`)
    for (const id of Object.keys(map ?? {})) if (!EQUIPMENT[id]) errs.push(`equipmentOverrides.${gym}: unknown equipment ${id}`)
  }
  if (errs.length) throw httpError(400, errs.join('; '))
  return p
}

function normalizeWorkout(w) {
  const errs = []
  if (!DATE.test(w.date ?? '')) errs.push('date must be YYYY-MM-DD')
  if (w.type && !SESSION_INFO[w.type]) errs.push(`type must be one of ${Object.keys(SESSION_INFO).join(', ')}`)
  const exercises = (w.exercises ?? []).map((e, i) => {
    if (!EXERCISES[e.exerciseId] && !e.name) errs.push(`exercises[${i}]: unknown exerciseId and no name`)
    const sets = (e.sets ?? []).map((s) => ({
      reps: s.reps != null ? Number(s.reps) : null,
      weight: s.weight != null ? Number(s.weight) : null,
      seconds: s.seconds != null ? Number(s.seconds) : null,
      rpe: s.rpe != null ? Number(s.rpe) : null,
    }))
    if (!sets.length) errs.push(`exercises[${i}] needs at least one set`)
    if (e.slot != null && !SLOTS[e.slot]) errs.push(`exercises[${i}]: unknown slot ${e.slot}`)
    return { exerciseId: e.exerciseId ?? null, slot: e.slot ?? null, name: e.name ?? EXERCISES[e.exerciseId]?.name, sets, note: e.note }
  })
  if (errs.length) throw httpError(400, errs.join('; '))
  return { date: w.date, sessionKey: w.sessionKey ?? null, type: w.type ?? null, gymId: w.gymId ?? null, durationMin: w.durationMin != null ? Number(w.durationMin) : null, rpe: w.rpe != null ? Number(w.rpe) : null, exercises, cardio: w.cardio ?? null, notes: w.notes ?? '' }
}

function normalizeHike(h) {
  const errs = []
  if (!DATE.test(h.date ?? '')) errs.push('date must be YYYY-MM-DD')
  const out = { date: h.date, sessionKey: h.sessionKey ?? null, trail: h.trail ?? '', indoor: !!h.indoor, notes: h.notes ?? '' }
  for (const k of ['distanceMi', 'elevationGainFt', 'durationMin', 'packLb', 'rpe']) {
    out[k] = h[k] != null ? Number(h[k]) : null
    if (out[k] != null && !(out[k] >= 0)) errs.push(`${k} must be a number >= 0`)
  }
  if (out.durationMin == null && out.distanceMi == null) errs.push('give durationMin or distanceMi')
  if (errs.length) throw httpError(400, errs.join('; '))
  return out
}

function normalizeBody(b) {
  if (!DATE.test(b.date ?? '')) throw httpError(400, 'date must be YYYY-MM-DD')
  const out = { date: b.date, notes: b.notes ?? '' }
  for (const k of ['weightLb', 'waistIn', 'bodyFatPct', 'restingHr']) out[k] = b[k] != null ? Number(b[k]) : null
  if (['weightLb', 'waistIn', 'bodyFatPct', 'restingHr'].every((k) => out[k] == null)) throw httpError(400, 'give at least one of weightLb, waistIn, bodyFatPct, restingHr')
  return out
}

function hikeStats(hikes) {
  const out = hikes.filter((h) => !h.indoor)
  const sum = (xs, k) => Math.round(xs.reduce((a, x) => a + (x[k] ?? 0), 0) * 10) / 10
  const max = (k) => (hikes.length ? hikes.reduce((b, x) => ((x[k] ?? 0) > (b[k] ?? 0) ? x : b)) : null)
  return {
    hikes: hikes.length,
    outdoor: out.length,
    totalMiles: sum(hikes, 'distanceMi'),
    totalElevationFt: sum(hikes, 'elevationGainFt'),
    totalMinutes: sum(hikes, 'durationMin'),
    longest: max('durationMin') && { date: max('durationMin').date, durationMin: max('durationMin').durationMin, id: max('durationMin').id },
    mostClimbing: max('elevationGainFt') && { date: max('elevationGainFt').date, elevationGainFt: max('elevationGainFt').elevationGainFt, id: max('elevationGainFt').id },
    heaviestPackLb: hikes.length ? Math.max(...hikes.map((h) => h.packLb ?? 0)) : 0,
  }
}

// ── Helpers that combine data ───────────────────────────────────────────────────────────────────────────

function requireProfile(store) {
  const p = store.getProfile()
  if (!p) throw httpError(409, 'Set up your profile first: PUT /api/profile')
  return p
}

function ctxFor(store, profile) {
  // CSS is measured in the pool unit it was swum in; only use it if it matches today's pool.
  const test = store.list('swims').find((s) => s.type === 'css_test' && s.cssPer100)
  return { history: store.list('workouts'), cssPer100: test && test.unit === profile.poolUnit ? test.cssPer100 : null }
}

const slotsOf = (x) => (x.slot ? [x.slot] : Object.keys(SLOTS).filter((s) => SLOTS[s].includes(x.exerciseId)))

/**
 * Which program days are done. A lifting day is done once every slot in it has a logged exercise (the planned one
 * or a swap); any other day is done once anything is logged against its sessionKey.
 */
function tracker(store) {
  const by = new Map()
  const entry = (k) => by.get(k) ?? (by.set(k, { slots: new Set() }), by.get(k))
  for (const w of store.list('workouts')) if (w.sessionKey) for (const x of w.exercises) for (const s of slotsOf(x)) entry(w.sessionKey).slots.add(s)
  for (const c of ['workouts', 'swims', 'hikes']) for (const x of store.list(c)) if (x.sessionKey) entry(x.sessionKey)
  return {
    done(day) {
      const e = by.get(day.sessionKey)
      if (!e || day.session.type === 'rest') return false
      const ex = day.session.exercises
      return ex?.length ? ex.every((x) => e.slots.has(x.slot)) : true
    },
    loggedSlots: (key) => [...(by.get(key)?.slots ?? [])],
  }
}

/** Every logged set of one exercise in time order, each marked isPr when it beat the previous best weight. */
function liftEntries(store, exerciseId) {
  const rows = store.list('workouts')
    .flatMap((w) => w.exercises.filter((e) => e.exerciseId === exerciseId).map((e) => ({ date: w.date, createdAt: w.createdAt, workoutId: w.id, sessionKey: w.sessionKey, slot: e.slot, sets: e.sets })))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
  let best = 0
  return rows.map((r) => {
    const top = Math.max(0, ...r.sets.map((s) => s.weight ?? 0))
    const isPr = top > best && top > 0
    if (isPr) best = top
    const reps = r.sets.find((s) => s.weight === top)?.reps ?? r.sets[0]?.reps ?? null
    return { ...r, weight: top, reps, setCount: r.sets.length, isPr }
  })
}

function mondayOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

function liftStats(store, date) {
  const ids = [...new Set(store.list('workouts').flatMap((w) => w.exercises.map((e) => e.exerciseId)).filter(Boolean))]
  const lifts = ids.map((id) => {
    const rows = liftEntries(store, id)
    const byDate = new Map()
    for (const r of rows) byDate.set(r.date, Math.max(byDate.get(r.date) ?? 0, r.weight))
    const sessions = [...byDate].map(([d, weight]) => ({ date: d, weight }))
    const pr = rows.reduce((b, r) => (r.weight > (b?.weight ?? 0) ? r : b), null)
    return { exerciseId: id, name: EXERCISES[id]?.name ?? rows[0]?.name ?? id, pr: pr?.weight ?? 0, prDate: pr?.date ?? null, last: rows.at(-1) ?? null, sessions }
  }).sort((a, b) => (b.last?.date ?? '').localeCompare(a.last?.date ?? ''))

  const thisWeek = mondayOf(date)
  const weekVolume = store.list('workouts', { from: thisWeek, to: date })
    .reduce((a, w) => a + w.exercises.reduce((x, e) => x + e.sets.reduce((y, s) => y + (s.weight ?? 0) * (s.reps ?? 0), 0), 0), 0)
  const active = new Set(['workouts', 'swims', 'hikes'].flatMap((c) => store.list(c).map((x) => mondayOf(x.date))))
  const cursor = new Date(thisWeek + 'T00:00:00Z')
  if (!active.has(thisWeek)) cursor.setUTCDate(cursor.getUTCDate() - 7) // this week not started yet: the streak is still alive
  let streakWeeks = 0
  while (active.has(cursor.toISOString().slice(0, 10))) {
    streakWeeks++
    cursor.setUTCDate(cursor.getUTCDate() - 7)
  }
  return { streakWeeks, weekVolume, weekOf: thisWeek, lifts }
}

function withSwimMetrics(s) {
  return { ...s, metrics: swimMetrics(s) }
}

// ── Router ──────────────────────────────────────────────────────────────────────────────────────────────

function route(method, pattern, handler) {
  const keys = []
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '/?$')
  return { method, re, keys, handler }
}

function crud(col, normalize, decorate = (x) => x) {
  return [
    route('GET', `/api/${col}`, ({ store, query }) => store.list(col, { from: query.get('from'), to: query.get('to') }).map(decorate)),
    route('POST', `/api/${col}`, ({ store, body }) => [201, decorate(store.insert(col, normalize(body)))]),
    route('GET', `/api/${col}/:id`, ({ store, params }) => {
      const x = store.get(col, params.id)
      if (!x) throw httpError(404, 'Not found')
      return decorate(x)
    }),
    route('PUT', `/api/${col}/:id`, ({ store, params, body }) => {
      if (!store.get(col, params.id)) throw httpError(404, 'Not found')
      return decorate(store.update(col, params.id, normalize(body)))
    }),
    route('DELETE', `/api/${col}/:id`, ({ store, params }) => {
      if (!store.remove(col, params.id)) throw httpError(404, 'Not found')
      return [204, null]
    }),
  ]
}

function buildRoutes() {
  return [
    route('GET', '/api/health', () => ({ ok: true, app: 'PainCave', version: VERSION })),

    // Reference data
    route('GET', '/api/gyms', () => Object.values(GYMS).map(({ equipment, ...g }) => ({ ...g, equipmentCount: Object.keys(equipment).length }))),
    route('GET', '/api/gyms/:id', ({ params, store }) => {
      const g = GYMS[params.id]
      if (!g) throw httpError(404, 'Unknown gym')
      const avail = availableAt(g.id, store.getProfile()?.equipmentOverrides ?? {})
      return {
        ...g,
        equipment: Object.entries(EQUIPMENT).map(([id, e]) => ({ id, ...e, availability: g.equipment[id] ?? 'none', available: avail.has(id) })),
      }
    }),
    route('GET', '/api/equipment', () => Object.entries(EQUIPMENT).map(([id, e]) => ({ id, ...e }))),
    route('GET', '/api/exercises', ({ query, store }) => {
      const gym = query.get('gym')
      const avail = gym ? availableAt(gym, store.getProfile()?.equipmentOverrides ?? {}) : null
      return Object.entries(EXERCISES)
        .map(([id, e]) => ({ id, ...e, slots: Object.keys(SLOTS).filter((s) => SLOTS[s].includes(id)) }))
        .filter((e) => !query.get('goal') || e.goals.includes(query.get('goal')))
        .filter((e) => !avail || (e.equipment.every((x) => avail.has(x)) && (!e.anyOf || e.anyOf.some((x) => avail.has(x)))))
    }),
    route('GET', '/api/exercises/:id', ({ params }) => {
      const e = EXERCISES[params.id]
      if (!e) throw httpError(404, 'Unknown exercise')
      return { id: params.id, ...e }
    }),
    route('GET', '/api/exercises/:id/history', ({ params, store }) => {
      if (!EXERCISES[params.id]) throw httpError(404, 'Unknown exercise')
      return store.list('workouts').flatMap((w) => w.exercises.filter((e) => e.exerciseId === params.id).map((e) => ({ date: w.date, workoutId: w.id, sets: e.sets, topWeight: Math.max(0, ...e.sets.map((s) => s.weight ?? 0)) })))
    }),

    // Profile
    route('GET', '/api/profile', ({ store }) => store.getProfile() ?? { ...PROFILE_DEFAULTS, setup: false }),
    route('PUT', '/api/profile', ({ store, body }) => store.setProfile(normalizeProfile(body, store.getProfile()))),

    // Program
    route('GET', '/api/program', ({ store }) => {
      const p = requireProfile(store)
      const trk = tracker(store)
      const weeks = Array.from({ length: PROGRAM_WEEKS }, (_, i) => {
        const w = weekPlan(i + 1, p, ctxFor(store, p))
        const training = w.days.filter((d) => d.session.type !== 'rest')
        return { week: w.week, phase: w.phase, deload: w.deload, sessions: training.length, completed: training.filter((d) => trk.done(d)).length }
      })
      return { ...programOverview(p), progress: weeks, now: locate(p, today()) }
    }),
    route('GET', '/api/program/weeks/:week', ({ store, params }) => {
      const p = requireProfile(store)
      const trk = tracker(store)
      const w = weekPlan(Number(params.week), p, ctxFor(store, p))
      return { ...w, days: w.days.map((d) => ({ ...d, completed: trk.done(d), loggedSlots: trk.loggedSlots(d.sessionKey) })) }
    }),
    route('GET', '/api/today', ({ store, query }) => {
      const p = requireProfile(store)
      const date = query.get('date') ?? today()
      if (!DATE.test(date)) throw httpError(400, 'date must be YYYY-MM-DD')
      const where = locate(p, date)
      if (where.status !== 'active') return { date, ...where }
      const w = weekPlan(where.week, p, ctxFor(store, p))
      const day = w.days[where.dayIndex]
      const trk = tracker(store)
      if (day.session.exercises) {
        day.session.exercises = day.session.exercises.map((e) => {
          const rows = liftEntries(store, e.exerciseId)
          const swapIds = new Set([e.exerciseId, ...e.swaps.map((x) => x.exerciseId)])
          const loggedSlot = store.list('workouts').some((w) => w.sessionKey === day.sessionKey && w.exercises.some((x) => swapIds.has(x.exerciseId) && slotsOf(x).includes(e.slot)))
          return { ...e, pr: Math.max(0, ...rows.map((r) => r.weight)), done: loggedSlot, loggedToday: rows.filter((r) => r.date === date).reverse() }
        })
      }
      return { date, status: 'active', week: w.week, phase: w.phase, deload: w.deload, weekNote: w.note, ...day, completed: trk.done(day), units: p.units, weightStep: p.weightStep }
    }),
    route('GET', '/api/sessions/:type', ({ store, query, params }) => {
      const p = requireProfile(store)
      if (!SESSION_INFO[params.type]) throw httpError(404, 'Unknown session type')
      const week = Number(query.get('week') ?? 1)
      if (!(week >= 1 && week <= PROGRAM_WEEKS)) throw httpError(400, `week must be 1-${PROGRAM_WEEKS}`)
      return buildSession(params.type, week, p, ctxFor(store, p))
    }),

    // Logs
    ...crud('workouts', normalizeWorkout),
    route('GET', '/api/swims/stats', ({ store, query }) => {
      const unit = query.get('unit') ?? store.getProfile()?.reportUnit ?? 'yd'
      if (!['yd', 'm'].includes(unit)) throw httpError(400, 'unit must be yd or m')
      return swimStats(store.list('swims'), { unit, today: query.get('today') ?? today() })
    }),
    route('POST', '/api/swims/css-test', ({ store, body }) => {
      const p = store.getProfile() ?? PROFILE_DEFAULTS
      const cssPer100 = criticalSwimSpeed(body.t400 ?? body.time400, body.t200 ?? body.time200)
      const poolLength = Number(body.poolLength ?? p.poolLength)
      const poolUnit = body.poolUnit ?? p.poolUnit
      const t400 = body.t400 ?? body.time400
      const swim = normalizeSwim({
        date: body.date ?? today(), type: 'css_test', poolLength, poolUnit, sessionKey: body.sessionKey ?? null,
        sets: [{ reps: 1, distance: 400, time: t400 }, { reps: 1, distance: 200, time: body.t200 ?? body.time200 }],
        durationSec: body.durationSec, notes: body.notes ?? '',
      })
      swim.cssPer100 = cssPer100
      const row = store.insert('swims', swim)
      return [201, { ...withSwimMetrics(row), css: { per100: cssPer100, text: `${formatTime(cssPer100)} /100${poolUnit}` } }]
    }),
    ...crud('swims', (b) => {
      const s = normalizeSwim(b)
      if (s.type === 'css_test' && b.cssPer100 == null) delete s.cssPer100
      return s
    }, withSwimMetrics),
    route('GET', '/api/hikes/stats', ({ store }) => hikeStats(store.list('hikes'))),
    ...crud('hikes', normalizeHike),
    route('GET', '/api/body/stats', ({ store }) => bodyStats(store.list('body'), store.getProfile() ?? {})),
    ...crud('body', normalizeBody),

    // Nutrition and dashboard
    route('GET', '/api/nutrition', ({ store }) => nutritionTargets(requireProfile(store))),
    route('GET', '/api/dashboard', ({ store }) => {
      const p = requireProfile(store)
      const date = today()
      const where = locate(p, date)
      const trk = tracker(store)
      let week = null
      let todaySession = null
      if (where.status === 'active') {
        const w = weekPlan(where.week, p, ctxFor(store, p))
        const training = w.days.filter((d) => d.session.type !== 'rest')
        week = { week: w.week, phase: w.phase, deload: w.deload, planned: training.length, done: training.filter((d) => trk.done(d)).length, days: w.days.map((d) => ({ sessionKey: d.sessionKey, date: d.date, weekday: d.weekday, type: d.session.type, title: d.session.title, completed: trk.done(d) })) }
        const d = w.days[where.dayIndex]
        todaySession = { sessionKey: d.sessionKey, type: d.session.type, title: d.session.title, focus: d.session.focus, gymName: d.session.gymName ?? null, completed: trk.done(d) }
      }
      const swim = swimStats(store.list('swims'), { unit: p.reportUnit, today: date })
      const body = bodyStats(store.list('body'), p)
      return {
        date, program: where, today: todaySession, week,
        swim: { thisWeek: swim.thisWeek, css: swim.css, milestones: swim.milestones, total: swim.totalDistance, unit: swim.unit },
        hikes: hikeStats(store.list('hikes')),
        body: { weight: body.weight.latest, weightChange: body.weight.change, waist: body.waist.latest, waistChange: body.waist.change, waistToHeight: body.waistToHeight },
        nutrition: nutritionTargets(p),
      }
    }),

    route('GET', '/api/stats/lifts', ({ store, query }) => liftStats(store, query.get('today') ?? today())),
    route('GET', '/api/exercises/:id/entries', ({ store, params }) => {
      if (!EXERCISES[params.id]) throw httpError(404, 'Unknown exercise')
      return liftEntries(store, params.id)
    }),

    // Backup
    route('GET', '/api/export', ({ store }) => store.export()),
  ]
}

// ── Server plumbing ─────────────────────────────────────────────────────────────────────────────────────

const MAX_BODY = 1_000_000
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' }

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const c of req) {
    size += c.length
    if (size > MAX_BODY) throw httpError(413, 'Body too large')
    chunks.push(c)
  }
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw httpError(400, 'Body must be JSON')
  }
}

function tokenOk(header, token) {
  const got = Buffer.from(String(header ?? '').replace(/^Bearer\s+/i, ''))
  const want = Buffer.from(token)
  return got.length === want.length && timingSafeEqual(got, want)
}

/**
 * @param {{ store: import('./store.mjs').Store, token?: string, corsOrigin?: string, publicDir?: string }} opts
 */
export function createApp({ store, token, corsOrigin = '*', publicDir }) {
  const routes = buildRoutes()

  async function serveStatic(pathname, res) {
    if (!publicDir) return false
    const rel = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '')
    if (rel.startsWith('..')) return false
    let file = join(publicDir, rel || 'index.html')
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html')
      const buf = await readFile(file)
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' })
      res.end(buf)
      return true
    } catch {
      // Single-page app: unknown non-API paths fall back to index.html.
      try {
        const buf = await readFile(join(publicDir, 'index.html'))
        res.writeHead(200, { 'Content-Type': MIME['.html'] })
        res.end(buf)
        return true
      } catch {
        return false
      }
    }
  }

  return async function handler(req, res) {
    const url = new URL(req.url, 'http://localhost')
    const send = (status, payload) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      })
      res.end(payload == null ? '' : JSON.stringify(payload))
    }
    try {
      if (req.method === 'OPTIONS') return send(204, null)
      if (!url.pathname.startsWith('/api/')) {
        if (req.method === 'GET' && (await serveStatic(url.pathname, res))) return
        return send(404, { error: 'Not found' })
      }
      if (token && url.pathname !== '/api/health' && !tokenOk(req.headers.authorization, token)) throw httpError(401, 'Missing or wrong token')
      const matches = routes.filter((r) => r.re.test(url.pathname))
      if (!matches.length) throw httpError(404, 'Not found')
      const r = matches.find((x) => x.method === req.method)
      if (!r) throw httpError(405, 'Method not allowed')
      const m = url.pathname.match(r.re)
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]))
      const body = ['POST', 'PUT'].includes(req.method) ? await readBody(req) : {}
      const out = await r.handler({ store, params, query: url.searchParams, body })
      if (Array.isArray(out) && out.length === 2 && typeof out[0] === 'number') return send(out[0], out[1])
      return send(200, out)
    } catch (e) {
      const status = e.status ?? 500
      if (status >= 500) console.error(e)
      return send(status, { error: status >= 500 ? 'Server error' : e.message })
    }
  }
}

