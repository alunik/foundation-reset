/* Foundation Reset — workout tracker (vanilla JS, data stored on-device) */
"use strict";

const STORE_KEY = "fr-state-v1";
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PROGRAM_ORDER = [ // [weekday, sessionKey] — order in which sessions appear in the plan
  [1, "A"], [2, "M"], [3, "B"], [5, "C"], [6, "M"],
];

/* ---------- state ---------- */
let state = load();
function blank() {
  return { startDate: null, history: [], active: null, assessments: {}, unit: "kg" };
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
function mondayOf(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return isoDate(x);
}
function weekFor(dateStr) {
  if (!state.startDate) return 1;
  const diff = daysBetween(state.startDate, dateStr);
  return Math.floor(diff / 7) + 1; // may be <1 or >4
}
const clampWeek = (w) => Math.min(PROGRAM.weeks, Math.max(1, w));
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
const CHECK = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CHEV = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2200);
}

function completedFor(week, key) {
  return state.history.filter((h) => h.week === week && h.key === key);
}
function lastLoad(exId) {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const it = state.history[i].items?.[exId];
    if (it && it.weight) return { weight: it.weight, date: state.history[i].date };
  }
  return null;
}

/* ---------- workout lifecycle ---------- */
function startWorkout(key, week) {
  if (state.active) {
    if (state.active.key === key && state.active.week === week) { go("#/workout"); return; }
    if (!confirm("You have a workout in progress. Discard it and start this one?")) return;
  }
  const def = sessionDef(key);
  const items = {};
  for (const ex of def.exercises) {
    const prev = lastLoad(ex.id);
    items[ex.id] = { sets: Array(setsFor(ex, week)).fill(false), weight: prev ? prev.weight : "" };
  }
  state.active = {
    id: uid(), key, week, date: today(), startedAt: Date.now(),
    warmup: Object.fromEntries(def.warmup.map((w) => [w.id, false])),
    items, effort: null, notes: "",
  };
  save();
  go("#/workout");
}

function finishWorkout() {
  const a = state.active;
  if (!a) return;
  const def = sessionDef(a.key);
  const { done, total } = progressOf(a);
  if (done < total && !confirm(`${total - done} set${total - done === 1 ? "" : "s"} not ticked. Finish anyway?`)) return;
  a.finishedAt = Date.now();
  state.history.push(a);
  state.active = null;
  stopRest();
  save();
  toast(`${def.short} saved 🎉`);
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
    toast("Rest over — next set 💪");
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
  switch (route) {
    case "program": html = viewProgram(); break;
    case "session": html = viewSession(args[0], Number(args[1])); break;
    case "workout": html = state.active ? viewWorkout() : viewToday(); break;
    case "history": html = args[0] ? viewHistoryDetail(args[0]) : viewHistory(); break;
    case "progress": html = viewProgress(); break;
    default: html = viewToday();
  }
  view.innerHTML = html;
  const tab = route === "session" ? "program" : route === "workout" ? "today" : route;
  document.querySelectorAll(".tabbar a").forEach((a) => a.classList.toggle("on", a.dataset.tab === tab));
  const resumeBtn = $("#resume");
  resumeBtn.hidden = !state.active || route === "workout";
  if (state.active) resumeBtn.querySelector("span").textContent = `Resume ${sessionDef(state.active.key).short}`;
  if (!view.dataset.keepScroll) window.scrollTo(0, 0);
}

/* ---------- views ---------- */
function weekBanner(week) {
  const g = PROGRAM.weekGuidance[week];
  return `<div class="card banner">
    <div class="eyebrow">Week ${week} of ${PROGRAM.weeks} · Effort ${esc(g.effort)}</div>
    <div class="banner-title">${esc(g.title)}</div>
    <p class="muted">${esc(g.text)}</p>
  </div>`;
}

function sessionCard(key, week, opts = {}) {
  const def = sessionDef(key);
  const done = completedFor(week, key);
  const isActive = state.active && state.active.key === key && state.active.week === week;
  const status = isActive ? `<span class="pill live">In progress</span>`
    : done.length ? `<span class="pill ok">${CHECK} Done${done.length > 1 ? ` ×${done.length}` : ""}</span>` : "";
  return `<a class="card session ${def.mobility ? "mob" : ""}" href="#/session/${key}/${week}">
    <div class="session-badge">${def.mobility ? "M" : key}</div>
    <div class="session-main">
      <div class="session-name">${esc(opts.label || def.name)}</div>
      <div class="muted small">${esc(def.short)} · ${esc(def.duration)}${opts.day ? ` · ${opts.day}` : ""}</div>
    </div>
    ${status}${CHEV}
  </a>`;
}

function weekStrip(week) {
  if (!state.startDate) return "";
  const start = parseDate(state.startDate);
  start.setDate(start.getDate() + (week - 1) * 7);
  let cells = "";
  for (let i = 0; i < 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const ds = isoDate(d);
    const did = state.history.filter((h) => h.date === ds);
    const sched = PROGRAM.schedule[d.getDay()];
    const cls = [ds === today() ? "now" : "", did.length ? "did" : "", sched.key === "REST" ? "off" : ""].join(" ");
    const lbl = did.length ? did.map((h) => (h.key === "M" ? "M" : h.key)).join("") : sched.key === "REST" ? "–" : sched.key;
    cells += `<div class="day ${cls}"><div class="dn">${DAY_NAMES[d.getDay()][0]}</div><div class="dd">${did.length ? CHECK : esc(lbl)}</div></div>`;
  }
  return `<div class="strip">${cells}</div>`;
}

function viewToday() {
  if (!state.startDate) return viewOnboarding();
  const t = today();
  const rawWeek = weekFor(t);
  const week = clampWeek(rawWeek);
  const dow = new Date().getDay();
  const sched = PROGRAM.schedule[dow];
  let out = `<header class="page-head">
    <div class="eyebrow">${esc(DAY_FULL[dow])}, ${esc(fmtDate(t, { day: "numeric", month: "long" }))}</div>
    <h1>Today</h1>
  </header>`;

  if (rawWeek < 1) {
    out += `<div class="card"><p>Your programme starts on <b>${esc(fmtDate(state.startDate))}</b>. You can preview the workouts in the Plan tab.</p></div>`;
  } else if (rawWeek > PROGRAM.weeks) {
    out += `<div class="card banner done-banner"><div class="banner-title">Programme complete 🎉</div>
      <p class="muted">You've finished all ${PROGRAM.weeks} weeks. Log your Week 4 assessments in Progress, or restart the programme from Progress → Settings. You can still do any session below (logged as week 4).</p></div>`;
  } else {
    out += weekStrip(week);
  }

  out += `<h2 class="section">Today's session</h2>`;
  if (sched.key === "REST") {
    out += `<div class="card rest-card"><div class="session-name">${esc(sched.label)}</div><p class="muted">${esc(sched.note)}</p></div>`;
  } else {
    out += sessionCard(sched.key, week, { label: sched.optional ? sched.label : null });
  }

  if (rawWeek >= 1 && rawWeek <= PROGRAM.weeks) out += weekBanner(week);

  out += `<h2 class="section">Do a different session</h2>`;
  for (const k of ["A", "B", "C", "M"]) if (k !== sched.key) out += sessionCard(k, week);
  return out;
}

function viewOnboarding() {
  return `<header class="page-head"><div class="eyebrow">Welcome</div><h1>${esc(PROGRAM.name)}</h1></header>
  <div class="card">
    <p class="muted">${esc(PROGRAM.subtitle)}</p>
    <p>4 weeks · 3 gym days a week · plus short mobility sessions.</p>
    <label class="field"><span>When does week 1 start?</span>
      <input type="date" id="start-input" value="${mondayOf()}"></label>
    <p class="muted small">Pick a Monday for the schedule to line up (Mon A · Tue Mobility · Wed B · Fri C).</p>
    <button class="btn primary block" data-action="set-start">Let's go</button>
  </div>`;
}

function viewProgram() {
  const cur = state.startDate ? clampWeek(weekFor(today())) : 1;
  let out = `<header class="page-head"><div class="eyebrow">${esc(PROGRAM.subtitle)}</div><h1>Plan</h1></header>`;
  for (let w = 1; w <= PROGRAM.weeks; w++) {
    const g = PROGRAM.weekGuidance[w];
    const keys = PROGRAM_ORDER;
    const doneCount = ["A", "B", "C"].filter((k) => completedFor(w, k).length).length;
    out += `<details class="week" ${w === cur ? "open" : ""}>
      <summary><div><div class="week-title">Week ${w}${w === cur && state.startDate ? ` <span class="pill live">Now</span>` : ""}</div>
        <div class="muted small">${esc(g.title)} · effort ${esc(g.effort)}</div></div>
        <div class="ring" style="--p:${(doneCount / 3) * 100}">${doneCount}/3</div></summary>
      <p class="muted small week-text">${esc(g.text)}</p>
      ${keys.map(([dow, k]) => sessionCard(k, w, { day: DAY_NAMES[dow], label: dow === 6 ? "Optional mobility" : null })).join("")}
    </details>`;
  }
  out += `<div class="card tips"><div class="eyebrow">Always</div><ul>${PROGRAM.generalTips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>`;
  return out;
}

function viewSession(key, week) {
  const def = sessionDef(key);
  if (!def) return viewProgram();
  week = clampWeek(week || 1);
  const done = completedFor(week, key);
  const isActive = state.active && state.active.key === key && state.active.week === week;
  let out = `<a class="back" href="#/program">‹ Plan</a>
  <header class="page-head"><div class="eyebrow">${esc(def.short)} · Week ${week} · ${esc(def.duration)}</div><h1>${esc(def.name)}</h1></header>
  <p class="goal">${esc(def.goal)}</p>`;
  if (week === 1 && !def.mobility) out += `<div class="note">Week 1: two working sets per exercise, light weights.</div>`;
  if (def.warmup.length) {
    out += `<h2 class="section">Warm-up · 8 min</h2><div class="card list">${def.warmup.map((w) =>
      `<div class="row"><div>${esc(w.name)}</div><div class="muted">${esc(w.rx)}</div></div>`).join("")}</div>`;
  }
  out += `<h2 class="section">${def.mobility ? "Exercises" : "Main workout"}</h2><div class="card list">${def.exercises.map((ex) => {
    const last = ex.load ? lastLoad(ex.id) : null;
    return `<div class="row"><div><div>${esc(ex.name)}</div>${ex.focus ? `<div class="muted small">${esc(ex.focus)}</div>` : ""}
      ${last ? `<div class="small accent">Last: ${esc(last.weight)} ${esc(state.unit)}</div>` : ""}</div>
      <div class="rx">${setsFor(ex, week)} × ${esc(ex.reps)}</div></div>`;
  }).join("")}</div>
  <div class="card tips"><div class="eyebrow">Technique</div><p>${esc(def.technique)}</p></div>`;
  if (done.length) out += `<p class="muted small center">Completed ${done.map((h) => fmtDate(h.date)).join(", ")}</p>`;
  out += `<div class="sticky-cta"><button class="btn primary block" data-action="start" data-key="${key}" data-week="${week}">
    ${isActive ? "Resume workout" : done.length ? "Do it again" : "Start workout"}</button></div>`;
  return out;
}

function viewWorkout() {
  const a = state.active;
  const def = sessionDef(a.key);
  const g = PROGRAM.weekGuidance[a.week];
  const { done, total } = progressOf(a);
  let out = `<header class="page-head workout-head">
    <div class="eyebrow">Week ${a.week} · Effort ${esc(g.effort)} · <span id="elapsed">${fmtClock((Date.now() - a.startedAt) / 1000)}</span></div>
    <h1>${esc(def.name)}</h1>
    <div class="progress"><div style="width:${total ? (done / total) * 100 : 0}%"></div></div>
    <div class="muted small">${done} of ${total} sets</div>
  </header>`;

  if (def.warmup.length) {
    const wDone = Object.values(a.warmup).every(Boolean);
    out += `<details class="card warm" ${wDone ? "" : "open"}><summary><h2>Warm-up</h2>${wDone ? `<span class="pill ok">${CHECK} Done</span>` : ""}</summary>
      ${def.warmup.map((w) => `<button class="check-row ${a.warmup[w.id] ? "on" : ""}" data-action="warm" data-id="${w.id}">
        <span class="box">${CHECK}</span><span class="grow">${esc(w.name)}</span><span class="muted">${esc(w.rx)}</span></button>`).join("")}
    </details>`;
  }

  for (const ex of def.exercises) {
    const it = a.items[ex.id];
    const all = it.sets.every(Boolean);
    const last = ex.load ? lastLoad(ex.id) : null;
    out += `<div class="card ex ${all ? "complete" : ""}" id="ex-${ex.id}">
      <div class="ex-head"><div><div class="ex-name">${esc(ex.name)}</div>
        <div class="muted small">${esc(ex.focus || "")}</div></div>
        <div class="rx">${it.sets.length} × ${esc(ex.reps)}</div></div>
      ${ex.load ? `<div class="load"><label>Weight <input inputmode="decimal" data-action="weight" data-id="${ex.id}" value="${esc(it.weight)}" placeholder="–"> ${esc(state.unit)}</label>
        ${last ? `<span class="muted small">Last time ${esc(last.weight)} ${esc(state.unit)}</span>` : ""}</div>` : ""}
      <div class="sets">${it.sets.map((s, i) => `<button class="set ${s ? "on" : ""}" data-action="set" data-id="${ex.id}" data-i="${i}" aria-label="Set ${i + 1}">
        ${s ? CHECK : `<b>${i + 1}</b>`}</button>`).join("")}</div>
    </div>`;
  }

  out += `<div class="card tips"><div class="eyebrow">Technique</div><p>${esc(def.technique)}</p></div>
  <div class="card">
    <h2>How did it feel?</h2>
    <div class="effort">${[...Array(10)].map((_, i) => `<button class="${a.effort === i + 1 ? "on" : ""}" data-action="effort" data-v="${i + 1}">${i + 1}</button>`).join("")}</div>
    <p class="muted small">Target this week: ${esc(g.effort)}</p>
    <textarea data-action="notes" rows="3" placeholder="Notes (optional) — how did it go, anything to remember?">${esc(a.notes)}</textarea>
  </div>
  <button class="btn primary block big" data-action="finish">Finish workout</button>
  <button class="btn ghost block danger" data-action="discard">Discard</button>`;
  return out;
}

function viewHistory() {
  const items = [...state.history].sort((a, b) => b.finishedAt - a.finishedAt);
  const thisWeekStart = mondayOf();
  const thisWeek = items.filter((h) => h.date >= thisWeekStart).length;
  const gym = items.filter((h) => h.key !== "M").length;
  let out = `<header class="page-head"><div class="eyebrow">Your training log</div><h1>History</h1></header>
  <div class="stats">
    <div class="stat"><b>${items.length}</b><span>sessions</span></div>
    <div class="stat"><b>${gym}</b><span>gym workouts</span></div>
    <div class="stat"><b>${thisWeek}</b><span>this week</span></div>
  </div>`;
  if (!items.length) return out + `<div class="card empty"><p>No workouts yet.</p><p class="muted">Finished workouts will appear here.</p></div>`;
  let lastMonth = "";
  for (const h of items) {
    const def = sessionDef(h.key);
    const month = fmtDate(h.date, { month: "long", year: "numeric" });
    if (month !== lastMonth) { out += `<h2 class="section">${esc(month)}</h2>`; lastMonth = month; }
    const { done, total } = progressOf(h);
    out += `<a class="card session ${def.mobility ? "mob" : ""}" href="#/history/${h.id}">
      <div class="session-badge">${def.mobility ? "M" : h.key}</div>
      <div class="session-main"><div class="session-name">${esc(def.name)}</div>
        <div class="muted small">${esc(fmtDate(h.date))} · Week ${h.week} · ${fmtDuration(h.finishedAt - h.startedAt)} · ${done}/${total} sets${h.effort ? ` · RPE ${h.effort}` : ""}</div></div>${CHEV}</a>`;
  }
  return out;
}

function viewHistoryDetail(id) {
  const h = state.history.find((x) => x.id === id);
  if (!h) return viewHistory();
  const def = sessionDef(h.key);
  const { done, total } = progressOf(h);
  let out = `<a class="back" href="#/history">‹ History</a>
  <header class="page-head"><div class="eyebrow">${esc(fmtDate(h.date, { weekday: "long", day: "numeric", month: "long" }))} · Week ${h.week}</div>
  <h1>${esc(def.name)}</h1></header>
  <div class="stats">
    <div class="stat"><b>${fmtDuration(h.finishedAt - h.startedAt)}</b><span>duration</span></div>
    <div class="stat"><b>${done}/${total}</b><span>sets</span></div>
    <div class="stat"><b>${h.effort ?? "–"}</b><span>effort</span></div>
  </div>
  <div class="card list">${def.exercises.map((ex) => {
    const it = h.items[ex.id] || { sets: [] };
    const n = it.sets.filter(Boolean).length;
    return `<div class="row"><div><div>${esc(ex.name)}</div><div class="muted small">${n}/${it.sets.length} sets × ${esc(ex.reps)}</div></div>
      <div class="rx">${it.weight ? `${esc(it.weight)} ${esc(state.unit)}` : n === it.sets.length ? CHECK : ""}</div></div>`;
  }).join("")}</div>`;
  if (h.notes) out += `<div class="card"><div class="eyebrow">Notes</div><p class="pre">${esc(h.notes)}</p></div>`;
  out += `<button class="btn ghost block danger" data-action="delete-history" data-id="${h.id}">Delete this workout</button>`;
  return out;
}

function viewProgress() {
  let out = `<header class="page-head"><div class="eyebrow">Is the reset working?</div><h1>Progress</h1></header>
  <p class="muted">Enter your Week 1 baseline and Week 4 results. Use your weaker side consistently.</p>`;
  for (const a of PROGRAM.assessments) {
    const v = state.assessments[a.id] || {};
    const d = v.w1 !== undefined && v.w1 !== "" && v.w4 !== undefined && v.w4 !== "" ? (parseFloat(v.w4) - parseFloat(v.w1)) : null;
    out += `<div class="card assess">
      <div class="ex-head"><div><div class="ex-name">${esc(a.name)}</div><div class="muted small">${esc(a.help)}</div></div>
      ${d !== null && !isNaN(d) ? `<span class="pill ${d >= 0 ? "ok" : ""}">${d > 0 ? "+" : ""}${+d.toFixed(1)}</span>` : ""}</div>
      <div class="assess-row">
        <label>Week 1<input inputmode="decimal" data-action="assess" data-id="${a.id}" data-w="w1" value="${esc(v.w1 ?? "")}"><em>${esc(a.unit)}</em></label>
        <label>Week 4<input inputmode="decimal" data-action="assess" data-id="${a.id}" data-w="w4" value="${esc(v.w4 ?? "")}"><em>${esc(a.unit)}</em></label>
      </div></div>`;
  }
  out += `<h2 class="section">Settings</h2>
  <div class="card">
    <label class="field"><span>Programme start date (week 1)</span>
      <input type="date" data-action="start-date" value="${esc(state.startDate || mondayOf())}"></label>
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
      state.startDate = $("#start-input").value || mondayOf();
      save(); render(); break;
    }
    case "start": startWorkout(el.dataset.key, Number(el.dataset.week)); break;
    case "warm": a.warmup[el.dataset.id] = !a.warmup[el.dataset.id]; save(); keepScroll(); break;
    case "set": {
      const it = a.items[el.dataset.id];
      const i = Number(el.dataset.i);
      it.sets[i] = !it.sets[i];
      save();
      if (it.sets[i]) {
        const def = sessionDef(a.key);
        const allDone = Object.values(a.items).every((x) => x.sets.every(Boolean));
        if (allDone) { stopRest(); toast("All sets done — finish when ready!"); }
        else startRest(def.mobility ? 20 : 75);
      }
      keepScroll();
      break;
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
    case "export": exportData(); break;
    case "reset":
      if (confirm("Erase ALL workouts, assessments and settings? This can't be undone.") && confirm("Really erase everything?")) {
        state = blank(); save(); go("#/today");
      }
      break;
  }
});

document.addEventListener("input", (e) => {
  const el = e.target;
  const act = el.dataset.action;
  if (act === "weight") { state.active.items[el.dataset.id].weight = el.value.trim(); save(); }
  else if (act === "notes") { state.active.notes = el.value; save(); }
  else if (act === "assess") {
    (state.assessments[el.dataset.id] ||= {})[el.dataset.w] = el.value.trim(); save();
  }
});

document.addEventListener("change", (e) => {
  const el = e.target;
  const act = el.dataset.action;
  if (act === "start-date" && el.value) { state.startDate = el.value; save(); toast("Start date updated"); }
  else if (act === "unit") { state.unit = el.value; save(); }
  else if (act === "assess") keepScroll();
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
  const json = JSON.stringify({ app: "foundation-reset", version: 1, exportedAt: new Date().toISOString(), state }, null, 2);
  const name = `foundation-reset-backup-${today()}.json`;
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
