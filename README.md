# Foundation Reset — workout app

A small installable web app (PWA) for the 4-week Foundation Reset programme.
No build step, no server code: just static files in `app/`.

- **Today**: this week's strip and today's scheduled session (Mon A · Tue Mobility · Wed B · Fri C · Sat optional mobility)
- **Plan**: all 4 weeks, with each session's exercises; Week 1 automatically uses 2 sets
- **Workout**: tick warm-ups and sets, log weight (pre-filled from last time), automatic rest timer, effort + notes
- **History**: every finished workout with sets, weights, duration, effort and notes
- **Progress**: Week 1 vs Week 4 assessments, settings, backup export/restore

Data is stored on the phone (localStorage). Use **Progress → Export backup** now and then.

## Run locally

```bash
python3 -m http.server 8765 --directory app
```

## Install on iPhone

1. Open the hosted HTTPS URL in **Safari**.
2. Share button → **Add to Home Screen**.
3. Open it from the home-screen icon. It runs full-screen and works offline at the gym.

## Changing the programme

Edit `app/program.js`. Keep exercise `id`s stable so history and "last weight" keep matching.
After deploying a change, bump `VERSION` in `app/sw.js` so phones pick up the new files.

---

# Run Strong — strength alongside Runna

A second, separate app in `run-strong/` (same no-build PWA setup, its own data on the phone).
Two heavy gym sessions a week (A: squat + bench · B: trap-bar deadlift + pull-ups, plus jumps,
calves and a couple of accessories) built around a Runna half-marathon plan.

- **Phases change by date**: ramp-in (first 2 weeks) → base "build strength" → half block "hold strength"
  (fewer sets, accessories dropped) → taper (2 × 3 at ~80%) → race week (upper body only).
  Deload every 4th week (half the sets), which you can switch on or off for any week to match Runna.
- **Runs from Runna**: each week shows your actual Runna runs (the post-race recovery plan is built in) and places
  Gym A/B around them: never on, or the day before, a key session or long run. Enter later Runna weeks in
  Plan → Edit (or "Copy these runs to the following week"); weeks without runs use a template.
- **Today**: race countdown, this week's runs and gym days, today's run and/or session with timing advice.
- **Workout**: weight, reps and "reps left in the tank" per exercise; suggests next time's weight
  (double progression in base, hold in the half block, ~80% in the taper).
- **Progress**: key-lift trends, settings for programme start / half-block start / race day, backup.

Dates, exercises and Runna weeks (`runPlan`) live in `run-strong/program.js`.

```bash
python3 -m http.server 8766 --directory run-strong
```

Bump `VERSION` in `run-strong/sw.js` after deploying changes.
