import { test } from 'node:test'
import assert from 'node:assert/strict'
import { weekPlan, buildSession, locate, suggestLoad, programOverview } from '../src/program.mjs'
import { availableAt } from '../src/catalog/equipment.mjs'
import { EXERCISES, SLOTS, canDo } from '../src/catalog/exercises.mjs'

const base = { gyms: ['planet-fitness', 'ymca'], daysPerWeek: 5, startDate: '2026-11-16', poolLength: 25, poolUnit: 'yd', equipmentOverrides: {} }

test('every slot candidate is a real exercise', () => {
  for (const [slot, ids] of Object.entries(SLOTS)) for (const id of ids) assert.ok(EXERCISES[id], `${slot}: ${id}`)
})

test('Planet Fitness never gets barbell, rack or pool work', () => {
  const pf = { ...base, gyms: ['planet-fitness'] }
  const avail = availableAt('planet-fitness')
  assert.ok(!avail.has('barbell') && !avail.has('squat_rack') && !avail.has('lap_pool'))
  for (let w = 1; w <= 12; w++) {
    for (const d of weekPlan(w, pf).days) {
      for (const e of d.session.exercises ?? []) assert.ok(canDo(EXERCISES[e.exerciseId], avail), `${e.exerciseId} at PF`)
    }
  }
  const lower = buildSession('lower', 1, pf)
  assert.equal(lower.exercises.find((e) => e.slot === 'squat').exerciseId, 'smith_squat')
})

test('PF-only swim days become dryland with a warning', () => {
  const s = buildSession('swim_technique', 2, { ...base, gyms: ['planet-fitness'] })
  assert.match(s.warning, /lap pool/)
  assert.ok(!s.swim)
})

test('with both gyms, swims go to the YMCA and heavy lower work uses the barbell there', () => {
  const swim = buildSession('swim_endurance', 3, base)
  assert.equal(swim.gymId, 'ymca')
  assert.ok(swim.swim.totalDistance > 0)
  const lower = buildSession('lower', 1, base)
  assert.equal(lower.gymId, 'ymca')
  assert.equal(lower.exercises.find((e) => e.slot === 'squat').exerciseId, 'barbell_back_squat')
})

test('equipment overrides change the plan', () => {
  const p = { ...base, gyms: ['planet-fitness'], equipmentOverrides: { 'planet-fitness': { smith_machine: false } } }
  const lower = buildSession('lower', 1, p)
  assert.equal(lower.exercises.find((e) => e.slot === 'squat').exerciseId, 'goblet_squat')
})

test('schedules match days per week and weeks 4 and 8 deload', () => {
  for (const n of [3, 4, 5, 6]) {
    const w = weekPlan(1, { ...base, daysPerWeek: n })
    assert.equal(w.days.filter((d) => d.session.type !== 'rest').length, n)
    assert.equal(w.days.length, 7)
  }
  assert.ok(weekPlan(4, base).deload && weekPlan(8, base).deload && !weekPlan(5, base).deload)
  const b = buildSession('lower', 1, base).exercises[0].prescription
  const pk = buildSession('lower', 10, base).exercises[0].prescription
  assert.deepEqual(b.reps, [10, 12])
  assert.deepEqual(pk.reps, [6, 8])
})

test('dates start on the Monday of the start week', () => {
  const p = { ...base, startDate: '2026-11-19' } // a Thursday
  assert.equal(programOverview(p).startDate, '2026-11-16')
  assert.equal(weekPlan(2, p).days[0].date, '2026-11-23')
  assert.deepEqual(locate(p, '2026-11-15'), { status: 'not_started', startsOn: '2026-11-16' })
  assert.deepEqual(locate(p, '2026-11-25'), { status: 'active', week: 2, dayIndex: 2 })
  assert.equal(locate(p, '2027-02-08').status, 'complete')
})

test('load suggestions progress only when every set hits the top of the range', () => {
  const rx = { sets: 3, reps: [10, 12] }
  const hist = (reps) => [{ date: '2026-11-16', exercises: [{ exerciseId: 'smith_squat', sets: reps.map((r) => ({ reps: r, weight: 95 })) }] }]
  assert.equal(suggestLoad('smith_squat', rx, hist([12, 12, 12])).weight, 100)
  assert.equal(suggestLoad('smith_squat', rx, hist([12, 11, 10])).weight, 95)
  assert.equal(suggestLoad('smith_squat', rx, []), null)
})
