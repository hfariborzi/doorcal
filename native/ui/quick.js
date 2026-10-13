// Quick add: Enter adds a task; Cmd/Ctrl+Enter asks Dori; Esc closes.
const { invoke } = window.__TAURI__.core;
const text = document.getElementById("text");
const reply = document.getElementById("reply");
const error = document.getElementById("error");
const doriBtn = document.getElementById("dori");
const addBtn = document.getElementById("add");
let doriEnabled = false;
if (navigator.platform.toLowerCase().includes("mac")) document.getElementById("mod").textContent = "⌘";

const say = (el, msg) => {
  el.textContent = msg || "";
  el.hidden = !msg;
};
const busy = (on) => {
  addBtn.disabled = on;
  doriBtn.disabled = on;
};

invoke("quick_info")
  .then((info) => {
    doriEnabled = info.doriEnabled;
    doriBtn.hidden = !doriEnabled;
  })
  .catch(() => {});

async function add() {
  const t = text.value.trim();
  if (!t) return;
  busy(true);
  say(error, "");
  try {
    await invoke("quick_add", { title: t });
    text.value = "";
    say(reply, `Added: ${t}. Midore will fit it into your week.`);
  } catch (e) {
    say(error, String(e));
  } finally {
    busy(false);
  }
}

async function ask() {
  const t = text.value.trim();
  if (!t || !doriEnabled) return;
  busy(true);
  say(error, "");
  say(reply, "Dori is thinking…");
  try {
    const r = await invoke("ask_dori", { text: t });
    text.value = "";
    say(reply, [r.text, ...r.actions.map((a) => `✓ ${a}`)].join("\n"));
  } catch (e) {
    say(reply, "");
    say(error, String(e));
  } finally {
    busy(false);
  }
}

document.getElementById("form").addEventListener("submit", (e) => {
  e.preventDefault();
  add();
});
doriBtn.addEventListener("click", ask);
text.addEventListener("keydown", (e) => {
  if (e.key === "Escape") return invoke("hide_quick");
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    return ask();
  }
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    add();
  }
});
window.addEventListener("focus", () => text.focus());
