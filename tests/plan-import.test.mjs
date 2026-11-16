// Plan import, tested on a small made-up document laid out like a typical plan PDF (no personal content).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { importPlan, parseDose, exerciseIdFor, validatePlan } from '../src/plan-import.mjs'
import { planSuggestion } from '../src/program.mjs'
import { createRouter } from '../src/api.mjs'
import { BrowserStore } from '../src/browser-store.mjs'

// line(page, y, h, [x, text], [x, text]...) → pdf.js-like text items
const items = []
const line = (page, y, h, ...cells) => cells.forEach(([x, str]) => items.push({ page, x, y, h, str }))
// Page 1: title
line(1, 700, 26, [48, 'Test Strength Plan'])
line(1, 660, 11, [48, 'A flexible 12-week plan for testing.'])
line(1, 600, 10.2, [48, 'Safety notes that must not be imported.'])
// Page 2: framework + strength routine
line(2, 729, 9, [48, '02 / FRAMEWORK'])
line(2, 690, 26, [48, 'Your week'])
line(2, 631, 8.8, [57, 'DAY'], [148, 'FOCUS'], [428, 'TOTAL VISIT BUDGET'])
line(2, 607, 9.2, [57, '1 / Monday'], [148, 'Full-body A: legs and back'], [428, '35-50 min'])
line(2, 583, 9.2, [57, '2 / Wednesday'], [148, 'Easy walking'], [428, '25-40 min'])
line(2, 559, 9.2, [57, 'Weekend'], [148, 'Recovery'], [428, 'Optional normal activity'])
line(2, 392, 12.5, [48, 'Before and after each strength visit'])
line(2, 373, 10.2, [48, 'Warm up, 6-8 min:'], [139, '3-5 min easy bike.'])
line(2, 359, 10.2, [48, 'Effort:'], [81, 'leave at least 4 reps in reserve.'])
line(2, 345, 10.2, [48, 'Rest:'], [76, '90-120 sec.'], [140, 'Cool down:'], [200, '5 min easy walking.'])
// Page 3: strength day
line(3, 729, 9, [48, '03 / DAY 1 / STRENGTH A'])
line(3, 690, 26, [48, 'Build your foundation'])
line(3, 664, 11, [48, 'Legs and back.'])
line(3, 595, 12.5, [72, 'First visit dose'])
line(3, 575, 10.2, [72, 'Use just the first 2 exercises: 1 set each, 8 controlled reps, at least 4 RIR.'])
line(3, 509, 8.8, [57, 'EXERCISE'], [216, 'LATER OPTION'], [307, 'REST'], [373, 'FORM CUE'])
line(3, 485, 8.7, [57, 'Leg press'], [216, '1-2 x 8-12'], [307, '90-120 s'], [373, 'Feet comfortable; do not'])
line(3, 474, 8.7, [373, 'lock knees.'])
line(3, 450, 8.7, [57, 'Seated row'], [216, '1-2 x 8-12'], [307, '90-120 s'], [373, 'Chest tall.'])
line(3, 415, 8.7, [57, 'Dead bug heel slide'], [216, '1 x 5-8/side'], [307, '60-90 s'], [373, 'Keep breathing.'])
line(3, 380, 8.7, [57, 'Farmer hold'], [216, '1 x 20-30 sec'], [307, '60 s'], [373, 'Tall posture.'])
line(3, 281, 12.5, [48, 'YMCA / Planet Fitness alternatives'])
line(3, 262, 10.2, [48, 'Leg press: supported sit-to-stand. Row: chest-supported dumbbell row.'])
// Page 4: conditioning day
line(4, 729, 9, [48, '04 / DAY 2 / WALKING'])
line(4, 690, 26, [48, 'Easy endurance'])
line(4, 600, 8.8, [57, 'BLOCK'], [218, 'STARTING OPTION'], [480, 'LATER OPTION - ONLY IF TOLERATED'])
line(4, 576, 8.7, [57, 'Warmup'], [218, '3-5 min easy walking.'], [480, 'Same.'])
line(4, 552, 8.7, [57, 'Main'], [218, '5 min level walking.'], [480, '10-20 min.'])
// Page 5: review + overload rule
line(5, 729, 9, [48, '05 / 12-WEEK PROCESS'])
line(5, 690, 26, [48, 'Progress'])
line(5, 640, 8.8, [57, 'REVIEW'], [196, 'IF NOT CLEARED'], [478, 'IF CLEARED, STABLE'])
line(5, 616, 8.7, [57, 'Weeks 1-2'], [196, 'Observe.'], [478, 'Learn equipment.'])
line(5, 605, 8.7, [57, 'Establish baseline'])
line(5, 580, 8.7, [57, 'Weeks 3-12'], [196, 'Keep pacing.'], [478, 'Repeat tolerated sessions.'])
line(5, 569, 8.7, [57, 'Build'])
line(5, 520, 12.5, [48, 'The conditional overload rule'])
line(5, 500, 10.2, [48, 'Change one variable at a time.'])
line(5, 486, 10.2, [48, 'Reps first:'], [110, 'add 1 rep while keeping 3-4 RIR.'])
line(5, 472, 10.2, [48, 'Sets:'], [80, 'add one set to one lift.'])
line(5, 458, 10.2, [48, 'Conditioning:'], [120, 'add 1-2 easy minutes.'])

test('dose text', () => {
  assert.deepEqual(parseDose('1-2 x 8-12'), { sets: [1, 2], reps: [8, 12], unit: 'reps', perSide: false, text: '1-2 x 8-12' })
  assert.equal(parseDose('1 x 5-8/side').perSide, true)
  assert.deepEqual(parseDose('1 x 20-30 sec').seconds, [20, 30])
  assert.equal(exerciseIdFor('Lat pulldown, neutral grip'), 'lat_pulldown')
  assert.equal(exerciseIdFor('Farmer hold'), 'custom-farmer-hold')
})

test('imports only the workouts', () => {
  const p = importPlan(items, { fileName: 't.pdf' })
  assert.equal(p.name, 'Test Strength Plan')
  assert.equal(p.weeks, 12)
  assert.deepEqual(p.schedule.map((d) => d.session ?? null), ['day1', null, 'day2', null, null, null, null])
  const a = p.sessions.day1
  assert.equal(a.kind, 'strength')
  assert.equal(a.firstVisitCount, 2)
  assert.deepEqual(a.exercises.map((e) => e.exerciseId), ['leg_press', 'seated_row_machine', 'dead_bug_heel_slide', 'custom-farmer-hold'])
  assert.equal(a.exercises[0].cue, 'Feet comfortable; do not lock knees.')
  assert.equal(a.exercises[0].alternative, 'supported sit-to-stand')
  assert.equal(a.exercises[1].alternative, 'chest-supported dumbbell row')
  assert.equal(a.exercises[2].alternative, null)
  const w = p.sessions.day2
  assert.equal(w.kind, 'conditioning')
  assert.deepEqual(w.blocks[1], { name: 'Main', start: '5 min level walking.', later: '10-20 min.' })
  assert.equal(p.strengthRoutine.warmup, '3-5 min easy bike.')
  assert.equal(p.strengthRoutine.cooldown, '5 min easy walking.')
  assert.deepEqual(p.weekGuidance.map((g) => [g.from, g.to, g.name, g.guidance]), [[1, 2, 'Establish baseline', 'Learn equipment.'], [3, 12, 'Build', 'Repeat tolerated sessions.']])
  assert.equal(p.progression.reps, 'add 1 rep while keeping 3-4 RIR.')
  assert.ok(!JSON.stringify(p).includes('Safety notes'))
})

test('a PDF with no workout days is rejected', () => {
  assert.throws(() => importPlan([{ page: 1, x: 0, y: 0, h: 10, str: 'Just a letter.' }]), /workout days/)
  assert.throws(() => validatePlan({ schedule: [], sessions: {} }), /7 days/)
})

test('progression follows the plan: one rep at a time, weight after two easy visits at the top', () => {
  const rx = { reps: [8, 12], sets: 2 }
  const visit = (date, weight, reps, rir = 4) => ({ date, exercises: [{ exerciseId: 'leg_press', sets: [{ weight, reps, rir }] }] })
  assert.equal(planSuggestion('leg_press', rx, []).sets, 1)
  assert.equal(planSuggestion('leg_press', rx, [visit('2026-11-16', 90, 8)]).reps, 9)
  assert.equal(planSuggestion('leg_press', rx, [visit('2026-11-16', 90, 12)]).weight, 90) // only one visit at the top
  const up = planSuggestion('leg_press', rx, [visit('2026-11-16', 90, 12), visit('2026-11-23', 90, 12)], { step: 5 })
  assert.deepEqual([up.weight, up.reps], [95, 8])
  const hard = planSuggestion('leg_press', rx, [visit('2026-11-16', 90, 12, 1), visit('2026-11-23', 90, 12, 1)])
  assert.equal(hard.weight, 90)
})

test('an imported plan drives Today, completion and the log', async () => {
  const mem = new Map()
  const api = createRouter(new BrowserStore({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) }))
  const plan = importPlan(items)
  assert.equal((await api('PUT', '/api/profile', undefined, { startDate: '2026-11-16', customPlan: plan })).status, 200)
  const q = (d) => new URLSearchParams({ date: d })
  const mon = (await api('GET', '/api/today', q('2026-11-16'))).body
  assert.equal(mon.session.type, 'plan_strength')
  assert.equal(mon.session.exercises.filter((e) => !e.optional).length, 2)
  assert.match(mon.weekNote, /Establish baseline/)
  for (const e of mon.session.exercises.slice(0, 2)) {
    const r = await api('POST', '/api/workouts', undefined, { date: '2026-11-16', sessionKey: mon.sessionKey, type: 'plan_strength', exercises: [{ exerciseId: e.exerciseId, slot: e.slot, name: e.name, sets: [{ reps: 8, weight: 50, rir: 4 }] }] })
    assert.equal(r.status, 201)
  }
  assert.equal((await api('GET', '/api/today', q('2026-11-16'))).body.completed, true)
  const custom = await api('POST', '/api/workouts', undefined, { date: '2026-11-16', exercises: [{ exerciseId: 'custom-farmer-hold', name: 'Farmer hold', sets: [{ seconds: 20 }] }] })
  assert.equal(custom.status, 201)
  assert.equal((await api('GET', '/api/exercises/custom-farmer-hold/entries')).body.length, 1)
  const wed = (await api('GET', '/api/today', q('2026-11-18'))).body
  assert.equal(wed.session.type, 'plan_conditioning')
  const prog = (await api('GET', '/api/program')).body
  assert.equal(prog.imported, true)
  assert.equal(prog.name, 'Test Strength Plan')
  // switching back to the PainCave plan keeps the logs
  await api('PUT', '/api/profile', undefined, { customPlan: null })
  assert.equal((await api('GET', '/api/today', q('2026-11-16'))).body.session.type, 'lower')
  assert.equal((await api('GET', '/api/workouts')).body.length, 3)
})
