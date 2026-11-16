// The same store interface as store.mjs, kept in the browser's localStorage, for the static (GitHub Pages) build.
// Data lives on this one device: use Settings → Back up to save a copy.

const KEY = 'paincave.data.v1'
const COLLECTIONS = ['workouts', 'swims', 'hikes', 'body']
const empty = () => ({ version: 1, profile: null, workouts: [], swims: [], hikes: [], body: [] })
const uuid = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`)

export class BrowserStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage
    this.data = empty()
    try {
      const raw = storage?.getItem(KEY)
      if (raw) this.data = { ...empty(), ...JSON.parse(raw) }
    } catch {
      this.data = empty()
    }
  }

  save() {
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.data))
    } catch (e) {
      throw Object.assign(new Error('This phone is out of space for PainCave data. Back up, then delete old photos.'), { status: 507 })
    }
  }

  getProfile() { return this.data.profile }
  setProfile(p) { this.data.profile = p; this.save(); return p }
  list(col, { from, to } = {}) {
    return this.data[col]
      .filter((x) => (!from || x.date >= from) && (!to || x.date <= to))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  }
  get(col, id) { return this.data[col].find((x) => x.id === id) ?? null }
  insert(col, item) {
    const now = new Date().toISOString()
    const row = { ...item, id: uuid(), createdAt: now, updatedAt: now }
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
  export() { return JSON.parse(JSON.stringify(this.data)) }
  replace(data) { this.data = { ...empty(), ...data }; this.save() }
}

export { COLLECTIONS }
