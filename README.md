# PainCave — backend

Training backend for **PainCave**, a workout app for swimming, hiking and losing the belly. The workouts use the equipment that **Planet Fitness** and **YMCA** gyms actually have.

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

When the Claude Design UI arrives, put its build in `paincave/public/` (or point it at this API with CORS).

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
