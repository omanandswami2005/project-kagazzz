# Kagaz — Interaction Patterns

> The reusable interaction recipes every feature should use. These exist so that two engineers building two screens make the *same* small choices, so the app feels coherent.

---

## Table of contents

- [Gesture vocabulary](#gesture-vocabulary)
- [Primary action: the FAB rule](#primary-action-the-fab-rule)
- [Bottom sheets vs modals vs drawers](#bottom-sheets-vs-modals-vs-drawers)
- [Confirmation, Undo, and destructive actions](#confirmation-undo-and-destructive-actions)
- [Swipe actions on list items](#swipe-actions-on-list-items)
- [Selection mode (multi-select)](#selection-mode-multi-select)
- [Pull-to-refresh and infinite scroll](#pull-to-refresh-and-infinite-scroll)
- [Search and filter](#search-and-filter)
- [Loading, empty, error states](#loading-empty-error-states)
- [Density modes](#density-modes)
- [Low-literacy patterns](#low-literacy-patterns)
- [Voice-first patterns](#voice-first-patterns)
- [Onboarding and progressive disclosure](#onboarding-and-progressive-disclosure)
- [Toast hierarchy](#toast-hierarchy)

---

## Gesture vocabulary

A fixed, small set. New gestures require an RFC.

| Gesture | Action | Notes |
|---|---|---|
| **Tap** | Activate / open | Primary interaction. |
| **Long-press (500ms)** | Enter selection mode on lists | Also exposes "Select" menu item for keyboard/SR users. |
| **Swipe right ←→ on list item** | Reveals contextual actions (max 2) | Right swipe = positive (share); left swipe = destructive (delete). |
| **Swipe down on sheet** | Dismiss bottom sheet | Standard iOS/Android idiom. |
| **Swipe left/right on PDF page** | Next/previous page | Inside the document viewer only. |
| **Pinch** | Zoom in PDF/image viewer | Min 1×, max 5×. |
| **Pull down** | Refresh list | Standard idiom; only on read-only lists. |
| **Two-finger drag** | Pan zoomed content | Inside viewer. |

We do **not** use: shake-to-undo, force-touch, multi-finger swipe, edge-swipe-for-navigation (conflicts with Android back gesture).

---

## Primary action: the FAB rule

> One primary action per screen ([Principle #1](./design-principles.md#1-one-primary-action-per-screen)).

| Screen | Primary action | FAB icon + label |
|---|---|---|
| Home | Scan a document | `Camera` + "Scan" |
| Documents | Upload / Scan | `Plus` + "Add" (opens a sheet: Scan, Upload, Import) |
| Folder view | Add to this folder | `Plus` + "Add here" |
| AI Chat | Voice input | `Mic` + "Speak" |
| Scanner | Capture | `Camera` (large, centered, no label needed — universal) |
| Service Catalog | Search services | `Search` + "Find service" |

### FAB rules

- One FAB max per screen.
- Bottom-right corner, **16dp above the bottom nav** (24dp on the AI Chat where there's no nav).
- 56×56dp in comfortable mode, 64×64dp in simple mode.
- Always shows a **label** (the floating extended FAB), not icon-only — except the scanner capture where the camera icon is universal.
- Disappears (slide down) when the user starts scrolling down quickly; reappears on scroll up.
- Voice equivalent always exists: "scan", "upload", "speak", "capture".

### When NOT to use a FAB

- Single-purpose pages where the primary action is *inline* and already obvious (e.g., the document preview's "Share" button).
- Modals and sheets (use a regular button in the footer).
- Settings (no single primary action).

---

## Bottom sheets vs modals vs drawers

Three containers, three uses. Picking the wrong one is the most common design mistake.

| Container | Use | Dismiss | Stacks? |
|---|---|---|---|
| **Bottom sheet** | Quick action picker, single-decision flow (e.g., share TTL, sort options) | Swipe down, scrim tap, close button | No (never stack sheets) |
| **Modal** | Genuinely blocking decision the user must make (encrypt password, delete confirmation) | Cancel button (not scrim) | Never |
| **Drawer (side)** | Persistent navigation / folder tree on tablet+ | Scrim tap, swipe edge | Never |

### Bottom-sheet rules

- Max height 90% of viewport.
- Always has a 36×4dp drag handle at the top.
- Title is required (top of sheet, h2).
- Single primary action at the bottom (full-width, sticky to safe area).
- Swipe-to-dismiss enabled by default; disable only if the sheet has unsaved input.

### Modal rules

- Centered on tablet, full-screen on phone.
- Title + 1 description paragraph + 0–1 inputs + 2 actions max (Cancel + primary).
- Primary action is on the **right** for affirmative ("Save", "Continue") and on the **left** for destructive ("Delete"). The right-hand button in a destructive modal is "Cancel" (the safer choice).
- Escape / back button always closes (returns focus to trigger).
- Never stack modals; rearchitect the flow instead.

---

## Confirmation, Undo, and destructive actions

> [Principle #4](./design-principles.md#4-reversibility-over-confirmation): prefer Undo to confirmation modals.

Decision tree:

```
Is the action irreversible (no undo possible)?
├── No  → No modal. Execute immediately. Show Undo toast (30s).
└── Yes → Modal confirmation.
          ├── Has typed-input requirement (encrypt password)?
          │   → Modal with input. Primary on right.
          └── Just a yes/no?
              → Modal with "Cancel" / "Delete X" (destructive button left).
```

### Truly irreversible (use modal)

| Action | Reason |
|---|---|
| Encrypt PDF with a new password | If the user forgets, file is unrecoverable. |
| Permanent delete from Trash | After Trash, no undo. |
| Revoke a share link | V2; once revoked, recipients lose access. |
| Wipe device data (Settings → Reset) | Catastrophic. |
| Apply for a paid CSC service | V3; involves payment. |

### Reversible (Undo only, no modal)

| Action | Undo window |
|---|---|
| Delete document (moves to Trash) | 30s toast + 30-day Trash retention |
| Rename | 5s toast |
| Move to folder | 10s toast |
| Apply filter in scanner | "Reset" button always visible |
| Bulk operations on selection | 30s toast with count |

### Undo toast spec

```
┌───────────────────────────────────────────────┐
│  Moved "Aadhaar.pdf" to Trash.        UNDO    │
└───────────────────────────────────────────────┘
```

- Stays for 30s by default (configurable per action).
- Accessible: `role="status"`, `aria-live="polite"`.
- Has a clear "UNDO" button (not "Undo" word as plain text — must be tappable, 48dp tall).
- Stack max 1 — newer toast replaces older.

---

## Swipe actions on list items

For document and folder rows.

### Left swipe (destructive, red)

- **Reveals**: `Delete`
- Tapping the action moves to Trash + shows Undo toast.
- Full swipe past 50% threshold = same as tapping the action.

### Right swipe (positive, accent)

- **Reveals**: `Share` (V2) / `Open` (V1)
- Single-tap action.

### Rules

- Always two actions max (one per side).
- Always available via long-press → menu for keyboard / screen-reader / agent users.
- Animation: 200ms `ease-out`, springs back if not committed.
- Agent equivalent: `vault.deleteDocument({ documentId })`, `vault.shareDocument({ documentId })`.

---

## Selection mode (multi-select)

### Entering

- **Touch**: long-press any list item.
- **Voice**: "select multiple", "let me pick several".
- **Agent**: `vault.enterSelectionMode`.

### Visual change

- Top bar transforms: title → "{N} selected", left action becomes ×, right action becomes "Select all".
- Each item shows a checkbox (animated in from left, 200ms).
- FAB hides; **bulk action bar** rises from bottom with available operations.
- Bottom nav hides while in selection mode.

### Available bulk actions

| Op | Min selection | Constraints |
|---|---|---|
| Merge PDFs | 2 | All selected must be PDF |
| Compress | 1 | PDF only |
| Move to folder | 1 | Any |
| Add tags | 1 | Any |
| Share (V2) | 1 | Any |
| Delete | 1 | Any |

### Exiting

- × in top bar.
- Empty the selection (deselect all).
- Back button.
- Agent: `vault.exitSelectionMode`.

---

## Pull-to-refresh and infinite scroll

### Pull-to-refresh

- Available on Documents list, Folder view, Shares received (V2), Application tracking (V3).
- Native bouncy animation; do not override.
- Threshold: 80px pull.
- Disabled when the list is in selection mode (would conflict with row taps).

### Infinite scroll

- Page size: 30 documents.
- Trigger fetch at 80% scroll.
- Show a small `Spinner` at the bottom, never a "Load more" button.
- After 200 items, switch to **virtualized list** (`react-virtuoso`) for memory.

---

## Search and filter

> The single most-used surface for users with messy vaults.

### Search bar location

- Pinned to the top of the page, sticky on scroll.
- Voice button inside the input (not separate).
- Filter chips render *below* the search bar — never inside the input.

### Search behavior

- Debounced 200ms.
- Empty query → show all (no "press enter to search").
- Results highlight matched text in document names.
- Search is FTS5 over document name, tags, and OCR'd text (where available).

### Filter chips

- Horizontally scrollable row.
- Max 5 visible chips at a time; overflow = "More filters" chip opens a sheet.
- Active chips get a check icon + accent background.
- Tapping a chip toggles it; tapping its × removes it.

### Saved filters (V2)

- After applying 2+ filters, offer "Save this filter as…" toast.
- Saved filters appear as star-icon chips at the start of the row.

---

## Loading, empty, error states

These three are siblings — every async surface must show all three.

### Loading (skeleton, not spinner)

- Use skeleton placeholders shaped like the actual content (grey rectangles).
- Animate with subtle shimmer (1s loop).
- After 5s without progress, supplement with a real spinner + "Still loading…" text.
- After 15s, show a cancel button.
- Never show a blank screen with just a centered spinner — feels broken.

### Empty

- Friendly illustration (a person, not a sad cloud) — see [design-principles.md](./design-principles.md).
- One-sentence headline ("No documents yet").
- One-sentence helper ("Tap the camera below to scan your first document").
- One CTA button (matches the primary action of the page).
- Voice suggestion: "Or say 'scan a document' to start."

### Error

- Icon (warning triangle, secondary color — never red unless it's destructive).
- One-sentence what-went-wrong (plain language, never "Error 503").
- One-sentence what-to-do ("Check your connection and try again").
- "Retry" button (primary) + optional "Get help" link.

---

## Density modes

| Mode | When applied | Touch target | Type scale | Row height | Padding |
|---|---|---|---|---|---|
| **Simple** | User toggle (Settings → Accessibility → Simple Mode) | 64dp | 1.25× | 80dp | space-6 |
| **Comfortable** *(default)* | Mobile, default | 48dp | 1.0× | 56dp | space-4 |
| **Compact** | Tablet/desktop with `density="compact"`, or CSC operator workspace | 40dp | 0.95× | 44dp | space-3 |

Density swaps a single CSS variable set:

```css
:root[data-density="simple"]      { --row-h: 80px; --target-min: 64px; --scale: 1.25; }
:root[data-density="comfortable"] { --row-h: 56px; --target-min: 48px; --scale: 1.00; }
:root[data-density="compact"]     { --row-h: 44px; --target-min: 40px; --scale: 0.95; }
```

See [design-tokens.md](./design-tokens.md#density-tokens) for the token map.

---

## Low-literacy patterns

For users who read slowly, read regional languages only, or can't read at all.

### Always

- Icon + label (never icon-only).
- Maximum 1 primary action per screen.
- Single-task screens (don't pack multiple workflows into one page).
- Active language is one tap away from any screen.
- Voice is enabled and discoverable.

### Visual confirmations

- After a destructive op: green check animation (1s) + plain-language confirmation.
- After upload: thumbnail morphs into its place in the grid (not a separate toast).
- After payment (V3): printable receipt with the user's name big and bold.

### Form fields

- Labels above fields (not inside). Above survives focus; placeholder doesn't.
- Helper text explains *what to write* with an example: "Father's name as on Aadhaar — e.g., राम कुमार".
- Numeric fields show a numeric keyboard.
- Required field marker is **a word ("Required")**, not just `*`.

### Error messages

- Plain language. "We need this to continue" beats "field required".
- Errors render below the field, not in a toast.
- Errors are announced to TalkBack via `aria-live="polite"`.

---

## Voice-first patterns

> The AI assistant is the primary UI for low-literacy users.

### The mic button

- Always visible in the AI tab.
- Also embedded in the search bar of every list page.
- Press-and-hold by default; toggle mode available in Settings (Accessibility → Voice → Tap to talk).
- Visual feedback: live transcript appears above the button.

### Voice command resolution

Every voice command resolves via:

1. Page-level `voiceExamples` (the current page first).
2. Global `agent-sitemap.json` `voiceIndex` (cross-page).
3. The LLM's general reasoning.

Stages 1 and 2 are fast and offline. Stage 3 is the fallback.

### Voice confirmation

- For destructive operations: AI repeats back. "Should I delete Aadhaar.pdf? Say यस or नो."
- For form filling: AI summarizes filled fields. "I'll write your name as Rahul, DOB as 5 January 2002, and aadhaar number ending 9012. Submit?"

### Failure to recognize

- After 1 failed recognition: AI says "I didn't catch that — try again?"
- After 3: AI offers to switch to typing.

---

## Onboarding and progressive disclosure

### First-run

- 3 screens max. Never 5+. Skip button visible on every screen.
- 1: What is Kagaz. (illustration + one sentence)
- 2: What's on-device, what isn't. (privacy promise)
- 3: Permissions request — explained one at a time, only as needed (camera at scan time, mic at first voice tap).

### In-flow tips

- Use a `Tip` component (info icon + 1-sentence text, dismissable).
- Max 1 active tip per screen.
- Tips remember dismissal per-user.

### Don't

- Don't run "tours" that overlay the UI with arrows.
- Don't auto-open the AI chat on first launch ("Hi! I'm your assistant…") — wait for the user to tap.
- Don't require sign-up before the user has seen any value (Kagaz is local-first; no account is required for V1).

---

## Toast hierarchy

| Type | Color | Duration | Live region |
|---|---|---|---|
| **Success** | accent | 3s | `polite` |
| **Info** | info | 4s | `polite` |
| **Warning** | warning | 6s | `polite` |
| **Error** | danger | until dismissed | `assertive` |
| **Undo** (special) | neutral | 30s | `polite` |

Rules:

- Max 1 toast visible — new toast replaces old.
- Tappable area = whole toast; secondary "×" button for explicit dismiss.
- Bottom-anchored, 16dp above bottom nav (or 24dp above keyboard when visible).
- Never use a toast for critical errors that require action — use an inline error or modal.

---

## How this interacts with the agent layer

Every pattern above has a matching agent-layer expectation. A page passes the interaction-pattern lint *and* the agent-completeness lint together:

| Pattern | Agent expectation |
|---|---|
| FAB | `primaryAction` set in page agent manifest. |
| Bottom sheet | Its own `agent-id`; sheet open/close are observable state. |
| Confirmation modal | The action's `requiresConfirmation: true`. |
| Swipe actions | Each swipe action has an entry in availableActions. |
| Selection mode | `selectedIds` is observable state. |
| Toast | Toasts are `polite` live regions — agents read them as feedback. |

See [agent-interface.md](./agent-interface.md) for the full agent contract.

---

*Last updated: 2026-06-08 · Kagaz Interaction Patterns v1.0*
