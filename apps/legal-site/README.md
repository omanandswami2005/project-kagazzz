# Kagaz legal site (public Privacy Policy + Terms)

A **zero-dependency static site** that renders the app's canonical legal
documents (`docs/legal/*.md`) into public HTML pages for the store listing and
in-app links (launch gate **G1-5**). Host it on Vercel, Cloudflare Pages,
GitHub Pages, or any static host.

## Build

```bash
node apps/legal-site/build.mjs
# → apps/legal-site/dist/{index,privacy,terms}.html
```

Source of truth is `docs/legal/*.md`; the build re-syncs the bundled copies in
`content/` from there when run inside the repo, so hosting either the repo or
just this folder ships current text.

## Deploy to Vercel

1. **New Project → Import** this Git repo.
2. Set **Root Directory** = `apps/legal-site`.
3. Framework preset = **Other**. Build settings come from `vercel.json`
   (`buildCommand: node build.mjs`, `outputDirectory: dist`).
4. Deploy. You get URLs like:
   - `https://<project>.vercel.app/privacy`
   - `https://<project>.vercel.app/terms`

Put those two URLs in the Play Console **Data safety** form and the store
listing, and (optionally) point the in-app About links at them.

> Cloudflare Pages / GitHub Pages work the same way — build command
> `node build.mjs`, output directory `dist`.

## ⚠️ Before you publish — finalize the legal text

The current `docs/legal/*.md` are **drafts with placeholders and V2/V3 scope**.
`build.mjs` prints every placeholder it finds; today that is:

- `Omni Docs Pvt Ltd` → your real registered entity name
- `legal@omnidocs.example` → your real grievance-officer / contact email
- "replace before launch" / "consult Indian legal counsel" notes
- The drafts describe **DigiLocker import, cloud backup to servers, share
  links, eSign** — these are **V2/V3, not in V1**. A V1 policy must describe
  what V1 actually does (100% on-device, no data collected/shared) or it will
  not match the Play **Data safety** declaration.

Fix `docs/legal/*.md`, rebuild, and only then publish. This is a
legal/content decision — get Indian counsel to review before going live.
