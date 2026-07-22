const worlds = [{ id: "peru", name: "PERU", url: "peru.html" }];
let worldIndex = 0;
const form = document.querySelector("#loginForm");
const message = document.querySelector("#message");
const previous = document.querySelector("#previousWorld");
const next = document.querySelector("#nextWorld");

function updateWorld() {
  const locked = worlds.length < 2;
  previous.disabled = locked;
  next.disabled = locked;
}

function move(direction) {
  if (worlds.length < 2) return;
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

  if (!username || !password) return;
  if (!window.supabaseClient) {
    message.className = "message";
    message.textContent = "Supabase ist noch nicht konfiguriert.";
    return;
  }

  const email = username.includes("@") ? username : `${username.toLowerCase()}@users.blockworld.local`;
  const { data: authData, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    message.className = "message";
    message.textContent = "Benutzername oder Passwort ist nicht richtig.";
    return;
  }

  const { data: access } = await window.supabaseClient
    .from("world_access")
    .select("world_id")
    .eq("user_id", authData.user.id)
    .eq("world_id", world.id)
    .maybeSingle();

  if (!access) {
    await window.supabaseClient.auth.signOut();
    message.className = "message";
    message.textContent = "Diese Welt ist für diesen Benutzer nicht freigeschaltet.";
    return;
  }

  sessionStorage.setItem("blockworld-user", username);
  sessionStorage.setItem("blockworld-world", world.id);
  message.className = "message success";
  message.textContent = `Willkommen, ${username}! ${world.name} wird geöffnet …`;
  setTimeout(() => location.href = world.url, 700);
});

updateWorld();
