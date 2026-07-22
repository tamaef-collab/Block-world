// Only the public Project URL and Publishable/anon key belong here.
// Never put the service_role key, secret key, or database password in browser code.
window.BLOCKWORLD_SUPABASE = {
  url: "https://vshonfcnepmhuspnqbvx.supabase.co",
  anonKey: "sb_publishable_1aJmfhVjozAv4Po1WWJCzg_oN6q9EDT",
  usernameDomain: "blockworld.local"
};

// Create the browser client here as well, so this configuration works with
// both the current login script and the older published login script.
if (window.supabase && typeof window.supabase.createClient === "function") {
  window.supabaseClient = window.supabase.createClient(
    window.BLOCKWORLD_SUPABASE.url,
    window.BLOCKWORLD_SUPABASE.anonKey
  );
} else {
  console.error("Supabase library did not load before supabase-config.js");
}
