import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSwim, swimMetrics, criticalSwimSpeed, swimStats, swimSession, parseTime, formatTime } from '../src/swim.mjs'

test('time parsing and formatting', () => {
  assert.equal(parseTime('1:42'), 102)
  assert.equal(parseTime('1:02:03'), 3723)
  assert.equal(formatTime(102), '1:42')
  assert.equal(formatTime(3723), '1:02:03')
})

test('metrics from lengths, pace and SWOLF', () => {
  const s = normalizeSwim({ date: '2026-11-16', poolLength: 25, poolUnit: 'yd', lengths: 40, duration: '20:00', strokesPerLength: 18 })
  const m = swimMetrics(s)
  assert.equal(s.distance, 1000)
  assert.equal(m.distanceYards, 1000)
  assert.equal(m.distanceMeters, 914)
  assert.equal(m.pacePer100, 120)
  assert.equal(m.swolf, 30 + 18)
})

test('distance can come from sets', () => {
  const s = normalizeSwim({ date: '2026-11-16', poolLength: 25, poolUnit: 'm', sets: [{ reps: 4, distance: 100, time: '1:50' }, { reps: 1, distance: 200 }] })
  assert.equal(s.distance, 600)
  assert.equal(swimMetrics(s).bestRepPacePer100, 110)
})

test('bad swims are rejected with a 400', () => {
  assert.throws(() => normalizeSwim({ date: 'nope' }), (e) => e.status === 400)
})

test('CSS', () => {
  assert.equal(criticalSwimSpeed('8:00', '3:40'), 130)
  assert.throws(() => criticalSwimSpeed('3:00', '4:00'))
})

test('stats total across units and bucket by week', () => {
  const swims = [
    normalizeSwim({ date: '2026-11-16', poolLength: 25, poolUnit: 'yd', distance: 1000, durationSec: 1200 }),
    normalizeSwim({ date: '2026-11-18', poolLength: 25, poolUnit: 'm', distance: 1000, durationSec: 1300 }),
    normalizeSwim({ date: '2026-11-02', poolLength: 25, poolUnit: 'yd', distance: 500, durationSec: 600 }),
  ]
  const st = swimStats(swims, { unit: 'yd', today: '2026-11-19' })
  assert.equal(st.sessions, 3)
  assert.equal(st.thisWeek.sessions, 2)
  assert.equal(st.thisWeek.distance, 1000 + Math.round(1000 / 0.9144))
  assert.equal(st.weekly.length, 12)
  assert.equal(st.weekly.at(-1).weekOf, '2026-11-16')
  assert.equal(st.bestPacePer100.seconds, 118.9) // 1000 m in 1300 s = 130 s/100 m = 118.9 s/100 yd, beats 120
})

test('swim sessions grow over the block and end with the mile', () => {
  const w1 = swimSession('endurance', 1, { poolUnit: 'yd' }).totalDistance
  const w11 = swimSession('endurance', 11, { poolUnit: 'yd' }).totalDistance
  assert.ok(w11 > w1)
  const w12 = swimSession('endurance', 12, { poolUnit: 'yd' })
  assert.ok(w12.blocks.some((b) => b.name === 'The mile' && b.sets[0].distance === 1650))
  assert.ok(swimSession('technique', 1, {}).blocks.some((b) => b.name === 'CSS test'))
  const fifty = swimSession('technique', 5, { poolLength: 50, poolUnit: 'm' })
  for (const b of fifty.blocks) for (const s of b.sets) assert.equal(s.distance % 50, 0)
  const css = swimSession('endurance', 2, { cssPer100: 100 })
  assert.match(css.blocks[1].sets[0].target, /1:46/)
})
