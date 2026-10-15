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
  $(`[data-preview="${s}"]`).innerHTML = list.slice(0, 1)
    .map((w) => `<img src="${img(w, 480)}" alt="" loading="lazy" decoding="async">`).join("");
});

// ---------------------------------------------------------------
// Rooms: one long wall walked sideways as you scroll. The painting
// in the middle gets the spotlight; the room's name drifts behind.
// ---------------------------------------------------------------
const wall = $("#wall");
const gallery = $("#gallery");
const ghost = $("#ghost");
let pieces = [], centres = [], startX = 0, endX = 0, lastNow = -1;

function hang(salle) {
  const list = WORKS.filter((w) => w.salle === salle);
  const o = other(salle);
  wall.innerHTML = list.map((w, i) => `
    <article class="piece" data-work="${w.file}">
      <span class="piece__spot" aria-hidden="true"></span>
      <button class="piece__frame" type="button" data-view="${w.file}" aria-label="Voir ${w.title} en grand">
        <img src="${img(w, 1000)}" srcset="${img(w, 480)} 480w, ${img(w, 1000)} 1000w"
             sizes="(min-width: 900px) 40vw, 76vw" width="${w.w}" height="${w.h}" alt="${alt(w)}" ${i < 3 ? "" : 'loading="lazy"'} decoding="async"
             style="aspect-ratio:${w.w} / ${w.h}">
        <span class="piece__dim" aria-hidden="true"></span>
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
    </article>`).join("") + `
    <div class="exit">
      <h3>Fin de la ${ROOMS[salle].eyebrow}</h3>
      <p>${list.length} œuvres vues. La visite continue de l’autre côté.</p>
      <button class="exit__go" type="button" data-go="${o}">Passer en ${ROOMS[o].eyebrow} <span aria-hidden="true">→</span></button>
      <a class="exit__back" href="/musee" data-go="hall">Retour au hall</a>
    </div>`;
  ghost.textContent = `${ROOMS[salle].eyebrow} · ${ROOMS[salle].eyebrow} ·`;
  $("#g-total").textContent = String(list.length).padStart(2, "0");
  // fetch the rest of the room quietly, so no painting pops in while walking
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 300));
  idle(() => $$("img[loading=lazy]", wall).forEach((im) => { im.loading = "eager"; }));
  pieces = $$(".piece", wall).map((el) => ({
    el, spot: el.querySelector(".piece__spot"), dim: el.querySelector(".piece__dim"), cartel: el.querySelector(".cartel"), f: -1,
  }));
  lastNow = -1;
  lastX = null;
  measure();
  paintCounts();
}

// Where each painting's centre sits on the wall, and how far the wall travels
function measure() {
  if (views.room.hidden) return;
  const items = [...wall.children];
  centres = items.map((el) => el.offsetLeft + el.offsetWidth / 2);
  startX = centres[0] - innerWidth / 2;
  endX = centres[centres.length - 1] - innerWidth / 2;
  gallery.style.height = `${Math.max(0, endX - startX) + innerHeight}px`;
  lastX = null;
  roomFrame();
}

// Called once per frame while scrolling a room. Only transforms and
// opacities change, so the browser never has to repaint the paintings.
let lastX = null;
function roomFrame() {
  if (views.room.hidden || !centres.length) return;
  const span = gallery.offsetHeight - innerHeight;
  const p = span > 0 ? Math.min(1, Math.max(0, (scrollY - gallery.offsetTop) / span)) : 0;
  const x = startX + p * (endX - startX);
  if (x === lastX) return;
  lastX = x;
  wall.style.transform = `translate3d(${(-x).toFixed(1)}px,0,0)`;
  ghost.style.transform = `translate3d(${(-(x - startX) * 0.35).toFixed(1)}px,-60%,0)`;
  const mid = x + innerWidth / 2;
  let best = 0, bestD = Infinity;
  pieces.forEach((pc, i) => {
    const d = Math.abs(centres[i] - mid);
    if (d < bestD) { bestD = d; best = i; }
    const f = Math.round(Math.max(0, Math.min(1, 1 - (d / innerWidth) * 1.6)) * 200) / 200;
    if (f === pc.f) return;
    pc.f = f;
    pc.el.style.transform = `scale(${(0.84 + f * 0.16).toFixed(3)})`;
    pc.spot.style.opacity = (0.15 + f * 0.85).toFixed(3);
    pc.dim.style.opacity = ((1 - f) * 0.3).toFixed(3);
    const c = Math.max(0, Math.min(1, f * 1.4 - 0.2));
    pc.cartel.style.opacity = c.toFixed(3);
    pc.cartel.style.transform = `translate3d(0,${((1 - f) * 14).toFixed(1)}px,0)`;
    pc.cartel.style.visibility = c ? "visible" : "hidden";
  });
  if (best !== lastNow) { lastNow = best; $("#g-now").textContent = String(best + 1).padStart(2, "0"); }
  bar.style.transform = `scaleX(${p.toFixed(4)})`;
}
const bar = $("#g-bar");
let ticking = false;
addEventListener("scroll", () => {
  if (ticking || views.room.hidden) return;
  ticking = true;
  requestAnimationFrame(() => { ticking = false; roomFrame(); });
}, { passive: true });
let rz;
addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(measure, 120); });
wall.addEventListener("load", () => { clearTimeout(rz); rz = setTimeout(measure, 60); }, true);

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

// ---------------------------------------------------------------
// Moving between the hall, the two rooms and the agenda
// ---------------------------------------------------------------
const views = { hall: $("#hall"), room: $("#room"), collection: $("#collection"), expositions: $("#expositions") };
const veil = $("#veil");
const hall = $("#hall");
const scene = $("#hall-scene");
let moving = false;

// Start downloading a room's first paintings as soon as a door is approached
const warmed = new Set();
function warm(salle) {
  if (warmed.has(salle)) return;
  warmed.add(salle);
  WORKS.filter((w) => w.salle === salle).slice(0, 3).forEach((w) => { const i = new Image(); i.src = img(w, 1000); });
}
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

// The hall leans towards whichever door you are about to pick
$$(".portal").forEach((p) => {
  const k = p.classList.contains("portal--noire") ? "noire" : "blanche";
  p.addEventListener("pointerenter", () => { hall.dataset.lean = k; warm(k); });
  p.addEventListener("touchstart", () => warm(k), { passive: true });
  p.addEventListener("pointerleave", () => { delete hall.dataset.lean; });
});

function show(where, push = true, door) {
  const salle = where === "noire" || where === "blanche" ? where : null;
  const go = () => {
    views.hall.hidden = where !== "hall";
    views.room.hidden = !salle;
    views.collection.hidden = where !== "collection";
    views.expositions.hidden = where !== "expositions";
    document.body.dataset.salle = salle || where;
    if (salle) {
      const r = ROOMS[salle];
      $("#room-eyebrow").textContent = r.eyebrow;
      $("#room-title").textContent = r.title;
      $("#room-intro").textContent = r.intro;
      hang(salle);
    }
    if (where === "collection") renderCollection();
    $$(".top__nav a, .menu__item").forEach((a) => a.toggleAttribute("aria-current", a.dataset.go === where));
    topBar.classList.remove("tucked");
    placeInk();
    $("meta[name=theme-color]").content = where === "blanche" ? "#f4f0e9" : "#131110";
    scrollTo(0, 0);
    state.salle = where;
    if (salle) requestAnimationFrame(measure);
  };
  if (push) history.pushState(null, "", where === "hall" ? "/musee" : `#${where}`);
  if (reduceMotion || state.salle === where || moving) return go();
  moving = true;
  veil.className = `veil veil--${salle === "blanche" ? "blanche" : "noire"}`;

  // Walking through a door: it swings open and the hall rushes towards it
  if (door && salle && state.salle === "hall") {
    const r = door.getBoundingClientRect();
    const s = scene.getBoundingClientRect();
    scene.style.transformOrigin = `${r.left + r.width / 2 - s.left}px ${r.top + r.height * 0.55 - s.top}px`;
    hall.dataset.lean = salle;
    door.classList.add("is-open");
    requestAnimationFrame(() => {
      scene.classList.add("zoom");
      hall.classList.add("leaving");
    });
    setTimeout(() => veil.classList.add("on"), 620);
    setTimeout(() => {
      go();
      // put the hall back quietly for the next visit
      scene.style.transition = "none";
      scene.classList.remove("zoom");
      hall.classList.remove("leaving");
      door.classList.remove("is-open");
      delete hall.dataset.lean;
      void scene.offsetWidth;
      scene.style.transition = "";
      requestAnimationFrame(() => { veil.classList.remove("on"); moving = false; });
    }, 1150);
    return;
  }
  // Anywhere else: a soft fade through the colour of the next room
  veil.classList.add("on");
  setTimeout(() => {
    go();
    requestAnimationFrame(() => { veil.classList.remove("on"); moving = false; });
  }, 480);
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-go]");
  if (!a) return;
  e.preventDefault();
  if (menuOpen()) { toggleMenu(false); setTimeout(() => show(a.dataset.go, true), 380); return; }
  const door = a.dataset.door ? $(`.door--${a.dataset.door}`) : null;
  show(a.dataset.go, true, door);
});
// ---------------------------------------------------------------
// Top bar: a brush swash under the current room, a gold hairline for
// how far down you are, and a bar that steps aside while you walk.
// ---------------------------------------------------------------
const topBar = $("#top");
const nav = $("#top-nav");
const ink = $("#top-ink");
function placeInk(a = $(".top__nav a[aria-current]")) {
  if (!a || !a.offsetWidth) return ink.classList.remove("on");
  const pad = 6;
  ink.style.transform = `translateX(${a.offsetLeft - pad}px) scaleX(${((a.offsetWidth + pad * 2) / 100).toFixed(3)})`;
  ink.classList.add("on");
}
$$(".top__nav a").forEach((a) => a.addEventListener("pointerenter", () => placeInk(a)));
nav.addEventListener("pointerleave", () => placeInk());
const topHeight = () => document.documentElement.style.setProperty("--top-h", `${topBar.offsetHeight}px`);
topHeight();
document.fonts && document.fonts.ready.then(() => { placeInk(); topHeight(); });
addEventListener("resize", () => { placeInk(); topHeight(); });

const progress = $("#top-progress");
let lastY = scrollY, topTick = false;
addEventListener("scroll", () => {
  if (topTick) return;
  topTick = true;
  requestAnimationFrame(() => {
    topTick = false;
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? (y / max).toFixed(4) : 0})`;
    if (!menuOpen() && Math.abs(y - lastY) > 6) {
      topBar.classList.toggle("tucked", y > lastY && y > 140);
      lastY = y;
    }
  });
}, { passive: true });
topBar.addEventListener("focusin", () => topBar.classList.remove("tucked"));

// Full-screen menu on phones
const burger = $("#burger");
const menu = $("#menu");
const menuOpen = () => document.documentElement.classList.contains("menu-open");
function toggleMenu(open = !menuOpen()) {
  document.documentElement.classList.toggle("menu-open", open);
  document.documentElement.classList.toggle("locked", open || $$("dialog").some((d) => d.open));
  burger.setAttribute("aria-expanded", open);
  burger.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
  menu.setAttribute("aria-hidden", !open);
  if (open) topBar.classList.remove("tucked");
}
burger.addEventListener("click", () => toggleMenu());
addEventListener("keydown", (e) => { if (e.key === "Escape" && menuOpen()) toggleMenu(false); });
matchMedia("(min-width: 721px)").addEventListener("change", (m) => { if (m.matches && menuOpen()) toggleMenu(false); });
{
  const pick = (s, n) => WORKS.filter((w) => !s || w.salle === s)[n];
  const thumbs = { noire: pick("noire", 0), blanche: pick("blanche", 0), collection: pick("blanche", 3), expositions: pick("noire", 6) };
  $$("[data-thumb]").forEach((el) => {
    const w = thumbs[el.dataset.thumb];
    if (w) el.innerHTML = `<img src="${img(w, 480)}" alt="" loading="lazy" decoding="async">`;
  });
}

const VIEWS = ["noire", "blanche", "collection", "expositions"];
const fromHash = () => {
  const h = location.hash.slice(1);
  if (h.startsWith("oeuvre-")) { const w = WORKS.find((x) => x.file === h.slice(7)); return w ? w.salle : "hall"; }
  return VIEWS.includes(h) ? h : "hall";
};
addEventListener("popstate", () => {
  const h = location.hash;
  if (h.startsWith("#oeuvre-") && WORKS.some((w) => w.file === h.slice(8))) {
    if (fromHash() !== state.salle) show(fromHash(), false);
    return openWork(h.slice(8));
  }
  if (viewer.open) viewer.close();
  show(fromHash(), false);
});

// ---------------------------------------------------------------
// Collection: every work, filter by room, sort by likes
// ---------------------------------------------------------------
const coll = { filter: "toutes", sort: "ordre" };
$("#coll-count").textContent = WORKS.length;
function renderCollection() {
  let list = WORKS.filter((w) => coll.filter === "toutes" || w.salle === coll.filter);
  if (coll.sort === "aimees") list = list.slice().sort((a, b) => (state.likes[b.file] || 0) - (state.likes[a.file] || 0));
  $("#catalogue").innerHTML = list.map((w, i) => `
    <button class="card" type="button" data-view="${w.file}" style="--i:${i}" aria-label="Voir ${w.title}">
      <span class="card__img"><img src="${img(w, 480)}" width="${w.w}" height="${w.h}" alt="${alt(w)}" loading="lazy" decoding="async"></span>
      <span class="card__meta"><strong>${w.title}</strong><span class="card__badge">${state.likes[w.file] ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>${state.likes[w.file]} · ` : ""}${ROOMS[w.salle].eyebrow}</span></span>
    </button>`).join("");
}
$$("[data-filter]").forEach((b) => b.addEventListener("click", () => {
  coll.filter = b.dataset.filter;
  $$("[data-filter]").forEach((x) => x.setAttribute("aria-pressed", x === b));
  renderCollection();
}));
$("[data-sort]").addEventListener("click", (e) => {
  const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
  e.currentTarget.setAttribute("aria-pressed", on);
  coll.sort = on ? "aimees" : "ordre";
  renderCollection();
});

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
    if (state.salle === "collection") renderCollection();
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
  const r = current.w / current.h;
  const format = r > 1.08 ? "Paysage" : r < 0.92 ? "Portrait" : "Carré";
  $("#v-facts").innerHTML = [
    ["Technique", "Acrylique sur toile"], ["Format", format], ["Salle", ROOMS[current.salle].eyebrow],
    ["Authenticité", "Œuvre originale, signée"], ["Disponibilité", "Sur demande"],
  ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
  const same = WORKS.filter((w) => w.salle === current.salle && w.file !== current.file);
  const start = Math.max(0, same.findIndex((w) => w.file > current.file));
  $("#v-more").innerHTML = [...same.slice(start), ...same.slice(0, start)].slice(0, 4)
    .map((w) => `<button type="button" data-view="${w.file}" aria-label="Voir ${w.title}"><img src="${img(w, 480)}" alt="" loading="lazy"></button>`).join("");
  history.replaceState(null, "", `#oeuvre-${current.file}`);
  paintViewerLike();
  paintGate();
  $(".viewer__side").scrollTop = 0;
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
// share a link that opens straight on this work
$("#v-share").addEventListener("click", async () => {
  const url = `${location.origin}/musee#oeuvre-${current.file}`;
  const data = { title: `${current.title} · Syssi Demnati`, text: "Une œuvre de Syssi Demnati, acrylique sur toile", url };
  try {
    if (navigator.share) await navigator.share(data);
    else { await navigator.clipboard.writeText(url); toast("Lien copié."); }
  } catch {}
});
viewer.addEventListener("close", () => {
  history.replaceState(null, "", state.salle === "hall" ? "/musee" : `#${state.salle}`);
});
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
const place = (x) => `${esc(x.lieu)}${x.ville ? `, ${esc(x.ville)}` : ""}`;
const li = (x) => `<li><span class="expo-list__date">${esc(x.dates || x.annee)}</span><span class="expo-list__place">${x.titre ? `<em>${esc(x.titre)}</em> · ` : ""}${place(x)}</span></li>`;
const next = expos.filter((x) => x.quand === "avenir");
$("#expo-next").innerHTML = next.map(li).join("");
$("#expo-next-wrap").hidden = !next.length;
$("#expo-past").innerHTML = expos.filter((x) => x.quand !== "avenir").map((x, i) => `
  <li class="timeline__item" style="--i:${i}">
    <span class="timeline__year">${esc(x.annee)}</span>
    <div class="timeline__body">
      ${x.titre ? `<h4>${esc(x.titre)}</h4>` : ""}
      <p class="timeline__place">${place(x)}</p>
      ${x.dates || x.type ? `<p class="timeline__meta">${[x.dates, x.type].filter(Boolean).map(esc).join(" · ")}</p>` : ""}
    </div>
  </li>`).join("");

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
const startHash = location.hash;
show(fromHash(), false);
if (startHash.startsWith("#oeuvre-") && WORKS.some((w) => w.file === startHash.slice(8))) openWork(startHash.slice(8));
(async () => {
  try { await store.init(); } catch { toast("Mode hors ligne : les j’aime et les avis sont indisponibles."); }
  const [likes, mine, stats] = await Promise.all([
    store.likeCounts().catch(() => ({})), store.myLikes().catch(() => new Set()), store.reviewStats().catch(() => ({})),
  ]);
  Object.assign(state, { likes, mine, stats });
  paintCounts();
  if (state.salle === "collection") renderCollection();
  paintAccount();
})();

// ---------------------------------------------------------------
// Living background: brush strokes in her palette paint themselves
// across the walls, then fade. A few at a time, paused when hidden.
// ---------------------------------------------------------------
(function paintLoop() {
  const LAYERS = [
    { el: document.getElementById("paint"), max: innerWidth < 700 ? 3 : 6, visible: () => true },
  ];
  const COLORS = ["#c9a25e", "#c8644a", "#6b4766", "#6f9a8d", "#b9607a", "#3b5ea8", "#e0b43c", "#2f7d5b"];
  const rnd = (a, b) => a + Math.random() * (b - a);
  // Each stroke is tinted once into its own small canvas, so the browser
  // only slides and fades a finished picture instead of re-masking it every frame.
  const SHAPES = [1, 2, 3].map((n) => {
    const im = new Image();
    im.decoding = "async";
    im.src = `/assets/brush/stroke-${n}.webp`;
    return im;
  });
  const dpr = Math.min(devicePixelRatio || 1, 2);
  function ink(shape, color, cssW) {
    const c = document.createElement("canvas");
    c.className = "stroke__ink";
    c.width = Math.min(1200, Math.round(cssW * dpr));
    c.height = Math.round(c.width / 5);
    const g = c.getContext("2d");
    g.drawImage(shape, 0, 0, c.width, c.height);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }
  function stroke(layer, life) {
    const shape = SHAPES[(Math.random() * SHAPES.length) | 0];
    if (!shape.complete || !shape.naturalWidth) return;
    const w = rnd(28, innerWidth < 700 ? 90 : 55);
    const s = document.createElement("span");
    s.className = "stroke";
    const st = s.style;
    st.setProperty("--x", `${rnd(5, 95).toFixed(1)}%`);
    st.setProperty("--y", `${rnd(8, 92).toFixed(1)}%`);
    st.setProperty("--w", `${w.toFixed(1)}vw`);
    st.setProperty("--rot", `${rnd(-28, 28).toFixed(1)}deg`);
    st.setProperty("--flip", Math.random() < 0.5 ? -1 : 1);
    st.setProperty("--life", `${life.toFixed(1)}s`);
    const win = document.createElement("span");
    win.className = "stroke__win";
    win.appendChild(ink(shape, COLORS[(Math.random() * COLORS.length) | 0], (w / 100) * innerWidth));
    s.appendChild(win);
    layer.appendChild(s);
    s.addEventListener("animationend", (e) => { if (e.target === s) s.remove(); });
  }
  if (reduceMotion) {
    Promise.all(SHAPES.map((im) => im.decode().catch(() => {}))).then(() => LAYERS.forEach((l) => { for (let i = 0; i < 3; i++) stroke(l.el, 1); }));
    return;
  }
  const first = () => LAYERS.forEach((l) => { for (let i = 0; i < 2; i++) setTimeout(() => stroke(l.el, rnd(9, 13)), i * 600); });
  Promise.all(SHAPES.map((im) => im.decode().catch(() => {}))).then(first);
  setInterval(() => {
    if (document.hidden) return;
    LAYERS.forEach((l) => {
      if (l.visible() && l.el.childElementCount < l.max && Math.random() < 0.6) stroke(l.el, rnd(9, 14));
    });
  }, 1500);
})();
