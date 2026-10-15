# Syssi Demnati · link page

A static, Linktree-style page for the artist Syssi Demnati: profile card with signature, links to Instagram, TikTok and Snapchat, a commissions link (opens an Instagram DM), and a gallery of 8 works with a full-screen viewer.

No build step. Plain HTML, CSS and JS.

```
index.html        page
styles.css        design (cream canvas, ink black, frame gold; dark mode included)
script.js         gallery list + viewer. Edit WORKS here to rename or add paintings
vercel.json       clean URLs + image caching
assets/works/     paintings, NN-480.webp (grid) and NN-1000.webp (viewer)
assets/           avatar, signature, favicon, og.jpg (link preview image)
```

## Deploy on Vercel

Option A (GitHub): push this folder to a new repo, then on vercel.com choose **Add New → Project**, import the repo, keep Framework Preset **Other**, and click Deploy.

Option B (CLI, no GitHub): from this folder run `npx vercel` and accept the defaults, then `npx vercel --prod`.

Live at https://syssi-demnati.vercel.app/ — every push to `main` redeploys. If the domain changes, update the `og:image`, `og:url` and canonical URLs in `index.html`.

## Adding a painting

1. Export two WebP files into `assets/works/`: `09-480.webp` (480px wide) and `09-1000.webp` (up to 1000px wide).
2. Add `{ file: "09", title: "Your title" }` to `WORKS` in `script.js`.

## Musée en ligne (`/musee`)

Two rooms: the Salle Noire (dark canvases) and the Salle Blanche (light canvases). Each work's room is the `salle` field in `assets/works.js`; exhibitions live in `assets/expositions.js`.

Visitors can like works (no account), sign in with their email (a one-time link), post reviews, and choose to be emailed about new works and exhibitions.

Until Supabase is connected the museum runs in preview mode: likes, reviews and sign-in are stored in the visitor's own browser only.

### Going live
1. Create a free project at supabase.com. In SQL Editor, run `supabase/schema.sql`.
2. In Supabase > Authentication > URL Configuration, set the Site URL to `https://syssi-demnati.vercel.app/musee`.
3. Put the project URL and the anon public key in `musee/config.js`.
4. To send announcements: create a free account at resend.com and verify a sending domain. Then in Vercel > Settings > Environment Variables add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `MAIL_FROM` and `ADMIN_KEY`, and redeploy.
5. Announcements are sent from `/musee/admin` with the `ADMIN_KEY`.
