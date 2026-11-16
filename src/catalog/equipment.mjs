// Equipment catalog and gym profiles.
//
// Researched November 2026. Neither Planet Fitness nor the YMCA publishes one standard equipment list, and every club
// differs, so each gym item has an availability level:
//   "standard" – found in essentially every club of that chain        → assumed available
//   "common"   – found in most clubs                                   → assumed available
//   "varies"   – some clubs have it, many do not                       → assumed NOT available until you confirm it
// Anything not listed for a gym is treated as absent. Use profile.equipmentOverrides to match your own club.
// See docs/RESEARCH.md for the sources behind these choices.

export const EQUIPMENT = {
  // Cardio
  treadmill: { name: 'Treadmill (with incline)', category: 'cardio' },
  stair_climber: { name: 'Stair climber / StepMill', category: 'cardio' },
  elliptical: { name: 'Elliptical', category: 'cardio' },
  arc_trainer: { name: 'Arc trainer', category: 'cardio' },
  upright_bike: { name: 'Upright bike', category: 'cardio' },
  recumbent_bike: { name: 'Recumbent bike', category: 'cardio' },
  spin_bike: { name: 'Indoor cycling bike', category: 'cardio' },
  rower: { name: 'Rowing machine', category: 'cardio' },
  indoor_track: { name: 'Indoor track', category: 'cardio' },

  // Selectorized machines
  leg_press: { name: 'Leg press', category: 'machine' },
  leg_extension: { name: 'Leg extension', category: 'machine' },
  leg_curl: { name: 'Leg curl (seated or lying)', category: 'machine' },
  hip_abductor: { name: 'Hip abductor', category: 'machine' },
  hip_adductor: { name: 'Hip adductor', category: 'machine' },
  calf_raise_machine: { name: 'Calf raise machine', category: 'machine' },
  chest_press_machine: { name: 'Chest press machine', category: 'machine' },
  shoulder_press_machine: { name: 'Shoulder press machine', category: 'machine' },
  lat_pulldown: { name: 'Lat pulldown', category: 'machine' },
  seated_row_machine: { name: 'Seated row machine', category: 'machine' },
  pec_deck: { name: 'Pec deck / rear-delt fly', category: 'machine' },
  ab_crunch_machine: { name: 'Abdominal crunch machine', category: 'machine' },
  back_extension: { name: 'Back extension / Roman chair', category: 'machine' },
  assisted_pullup: { name: 'Assisted pull-up / dip machine', category: 'machine' },
  cable_station: { name: 'Adjustable cable station', category: 'machine' },
  smith_machine: { name: 'Smith machine', category: 'machine' },
  pf_express_circuit: { name: 'PF 30-Minute Express Circuit', category: 'machine' },

  // Free weights and functional
  dumbbells: { name: 'Dumbbells', category: 'free_weight' },
  bench: { name: 'Flat / adjustable bench', category: 'free_weight' },
  kettlebells: { name: 'Kettlebells', category: 'free_weight' },
  barbell: { name: 'Olympic barbell and plates', category: 'free_weight' },
  squat_rack: { name: 'Squat rack / power cage', category: 'free_weight' },
  plyo_box: { name: 'Plyo box / step platform', category: 'functional' },
  pullup_bar: { name: 'Pull-up bar', category: 'functional' },
  suspension_trainer: { name: 'Suspension trainer (TRX)', category: 'functional' },
  medicine_ball: { name: 'Medicine ball', category: 'functional' },
  stability_ball: { name: 'Stability ball', category: 'functional' },
  mat: { name: 'Floor mat / stretch area', category: 'functional' },

  // Pool
  lap_pool: { name: 'Lap pool', category: 'pool' },
  kickboard: { name: 'Kickboard', category: 'pool' },
  pull_buoy: { name: 'Pull buoy', category: 'pool' },
}

export const GYMS = {
  'planet-fitness': {
    id: 'planet-fitness',
    name: 'Planet Fitness',
    summary:
      'Machine-focused. Smith machines and dumbbells (usually up to 60-75 lb) are the free-weight options; there are no barbells, squat racks or pools. Cardio floor is large.',
    equipment: {
      treadmill: 'standard',
      elliptical: 'standard',
      upright_bike: 'standard',
      recumbent_bike: 'standard',
      stair_climber: 'common',
      arc_trainer: 'common',
      rower: 'varies',
      leg_press: 'standard',
      leg_extension: 'standard',
      leg_curl: 'standard',
      hip_abductor: 'standard',
      hip_adductor: 'standard',
      calf_raise_machine: 'varies',
      chest_press_machine: 'standard',
      shoulder_press_machine: 'standard',
      lat_pulldown: 'standard',
      seated_row_machine: 'standard',
      pec_deck: 'standard',
      ab_crunch_machine: 'standard',
      back_extension: 'common',
      assisted_pullup: 'varies',
      cable_station: 'common',
      smith_machine: 'standard',
      pf_express_circuit: 'standard',
      dumbbells: 'standard',
      bench: 'standard',
      kettlebells: 'varies',
      plyo_box: 'common',
      pullup_bar: 'common',
      suspension_trainer: 'common',
      medicine_ball: 'common',
      stability_ball: 'common',
      mat: 'standard',
    },
    notes: [
      'No pool: swim sessions need a YMCA or another pool.',
      'No barbells or racks: squats and presses use the Smith machine, dumbbells or machines.',
      'Dumbbells usually stop at 60-75 lb, which limits heavy dumbbell RDLs; the program switches to the Smith machine as you get stronger.',
    ],
  },
  ymca: {
    id: 'ymca',
    name: 'YMCA',
    summary:
      'Full-service community gym. Most branches have a lap pool (usually 25 yd, 4-8 lanes), free weights with barbells and racks, machines and cardio. Lap swim is scheduled, so check the lane times.',
    equipment: {
      treadmill: 'standard',
      elliptical: 'standard',
      upright_bike: 'standard',
      recumbent_bike: 'standard',
      spin_bike: 'common',
      stair_climber: 'common',
      arc_trainer: 'varies',
      rower: 'common',
      indoor_track: 'varies',
      leg_press: 'common',
      leg_extension: 'common',
      leg_curl: 'common',
      hip_abductor: 'common',
      hip_adductor: 'common',
      calf_raise_machine: 'varies',
      chest_press_machine: 'common',
      shoulder_press_machine: 'common',
      lat_pulldown: 'standard',
      seated_row_machine: 'common',
      pec_deck: 'common',
      ab_crunch_machine: 'varies',
      back_extension: 'common',
      assisted_pullup: 'common',
      cable_station: 'common',
      smith_machine: 'varies',
      dumbbells: 'standard',
      bench: 'standard',
      kettlebells: 'common',
      barbell: 'common',
      squat_rack: 'common',
      plyo_box: 'common',
      pullup_bar: 'common',
      suspension_trainer: 'varies',
      medicine_ball: 'common',
      stability_ball: 'common',
      mat: 'standard',
      lap_pool: 'common',
      kickboard: 'common',
      pull_buoy: 'common',
    },
    notes: [
      'Each branch is different: confirm the pool, rack count and lap-swim schedule at yours.',
      'Most YMCA pools are 25 yards; set poolLength and poolUnit in your profile if yours is 25 m or 50 m.',
    ],
  },
}

const ASSUMED = new Set(['standard', 'common'])

/** The set of equipment ids available at one gym, after the profile's overrides. */
export function availableAt(gymId, overrides = {}) {
  const gym = GYMS[gymId]
  if (!gym) throw new Error(`Unknown gym: ${gymId}`)
  const set = new Set()
  for (const [id, level] of Object.entries(gym.equipment)) if (ASSUMED.has(level)) set.add(id)
  for (const [id, on] of Object.entries(overrides[gymId] ?? {})) {
    if (!EQUIPMENT[id]) continue
    if (on) set.add(id)
    else set.delete(id)
  }
  return set
}

/** Equipment you can use for gym sessions, merged across every gym in the profile. */
export function availableAcross(gymIds, overrides = {}) {
  const merged = new Set()
  for (const g of gymIds) for (const id of availableAt(g, overrides)) merged.add(id)
  return merged
}
