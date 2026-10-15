// Connects the museum to its Supabase project (likes, reviews, email sign-in, subscriptions).
// Both values are public by design: the anon key only allows what the database rules in
// supabase/schema.sql permit. Leave them empty to run in preview mode, where everything
// is saved on the visitor's own device only.
window.MUSEE_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
};
