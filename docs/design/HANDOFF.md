# Handoff: The PainCave — workout tracker (iPhone)

## Overview
Lifting log for one person who trains on 4 machines. You follow a 12-week plan, log weight, reps and sets for each machine, and track progress. Three tabs: **Today**, **Plan**, **Stats**, plus a **Log** screen you reach by tapping a machine.

## About the design files
`Lift Tracker.dc.html` is an **HTML design reference**, not production code. Rebuild it in the target stack. If no codebase exists yet, use **SwiftUI** (iPhone-only, local data) or **React Native/Expo** if Android may follow. All logic is in the `class Component` inside the `<script data-dc-script>` tag. Reuse its rules: plan-day calculation, PR detection, streak and weekly volume.
`ios-frame.jsx` is only the device frame for the mock, so don't port it. `image-slot.js` is a drag-to-fill image placeholder for the mock. In the real app, replace it with a "pick photo from library" control on each machine.

## Fidelity
**High-fidelity.** Match the colors, type, radii and layout below. Font: system (SF Pro). Screen size: 402×874.

## Global layout
- **Background:** full-screen cave photo (`cave-bg`) with a vertical scrim on top: `rgba(10,8,7,.45)` at 0%, transparent from 22% to 75%, `rgba(10,8,7,.35)` at 100%. If the photo fails to load, show `radial-gradient(120% 70% at 50% 0%, #3a2a24, #1a1210 55%, #0a0807)`.
- **Screen content:** padding is 68px at the top (clears the status bar), 20px on the sides and 110px at the bottom (clears the tab bar). Text on the background is `#f5f1ea`; secondary text is `rgba(245,241,234,.8)`.
- **Tab bar:** floating pill, 32px from the bottom and centered. Background `rgba(28,22,20,.72)`, blur 16px, radius 30, padding 5, gap 4. Each tab is 48px tall with 22px side padding, radius 24, 15px/600. Active tab: background `#f5f1ea`, text `#17170f`. Inactive tab: transparent background, text `#f5f1ea`. Tabs: Today · Plan · Stats.
- **White cards:** `#fff` with text `#17170f`. Shadow `0 1px 2px rgba(0,0,0,.05), 0 6px 18px rgba(0,0,0,.05)`.
- **Dark glass panels** (rest day, rest rows, buttons on the photo): `rgba(20,15,13,.55–.62)` with a 10px blur.

## Screens
### Today
- **Header:** eyebrow "THE PAINCAVE" (12px/800, letter-spacing 2.4px, `#ff5a3c`). Below it, the title "{Focus} day" (or "Today" when nothing is planned) at 34px/700 with -0.5px letter-spacing, and the date (e.g. "Mon, Nov 16") on the right at 15px.
- **Summary line:** "Week N of 12 · X of Y done" (15px). On a day with no plan, show today's count and total volume instead.
- **Rest day:** dark glass card: "Rest day" (20/700), then "Nothing planned. Recover — or log something extra below."
- **Machine grid:** 2 columns, 14px gap. Shows only today's planned machines, or all machines on a rest day or after the user taps "Log a different machine".
- **Machine card:** radius 22. Square photo on top, then:
  - name (16/600), with a green "Done" pill (`#2a9d5c`) if a set was logged today
  - "Plan: 3 × 12" (13/600, `#2f6fdd`) when the machine is in today's plan
  - "Last 125 lbs" or "Today · 130 lbs" (13px, `#6f6e66`)
  - Pressing the card scales it to 0.97.
- **Toggle button** (only on planned days): dark glass pill, 44px tall, centered. Label switches between "Log a different machine" and "Show only today's plan".

### Log (tap a machine)
- **Header:** round white back button (40px), machine name (22/700), "PR {n} lbs" on the right.
- **Plan badge** (when the machine is planned today): blue pill reading "Today's plan · 3 × 12".
- **Photo:** 120px tall, radius 20.
- **Entry card** (white, radius 24, padding 20):
  - "WEIGHT" label, then − / value / + controls. Buttons are 56px circles (`#f0efea`). The value is 64/700 with tabular numbers, followed by the unit.
  - Reps and Sets side by side, each in a `#f7f6f2` box (radius 16) with 36px − / + buttons.
  - Save button: full width, 54px tall, `#2f6fdd` (pressed: `#1f55b8`), white 17/600 text. Label is "Save set", or "Save set · New PR" when the weight is above the current PR.
- **"Logged today" list:** white rows showing "{w} lbs" and "{sets} × {reps}", plus a "PR" chip (`#2f6fdd` text on `#e8f0fd`) on record sets. Rows pop in with scale .96→1 and opacity, 0.2s.
- **Starting values:** weight = last logged weight; sets and reps = today's plan target, otherwise the last session.
- **Weight step:** 5 lbs by default; 2.5 and 10 are also options.

### Plan
- **Header:** title "Plan", with the plan name on the right.
- **Week chips** W1–W12: scroll horizontally, 44px tall. Selected chip: `#f5f1ea` background, dark text. Others: dark glass. The current week, when not selected, has an inset `#2f6fdd` ring.
- **Section line:** "WEEK N OF 12", with "x/y workouts" on the right.
- **Day rows** (7 per week; grid columns 44px / 1fr / auto, radius 18):
  - day of week + date number, focus name (16/600), exercise list like "Lat pulldown 3×12 · Cable machine 3×12"
  - status: Done (`#2a9d5c`), Missed (`#c8301f`, a past day not fully logged) or Today (`#2f6fdd`)
  - Rest days use a dark glass row. Today's row has a 2.5px `#2f6fdd` ring.

### Stats
- **Two tiles:** Streak (consecutive weeks, counting back from this week, that have any logged set) and This week (volume = sum of weight × reps × sets since Sunday).
- **Chart card:** machine filter chips, then the PR, a green change number (last minus first of the last 8 sessions), and a line chart of the last 8 session weights (stroke `#2f6fdd`, 2.5px; white dots with a blue stroke). Start date on the left, "Today" on the right.
- **Personal records list:** machine, PR weight, date.

## Data model
```
Machine   { id, name, photo, history: Session[] }
Session   { date: 'YYYY-MM-DD', weight, reps, sets, isPr? }
Plan      { name, startDate (a Monday), weeks: Day[7][] }   // index 0 = Mon
Day       { focus, items: { machineId, sets, reps }[] } | null (rest)
Settings  { units: 'lbs'|'kg', weightStep: 2.5|5|10 }
```
- **Plan day:** `diff = days(today - startDate)`, then `week = floor(diff/7)` and `dow = diff % 7`.
- **PR:** a session is a PR when its weight is above the previous max for that machine.
- Store everything locally (SwiftData/CoreData or AsyncStorage). No backend needed.

## Plan import (to build)
The user will provide a 3-month (12-week) plan. Add an import step (CSV/JSON, or a manual editor) that turns it into the `Plan` structure above. The sample plan is Mon Pull, Tue Legs, Thu Push, Fri Legs + Back, other days rest. Weeks 1–4 are 3×12, weeks 5–8 are 4×10, weeks 9–12 are 4×8.

## Design tokens
- **Ink:** `#17170f`
- **Muted:** `#6f6e66`
- **Card surfaces:** `#fff`, `#f7f6f2`; control fill `#f0efea` (pressed: `#e2e1da`)
- **On-photo text:** `#f5f1ea`
- **Accent blue:** `#2f6fdd` (pressed: `#1f55b8`; tint `#e8f0fd`)
- **Brand red:** `#ff5a3c`
- **Success:** `#2a9d5c`
- **Danger:** `#c8301f`
- **Radii:** 7–10 (pills), 16, 18, 20, 22, 24, 30
- **Type sizes:** 64 / 34 / 32 / 28 / 22 / 20 / 17 / 16 / 15 / 13 / 12 / 11. Uppercase labels are 12–13/600 with 0.6px letter-spacing.

## Assets
- **Cave background:** "Thor's cave, view from inside" by Iankelsall1, Wikimedia Commons. Credit it as required by its license, or swap in your own photo.
- **Machine photos:** supplied by the user (cable machine, leg press, lat pulldown, Smith machine).

## Files
- `Lift Tracker.dc.html`: the full prototype (template + logic)
- `ios-frame.jsx`, `image-slot.js`: helpers for the mock only
