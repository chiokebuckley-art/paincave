// The PainCave program: 12 weeks for someone who wants to swim, hike and lose the belly.
//
//   Weeks 1-4  Base   – learn the movements, build aerobic base, CSS test in week 1
//   Weeks 5-8  Build  – heavier strength, longer swims and hikes
//   Weeks 9-12 Peak   – strongest sets, the longest hike; week 12 ends with a mile swim and a CSS retest
//   Weeks 4 and 8 are deloads (about 60% of the volume) so the body can absorb the work.
//
// Each session is built from movement slots (see data/exercises.mjs); the generator picks the best exercise your gym
// actually has, and lists the swaps. See docs/RESEARCH.md for why the program is shaped this way.

import { EXERCISES, SLOTS, pickForSlot, canDo } from './data/exercises.mjs'
import { GYMS, availableAt } from './data/equipment.mjs'
import { swimSession } from './swim.mjs'

export const PROGRAM_WEEKS = 12
export const DELOAD_WEEKS = new Set([4, 8])
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** weekday index (0 = Monday) → session type, by training days per week. */
export const SCHEDULES = {
  3: { 0: 'lower', 2: 'swim_technique', 4: 'upper' },
  4: { 0: 'lower', 1: 'swim_technique', 3: 'upper', 5: 'hike_long' },
  5: { 0: 'lower', 1: 'swim_technique', 3: 'upper', 4: 'swim_endurance', 5: 'hike_long' },
  6: { 0: 'lower', 1: 'swim_technique', 2: 'hike_conditioning', 3: 'upper', 4: 'swim_endurance', 5: 'hike_long' },
}

export const SESSION_INFO = {
  lower: { title: 'Hike Legs', focus: 'Legs, glutes and trunk for climbing and the downhill' },
  upper: { title: 'Swim Pull', focus: 'Back, lats and shoulders for the freestyle pull, plus shoulder health' },
  swim_technique: { title: 'Swim: Technique', focus: 'Drills and controlled sets to swim further on less effort' },
  swim_endurance: { title: 'Swim: Endurance', focus: 'Aerobic swimming at a pace set from your CSS test' },
  hike_conditioning: { title: 'Climb Conditioning', focus: 'Uphill aerobic work on the stair climber or incline treadmill' },
  hike_long: { title: 'Long Hike', focus: 'Time on your feet: trail if you can, incline treadmill if you cannot' },
  rest: { title: 'Recovery', focus: 'Walk, stretch, sleep. Daily steps matter for fat loss.' },
}

const LOWER = [
  ['squat', 'main'], ['hinge', 'main'], ['single_leg', 'main'],
  ['hamstring', 'accessory'], ['calves', 'accessory'], ['hip_stability', 'accessory'], ['anti_rotation', 'core'],
]
const UPPER = [
  ['vertical_pull', 'main'], ['push', 'main'], ['horizontal_pull', 'main'], ['overhead', 'accessory'],
  ['swim_catch', 'accessory'], ['shoulder_health', 'accessory'], ['anti_extension', 'core'], ['streamline', 'core'],
]

export function phaseOf(week) {
  return week <= 4 ? 'base' : week <= 8 ? 'build' : 'peak'
}

const DOSE = {
  base: { main: { sets: 3, reps: [10, 12], rpe: 7, restSec: 90 }, accessory: { sets: 2, reps: [12, 15], rpe: 7, restSec: 60 }, core: { sets: 2, reps: [10, 12], seconds: 30, steps: 20, rpe: 7, restSec: 45 } },
  build: { main: { sets: 4, reps: [8, 10], rpe: 8, restSec: 120 }, accessory: { sets: 3, reps: [10, 12], rpe: 8, restSec: 60 }, core: { sets: 3, reps: [10, 12], seconds: 40, steps: 30, rpe: 8, restSec: 45 } },
  peak: { main: { sets: 4, reps: [6, 8], rpe: 8.5, restSec: 150 }, accessory: { sets: 3, reps: [10, 12], rpe: 8, restSec: 60 }, core: { sets: 3, reps: [12, 15], seconds: 45, steps: 40, rpe: 8, restSec: 45 } },
}

function dose(role, week, exercise) {
  const d = { ...DOSE[phaseOf(week)][role] }
  if (DELOAD_WEEKS.has(week)) {
    d.sets = Math.max(2, d.sets - 1)
    d.rpe = 6
  }
  const unit = exercise.unit ?? 'reps'
  const out = { sets: d.sets, rpe: d.rpe, restSec: d.restSec, unit, perSide: !!exercise.perSide }
  if (unit === 'seconds') out.seconds = d.seconds ?? 30
  else if (unit === 'steps') out.steps = d.steps ?? 20
  else out.reps = d.reps
  return out
}

/** Suggest a load from the last time the exercise was logged. */
export function suggestLoad(exerciseId, prescription, history = []) {
  const ex = EXERCISES[exerciseId]
  const last = history
    .filter((w) => w.exercises?.some((e) => e.exerciseId === exerciseId))
    .sort((a, b) => b.date.localeCompare(a.date))[0]
  if (!last) return null
  const entry = last.exercises.find((e) => e.exerciseId === exerciseId)
  const weighted = entry.sets.filter((s) => s.weight != null)
  if (!weighted.length) return { lastDate: last.date, lastSets: entry.sets, weight: null, reason: 'Last time was bodyweight.' }
  const topWeight = Math.max(...weighted.map((s) => s.weight))
  const atTop = entry.sets.filter((s) => s.weight === topWeight)
  const top = prescription.reps?.[1]
  const hitAll = top != null && atTop.length >= prescription.sets && atTop.every((s) => (s.reps ?? 0) >= top && (s.rpe == null || s.rpe <= 9))
  const inc = ex.increment ?? 5
  if (hitAll && inc !== 0) {
    const next = Math.max(0, topWeight + inc)
    return { lastDate: last.date, lastSets: entry.sets, weight: next, reason: inc < 0 ? `You hit every rep: take ${-inc} lb less assistance.` : `You hit every rep: add ${inc} lb.` }
  }
  return { lastDate: last.date, lastSets: entry.sets, weight: topWeight, reason: 'Stay at this weight until every set reaches the top of the rep range.' }
}

/** Score how well a gym serves a list of slots (higher = more first choices available). */
function gymScore(gymId, slots, overrides) {
  const avail = availableAt(gymId, overrides)
  return slots.reduce((acc, [slot]) => {
    const i = SLOTS[slot].findIndex((id) => canDo(EXERCISES[id], avail))
    return acc + (i < 0 ? -10 : SLOTS[slot].length - i)
  }, 0)
}

function chooseGym(type, profile) {
  const gyms = profile.gyms
  const ov = profile.equipmentOverrides ?? {}
  if (type.startsWith('swim')) return gyms.find((g) => availableAt(g, ov).has('lap_pool')) ?? null
  if (profile.preferredGym?.[type] && gyms.includes(profile.preferredGym[type])) return profile.preferredGym[type]
  if (type === 'lower' || type === 'upper') {
    const slots = type === 'lower' ? LOWER : UPPER
    return [...gyms].sort((a, b) => gymScore(b, slots, ov) - gymScore(a, slots, ov))[0]
  }
  return gyms.find((g) => availableAt(g, ov).has('stair_climber')) ?? gyms[0]
}

function strengthSession(type, week, gymId, profile, history) {
  const avail = availableAt(gymId, profile.equipmentOverrides ?? {})
  const slots = type === 'lower' ? LOWER : UPPER
  const exercises = []
  const missing = []
  for (const [slot, role] of slots) {
    const pick = pickForSlot(slot, avail)
    if (!pick) {
      missing.push(slot)
      continue
    }
    const ex = EXERCISES[pick.exerciseId]
    const prescription = dose(role, week, ex)
    exercises.push({
      slot, role, exerciseId: pick.exerciseId, name: ex.name, muscles: ex.muscles, cues: ex.cues,
      equipment: [...ex.equipment, ...(ex.anyOf ? [ex.anyOf.find((e) => avail.has(e))] : [])],
      prescription,
      suggestion: suggestLoad(pick.exerciseId, prescription, history),
      swaps: pick.swaps.map((id) => ({ exerciseId: id, name: EXERCISES[id].name })),
    })
  }
  const warmup = type === 'lower'
    ? ['5 min incline treadmill walk or bike', '10 bodyweight squats', '10 glute bridges', '5 leg swings each way']
    : ['5 min rower or elliptical', '10 band or light-cable pull-aparts', '10 arm circles each way', '5 slow push-ups']
  const finisher = type === 'lower' && phaseOf(week) !== 'base' && !DELOAD_WEEKS.has(week)
    ? cardioPick(avail, 'finisher', week)
    : null
  return { warmup, exercises, finisher, missingSlots: missing }
}

const CARDIO_ORDER = ['stair_climber', 'treadmill', 'arc_trainer', 'elliptical', 'upright_bike']

function cardioPick(avail, kind, week) {
  const machine = CARDIO_ORDER.find((m) => avail.has(m))
  if (!machine) return { machine: null, plan: 'Brisk walk outdoors, hills if you have them.' }
  const phase = phaseOf(week)
  const deload = DELOAD_WEEKS.has(week)
  if (kind === 'finisher') {
    return { machine, minutes: 10, plan: machine === 'stair_climber' ? '10 min: alternate 1 min fast / 1 min steady' : '10 min: alternate 1 min at 12-15% incline / 1 min at 5%' }
  }
  // Conditioning day: Zone 2 build, intervals added from the Build phase on.
  const minutes = [30, 35, 40, 25, 40, 45, 50, 30, 50, 55, 60, 35][week - 1]
  const plan = {
    stair_climber: phase === 'base' || deload
      ? `${minutes} min steady at a pace where you can still talk in full sentences (Zone 2)`
      : `${minutes} min: 10 min steady, then ${Math.round((minutes - 15) / 5)} rounds of 3 min hard / 2 min easy, 5 min easy`,
    treadmill: phase === 'base' || deload
      ? `${minutes} min walking at 8-12% incline, 2.5-3.2 mph, no holding the rails (Zone 2)`
      : `${minutes} min walking at 12-15% incline, 2.8-3.4 mph; add a 10-20 lb pack if your gym allows it`,
    arc_trainer: `${minutes} min, incline high, steady Zone 2`,
    elliptical: `${minutes} min, ramp/incline high, steady Zone 2`,
    upright_bike: `${minutes} min steady Zone 2`,
  }[machine]
  return { machine, minutes, plan, zone: 'Zone 2: about 60-70% of max heart rate, nose-breathing pace' }
}

function hikeLong(week, profile) {
  const minutes = [60, 75, 90, 60, 105, 120, 135, 90, 150, 165, 180, 120][week - 1]
  const packLb = [0, 5, 10, 0, 10, 15, 15, 5, 20, 20, 20, 10][week - 1]
  const gymId = chooseGym('hike_conditioning', profile)
  const avail = gymId ? availableAt(gymId, profile.equipmentOverrides ?? {}) : new Set()
  return {
    outdoor: { minutes, packLb, plan: `Hike ${minutes} min with a ${packLb ? packLb + ' lb' : 'light'} pack. Pick a trail with real climbing; keep it conversational on the ups.` },
    indoorFallback: { gymId, ...cardioPick(avail, 'conditioning', week), minutes: Math.min(minutes, 75), note: 'If you cannot get outside: treadmill at 10-15% incline. Log it as a hike with indoor: true.' },
  }
}

function drylandSwim(week, profile) {
  const gymId = profile.gyms[0]
  const avail = availableAt(gymId, profile.equipmentOverrides ?? {})
  const pull = pickForSlot('swim_catch', avail)
  const machine = avail.has('rower') ? 'rower' : avail.has('elliptical') ? 'elliptical' : 'treadmill'
  return {
    gymId,
    warning: 'None of your gyms has a lap pool (Planet Fitness has none). This is a dryland stand-in; add a YMCA or other pool to your profile to get swim workouts.',
    blocks: [
      { name: 'Aerobic', plan: `${20 + Math.min(week, 8) * 2} min ${machine}, steady with 6 x 1 min harder` },
      { name: 'Circuit (3 rounds)', exercises: [pull && EXERCISES[pull.exerciseId].name, 'Hollow body hold 30 s', 'Prone flutter kick 30 s', 'Dead bug 10 per side'].filter(Boolean) },
    ],
  }
}

function mondayOnOrBefore(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d
}

function addDays(d, n) {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + n)
  return x.toISOString().slice(0, 10)
}

/** Build one session. ctx = { history, cssPer100 } */
export function buildSession(type, week, profile, ctx = {}) {
  const info = SESSION_INFO[type]
  const deload = DELOAD_WEEKS.has(week)
  const base = { type, ...info, phase: phaseOf(week), deload }
  if (type === 'rest') return { ...base, plan: 'Easy walk 30-45 min or 8,000-10,000 steps; 10 min of hip and shoulder mobility.' }
  if (type === 'lower' || type === 'upper') {
    const gymId = chooseGym(type, profile)
    return { ...base, gymId, gymName: GYMS[gymId].name, estMinutes: 55, ...strengthSession(type, week, gymId, profile, ctx.history ?? []) }
  }
  if (type === 'swim_technique' || type === 'swim_endurance') {
    const gymId = chooseGym(type, profile)
    if (!gymId) return { ...base, title: base.title + ' (dryland)', ...drylandSwim(week, profile) }
    const kind = type === 'swim_technique' ? 'technique' : 'endurance'
    return {
      ...base, gymId, gymName: GYMS[gymId].name, estMinutes: 45,
      swim: swimSession(kind, week, { poolLength: profile.poolLength ?? 25, poolUnit: profile.poolUnit ?? 'yd', cssPer100: ctx.cssPer100 ?? null, deload }),
    }
  }
  if (type === 'hike_conditioning') {
    const gymId = chooseGym(type, profile)
    const avail = availableAt(gymId, profile.equipmentOverrides ?? {})
    return { ...base, gymId, gymName: GYMS[gymId].name, cardio: cardioPick(avail, 'conditioning', week), core: ['Side plank 3 x 30 s per side', 'Dead bug 3 x 10 per side'] }
  }
  if (type === 'hike_long') return { ...base, ...hikeLong(week, profile) }
  throw new Error(`Unknown session type: ${type}`)
}

export function weekPlan(week, profile, ctx = {}) {
  if (!(week >= 1 && week <= PROGRAM_WEEKS)) throw Object.assign(new Error(`week must be 1-${PROGRAM_WEEKS}`), { status: 400 })
  const schedule = SCHEDULES[profile.daysPerWeek] ?? SCHEDULES[5]
  const monday = mondayOnOrBefore(profile.startDate)
  const days = WEEKDAYS.map((weekday, i) => {
    const type = schedule[i] ?? 'rest'
    return { sessionKey: `w${week}d${i}`, week, dayIndex: i, weekday, date: addDays(monday, (week - 1) * 7 + i), session: buildSession(type, week, profile, ctx) }
  })
  return {
    week, phase: phaseOf(week), deload: DELOAD_WEEKS.has(week),
    note: DELOAD_WEEKS.has(week) ? 'Deload week: lighter and shorter on purpose. Do not make it up.' : week === 12 ? 'Test week: mile swim, CSS retest and your longest hike of the block.' : null,
    days,
  }
}

export function programOverview(profile) {
  const schedule = SCHEDULES[profile.daysPerWeek] ?? SCHEDULES[5]
  return {
    name: 'PainCave Swim + Hike + Lean',
    weeks: PROGRAM_WEEKS,
    startDate: mondayOnOrBefore(profile.startDate).toISOString().slice(0, 10),
    daysPerWeek: profile.daysPerWeek,
    phases: [
      { name: 'base', weeks: [1, 2, 3, 4], goal: 'Learn the lifts, build aerobic base, CSS test' },
      { name: 'build', weeks: [5, 6, 7, 8], goal: 'Heavier strength, longer swims, pack on the hikes' },
      { name: 'peak', weeks: [9, 10, 11, 12], goal: 'Strongest sets, longest hike, mile swim and CSS retest' },
    ],
    deloadWeeks: [...DELOAD_WEEKS],
    weeklyTemplate: WEEKDAYS.map((d, i) => ({ weekday: d, type: schedule[i] ?? 'rest', title: SESSION_INFO[schedule[i] ?? 'rest'].title })),
  }
}

/** Where a date falls in the program. */
export function locate(profile, dateStr) {
  const monday = mondayOnOrBefore(profile.startDate)
  const diff = Math.floor((new Date(dateStr + 'T00:00:00Z') - monday) / 86400000)
  if (diff < 0) return { status: 'not_started', startsOn: monday.toISOString().slice(0, 10) }
  const week = Math.floor(diff / 7) + 1
  if (week > PROGRAM_WEEKS) return { status: 'complete', week }
  return { status: 'active', week, dayIndex: diff % 7 }
}
