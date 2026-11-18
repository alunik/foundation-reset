// Run Strong — 2× week heavy strength alongside a Runna half-marathon plan.
// Edit this file to change exercises or dates. Exercise ids must stay stable so history keeps matching.

const PROGRAM = {
  name: "Run Strong",
  subtitle: "Heavy strength for the Hackney Half",
  race: { name: "Hackney Half", date: "2027-05-16" },
  defaults: {
    startDate: "2026-11-16",  // Monday the strength programme starts (base phase)
    blockStart: "2027-02-08", // Monday the Runna half-marathon block starts
  },

  // Runna runs by week (key = that week's Monday). Days: 1 = Mon … 6 = Sat, 0 = Sun.
  // Run types: easy | key (intervals/tempo/repeats) | long.
  // `gym` is optional: leave it out and the app picks gym days around the runs.
  // Weeks you enter in the app (Plan → Edit runs & gym days) override these.
  runPlan: {
    // Post-race recovery plan
    "2026-11-16": { runs: { 2: ["easy", "5km easy"], 4: ["easy", "5km easy"], 6: ["easy", "5km easy"] }, gym: { 3: "A", 5: "B" } },
    "2026-11-23": { runs: { 3: ["easy", "5km easy"], 4: ["easy", "6km easy"], 0: ["long", "9km long run"] }, gym: { 1: "A", 4: "B" } },
    "2026-11-30": { runs: { 3: ["key", "7km · 1km repeats"], 4: ["easy", "6km easy"], 6: ["easy", "6km easy"], 0: ["long", "10km long run"] }, gym: { 1: "A", 4: "B" } },
  },
  // Used for weeks with no Runna runs entered yet (same shape as week 3 of the recovery plan).
  template: { runs: { 3: ["key", "Key session"], 4: ["easy", "Easy run"], 6: ["easy", "Easy run"], 0: ["long", "Long run"] } },
  runNames: { easy: "Easy run", key: "Key session", long: "Long run" },

  // How each phase changes the sessions. See rxFor() below.
  phases: {
    pre:    { title: "Not started yet", effort: "", text: "Your programme starts soon. You can preview the sessions." },
    ramp:   { title: "Ramp-in", effort: "3+ reps in the tank",
              text: "Your legs haven't lifted heavy during the marathon block. Start at about 70–75% of your recent working weights and build up over 2–3 weeks. Expect some soreness." },
    base:   { title: "Build strength", effort: "2–3 reps in the tank",
              text: "This is when your lifts go up. Push them now, while Runna has you on easy maintenance running." },
    block:  { title: "Half block: hold strength", effort: "2–3 reps in the tank",
              text: "Keep the weights heavy but do fewer sets. Accessories are dropped. Running comes first: if your legs feel heavy before a key run, do fewer sets, not lighter weights." },
    deload: { title: "Deload week", effort: "3+ reps in the tank",
              text: "Half the sets at the same weight. Try to line this up with Runna's easier week; you can move it from the Today screen." },
    taper:  { title: "Taper", effort: "Crisp, not hard",
              text: "Two short sessions at about 80% for 2 × 3. Leave every set feeling fast. The second one is your last leg session before the race." },
    race:   { title: "Race week", effort: "Easy",
              text: "One short upper-body session early in the week, nothing heavy after that. Good luck!" },
    post:   { title: "After the race", effort: "3+ reps in the tank",
              text: "Recover first. When you're ready to lift again, treat it like the ramp-in. Change the dates in Progress → Settings to plan your next race." },
  },

  generalTips: [
    "Never lift to failure. Every set should end with reps left in the tank.",
    "Key runs win. If lifting leaves your legs heavy before intervals or the long run, cut sets, not weight.",
    "If you get a running niggle, stop the leg work and keep the upper body going.",
    "Leave 48 h or more between heavy legs and intervals or the long run.",
  ],

  // kind: plyo | lower (main lower lift) | upper | acc (accessory, dropped in the half block) | calf
  sessions: {
    A: {
      key: "A", name: "Squat & bench", short: "Gym A", duration: "50–60 min",
      warmup: "5 min easy cardio, then ramp-up sets of squat and bench.",
      exercises: [
        { id: "pogo", name: "Pogo hops", kind: "plyo", sets: 3, reps: "10", rest: 60, focus: "Stiff ankles, quick ground contact" },
        { id: "back-squat", name: "Back squat", kind: "lower", sets: 4, reps: "4–6", rest: 180, load: true, step: 2.5 },
        { id: "bench", name: "Bench press", kind: "upper", sets: 3, reps: "5–8", rest: 150, load: true, step: 2.5 },
        { id: "bss", name: "Bulgarian split squat", kind: "acc", sets: 2, reps: "6–8 / leg", rest: 90, load: true, step: 2, focus: "Dumbbells, per hand" },
        { id: "calf-straight", name: "Standing calf raise", kind: "calf", sets: 3, reps: "8–12", rest: 75, load: true, step: 2.5, focus: "Straight knee, heavy, pause at the top" },
      ],
    },
    B: {
      key: "B", name: "Deadlift & pull-ups", short: "Gym B", duration: "50–60 min",
      warmup: "5 min easy cardio, then ramp-up sets of trap-bar deadlift.",
      exercises: [
        { id: "box-jump", name: "Box jump", kind: "plyo", sets: 3, reps: "5", rest: 90, focus: "Step down, don't jump down" },
        { id: "trap-dl", name: "Trap-bar deadlift", kind: "lower", sets: 4, reps: "3–5", rest: 180, load: true, step: 2.5 },
        { id: "pullup", name: "Pull-ups", kind: "upper", sets: 3, reps: "5–8", rest: 150, load: true, step: 2.5, focus: "Weight = added load (0 = bodyweight). Add weight once you can do 3 × 8." },
        { id: "rdl", name: "Romanian deadlift", kind: "acc", sets: 2, reps: "6–8", rest: 120, load: true, step: 2.5, focus: "Leave 3 reps in the tank. Keep soreness away from Sunday." },
        { id: "calf-bent", name: "Seated calf raise", kind: "calf", sets: 3, reps: "10–15", rest: 60, load: true, step: 2.5, focus: "Bent knee (soleus)" },
      ],
    },
  },

  // Lifts shown on the Progress screen
  keyLifts: ["back-squat", "trap-dl", "bench", "pullup"],
};

// Prescription for an exercise in a given phase. Returns null if the exercise is skipped.
// rir = reps in reserve target; pct = suggested fraction of your last working weight (taper / ramp-in start).
function rxFor(ex, phase, sessionKey, basePhase) {
  const base = { sets: ex.sets, reps: ex.reps, rir: ex.kind === "upper" || ex.kind === "calf" ? "1–2" : ex.kind === "acc" ? "2–3" : "2–3" };
  if (ex.kind === "plyo") base.rir = null;
  switch (phase) {
    case "ramp":
      return { ...base, sets: Math.max(2, ex.sets - 1), rir: ex.kind === "plyo" ? null : "3+" };
    case "base":
    case "pre":
      return base;
    case "block":
      if (ex.kind === "acc") return null;
      if (ex.kind === "lower") return { ...base, sets: 3, reps: ex.id === "trap-dl" ? "3–4" : "3–5" };
      if (ex.kind === "calf") return { ...base, sets: 2 };
      return base;
    case "deload": { // half the sets of the normal week, same weight
      const normal = rxFor(ex, basePhase === "block" ? "block" : "base", sessionKey);
      if (!normal) return null;
      return { ...normal, sets: Math.ceil(normal.sets / 2), rir: ex.kind === "plyo" ? null : "3+" };
    }
    case "taper":
      if (ex.kind === "acc" || ex.kind === "calf") return null;
      if (ex.kind === "plyo") return { ...base, sets: 2, reps: ex.id === "pogo" ? "8" : "3" };
      if (ex.kind === "lower") return { sets: 2, reps: "3", rir: "3+", pct: 0.8 };
      return { sets: 2, reps: "5", rir: "2–3" };
    case "race":
      if (sessionKey === "B") return null; // no Thursday session in race week
      if (ex.kind === "upper") return { sets: 2, reps: "5", rir: "3+" };
      if (ex.id === "pogo") return { sets: 2, reps: "8", rir: null };
      return null;
    case "post":
      return { ...base, sets: Math.max(2, ex.sets - 1), rir: ex.kind === "plyo" ? null : "3+" };
  }
  return base;
}
