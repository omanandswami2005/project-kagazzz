# Bundled legal content (G1-5)

`privacy-policy.md` and `terms-and-conditions.md` here are **byte copies** of
the canonical documents in `docs/legal/`, bundled into the app (`?raw`) so the
in-app Privacy Policy / Terms screens work fully offline.

**Keep them in sync.** When the canonical `docs/legal/*.md` change, recopy:

```bash
cp docs/legal/privacy-policy.md      apps/kagaz/src/modules/settings/content/
cp docs/legal/terms-and-conditions.md apps/kagaz/src/modules/settings/content/
```

`third-party-licenses.json` is generated — do not edit by hand:

```bash
pnpm --filter kagaz gen:licenses
```
