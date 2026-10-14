// The menu bar calendar: a month to pick a day, that day's events and planned work, and quick add.
const { invoke } = window.__TAURI__.core;
const $ = (id) => document.getElementById(id);

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayIso = () => iso(new Date());
const fromIso = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const monthFmt = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: "narrow" });

let selected = todayIso();
let shown = fromIso(selected); // any day in the month on screen
let lastToday = selected;
let request = 0;
const cache = new Map();

function renderMonth() {
  $("month").textContent = monthFmt.format(shown);
  const grid = $("grid");
  grid.replaceChildren();
  // Weeks start on Sunday, as on the web calendar (7 January 2024 was a Sunday).
  for (let i = 0; i < 7; i++) {
    const wd = document.createElement("div");
    wd.className = "wd";
    wd.textContent = weekdayFmt.format(new Date(2024, 0, 7 + i));
    grid.append(wd);
  }
  const first = new Date(shown.getFullYear(), shown.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const today = todayIso();
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (i >= 35 && d.getMonth() !== shown.getMonth()) break; // five rows when the month fits
    const key = iso(d);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "day";
    if (d.getMonth() !== shown.getMonth()) b.classList.add("out");
    if (key === today) b.classList.add("today");
    if (key === selected) b.classList.add("sel");
    b.setAttribute("aria-label", dayFmt.format(d));
    if (key === selected) b.setAttribute("aria-current", "date");
    const n = document.createElement("span");
    n.textContent = d.getDate();
    b.append(n);
    b.addEventListener("click", () => select(key));
    grid.append(b);
  }
}

function select(key) {
  selected = key;
  const d = fromIso(key);
  if (d.getMonth() !== shown.getMonth() || d.getFullYear() !== shown.getFullYear()) shown = d;
  renderMonth();
  loadDay();
}

function say(msg) {
  $("error").textContent = msg || "";
  $("error").hidden = !msg;
}

function skeleton() {
  const list = $("list");
  list.replaceChildren(...[0, 1, 2].map(() => Object.assign(document.createElement("div"), { className: "skeleton" })));
}

async function loadDay(fresh = false) {
  const key = selected;
  const id = ++request;
  $("dayname").textContent = key === todayIso() ? `Today · ${dayFmt.format(fromIso(key))}` : dayFmt.format(fromIso(key));
  if (fresh) cache.delete(key);
  if (cache.has(key)) renderDay(cache.get(key));
  else {
    $("count").textContent = "";
    skeleton();
  }
  try {
    const data = await invoke("mini_day", { date: key });
    cache.set(key, data);
    if (id === request) {
      say("");
      renderDay(data);
    }
  } catch (e) {
    if (id !== request) return;
    if (!cache.has(key)) $("list").replaceChildren();
    say(String(e));
  }
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function renderDay(data) {
  const list = $("list");
  const items = data.items || [];
  const allDay = items.filter((i) => i.allDay);
  const timed = items.filter((i) => !i.allDay);
  const tasks = timed.filter((i) => i.kind === "task").length;
  const events = items.length - tasks;
  $("count").textContent = [events && `${events} ${events === 1 ? "event" : "events"}`, tasks && `${tasks} planned`].filter(Boolean).join(" · ");

  const problems = data.problems || [];
  $("problems").hidden = problems.length === 0;
  $("problems").textContent = problems.length === 1 ? `${problems[0].email} needs to be reconnected. Open Midore to fix it.` : `${problems.length} calendars need to be reconnected. Open Midore to fix it.`;

  const out = [];
  if (allDay.length) {
    const row = el("div", "allday");
    for (const i of allDay) {
      const chip = el("span", null, i.title);
      chip.style.setProperty("--c", i.color);
      chip.title = i.title;
      row.append(chip);
    }
    out.push(row);
  }
  const now = Date.now();
  for (const i of timed) {
    const start = new Date(i.start);
    const end = new Date(i.end);
    const row = el("div", `item ${i.kind}`);
    row.style.setProperty("--c", i.color);
    const isNow = start <= now && end > now;
    if (isNow) row.classList.add("now");
    if (i.state === "done" || i.state === "good_enough") row.classList.add("done");
    if (i.state === "missed") row.classList.add("missed");

    const time = el("div", "time", timeFmt.format(start));
    time.append(el("small", null, timeFmt.format(end)));
    const title = el("div", "title", i.title);
    title.title = i.title;
    row.append(time, title);

    const side = el("div");
    if (i.kind === "task") side.append(tick(i, row));
    else if (i.meetLink && end > now) {
      const join = el("button", "join", "Join");
      join.type = "button";
      join.addEventListener("click", () => invoke("open_link", { url: i.meetLink }).catch((e) => say(String(e))));
      side.append(join);
    } else if (isNow) side.append(el("span", "tag now", "Now"));
    row.append(side);
    out.push(row);
  }
  if (!out.length) out.push(el("p", "empty", selected === todayIso() ? "Nothing on today. Time is yours." : "Nothing on this day."));
  list.replaceChildren(...out);
}

/** A circle that marks planned work done; filled once it is. */
function tick(i, row) {
  const done = i.state === "done" || i.state === "good_enough";
  const b = el("button", done ? "tick on" : "tick", done ? "✓" : "");
  b.type = "button";
  b.setAttribute("aria-label", done ? `${i.title}: done` : `Mark ${i.title} done`);
  if (done) {
    b.disabled = true;
    return b;
  }
  b.addEventListener("click", async () => {
    b.classList.add("on");
    b.textContent = "✓";
    row.classList.add("done");
    try {
      await invoke("mark_done", { taskId: i.taskId, start: i.start, end: i.end });
      i.state = "done";
      b.disabled = true;
    } catch (e) {
      b.classList.remove("on");
      b.textContent = "";
      row.classList.remove("done");
      say(String(e));
    }
  });
  return b;
}

$("prev").addEventListener("click", () => {
  shown = new Date(shown.getFullYear(), shown.getMonth() - 1, 1);
  renderMonth();
});
$("next").addEventListener("click", () => {
  shown = new Date(shown.getFullYear(), shown.getMonth() + 1, 1);
  renderMonth();
});
$("today").addEventListener("click", () => select(todayIso()));
$("openMain").addEventListener("click", () => invoke("open_main"));
$("problems").addEventListener("click", () => invoke("open_main"));

$("add").addEventListener("submit", async (e) => {
  e.preventDefault();
  const t = $("text").value.trim();
  if (!t) return;
  $("text").disabled = true;
  try {
    await invoke("quick_add", { title: t });
    $("text").value = "";
    $("text").placeholder = `Added “${t.length > 28 ? t.slice(0, 27) + "…" : t}”. Midore will fit it in.`;
    setTimeout(() => loadDay(true), 1500); // the planner places it in a moment
  } catch (err) {
    say(String(err));
  } finally {
    $("text").disabled = false;
    $("text").focus();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") invoke("close_mini");
  if (document.activeElement === $("text")) return;
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    const d = fromIso(selected);
    d.setDate(d.getDate() + (e.key === "ArrowLeft" ? -1 : 1));
    select(iso(d));
  }
});

// Each time the panel opens: follow the date if the day changed, and fetch fresh data.
window.addEventListener("focus", () => {
  const today = todayIso();
  if (lastToday !== today && selected === lastToday) {
    selected = today;
    shown = fromIso(today);
  }
  lastToday = today;
  $("text").placeholder = "Add a task…";
  cache.clear();
  renderMonth();
  loadDay(true);
});

renderMonth();
loadDay();
