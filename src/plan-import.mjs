// Turns a workout-plan PDF into a PainCave plan. Input: the PDF's text items (from pdf.js), each
// { page, x, y, h, str }. Output: the workouts only — the weekly schedule, each day's exercises (sets, reps, rest, form
// cue, gym alternative), the conditioning/pool blocks, the strength-visit routine, the week-by-week guidance and the
// progression rule. Safety, pacing, nutrition, tracking forms and sources are deliberately left out.
//
// The reader is layout-based: it finds table headers (short upper-case labels on one line), maps every following line
// to those columns by x position, and stops at the first line that is not table text (a paragraph or heading).

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Plan exercise names → PainCave exercise ids (for photos and history). First match wins.
const NAME_MAP = [
  [/leg press/i, 'leg_press'],
  [/sit-to-stand|sit to stand/i, 'sit_to_stand'],
  [/reverse pec deck|reverse fly/i, 'reverse_pec_deck'],
  [/pec deck/i, 'reverse_pec_deck'],
  [/lat pull ?-?down/i, 'lat_pulldown'],
  [/chest press/i, 'chest_press_machine'],
  [/\brows?\b/i, 'seated_row_machine'],
  [/leg curl/i, 'leg_curl'],
  [/supported calf|calf raise.*(rail|support)/i, 'supported_calf_raise'],
  [/calf raise/i, 'machine_calf_raise'],
  [/heel slide/i, 'dead_bug_heel_slide'],
  [/dead ?bug/i, 'dead_bug'],
  [/glute bridge|hip bridge/i, 'glute_bridge'],
  [/step-?up/i, 'low_step_up'],
  [/incline push-?up/i, 'high_incline_pushup'],
  [/push-?up/i, 'pushup'],
  [/lateral raise/i, 'seated_lateral_raise'],
  [/anti-rotation|pallof/i, 'seated_anti_rotation_press'],
  [/romanian deadlift|\brdl\b/i, 'db_rdl'],
  [/plank/i, 'plank'],
  [/goblet squat/i, 'goblet_squat'],
  [/face pull/i, 'face_pull'],
  [/shoulder press/i, 'shoulder_press_machine'],
]

export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
export function exerciseIdFor(name) {
  for (const [re, id] of NAME_MAP) if (re.test(name)) return id
  return 'custom-' + slug(name)
}

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').replace(/\s*\[[\d,\s]+\]\s*/g, ' ').trim()
const titleCase = (s) => s.toLowerCase().replace(/(^|\s|\/)(\w)/g, (m, a, b) => a + b.toUpperCase()).replace(/ (Or|And|Of|The|To|A|In|With) /g, (m) => m.toLowerCase())

/** "1-2 x 8-12", "1 x 5-8/side", "1 x 6-8/leg" → { sets:[1,2], reps:[8,12], perSide } */
export function parseDose(text) {
  const m = /(\d+)(?:\s*[-–]\s*(\d+))?\s*[x×]\s*(\d+)(?:\s*[-–]\s*(\d+))?\s*(sec|s\b|min)?\s*(\/\s*(side|leg|arm))?/i.exec(text ?? '')
  if (!m) return null
  const sets = [Number(m[1]), Number(m[2] ?? m[1])]
  const amount = [Number(m[3]), Number(m[4] ?? m[3])]
  const unit = m[5] ? (/min/i.test(m[5]) ? 'minutes' : 'seconds') : 'reps'
  return { sets, [unit === 'reps' ? 'reps' : unit]: amount, unit, perSide: !!m[6], text: clean(text) }
}

// ── Layout helpers ────────────────────────────────────────────────────────────────────────────────────

/** Group items into lines (same page, y within 2pt), sorted top to bottom, left to right. */
export function toLines(items) {
  const byPage = new Map()
  for (const it of items) {
    if (!String(it.str ?? '').trim()) continue
    const p = byPage.get(it.page) ?? []
    p.push(it)
    byPage.set(it.page, p)
  }
  const lines = []
  for (const [page, its] of [...byPage].sort((a, b) => a[0] - b[0])) {
    its.sort((a, b) => b.y - a.y || a.x - b.x)
    let cur = null
    for (const it of its) {
      if (cur && Math.abs(cur.y - it.y) <= 2) cur.items.push(it)
      else {
        cur = { page, y: it.y, items: [it] }
        lines.push(cur)
      }
    }
  }
  for (const l of lines) {
    l.items.sort((a, b) => a.x - b.x)
    l.x = l.items[0].x
    l.h = Math.max(...l.items.map((i) => i.h ?? 0))
    l.text = clean(l.items.map((i) => i.str).join(' '))
  }
  return lines
}

const isHeaderLine = (l) => l.items?.length >= 2 && l.items.every((i) => /^[A-Z0-9 /&+\-–.,]+$/.test(i.str.trim()) && /[A-Z]{3}/.test(i.str) && i.str.trim().length <= 40)

/** Read the table whose header is lines[start]. Returns { headers, rows: [[cell...]], end } */
export function readTable(lines, start) {
  const head = lines[start]
  const cols = head.items.map((i) => ({ x: i.x, name: clean(i.str) }))
  const rows = []
  let row = null
  let lastY = head.y
  let i = start + 1
  for (; i < lines.length; i++) {
    const l = lines[i]
    if (l.page !== head.page) break
    if (l.x < cols[0].x - 4) break // paragraph text starts left of the table
    if (Math.abs(l.h - head.h) > 1.2) break // headings and body text use other sizes
    const cells = cols.map(() => [])
    for (const it of l.items) {
      let c = 0
      for (let k = 0; k < cols.length; k++) if (it.x >= cols[k].x - 4) c = k
      cells[c].push(it.str)
    }
    const startsRow = cells[0].length && (!row || lastY - l.y > 14)
    if (startsRow || !row) {
      row = cols.map(() => [])
      rows.push(row)
    }
    cells.forEach((c, k) => { if (c.length) row[k].push(c.join(' ')) })
    lastY = l.y
  }
  return { headers: cols.map((c) => c.name), rows: rows.map((r) => r.map((c) => clean(c.join(' ')))), end: i }
}

/** Paragraph text that follows a heading line, until the next heading or table. */
function paragraphAfter(lines, idx, { maxLines = 12 } = {}) {
  const head = lines[idx]
  const out = []
  for (let i = idx + 1; i < lines.length && out.length < maxLines; i++) {
    const l = lines[i]
    if (l.page !== head.page) break
    if (l.h >= head.h - 0.5 || isHeaderLine(l)) break
    if (l.h < 9.5) break // small print (time budgets, footnotes)
    out.push(l.text)
  }
  return clean(out.join(' '))
}

/** Lead-in sentences like "Warm up, 6-8 min: ..." inside a paragraph block. */
function leadIns(text) {
  const out = {}
  const re = /(Warm up[^:]*|Effort|Rest|Cool down|Reps first|Sets|Conditioning):\s*/g
  const marks = [...text.matchAll(re)]
  marks.forEach((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : text.length
    const key = /^warm/i.test(m[1]) ? 'warm_up' : m[1].toLowerCase().replace(/[^a-z]+/g, '_').replace(/_+$/, '')
    out[key] = { label: m[1], text: clean(text.slice(m.index + m[0].length, end)) }
  })
  return out
}

/** "Leg press: supported sit-to-stand... Row: chest-supported..." → map of lower-case lead word → text */
function alternativesByName(text) {
  const out = []
  const re = /(?:^|[.;]\s+)([A-Z][A-Za-z -]{2,30}):\s/g
  const marks = [...text.matchAll(re)]
  marks.forEach((m, i) => {
    const start = m.index + m[0].length
    const end = i + 1 < marks.length ? marks[i + 1].index + 1 : text.length
    out.push({ key: m[1].toLowerCase().trim(), text: clean(text.slice(start, end)).replace(/\.$/, '') })
  })
  return out
}

function matchAlternative(name, alts) {
  const n = name.toLowerCase()
  const stems = (s) => s.split(/[^a-z]+/).filter((w) => w.length >= 3).map((w) => w.slice(0, 3))
  const nameStems = stems(n)
  let best = null
  for (const a of alts) {
    const keys = stems(a.key)
    // Every word of the label must appear in the exercise name ("Leg press" must not match "Seated leg curl").
    if (!keys.length || !keys.every((k) => nameStems.includes(k))) continue
    if (!best || keys.length > best.n) best = { ...a, n: keys.length }
  }
  return best ? best.text.split(/\.\s/)[0] : null
}

// ── The importer ──────────────────────────────────────────────────────────────────────────────────────

export function importPlan(items, { fileName = null } = {}) {
  const lines = toLines(items)
  if (!lines.length) throw Object.assign(new Error('No text found in that PDF. Is it a scanned image?'), { status: 400 })

  const plan = {
    version: 1,
    name: null,
    fileName,
    importedAt: new Date().toISOString(),
    weeks: 12,
    schedule: [],
    sessions: {},
    strengthRoutine: null,
    weekGuidance: [],
    progression: null,
  }

  // Name: the largest text on the first page.
  const first = lines.filter((l) => l.page === lines[0].page)
  const big = Math.max(...first.map((l) => l.h))
  plan.name = clean(first.filter((l) => l.h >= big - 1).map((l) => l.text).join(' ')) || 'Imported plan'
  const weeksMatch = /(\d{1,2})[- ]week/i.exec(lines.slice(0, 40).map((l) => l.text).join(' '))
  if (weeksMatch) plan.weeks = Math.min(52, Math.max(1, Number(weeksMatch[1])))

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (!isHeaderLine(l)) continue
    const heads = l.items.map((x) => clean(x.str).toUpperCase())

    // Weekly framework: DAY | FOCUS | ...
    if (heads[0] === 'DAY' && heads.includes('FOCUS') && !plan.schedule.length) {
      const t = readTable(lines, i)
      for (const r of t.rows) {
        const m = /^(\d+)\s*\/\s*([A-Za-z]+)/.exec(r[0])
        const budget = r[2] ?? ''
        if (m) {
          const dayIndex = WEEKDAYS.findIndex((d) => d.toLowerCase().startsWith(m[2].toLowerCase().slice(0, 3)))
          plan.schedule.push({ dayIndex, dayNumber: Number(m[1]), focus: r[1], budget })
        } else if (/weekend/i.test(r[0])) {
          for (const d of [5, 6]) plan.schedule.push({ dayIndex: d, dayNumber: null, focus: r[1], budget, rest: true })
        } else {
          const dayIndex = WEEKDAYS.findIndex((d) => r[0].toLowerCase().startsWith(d.toLowerCase().slice(0, 3)))
          if (dayIndex >= 0) plan.schedule.push({ dayIndex, dayNumber: null, focus: r[1], budget, rest: /rest|recovery|off/i.test(r[1]) })
        }
      }
      i = t.end - 1
      continue
    }

    // Week-by-week review: REVIEW | ... | IF CLEARED ...
    if (heads[0] === 'REVIEW' && !plan.weekGuidance.length) {
      const t = readTable(lines, i)
      const col = t.headers.length - 1
      for (const r of t.rows) {
        const m = /Weeks?\s*(\d+)\s*[-–]\s*(\d+)\s*(.*)/i.exec(r[0])
        if (m) plan.weekGuidance.push({ from: Number(m[1]), to: Number(m[2]), name: clean(m[3]), guidance: r[col] })
      }
      i = t.end - 1
    }
  }

  // Strength-visit routine and the progression rule (labelled paragraphs).
  const findHeading = (re) => lines.findIndex((l) => l.h >= 12 && re.test(l.text))
  const routineIdx = findHeading(/before and after each strength visit/i)
  if (routineIdx >= 0) {
    const li = leadIns(paragraphAfter(lines, routineIdx, { maxLines: 20 }))
    plan.strengthRoutine = {
      warmup: li.warm_up?.text ?? null, warmupLabel: li.warm_up?.label ?? 'Warm up',
      effort: li.effort?.text ?? null, rest: li.rest?.text ?? null, cooldown: li.cool_down?.text ?? null,
    }
  }
  const progIdx = findHeading(/overload rule|progression/i)
  if (progIdx >= 0) {
    const text = paragraphAfter(lines, progIdx, { maxLines: 20 })
    const li = leadIns(text)
    plan.progression = { rule: clean(text.split(/Reps first:/)[0]), reps: li.reps_first?.text ?? null, sets: li.sets?.text ?? null, conditioning: li.conditioning?.text ?? null }
  }

  // Day pages: a small label line "NN / DAY n / LABEL".
  const dayLabels = lines.map((l, i) => ({ l, i, m: /DAY\s*(\d+)\s*\/\s*(.+)$/i.exec(l.text) })).filter((x) => x.m && x.l.text === x.l.text.toUpperCase())
  for (const { l, i, m } of dayLabels) {
    const dayNumber = Number(m[1])
    const pageLines = lines.filter((x) => x.page === l.page)
    const at = (j) => lines.indexOf(pageLines[j])
    const title = clean(pageLines.find((x) => x.h >= 20)?.text ?? '')
    const subtitleLine = pageLines.find((x, j) => j > 0 && pageLines[j - 1].h >= 20 && x.h < 20)
    const session = { dayNumber, label: titleCase(clean(m[2])), title, subtitle: subtitleLine?.text ?? '', kind: 'conditioning', exercises: [], options: [], blocks: [], notes: [] }

    for (let j = 0; j < pageLines.length; j++) {
      const pl = pageLines[j]
      const idx = at(j)
      if (isHeaderLine(pl)) {
        const t = readTable(lines, idx)
        const H = t.headers.map((h) => h.toUpperCase())
        if (H[0] === 'EXERCISE') {
          session.kind = 'strength'
          const doseCol = H.findIndex((h) => /OPTION|SETS|DOSE/.test(h))
          const restCol = H.indexOf('REST')
          const cueCol = H.findIndex((h) => /CUE|NOTE/.test(h))
          for (const r of t.rows) {
            const name = r[0]
            if (!name) continue
            session.exercises.push({ name, exerciseId: exerciseIdFor(name), dose: parseDose(r[doseCol] ?? ''), doseText: r[doseCol] ?? '', rest: restCol >= 0 ? r[restCol] : null, cue: cueCol >= 0 ? r[cueCol] : null })
          }
        } else if (H[0] === 'BLOCK') {
          const blocks = t.rows.filter((r) => r[0]).map((r) => (H.some((h) => /LATER/.test(h))
            ? { name: r[0], start: r[1] ?? '', later: r[2] ?? '' }
            : { name: r[0], dose: r[1] ?? '', note: r[2] ?? '' }))
          const optHead = [...pageLines.slice(0, j)].reverse().find((x) => x.h >= 12 && x.h < 20)
          if (optHead && /option/i.test(optHead.text)) session.options.push({ name: optHead.text, blocks })
          else session.blocks.push(...blocks)
        }
        j = pageLines.indexOf(lines[t.end - 1])
        continue
      }
      if (pl.h >= 12 && pl.h < 20) {
        const text = paragraphAfter(lines, idx)
        if (/first visit/i.test(pl.text)) {
          session.firstVisit = text
          const n = /first\s+(\d+|two|three|four)\s+exercises/i.exec(text)
          const words = { two: 2, three: 3, four: 4 }
          session.firstVisitCount = n ? Number(n[1]) || words[n[1].toLowerCase()] : null
          const d = parseDose(text.replace(/(\d+)\s+sets?\s+each,\s*(\d+)/i, '$1 x $2'))
          if (d) session.firstVisitDose = d
        } else if (/alternatives?|swap/i.test(pl.text)) session.alternatives = text
        else if (/how to use/i.test(pl.text)) session.howTo = text
        else if (/^option\s*b/i.test(pl.text) || (/^option/i.test(pl.text) && text && !isHeaderLine(pageLines[j + 1] ?? {}))) {
          if (text) session.options.push({ name: pl.text, text })
        } else if (/^(choose|from gym|a useful)/i.test(pl.text) && text) session.notes.push({ name: pl.text, text })
      }
    }
    if (session.kind === 'strength' && session.alternatives) {
      const alts = alternativesByName(session.alternatives)
      for (const e of session.exercises) e.alternative = matchAlternative(e.name, alts)
    }
    if (session.kind !== 'strength') session.kind = session.options.length ? 'options' : 'conditioning'
    plan.sessions['day' + dayNumber] = session
  }

  // Link schedule days to their session pages; fill weekdays the plan did not list as rest.
  for (const d of plan.schedule) if (d.dayNumber && plan.sessions['day' + d.dayNumber]) d.session = 'day' + d.dayNumber
  for (let k = 0; k < 7; k++) if (!plan.schedule.some((d) => d.dayIndex === k)) plan.schedule.push({ dayIndex: k, dayNumber: null, focus: 'Rest', budget: '', rest: true })
  plan.schedule.sort((a, b) => a.dayIndex - b.dayIndex)

  const workouts = plan.schedule.filter((d) => d.session).length
  if (!workouts) throw Object.assign(new Error("Couldn't find any workout days in that PDF. It needs a weekly table (DAY / FOCUS) and day pages."), { status: 400 })
  return plan
}

/** Light shape check for a plan coming back from the phone (stored in the profile). */
export function validatePlan(p) {
  if (p == null) return null
  const bad = (m) => { throw Object.assign(new Error('Plan: ' + m), { status: 400 }) }
  if (typeof p !== 'object' || !Array.isArray(p.schedule) || typeof p.sessions !== 'object') bad('missing schedule or sessions')
  if (p.schedule.length !== 7 || p.schedule.some((d) => !(d.dayIndex >= 0 && d.dayIndex <= 6))) bad('schedule must list 7 days')
  for (const d of p.schedule) if (d.session && !p.sessions[d.session]) bad(`unknown session ${d.session}`)
  for (const s of Object.values(p.sessions)) for (const e of s.exercises ?? []) if (typeof e.name !== 'string' || typeof e.exerciseId !== 'string') bad('exercise needs a name')
  if (JSON.stringify(p).length > 200_000) bad('too large')
  return { ...p, weeks: Math.min(52, Math.max(1, Number(p.weeks) || 12)) }
}
