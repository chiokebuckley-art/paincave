// PainCave backend entry point.
//   PORT            port to listen on (default 5190)
//   PAINCAVE_DATA   path of the JSON data file (default ./data/paincave.json)
//   PAINCAVE_TOKEN  if set, every /api call except /api/health needs "Authorization: Bearer <token>"
//   CORS_ORIGIN     allowed origin for the front end (default *)
//   PAINCAVE_PUBLIC folder of the built front end to serve (default ./public, if it exists)

import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { Store } from './store.mjs'
import { createApp, VERSION } from './app.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dataFile = resolve(process.env.PAINCAVE_DATA ?? join(root, 'data', 'paincave.json'))
const publicDir = resolve(process.env.PAINCAVE_PUBLIC ?? join(root, 'public'))
const port = Number(process.env.PORT ?? 5190)

const app = createApp({
  store: new Store(dataFile),
  token: process.env.PAINCAVE_TOKEN || undefined,
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  publicDir: existsSync(publicDir) ? publicDir : undefined,
})

createServer(app).listen(port, () => {
  console.log(`PainCave API ${VERSION} on http://localhost:${port}  (data: ${dataFile})`)
})
