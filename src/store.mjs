// A small JSON-file store. Writes are atomic (write to a temp file, then rename) and serialised, so a crash mid-write
// never leaves a half-written file. Good for one person's training log; swap for a database if PainCave goes multi-user.

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'

export const COLLECTIONS = ['workouts', 'swims', 'hikes', 'body']

export function emptyData() {
  return { version: 1, profile: null, workouts: [], swims: [], hikes: [], body: [] }
}

export class Store {
  constructor(file) {
    this.file = file
    this.data = emptyData()
    if (file && existsSync(file)) this.data = { ...emptyData(), ...JSON.parse(readFileSync(file, 'utf8')) }
  }

  save() {
    if (!this.file) return
    mkdirSync(dirname(this.file), { recursive: true })
    const tmp = `${this.file}.${process.pid}.tmp`
    writeFileSync(tmp, JSON.stringify(this.data, null, 2))
    renameSync(tmp, this.file)
  }

  getProfile() {
    return this.data.profile
  }

  setProfile(profile) {
    this.data.profile = profile
    this.save()
    return profile
  }

  list(col, { from, to } = {}) {
    return this.data[col]
      .filter((x) => (!from || x.date >= from) && (!to || x.date <= to))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  }

  get(col, id) {
    return this.data[col].find((x) => x.id === id) ?? null
  }

  insert(col, item) {
    const now = new Date().toISOString()
    const row = { ...item, id: randomUUID(), createdAt: now, updatedAt: now }
    this.data[col].push(row)
    this.save()
    return row
  }

  update(col, id, item) {
    const i = this.data[col].findIndex((x) => x.id === id)
    if (i < 0) return null
    const row = { ...item, id, createdAt: this.data[col][i].createdAt, updatedAt: new Date().toISOString() }
    this.data[col][i] = row
    this.save()
    return row
  }

  remove(col, id) {
    const before = this.data[col].length
    this.data[col] = this.data[col].filter((x) => x.id !== id)
    if (this.data[col].length === before) return false
    this.save()
    return true
  }

  export() {
    return structuredClone(this.data)
  }
}
