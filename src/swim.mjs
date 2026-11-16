// Swim tracking maths and swim session plans.
//
// Distances are stored in the unit you swam in and converted to metres for totals. Pace is seconds per 100 of a unit.
// CSS (critical swim speed) comes from a 400 and a 200 time trial: CSS pace per 100 = (t400 - t200) / 2.

export const YD_TO_M = 0.9144
export const SWIMMERS_MILE = { yd: 1650, m: 1500 } // the "pool mile" most clubs and meets use

export function toMeters(distance, unit) {
  if (unit === 'm') return distance
  if (unit === 'yd') return distance * YD_TO_M
  throw new Error(`Unknown unit: ${unit}`)
}

export function fromMeters(meters, unit) {
  return unit === 'yd' ? meters / YD_TO_M : meters
}

const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d

/** "1:42" for 102 seconds; hours appear when needed. */
export function formatTime(sec) {
  if (sec == null || !Number.isFinite(sec)) return null
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`
}

/** Accepts seconds as a number or "m:ss" / "h:mm:ss" strings. */
export function parseTime(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v
  const parts = String(v).trim().split(':').map(Number)
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) throw new Error(`Bad time: ${v}`)
  return parts.reduce((acc, p) => acc * 60 + p, 0)
}

/** Validates and normalises a swim log entry; throws with a readable message on bad input. */
export function normalizeSwim(input) {
  const errors = []
  const s = { ...input }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date ?? '')) errors.push('date must be YYYY-MM-DD')
  s.environment = s.environment ?? (s.poolLength ? 'pool' : 'open_water')
  if (s.environment === 'pool') {
    s.poolLength = Number(s.poolLength ?? 25)
    s.poolUnit = s.poolUnit ?? 'yd'
    if (!(s.poolLength > 0)) errors.push('poolLength must be positive')
    s.unit = s.poolUnit
  } else {
    s.unit = s.unit ?? 'm'
    delete s.poolLength
    delete s.poolUnit
  }
  if (!['yd', 'm'].includes(s.unit)) errors.push('unit / poolUnit must be "yd" or "m"')

  s.sets = (s.sets ?? []).map((set, i) => {
    const out = {
      reps: Number(set.reps ?? 1),
      distance: Number(set.distance),
      stroke: set.stroke ?? 'freestyle',
      timeSec: parseTime(set.timeSec ?? set.time),
      restSec: parseTime(set.restSec ?? set.rest) ?? 0,
      equipment: set.equipment ?? [],
      note: set.note,
    }
    if (!(out.reps >= 1) || !(out.distance > 0)) errors.push(`sets[${i}] needs reps >= 1 and a positive distance`)
    return out
  })

  if (s.lengths != null && s.environment === 'pool') s.distance = Number(s.lengths) * s.poolLength
  if (s.distance == null && s.sets.length) s.distance = s.sets.reduce((a, x) => a + x.reps * x.distance, 0)
  s.distance = Number(s.distance)
  if (!(s.distance > 0)) errors.push('give distance, lengths, or sets')
  s.durationSec = parseTime(s.durationSec ?? s.duration)
  if (s.durationSec != null && !(s.durationSec > 0)) errors.push('duration must be positive')
  if (s.rpe != null && !(s.rpe >= 1 && s.rpe <= 10)) errors.push('rpe must be 1-10')
  if (s.strokesPerLength != null) s.strokesPerLength = Number(s.strokesPerLength)
  s.type = s.type ?? 'other' // technique | endurance | css_test | open_water | other
  if (errors.length) {
    const e = new Error(errors.join('; '))
    e.status = 400
    throw e
  }
  return s
}

/** Derived numbers for one logged swim. */
export function swimMetrics(s) {
  const meters = toMeters(s.distance, s.unit)
  const m = {
    distanceMeters: round(meters, 0),
    distanceYards: round(fromMeters(meters, 'yd'), 0),
    lengths: s.environment === 'pool' ? round(s.distance / s.poolLength, 0) : null,
    pacePer100: null,
    pacePer100Text: null,
    swolf: null,
    bestRepPacePer100: null,
  }
  if (s.durationSec) {
    m.pacePer100 = round((s.durationSec / s.distance) * 100, 1)
    m.pacePer100Text = `${formatTime(m.pacePer100)} /100${s.unit}`
  }
  if (s.environment === 'pool' && s.strokesPerLength && s.durationSec) {
    m.swolf = round((s.durationSec / (s.distance / s.poolLength)) + s.strokesPerLength, 0)
  }
  const timed = s.sets.filter((x) => x.timeSec && x.stroke === 'freestyle' && x.distance >= 100)
  if (timed.length) m.bestRepPacePer100 = round(Math.min(...timed.map((x) => (x.timeSec / x.distance) * 100)), 1)
  return m
}

/** CSS from 400 and 200 time trials (same unit). Returns seconds per 100. */
export function criticalSwimSpeed(t400, t200) {
  const a = parseTime(t400)
  const b = parseTime(t200)
  if (!(a > 0 && b > 0) || a <= b) {
    const e = new Error('The 400 time must be longer than the 200 time')
    e.status = 400
    throw e
  }
  return round((a - b) / 2, 1)
}

function isoWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  const day = (d.getUTCDay() + 6) % 7 // Monday = 0
  d.setUTCDate(d.getUTCDate() - day)
  return d.toISOString().slice(0, 10)
}

/** Totals, weekly trend, bests and milestone progress. `unit` is the unit you want numbers reported in. */
export function swimStats(swims, { unit = 'yd', today = new Date().toISOString().slice(0, 10), weeks = 12 } = {}) {
  const withM = swims.map((s) => ({ s, m: swimMetrics(s), meters: toMeters(s.distance, s.unit) }))
  const total = withM.reduce((a, x) => a + x.meters, 0)
  const thisWeek = isoWeekStart(today)

  const byWeek = new Map()
  const start = new Date(thisWeek + 'T00:00:00Z')
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(start)
    d.setUTCDate(d.getUTCDate() - i * 7)
    byWeek.set(d.toISOString().slice(0, 10), { meters: 0, sessions: 0, seconds: 0 })
  }
  for (const { s, meters } of withM) {
    const w = byWeek.get(isoWeekStart(s.date))
    if (!w) continue
    w.meters += meters
    w.sessions += 1
    w.seconds += s.durationSec ?? 0
  }
  const conv = (meters) => round(fromMeters(meters, unit), 0)

  const paced = withM.filter((x) => x.m.pacePer100 && x.s.environment === 'pool')
  const paceIn = (x) => (x.m.pacePer100 * (x.s.unit === unit ? 1 : x.s.unit === 'm' ? YD_TO_M : 1 / YD_TO_M))
  const bestPace = paced.length ? paced.reduce((b, x) => (paceIn(x) < paceIn(b) ? x : b)) : null
  const longest = withM.length ? withM.reduce((b, x) => (x.meters > b.meters ? x : b)) : null

  const cssTests = swims.filter((s) => s.type === 'css_test' && s.cssPer100).sort((a, b) => a.date.localeCompare(b.date))
  const mileM = toMeters(SWIMMERS_MILE[unit], unit)
  const longestContinuous = Math.max(
    0,
    ...withM.filter((x) => x.s.continuous).map((x) => x.meters),
    ...withM.flatMap((x) => x.s.sets.map((set) => toMeters(set.distance, x.s.unit))),
  )

  return {
    unit,
    sessions: swims.length,
    totalDistance: conv(total),
    totalTimeSec: swims.reduce((a, s) => a + (s.durationSec ?? 0), 0),
    thisWeek: (() => {
      const w = byWeek.get(thisWeek)
      return { distance: conv(w.meters), sessions: w.sessions, timeSec: w.seconds }
    })(),
    weekly: [...byWeek].map(([weekOf, w]) => ({ weekOf, distance: conv(w.meters), sessions: w.sessions, timeSec: w.seconds })),
    bestPacePer100: bestPace ? { seconds: round(paceIn(bestPace), 1), text: formatTime(paceIn(bestPace)), date: bestPace.s.date, swimId: bestPace.s.id } : null,
    longestSwim: longest ? { distance: conv(longest.meters), date: longest.s.date, swimId: longest.s.id } : null,
    css: cssTests.length
      ? { per100: cssTests.at(-1).cssPer100, text: formatTime(cssTests.at(-1).cssPer100), unit: cssTests.at(-1).unit, date: cssTests.at(-1).date, history: cssTests.map((t) => ({ date: t.date, per100: t.cssPer100 })) }
      : null,
    milestones: [
      { id: 'continuous_mile', label: `Swim a mile (${SWIMMERS_MILE[unit]} ${unit}) without stopping`, progress: round(Math.min(1, longestContinuous / mileM), 2) },
      { id: 'weekly_3000', label: `Swim 3000 ${unit} in one week`, progress: round(Math.min(1, Math.max(...[...byWeek.values()].map((w) => w.meters)) / toMeters(3000, unit)), 2) },
    ],
  }
}

// ── Swim session plans ──────────────────────────────────────────────────────────────────────────────────

const roundToPool = (d, poolLength) => Math.max(poolLength, Math.round(d / poolLength) * poolLength)

const DRILLS = [
  { name: 'Kick on your side with a kickboard or one arm out (6 kicks, then rotate)', why: 'body rotation and balance' },
  { name: 'Catch-up freestyle', why: 'long stroke and a full catch' },
  { name: 'Fingertip drag', why: 'high elbow recovery, relaxed shoulders' },
  { name: 'Kickboard flutter kick', why: 'kick from the hips: hiking glutes help here' },
]

/**
 * The swim workout for a week of the program. kind = "technique" | "endurance".
 * cssPer100 (seconds, in the pool unit) sets interval targets when known.
 */
export function swimSession(kind, week, { poolLength = 25, poolUnit = 'yd', cssPer100 = null, deload = false } = {}) {
  const P = (d) => roundToPool(d, poolLength)
  const phase = week <= 4 ? 'base' : week <= 8 ? 'build' : 'peak'
  const scale = deload ? 0.6 : 1
  const target = (offset) => (cssPer100 ? `${formatTime(cssPer100 + offset)} per 100${poolUnit}` : null)
  const blocks = []

  if (kind === 'technique') {
    if (week === 1 || week === 12) {
      blocks.push({ name: 'Warm-up', sets: [{ reps: 1, distance: P(300), stroke: 'mixed', effort: 'easy' }] })
      blocks.push({
        name: 'CSS test',
        note: 'Swim the 400 all-out but even, rest 5-10 minutes easy, then swim the 200 all-out. Log both times with POST /api/swims/css-test.',
        sets: [
          { reps: 1, distance: P(400), stroke: 'freestyle', effort: 'time trial' },
          { reps: 1, distance: P(200), stroke: 'freestyle', effort: 'time trial', restBefore: '5-10 min easy' },
        ],
      })
      blocks.push({ name: 'Cool-down', sets: [{ reps: 1, distance: P(200), stroke: 'mixed', effort: 'easy' }] })
    } else {
      const drillReps = deload ? 4 : phase === 'base' ? 8 : 6
      blocks.push({ name: 'Warm-up', sets: [{ reps: 1, distance: P(200), stroke: 'mixed', effort: 'easy' }] })
      blocks.push({
        name: 'Drills',
        sets: Array.from({ length: drillReps }, (_, i) => ({ reps: 1, distance: P(50), stroke: 'drill', drill: DRILLS[i % DRILLS.length].name, why: DRILLS[i % DRILLS.length].why, restSec: 20 })),
      })
      const main = { base: { reps: 8, distance: 50, rest: 30 }, build: { reps: 6, distance: 100, rest: 20 }, peak: { reps: 5, distance: 200, rest: 30 } }[phase]
      blocks.push({
        name: 'Main set',
        note: 'Count strokes on one length per rep. Fewer strokes at the same speed means better technique.',
        sets: [{ reps: Math.max(2, Math.round(main.reps * scale)), distance: P(main.distance), stroke: 'freestyle', effort: 'moderate', restSec: main.rest, target: target(8) }],
      })
      blocks.push({ name: 'Cool-down', sets: [{ reps: 1, distance: P(100), stroke: 'backstroke or easy free', effort: 'easy' }] })
    }
  } else if (kind === 'endurance') {
    // Main-set volume by week, in the pool unit. Week 12 is the swimmer's-mile test.
    const MAIN = [400, 500, 600, 400, 700, 800, 900, 600, 1000, 1100, 1200, SWIMMERS_MILE[poolUnit]]
    const mainTotal = MAIN[Math.min(week, 12) - 1]
    blocks.push({ name: 'Warm-up', sets: [{ reps: 1, distance: P(300), stroke: 'mixed', effort: 'easy', note: '100 swim, 100 kick, 100 pull' }] })
    if (week === 12) {
      blocks.push({ name: 'The mile', note: 'Swim it continuously at a steady pace. Log it with continuous: true.', sets: [{ reps: 1, distance: mainTotal, stroke: 'freestyle', effort: 'steady', target: target(5) }] })
    } else {
      const rep = phase === 'base' ? 100 : phase === 'build' ? 200 : 300
      const reps = Math.max(2, Math.round(mainTotal / rep))
      const offset = phase === 'base' ? 6 : phase === 'build' ? 4 : 2
      blocks.push({
        name: 'Main set',
        note: phase === 'peak' ? 'Hold the same pace on every rep. The last rep should feel hard but controlled.' : 'Aerobic pace: you could keep going if the set were longer.',
        sets: [{ reps, distance: P(rep), stroke: 'freestyle', effort: 'steady', restSec: phase === 'base' ? 20 : 15, target: target(offset) }],
      })
      if (!deload && phase !== 'base') {
        blocks.push({ name: 'Pull', sets: [{ reps: 4, distance: P(50), stroke: 'freestyle', equipment: ['pull_buoy'], effort: 'moderate', restSec: 15, note: 'Pull buoy between the thighs: arms only' }] })
      }
    }
    blocks.push({ name: 'Cool-down', sets: [{ reps: 1, distance: P(200), stroke: 'mixed', effort: 'easy' }] })
  } else {
    throw new Error(`Unknown swim session kind: ${kind}`)
  }

  const totalDistance = blocks.reduce((a, b) => a + b.sets.reduce((x, s) => x + s.reps * s.distance, 0), 0)
  return { kind, phase, poolLength, poolUnit, totalDistance, blocks }
}
