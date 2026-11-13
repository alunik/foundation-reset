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
