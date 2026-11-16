// Fat loss happens in the kitchen. You cannot spot-reduce belly fat with crunches; you lose it when your whole body
// fat drops, which takes a steady calorie deficit plus enough protein to keep the muscle you are training.
// These are starting estimates; adjust using your weekly weight and waist trend (see bodyStats).

const LB_TO_KG = 0.45359237
const IN_TO_CM = 2.54

/** Mifflin-St Jeor resting energy, kcal/day. */
export function bmr({ sex, age, weightLb, heightIn }) {
  const kg = weightLb * LB_TO_KG
  const cm = heightIn * IN_TO_CM
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'female' ? -161 : 5)
}

// Activity multipliers; a 5-6 day PainCave week is around "active".
const ACTIVITY = { light: 1.375, moderate: 1.55, active: 1.725 }

export function nutritionTargets(profile) {
  const missing = ['sex', 'age', 'weightLb', 'heightIn'].filter((k) => profile[k] == null)
  if (missing.length) return { ready: false, missing, message: `Add ${missing.join(', ')} to your profile to get targets.` }
  const activity = profile.activity ?? (profile.daysPerWeek >= 5 ? 'active' : profile.daysPerWeek >= 4 ? 'moderate' : 'light')
  const maintenance = bmr(profile) * (ACTIVITY[activity] ?? ACTIVITY.moderate)
  // Aim for about 0.75% of body weight per week (≈ 3500 kcal per lb is the rough rule), capped at a 750 kcal deficit.
  const weeklyLossLb = Math.min(profile.weightLb * 0.0075, 1.5)
  const deficit = Math.min(750, (weeklyLossLb * 3500) / 7)
  const floor = profile.sex === 'female' ? 1300 : 1600
  const calories = Math.max(floor, Math.round((maintenance - deficit) / 10) * 10)
  const refLb = profile.goalWeightLb ?? profile.weightLb
  const proteinG = Math.round(refLb * 0.8 / 5) * 5 // ~1.8 g/kg of goal weight
  const fatG = Math.round((calories * 0.27) / 9)
  const carbG = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4))
  return {
    ready: true,
    activity,
    maintenanceCalories: Math.round(maintenance / 10) * 10,
    calories,
    expectedWeeklyLossLb: Math.round(((maintenance - calories) * 7 / 3500) * 10) / 10,
    macros: { proteinG, fatG, carbG },
    fiberG: profile.sex === 'female' ? 25 : 35,
    tips: [
      'Hit protein every day: it keeps the muscle and keeps you full.',
      'Eat most of your carbs around swim and long-hike days.',
      'Re-check every 2 weeks: if the waist and the 7-day average weight have not moved, cut 100-150 kcal.',
      'Swimming makes many people very hungry; plan a protein snack for after the pool.',
    ],
    disclaimer: 'Estimates only, not medical advice. Talk to a doctor or dietitian if you have a health condition.',
  }
}

/** Weight and waist trend. Waist-to-height under 0.5 is a widely used healthy-belly marker. */
export function bodyStats(entries, profile = {}) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const series = (key) => sorted.filter((e) => e[key] != null).map((e) => ({ date: e.date, value: e[key] }))
  const weight = series('weightLb')
  const waist = series('waistIn')
  const avg = (xs) => (xs.length ? xs.reduce((a, x) => a + x.value, 0) / xs.length : null)
  const last7 = (xs) => {
    if (!xs.length) return []
    const end = new Date(xs.at(-1).date + 'T00:00:00Z')
    return xs.filter((x) => (end - new Date(x.date + 'T00:00:00Z')) / 86400000 < 7)
  }
  const r1 = (n) => (n == null ? null : Math.round(n * 10) / 10)
  const latestWaist = waist.at(-1)?.value ?? null
  const height = profile.heightIn ?? null
  const whtr = latestWaist && height ? Math.round((latestWaist / height) * 100) / 100 : null
  return {
    weight: {
      latest: weight.at(-1) ?? null,
      first: weight[0] ?? null,
      sevenDayAverage: r1(avg(last7(weight))),
      change: weight.length > 1 ? r1(weight.at(-1).value - weight[0].value) : null,
      series: weight,
    },
    waist: {
      latest: waist.at(-1) ?? null,
      first: waist[0] ?? null,
      change: waist.length > 1 ? r1(waist.at(-1).value - waist[0].value) : null,
      series: waist,
    },
    waistToHeight: whtr,
    waistTargetIn: height ? r1(height * 0.5) : null,
    waistToHeightNote: whtr == null ? 'Log your waist (at the belly button, relaxed) and height to track this.' : whtr < 0.5 ? 'Under 0.5: healthy range.' : 'Above 0.5: the program is aimed at bringing this down.',
  }
}
