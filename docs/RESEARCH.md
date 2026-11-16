# PainCave: research behind the program

Researched November 2026. Goal: **swim, hike, and lose the belly.**

## What "not have a stomach" takes

- **You cannot spot-reduce.** Crunches don't burn belly fat specifically. Belly fat goes when total body fat goes, which takes a steady calorie deficit. PainCave sets calorie and protein targets (`/api/nutrition`) and tracks waist and weight trends (`/api/body/stats`).
- **Protein and strength training protect muscle while you diet.** The program lifts twice a week and sets protein at about 0.8 g per lb of goal weight (≈1.8 g/kg).
- **The waist is the best number to track.** Waist-to-height under 0.5 is a widely used healthy-belly marker, and the stats endpoint reports it. The scale moves around day to day, so the app reports a 7-day average weight.
- **Lots of easy aerobic work** (swimming, incline walking, hiking) burns calories without wrecking recovery. Daily steps on rest days matter too.
- Core work trains the trunk for climbing with a pack and for holding a swimming streamline. Its job is strength, not burning fat.

## Shape of the 12 weeks

| | Weeks | Strength | Swim | Hike |
|---|---|---|---|---|
| Base | 1-4 | 3×10-12 at RPE 7 | Drills, 50s and 100s, CSS test in week 1 | 60-90 min, light pack |
| Build | 5-8 | 4×8-10 at RPE 8, stair finisher | 100s and 200s at CSS +4 s, pull buoy | 105-135 min, 10-15 lb |
| Peak | 9-12 | 4×6-8 at RPE 8-9 | 300s at CSS +2 s; mile swim and CSS retest in week 12 | up to 180 min, 20 lb |

Weeks 4 and 8 are deloads. The default week (5 days) is: Mon Hike Legs · Tue Swim Technique · Thu Swim Pull · Fri Swim Endurance · Sat Long Hike. 6 days adds Wed Climb Conditioning. 4 days drops Friday's swim. 3 days is Lower, Swim, Upper.

- **Hike Legs** builds the climbing muscles: a squat, a hip hinge, step-ups (the most hike-specific lift, with a slow lower for downhills), calves, hip stability (glute med for uneven ground) and anti-rotation core for carrying a pack.
- **Swim Pull** builds the freestyle pull: lat pulldown or pull-ups, rows, straight-arm pulldowns (the catch), face pulls and rear delts (shoulder health; swimmers' shoulders tend to round forward), and hollow holds (streamline).
- **Swim sessions** use CSS (critical swim speed): swim a 400 and a 200 flat out, and CSS pace per 100 = (t400 − t200) / 2. Endurance intervals are set a few seconds slower than CSS, and the targets tighten each phase.
- **Climb Conditioning and Long Hike** stay in Zone 2 (you can talk in full sentences) on the stair climber or an incline treadmill, with intervals from the Build phase on. The long hike's time and pack weight grow each week.
- **Load progression is double progression:** once every set reaches the top of the rep range, the app suggests adding 5 lb (or 2.5 lb on small cable moves).

## Gym equipment

Neither chain publishes one equipment list, and clubs vary. PainCave marks each item `standard`, `common` or `varies` per gym (`src/data/equipment.mjs`). It assumes standard and common items are there and varies items aren't, and you override per club with `equipmentOverrides`.

**Planet Fitness.** Machine-heavy. It has Smith machines, dumbbells (usually up to about 60-75 lb), benches, cable stations, selectorized machines (leg press, leg extension and curl, hip abductor and adductor, chest and shoulder press, lat pulldown, seated row, pec deck, ab crunch), the 30-Minute Express Circuit (10 strength machines plus 10 step stations) and a big cardio floor. **There are no barbells, no squat racks and no pool**, so PF squats use the Smith machine and PF-only swim days become dryland sessions with a warning.

**YMCA.** Most branches have a **lap pool (usually 25 yd, 4-8 lanes, lap swim on a schedule)**, dumbbells, barbells, benches, kettlebells, squat racks and machines, though rack counts vary by branch. With both memberships, PainCave sends swims to the Y and picks whichever gym has better equipment for each lifting day.

### Sources

- Planet Fitness, *5 benefits of circuit training* (30-Minute Express Circuit format): https://www.planetfitness.com/community/articles/5-benefits-circuit-training
- Planet Fitness, *Full-body circuit workout for beginners*: https://www.planetfitness.com/community/articles/full-body-circuit-workout-for-beginners
- Art of Manliness, *Can you get jacked at Planet Fitness?* (Smith machines, dumbbells, no racks): https://www.artofmanliness.com/health-fitness/fitness/can-you-get-jacked-at-planet-fitness/
- SI Showcase, *Planet Fitness review*: https://www.si.com/showcase/fitness/planet-fitness-review
- Gym Mikolo, *Can you bench at Planet Fitness?*: https://gym-mikolo.com/blogs/home-gym/can-you-bench-at-planet-fitness-what-to-expect-and-what-not-to
- Holyoke YMCA facility page (8-lane 25-yd pool, 3 squat racks, 2 deadlift platforms): https://holyokeymca.org/About-the-Y-Our-Facility
- YMCA Dallas branch (25 m pool, 6 lap lanes): https://ymcadallas.org/node/1711
- Ann Arbor YMCA facility features: https://www.annarborymca.org/facility-features/
- YMCA of Long Island, Huntington equipment: https://ymcali.org/locations/huntington-ymca/amenities
- West YMCA Wichita fitness center: https://ymcawichita.org/node/2

Many third-party equipment lists are low quality, so check your own club. The Planet Fitness app and YMCA branch pages list each location's amenities.

*Not medical advice. Check with a doctor before starting if you have a health condition.*
