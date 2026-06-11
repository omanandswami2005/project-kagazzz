# core/i18n

i18n setup (P0-8). Spec: [12-i18n-multilingual.md](../../../../../docs/architecture/12-i18n-multilingual.md).

| File | Purpose |
|---|---|
| `config.ts` | `initI18n()` — react-i18next + localStorage/navigator detector + lazy JSON backend; en + hi (V1) |
| `types.ts` | i18next module augmentation — English files are the key schema, `t()` is typed |
| `utils.ts` | Intl-based formatters (`toFormattingLocale` maps `en` → `en-IN` for Indian digit grouping) |
| `hooks/useLocale.ts` | Active locale + `dir` + pre-bound formatters |
| `locales/{en,hi}/*.json` | 8 namespaces (§4); `sharing`/`csc-services` are `{}` placeholders until V2/V3 |

Rules: all UI strings externalized (F-17); en ↔ hi key parity is CI-enforced (`locale-parity.test.ts`); use CSS logical properties everywhere (RTL-ready for Urdu in V3, §6); dates/numbers/currency only via the Intl helpers.
