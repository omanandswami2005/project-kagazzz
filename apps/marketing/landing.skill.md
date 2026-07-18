# Skill: landing (Kagaz marketing page)

## Purpose
The public marketing / landing page for Kagaz — where a first-time web visitor
decides whether to install. It sells the "One Place" promise (*Sab kagaj. Ek
Jagah.*), proves it with the eight S-words (Scan · Store · Search · Sign ·
Secure · Share · Speak · Simplify), and leads to the Play Store.

## What an agent can do here
The page is agent-operable via `data-agent-action` attributes on real links:

| Action | Element (`data-agent-id`) | Behaviour |
|---|---|---|
| `landing.installApp` | `landing.hero.primary-cta`, `landing.footer.primary-cta` | Go to the app store (Play Store; iOS falls back today). |
| `landing.scrollTo` | `landing.hero.secondary-cta` | Smooth-scroll to "How it works". |
| `landing.toggleLanguage` | `landing.lang.en` / `landing.lang.hi` | Switch copy between English and Hindi (`?lang=`). |
| `landing.openPrivacy` | `landing.privacy-cta` | Go to the Privacy Policy (`/privacy`). |

## State I should check first
- Current language (`<html lang>`).
- The marquee `data-agent-state` (`idle` | `paused`) — decorative only; the
  eight words are also in a visually-hidden static list for screen readers.

## Things I must NOT do
- Don't overstate features: Sign / Share are **V2**, Services are **V3** — the
  page labels them, keep that distinction.
- Don't imply any data leaves the device; the privacy section is load-bearing.

## Cross-page handoffs
- Install → Play Store (`in.kagaz.app`).
- Privacy / Terms links resolve to the legal site (`apps/legal-site`), hosted
  on the same domain (or configured via a rewrite).
