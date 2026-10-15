// Data layer for the museum: likes, reviews, email sign-in and notification preferences.
// With Supabase configured (musee/config.js) everything is shared between visitors.
// Without it, a preview store keeps everything in this browser so the site still works.
(function () {
  const cfg = window.MUSEE_CONFIG || {};
  const live = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);

  const safe = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  // An anonymous id per browser, so a visitor can like a work once without signing in
  let device = safe.get("musee.device", null);
  if (!device) {
    device = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
    safe.set("musee.device", device);
  }

  const listeners = new Set();
  const emit = (user) => listeners.forEach((fn) => fn(user));

  // ---------------------------------------------------------------
  // Preview store (this browser only)
  // ---------------------------------------------------------------
  const preview = {
    live: false,
    async init() {},
    user() { return safe.get("musee.user", null); },
    onAuth(fn) { listeners.add(fn); },
    async signIn(email, optin) {
      const user = { email };
      safe.set("musee.user", user);
      safe.set("musee.prefs", { works: optin, expos: optin });
      emit(user);
      return { instant: true };
    },
    async signOut() { localStorage.removeItem("musee.user"); emit(null); },
    async likeCounts() { return safe.get("musee.likes", {}); },
    async myLikes() { return new Set(safe.get("musee.mylikes", [])); },
    async toggleLike(work) {
      const counts = safe.get("musee.likes", {});
      const mine = new Set(safe.get("musee.mylikes", []));
      const liked = !mine.has(work);
      liked ? mine.add(work) : mine.delete(work);
      counts[work] = Math.max(0, (counts[work] || 0) + (liked ? 1 : -1));
      safe.set("musee.likes", counts);
      safe.set("musee.mylikes", [...mine]);
      return { liked, count: counts[work] };
    },
    async reviews(work) { return (safe.get("musee.reviews", {})[work] || []).slice().reverse(); },
    async reviewStats() {
      const all = safe.get("musee.reviews", {});
      const out = {};
      Object.entries(all).forEach(([w, list]) => {
        out[w] = { n: list.length, avg: list.reduce((s, r) => s + r.rating, 0) / list.length };
      });
      return out;
    },
    async addReview(work, r) {
      const all = safe.get("musee.reviews", {});
      (all[work] = all[work] || []).push({ ...r, created_at: new Date().toISOString() });
      safe.set("musee.reviews", all);
    },
    async prefs() { return safe.get("musee.prefs", { works: true, expos: true }); },
    async setPrefs(p) { safe.set("musee.prefs", p); },
  };

  // ---------------------------------------------------------------
  // Supabase store (shared by every visitor)
  // ---------------------------------------------------------------
  let sb = null;
  let current = null;
  const supa = {
    live: true,
    async init() {
      await new Promise((ok, fail) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
        s.onload = ok; s.onerror = fail;
        document.head.appendChild(s);
      });
      sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      const { data } = await sb.auth.getSession();
      current = data.session ? { email: data.session.user.email, id: data.session.user.id } : null;
      if (current) await this.ensureSubscriber();
      sb.auth.onAuthStateChange(async (_e, session) => {
        const next = session ? { email: session.user.email, id: session.user.id } : null;
        if ((next && next.id) === (current && current.id)) return;
        current = next;
        if (current) await this.ensureSubscriber();
        emit(current);
      });
    },
    // First sign-in after the email link: save the choice made in the form
    async ensureSubscriber() {
      const optin = safe.get("musee.optin", null);
      const { data } = await sb.from("subscribers").select("user_id").eq("user_id", current.id).maybeSingle();
      if (!data) await sb.from("subscribers").insert({ works: optin !== false, expos: optin !== false });
      localStorage.removeItem("musee.optin");
    },
    user() { return current; },
    onAuth(fn) { listeners.add(fn); },
    async signIn(email, optin) {
      safe.set("musee.optin", optin);
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: location.origin + "/musee" },
      });
      if (error) throw error;
      return { instant: false };
    },
    async signOut() { await sb.auth.signOut(); },
    async likeCounts() {
      const { data } = await sb.rpc("like_counts");
      return Object.fromEntries((data || []).map((r) => [r.work, r.n]));
    },
    async myLikes() {
      const { data } = await sb.rpc("my_likes", { p_device: device });
      return new Set((data || []).map((r) => r.work));
    },
    async toggleLike(work) {
      const { data, error } = await sb.rpc("toggle_like", { p_work: work, p_device: device });
      if (error) throw error;
      return data[0];
    },
    async reviews(work) {
      const { data } = await sb.from("reviews").select("name, rating, body, created_at")
        .eq("work", work).order("created_at", { ascending: false }).limit(50);
      return (data || []).map((r) => ({ name: r.name, rating: r.rating, text: r.body, created_at: r.created_at }));
    },
    async reviewStats() {
      const { data } = await sb.rpc("review_stats");
      return Object.fromEntries((data || []).map((r) => [r.work, { n: r.n, avg: Number(r.avg) }]));
    },
    async addReview(work, r) {
      const { error } = await sb.from("reviews").insert({ work, name: r.name, rating: r.rating, body: r.text });
      if (error) throw error;
    },
    async prefs() {
      const { data } = await sb.from("subscribers").select("works, expos").eq("user_id", current.id).maybeSingle();
      return data || { works: false, expos: false };
    },
    async setPrefs(p) {
      const { error } = await sb.from("subscribers").update({ works: p.works, expos: p.expos }).eq("user_id", current.id);
      if (error) throw error;
    },
  };

  window.MuseeStore = live ? supa : preview;
})();
