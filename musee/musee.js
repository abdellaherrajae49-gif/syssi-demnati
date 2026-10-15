const WORKS = window.WORKS;
const store = window.MuseeStore;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const ROOMS = {
  noire: {
    eyebrow: "Salle Noire",
    title: "Lignes de lumière sur fond de nuit",
    intro: "Des toiles sombres où la couleur et la ligne claire surgissent de l’ombre.",
  },
  blanche: {
    eyebrow: "Salle Blanche",
    title: "La couleur au grand jour",
    intro: "Des toiles claires où le trait noir danse et la couleur respire.",
  },
};
const other = (s) => (s === "noire" ? "blanche" : "noire");
const img = (w, size) => `/assets/works/${w.file}-${size}.webp`;
const alt = (w) => `${w.title}, œuvre de Syssi Demnati, acrylique sur toile`;

let state = { salle: "hall", likes: {}, mine: new Set(), stats: {} };

// ---------------------------------------------------------------
// Hall: counts and a peek of each room behind its door
// ---------------------------------------------------------------
["noire", "blanche"].forEach((s) => {
  const list = WORKS.filter((w) => w.salle === s);
  $(`[data-count="${s}"]`).textContent = `${list.length} œuvres`;
  $(`[data-preview="${s}"]`).innerHTML = list.slice(0, 3)
    .map((w) => `<img src="${img(w, 480)}" alt="" loading="lazy" decoding="async">`).join("");
});

// ---------------------------------------------------------------
// Rooms: each work hangs on the wall with its cartel
// ---------------------------------------------------------------
const wall = $("#wall");
function hang(salle) {
  const list = WORKS.filter((w) => w.salle === salle);
  wall.innerHTML = list.map((w, i) => `
    <article class="piece" style="--r:${(w.w / w.h).toFixed(3)}; --i:${i % 3}" data-work="${w.file}">
      <button class="piece__frame" type="button" data-view="${w.file}" aria-label="Voir ${w.title} en grand">
        <img src="${img(w, 1000)}" srcset="${img(w, 480)} 480w, ${img(w, 1000)} 1000w"
             sizes="(min-width: 900px) 42vw, 86vw" width="${w.w}" height="${w.h}" alt="${alt(w)}" loading="lazy" decoding="async">
      </button>
      <div class="cartel">
        <div>
          <h3>${w.title}</h3>
          <p>Syssi Demnati · Acrylique sur toile</p>
        </div>
        <div class="cartel__actions">
          <button class="like" type="button" data-like="${w.file}" aria-pressed="false"><svg class="like__heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg><span class="like__count">0</span><span class="sr">J’aime ${w.title}</span></button>
          <button class="avis" type="button" data-view="${w.file}" data-focus-reviews><span class="avis__n">0</span> avis</button>
        </div>
      </div>
    </article>`).join("");
  paintCounts();
  observePieces();
}

function paintCounts() {
  $$("[data-like]").forEach((b) => {
    const w = b.dataset.like;
    b.querySelector(".like__count").textContent = state.likes[w] || 0;
    b.setAttribute("aria-pressed", state.mine.has(w));
  });
  $$(".avis").forEach((b) => {
    const s = state.stats[b.dataset.view];
    b.querySelector(".avis__n").textContent = s ? s.n : 0;
  });
}

let io;
function observePieces() {
  io && io.disconnect();
  if (!("IntersectionObserver" in window)) return $$(".piece").forEach((p) => p.classList.add("lit"));
  io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("lit"); io.unobserve(e.target); }
  }), { rootMargin: "0px 0px -12% 0px" });
  $$(".piece").forEach((p) => io.observe(p));
}

// ---------------------------------------------------------------
// Moving between the hall, the two rooms and the agenda
// ---------------------------------------------------------------
const views = { hall: $("#hall"), room: $("#room"), expositions: $("#expositions") };
function show(where, push = true) {
  const go = () => {
    const salle = where === "noire" || where === "blanche" ? where : null;
    views.hall.hidden = where !== "hall";
    views.room.hidden = !salle;
    views.expositions.hidden = where !== "expositions";
    document.body.dataset.salle = salle || where;
    if (salle) {
      const r = ROOMS[salle];
      $("#room-eyebrow").textContent = r.eyebrow;
      $("#room-title").textContent = r.title;
      $("#room-intro").textContent = r.intro;
      $$("#room-switch, [data-switch]").forEach((b) => {
        b.textContent = `Passer en ${ROOMS[other(salle)].eyebrow} →`;
        b.dataset.go = other(salle);
      });
      hang(salle);
    }
    $$(".top__nav a").forEach((a) => a.toggleAttribute("aria-current", a.dataset.go === where));
    $("meta[name=theme-color]").content = where === "blanche" ? "#f4f0e9" : "#131110";
    scrollTo(0, 0);
    state.salle = where;
  };
  if (push) history.pushState(null, "", where === "hall" ? "/musee" : `#${where}`);
  if (reduceMotion || state.salle === where) return go();
  // the lights dim, the room changes, the lights come back up
  document.body.classList.add("dim");
  setTimeout(() => { go(); requestAnimationFrame(() => document.body.classList.remove("dim")); }, 380);
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-go]");
  if (!a) return;
  e.preventDefault();
  show(a.dataset.go);
});
const fromHash = () => (["noire", "blanche", "expositions"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "hall");
addEventListener("popstate", () => show(fromHash(), false));

// ---------------------------------------------------------------
// Likes
// ---------------------------------------------------------------
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-like], #v-like");
  if (!b) return;
  const w = b.dataset.like || current.file;
  try {
    const { liked, count } = await store.toggleLike(w);
    state.likes[w] = count;
    liked ? state.mine.add(w) : state.mine.delete(w);
    paintCounts();
    paintViewerLike();
    $$(`[data-like="${w}"], #v-like`).forEach((x) => {
      if (x.id === "v-like" && (!current || current.file !== w)) return;
      x.classList.remove("pop"); void x.offsetWidth; if (liked) x.classList.add("pop");
    });
  } catch { toast("Impossible d’enregistrer pour le moment."); }
});

// ---------------------------------------------------------------
// Viewer: the work in large format, with its reviews
// ---------------------------------------------------------------
const viewer = $("#viewer");
let current = null;
const roomList = () => WORKS.filter((w) => w.salle === (current ? current.salle : state.salle));

async function openWork(file, focusReviews) {
  current = WORKS.find((w) => w.file === file);
  $("#v-img").src = img(current, 1000);
  $("#v-img").alt = alt(current);
  $("#v-title").textContent = current.title;
  $("#v-salle").textContent = ROOMS[current.salle].eyebrow;
  viewer.dataset.salle = current.salle;
  paintViewerLike();
  paintGate();
  if (!viewer.open) viewer.showModal();
  document.documentElement.classList.add("locked");
  await loadReviews();
  if (focusReviews) $("#v-reviews").scrollIntoView({ block: "start", behavior: "smooth" });
}
function paintViewerLike() {
  if (!current) return;
  $("#v-likes").textContent = state.likes[current.file] || 0;
  $("#v-like").setAttribute("aria-pressed", state.mine.has(current.file));
  const s = state.stats[current.file];
  $("#v-avg").textContent = s && s.n ? `${"★".repeat(Math.round(s.avg))}${"☆".repeat(5 - Math.round(s.avg))} ${s.avg.toFixed(1)} · ${s.n} avis` : "";
}
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const when = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
async function loadReviews() {
  const ul = $("#v-reviews");
  ul.innerHTML = `<li class="reviews__empty">Chargement…</li>`;
  const list = await store.reviews(current.file).catch(() => []);
  ul.innerHTML = list.length
    ? list.map((r) => `<li><div class="reviews__top"><strong>${esc(r.name)}</strong><span class="reviews__stars" aria-label="${r.rating} sur 5">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span></div><p>${esc(r.text)}</p><time>${when(r.created_at)}</time></li>`).join("")
    : `<li class="reviews__empty">Aucun avis pour l’instant. Soyez le premier ou la première.</li>`;
}
function paintGate() {
  const signed = Boolean(store.user());
  $("#v-form").hidden = !signed;
  $("#v-gate").hidden = signed;
}
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-view]");
  if (t) openWork(t.dataset.view, t.hasAttribute("data-focus-reviews"));
});
const step = (d) => {
  const list = roomList();
  const i = list.findIndex((w) => w.file === current.file);
  openWork(list[(i + d + list.length) % list.length].file);
};
$("#v-prev").addEventListener("click", () => step(-1));
$("#v-next").addEventListener("click", () => step(1));
viewer.addEventListener("keydown", (e) => {
  if (e.target.closest("input, textarea")) return;
  if (e.key === "ArrowRight") step(1);
  if (e.key === "ArrowLeft") step(-1);
});
let x0 = null;
$(".viewer__art").addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
$(".viewer__art").addEventListener("touchend", (e) => {
  if (x0 === null) return;
  const dx = e.changedTouches[0].clientX - x0;
  if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  x0 = null;
});

$("#v-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const rating = Number((f.querySelector("[name=note]:checked") || {}).value || 0);
  if (!rating) return toast("Choisissez une note de 1 à 5 étoiles.");
  const btn = f.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    await store.addReview(current.file, { name: f.nom.value.trim(), rating, text: f.texte.value.trim() });
    f.texte.value = "";
    f.querySelectorAll("[name=note]").forEach((r) => (r.checked = false));
    state.stats = await store.reviewStats();
    paintCounts(); paintViewerLike();
    await loadReviews();
    toast("Merci, votre avis est publié.");
  } catch { toast("Votre avis n’a pas pu être publié. Réessayez."); }
  btn.disabled = false;
});

// ---------------------------------------------------------------
// Account: email sign-in and notification preferences
// ---------------------------------------------------------------
const account = $("#account");
$("#a-preview").hidden = store.live;
async function paintAccount() {
  const u = store.user();
  $("#a-out").hidden = Boolean(u);
  $("#a-in").hidden = !u;
  $(".top__account-label").textContent = u ? "Mon compte" : "Être prévenu(e)";
  $(".top__avatar").textContent = u ? u.email[0].toUpperCase() : "✉";
  $("#notify").hidden = Boolean(u);
  if (u) {
    $("#a-email").textContent = u.email;
    const p = await store.prefs().catch(() => ({ works: false, expos: false }));
    $("#a-works").checked = p.works;
    $("#a-expos").checked = p.expos;
  }
  paintGate();
}
const openAccount = () => { paintAccount(); account.showModal(); document.documentElement.classList.add("locked"); };
$("#account-btn").addEventListener("click", openAccount);
document.addEventListener("click", (e) => { if (e.target.closest("[data-open-account]")) openAccount(); });

$("#a-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const btn = f.querySelector("button");
  btn.disabled = true;
  try {
    const r = await store.signIn(f.email.value.trim(), f.optin.checked);
    if (r.instant) { toast("Vous êtes inscrit(e)."); account.close(); }
    else {
      f.hidden = true;
      $("#a-sent").hidden = false;
      $("#a-sent").textContent = `Un lien de connexion vient d’être envoyé à ${f.email.value.trim()}. Ouvrez-le sur cet appareil pour finir.`;
    }
  } catch { toast("L’e-mail n’a pas pu être envoyé. Vérifiez l’adresse."); }
  btn.disabled = false;
});
["#a-works", "#a-expos"].forEach((id) => $(id).addEventListener("change", async () => {
  try {
    await store.setPrefs({ works: $("#a-works").checked, expos: $("#a-expos").checked });
    toast("Préférences enregistrées.");
  } catch { toast("Impossible d’enregistrer pour le moment."); }
}));
$("#a-logout").addEventListener("click", async () => { await store.signOut(); account.close(); toast("Vous êtes déconnecté(e)."); });
store.onAuth(() => paintAccount());

// Closing dialogs
$$("dialog").forEach((d) => {
  d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-close]")) d.close(); });
  d.addEventListener("close", () => {
    if (!$$("dialog").some((x) => x.open)) document.documentElement.classList.remove("locked");
  });
});

// ---------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------
const expos = window.EXPOSITIONS || [];
const li = (x) => `<li><span class="expo-list__date">${esc(x.date)}</span><span class="expo-list__place">${esc(x.lieu)}${x.ville ? `, ${esc(x.ville)}` : ""}</span></li>`;
const next = expos.filter((x) => x.quand === "avenir");
$("#expo-next").innerHTML = next.length ? next.map(li).join("") : `<li class="expo-list__none">Les prochaines dates seront annoncées ici.</li>`;
$("#expo-past").innerHTML = expos.filter((x) => x.quand !== "avenir").map(li).join("");

// ---------------------------------------------------------------
// Toast
// ---------------------------------------------------------------
let tt;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(tt);
  tt = setTimeout(() => t.classList.remove("on"), 3200);
}

// ---------------------------------------------------------------
// Start
// ---------------------------------------------------------------
$("#year").textContent = new Date().getFullYear();
show(fromHash(), false);
(async () => {
  try { await store.init(); } catch { toast("Mode hors ligne : les j’aime et les avis sont indisponibles."); }
  const [likes, mine, stats] = await Promise.all([
    store.likeCounts().catch(() => ({})), store.myLikes().catch(() => new Set()), store.reviewStats().catch(() => ({})),
  ]);
  Object.assign(state, { likes, mine, stats });
  paintCounts();
  paintAccount();
})();
