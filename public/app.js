// The PainCave — front end. Plain ES modules, no build step. Talks to the PainCave API on the same origin.
// Screens follow the Claude Design handoff (Today · Plan · Stats + Log), plus a Swim tab in the same style.

const $ = (s) => document.querySelector(s)
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c])
const localDate = (d = new Date()) => d.toLocaleDateString('en-CA')
const fmtDate = (s, o = { month: 'short', day: 'numeric' }) => new Date(s + 'T12:00').toLocaleDateString(undefined, o)
const fmtTime = (sec) => {
  if (sec == null) return '—'
  const s = Math.round(sec), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`
}
const parseTime = (v) => {
  const p = String(v ?? '').trim().split(':').map(Number)
  if (!p.length || p.some((n) => !Number.isFinite(n) || n < 0)) return null
  return p.reduce((a, n) => a * 60 + n, 0)
}
const round1 = (n) => Math.round(n * 10) / 10

// Per-device conveniences only (photos, token). Wrapped: storage can be unavailable.
const local = {
  get(k, d = null) { try { const v = localStorage.getItem('paincave.' + k); return v == null ? d : JSON.parse(v) } catch { return d } },
  set(k, v) { try { localStorage.setItem('paincave.' + k, JSON.stringify(v)); return true } catch { return false } },
  del(k) { try { localStorage.removeItem('paincave.' + k) } catch {} },
}

// ── API ────────────────────────────────────────────────────────────────────────────────────────────────
// Two modes. "server": a PainCave server answers /api/* (npm start). "phone": no server (GitHub Pages), so the same
// API code (./core/api.mjs) runs right here and keeps the data in this phone's storage.
let mode = 'server'
let localDispatch = null
async function detectMode() {
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 2500)
    const r = await fetch('./api/health', { signal: ctl.signal, cache: 'no-store' })
    clearTimeout(t)
    if (r.ok && (await r.json()).app === 'PainCave') return
  } catch {}
  mode = 'phone'
  const [{ createRouter }, { BrowserStore }] = await Promise.all([import('./core/api.mjs'), import('./core/browser-store.mjs')])
  localDispatch = createRouter(new BrowserStore())
}

async function api(method, path, body) {
  if (mode === 'phone') {
    const url = new URL(path, 'https://paincave.local')
    const out = await localDispatch(method, url.pathname, url.searchParams, body ? JSON.parse(JSON.stringify(body)) : {})
    const data = out.body == null ? null : JSON.parse(JSON.stringify(out.body))
    if (out.status >= 400) throw new Error(data?.error ?? `Request failed (${out.status})`)
    return data
  }
  const headers = { 'Content-Type': 'application/json' }
  const token = local.get('token')
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch('.' + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (res.status === 401) { S.needToken = true; throw new Error('Enter your PainCave token in Settings') }
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`)
  return data
}

// ── State ──────────────────────────────────────────────────────────────────────────────────────────────
const S = {
  tab: 'today', view: null, // view: null | log | swimlog | csstest | hikelog | bodylog | settings
  profile: null, today: null, program: null, weekCache: {}, weekSel: null,
  showAll: false, allExercises: null,
  current: null, entries: [], entry: { weight: 0, reps: 10, sets: 3 },
  lifts: null, statId: null, swimStats: null, swims: [], body: null, hikes: null, nutrition: null,
  form: {}, busy: false, needToken: false,
}
const unit = () => S.profile?.units ?? 'lbs'
const step = () => S.profile?.weightStep ?? 5

// ── Icons ──────────────────────────────────────────────────────────────────────────────────────────────
const ICON = {
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
}

// ── Photos (per exercise, stored on this device) ───────────────────────────────────────────────────────
// Bundled photos (Wikimedia Commons, credited in Settings) by exercise; your own photo always wins.
let PHOTOS = { exercises: {}, files: {} }
fetch('./photos/credits.json').then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) { PHOTOS = j; render() } }).catch(() => {})
const bundledPhoto = (id) => { const k = PHOTOS.exercises[id]; return k && PHOTOS.files[k] ? { url: `./photos/${PHOTOS.files[k].file}`, ...PHOTOS.files[k] } : null }
const userPhoto = (id) => local.get('photo.' + id)
const photoOf = (id) => userPhoto(id) ?? bundledPhoto(id)?.url ?? null
let photoTarget = null
function pickPhoto(id) { photoTarget = id; $('#photoInput').click() }
$('#photoInput').addEventListener('change', async (e) => {
  const f = e.target.files?.[0]
  e.target.value = ''
  if (!f || !photoTarget) return
  try {
    const bmp = await createImageBitmap(f)
    const scale = Math.min(1, 640 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale)
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    if (!local.set('photo.' + photoTarget, c.toDataURL('image/jpeg', 0.82))) throw new Error('full')
    render()
  } catch { toast('Could not save that photo on this device', true) }
})
const photoHtml = (id, name) => {
  const p = photoOf(id)
  return p ? `<img src="${p}" alt="${esc(name)}">` : `<div class="ph">${ICON.photo}<span>${esc(name)}</span></div>`
}

// ── Toast ──────────────────────────────────────────────────────────────────────────────────────────────
let toastTimer
function toast(msg, err = false) {
  document.querySelector('.toast')?.remove()
  const t = document.createElement('div')
  t.className = 'toast' + (err ? ' err' : '')
  t.textContent = msg
  $('#app').appendChild(t)
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => t.remove(), 2600)
}

// ── Data loading ───────────────────────────────────────────────────────────────────────────────────────
async function loadToday() {
  S.today = await api('GET', `/api/today?date=${localDate()}`)
}
async function loadProgram() {
  S.program = await api('GET', '/api/program')
}
async function loadWeek(n) {
  S.weekCache[n] = await api('GET', `/api/program/weeks/${n}`)
}
async function loadAllExercises() {
  if (S.allExercises) return
  const seen = new Map()
  for (const g of S.profile.gyms) for (const e of await api('GET', `/api/exercises?gym=${g}`)) if (!seen.has(e.id)) seen.set(e.id, e)
  S.allExercises = [...seen.values()]
}
async function loadStats() {
  const [lifts, body, hikes, nutrition] = await Promise.all([
    api('GET', `/api/stats/lifts?today=${localDate()}`), api('GET', '/api/body/stats'), api('GET', '/api/hikes/stats'), api('GET', '/api/nutrition'),
  ])
  Object.assign(S, { lifts, body, hikes, nutrition })
  if (!S.statId || !lifts.lifts.some((l) => l.exerciseId === S.statId)) S.statId = lifts.lifts[0]?.exerciseId ?? null
}
async function loadSwim() {
  const [st, swims] = await Promise.all([api('GET', `/api/swims/stats?today=${localDate()}`), api('GET', '/api/swims')])
  S.swimStats = st
  S.swims = swims.slice(0, 15)
}

// Load-once helpers: a view asks for data it lacks; a failure is shown with a retry instead of looping.
const pending = new Set()
const failed = {}
function ensure(key, fn) {
  if (pending.has(key) || failed[key]) return
  pending.add(key)
  fn().catch((e) => { failed[key] = e.message }).finally(() => { pending.delete(key); render() })
}
const loadingHtml = (key, msg) => (failed[key]
  ? `<div class="loading">${esc(failed[key])}<br><button class="toggle" data-act="retry" data-k="${key}">Try again</button></div>`
  : `<div class="loading">${msg}</div>`)

async function refresh(what) {
  try {
    if (what === 'today') await loadToday()
  } catch (e) { toast(e.message, true) }
  render()
}
const currentWeek = () => (S.program?.now?.status === 'active' ? S.program.now.week : S.program?.now?.status === 'complete' ? 12 : 1)

// ── Formatting helpers for prescriptions ───────────────────────────────────────────────────────────────
const rxText = (p) => {
  if (!p) return ''
  const amount = p.reps ? (p.reps[0] === p.reps[1] ? p.reps[0] : `${p.reps[0]}–${p.reps[1]}`) : p.seconds ? `${p.seconds} s` : `${p.steps} steps`
  return `${p.sets} × ${amount}${p.perSide ? ' /side' : ''}`
}
const amountLabel = (p) => (p?.unit === 'seconds' ? 'Seconds' : p?.unit === 'steps' ? 'Steps' : 'Reps')
const amountStep = (p) => (p?.unit === 'seconds' ? 5 : p?.unit === 'steps' ? 2 : 1)
const isStrength = (t) => t === 'lower' || t === 'upper'

// ── Screens ────────────────────────────────────────────────────────────────────────────────────────────
function viewToday() {
  const t = S.today
  const label = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  const head = (title, summary) => `
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div class="eyebrow">The PainCave</div>
      <button class="icon-btn" data-act="openSettings" aria-label="Settings">${ICON.gear}</button>
    </div>
    <div class="title-row"><div class="h1">${esc(title)}</div><div class="side">${esc(label)}</div></div>
    <div class="summary">${summary}</div>`
  if (!t) { ensure('today', loadToday); return loadingHtml('today', 'Loading…') }

  if (t.status === 'not_started') {
    return head('Today', `Your 12-week plan starts ${esc(fmtDate(t.startsOn, { weekday: 'short', month: 'short', day: 'numeric' }))}.`) +
      `<div class="glass session"><div class="t">Not started yet</div><p>Log anything extra below, or move the start date in Settings.</p></div>` + allGrid()
  }
  if (t.status === 'complete') {
    return head('Block complete', 'All 12 weeks are behind you.') +
      `<div class="glass session"><div class="t">You did it</div><p>Retest your CSS and your lifts, then start the next block.</p>
       <button class="btn light" data-act="restartBlock">Start a new 12-week block</button></div>` + allGrid()
  }

  const s = t.session
  const doneChip = t.completed ? ' · <span style="color:#7ee0a5;font-weight:600">Done</span>' : ''
  const deload = t.deload ? ' · Deload' : ''
  if (isStrength(s.type)) {
    const ex = s.exercises
    const done = ex.filter((e) => e.done).length
    let html = head(`${s.title} day`, `Week ${t.week} of 12 · ${done} of ${ex.length} done${deload}${doneChip}`)
    if (t.weekNote) html += `<div class="banner">${esc(t.weekNote)}</div>`
    html += `<div class="glass pad" style="margin-top:18px"><details class="mini"><summary>Warm-up · ${esc(s.gymName)}</summary><div style="margin-top:6px">${s.warmup.map(esc).join('<br>')}</div></details></div>`
    if (S.showAll) html += allGrid()
    else {
      html += `<div class="grid">${ex.map((e) => {
        const lt = e.loggedToday?.[0]
        const last = lt ? `Today · ${lt.weight} ${unit()}` : e.suggestion?.weight != null ? `Last ${Math.max(0, ...e.suggestion.lastSets.map((x) => x.weight ?? 0))} · try ${e.suggestion.weight} ${unit()}` : e.suggestion ? 'Last: bodyweight' : 'No sets yet'
        return `<button class="machine" data-act="openPlanned" data-slot="${e.slot}">
          <div class="photo">${photoHtml(e.exerciseId, e.name)}</div>
          <div class="meta"><div class="name-row"><div class="name">${esc(e.name)}</div>${e.done ? '<div class="pill-done">Done</div>' : ''}</div>
          <div class="target">Plan: ${esc(rxText(e.prescription))}</div><div class="last">${esc(last)}</div></div></button>`
      }).join('')}</div>`
      if (s.finisher) html += `<div class="glass session"><div class="t">Finisher</div><p>${esc(s.finisher.plan)}</p></div>`
    }
    html += `<button class="toggle" data-act="toggleAll">${S.showAll ? "Show only today's plan" : 'Log a different machine'}</button>`
    return html
  }

  if (s.type === 'rest') {
    return head('Rest day', `Week ${t.week} of 12${deload}`) +
      `<div class="glass session"><div class="t">Rest day</div><p>Nothing planned. Recover — or log something extra below.</p><p>${esc(s.plan)}</p></div>` +
      (S.showAll ? allGrid() : '') +
      `<button class="toggle" data-act="toggleAll">${S.showAll ? 'Hide machines' : 'Log something extra'}</button>`
  }

  let html = head(s.title.replace('Swim: ', 'Swim · '), `Week ${t.week} of 12${s.gymName ? ' · ' + esc(s.gymName) : ''}${deload}${doneChip}`)
  if (t.weekNote) html += `<div class="banner">${esc(t.weekNote)}</div>`
  html += `<div class="glass session">${sessionBody(s)}${sessionAction(s, t)}</div>`
  html += S.showAll ? allGrid() : ''
  html += `<button class="toggle" data-act="toggleAll">${S.showAll ? 'Hide machines' : 'Log a machine too'}</button>`
  return html
}

function sessionBody(s) {
  if (s.swim) {
    const u = s.swim.poolUnit
    return `<div class="t">${s.swim.totalDistance.toLocaleString()} ${u}</div><p>${esc(s.focus)}</p>` + s.swim.blocks.map((b) => `
      <div class="block"><div class="bn">${esc(b.name)}</div>
      ${b.sets.map((x) => `<div class="row"><span>${x.reps > 1 ? x.reps + ' × ' : ''}${x.distance} ${esc(x.drill ?? x.stroke)}</span><span class="r">${esc(x.target ?? (x.restSec ? `rest ${x.restSec}s` : x.effort ?? ''))}</span></div>`).join('')}
      ${b.note ? `<div class="note">${esc(b.note)}</div>` : ''}</div>`).join('')
  }
  if (s.warning) {
    return `<div class="t">Dryland swim</div><div class="chip-warn">${esc(s.warning)}</div>` + s.blocks.map((b) => `<div class="block"><div class="bn">${esc(b.name)}</div><div class="note" style="font-size:15px;color:var(--on-photo)">${esc(b.plan ?? b.exercises.join(' · '))}</div></div>`).join('')
  }
  if (s.type === 'hike_long') {
    return `<div class="t">${s.outdoor.minutes} min · ${s.outdoor.packLb ? s.outdoor.packLb + ' lb pack' : 'light pack'}</div><p>${esc(s.outdoor.plan)}</p>
      <div class="block"><div class="bn">Can't get outside?</div><div class="note">${esc(s.indoorFallback.plan)} ${esc(s.indoorFallback.note)}</div></div>`
  }
  if (s.type === 'hike_conditioning') {
    const m = s.cardio.machine ? s.cardio.machine.replace('_', ' ') : 'outdoors'
    return `<div class="t">${s.cardio.minutes ?? ''} min · ${esc(m)}</div><p>${esc(s.cardio.plan)}</p>${s.cardio.zone ? `<div class="note mini">${esc(s.cardio.zone)}</div>` : ''}
      <div class="block"><div class="bn">Core</div><div class="note" style="font-size:15px;color:var(--on-photo)">${s.core.map(esc).join('<br>')}</div></div>`
  }
  return `<p>${esc(s.focus)}</p>`
}

function sessionAction(s, t) {
  if (t.completed) return `<button class="btn light" disabled>Done for today</button>`
  if (s.swim?.blocks.some((b) => b.name === 'CSS test')) return `<div class="row-btns"><button class="btn" data-act="openCss">Enter test times</button><button class="btn ghost" data-act="openSwimLog" data-planned="1">Log swim</button></div>`
  if (s.swim) return `<button class="btn" data-act="openSwimLog" data-planned="1">Log this swim</button>`
  if (s.type === 'hike_long') return `<button class="btn" data-act="openHikeLog" data-planned="1">Log hike</button>`
  return `<button class="btn" data-act="markDone">Mark done</button>`
}

function allGrid() {
  if (!S.allExercises) { ensure('all', loadAllExercises); return loadingHtml('all', 'Loading machines…') }
  return `<div class="grid">${S.allExercises.map((e) => `
    <button class="machine" data-act="openFree" data-id="${e.id}">
      <div class="photo">${photoHtml(e.id, e.name)}</div>
      <div class="meta"><div class="name">${esc(e.name)}</div><div class="last">${esc(e.muscles.slice(0, 2).join(', '))}</div></div>
    </button>`).join('')}</div>`
}

function viewLog() {
  const c = S.current
  const ents = S.entries
  const pr = Math.max(0, ...ents.map((e) => e.weight))
  const todays = ents.filter((e) => e.date === localDate()).reverse()
  const { weight, reps, sets } = S.entry
  const u = unit()
  return `
    <div class="log-head">
      <button class="back" data-act="closeView" aria-label="Back">‹</button>
      <div class="h2">${esc(c.name)}</div>
      <div class="pr">PR ${pr} ${u}</div>
    </div>
    ${c.prescription ? `<div class="badge-plan">Today's plan · ${esc(rxText(c.prescription))} · RPE ${c.prescription.rpe}</div>` : ''}
    ${c.suggestion?.reason ? `<div class="hint">${esc(c.suggestion.reason)}</div>` : ''}
    ${c.cues?.length ? `<div class="hint">${c.cues.map(esc).join(' · ')}</div>` : ''}
    ${c.swaps?.length ? `<div class="swaps">${c.swaps.map((x) => `<button class="${x.exerciseId === c.exerciseId ? 'on chip' : ''}" data-act="swap" data-id="${x.exerciseId}">${x.exerciseId === c.exerciseId ? '✓ ' : 'Swap: '}${esc(x.name)}</button>`).join('')}</div>` : ''}
    <div class="log-photo">${photoOf(c.exerciseId) ? `<img src="${photoOf(c.exerciseId)}" alt="${esc(c.name)}">` : `<div class="ph">${ICON.photo.replace('<svg', '<svg width="26" height="26"')} Add a photo of this machine</div>`}
      <button class="photo-btn" data-act="pickPhoto" data-id="${c.exerciseId}">${userPhoto(c.exerciseId) ? 'Change photo' : 'Use my photo'}</button>
      ${userPhoto(c.exerciseId) ? `<button class="photo-btn" style="top:auto;bottom:10px" data-act="clearPhoto" data-id="${c.exerciseId}">Reset</button>` : bundledPhoto(c.exerciseId) ? `<div class="photo-credit">${esc(bundledPhoto(c.exerciseId).artist || 'Wikimedia Commons')} · ${esc(bundledPhoto(c.exerciseId).license)}</div>` : ''}</div>
    <div class="card entry">
      <div class="label-sm">Weight</div>
      <div class="stepper-big">
        <button class="round" data-act="adj" data-k="weight" data-d="-1" aria-label="Less weight">−</button>
        <div class="big-val"><div class="v">${weight}</div><div class="u">${u}</div></div>
        <button class="round" data-act="adj" data-k="weight" data-d="1" aria-label="More weight">+</button>
      </div>
      <div class="pair">
        <div class="box"><div class="label-sm">${amountLabel(c.prescription)}</div><div class="stepper">
          <button class="small" data-act="adj" data-k="reps" data-d="-1">−</button><div class="v">${reps}</div><button class="small" data-act="adj" data-k="reps" data-d="1">+</button></div></div>
        <div class="box"><div class="label-sm">Sets</div><div class="stepper">
          <button class="small" data-act="adj" data-k="sets" data-d="-1">−</button><div class="v">${sets}</div><button class="small" data-act="adj" data-k="sets" data-d="1">+</button></div></div>
      </div>
      <button class="btn" data-act="saveSet" ${S.busy ? 'disabled' : ''}>${weight > pr && pr > 0 ? 'Save set · New PR' : 'Save set'}</button>
    </div>
    ${todays.length ? `<div style="margin-top:22px"><div class="label" style="color:var(--on-photo-3);padding:0 4px">Logged today</div>
      <div class="stack" style="margin-top:10px">${todays.map((e) => `<div class="logged-row"><div class="w">${e.weight} ${u}</div><div class="s">${e.setCount} × ${e.reps ?? '—'}</div>${e.isPr ? '<div class="chip-pr">PR</div>' : ''}</div>`).join('')}</div></div>` : ''}`
}

function dayDetail(s) {
  if (isStrength(s.type)) {
    const ex = s.exercises
    const shown = ex.slice(0, 3).map((e) => `${e.name} ${rxText(e.prescription).replace(' × ', '×')}`)
    return shown.join(' · ') + (ex.length > 3 ? ` · +${ex.length - 3} more` : '')
  }
  if (s.swim) return `${s.swim.totalDistance.toLocaleString()} ${s.swim.poolUnit}${s.gymName ? ' · ' + s.gymName : ''}`
  if (s.warning) return 'Dryland (no pool in your gyms)'
  if (s.type === 'hike_long') return `${s.outdoor.minutes} min hike${s.outdoor.packLb ? ` · ${s.outdoor.packLb} lb pack` : ''}`
  if (s.type === 'hike_conditioning') return s.cardio.plan
  return 'Recovery · walk and stretch'
}

function viewPlan() {
  if (!S.program) { ensure('program', loadProgram); return loadingHtml('program', 'Loading plan…') }
  const sel = S.weekSel ?? currentWeek()
  const w = S.weekCache[sel]
  if (!w) ensure('week' + sel, () => loadWeek(sel))
  const now = S.program.now.status === 'active' ? S.program.now.week : null
  const td = localDate()
  const prog = S.program.progress[sel - 1]
  let html = `
    <div class="title-row" style="margin-top:8px"><div class="h1">Plan</div><div class="side">Swim · Hike · Lean</div></div>
    <div class="weeks">${S.program.progress.map((p) => `<button class="wk${p.week === sel ? ' sel' : ''}${p.week === now ? ' now' : ''}" data-act="selWeek" data-w="${p.week}">W${p.week}</button>`).join('')}</div>
    <div class="section"><div class="label">Week ${sel} of 12 · ${esc(prog.phase)}${prog.deload ? ' · deload' : ''}</div><div style="font-size:13px">${prog.completed}/${prog.sessions} workouts</div></div>`
  if (!w) return html + loadingHtml('week' + sel, 'Loading week…')
  if (w.note) html += `<div class="banner" style="margin:0 0 10px">${esc(w.note)}</div>`
  html += `<div class="stack">${w.days.map((d) => {
    const rest = d.session.type === 'rest'
    const isToday = d.date === td
    let st = '', col = 'inherit'
    if (!rest) {
      if (d.completed) { st = 'Done'; col = 'var(--success)' }
      else if (d.date < td) { st = 'Missed'; col = 'var(--danger)' }
      else if (isToday) { st = 'Today'; col = 'var(--blue)' }
    }
    return `<button class="day${rest ? ' rest' : ''}${isToday ? ' today' : ''}" data-act="${isToday ? 'goToday' : 'noop'}">
      <div class="dd"><div class="dow">${d.weekday.slice(0, 3)}</div><div class="dom">${Number(d.date.slice(8))}</div></div>
      <div style="min-width:0"><div class="f">${esc(rest ? 'Rest' : d.session.title)}</div><div class="d">${esc(dayDetail(d.session))}</div></div>
      <div class="st" style="color:${col}">${st}</div></button>`
  }).join('')}</div>
  <div class="note-box">Your PainCave 12-week plan · Base → Build → Peak · deloads in weeks 4 and 8<br>Built for the equipment at ${esc(S.profile.gyms.map((g) => (g === 'ymca' ? 'YMCA' : 'Planet Fitness')).join(' + '))}</div>`
  return html
}

function viewSwim() {
  const st = S.swimStats
  if (!st) { ensure('swim', loadSwim); return loadingHtml('swim', 'Loading swims…') }
  const u = st.unit
  const max = Math.max(1, ...st.weekly.map((w) => w.distance))
  const bars = st.weekly.map((w, i) => {
    const h = Math.round((w.distance / max) * 96)
    return `<rect x="${i * 26 + 4}" y="${108 - h}" width="18" height="${Math.max(h, 2)}" rx="4" fill="${i === st.weekly.length - 1 ? '#2f6fdd' : '#c9d8f5'}"><title>${esc(w.weekOf)}: ${w.distance} ${u}</title></rect>`
  }).join('')
  return `
    <div class="title-row" style="margin-top:8px"><div class="h1">Swim</div><div class="side">${st.sessions} swims</div></div>
    <div class="tiles">
      <div class="card tile"><div class="label-sm">This week</div><div class="big">${st.thisWeek.distance.toLocaleString()}<small>${u}</small></div></div>
      <div class="card tile"><div class="label-sm">CSS pace</div><div class="big">${st.css ? esc(st.css.text) : '—'}<small>${st.css ? '/100' + esc(st.css.unit) : 'no test'}</small></div></div>
    </div>
    <div class="row-btns" style="margin-top:12px"><button class="btn" data-act="openSwimLog">Log a swim</button><button class="btn ghost" data-act="openCss">CSS test</button></div>
    <div class="card chart-card">
      <div class="label-sm">Last 12 weeks</div>
      <svg class="chart" viewBox="0 0 316 120" role="img" aria-label="Weekly swim distance"><line x1="0" y1="110" x2="316" y2="110" stroke="#ebeae4"></line>${bars}</svg>
      <div class="axis"><span>${esc(fmtDate(st.weekly[0].weekOf))}</span><span>This week</span></div>
    </div>
    <div class="card pad" style="margin-top:12px">
      <div class="two">
        <div><div class="label-sm">Best pace</div><div style="font-size:22px;font-weight:700;margin-top:4px">${st.bestPacePer100 ? esc(st.bestPacePer100.text) : '—'}<span class="muted" style="font-size:13px;font-weight:500"> /100${u}</span></div></div>
        <div><div class="label-sm">Longest swim</div><div style="font-size:22px;font-weight:700;margin-top:4px">${st.longestSwim ? st.longestSwim.distance.toLocaleString() : '—'}<span class="muted" style="font-size:13px;font-weight:500"> ${u}</span></div></div>
      </div>
      ${st.milestones.map((m) => `<div style="margin-top:16px"><div style="display:flex;justify-content:space-between;font-size:14px;font-weight:600"><span>${esc(m.label)}</span><span class="muted">${Math.round(m.progress * 100)}%</span></div><div class="progress"><i style="width:${Math.round(m.progress * 100)}%"></i></div></div>`).join('')}
    </div>
    <div class="section"><div class="label">Recent swims</div></div>
    <div class="card list">${S.swims.length ? S.swims.map((s) => `
      <div class="list-row"><div><div style="font-weight:600">${s.distance.toLocaleString()} ${esc(s.unit)}</div>
        <div class="sub">${esc([s.type === 'css_test' ? `CSS test · ${fmtTime(s.cssPer100)}/100` : s.type, s.metrics.pacePer100Text, s.metrics.swolf ? 'SWOLF ' + s.metrics.swolf : null].filter((x) => x && x !== 'other').join(' · '))}</div></div>
        <div class="rd">${esc(fmtDate(s.date))}</div>
        <button class="chip light" data-act="delSwim" data-id="${s.id}" aria-label="Delete swim">✕</button></div>`).join('') : '<div class="empty-state">No swims yet. Log your first one.</div>'}</div>`
}

function viewSwimLog() {
  const f = S.form
  const pools = [['25yd', '25 yd'], ['25m', '25 m'], ['50m', '50 m'], ['open', 'Open water']]
  const types = [['technique', 'Technique'], ['endurance', 'Endurance'], ['open_water', 'Open water'], ['other', 'Other']]
  const efforts = [[3, 'Easy'], [5, 'Moderate'], [7, 'Hard'], [9, 'All-out']]
  const u = f.pool === 'open' ? 'm' : f.pool.endsWith('yd') ? 'yd' : 'm'
  const len = f.pool === 'open' ? null : Number(f.pool.replace(/\D/g, ''))
  const pace = f.distance && f.min * 60 + f.sec ? fmtTime(((f.min * 60 + f.sec) / f.distance) * 100) : null
  return `
    <div class="log-head"><button class="back" data-act="closeView" aria-label="Back">‹</button><div class="h2">Log a swim</div>
      ${f.planned ? `<div class="pr">Planned ${f.planned.toLocaleString()} ${u}</div>` : ''}</div>
    <div class="card entry">
      <div class="label-sm">Pool</div>
      <div class="seg" style="margin-top:8px">${pools.map(([k, l]) => `<button class="chip light${f.pool === k ? ' on' : ''}" data-act="form" data-k="pool" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="label-sm" style="margin-top:18px">Distance</div>
      <div class="stepper-big">
        <button class="round" data-act="formAdj" data-k="distance" data-d="${-(len ? len * 2 : 50)}">−</button>
        <div class="big-val"><div class="v">${f.distance.toLocaleString()}</div><div class="u">${u}</div></div>
        <button class="round" data-act="formAdj" data-k="distance" data-d="${len ? len * 2 : 50}">+</button>
      </div>
      <div class="hint muted" style="text-align:center">${len ? `${Math.round(f.distance / len)} lengths · ±1 lap per tap` : '±50 m per tap'}</div>
      <div class="seg" style="justify-content:center;margin-top:8px">${[100, 500].map((n) => `<button class="chip light" data-act="formAdj" data-k="distance" data-d="${n}">+${n}</button>`).join('')}</div>
      <div class="pair">
        <div class="box"><div class="label-sm">Minutes</div><div class="stepper"><button class="small" data-act="formAdj" data-k="min" data-d="-1">−</button><div class="v">${f.min}</div><button class="small" data-act="formAdj" data-k="min" data-d="1">+</button></div></div>
        <div class="box"><div class="label-sm">Seconds</div><div class="stepper"><button class="small" data-act="formAdj" data-k="sec" data-d="-5">−</button><div class="v">${String(f.sec).padStart(2, '0')}</div><button class="small" data-act="formAdj" data-k="sec" data-d="5">+</button></div></div>
      </div>
      <div class="hint muted" style="text-align:center">${pace ? `Pace ${pace} /100${u}` : 'Add your time to see your pace'}</div>
      ${len ? `<div class="box" style="margin-top:12px"><div class="label-sm">Strokes per length (optional, for SWOLF)</div><div class="stepper"><button class="small" data-act="formAdj" data-k="spl" data-d="-1">−</button><div class="v">${f.spl || '—'}</div><button class="small" data-act="formAdj" data-k="spl" data-d="1">+</button></div></div>` : ''}
      <div class="label-sm" style="margin-top:18px">Type</div>
      <div class="seg" style="margin-top:8px">${types.map(([k, l]) => `<button class="chip light${f.type === k ? ' on' : ''}" data-act="form" data-k="type" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="label-sm" style="margin-top:18px">Effort</div>
      <div class="seg" style="margin-top:8px">${efforts.map(([k, l]) => `<button class="chip light${f.rpe === k ? ' on' : ''}" data-act="form" data-k="rpe" data-v="${k}">${l}</button>`).join('')}</div>
      <label class="check" style="margin-top:14px"><input type="checkbox" data-bind="continuous" ${f.continuous ? 'checked' : ''}> Swam it without stopping</label>
      <button class="btn" data-act="saveSwim" ${S.busy ? 'disabled' : ''}>Save swim</button>
    </div>`
}

function viewCss() {
  const f = S.form
  const css = parseTime(f.t400) && parseTime(f.t200) && parseTime(f.t400) > parseTime(f.t200) ? (parseTime(f.t400) - parseTime(f.t200)) / 2 : null
  return `
    <div class="log-head"><button class="back" data-act="closeView" aria-label="Back">‹</button><div class="h2">CSS test</div></div>
    <div class="glass session"><p>Warm up well. Swim a <b>400</b> as fast as you can hold evenly, rest 5–10 minutes easy, then swim a <b>200</b> all-out. Your critical swim speed sets the target pace for every endurance set.</p></div>
    <div class="card entry">
      <div class="two">
        <div class="field"><label class="label-sm" for="t400">400 time (m:ss)</label><input class="input" id="t400" data-bind="t400" inputmode="numeric" placeholder="8:00" value="${esc(f.t400)}"></div>
        <div class="field" style="margin-top:0"><label class="label-sm" for="t200">200 time (m:ss)</label><input class="input" id="t200" data-bind="t200" inputmode="numeric" placeholder="3:40" value="${esc(f.t200)}"></div>
      </div>
      <div class="hint muted" style="text-align:center;font-size:15px" id="cssPreview">${css ? `CSS ${fmtTime(css)} per 100 ${esc(S.profile.poolUnit)}` : 'Enter both times'}</div>
      <button class="btn" data-act="saveCss" ${S.busy ? 'disabled' : ''}>Save test</button>
    </div>`
}

function viewHikeLog() {
  const f = S.form
  const box = (k, label, d, val) => `<div class="box"><div class="label-sm">${label}</div><div class="stepper"><button class="small" data-act="formAdj" data-k="${k}" data-d="${-d}">−</button><div class="v" style="font-size:24px">${val}</div><button class="small" data-act="formAdj" data-k="${k}" data-d="${d}">+</button></div></div>`
  return `
    <div class="log-head"><button class="back" data-act="closeView" aria-label="Back">‹</button><div class="h2">Log a hike</div></div>
    <div class="card entry">
      <div class="label-sm">Time on your feet</div>
      <div class="stepper-big"><button class="round" data-act="formAdj" data-k="minutes" data-d="-5">−</button>
        <div class="big-val"><div class="v">${f.minutes}</div><div class="u">min</div></div>
        <button class="round" data-act="formAdj" data-k="minutes" data-d="5">+</button></div>
      <div class="pair">${box('miles', 'Miles', 0.5, f.miles)}${box('elev', 'Climb (ft)', 100, f.elev)}</div>
      <div class="pair" style="margin-top:12px">${box('pack', 'Pack (lb)', 5, f.pack)}<div class="box" style="display:flex;align-items:center"><label class="check" style="background:none;padding:0"><input type="checkbox" data-bind="indoor" ${f.indoor ? 'checked' : ''}> Treadmill</label></div></div>
      <div class="field"><label class="label-sm" for="trail">Trail (optional)</label><input class="input" id="trail" data-bind="trail" value="${esc(f.trail)}" placeholder="Ridge loop"></div>
      <button class="btn" data-act="saveHike" ${S.busy ? 'disabled' : ''}>Save hike</button>
    </div>`
}

function viewStats() {
  if (!S.lifts) { ensure('stats', loadStats); return loadingHtml('stats', 'Loading stats…') }
  const u = unit()
  const L = S.lifts
  const stat = L.lifts.find((l) => l.exerciseId === S.statId)
  let chart = '<div class="empty-state">Log a set to start your chart.</div>'
  if (stat) {
    const hist = stat.sessions.slice(-8)
    const ws = hist.map((h) => h.weight), mn = Math.min(...ws), mx = Math.max(...ws), rng = Math.max(mx - mn, 1)
    const dots = hist.map((h, i) => ({ x: Math.round(8 + i * (304 / Math.max(hist.length - 1, 1))), y: Math.round(108 - ((h.weight - mn) / rng) * 96) }))
    const delta = hist.length > 1 ? round1(hist.at(-1).weight - hist[0].weight) : 0
    chart = `
      <div class="pr-line"><div class="p">${stat.pr} ${u}</div><div class="muted" style="font-size:13px">personal record</div><div class="delta" style="color:${delta < 0 ? 'var(--danger)' : 'var(--success)'}">${delta > 0 ? '+' + delta + ' ' + u : delta < 0 ? delta + ' ' + u : ''}</div></div>
      <svg class="chart" viewBox="0 0 320 120" role="img" aria-label="${esc(stat.name)} weight over time"><line x1="0" y1="118" x2="320" y2="118" stroke="#ebeae4"></line>
        <polyline points="${dots.map((p) => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="#2f6fdd" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></polyline>
        ${dots.map((d) => `<circle cx="${d.x}" cy="${d.y}" r="4" fill="#fff" stroke="#2f6fdd" stroke-width="2.5"></circle>`).join('')}</svg>
      <div class="axis"><span>${esc(fmtDate(hist[0].date))}</span><span>Today</span></div>`
  }
  const b = S.body, n = S.nutrition, h = S.hikes
  return `
    <div class="h1" style="margin-top:8px">Stats</div>
    <div class="tiles">
      <div class="card tile"><div class="label-sm">Streak</div><div class="big">${L.streakWeeks}<small>${L.streakWeeks === 1 ? 'week' : 'weeks'}</small></div></div>
      <div class="card tile"><div class="label-sm">This week</div><div class="big">${Math.round(L.weekVolume).toLocaleString()}<small>${u}</small></div></div>
    </div>
    <div class="card chart-card">
      <div class="chips">${L.lifts.map((l) => `<button class="chip light${l.exerciseId === S.statId ? ' on' : ''}" data-act="selStat" data-id="${l.exerciseId}">${esc(l.name)}</button>`).join('')}</div>
      ${chart}
    </div>
    <div class="section"><div class="label">Personal records</div></div>
    <div class="card list">${L.lifts.length ? L.lifts.map((l) => `<div class="list-row"><div>${esc(l.name)}</div><div class="rv">${l.pr} ${u}</div><div class="rd">${l.prDate ? esc(fmtDate(l.prDate)) : ''}</div></div>`).join('') : '<div class="empty-state">No lifts logged yet.</div>'}</div>

    <div class="section"><div class="label">Belly check</div></div>
    <div class="card pad">
      <div class="two">
        <div><div class="label-sm">Waist</div><div style="font-size:24px;font-weight:700;margin-top:4px">${b.waist.latest ? b.waist.latest.value + '"' : '—'}</div><div class="muted" style="font-size:13px">${b.waist.change != null ? (b.waist.change > 0 ? '+' : '') + b.waist.change + '" since start' : 'Measure at the belly button'}</div></div>
        <div><div class="label-sm">Weight</div><div style="font-size:24px;font-weight:700;margin-top:4px">${b.weight.latest ? b.weight.latest.value + ' lb' : '—'}</div><div class="muted" style="font-size:13px">${b.weight.sevenDayAverage ? '7-day avg ' + b.weight.sevenDayAverage : 'Log weekly'}</div></div>
      </div>
      ${b.waistToHeight ? `<div class="hint muted">Waist-to-height ${b.waistToHeight} · target under 0.5${b.waistTargetIn ? ` (${b.waistTargetIn}")` : ''}</div>` : ''}
      <button class="btn light" style="margin-top:14px;background:var(--control)" data-act="openBody">Log weight &amp; waist</button>
    </div>

    <div class="section"><div class="label">Fuel</div></div>
    <div class="card pad">${n.ready ? `
      <div class="two">
        <div><div class="label-sm">Calories</div><div style="font-size:24px;font-weight:700;margin-top:4px">${n.calories.toLocaleString()}</div><div class="muted" style="font-size:13px">maintenance ${n.maintenanceCalories.toLocaleString()}</div></div>
        <div><div class="label-sm">Protein</div><div style="font-size:24px;font-weight:700;margin-top:4px">${n.macros.proteinG} g</div><div class="muted" style="font-size:13px">every day</div></div>
      </div>
      <div class="hint muted">About ${n.expectedWeeklyLossLb} lb a week. ${esc(n.tips[0])}</div>
      <div class="hint muted" style="font-size:11px">${esc(n.disclaimer)}</div>` : `<div class="muted" style="font-size:15px">${esc(n.message)}</div><button class="btn light" style="margin-top:12px;background:var(--control)" data-act="openSettings">Add in Settings</button>`}
    </div>

    <div class="section"><div class="label">Hikes</div></div>
    <div class="card pad"><div class="two">
      <div><div class="label-sm">Total</div><div style="font-size:24px;font-weight:700;margin-top:4px">${h.totalMiles} mi</div><div class="muted" style="font-size:13px">${h.hikes} hikes · ${Math.round(h.totalMinutes / 60)} h</div></div>
      <div><div class="label-sm">Climbed</div><div style="font-size:24px;font-weight:700;margin-top:4px">${Math.round(h.totalElevationFt).toLocaleString()} ft</div><div class="muted" style="font-size:13px">heaviest pack ${h.heaviestPackLb} lb</div></div>
    </div><button class="btn light" style="margin-top:14px;background:var(--control)" data-act="openHikeLog">Log a hike</button></div>
    <div class="credit">Cave photo: <a href="https://commons.wikimedia.org/wiki/File:Thors_cave,_view_from_inside.jpg" target="_blank" rel="noopener">Iankelsall1 · Wikimedia Commons</a></div>`
}

function viewBodyLog() {
  const f = S.form
  return `
    <div class="log-head"><button class="back" data-act="closeView" aria-label="Back">‹</button><div class="h2">Weight &amp; waist</div></div>
    <div class="card entry">
      <div class="label-sm">Weight</div>
      <div class="stepper-big"><button class="round" data-act="formAdj" data-k="weight" data-d="-0.5">−</button>
        <div class="big-val"><div class="v">${f.weight}</div><div class="u">lb</div></div><button class="round" data-act="formAdj" data-k="weight" data-d="0.5">+</button></div>
      <div class="label-sm" style="margin-top:18px">Waist at the belly button</div>
      <div class="stepper-big"><button class="round" data-act="formAdj" data-k="waist" data-d="-0.25">−</button>
        <div class="big-val"><div class="v">${f.waist}</div><div class="u">in</div></div><button class="round" data-act="formAdj" data-k="waist" data-d="0.25">+</button></div>
      <div class="hint muted">Same time of day each week, relaxed, tape level. The waist is the number that tells you the belly is going.</div>
      <button class="btn" data-act="saveBody" ${S.busy ? 'disabled' : ''}>Save</button>
    </div>`
}

function viewSettings(setup = false) {
  const f = S.form
  const chips = (k, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="chip light${String(f[k]) === String(v) ? ' on' : ''}" data-act="form" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`
  return `
    ${setup ? `<div class="eyebrow">The PainCave</div><div class="h1" style="margin-top:4px">Build your plan</div><div class="summary">Swim, hike and lose the belly in 12 weeks, using the machines your gym actually has.</div>`
      : `<div class="log-head"><button class="back" data-act="closeView" aria-label="Back">‹</button><div class="h2">Settings</div></div>`}
    <div class="card entry">
      <div class="field"><div class="label-sm">Your gyms</div>
        <label class="check"><input type="checkbox" data-bind="gym_pf" ${f.gym_pf ? 'checked' : ''}> Planet Fitness</label>
        <label class="check"><input type="checkbox" data-bind="gym_ymca" ${f.gym_ymca ? 'checked' : ''}> YMCA (pool)</label></div>
      <div class="field"><div class="label-sm">Training days per week</div>${chips('daysPerWeek', [[3, '3'], [4, '4'], [5, '5'], [6, '6']])}</div>
      <div class="field"><label class="label-sm" for="startDate">Start date (week 1 begins that Monday)</label><input class="input" type="date" id="startDate" data-bind="startDate" value="${esc(f.startDate)}"></div>
      <div class="field"><div class="label-sm">Your pool</div>${chips('pool', [['25yd', '25 yd'], ['25m', '25 m'], ['50m', '50 m']])}</div>
      <div class="field"><div class="label-sm">Weight units</div>${chips('units', [['lbs', 'lbs'], ['kg', 'kg']])}</div>
      <div class="field"><div class="label-sm">Weight step</div>${chips('weightStep', [[2.5, '2.5'], [5, '5'], [10, '10']])}</div>
    </div>
    <div class="card entry">
      <div class="label-sm">For calorie and protein targets (optional)</div>
      <div class="field">${chips('sex', [['male', 'Male'], ['female', 'Female']])}</div>
      <div class="two" style="margin-top:12px">
        <div class="field" style="margin-top:0"><label class="label-sm" for="age">Age</label><input class="input" id="age" inputmode="numeric" data-bind="age" value="${esc(f.age)}"></div>
        <div class="field" style="margin-top:0"><label class="label-sm" for="heightIn">Height (in)</label><input class="input" id="heightIn" inputmode="decimal" data-bind="heightIn" value="${esc(f.heightIn)}" placeholder="70"></div>
        <div class="field" style="margin-top:0"><label class="label-sm" for="weightLb">Weight (lb)</label><input class="input" id="weightLb" inputmode="decimal" data-bind="weightLb" value="${esc(f.weightLb)}"></div>
        <div class="field" style="margin-top:0"><label class="label-sm" for="goalWeightLb">Goal (lb)</label><input class="input" id="goalWeightLb" inputmode="decimal" data-bind="goalWeightLb" value="${esc(f.goalWeightLb)}"></div>
      </div>
    </div>
    ${S.needToken || local.get('token') ? `<div class="card entry"><div class="field"><label class="label-sm" for="token">Access token</label><input class="input" id="token" data-bind="token" value="${esc(f.token)}" autocomplete="off"></div></div>` : ''}
    <button class="btn" style="margin-top:18px" data-act="saveSettings" ${S.busy ? 'disabled' : ''}>${setup ? 'Build my plan' : 'Save settings'}</button>
    ${setup ? `<button class="btn ghost" style="margin-top:12px" data-act="restore">Restore from a backup</button>` : `
    <div class="card entry">
      <div class="label-sm">Your data</div>
      <div class="hint">${mode === 'phone' ? 'Saved on this phone only. Download a backup now and then (and before switching phones); restore it on any device.' : 'Saved on your PainCave server.'}${local.get('lastBackup') ? ` Last backup ${esc(fmtDate(local.get('lastBackup')))}.` : ''}</div>
      <div class="row-btns" style="margin-top:14px"><button class="btn" data-act="backup">Download backup</button><button class="btn light" style="background:var(--control)" data-act="restore">Restore</button></div>
    </div>
    <details class="card entry mini" style="color:var(--ink)"><summary style="color:var(--ink)">Photo credits</summary>
      <div style="margin-top:8px;color:var(--muted);line-height:1.5">${Object.values(PHOTOS.files).map((f) => `<div><a href="${esc(f.page)}" target="_blank" rel="noopener">${esc(f.title.replace(/^File:/, ''))}</a> · ${esc(f.artist || 'Unknown')} · ${f.licenseUrl ? `<a href="${esc(f.licenseUrl)}" target="_blank" rel="noopener">${esc(f.license)}</a>` : esc(f.license)}</div>`).join('') || 'No bundled photos.'}</div></details>`}
    <div class="credit">Cave photo: <a href="https://commons.wikimedia.org/wiki/File:Thors_cave,_view_from_inside.jpg" target="_blank" rel="noopener">Iankelsall1 · Wikimedia Commons</a></div>`
}

// ── Render ─────────────────────────────────────────────────────────────────────────────────────────────
const scrollPos = {}
let lastKey = null
function render() {
  const screen = $('#screen')
  const setup = !S.profile || S.profile.setup === false
  const key = setup ? 'setup' : S.view ?? S.tab
  if (lastKey) scrollPos[lastKey] = screen.scrollTop
  let html
  if (setup) html = viewSettings(true)
  else if (S.view === 'log') html = viewLog()
  else if (S.view === 'swimlog') html = viewSwimLog()
  else if (S.view === 'csstest') html = viewCss()
  else if (S.view === 'hikelog') html = viewHikeLog()
  else if (S.view === 'bodylog') html = viewBodyLog()
  else if (S.view === 'settings') html = viewSettings(false)
  else html = { today: viewToday, plan: viewPlan, swim: viewSwim, stats: viewStats }[S.tab]()
  screen.innerHTML = html
  screen.scrollTop = key === lastKey ? (scrollPos[key] ?? 0) : S.view ? 0 : (scrollPos[key] ?? 0)
  lastKey = key

  const tb = $('#tabbar')
  tb.hidden = setup
  const active = S.view === 'log' || S.view === 'settings' ? 'today' : S.view === 'swimlog' || S.view === 'csstest' ? 'swim' : S.view === 'bodylog' || S.view === 'hikelog' ? 'stats' : S.tab
  tb.innerHTML = `<div class="tabs">${[['today', 'Today'], ['plan', 'Plan'], ['swim', 'Swim'], ['stats', 'Stats']].map(([k, l]) => `<button class="tab${active === k ? ' on' : ''}" data-act="tab" data-tab="${k}">${l}</button>`).join('')}</div>`
}

// ── Actions ────────────────────────────────────────────────────────────────────────────────────────────
function settingsForm() {
  const p = S.profile ?? {}
  const gyms = p.gyms ?? ['planet-fitness', 'ymca']
  return {
    gym_pf: gyms.includes('planet-fitness'), gym_ymca: gyms.includes('ymca'),
    daysPerWeek: p.daysPerWeek ?? 5, startDate: p.setup === false || !p.startDate ? localDate() : p.startDate,
    pool: `${p.poolLength ?? 25}${p.poolUnit ?? 'yd'}`, units: p.units ?? 'lbs', weightStep: p.weightStep ?? 5,
    sex: p.sex ?? '', age: p.age ?? '', heightIn: p.heightIn ?? '', weightLb: p.weightLb ?? '', goalWeightLb: p.goalWeightLb ?? '',
    token: local.get('token') ?? '',
  }
}

async function openLog(c) {
  S.current = c
  S.view = 'log'
  S.entries = []
  render()
  try { S.entries = await api('GET', `/api/exercises/${c.exerciseId}/entries`) } catch (e) { toast(e.message, true) }
  const last = S.entries.at(-1)
  const p = c.prescription
  S.entry = {
    weight: c.suggestion?.weight ?? last?.weight ?? 0,
    reps: p ? (p.reps?.[1] ?? p.seconds ?? p.steps) : (last?.reps ?? 10),
    sets: p?.sets ?? last?.setCount ?? 3,
  }
  render()
}

function plannedBySlot(slot) {
  const t = S.today
  const e = t.session.exercises.find((x) => x.slot === slot)
  return { ...e, swaps: [{ exerciseId: e.exerciseId, name: e.name }, ...e.swaps], sessionKey: t.sessionKey, type: t.session.type, gymId: t.session.gymId, plannedId: e.exerciseId }
}

const actions = {
  noop() {},
  tab({ tab }) {
    S.tab = tab
    S.view = null
    for (const k of Object.keys(failed)) delete failed[k]
    if (tab === 'today') return refresh('today')
    if (tab === 'plan') { S.program = null; S.weekCache = {} }
    if (tab === 'stats') S.lifts = null
    if (tab === 'swim') S.swimStats = null
    render()
  },
  retry({ k }) { delete failed[k]; render() },
  goToday() { actions.tab({ tab: 'today' }) },
  closeView() { const back = S.view === 'swimlog' || S.view === 'csstest' ? 'swim' : S.view === 'bodylog' || S.view === 'hikelog' ? (S.tab === 'today' ? 'today' : 'stats') : S.tab; S.view = null; actions.tab({ tab: back }) },
  toggleAll() { S.showAll = !S.showAll; render() },
  openSettings() { S.form = settingsForm(); S.view = 'settings'; render() },
  openPlanned({ slot }) { openLog(plannedBySlot(slot)) },
  openFree({ id }) {
    const ex = S.allExercises.find((e) => e.id === id)
    const planned = S.today?.session?.exercises?.find((e) => e.exerciseId === id || e.swaps.some((x) => x.exerciseId === id))
    if (planned) { const c = plannedBySlot(planned.slot); c.exerciseId = id; c.name = ex.name; c.cues = ex.cues; openLog(c); return }
    openLog({ exerciseId: id, name: ex.name, cues: ex.cues, swaps: [], prescription: null, sessionKey: null, type: null, slot: ex.slots?.[0] ?? null })
  },
  swap({ id }) {
    const c = S.current
    const x = c.swaps.find((s) => s.exerciseId === id)
    const ex = S.allExercises?.find((e) => e.id === id)
    openLog({ ...c, exerciseId: id, name: x.name, cues: ex?.cues ?? (id === c.plannedId ? c.cues : []), suggestion: id === c.plannedId ? c.suggestion : null })
  },
  pickPhoto({ id }) { pickPhoto(id) },
  clearPhoto({ id }) { local.del('photo.' + id); render() },
  async backup() {
    try {
      const data = await api('GET', '/api/export')
      const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `paincave-backup-${localDate()}.json`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
      local.set('lastBackup', localDate())
      toast('Backup downloaded')
    } catch (e) { toast(e.message, true) }
  },
  restore() { $('#restoreInput').click() },
  adj({ k, d }) {
    const e = S.entry
    const dir = Number(d)
    if (k === 'weight') e.weight = Math.max(0, round1(e.weight + dir * step()))
    if (k === 'reps') e.reps = Math.max(1, e.reps + dir * amountStep(S.current.prescription))
    if (k === 'sets') e.sets = Math.max(1, e.sets + dir)
    render()
  },
  async saveSet() {
    const c = S.current, e = S.entry
    const one = c.prescription?.unit === 'seconds' ? { seconds: e.reps, weight: e.weight || null } : { reps: e.reps, weight: e.weight }
    const wasPr = e.weight > Math.max(0, ...S.entries.map((x) => x.weight)) && S.entries.length > 0
    S.busy = true; render()
    try {
      await api('POST', '/api/workouts', {
        date: localDate(), sessionKey: c.sessionKey, type: c.type, gymId: c.gymId,
        exercises: [{ exerciseId: c.exerciseId, slot: c.slot, sets: Array.from({ length: e.sets }, () => ({ ...one })) }],
      })
      S.entries = await api('GET', `/api/exercises/${c.exerciseId}/entries`)
      toast(wasPr ? 'New PR. Saved.' : 'Set saved')
      loadToday().then(() => { if (S.today?.session?.exercises) { const u = S.today.session.exercises.find((x) => x.slot === c.slot); if (u && u.done && S.today.completed) toast('Workout complete. Nice work.') } }).catch(() => {})
      S.lifts = null
    } catch (err) { toast(err.message, true) }
    S.busy = false; render()
  },
  async markDone() {
    const t = S.today
    S.busy = true
    try {
      await api('POST', '/api/workouts', { date: localDate(), sessionKey: t.sessionKey, type: t.session.type, gymId: t.session.gymId ?? null, cardio: t.session.cardio ?? null, exercises: [] })
      await loadToday(); toast('Logged. Nice work.')
    } catch (e) { toast(e.message, true) }
    S.busy = false; render()
  },
  async restartBlock() {
    try { S.profile = await api('PUT', '/api/profile', { startDate: localDate() }); S.program = null; await loadToday(); toast('New block started') } catch (e) { toast(e.message, true) }
    render()
  },
  selWeek({ w }) { S.weekSel = Number(w); render() },
  selStat({ id }) { S.statId = id; render() },

  openSwimLog({ planned }) {
    const p = S.profile
    const sw = planned ? S.today.session.swim : null
    S.form = { pool: `${p.poolLength}${p.poolUnit}`, distance: sw ? sw.totalDistance : 1000, min: 0, sec: 0, spl: 0, type: sw ? sw.kind : 'endurance', rpe: 5, continuous: false, planned: sw?.totalDistance ?? null, sessionKey: planned ? S.today.sessionKey : null }
    S.view = 'swimlog'; render()
  },
  openCss() { S.form = { t400: '', t200: '', sessionKey: S.today?.session?.swim?.blocks?.some((b) => b.name === 'CSS test') ? S.today.sessionKey : null }; S.view = 'csstest'; render() },
  openHikeLog({ planned }) {
    const o = planned ? S.today.session.outdoor : null
    S.form = { minutes: o?.minutes ?? 60, miles: 3, elev: 500, pack: o?.packLb ?? 0, indoor: false, trail: '', sessionKey: planned ? S.today.sessionKey : null }
    S.view = 'hikelog'; render()
  },
  openBody() {
    const b = S.body
    S.form = { weight: b?.weight.latest?.value ?? S.profile.weightLb ?? 180, waist: b?.waist.latest?.value ?? 36 }
    S.view = 'bodylog'; render()
  },
  form({ k, v }) { S.form[k] = ['daysPerWeek', 'weightStep', 'rpe'].includes(k) ? Number(v) : v; render() },
  formAdj({ k, d }) {
    const f = S.form
    const lim = { distance: [0, 20000], min: [0, 300], sec: [0, 55], spl: [0, 80], minutes: [0, 900], miles: [0, 60], elev: [0, 20000], pack: [0, 80], weight: [50, 600], waist: [20, 70] }[k]
    f[k] = Math.min(lim[1], Math.max(lim[0], round1(Number(f[k]) + Number(d))))
    if (k === 'waist') f[k] = Math.round(f[k] * 100) / 100
    render()
  },
  async saveSwim() {
    const f = S.form
    const durationSec = f.min * 60 + f.sec
    if (!f.distance) return toast('Add a distance', true)
    const body = { date: localDate(), distance: f.distance, durationSec: durationSec || undefined, type: f.pool === 'open' ? 'open_water' : f.type, rpe: f.rpe, continuous: f.continuous, sessionKey: f.sessionKey }
    if (f.pool === 'open') Object.assign(body, { environment: 'open_water', unit: 'm' })
    else Object.assign(body, { poolLength: Number(f.pool.replace(/\D/g, '')), poolUnit: f.pool.endsWith('yd') ? 'yd' : 'm', strokesPerLength: f.spl || undefined })
    S.busy = true; render()
    try {
      const s = await api('POST', '/api/swims', body)
      toast(s.metrics.pacePer100Text ? `Saved · ${s.metrics.pacePer100Text}` : 'Swim saved')
      S.view = null; S.tab = 'swim'; S.swimStats = null
    } catch (e) { toast(e.message, true) }
    S.busy = false; render()
  },
  async saveCss() {
    const f = S.form
    S.busy = true; render()
    try {
      const r = await api('POST', '/api/swims/css-test', { date: localDate(), t400: f.t400, t200: f.t200, sessionKey: f.sessionKey })
      toast(`CSS ${r.css.text}`)
      S.view = null; S.tab = 'swim'; S.swimStats = null
    } catch (e) { toast(e.message, true) }
    S.busy = false; render()
  },
  async delSwim({ id }) {
    if (!confirm('Delete this swim?')) return
    try { await api('DELETE', `/api/swims/${id}`); S.swimStats = null } catch (e) { toast(e.message, true) }
    render()
  },
  async saveHike() {
    const f = S.form
    S.busy = true; render()
    try {
      await api('POST', '/api/hikes', { date: localDate(), durationMin: f.minutes, distanceMi: f.miles, elevationGainFt: f.elev, packLb: f.pack, indoor: f.indoor, trail: f.trail, sessionKey: f.sessionKey })
      toast('Hike saved')
      const back = f.sessionKey ? 'today' : 'stats'
      S.view = null; S.lifts = null; actions.tab({ tab: back })
    } catch (e) { toast(e.message, true) }
    S.busy = false; render()
  },
  async saveBody() {
    S.busy = true; render()
    try {
      await api('POST', '/api/body', { date: localDate(), weightLb: S.form.weight, waistIn: S.form.waist })
      toast('Saved'); S.view = null; S.lifts = null; S.tab = 'stats'
    } catch (e) { toast(e.message, true) }
    S.busy = false; render()
  },
  async saveSettings() {
    const f = S.form
    if (f.token !== undefined && f.token !== (local.get('token') ?? '')) { f.token ? local.set('token', f.token.trim()) : local.del('token'); S.needToken = false }
    const gyms = [f.gym_pf && 'planet-fitness', f.gym_ymca && 'ymca'].filter(Boolean)
    if (!gyms.length) return toast('Pick at least one gym', true)
    const num = (v) => (v === '' || v == null ? undefined : Number(v))
    const body = {
      gyms, daysPerWeek: f.daysPerWeek, startDate: f.startDate, units: f.units, weightStep: f.weightStep,
      poolLength: Number(f.pool.replace(/\D/g, '')), poolUnit: f.pool.endsWith('yd') ? 'yd' : 'm', reportUnit: f.pool.endsWith('yd') ? 'yd' : 'm',
      sex: f.sex || undefined, age: num(f.age), heightIn: num(f.heightIn), weightLb: num(f.weightLb), goalWeightLb: num(f.goalWeightLb),
    }
    S.busy = true; render()
    try {
      S.profile = await api('PUT', '/api/profile', body)
      Object.assign(S, { view: null, tab: 'today', program: null, weekCache: {}, allExercises: null, lifts: null, swimStats: null, weekSel: null })
      await loadToday()
      toast('Plan updated')
    } catch (e) { toast(e.message, true) }
    S.busy = false; render()
  },
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]')
  if (!el) return
  const fn = actions[el.dataset.act]
  if (fn) fn(el.dataset, el)
})
document.addEventListener('input', (e) => {
  const k = e.target.dataset?.bind
  if (!k) return
  S.form[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value
  if (k === 't400' || k === 't200') {
    const a = parseTime(S.form.t400), b = parseTime(S.form.t200)
    const p = $('#cssPreview')
    if (p) p.textContent = a && b && a > b ? `CSS ${fmtTime((a - b) / 2)} per 100 ${S.profile.poolUnit}` : 'Enter both times'
  }
})
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.view && S.profile?.setup !== false) actions.closeView() })

$('#restoreInput').addEventListener('change', async (e) => {
  const f = e.target.files?.[0]
  e.target.value = ''
  if (!f) return
  try {
    const data = JSON.parse(await f.text())
    if (!confirm('Replace everything in PainCave with this backup?')) return
    const r = await api('POST', '/api/import', data)
    toast(`Restored ${r.imported.workouts} workouts, ${r.imported.swims} swims`)
    Object.assign(S, { view: null, tab: 'today', program: null, weekCache: {}, allExercises: null, lifts: null, swimStats: null, today: null })
    S.profile = await api('GET', '/api/profile')
    if (S.profile.setup === false) S.form = settingsForm()
  } catch (err) { toast(err.message.includes('JSON') ? 'That file is not a PainCave backup' : err.message, true) }
  render()
})

// ── Boot ───────────────────────────────────────────────────────────────────────────────────────────────
async function boot() {
  await detectMode()
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {})
  try {
    S.profile = await api('GET', '/api/profile')
    if (S.profile.setup === false) S.form = settingsForm()
    else await loadToday()
  } catch (e) {
    S.profile = { setup: false }
    S.form = settingsForm()
    toast(e.message, true)
  }
  render()
}
boot()
