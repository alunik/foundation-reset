/* Run Strong — strength tracker alongside a Runna plan (vanilla JS, data stored on-device) */
"use strict";

const STORE_KEY = "rs-state-v1";
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const RIR_OPTS = [0, 1, 2, 3, 4];

/* ---------- state ---------- */
let state = load();
function blank() {
  return { startDate: null, blockStart: PROGRAM.defaults.blockStart, raceDate: PROGRAM.race.date,
           history: [], active: null, unit: "kg", deload: {}, weeks: {} };
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    return s ? Object.assign(blank(), s) : blank();
  } catch { return blank(); }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { toast("Couldn't save: " + e.message); }
}

/* ---------- date helpers ---------- */
const pad = (n) => String(n).padStart(2, "0");
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const today = () => isoDate(new Date());
const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return isoDate(d); };
function mondayOf(d = new Date()) {
  if (typeof d === "string") d = parseDate(d);
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return isoDate(x);
}
function fmtDate(s, opts = { weekday: "short", day: "numeric", month: "short" }) {
  return parseDate(s).toLocaleDateString(undefined, opts);
}
function fmtDuration(ms) {
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}
function fmtClock(sec) {
  sec = Math.max(0, Math.round(sec));
  return `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
}

/* ---------- misc helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const sessionDef = (key) => PROGRAM.sessions[key];
const exDef = (id) => Object.values(PROGRAM.sessions).flatMap((s) => s.exercises).find((e) => e.id === id);
const num = (v) => (v === "" || v == null ? NaN : parseFloat(String(v).replace(",", ".")));
const fmtW = (w) => (Number.isFinite(w) ? String(+w.toFixed(2)) : "");
// "BW" / "BW+5 kg" for pull-ups, "120 kg" otherwise
const loadStr = (exId, w) => { const v = num(w); if (!Number.isFinite(v)) return ""; return exId === "pullup" ? (v ? `BW+${fmtW(v)} ${state.unit}` : "BW") : `${fmtW(v)} ${state.unit}`; };
const CHECK = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CHEV = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2400);
}

/* ---------- phases ---------- */
// Works out which phase a given week (by its Monday) is in.
function phaseInfo(dateStr) {
  const mon = mondayOf(dateStr);
  const raceMon = mondayOf(state.raceDate);
  const blockMon = mondayOf(state.blockStart);
  const startMon = mondayOf(state.startDate || PROGRAM.defaults.startDate);
  let phase, n = null, autoDeload = false;
  if (dateStr > state.raceDate && mon > raceMon) phase = "post";
  else if (mon === raceMon) phase = "race";
  else if (mon === addDays(raceMon, -7)) phase = "taper";
  else if (mon >= blockMon) { n = daysBetween(blockMon, mon) / 7 + 1; phase = "block"; autoDeload = n % 4 === 0 && mon < addDays(raceMon, -14); }
  else if (mon < startMon) phase = "pre";
  else { n = daysBetween(startMon, mon) / 7 + 1; phase = n <= 2 ? "ramp" : "base"; autoDeload = n > 2 && n % 4 === 0; }
  const canDeload = phase === "base" || phase === "block";
  const override = state.deload[mon];
  const deload = canDeload && (override === undefined ? autoDeload : override);
  return { mon, phase: deload ? "deload" : phase, basePhase: phase, n, deload, canDeload };
}
const phaseText = (p) => PROGRAM.phases[p];
function phaseLabel(info) {
  const names = { ramp: "Base", base: "Base", block: "Half block", pre: "Before start", taper: "Taper", race: "Race week", post: "After race" };
  return `${names[info.basePhase]}${info.n ? ` · week ${info.n}` : ""}`;
}
function sessionRx(key, info) {
  return sessionDef(key).exercises.map((ex) => ({ ex, rx: rxFor(ex, info.phase, key, info.basePhase) })).filter((x) => x.rx);
}

/* ---------- history lookups ---------- */
function completedFor(mon, key) {
  return state.history.filter((h) => h.mon === mon && h.key === key);
}
// Most recent logged entry for an exercise; `working` skips deload/taper/race sessions.
function lastEntry(exId, working = false) {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const h = state.history[i];
    if (working && ["deload", "taper", "race"].includes(h.phase)) continue;
    const it = h.items?.[exId];
    if (it && Number.isFinite(num(it.weight))) return { ...it, w: num(it.weight), date: h.date, phase: h.phase };
  }
  return null;
}
const topOfRange = (reps) => Math.max(...(String(reps).match(/\d+/g) || [0]).map(Number).slice(0, 2));
const roundTo = (v, step) => Math.round(v / step) * step;

// Suggested weight for next time, with a short reason.
function suggest(ex, rx, phase) {
  if (!ex.load) return null;
  const last = lastEntry(ex.id, true) || lastEntry(ex.id);
  const u = state.unit;
  if (!last) {
    if (phase === "ramp" || phase === "post") return { text: "First session: start at about 70–75% of your recent working weight." };
    return { text: `Pick a weight you can do for ${rx.reps} with ${rx.rir} reps left in the tank.` };
  }
  const w = last.w;
  if (rx.pct) {
    const t = roundTo(w * rx.pct, ex.step);
    return { weight: t, text: `About ${Math.round(rx.pct * 100)}% of your working weight (${fmtW(w)} ${u}). Should feel fast.` };
  }
  if (phase === "deload" || phase === "race") return { weight: w, text: "Same weight as a normal week, just fewer sets." };
  const rir = last.rir;
  const reps = num(last.reps);
  const top = topOfRange(ex.reps);
  const hitTop = Number.isFinite(reps) ? reps >= top : null;
  if (rir == null) return { weight: w, text: `Last time: ${fmtW(w)} ${u}. Log reps left in the tank to get suggestions.` };
  if (rir === 0) return { weight: w, text: "Last time went to failure, so keep the same weight and leave more in the tank." };
  const up = (steps, why) => ({ weight: w + steps * ex.step, text: `+${fmtW(steps * ex.step)} ${u}: ${why}` });
  if (phase === "ramp" || phase === "post") {
    if (rir >= 3) return up(ex.kind === "lower" ? 2 : 1, "still ramping back up.");
    return { weight: w, text: "Hold. Get it feeling easy before adding weight." };
  }
  if (phase === "block") {
    if (rir >= 3 && hitTop !== false) return up(1, "that was easy, a small bump is fine.");
    return { weight: w, text: "Hold. This phase is about keeping strength, not adding to it." };
  }
  // base: double progression
  if (hitTop === false) return { weight: w, text: `Same weight, aim for more reps (up to ${top}).` };
  if (rir >= 2) return up(1, hitTop ? `you hit ${top} reps with ${rir}${rir === 4 ? "+" : ""} left.` : `${rir}${rir === 4 ? "+" : ""} reps left last time.`);
  return { weight: w, text: "Hold. Add weight once every set has 2 or more reps left in the tank." };
}

/* ---------- workout lifecycle ---------- */
function startWorkout(key, mon) {
  if (state.active) {
    if (state.active.key === key && state.active.mon === mon) { go("#/workout"); return; }
    if (!confirm("You have a workout in progress. Discard it and start this one?")) return;
  }
  const info = phaseInfo(mon);
  const items = {};
  for (const { ex, rx } of sessionRx(key, info)) {
    const s = suggest(ex, rx, info.phase);
    const prev = lastEntry(ex.id);
    items[ex.id] = {
      sets: Array(rx.sets).fill(false), rx: { sets: rx.sets, reps: rx.reps, rir: rx.rir },
      weight: s?.weight != null ? fmtW(s.weight) : prev ? fmtW(prev.w) : "", reps: "", rir: null,
    };
  }
  state.active = { id: uid(), key, mon, phase: info.phase, date: today(), startedAt: Date.now(), items, effort: null, notes: "" };
  save();
  go("#/workout");
}

function finishWorkout() {
  const a = state.active;
  if (!a) return;
  const { done, total } = progressOf(a);
  if (done < total && !confirm(`${total - done} set${total - done === 1 ? "" : "s"} not ticked. Finish anyway?`)) return;
  a.finishedAt = Date.now();
  state.history.push(a);
  state.active = null;
  stopRest();
  save();
  toast(`${sessionDef(a.key).short} saved 💪`);
  go(`#/history/${a.id}`);
}

function discardWorkout() {
  if (!confirm("Discard this workout? Nothing will be saved.")) return;
  state.active = null;
  stopRest();
  save();
  go("#/today");
}

function progressOf(w) {
  let done = 0, total = 0;
  for (const it of Object.values(w.items)) { total += it.sets.length; done += it.sets.filter(Boolean).length; }
  return { done, total };
}

/* ---------- rest timer ---------- */
let rest = null; // {end, total}
function startRest(seconds) {
  rest = { end: Date.now() + seconds * 1000, total: seconds };
  tickRest();
}
function stopRest() { rest = null; tickRest(); }
function tickRest() {
  const bar = $("#rest");
  if (!rest) { bar.hidden = true; return; }
  const left = (rest.end - Date.now()) / 1000;
  if (left <= 0) {
    rest = null;
    bar.hidden = true;
    toast("Rest over. Next set.");
    try { navigator.vibrate?.(200); } catch {}
    return;
  }
  bar.hidden = false;
  $("#rest-time").textContent = fmtClock(left);
  $("#rest-fill").style.width = `${(left / rest.total) * 100}%`;
}
setInterval(() => {
  tickRest();
  const el = $("#elapsed");
  if (el && state.active) el.textContent = fmtClock((Date.now() - state.active.startedAt) / 1000);
}, 500);

/* ---------- router ---------- */
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
window.addEventListener("hashchange", render);

function render() {
  const [, route = "today", ...args] = (location.hash || "#/today").split("/");
  const view = $("#view");
  let html;
  if (!state.startDate && route !== "progress") html = viewOnboarding();
  else switch (route) {
    case "program": html = viewProgram(); break;
    case "week": html = viewWeek(args[0]); break;
    case "session": html = viewSession(args[0], args[1]); break;
    case "workout": html = state.active ? viewWorkout() : viewToday(); break;
    case "history": html = args[0] ? viewHistoryDetail(args[0]) : viewHistory(); break;
    case "progress": html = viewProgress(); break;
    default: html = viewToday();
  }
  view.innerHTML = html;
  const tab = route === "session" || route === "week" ? "program" : route === "workout" ? "today" : route;
  document.querySelectorAll(".tabbar a").forEach((a) => a.classList.toggle("on", a.dataset.tab === tab));
  const resumeBtn = $("#resume");
  resumeBtn.hidden = !state.active || route === "workout";
  if (state.active) resumeBtn.querySelector("span").textContent = `Resume ${sessionDef(state.active.key).short}`;
  if (!view.dataset.keepScroll) window.scrollTo(0, 0);
}

/* ---------- views ---------- */
function phaseBanner(info, withToggle) {
  const p = phaseText(info.phase);
  let toggle = "";
  if (withToggle && info.canDeload) {
    toggle = `<button class="btn small-btn" data-action="toggle-deload" data-mon="${info.mon}">
      ${info.deload ? "Make this a normal week" : "Make this a deload week"}</button>`;
  }
  return `<div class="card banner ${info.phase === "deload" ? "deload-banner" : ""}">
    <div class="eyebrow">${esc(phaseLabel(info))}${p.effort ? ` · ${esc(p.effort)}` : ""}</div>
    <div class="banner-title">${esc(p.title)}</div>
    <p class="muted">${esc(p.text)}</p>${toggle}
  </div>`;
}

function raceCard() {
  const d = daysBetween(today(), state.raceDate);
  if (d < 0) return "";
  const txt = d === 0 ? "Race day! 🏃" : d < 14 ? `${d} day${d === 1 ? "" : "s"} to go` : `${Math.floor(d / 7)} weeks ${d % 7 ? `${d % 7} days ` : ""}to go`;
  return `<div class="race"><div><div class="race-name">${esc(PROGRAM.race.name)}</div>
    <div class="muted small">${esc(fmtDate(state.raceDate, { weekday: "short", day: "numeric", month: "long", year: "numeric" }))}</div></div>
    <div class="race-count">${esc(txt)}</div></div>`;
}

function sessionCard(key, mon, opts = {}) {
  const def = sessionDef(key);
  const info = phaseInfo(mon);
  const items = sessionRx(key, info);
  const done = completedFor(mon, key);
  const isActive = state.active && state.active.key === key && state.active.mon === mon;
  if (!items.length) {
    return `<div class="card session off-card"><div class="session-badge">${key}</div>
      <div class="session-main"><div class="session-name">${esc(def.short)}: no session</div>
      <div class="muted small">${opts.day ? `${opts.day} · ` : ""}Nothing heavy this close to the race</div></div></div>`;
  }
  const status = isActive ? `<span class="pill live">In progress</span>`
    : done.length ? `<span class="pill ok">${CHECK} Done</span>` : "";
  const lifts = items.filter((x) => x.ex.kind !== "plyo" && x.ex.kind !== "calf").map((x) => x.ex.name.replace(/ \(.*\)/, "")).join(" · ");
  return `<a class="card session" href="#/session/${key}/${mon}">
    <div class="session-badge">${key}</div>
    <div class="session-main">
      <div class="session-name">${esc(def.name)}</div>
      <div class="muted small">${opts.day ? `${esc(opts.day)} · ` : ""}${esc(lifts)}</div>
    </div>
    ${status}${CHEV}
  </a>`;
}

/* ---------- week plan: Runna runs + gym days ---------- */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon … Sun
const isHard = (r) => !!r && (r.type === "key" || r.type === "long");

// Picks two gym days (A then B): never on, or the day before, a key session or long run.
// Prefers rest days, then easy-run days (lift after the run), with 2–3 days between A and B.
function autoGym(runs) {
  const run = (i) => runs[WEEK_ORDER[i]];
  const hard = (i) => i < 7 && !!run(i) && (run(i)[0] === "key" || run(i)[0] === "long");
  const ok = (i) => !hard(i) && !hard(i + 1);
  const val = (i) => (run(i) ? 1 : 2);
  const gapScore = { 2: 0, 3: 2, 4: 1 };
  let best = null;
  for (let a = 0; a < 7; a++) for (let b = a + 2; b < 7; b++) {
    if (!ok(a) || !ok(b)) continue;
    const score = val(a) + val(b) + (gapScore[b - a] || 0);
    if (!best || score > best.score) best = { score, a, b };
  }
  return best ? { [WEEK_ORDER[best.a]]: "A", [WEEK_ORDER[best.b]]: "B" } : {};
}

// Where this week's runs come from: edited in the app > Runna plan in program.js > template.
function weekSpec(mon) {
  if (state.weeks[mon]) return { ...state.weeks[mon], src: "edited" };
  if (PROGRAM.runPlan[mon]) return { ...PROGRAM.runPlan[mon], src: "runna" };
  return { runs: PROGRAM.template.runs, src: "template" };
}
function weekPlan(mon) {
  const spec = weekSpec(mon);
  const gym = spec.gym || autoGym(spec.runs);
  const days = WEEK_ORDER.map((dow, i) => {
    const r = spec.runs[dow];
    return { date: addDays(mon, i), dow, run: r ? { type: r[0], label: r[1] || PROGRAM.runNames[r[0]] } : null, gym: gym[dow] || null };
  });
  const warnings = [];
  days.forEach((d, i) => {
    if (!d.gym) return;
    if (isHard(d.run)) warnings.push(`${DAY_FULL[d.dow]}: lifting on the same day as your ${d.run.label.toLowerCase()}.`);
    const next = days[i + 1];
    if (next && isHard(next.run)) warnings.push(`${DAY_FULL[d.dow]}: heavy legs the day before your ${next.run.label.toLowerCase()}.`);
  });
  const gyms = days.filter((d) => d.gym);
  if (gyms.length < 2 && spec.runs && Object.keys(spec.runs).length) warnings.push("Couldn't fit two gym days around these runs. Pick them yourself or accept one session this week.");
  return { mon, src: spec.src, days, gyms, warnings };
}
const runSummary = (wp) => wp.days.filter((d) => d.run).map((d) => `${DAY_NAMES[d.dow]} ${d.run.label}`).join(" · ") || "No runs";
const SRC_LABEL = { runna: "From your Runna plan", edited: "Edited by you", template: "Template: enter Runna's runs when you have them" };

function dayNote(wp, day) {
  const i = wp.days.indexOf(day);
  const next = wp.days[i + 1];
  if (day.gym && day.run) return "Run first, lift later: at least 3 h apart, ideally 6 h or more.";
  if (day.gym) return next?.run ? `Gym day. Tomorrow is an ${next.run.type === "easy" ? "easy run, so some soreness is fine" : next.run.label.toLowerCase()}.` : "Gym day. No running today.";
  if (day.run?.type === "key") return "Quality day. Your legs should be fresh.";
  if (day.run?.type === "long") return "Long run day. Fuel and keep it conversational.";
  if (day.run) return "Easy run. Keep it conversational.";
  return "Rest day.";
}

function weekStrip(wp) {
  let cells = "";
  for (const d of wp.days) {
    const did = state.history.filter((h) => h.date === d.date);
    const cls = [d.date === today() ? "now" : "", did.length ? "did" : "", !d.gym && !d.run ? "off" : ""].join(" ");
    const lbl = did.length ? CHECK : d.gym ? d.gym : d.run ? "•" : "–";
    const runTag = `<div class="dr">${d.run ? d.run.type : "&nbsp;"}</div>`;
    cells += `<div class="day ${cls}"><div class="dn">${DAY_NAMES[d.dow][0]}</div><div class="dd">${lbl}</div>${runTag}</div>`;
  }
  return `<div class="strip">${cells}</div>`;
}

function warningsCard(wp) {
  if (!wp.warnings.length) return "";
  return `<div class="note warn">${wp.warnings.map((w) => `<div>⚠️ ${esc(w)}</div>`).join("")}</div>`;
}

function viewToday() {
  const t = today();
  const info = phaseInfo(t);
  const wp = weekPlan(info.mon);
  const day = wp.days.find((d) => d.date === t);
  const dow = day.dow;
  let out = `<header class="page-head">
    <div class="eyebrow">${esc(DAY_FULL[dow])}, ${esc(fmtDate(t, { day: "numeric", month: "long" }))}</div>
    <h1>Today</h1>
  </header>`;
  out += raceCard();
  out += weekStrip(wp);
  out += `<div class="strip-foot"><span class="muted small">${esc(SRC_LABEL[wp.src])}</span><a class="accent small" href="#/week/${wp.mon}">Edit week ›</a></div>`;

  out += `<h2 class="section">Today</h2>`;
  if (day.run) out += `<div class="card run-card"><div class="session-badge run">R</div><div class="session-main">
      <div class="session-name">${esc(day.run.label)}</div><div class="muted small">${esc(PROGRAM.runNames[day.run.type])} · Runna</div></div></div>`;
  if (day.gym) out += sessionCard(day.gym, info.mon);
  if (!day.gym && !day.run) out += `<div class="card rest-card"><div class="session-name">Rest</div></div>`;
  out += `<p class="muted small day-note">${esc(dayNote(wp, day))}</p>`;
  out += warningsCard(wp);

  out += phaseBanner(info, true);

  const others = wp.gyms.filter((d) => d.date !== t);
  if (others.length) {
    out += `<h2 class="section">This week</h2>`;
    for (const d of others) out += sessionCard(d.gym, info.mon, { day: DAY_NAMES[d.dow] });
  }
  return out;
}

function viewWeek(mon) {
  if (!/^\d{4}-\d\d-\d\d$/.test(mon || "")) return viewProgram();
  mon = mondayOf(mon);
  const wp = weekPlan(mon);
  const types = [["", "Rest"], ["easy", "Easy run"], ["key", "Key session"], ["long", "Long run"]];
  let out = `<a class="back" href="#/program">‹ Plan</a>
  <header class="page-head"><div class="eyebrow">Week of ${esc(fmtDate(mon, { day: "numeric", month: "long" }))}</div><h1>Runs & gym days</h1></header>
  <p class="muted small">Copy this week's runs from Runna. Gym days are picked for you: never on, or the day before, a key session or long run. You can also set them yourself.</p>
  <div class="card list week-edit">`;
  for (const d of wp.days) {
    out += `<div class="row"><div class="wk-day"><b>${DAY_NAMES[d.dow]}</b><div class="muted small">${esc(fmtDate(d.date, { day: "numeric", month: "short" }))}</div></div>
      <div class="wk-run"><select data-action="wk-run" data-mon="${mon}" data-dow="${d.dow}">${types.map(([v, l]) => `<option value="${v}" ${(d.run?.type || "") === v ? "selected" : ""}>${l}</option>`).join("")}</select>
        ${d.run ? `<input data-action="wk-label" data-mon="${mon}" data-dow="${d.dow}" value="${esc(d.run.label)}" placeholder="e.g. 6km easy">` : ""}</div>
      <select class="wk-gym" data-action="wk-gym" data-mon="${mon}" data-dow="${d.dow}">${[["", "–"], ["A", "Gym A"], ["B", "Gym B"]].map(([v, l]) => `<option value="${v}" ${(d.gym || "") === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>`;
  }
  out += `</div>${warningsCard(wp)}
  <p class="muted small">${esc(SRC_LABEL[wp.src])}</p>
  <button class="btn block" data-action="wk-auto" data-mon="${mon}">Pick gym days for me</button>
  ${wp.src === "edited" ? `<button class="btn ghost block" data-action="wk-reset" data-mon="${mon}">Undo my changes for this week</button>` : ""}
  <button class="btn ghost block" data-action="wk-copy" data-mon="${mon}">Copy these runs to the following week</button>`;
  return out;
}

// Make an editable copy of a week before changing it.
function editWeek(mon) {
  if (!state.weeks[mon]) {
    const spec = weekSpec(mon);
    state.weeks[mon] = { runs: JSON.parse(JSON.stringify(spec.runs)), gym: { ...(spec.gym || autoGym(spec.runs)) }, gymManual: !!spec.gym };
  }
  return state.weeks[mon];
}

function viewOnboarding() {
  return `<header class="page-head"><div class="eyebrow">Welcome</div><h1>${esc(PROGRAM.name)}</h1></header>
  <div class="card">
    <p class="muted">${esc(PROGRAM.subtitle)}. Two gym sessions a week around your Runna plan, changing automatically from base to half block, taper and race week.</p>
    <label class="field"><span>Strength programme starts (Monday)</span>
      <input type="date" id="start-input" value="${mondayOf()}"></label>
    <label class="field"><span>Runna half-marathon block starts</span>
      <input type="date" id="block-input" value="${esc(state.blockStart)}"></label>
    <label class="field"><span>Race day: ${esc(PROGRAM.race.name)}</span>
      <input type="date" id="race-input" value="${esc(state.raceDate)}"></label>
    <p class="muted small">You can change these later in Progress → Settings.</p>
    <button class="btn primary block" data-action="set-start">Let's go</button>
  </div>`;
}

function viewProgram() {
  const curMon = mondayOf();
  const startMon = mondayOf(state.startDate);
  const raceMon = mondayOf(state.raceDate);
  let out = `<header class="page-head"><div class="eyebrow">${esc(PROGRAM.subtitle)}</div><h1>Plan</h1></header>`;
  let lastGroup = "";
  for (let mon = startMon; mon <= raceMon; mon = addDays(mon, 7)) {
    const info = phaseInfo(mon);
    const group = { ramp: "Base: build strength", base: "Base: build strength", block: "Half block: hold strength", taper: "Taper & race", race: "Taper & race" }[info.basePhase];
    if (group !== lastGroup) {
      const range = info.basePhase === "block" ? `from ${fmtDate(state.blockStart, { day: "numeric", month: "short" })}` : "";
      out += `<h2 class="section">${esc(group)} <span class="sec-sub">${esc(range)}</span></h2>`;
      lastGroup = group;
    }
    const p = phaseText(info.phase);
    const wp = weekPlan(mon);
    const doneCount = wp.gyms.filter((d) => completedFor(mon, d.gym).length).length;
    const planned = wp.gyms.filter((d) => sessionRx(d.gym, info).length).length;
    const isNow = mon === curMon;
    out += `<details class="week ${mon < curMon ? "past" : ""}" ${isNow ? "open" : ""}>
      <summary><div><div class="week-title">${esc(fmtDate(mon, { day: "numeric", month: "short" }))}${isNow ? ` <span class="pill live">Now</span>` : ""}${info.deload ? ` <span class="pill">Deload</span>` : ""}</div>
        <div class="muted small">${esc(phaseLabel(info))} · ${esc(p.title)}</div></div>
        <div class="ring" style="--p:${planned ? (doneCount / planned) * 100 : 0}">${doneCount}/${planned}</div></summary>
      <p class="muted small week-text">${esc(p.text)}</p>
      <a class="week-runs" href="#/week/${mon}"><div><div class="small"><b>Runs:</b> ${esc(runSummary(wp))}</div>
        <div class="muted small">${esc(SRC_LABEL[wp.src])}</div></div><span class="accent small">Edit ›</span></a>
      ${warningsCard(wp)}
      ${wp.gyms.map((d) => sessionCard(d.gym, mon, { day: DAY_NAMES[d.dow] })).join("")}
      ${info.canDeload ? `<button class="btn ghost small-btn" data-action="toggle-deload" data-mon="${mon}">${info.deload ? "Make this a normal week" : "Make this a deload week"}</button>` : ""}
    </details>`;
  }
  out += `<div class="card tips"><div class="eyebrow">Always</div><ul>${PROGRAM.generalTips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>`;
  return out;
}

function rxLine(rx) {
  return `${rx.sets} × ${esc(rx.reps)}`;
}
function rirLine(rx) {
  return rx.rir ? `${esc(rx.rir)} in the tank` : "";
}

function viewSession(key, mon) {
  const def = sessionDef(key);
  if (!def || !/^\d{4}-\d\d-\d\d$/.test(mon || "")) return viewProgram();
  const info = phaseInfo(mon);
  const items = sessionRx(key, info);
  const skipped = def.exercises.filter((ex) => !items.some((x) => x.ex.id === ex.id));
  const done = completedFor(mon, key);
  const isActive = state.active && state.active.key === key && state.active.mon === mon;
  let out = `<a class="back" href="#/program">‹ Plan</a>
  <header class="page-head"><div class="eyebrow">${esc(def.short)} · week of ${esc(fmtDate(mon, { day: "numeric", month: "short" }))}</div><h1>${esc(def.name)}</h1></header>`;
  out += phaseBanner(info, false);
  if (!items.length) return out + `<div class="card empty"><p>No ${esc(def.short)} this week.</p></div>`;
  out += `<h2 class="section">Warm-up</h2><div class="card"><p>${esc(def.warmup)}</p></div>`;
  out += `<h2 class="section">Workout · ${esc(def.duration)}</h2><div class="card list">${items.map(({ ex, rx }) => {
    const s = suggest(ex, rx, info.phase);
    return `<div class="row"><div><div>${esc(ex.name)}</div>
      ${rx.rir ? `<div class="muted small">${rirLine(rx)} · rest ${fmtClock(ex.rest)}</div>` : `<div class="muted small">rest ${fmtClock(ex.rest)}</div>`}
      ${s?.weight != null ? `<div class="small accent">Suggested: ${fmtW(s.weight)} ${esc(state.unit)}</div>` : ""}</div>
      <div class="rx">${rxLine(rx)}</div></div>`;
  }).join("")}</div>`;
  if (skipped.length) out += `<p class="muted small">Dropped this week: ${skipped.map((e) => esc(e.name)).join(", ")}</p>`;
  if (done.length) out += `<p class="muted small center">Completed ${done.map((h) => fmtDate(h.date)).join(", ")}</p>`;
  out += `<div class="sticky-cta"><button class="btn primary block" data-action="start" data-key="${key}" data-mon="${mon}">
    ${isActive ? "Resume workout" : done.length ? "Do it again" : "Start workout"}</button></div>`;
  return out;
}

function viewWorkout() {
  const a = state.active;
  const def = sessionDef(a.key);
  const p = phaseText(a.phase);
  const { done, total } = progressOf(a);
  let out = `<header class="page-head workout-head">
    <div class="eyebrow">${esc(p.title)} · <span id="elapsed">${fmtClock((Date.now() - a.startedAt) / 1000)}</span></div>
    <h1>${esc(def.name)}</h1>
    <div class="progress"><div style="width:${total ? (done / total) * 100 : 0}%"></div></div>
    <div class="muted small">${done} of ${total} sets · ${esc(def.warmup)}</div>
  </header>`;

  for (const ex of def.exercises) {
    const it = a.items[ex.id];
    if (!it) continue;
    const all = it.sets.every(Boolean);
    const s = suggest(ex, it.rx, a.phase);
    const last = ex.load ? lastEntry(ex.id) : null;
    out += `<div class="card ex ${all ? "complete" : ""}" id="ex-${ex.id}">
      <div class="ex-head"><div><div class="ex-name">${esc(ex.name)}</div>
        <div class="muted small">${esc(ex.focus || "")}</div></div>
        <div class="rx-wrap"><div class="rx">${rxLine(it.rx)}</div>${it.rx.rir ? `<div class="muted small">${rirLine(it.rx)}</div>` : ""}</div></div>
      ${s ? `<div class="sugg">${esc(s.text)}</div>` : ""}
      ${ex.load ? `<div class="load">
        <label>${ex.id === "pullup" ? "Added" : "Weight"} <input inputmode="decimal" data-action="weight" data-id="${ex.id}" value="${esc(it.weight)}" placeholder="–"> ${esc(state.unit)}</label>
        <label>Reps <input inputmode="numeric" data-action="reps" data-id="${ex.id}" value="${esc(it.reps)}" placeholder="${topOfRange(it.rx.reps)}"></label>
        ${last ? `<span class="muted small">Last: ${fmtW(last.w)}${last.reps ? ` × ${esc(last.reps)}` : ""}${last.rir != null ? ` · ${last.rir}${last.rir === 4 ? "+" : ""} left` : ""}</span>` : ""}
      </div>` : ""}
      <div class="sets">${it.sets.map((on, i) => `<button class="set ${on ? "on" : ""}" data-action="set" data-id="${ex.id}" data-i="${i}" aria-label="Set ${i + 1}">
        ${on ? CHECK : `<b>${i + 1}</b>`}</button>`).join("")}</div>
      ${ex.load ? `<div class="rir"><span class="muted small">Reps left in the tank on your last set</span>
        <div class="chips">${RIR_OPTS.map((v) => `<button class="chip ${it.rir === v ? "on" : ""}" data-action="rir" data-id="${ex.id}" data-v="${v}">${v}${v === 4 ? "+" : ""}</button>`).join("")}</div></div>` : ""}
    </div>`;
  }

  out += `<div class="card">
    <h2>How did it feel?</h2>
    <div class="effort">${[...Array(10)].map((_, i) => `<button class="${a.effort === i + 1 ? "on" : ""}" data-action="effort" data-v="${i + 1}">${i + 1}</button>`).join("")}</div>
    <textarea data-action="notes" rows="3" placeholder="Notes (optional): legs before the run, niggles, anything to remember?">${esc(a.notes)}</textarea>
  </div>
  <button class="btn primary block big" data-action="finish">Finish workout</button>
  <button class="btn ghost block danger" data-action="discard">Discard</button>`;
  return out;
}

function viewHistory() {
  const items = [...state.history].sort((a, b) => b.finishedAt - a.finishedAt);
  const thisWeek = items.filter((h) => h.date >= mondayOf()).length;
  const last28 = items.filter((h) => h.date >= addDays(today(), -27)).length;
  let out = `<header class="page-head"><div class="eyebrow">Your training log</div><h1>History</h1></header>
  <div class="stats">
    <div class="stat"><b>${items.length}</b><span>sessions</span></div>
    <div class="stat"><b>${last28}</b><span>last 4 weeks</span></div>
    <div class="stat"><b>${thisWeek}</b><span>this week</span></div>
  </div>`;
  if (!items.length) return out + `<div class="card empty"><p>No workouts yet.</p><p class="muted">Finished workouts will appear here.</p></div>`;
  let lastMonth = "";
  for (const h of items) {
    const def = sessionDef(h.key);
    const month = fmtDate(h.date, { month: "long", year: "numeric" });
    if (month !== lastMonth) { out += `<h2 class="section">${esc(month)}</h2>`; lastMonth = month; }
    const main = def.exercises.find((e) => e.kind === "lower");
    const mi = h.items[main.id];
    out += `<a class="card session" href="#/history/${h.id}">
      <div class="session-badge">${h.key}</div>
      <div class="session-main"><div class="session-name">${esc(def.name)}</div>
        <div class="muted small">${esc(fmtDate(h.date))} · ${esc(phaseText(h.phase).title)} · ${fmtDuration(h.finishedAt - h.startedAt)}${mi?.weight ? ` · ${esc(main.name.split(" ").slice(-1)[0])} ${esc(mi.weight)} ${esc(state.unit)}` : ""}</div></div>${CHEV}</a>`;
  }
  return out;
}

function viewHistoryDetail(id) {
  const h = state.history.find((x) => x.id === id);
  if (!h) return viewHistory();
  const def = sessionDef(h.key);
  const { done, total } = progressOf(h);
  let out = `<a class="back" href="#/history">‹ History</a>
  <header class="page-head"><div class="eyebrow">${esc(fmtDate(h.date, { weekday: "long", day: "numeric", month: "long" }))} · ${esc(phaseText(h.phase).title)}</div>
  <h1>${esc(def.name)}</h1></header>
  <div class="stats">
    <div class="stat"><b>${fmtDuration(h.finishedAt - h.startedAt)}</b><span>duration</span></div>
    <div class="stat"><b>${done}/${total}</b><span>sets</span></div>
    <div class="stat"><b>${h.effort ?? "–"}</b><span>effort</span></div>
  </div>
  <div class="card list">${def.exercises.filter((ex) => h.items[ex.id]).map((ex) => {
    const it = h.items[ex.id];
    const n = it.sets.filter(Boolean).length;
    const detail = it.weight ? `${esc(loadStr(ex.id, it.weight))}${it.reps ? ` × ${esc(it.reps)}` : ""}` : n === it.sets.length ? CHECK : "";
    return `<div class="row"><div><div>${esc(ex.name)}</div><div class="muted small">${n}/${it.sets.length} sets × ${esc(it.rx.reps)}${it.rir != null ? ` · ${it.rir}${it.rir === 4 ? "+" : ""} left` : ""}</div></div>
      <div class="rx">${detail}</div></div>`;
  }).join("")}</div>`;
  if (h.notes) out += `<div class="card"><div class="eyebrow">Notes</div><p class="pre">${esc(h.notes)}</p></div>`;
  out += `<button class="btn ghost block danger" data-action="delete-history" data-id="${h.id}">Delete this workout</button>`;
  return out;
}

function sparkline(points) {
  if (points.length < 2) return "";
  const W = 120, H = 36, ys = points.map((p) => p.w);
  const lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1;
  const d = points.map((p, i) => `${i ? "L" : "M"}${((i / (points.length - 1)) * W).toFixed(1)},${(H - 3 - ((p.w - lo) / span) * (H - 6)).toFixed(1)}`).join("");
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><path d="${d}"/></svg>`;
}

function viewProgress() {
  let out = `<header class="page-head"><div class="eyebrow">Getting stronger?</div><h1>Progress</h1></header>`;
  if (state.startDate) {
    out += `<div class="card list">`;
    for (const id of PROGRAM.keyLifts) {
      const ex = exDef(id);
      const pts = state.history.map((h) => ({ w: num(h.items[id]?.weight), date: h.date, phase: h.phase }))
        .filter((p) => Number.isFinite(p.w) && !["deload", "taper", "race"].includes(p.phase));
      const last = pts[pts.length - 1];
      const best = pts.length ? Math.max(...pts.map((p) => p.w)) : null;
      const first = pts[0];
      const delta = last && first ? last.w - first.w : 0;
      out += `<div class="row lift"><div><div>${esc(ex.name)}</div>
        <div class="muted small">${last ? `Now ${esc(loadStr(id, last.w))} · best ${esc(loadStr(id, best))}${delta ? ` · ${delta > 0 ? "+" : ""}${fmtW(delta)} since ${esc(fmtDate(first.date, { day: "numeric", month: "short" }))}` : ""}` : "No sessions logged yet"}</div></div>
        ${sparkline(pts)}</div>`;
    }
    out += `</div><p class="muted small">Working sets only: deload, taper and race-week sessions are left out.</p>`;
  }
  out += `<h2 class="section">Settings</h2>
  <div class="card">
    <label class="field"><span>Strength programme start</span>
      <input type="date" data-action="start-date" value="${esc(state.startDate || mondayOf())}"></label>
    <label class="field"><span>Runna half-marathon block starts</span>
      <input type="date" data-action="block-date" value="${esc(state.blockStart)}"></label>
    <label class="field"><span>Race day</span>
      <input type="date" data-action="race-date" value="${esc(state.raceDate)}"></label>
    <label class="field"><span>Weight unit</span>
      <select data-action="unit"><option ${state.unit === "kg" ? "selected" : ""}>kg</option><option ${state.unit === "lb" ? "selected" : ""}>lb</option></select></label>
  </div>
  <div class="card">
    <h2>Backup</h2>
    <p class="muted small">Your data lives only on this phone. Export a backup now and then (save it to Files or send it to yourself).</p>
    <button class="btn block" data-action="export">Export backup</button>
    <label class="btn block">Restore from backup<input type="file" accept=".json,application/json" data-action="import" hidden></label>
    <button class="btn ghost block danger" data-action="reset">Erase all data</button>
  </div>
  <p class="muted small center">${esc(PROGRAM.name)} · ${state.history.length} workouts stored</p>`;
  return out;
}

/* ---------- events ---------- */
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const act = el.dataset.action;
  const a = state.active;
  switch (act) {
    case "set-start": {
      state.startDate = mondayOf($("#start-input").value || today());
      if ($("#block-input").value) state.blockStart = $("#block-input").value;
      if ($("#race-input").value) state.raceDate = $("#race-input").value;
      save(); go("#/today"); break;
    }
    case "start": startWorkout(el.dataset.key, el.dataset.mon); break;
    case "toggle-deload": {
      const info = phaseInfo(el.dataset.mon);
      state.deload[el.dataset.mon] = !info.deload;
      save(); keepScroll();
      toast(info.deload ? "Back to a normal week" : "Deload week: half the sets");
      break;
    }
    case "set": {
      const it = a.items[el.dataset.id];
      const i = Number(el.dataset.i);
      it.sets[i] = !it.sets[i];
      save();
      if (it.sets[i]) {
        const allDone = Object.values(a.items).every((x) => x.sets.every(Boolean));
        if (allDone) { stopRest(); toast("All sets done. Finish when ready!"); }
        else startRest(exDef(el.dataset.id).rest);
      }
      keepScroll();
      break;
    }
    case "rir": {
      const it = a.items[el.dataset.id];
      const v = Number(el.dataset.v);
      it.rir = it.rir === v ? null : v;
      save(); keepScroll(); break;
    }
    case "effort": a.effort = Number(el.dataset.v); save(); keepScroll(); break;
    case "finish": finishWorkout(); break;
    case "discard": discardWorkout(); break;
    case "rest-add": if (rest) { rest.end += 15000; rest.total += 15; tickRest(); } break;
    case "rest-skip": stopRest(); break;
    case "delete-history":
      if (confirm("Delete this workout from history?")) {
        state.history = state.history.filter((h) => h.id !== el.dataset.id); save(); go("#/history");
      }
      break;
    case "wk-auto": {
      const w = editWeek(el.dataset.mon);
      w.gym = autoGym(w.runs); w.gymManual = false;
      save(); keepScroll(); toast("Gym days picked around your runs"); break;
    }
    case "wk-reset":
      delete state.weeks[el.dataset.mon]; save(); keepScroll(); toast("Back to the original week"); break;
    case "wk-copy": {
      const next = addDays(el.dataset.mon, 7);
      const runs = JSON.parse(JSON.stringify(weekSpec(el.dataset.mon).runs));
      state.weeks[next] = { runs, gym: autoGym(runs), gymManual: false };
      save(); go(`#/week/${next}`); toast("Runs copied. Adjust anything that's different."); break;
    }
    case "export": exportData(); break;
    case "reset":
      if (confirm("Erase ALL workouts and settings? This can't be undone.") && confirm("Really erase everything?")) {
        state = blank(); save(); go("#/today");
      }
      break;
  }
});

document.addEventListener("input", (e) => {
  const el = e.target;
  const act = el.dataset.action;
  if (act === "weight") { state.active.items[el.dataset.id].weight = el.value.trim(); save(); }
  else if (act === "reps") { state.active.items[el.dataset.id].reps = el.value.trim(); save(); }
  else if (act === "notes") { state.active.notes = el.value; save(); }
  else if (act === "wk-label") {
    const w = editWeek(el.dataset.mon);
    const r = w.runs[el.dataset.dow];
    if (r) { r[1] = el.value.trim() || PROGRAM.runNames[r[0]]; save(); }
  }
});

document.addEventListener("change", (e) => {
  const el = e.target;
  const act = el.dataset.action;
  if (act === "start-date" && el.value) { state.startDate = mondayOf(el.value); save(); toast("Start date updated"); }
  else if (act === "block-date" && el.value) { state.blockStart = el.value; save(); toast("Half block start updated"); }
  else if (act === "race-date" && el.value) { state.raceDate = el.value; save(); toast("Race day updated"); }
  else if (act === "unit") { state.unit = el.value; save(); }
  else if (act === "wk-run") {
    const w = editWeek(el.dataset.mon);
    if (el.value) w.runs[el.dataset.dow] = [el.value, PROGRAM.runNames[el.value]];
    else delete w.runs[el.dataset.dow];
    if (!w.gymManual) w.gym = autoGym(w.runs);
    save(); keepScroll();
  } else if (act === "wk-label") { save(); keepScroll(); }
  else if (act === "wk-gym") {
    const w = editWeek(el.dataset.mon);
    // one A and one B per week: setting a session moves it off any other day
    if (el.value) for (const k of Object.keys(w.gym)) if (w.gym[k] === el.value) delete w.gym[k];
    if (el.value) w.gym[el.dataset.dow] = el.value; else delete w.gym[el.dataset.dow];
    w.gymManual = true;
    save(); keepScroll();
  }
  else if (act === "import" && el.files[0]) importData(el.files[0]);
});

function keepScroll() {
  const y = window.scrollY;
  $("#view").dataset.keepScroll = "1";
  render();
  delete $("#view").dataset.keepScroll;
  window.scrollTo(0, y);
}

/* ---------- backup ---------- */
async function exportData() {
  const json = JSON.stringify({ app: "run-strong", version: 1, exportedAt: new Date().toISOString(), state }, null, 2);
  const name = `run-strong-backup-${today()}.json`;
  const file = new File([json], name, { type: "application/json" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Workout backup" }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  const url = URL.createObjectURL(file);
  const link = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function importData(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (data.app && data.app !== "run-strong") throw new Error("that backup is from a different app");
      const s = data.state || data;
      if (!Array.isArray(s.history)) throw new Error("not a backup file");
      if (!confirm(`Replace current data with this backup (${s.history.length} workouts)?`)) return;
      state = Object.assign(blank(), s);
      save(); toast("Backup restored"); go("#/today");
    } catch (e) { toast("Couldn't read backup: " + e.message); }
  };
  r.readAsText(file);
}

/* ---------- boot ---------- */
render();
navigator.storage?.persist?.().catch(() => {});
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
