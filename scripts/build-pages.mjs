// Builds the static app for GitHub Pages into dist/: the front end (public/) plus the shared API code in dist/core/,
// which the app runs in the browser when there is no PainCave server. Usage: node scripts/build-pages.mjs
import { cpSync, rmSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'dist')
rmSync(out, { recursive: true, force: true })
mkdirSync(join(out, 'core', 'catalog'), { recursive: true })
cpSync(join(root, 'public'), out, { recursive: true })
for (const f of ['api.mjs', 'browser-store.mjs', 'program.mjs', 'swim.mjs', 'nutrition.mjs']) cpSync(join(root, 'src', f), join(out, 'core', f))
for (const f of readdirSync(join(root, 'src', 'catalog'))) cpSync(join(root, 'src', 'catalog', f), join(out, 'core', 'catalog', f))
writeFileSync(join(out, '.nojekyll'), '')
console.log('Built', out)
