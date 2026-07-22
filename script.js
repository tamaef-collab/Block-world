const worlds = [{ id: "peru", name: "PERU", url: "peru.html" }];
let worldIndex = 0;
const form = document.querySelector("#loginForm");
const message = document.querySelector("#message");
const previous = document.querySelector("#previousWorld");
const next = document.querySelector("#nextWorld");
const remember = form.querySelector('input[name="remember"]');

const SUPABASE_URL = "https://vshonfcnepmhuspnqbvx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1aJmfhVjozAv4Po1WWJCzg_oN6q9EDT";

const authStorage = {
  getItem(key) {
    return localStorage.getItem(key) || sessionStorage.getItem(key);
  },
  setItem(key, value) {
    if (remember.checked) {
      sessionStorage.removeItem(key);
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
      sessionStorage.setItem(key, value);
    }
  },
  removeItem(key) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
};

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { storage: authStorage, persistSession: true, autoRefreshToken: true }
});

function updateWorld() {
  const locked = worlds.length < 2;
  previous.disabled = locked;
  next.disabled = locked;
}

function move(direction) {
  worldIndex = (worldIndex + direction + worlds.length) % worlds.length;
  updateWorld();
}

previous.addEventListener("click", () => move(-1));
next.addEventListener("click", () => move(1));

document.querySelector("#showPassword").addEventListener("click", () => {
  const input = document.querySelector("#password");
  input.type = input.type === "password" ? "text" : "password";
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  const data = new FormData(form);
  const username = String(data.get("username")).trim();
  const password = String(data.get("password"));
  const world = worlds[worldIndex];
  const submitButton = form.querySelector(".enter");

  submitButton.disabled = true;
  message.className = "message";
  message.textContent = "Anmeldung läuft …";

  const { data: authData, error } = await supabaseClient.auth.signInWithPassword({
    email: `${username}@blockworld.local`,
    password
  });

  if (error) {
    submitButton.disabled = false;
    message.className = "message";
    message.textContent = "Benutzername oder Passwort ist nicht richtig.";
    return;
  }

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();

  sessionStorage.setItem("blockworld-user", username);
  sessionStorage.setItem("blockworld-world", world.id);
  message.className = "message success";
  message.textContent = `Willkommen, ${username}! ${world.name} wird geöffnet …`;
  setTimeout(() => {
    location.href = profile?.role === "admin" ? "admin.html" : world.url;
  }, 700);
});

updateWorld();
