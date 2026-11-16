// The static (GitHub Pages) build runs the API in the browser against BrowserStore. Exercise that path in Node.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRouter } from '../src/api.mjs'
import { BrowserStore } from '../src/browser-store.mjs'

function memoryStorage() {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }
}

test('phone mode: profile, logging and persistence through storage', async () => {
  const storage = memoryStorage()
  const api = createRouter(new BrowserStore(storage))
  assert.equal((await api('GET', '/api/profile')).body.setup, false)
  assert.equal((await api('PUT', '/api/profile', undefined, { daysPerWeek: 4, startDate: '2026-11-16' })).status, 200)
  const swim = await api('POST', '/api/swims', undefined, { date: '2026-11-17', poolLength: 25, poolUnit: 'yd', lengths: 20, durationSec: 600 })
  assert.equal(swim.status, 201)
  assert.equal(swim.body.metrics.pacePer100Text, '2:00 /100yd') // 500 yd in 10 min

  // A new store on the same storage sees the data (like reopening the app)
  const again = createRouter(new BrowserStore(storage))
  assert.equal((await again('GET', '/api/swims')).body.length, 1)
  const today = await again('GET', '/api/today', new URLSearchParams({ date: '2026-11-16' }))
  assert.equal(today.body.session.type, 'lower')
})

test('backup round-trip and bad imports', async () => {
  const a = createRouter(new BrowserStore(memoryStorage()))
  await a('PUT', '/api/profile', undefined, { startDate: '2026-11-16' })
  await a('POST', '/api/hikes', undefined, { date: '2026-11-21', durationMin: 90 })
  const backup = (await a('GET', '/api/export')).body

  const b = createRouter(new BrowserStore(memoryStorage()))
  const r = await b('POST', '/api/import', undefined, backup)
  assert.equal(r.status, 200)
  assert.equal(r.body.imported.hikes, 1)
  assert.equal((await b('GET', '/api/profile')).body.startDate, '2026-11-16')
  assert.equal((await b('POST', '/api/import', undefined, { swims: 'nope' })).status, 400)
})

test('unknown routes return 404 and 405 like the server', async () => {
  const a = createRouter(new BrowserStore(memoryStorage()))
  assert.equal((await a('GET', '/api/nope')).status, 404)
  assert.equal((await a('PATCH', '/api/swims')).status, 405)
})
