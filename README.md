# The PainCave

Workout app and training backend for **PainCave**, a workout app for swimming, hiking and losing the belly. The workouts use the equipment that **Planet Fitness** and **YMCA** gyms actually have.

- 12-week program (Base → Build → Peak) generated from your gyms, days per week and pool.
- Each lift is matched to your gym's equipment, with swaps (Smith machine at Planet Fitness, barbell at the Y, and so on).
- **Swim tracker:** logs swims with pace per 100, SWOLF, weekly totals, bests, CSS tests and the mile milestone.
- Hike log, body log (weight, waist, waist-to-height), calorie and protein targets, and load suggestions from your history.
- Plain Node 22 with **no dependencies**. Data goes in one JSON file.

Why the program is built this way, and the equipment research: [`docs/RESEARCH.md`](docs/RESEARCH.md).

## Run

```bash
cd paincave
npm start          # http://localhost:5190
npm test
```

| Env var | Default | |
|---|---|---|
| `PORT` | `5190` | |
| `PAINCAVE_DATA` | `./data/paincave.json` | your training data (gitignored) |
| `PAINCAVE_TOKEN` | unset | if set, `/api/*` (except health) needs `Authorization: Bearer <token>` |
| `CORS_ORIGIN` | `*` | origin of the front end |
| `PAINCAVE_PUBLIC` | `./public` | built front end to serve (SPA fallback to `index.html`) |

Open http://localhost:5190 on your phone (same Wi-Fi: use your computer's IP) and use **Add to Home Screen** to get a full-screen app.

## Use it anywhere (GitHub Pages)

The app also runs with **no server**. When it can't find a PainCave server, it loads the same plan and tracking code (`src/api.mjs`, served as `core/`) inside the browser and keeps your data on the phone. That lets it live on GitHub Pages and work on cell data or with no signal at all, because a service worker caches it.

```bash
npm run build:pages     # → dist/ (public/ + core/), what Pages serves
```

`.github/workflows/pages.yml` runs the tests, builds and deploys on every push to `main`. One-time setup on GitHub: **Settings → Pages → Source: GitHub Actions**.

On your iPhone, open the Pages URL in Safari, then **Share → Add to Home Screen**.

**Your data stays on the phone.** Use **Settings → Download backup** now and then, and **Restore** to move it to another phone or browser. Clearing Safari's website data erases it.

## Upload your own plan (PDF)

**Settings → Upload my plan (PDF)**, also offered at first setup and on the Plan tab. The PDF is read **on the phone** with a bundled copy of pdf.js (`public/vendor/pdfjs/`), so nothing is uploaded anywhere. `src/plan-import.mjs` keeps **only the workouts**:
- the weekly schedule
- each day's exercises (sets × reps, rest, form cue, gym alternative), plus the first-visit dose
- the pool, bike and walking blocks
- the warm-up, effort and cool-down routine
- the week-by-week review stages and the progression rule

Safety notes, pacing, nutrition, tracking forms and sources are left out.

Before the plan replaces the PainCave program, a review screen shows what was found. Logging then follows the plan:
- Each set records weight, reps, sets and **reps in reserve**.
- Pool, bike and walk days record total minutes, active minutes and effort.
- The next-visit hint uses the plan's own rule: add 1 rep at a time, and after two easy visits at the top of the range, add the smallest weight step and drop back to the low end.

**Settings → Use PainCave plan** switches back, and your logs are kept. The reader expects a plan laid out like most coach and clinician handouts: a DAY / FOCUS table and per-day pages with EXERCISE tables.

## The app (`public/`)

Built from the Claude Design handoff (`docs/design/`). It uses plain HTML, CSS and JS, with no build step.

- **Today:** today's session from the 12-week plan. On lifting days you see the machine grid ("Plan: 3 × 10–12", last weight and the suggested next weight, a Done pill) plus the warm-up and finisher. On swim, hike and cardio days you see the full workout and a log button. First run opens setup: gyms, days per week, pool and body stats.
- **Log:** weight, reps and sets steppers, Save set, a New PR label, today's sets, swap chips (the backup exercises for that slot) and a photo for each machine.
- **Plan:** W1–W12 chips and a 7-day list for each week, with each day marked Done, Missed or Today.
- **Swim:** this week's distance, CSS pace, a 12-week chart, best pace, longest swim, milestones and recent swims. *Log a swim* takes pool, distance, time, strokes per length (for SWOLF), type and effort. *CSS test* takes your 400 and 200 times.
- **Stats:** streak, weekly volume, a per-lift chart and PRs, Belly check (waist, weight, waist-to-height), Fuel (calories and protein) and hikes.

Machine photos and the access token are stored on the phone itself (localStorage). Everything else is stored by the API.

## API

All JSON. Errors are `{ "error": "message" }` with 400 (bad input), 401, 404, 405 or 409 (profile not set up). Dates are `YYYY-MM-DD`. Times can be seconds or `"m:ss"`.

### Setup
| | |
|---|---|
| `GET /api/health` | `{ ok, app, version }` |
| `GET /api/profile` · `PUT /api/profile` | Merge-update. Fields: `name, gyms[] ("planet-fitness","ymca"), daysPerWeek (3-6), startDate, poolLength, poolUnit ("yd"/"m"), reportUnit, sex, age, heightIn, weightLb, goalWeightLb, equipmentOverrides {gym:{equipmentId:bool}}, preferredGym {sessionType:gymId}` |
| `GET /api/gyms` · `GET /api/gyms/:id` | Gym summary, and every piece of equipment with `availability` and `available` (after your overrides) |
| `GET /api/equipment` | Equipment catalog |
| `GET /api/exercises?gym=&goal=` · `/api/exercises/:id` · `/api/exercises/:id/history` | Library, filtered to what a gym can do; your logged sets over time |

### Program
| | |
|---|---|
| `GET /api/program` | Overview, weekly template, per-week completion, `now` (where today falls) |
| `GET /api/program/weeks/:n` | 7 days. Each has `sessionKey` (`w3d1`), `date`, `completed` and a full `session` |
| `GET /api/today?date=` | Today's session |
| `GET /api/sessions/:type?week=` | One session (`lower, upper, swim_technique, swim_endurance, hike_conditioning, hike_long, rest`) |

A strength session has `warmup[]`, `exercises[]` (each with `name, cues, prescription {sets, reps:[lo,hi] or seconds, rpe, restSec}, suggestion {weight, reason, lastSets}, swaps[]`) and an optional `finisher`. A swim session has `swim.blocks[].sets[]` (`reps, distance, stroke, restSec, target pace`).

### Logging (each one has full CRUD: `GET list ?from&to`, `POST`, `GET/PUT/DELETE /:id`)
| | Body |
|---|---|
| `/api/workouts` | `date, sessionKey?, type?, gymId?, durationMin?, rpe?, exercises:[{exerciseId, sets:[{reps, weight, seconds?, rpe?}]}], cardio?, notes` |
| `/api/swims` | `date, poolLength, poolUnit` (or `environment:"open_water", unit`), then `lengths` **or** `distance` **or** `sets:[{reps, distance, stroke, time, rest}]`, plus `duration, strokesPerLength?, type (technique/endurance/open_water/other), continuous?, rpe?, notes, sessionKey?`. Responses include `metrics {distanceYards, distanceMeters, lengths, pacePer100Text, swolf, bestRepPacePer100}` |
| `/api/hikes` | `date, trail, distanceMi, elevationGainFt, durationMin, packLb, indoor, rpe, notes, sessionKey?` |
| `/api/body` | `date, weightLb?, waistIn?, bodyFatPct?, restingHr?` |

Setting `sessionKey` marks that program day done.

### Swim extras and stats
| | |
|---|---|
| `POST /api/swims/css-test` | `{ date, t400:"8:00", t200:"3:40" }` → logs the test and returns CSS pace per 100. Later endurance sets get target paces from it |
| `GET /api/swims/stats?unit=yd` | Totals, this week, 12-week series, best pace per 100, longest swim, CSS history, milestones (continuous mile, 3000 per week) |
| `GET /api/hikes/stats` · `GET /api/body/stats` | Totals and bests; weight 7-day average, waist change, waist-to-height |
| `GET /api/nutrition` | Calorie target, macros, expected weekly loss |
| `GET /api/dashboard` | Everything the home screen needs in one call |
| `GET /api/export` | Full data backup |

### Example
```bash
curl -X PUT localhost:5190/api/profile -H 'Content-Type: application/json' \
  -d '{"gyms":["planet-fitness","ymca"],"daysPerWeek":5,"startDate":"2026-11-16","sex":"male","age":38,"heightIn":70,"weightLb":210,"goalWeightLb":185}'
```

```bash
curl -X POST localhost:5190/api/swims -H 'Content-Type: application/json' \
  -d '{"date":"2026-11-17","poolLength":25,"poolUnit":"yd","lengths":40,"duration":"22:00","strokesPerLength":17,"type":"endurance"}'
```
