const worlds = [{ id: "peru", name: "PERU", url: "peru.html" }];
let worldIndex = 0;

const form = document.querySelector("#loginForm");
const message = document.querySelector("#message");
const previous = document.querySelector("#previousWorld");
const next = document.querySelector("#nextWorld");
const passwordInput = document.querySelector("#password");
const showPassword = document.querySelector("#showPassword");
const config = window.BLOCKWORLD_SUPABASE || {};

const configured = Boolean(
  config.url && config.anonKey &&
  !config.url.startsWith("PASTE_") &&
  !config.anonKey.startsWith("PASTE_")
);
const supabaseClient = configured && window.supabase
  ? window.supabase.createClient(config.url, config.anonKey)
  : null;

function updateWorld() {
  const locked = worlds.length < 2;
  previous.disabled = locked;
  next.disabled = locked;
}

function move(direction) {
  worldIndex = (worldIndex + direction + worlds.length) % worlds.length;
  updateWorld();
}

function usernameToEmail(username) {
  if (username.includes("@")) return username;
  return `${username.toLowerCase()}@${config.usernameDomain || "blockworld.local"}`;
}

previous.addEventListener("click", () => move(-1));
next.addEventListener("click", () => move(1));

showPassword.addEventListener("click", () => {
  const visible = passwordInput.classList.toggle("password-visible");
  showPassword.setAttribute("aria-pressed", String(visible));
  showPassword.setAttribute("aria-label", visible ? "Passwort verbergen" : "Passwort anzeigen");
  passwordInput.focus();
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  message.className = "message";
  const data = new FormData(form);
  const username = String(data.get("explorer_login") || "").trim();
  const password = String(data.get("explorer_secret") || "");
  const world = worlds[worldIndex];

  if (!username || !password) {
    message.textContent = "Bitte Benutzername und Passwort eingeben.";
    return;
  }
  if (!/^[A-Za-z0-9._-]+$/.test(username)) {
    message.textContent = "Der Benutzername darf Buchstaben, Zahlen, Punkt, _ und - enthalten.";
    return;
  }
  if (!supabaseClient) {
    message.textContent = "Supabase ist noch nicht konfiguriert.";
    return;
  }

  form.querySelector(".enter").disabled = true;
  message.textContent = "Anmeldung läuft …";

  const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
    email: usernameToEmail(username),
    password
  });

  if (authError || !authData.user) {
    message.textContent = "Benutzername oder Passwort ist nicht richtig.";
    form.querySelector(".enter").disabled = false;
    return;
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single();

  if (!profileError && profile?.role === "admin") {
    message.className = "message success";
    message.textContent = "Admin-Bereich wird geöffnet …";
    window.setTimeout(() => { window.location.href = "admin.html"; }, 350);
    return;
  }

  const { data: access, error: accessError } = await supabaseClient
    .from("world_access")
    .select("world_slug")
    .eq("user_id", authData.user.id)
    .eq("world_slug", world.id)
    .maybeSingle();

  if (accessError || !access) {
    await supabaseClient.auth.signOut();
    message.textContent = "Diese Welt ist für diesen Benutzer nicht freigeschaltet.";
    form.querySelector(".enter").disabled = false;
    return;
  }

  if (!data.get("remember")) sessionStorage.setItem("blockworld-session-only", "true");
  sessionStorage.setItem("blockworld-world", world.id);
  message.className = "message success";
  message.textContent = `Willkommen! ${world.name} wird geöffnet …`;
  window.setTimeout(() => { window.location.href = world.url; }, 500);
});

updateWorld();
