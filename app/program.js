// Foundation Reset — 4-week programme (Phase 1: mobility, stability & functional strength)
// Edit this file to change exercises. Exercise ids must stay stable so history keeps matching.

const PROGRAM = {
  name: "Foundation Reset",
  subtitle: "Phase 1 · Mobility, stability & functional strength",
  weeks: 4,

  // 0 = Sunday … 6 = Saturday
  schedule: {
    1: { key: "A" },
    2: { key: "M" },
    3: { key: "B" },
    4: { key: "REST", label: "Rest or easy walking", note: "Recovery day. An easy walk is great." },
    5: { key: "C" },
    6: { key: "M", optional: true, label: "Optional mobility or easy cardio" },
    0: { key: "REST", label: "Rest", note: "Full recovery day." },
  },

  weekGuidance: {
    1: { title: "Learn the movements", effort: "5–6/10",
         text: "Two working sets per exercise (already applied). Use light weights and support where needed. Record your baseline assessments this week." },
    2: { title: "Build consistency", effort: "6–7/10",
         text: "Full sets and reps. Focus on smooth tempo and the same movement quality through every set." },
    3: { title: "Increase the challenge", effort: "≈7/10",
         text: "If every rep felt comfortable, add a little weight or one extra rep. Try reducing hand support on some balance exercises." },
    4: { title: "Consolidate and reassess", effort: "6–7/10",
         text: "Keep technique solid under the slightly higher demand. Repeat your assessments and compare how you move." },
  },

  generalTips: [
    "Rest 60–90 s between sets (up to 2 min for demanding ones).",
    "Finish most sets feeling you could do 2–4 more reps. No training to failure.",
    "If anything causes sharp pain, reduce range or load, or swap the movement.",
  ],

  sessions: {
    A: {
      key: "A", name: "Lower-body foundations", short: "Workout A", duration: "50–60 min",
      goal: "Improve hip and ankle mobility, learn to squat and hinge efficiently, and strengthen your legs while keeping your trunk stable.",
      warmup: [
        { id: "a-w1", name: "90/90 hip switches", rx: "8 total reps" },
        { id: "a-w2", name: "Knee-to-wall rocks", rx: "10 per side" },
        { id: "a-w3", name: "Assisted squat hold", rx: "2 × 20 sec" },
      ],
      exercises: [
        { id: "goblet-squat-box", name: "Goblet squat to box", sets: 3, reps: "8", focus: "Squat depth, knee and hip control", load: true },
        { id: "db-rdl", name: "Dumbbell Romanian deadlift", sets: 3, reps: "8", focus: "Hip hinge, hamstrings and glutes", load: true },
        { id: "supported-reverse-lunge", name: "Supported reverse lunge", sets: 2, reps: "6 / leg", focus: "Single-leg strength and balance", load: true },
        { id: "chest-supported-row", name: "Chest-supported dumbbell row", sets: 3, reps: "10", focus: "Upper-back strength", load: true },
        { id: "dead-bug", name: "Dead bug", sets: 2, reps: "8 / side", focus: "Core control" },
        { id: "suitcase-carry", name: "Suitcase carry", sets: 2, reps: "25 m / side", focus: "Lateral core stability", load: true },
      ],
      technique: "Lower into the squat over about three seconds. For RDLs, push your hips back without rounding your back. Use support during lunges if it helps you keep balance.",
    },
    B: {
      key: "B", name: "Stability, balance and control", short: "Workout B", duration: "45–55 min",
      goal: "Develop single-leg stability, improve upper-body movement and teach your core to resist unwanted rotation.",
      warmup: [
        { id: "b-w1", name: "Open-book rotations", rx: "6 per side" },
        { id: "b-w2", name: "Wall slides", rx: "10 reps" },
        { id: "b-w3", name: "Glute bridges", rx: "12 reps" },
      ],
      exercises: [
        { id: "low-box-step-up", name: "Low-box step-up", sets: 3, reps: "8 / leg", focus: "Hip stability, glutes, coordination", load: true },
        { id: "incline-push-up", name: "Incline push-up", sets: 3, reps: "8–10", focus: "Shoulder and trunk stability" },
        { id: "supported-sl-rdl", name: "Supported single-leg RDL", sets: 2, reps: "6 / leg", focus: "Balance and hip control", load: true },
        { id: "hk-cable-row", name: "Half-kneeling single-arm cable row", sets: 3, reps: "8 / side", focus: "Core stability while pulling", load: true },
        { id: "pallof-press", name: "Pallof press", sets: 2, reps: "10 / side", focus: "Anti-rotation", load: true },
        { id: "side-plank", name: "Side plank", sets: 2, reps: "20–30 sec / side", focus: "Lateral core strength" },
      ],
      technique: "Keep your pelvis level during step-ups and single-leg RDLs. During Pallof presses, don't let the cable or band twist your torso.",
    },
    C: {
      key: "C", name: "Integrated functional movement", short: "Workout C", duration: "45–55 min",
      goal: "Put your mobility and stability to work in multiple directions while building coordination and whole-body strength.",
      warmup: [
        { id: "c-w1", name: "Adductor rock-backs", rx: "8 per side" },
        { id: "c-w2", name: "Thoracic rotations", rx: "8 per side" },
        { id: "c-w3", name: "Cross-body marching", rx: "2 × 30 sec" },
      ],
      exercises: [
        { id: "kb-deadlift", name: "Kettlebell deadlift", sets: 3, reps: "8", focus: "Functional lifting pattern", load: true },
        { id: "supported-lateral-lunge", name: "Supported lateral lunge", sets: 2, reps: "6 / side", focus: "Side-to-side hip mobility and strength", load: true },
        { id: "hk-db-press", name: "Half-kneeling dumbbell press", sets: 3, reps: "8 / side", focus: "Shoulder and trunk control", load: true },
        { id: "cable-chop", name: "Standing cable or band chop", sets: 2, reps: "8 / side", focus: "Controlled rotation", load: true },
        { id: "bird-dog", name: "Bird dog", sets: 2, reps: "6 / side", focus: "Spinal stability and coordination" },
        { id: "farmers-carry", name: "Farmer's carry", sets: 3, reps: "30 m", focus: "Posture, grip and trunk strength", load: true },
      ],
      technique: "In lateral lunges, only use the depth you can comfortably control. During carries, walk tall and avoid shrugging or leaning to one side.",
    },
    M: {
      key: "M", name: "Mobility reset", short: "Mobility", duration: "15–20 min", mobility: true,
      goal: "Gentle, deliberate mobility work — not an intense stretching session.",
      warmup: [],
      exercises: [
        { id: "m-9090", name: "90/90 hip switches", sets: 2, reps: "6 total" },
        { id: "m-ankle", name: "Knee-to-wall ankle rocks", sets: 2, reps: "10 / side" },
        { id: "m-hipflexor", name: "Half-kneeling hip flexor stretch", sets: 2, reps: "30 sec / side" },
        { id: "m-adductor", name: "Adductor rock-backs", sets: 2, reps: "8 / side" },
        { id: "m-openbook", name: "Open-book thoracic rotations", sets: 2, reps: "6 / side" },
        { id: "m-squat-breath", name: "Supported deep squat breathing", sets: 2, reps: "30 sec" },
      ],
      technique: "Move slowly, use a comfortable range and avoid forcing deeper positions.",
    },
  },

  assessments: [
    { id: "ankle", name: "Ankle mobility", unit: "cm", help: "Knee-to-wall distance with your heel planted (weaker side)." },
    { id: "balance", name: "Single-leg balance", unit: "sec", help: "Longest controlled hold, up to 30 s (weaker side)." },
    { id: "squat", name: "Squat control", unit: "/ 8", help: "Comfortable, smooth bodyweight squats out of 8." },
    { id: "plank", name: "Side-plank endurance", unit: "sec", help: "Controlled hold time (weaker side)." },
  ],
};

// Week 1 = two working sets per exercise
function setsFor(ex, week) {
  return week === 1 ? Math.min(2, ex.sets) : ex.sets;
}
