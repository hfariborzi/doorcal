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
  if (!status.signedIn) return show("signed-out");
  show("loading");
  try {
    await invoke("open_web");
  } catch (e) {
    const signedOut = String(e).toLowerCase().includes("signed out");
    if (signedOut) return show("signed-out");
    document.getElementById("offline-text").textContent = String(e);
    show("offline");
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
listen("auth-error", (e) => {
  show("signed-out");
  error(e.payload);
});
start();
