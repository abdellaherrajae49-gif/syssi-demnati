// Emails every subscriber about a new work or a new exhibition.
// Called from /musee/admin. Needs these environment variables in Vercel:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (Supabase > Project settings > API)
//   RESEND_API_KEY, MAIL_FROM                 (resend.com, e.g. "Syssi Demnati <musee@votre-domaine.com>")
//   ADMIN_KEY                                 (any long secret you choose, typed in the admin page)
const SITE = "https://syssi-demnati.vercel.app";

const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function email({ titre, message, lien, image }) {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f0e9;font-family:Georgia,serif;color:#1d1a17">
  <div style="max-width:560px;margin:0 auto;padding:36px 24px">
    <p style="font:600 11px/1 Arial,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#9a7432;margin:0 0 14px">Musée Syssi Demnati</p>
    <h1 style="font-weight:400;font-size:30px;line-height:1.15;margin:0 0 16px">${esc(titre)}</h1>
    ${image ? `<img src="${esc(image)}" alt="" style="display:block;width:100%;height:auto;margin:0 0 18px">` : ""}
    <p style="font:16px/1.6 Arial,sans-serif;margin:0 0 24px">${esc(message).replace(/\n/g, "<br>")}</p>
    <a href="${esc(lien)}" style="display:inline-block;padding:13px 24px;border-radius:999px;background:#1d1a17;color:#f4f0e9;text-decoration:none;font:700 14px Arial,sans-serif">Voir au musée</a>
    <p style="font:12px/1.5 Arial,sans-serif;color:#7a7268;margin:34px 0 0">Vous recevez cet e-mail car vous vous êtes inscrit(e) au musée en ligne de Syssi Demnati.
    Pour ne plus le recevoir, connectez-vous sur <a href="${SITE}/musee" style="color:#7a7268">${SITE.replace("https://", "")}/musee</a> et décochez les alertes dans « Mon compte ».</p>
  </div></body></html>`;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST uniquement" });
  const { ADMIN_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, MAIL_FROM } = process.env;
  if (!ADMIN_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY || !MAIL_FROM) {
    return res.status(500).json({ error: "Variables d’environnement manquantes dans Vercel." });
  }
  if (req.headers.authorization !== `Bearer ${ADMIN_KEY}`) return res.status(401).json({ error: "Clé incorrecte." });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const type = body.type === "exposition" ? "exposition" : "oeuvre";
  const titre = String(body.titre || "").slice(0, 120);
  const message = String(body.message || "").slice(0, 2000);
  if (!titre || !message) return res.status(400).json({ error: "Titre et message obligatoires." });
  const lien = body.lien && /^https:\/\//.test(body.lien) ? body.lien : `${SITE}/musee${type === "exposition" ? "#expositions" : ""}`;
  const image = body.image && /^https:\/\//.test(body.image) ? body.image : "";

  const column = type === "exposition" ? "expos" : "works";
  const r = await fetch(`${SUPABASE_URL}/rest/v1/subscribers?select=email&${column}=eq.true`, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!r.ok) return res.status(502).json({ error: "Lecture des abonnés impossible." });
  const emails = [...new Set((await r.json()).map((s) => s.email).filter(Boolean))];

  if (body.test) {
    return res.status(200).json({ envoyes: 0, abonnes: emails.length, apercu: true });
  }

  const html = email({ titre, message, lien, image });
  let sent = 0;
  // Resend accepts up to 100 emails per batch call; each subscriber gets their own email
  for (let i = 0; i < emails.length; i += 100) {
    const batch = emails.slice(i, i + 100).map((to) => ({ from: MAIL_FROM, to: [to], subject: titre, html }));
    const s = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });
    if (!s.ok) return res.status(502).json({ error: `Envoi interrompu après ${sent} e-mails.`, envoyes: sent });
    sent += batch.length;
  }
  res.status(200).json({ envoyes: sent, abonnes: emails.length });
};
