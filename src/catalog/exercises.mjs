// Exercise library. `equipment` is ALL of what an exercise needs; `anyOf` lists alternatives where one is enough.
// `increment` is the suggested load jump in lb once every set reaches the top of its rep range.

export const EXERCISES = {
  // ── Lower body: hiking legs ───────────────────────────────────────────────────────────────────────────
  barbell_back_squat: {
    name: 'Barbell back squat', equipment: ['barbell', 'squat_rack'], muscles: ['quads', 'glutes', 'core'],
    goals: ['hike'], increment: 5,
    cues: ['Brace before you descend', 'Knees track over toes', 'Hips to at least parallel'],
  },
  smith_squat: {
    name: 'Smith machine squat', equipment: ['smith_machine'], muscles: ['quads', 'glutes'], goals: ['hike'], increment: 5,
    cues: ['Feet slightly in front of the bar', 'Control the way down for 2 seconds', 'Drive through the whole foot'],
  },
  goblet_squat: {
    name: 'Goblet squat', equipment: [], anyOf: ['dumbbells', 'kettlebells'], muscles: ['quads', 'glutes', 'core'],
    goals: ['hike'], increment: 5,
    cues: ['Hold the weight at your chest', 'Elbows inside the knees at the bottom', 'Chest tall'],
  },
  leg_press: {
    name: 'Leg press', equipment: ['leg_press'], muscles: ['quads', 'glutes'], goals: ['hike'], increment: 10,
    cues: ['Lower back stays on the pad', 'Do not lock the knees at the top'],
  },
  barbell_rdl: {
    name: 'Barbell Romanian deadlift', equipment: ['barbell'], muscles: ['hamstrings', 'glutes', 'back'],
    goals: ['hike', 'swim'], increment: 5,
    cues: ['Push the hips back, soft knees', 'Bar stays against the legs', 'Stop when the back wants to round'],
  },
  smith_rdl: {
    name: 'Smith machine Romanian deadlift', equipment: ['smith_machine'], muscles: ['hamstrings', 'glutes'],
    goals: ['hike'], increment: 5, cues: ['Hinge at the hips', 'Long spine', 'Squeeze glutes to stand'],
  },
  db_rdl: {
    name: 'Dumbbell Romanian deadlift', equipment: ['dumbbells'], muscles: ['hamstrings', 'glutes'], goals: ['hike'],
    increment: 5, cues: ['Dumbbells slide down the thighs', 'Hips back, not down'],
  },
  back_extension: {
    name: 'Back extension', equipment: ['back_extension'], muscles: ['glutes', 'hamstrings', 'lower back'],
    goals: ['hike', 'swim'], increment: 5, cues: ['Hinge at the hips', 'Squeeze glutes at the top; do not over-arch'],
  },
  db_step_up: {
    name: 'Dumbbell step-up', equipment: ['dumbbells'], anyOf: ['plyo_box', 'bench'], muscles: ['quads', 'glutes'],
    goals: ['hike'], perSide: true, increment: 5,
    cues: ['Knee-height box', 'Push through the top foot only', 'Lower slowly: this is the downhill muscle'],
  },
  db_reverse_lunge: {
    name: 'Dumbbell reverse lunge', equipment: ['dumbbells'], muscles: ['quads', 'glutes'], goals: ['hike'],
    perSide: true, increment: 5, cues: ['Step back long', 'Front shin near vertical'],
  },
  split_squat: {
    name: 'Bodyweight split squat', equipment: [], muscles: ['quads', 'glutes'], goals: ['hike'], perSide: true,
    increment: 0, cues: ['Back knee to just above the floor', 'Slow on the way down'],
  },
  leg_curl: {
    name: 'Leg curl', equipment: ['leg_curl'], muscles: ['hamstrings'], goals: ['hike'], increment: 5,
    cues: ['Hips pinned to the pad', '3 seconds on the way back'],
  },
  ball_hamstring_curl: {
    name: 'Stability ball hamstring curl', equipment: ['stability_ball'], muscles: ['hamstrings', 'glutes'],
    goals: ['hike'], increment: 0, cues: ['Hips up the whole set', 'Roll the ball in with your heels'],
  },
  machine_calf_raise: {
    name: 'Calf raise machine', equipment: ['calf_raise_machine'], muscles: ['calves'], goals: ['hike', 'swim'],
    increment: 10, cues: ['Full stretch at the bottom', 'Pause 1 second at the top'],
  },
  smith_calf_raise: {
    name: 'Smith machine calf raise', equipment: ['smith_machine'], muscles: ['calves'], goals: ['hike'], increment: 10,
    cues: ['Balls of the feet on a plate', 'Full range'],
  },
  db_single_leg_calf_raise: {
    name: 'Single-leg dumbbell calf raise', equipment: ['dumbbells'], muscles: ['calves'], goals: ['hike'],
    perSide: true, increment: 5, cues: ['Stand on a step edge', 'Slow lower'],
  },
  hip_abductor: {
    name: 'Hip abductor machine', equipment: ['hip_abductor'], muscles: ['glute med'], goals: ['hike'], increment: 10,
    cues: ['Lean slightly forward', 'Control the return'],
  },
  cable_hip_abduction: {
    name: 'Cable standing hip abduction', equipment: ['cable_station'], muscles: ['glute med'], goals: ['hike'],
    perSide: true, increment: 2.5, cues: ['Ankle strap', 'Stay tall, no leaning'],
  },
  side_plank: {
    name: 'Side plank', equipment: [], unit: 'seconds', muscles: ['obliques', 'glute med'], goals: ['core', 'hike'],
    perSide: true, increment: 0, cues: ['Straight line from head to heel', 'Push the floor away'],
  },

  // ── Upper body: swim pull and shoulder health ───────────────────────────────────────────────────────
  lat_pulldown: {
    name: 'Lat pulldown', equipment: ['lat_pulldown'], muscles: ['lats', 'biceps'], goals: ['swim'], increment: 5,
    cues: ['Pull the elbows to your back pockets', 'Chest up, no swinging'],
  },
  assisted_pullup: {
    name: 'Assisted pull-up', equipment: ['assisted_pullup'], muscles: ['lats', 'biceps'], goals: ['swim'],
    increment: -5, cues: ['Less assistance = progress', 'Full hang at the bottom'],
  },
  pullup_negative: {
    name: 'Pull-up negatives', equipment: ['pullup_bar'], muscles: ['lats', 'biceps'], goals: ['swim'], increment: 0,
    cues: ['Jump to the top', 'Lower for 4-5 seconds'],
  },
  seated_row_machine: {
    name: 'Seated row machine', equipment: ['seated_row_machine'], muscles: ['mid back', 'lats'], goals: ['swim'],
    increment: 5, cues: ['Lead with the elbows', 'Shoulder blades back and down'],
  },
  cable_row: {
    name: 'Seated cable row', equipment: ['cable_station'], muscles: ['mid back', 'lats'], goals: ['swim'], increment: 5,
    cues: ['Tall spine', 'Pause with the handle at your stomach'],
  },
  db_row: {
    name: 'One-arm dumbbell row', equipment: ['dumbbells', 'bench'], muscles: ['lats', 'mid back'], goals: ['swim'],
    perSide: true, increment: 5, cues: ['Pull to the hip, not the chest', 'Flat back'],
  },
  db_bench_press: {
    name: 'Dumbbell bench press', equipment: ['dumbbells', 'bench'], muscles: ['chest', 'triceps', 'shoulders'],
    goals: ['swim'], increment: 5, cues: ['Elbows about 45° from the body', 'Shoulder blades pinned'],
  },
  chest_press_machine: {
    name: 'Chest press machine', equipment: ['chest_press_machine'], muscles: ['chest', 'triceps'], goals: ['swim'],
    increment: 5, cues: ['Handles at mid-chest', 'Smooth press, no lockout slam'],
  },
  pushup: {
    name: 'Push-up', equipment: [], muscles: ['chest', 'triceps', 'core'], goals: ['swim', 'core'], increment: 0,
    cues: ['Body in one line', 'Chest to fist height'],
  },
  db_shoulder_press: {
    name: 'Half-kneeling dumbbell press', equipment: ['dumbbells'], muscles: ['shoulders', 'core'], goals: ['swim'],
    perSide: true, increment: 5, cues: ['Squeeze the down-knee glute', 'Press up and slightly in'],
  },
  shoulder_press_machine: {
    name: 'Shoulder press machine', equipment: ['shoulder_press_machine'], muscles: ['shoulders'], goals: ['swim'],
    increment: 5, cues: ['Handles start at chin height', 'Ribs down'],
  },
  straight_arm_pulldown: {
    name: 'Cable straight-arm pulldown', equipment: ['cable_station'], muscles: ['lats'], goals: ['swim'],
    increment: 2.5, cues: ['This is your freestyle catch', 'Arms long, sweep to the thighs'],
  },
  db_pullover: {
    name: 'Dumbbell pullover', equipment: ['dumbbells', 'bench'], muscles: ['lats', 'chest'], goals: ['swim'],
    increment: 5, cues: ['Slight elbow bend', 'Stop when the ribs flare'],
  },
  face_pull: {
    name: 'Cable face pull', equipment: ['cable_station'], muscles: ['rear delts', 'rotator cuff'], goals: ['swim'],
    increment: 2.5, cues: ['Rope to the eyes', 'Thumbs back at the finish'],
  },
  reverse_pec_deck: {
    name: 'Reverse pec deck', equipment: ['pec_deck'], muscles: ['rear delts', 'mid back'], goals: ['swim'],
    increment: 5, cues: ['Lead with the backs of the hands', 'No shrugging'],
  },
  db_rear_delt_raise: {
    name: 'Bent-over dumbbell rear-delt raise', equipment: ['dumbbells'], muscles: ['rear delts'], goals: ['swim'],
    increment: 2.5, cues: ['Light weight', 'Arms out wide, pause at the top'],
  },

  // ── Core: the "no stomach" work is the whole program; this is the trunk strength part ─────────────────
  dead_bug: {
    name: 'Dead bug', equipment: [], muscles: ['abs'], goals: ['core', 'swim'], perSide: true, increment: 0,
    cues: ['Lower back pressed into the floor', 'Breathe out as the limbs lower'],
  },
  pallof_press: {
    name: 'Cable Pallof press', equipment: ['cable_station'], muscles: ['obliques', 'abs'], goals: ['core', 'hike'],
    perSide: true, increment: 2.5, cues: ['Stand side-on to the cable', 'Do not let it twist you'],
  },
  suitcase_carry: {
    name: 'Suitcase carry', equipment: [], anyOf: ['dumbbells', 'kettlebells'], unit: 'steps',
    muscles: ['obliques', 'grip'], goals: ['core', 'hike'], perSide: true, increment: 5,
    cues: ['Heavy weight in one hand', 'Walk tall, no lean'],
  },
  cable_woodchop: {
    name: 'Cable woodchop', equipment: ['cable_station'], muscles: ['obliques'], goals: ['core', 'swim'],
    perSide: true, increment: 2.5, cues: ['Rotate from the hips and ribs together', 'Arms stay long'],
  },
  ball_rollout: {
    name: 'Stability ball rollout', equipment: ['stability_ball'], muscles: ['abs'], goals: ['core', 'swim'],
    increment: 0, cues: ['Ribs down', 'Roll only as far as you can without the back sagging'],
  },
  plank: {
    name: 'Plank', equipment: [], unit: 'seconds', muscles: ['abs'], goals: ['core', 'swim'], increment: 0,
    cues: ['Squeeze glutes and quads', 'Push the floor away'],
  },
  hollow_hold: {
    name: 'Hollow body hold', equipment: [], unit: 'seconds', muscles: ['abs'], goals: ['core', 'swim'], increment: 0,
    cues: ['The streamline position for swimming', 'Lower back stays down'],
  },

  // ── Dryland swim (used when no pool is available) ───────────────────────────────────────────────────
  prone_flutter_kick: {
    name: 'Prone flutter kick', equipment: [], unit: 'seconds', muscles: ['glutes', 'lower back'], goals: ['swim'],
    increment: 0, cues: ['Lie face down, arms overhead', 'Small, fast kicks from the hips'],
  },
}

/**
 * Movement slots used by the program. Candidates are in order of preference; the first one whose equipment is
 * available is chosen, the rest are listed as swaps.
 */
export const SLOTS = {
  squat: ['barbell_back_squat', 'smith_squat', 'goblet_squat', 'leg_press'],
  hinge: ['barbell_rdl', 'smith_rdl', 'db_rdl', 'back_extension'],
  single_leg: ['db_step_up', 'db_reverse_lunge', 'split_squat'],
  hamstring: ['leg_curl', 'ball_hamstring_curl', 'back_extension'],
  calves: ['machine_calf_raise', 'smith_calf_raise', 'db_single_leg_calf_raise'],
  hip_stability: ['hip_abductor', 'cable_hip_abduction', 'side_plank'],
  vertical_pull: ['lat_pulldown', 'assisted_pullup', 'pullup_negative'],
  horizontal_pull: ['seated_row_machine', 'cable_row', 'db_row'],
  push: ['db_bench_press', 'chest_press_machine', 'pushup'],
  overhead: ['db_shoulder_press', 'shoulder_press_machine', 'pushup'],
  swim_catch: ['straight_arm_pulldown', 'db_pullover', 'pullup_negative'],
  shoulder_health: ['face_pull', 'reverse_pec_deck', 'db_rear_delt_raise'],
  anti_rotation: ['pallof_press', 'suitcase_carry', 'side_plank'],
  anti_extension: ['ball_rollout', 'dead_bug', 'plank'],
  rotation: ['cable_woodchop', 'side_plank'],
  carry: ['suitcase_carry', 'side_plank'],
  streamline: ['hollow_hold', 'plank'],
}

export function canDo(exercise, available) {
  if (!exercise.equipment.every((e) => available.has(e))) return false
  if (exercise.anyOf && !exercise.anyOf.some((e) => available.has(e))) return false
  return true
}

/** Pick the best exercise for a slot; returns { exerciseId, swaps } or null if nothing fits. */
export function pickForSlot(slot, available) {
  const candidates = SLOTS[slot]
  if (!candidates) throw new Error(`Unknown slot: ${slot}`)
  const ok = candidates.filter((id) => canDo(EXERCISES[id], available))
  if (!ok.length) return null
  return { exerciseId: ok[0], swaps: ok.slice(1) }
}
