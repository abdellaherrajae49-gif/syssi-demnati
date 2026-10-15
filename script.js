// Edit this list to add, remove or rename works. Files live in assets/works/.
// Each work has a small file (-480) for the grid and a large one (-1000) for the viewer.
const WORKS = [
  { file: "01", title: "N° 01" },
  { file: "02", title: "N° 02" },
  { file: "03", title: "N° 03" },
  { file: "04", title: "N° 04" },
  { file: "05", title: "N° 05" },
  { file: "06", title: "N° 06" },
  { file: "07", title: "N° 07" },
  { file: "08", title: "N° 08" },
];

const small = (w) => `assets/works/${w.file}-480.webp`;
const large = (w) => `assets/works/${w.file}-1000.webp`;
const alt = (w) => `${w.title}, peinture abstraite de Syssi Demnati`;

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(pointer: fine)").matches;
const root = document.documentElement;

// ---------------------------------------------------------------
// Gallery: tiles spread over 2 or 3 columns that drift at different
// speeds while scrolling (parallax)
// ---------------------------------------------------------------
const grid = document.getElementById("grid");
const tiles = WORKS.map((w, i) => {
  const b = document.createElement("button");
  b.className = "tile";
  b.type = "button";
  b.dataset.open = i;
  b.setAttribute("aria-label", `Ouvrir ${w.title}`);
  b.innerHTML = `<img src="${small(w)}" alt="${alt(w)}" loading="lazy" decoding="async"><span class="tile__no">${w.title}</span>`;
  return b;
});

let cols = [];
let colCount = 0;
const COL_SPEED = [0.06, -0.05, 0.1];
function layout() {
  const n = window.innerWidth >= 760 ? 3 : 2;
  if (n === colCount) return;
  colCount = n;
  grid.innerHTML = "";
  cols = Array.from({ length: n }, () => {
    const c = document.createElement("div");
    c.className = "col";
    grid.appendChild(c);
    return c;
  });
  tiles.forEach((t, i) => cols[i % n].appendChild(t));
}
layout();

// ---------------------------------------------------------------
// Reveal things as they scroll into view
// ---------------------------------------------------------------
document.querySelectorAll(".split").forEach((el) => {
  el.innerHTML = [...el.textContent]
    .map((c, i) => (c === " " ? " " : `<span class="ch" style="--i:${i}">${c}</span>`))
    .join("");
});

const io = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -10% 0px" })
  : null;
document.querySelectorAll(".tile, .split, .reveal-on-scroll").forEach((el) => {
  io ? io.observe(el) : el.classList.add("in");
});

// ---------------------------------------------------------------
// One animation loop for everything scroll-driven:
// backdrop parallax, progress bar, gallery columns, marquee speed
// ---------------------------------------------------------------
const marqueeRows = [...document.querySelectorAll(".marquee__row")].map((row) => {
  const track = row.querySelector(".marquee__track");
  // repeat the text so the band never runs out
  for (let i = 0; i < 3; i++) row.appendChild(track.cloneNode(true));
  return { row, tracks: [...row.children], dir: Number(row.dataset.dir), x: 0, w: 0 };
});
const measureMarquee = () => marqueeRows.forEach((m) => (m.w = m.tracks[0].offsetWidth));
measureMarquee();
document.fonts && document.fonts.ready.then(measureMarquee);

// Cache positions so the loop never has to measure the page while scrolling
const aurora = document.querySelector(".aurora");
const ink = document.querySelector(".ink");
const cardArt = document.querySelector(".card__art-img");
const progress = document.querySelector(".progress");
const marquee = document.querySelector(".marquee");
let gridTop = 0, maxScroll = 1, vh = window.innerHeight;
function measure() {
  vh = window.innerHeight;
  gridTop = grid.getBoundingClientRect().top + window.scrollY;
  maxScroll = Math.max(1, document.documentElement.scrollHeight - vh);
  measureMarquee();
}
measure();
window.addEventListener("load", measure);
if ("ResizeObserver" in window) new ResizeObserver(measure).observe(document.body);
window.addEventListener("resize", () => { layout(); measure(); });

// The marquee only animates while it is on screen
let marqueeVisible = true;
if (io) new IntersectionObserver(([e]) => { marqueeVisible = e.isIntersecting; }).observe(marquee);

let lastY = -1;
let velocity = 0;
function frame() {
  const y = window.scrollY;
  const moved = y !== lastY;
  velocity = velocity * 0.9 + (lastY < 0 ? 0 : y - lastY) * 0.1;

  if (moved) {
    progress.style.transform = `scaleX(${(y / maxScroll).toFixed(4)})`;
    if (!reduceMotion) {
      aurora.style.transform = `translate3d(0, ${(-y * 0.12).toFixed(1)}px, 0)`;
      ink.style.transform = `translate3d(0, ${(-y * 0.25).toFixed(1)}px, 0)`;
      if (y < vh * 1.2) cardArt.style.transform = `translate3d(0, ${(y * 0.18).toFixed(1)}px, 0) scale(1.1)`;
      const offset = vh - (gridTop - y);
      if (offset > -200) {
        cols.forEach((c, i) => {
          c.style.transform = `translate3d(0, ${(offset * COL_SPEED[i]).toFixed(1)}px, 0)`;
        });
      }
    }
    lastY = y;
  }

  if (!reduceMotion && marqueeVisible) {
    marqueeRows.forEach((m) => {
      const w = m.w;
      if (!w) return;
      m.x += m.dir * (0.6 + Math.min(Math.abs(velocity) * 0.4, 14));
      if (m.x <= -w) m.x += w;
      if (m.x > 0) m.x -= w;
      const t = `translate3d(${m.x.toFixed(1)}px,0,0)`;
      m.tracks.forEach((el) => (el.style.transform = t));
    });
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------
// Pointer effects (desktop): cursor glow, 3D tilt + glare on artworks
// ---------------------------------------------------------------
if (finePointer && !reduceMotion) {
  const glow = document.querySelector(".glow");
  let gx = -999, gy = -999, glowQueued = false;
  window.addEventListener("pointermove", (e) => {
    gx = e.clientX; gy = e.clientY;
    if (glowQueued) return;
    glowQueued = true;
    requestAnimationFrame(() => {
      glowQueued = false;
      document.body.classList.add("pointer");
      glow.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
    });
  }, { passive: true });

  document.addEventListener("pointermove", (e) => {
    const el = e.target.closest(".tile, .tilt");
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--ry", `${((px - 0.5) * 10).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${((0.5 - py) * 10).toFixed(2)}deg`);
    el.style.setProperty("--gx", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--gy", `${(py * 100).toFixed(1)}%`);
  }, { passive: true });
  document.addEventListener("pointerout", (e) => {
    const el = e.target.closest(".tile, .tilt");
    if (el && !el.contains(e.relatedTarget)) {
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    }
  });
}

// Ripple on tap, clipped to the brush stroke
document.querySelectorAll(".link").forEach((a) => {
  a.addEventListener("pointerdown", (e) => {
    const paints = a.querySelectorAll(".paint");
    const paint = paints[paints.length - 1];
    const r = paint.getBoundingClientRect();
    const s = document.createElement("span");
    s.className = "ripple";
    s.style.left = `${e.clientX - r.left}px`;
    s.style.top = `${e.clientY - r.top}px`;
    paint.appendChild(s);
    setTimeout(() => s.remove(), 700);
  });
});

// ---------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------
const lb = document.getElementById("lightbox");
const lbImg = document.getElementById("lb-img");
const lbCap = document.getElementById("lb-cap");
let current = 0;

function show(i, dir = 0) {
  current = (i + WORKS.length) % WORKS.length;
  const w = WORKS[current];
  lbImg.classList.remove("swap");
  void lbImg.offsetWidth; // restart the animation
  lbImg.style.setProperty("--dir", dir);
  lbImg.src = large(w);
  lbImg.alt = alt(w);
  lbImg.classList.add("swap");
  lbCap.textContent = `${w.title}  ·  ${current + 1} / ${WORKS.length}`;
  // Preload neighbours so swiping feels instant
  [current + 1, current - 1].forEach((n) => { new Image().src = large(WORKS[(n + WORKS.length) % WORKS.length]); });
}
function open(i) {
  show(i);
  if (typeof lb.showModal === "function") lb.showModal(); else lb.setAttribute("open", "");
  document.body.style.overflow = "hidden";
}
function close() {
  lb.close ? lb.close() : lb.removeAttribute("open");
}
lb.addEventListener("close", () => { document.body.style.overflow = ""; });

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-open]");
  if (t) open(Number(t.dataset.open));
});
lb.querySelector(".lb-close").addEventListener("click", close);
lb.querySelector(".lb-prev").addEventListener("click", () => show(current - 1, -1));
lb.querySelector(".lb-next").addEventListener("click", () => show(current + 1, 1));
lb.addEventListener("click", (e) => { if (e.target === lb || e.target.tagName === "FIGURE") close(); });
document.addEventListener("keydown", (e) => {
  if (!lb.open) return;
  if (e.key === "ArrowRight") show(current + 1, 1);
  if (e.key === "ArrowLeft") show(current - 1, -1);
});

// Swipe on touch screens
let x0 = null;
lb.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
lb.addEventListener("touchend", (e) => {
  if (x0 === null) return;
  const dx = e.changedTouches[0].clientX - x0;
  if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  x0 = null;
});

document.getElementById("year").textContent = new Date().getFullYear();
