// PainCave HTTP server plumbing: JSON over node:http, static files for the app, and the shared API from api.mjs.
// createApp() returns a request handler so tests can drive it without opening a port.

import { readFile, stat } from 'node:fs/promises'
import { join, normalize, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { timingSafeEqual } from 'node:crypto'
import { createRouter, httpError } from './api.mjs'

export { VERSION, normalizeProfile } from './api.mjs'

// The browser loads the shared logic from /core/* (the same files as src/), so it can run offline.
const SRC_DIR = dirname(fileURLToPath(import.meta.url))

// ── Server plumbing ─────────────────────────────────────────────────────────────────────────────────────

const MAX_BODY = 5_000_000 // room for a backup import
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' }

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const c of req) {
    size += c.length
    if (size > MAX_BODY) throw httpError(413, 'Body too large')
    chunks.push(c)
  }
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw httpError(400, 'Body must be JSON')
  }
}

function tokenOk(header, token) {
  const got = Buffer.from(String(header ?? '').replace(/^Bearer\s+/i, ''))
  const want = Buffer.from(token)
  return got.length === want.length && timingSafeEqual(got, want)
}

/**
 * @param {{ store: import('./store.mjs').Store, token?: string, corsOrigin?: string, publicDir?: string }} opts
 */
export function createApp({ store, token, corsOrigin = '*', publicDir }) {
  const dispatch = createRouter(store)

  async function serveCore(pathname, res) {
    const rel = normalize(decodeURIComponent(pathname.slice('/core/'.length)))
    if (rel.startsWith('..') || !rel.endsWith('.mjs') || rel.includes('store.mjs') || rel.includes('server.mjs') || rel === 'app.mjs') return false
    try {
      const buf = await readFile(join(SRC_DIR, rel))
      res.writeHead(200, { 'Content-Type': MIME['.mjs'] })
      res.end(buf)
      return true
    } catch {
      return false
    }
  }

  async function serveStatic(pathname, res) {
    if (!publicDir) return false
    const rel = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '')
    if (rel.startsWith('..')) return false
    let file = join(publicDir, rel || 'index.html')
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html')
      const buf = await readFile(file)
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' })
      res.end(buf)
      return true
    } catch {
      // Single-page app: unknown non-API paths fall back to index.html.
      try {
        const buf = await readFile(join(publicDir, 'index.html'))
        res.writeHead(200, { 'Content-Type': MIME['.html'] })
        res.end(buf)
        return true
      } catch {
        return false
      }
    }
  }

  return async function handler(req, res) {
    const url = new URL(req.url, 'http://localhost')
    const send = (status, payload) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      })
      res.end(payload == null ? '' : JSON.stringify(payload))
    }
    try {
      if (req.method === 'OPTIONS') return send(204, null)
      if (!url.pathname.startsWith('/api/')) {
        if (req.method === 'GET' && url.pathname.startsWith('/core/')) {
          if (await serveCore(url.pathname, res)) return
          return send(404, { error: 'Not found' })
        }
        if (req.method === 'GET' && (await serveStatic(url.pathname, res))) return
        return send(404, { error: 'Not found' })
      }
      if (token && url.pathname !== '/api/health' && !tokenOk(req.headers.authorization, token)) throw httpError(401, 'Missing or wrong token')
      const body = ['POST', 'PUT'].includes(req.method) ? await readBody(req) : {}
      const out = await dispatch(req.method, url.pathname, url.searchParams, body)
      return send(out.status, out.body)
    } catch (e) {
      const status = e.status ?? 500
      if (status >= 500) console.error(e)
      return send(status, { error: status >= 500 ? 'Server error' : e.message })
    }
  }
}

