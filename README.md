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
