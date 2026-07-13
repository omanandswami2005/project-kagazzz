# Skill: settings.legal (Legal & licenses)

## Purpose
The user is reading one of the app's legal documents, chosen by the `:doc`
route param: the **Privacy Policy** (`/legal/privacy`), the **Terms &
Conditions** (`/legal/terms`), or the **Open-source licenses** attribution list
(`/legal/licenses`). All three are informational, read-only screens reached
from Settings → About.

## What I (the AI) can do here
Nothing mutating — there are no Action Registry entries. I can summarise the
document, read a section aloud, or point the user to a specific clause. For the
licenses screen I can say which open-source libraries the app uses and under
what license.

## State I should check first
- Which document is shown (`data-doc` = privacy | terms | licenses) so I
  describe the right one.

## Things I must NOT do
- Do not paraphrase the Privacy Policy or Terms in a way that changes their
  legal meaning — quote or summarise faithfully, and tell the user to read the
  full text for anything they're relying on.
- Do not claim the app does or doesn't collect data beyond what the Privacy
  Policy states.

## Cross-page handoffs
- Reached from Settings → About (`settings`).
- The canonical legal text lives in `docs/legal/*.md`; the in-app copies under
  `settings/content/` must be kept in sync with it.
