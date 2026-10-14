// The sign-in screen. Signed in: hand over to the web app. Signed out: sign in through the system browser.
const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

const show = (id) => {
  for (const s of document.querySelectorAll("section")) s.hidden = s.id !== id;
};
const error = (text) => {
  const el = document.getElementById("error");
  el.textContent = text || "";
  el.hidden = !text;
};

async function start() {
  error("");
  const status = await invoke("status");
  document.getElementById("server").textContent = status.server.replace(/^https?:\/\//, "");
  // Phones sign in in a sheet over the app, not a separate browser.
  if (status.platform === "ios" || status.platform === "android") {
    document.getElementById("sign-in-text").textContent = "Sign in with the account you use for Midore.";
    document.getElementById("sign-in").textContent = "Sign in";
    document.getElementById("waiting-title").textContent = "Finishing sign-in…";
    document.getElementById("waiting-text").textContent = "Choose Connect on the sign-in page and your calendar opens here.";
  }
  if (!status.signedIn) return show("signed-out");
  show("loading");
  try {
    await invoke("open_web");
  } catch (e) {
    const signedOut = String(e).toLowerCase().includes("signed out");
    if (signedOut) return show("signed-out");
    document.getElementById("offline-text").textContent = String(e);
    await showSaved();
    show("offline");
  }
}

/** Offline: today and tomorrow from the last sync, so the plan is still there without a connection. */
async function showSaved() {
  const box = document.getElementById("saved");
  const agenda = await invoke("cached_agenda").catch(() => null);
  const items = (agenda?.items ?? []).filter((i) => new Date(i.end) > new Date());
  box.hidden = items.length === 0;
  if (box.hidden) return;
  const day = (d) => new Date(d).toDateString();
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  const dayName = new Intl.DateTimeFormat(undefined, { weekday: "long" });
  const today = day(Date.now());
  box.replaceChildren();
  let current = "";
  let list;
  for (const i of items.slice(0, 14)) {
    const d = i.allDay ? day(i.start.slice(0, 10) + "T12:00:00") : day(i.start);
    if (d !== current) {
      current = d;
      const h = document.createElement("h2");
      h.textContent = d === today ? "Today (last synced)" : dayName.format(new Date(d));
      list = document.createElement("ol");
      box.append(h, list);
    }
    const li = document.createElement("li");
    li.className = `${i.kind}${i.state === "done" || i.state === "good_enough" ? " done" : ""}`;
    li.style.setProperty("--c", i.color);
    const t = document.createElement("time");
    t.textContent = i.allDay ? "All day" : time.format(new Date(i.start));
    const title = document.createElement("span");
    title.className = "t";
    title.textContent = i.title;
    li.append(t, title);
    list.append(li);
  }
}

async function signIn() {
  error("");
  try {
    await invoke("sign_in");
    show("waiting");
  } catch (e) {
    error(String(e));
  }
}

document.getElementById("sign-in").addEventListener("click", signIn);
document.getElementById("again").addEventListener("click", signIn);
document.getElementById("retry").addEventListener("click", start);
// Back online while the offline page shows: try again by itself.
window.addEventListener("online", () => {
  if (!document.getElementById("offline").hidden) start();
});
listen("auth-cancelled", () => show("signed-out"));
listen("auth-error", (e) => {
  show("signed-out");
  error(e.payload);
});
start();
