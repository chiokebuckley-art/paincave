import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { EXERCISES } from '../src/catalog/exercises.mjs'

const credits = JSON.parse(readFileSync(new URL('../public/photos/credits.json', import.meta.url), 'utf8'))

test('every exercise has a credited, freely licensed photo', () => {
  for (const id of Object.keys(EXERCISES)) {
    const f = credits.files[credits.exercises[id]]
    assert.ok(f, `no photo for ${id}`)
    assert.match(f.url, /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//, id)
    assert.match(f.license, /^(CC0|CC BY|Public domain)/, id)
    assert.ok(f.artist && f.page, `credit missing for ${id}`)
  }
})
