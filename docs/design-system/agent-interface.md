# Kagaz — Agent Interface Layer

> How AI agents see, understand, and operate Kagaz pages — including filling complex forms, running multi-step flows, and recovering from failure.
>
> This document is the contract between **the UI**, **the in-app AI assistant** (V1), and **remote/computer-use agents** (V2+).

---

## Why this layer exists

Most apps make agents reverse-engineer the UI from screenshots and DOM heuristics. That is brittle (a button rename breaks everything), expensive (vision tokens), and unsafe (agents click the wrong thing).

Kagaz publishes a **first-class machine-readable surface** alongside the human UI. The same components render pixels for humans and metadata for agents. No screenshot guessing, no DOM scraping.

This gives us four wins:

1. **Agents work offline.** The on-device AI assistant (Llama-3.2 / Qwen2.5) can drive the app without a vision model.
2. **Tests get free.** The agent surface is the cleanest possible E2E test API.
3. **Voice = agent.** Voice commands resolve to the same Action Registry, no parallel implementation.
4. **Telemetry is structured.** Every user (and agent) action is named and observable.

---

## The three layers

```
┌─────────────────────────────────────────────────────────┐
│  Layer 3 — Page Skill (.skill.md + .agent.ts)           │
│  Natural-language + typed manifest of what a page does. │
│  Lives next to the page file. Read by the AI assistant. │
├─────────────────────────────────────────────────────────┤
│  Layer 2 — Action Registry (TypeScript)                 │
│  Centralized, typed list of every named action.         │
│  Hand-written; one entry per voice/agent command.       │
├─────────────────────────────────────────────────────────┤
│  Layer 1 — DOM annotations (data-agent-* attributes)    │
│  Every interactive element wears a stable agent name    │
│  and exposes its current state. The "addressable DOM."  │
└─────────────────────────────────────────────────────────┘
```

Each layer is independently useful. Together they let an agent answer three questions:

| Agent question | Answered by |
|---|---|
| "What is this page about and what can a user do here?" | Layer 3 (`.skill.md`) |
| "How do I invoke action X? What arguments does it take?" | Layer 2 (Action Registry) |
| "Where is the button for action X right now? Is it enabled?" | Layer 1 (`data-agent-*`) |

---

## Layer 1 — DOM annotations

Every interactive element gets a small, mandatory set of `data-agent-*` attributes.

### The five required attributes

| Attribute | Required when | Example |
|---|---|---|
| `data-agent-id` | Element is uniquely targetable | `data-agent-id="vault.upload-fab"` |
| `data-agent-action` | Element triggers a registered action | `data-agent-action="vault.uploadDocument"` |
| `data-agent-state` | Element has dynamic state | `data-agent-state="idle\|loading\|success\|error\|disabled"` |
| `data-agent-role` | The semantic role beyond ARIA | `data-agent-role="primary-action"` |
| `data-agent-value` | Form field with a current value | `data-agent-value="rahul@example.com"` |

### Naming convention

```
{module}.{surface}-{element}
```

| Example | Meaning |
|---|---|
| `vault.list-toolbar` | The toolbar above the document list |
| `vault.list-item-{docId}` | A specific document row |
| `vault.upload-fab` | The floating upload button |
| `scanner.capture-btn` | The capture button on scanner page |
| `ai.chat-input` | The chat input field |
| `service.form-step-2` | Step 2 of a service application form |

Rules:
- Lowercase, dot-separated, kebab-case segments.
- Module prefix is mandatory (`vault.`, `scanner.`, `ai.`, `share.`, `csc.`, `settings.`, `auth.`, `nav.`).
- Stable across renders — never derived from index position (use a real ID, not `list-item-0`).
- Names are part of the public API. Renaming requires a deprecation period.

### State vocabulary

`data-agent-state` uses a fixed vocabulary. No custom values without an RFC.

| State | Meaning |
|---|---|
| `idle` | Default, interactive |
| `hover` | Pointer over (desktop only) |
| `focus` | Keyboard or programmatic focus |
| `pressed` | Currently activated |
| `loading` | Async operation in progress |
| `success` | Just completed successfully (transient, ~2s) |
| `error` | Failed or invalid |
| `disabled` | Not interactive right now |
| `selected` | In a selection set (multi-select mode) |
| `expanded` / `collapsed` | For accordions, menus |
| `dirty` | Form field changed since load |
| `pristine` | Form field unchanged |

### Example — annotated Button

```tsx
<Button
  data-agent-id="vault.upload-fab"
  data-agent-action="vault.uploadDocument"
  data-agent-role="primary-action"
  data-agent-state={loading ? 'loading' : disabled ? 'disabled' : 'idle'}
  onClick={onUpload}
>
  Upload
</Button>
```

### Example — annotated Input

```tsx
<Input
  data-agent-id="csc.service-form.applicant-name"
  data-agent-action="form.fillField"
  data-agent-state={touched ? (error ? 'error' : 'dirty') : 'pristine'}
  data-agent-value={value}
  aria-invalid={!!error}
/>
```

### Helper: `useAgentProps`

To avoid boilerplate, every primitive consumes a single hook:

```tsx
const agentProps = useAgentProps({
  id: 'vault.upload-fab',
  action: 'vault.uploadDocument',
  role: 'primary-action',
  state: loading ? 'loading' : 'idle',
});

<button {...agentProps}>Upload</button>
```

`useAgentProps` also emits an `agent:render` event in dev mode so the AgentInspector dev tool can show the live agent graph.

---

## Layer 2 — Action Registry

A single TypeScript module per module declares every named action.

### Shape

```ts
// apps/mobile/src/modules/vault/vault.actions.ts
import { defineAction } from '@kagaz/agent-kit';
import { z } from 'zod';

export const vaultActions = {
  uploadDocument: defineAction({
    id: 'vault.uploadDocument',
    summary: 'Upload a document from the device or pick from gallery.',
    voice: ['upload', 'add document', 'दस्तावेज़ अपलोड करें'],
    args: z.object({
      source: z.enum(['camera', 'gallery', 'files']).optional(),
    }),
    requiresConfirmation: false,
    handler: async ({ source }, ctx) => {
      const file = await ctx.pickFile(source ?? 'files');
      return ctx.vault.upload(file);
    },
  }),

  deleteDocument: defineAction({
    id: 'vault.deleteDocument',
    summary: 'Move a document to Trash. Undo available for 30 seconds.',
    voice: ['delete', 'remove', 'मिटाओ'],
    args: z.object({ documentId: z.string() }),
    requiresConfirmation: false, // because undo is available
    handler: async ({ documentId }, ctx) => {
      await ctx.vault.softDelete(documentId);
      ctx.toast.undo('Document moved to Trash', () => ctx.vault.restore(documentId));
    },
  }),

  encryptDocument: defineAction({
    id: 'vault.encryptDocument',
    summary: 'Add password protection to a PDF. Irreversible without the password.',
    voice: ['encrypt', 'password protect', 'पासवर्ड लगाओ'],
    args: z.object({
      documentId: z.string(),
      password: z.string().min(8),
    }),
    requiresConfirmation: true, // truly irreversible
    handler: async ({ documentId, password }, ctx) => {
      return ctx.pdfEngine.encrypt(documentId, password);
    },
  }),
} satisfies ActionMap;
```

### Why Zod schemas

The same Zod schema:
1. Validates user input from the chat box.
2. Auto-generates the OpenAI/JSON-schema tool definition consumed by the on-device AI assistant (LiteRT-LM, F-13).
3. Validates remote-agent payloads in V2 (when computer-use bots can call us via MCP).
4. Drives the E2E test harness.

One source of truth. No drift.

### Auto-generated tool definitions

At build time, `vite-plugin-agent-kit` walks every `*.actions.ts` and emits:

```json
// dist/agent-manifest.json
{
  "vault.uploadDocument": {
    "type": "function",
    "function": {
      "name": "vault_uploadDocument",
      "description": "Upload a document from the device or pick from gallery.",
      "parameters": { /* from zod-to-json-schema */ }
    }
  },
  ...
}
```

The AI assistant loads this at startup and registers every action with its on-device engine (LiteRT-LM, F-13). Adding a new action = one PR; no AI-side changes.

### Confirmation policy

`requiresConfirmation: true` triggers the in-chat confirmation card (already specced in [05-ai-assistant-module § 5.4](../architecture/05-ai-assistant-module.md#54-confirmation-card)). Default rule: **confirmation only for actions without undo**.

---

## Layer 3 — Page Skills

The user's "per-page md/skills" idea, made concrete. Every page exports two files alongside its TSX.

```
apps/mobile/src/modules/vault/pages/list/
├── ListPage.tsx
├── ListPage.agent.ts    ← typed page manifest (small)
├── ListPage.skill.md    ← natural-language skill, read by the AI
└── ListPage.test.ts
```

### `ListPage.agent.ts` — the typed manifest

```ts
import { definePage } from '@kagaz/agent-kit';
import { vaultActions } from '../../vault.actions';

export const ListPageAgent = definePage({
  id: 'vault.list',
  route: '/vault',
  intent: 'Show the user every document they own, with search, filter, and bulk operations.',
  surfaces: ['screen'],            // not a modal/sheet
  primaryAction: vaultActions.uploadDocument,
  availableActions: [
    vaultActions.uploadDocument,
    vaultActions.deleteDocument,
    vaultActions.encryptDocument,
    // ...
  ],
  observableState: {
    documentCount: () => useVaultStore.getState().documents.length,
    selectedIds:   () => useVaultStore.getState().selectedIds,
    isLoading:     () => useVaultStore.getState().isLoading,
    activeFilters: () => useVaultStore.getState().filters,
  },
  successPredicates: {
    'document is uploaded': (ctx) => ctx.documentCount > ctx.startCount,
    'no documents shown':   (ctx) => ctx.documentCount === 0,
  },
  voiceExamples: [
    { utterance: 'show my Aadhaar',  action: 'vault.search', args: { q: 'aadhaar' } },
    { utterance: 'upload a new file', action: 'vault.uploadDocument' },
  ],
});
```

### `ListPage.skill.md` — read by the AI assistant

This is **a skill in the Claude/Anthropic sense** — a natural-language description loaded into the AI's context when the user is on this page (or asks about it). Kept short so it fits inside a 2K-token system prompt.

```markdown
# Skill: vault.list (Document List)

## Purpose
The user is on the main document list. They can search, filter, multi-select, and operate on their documents.

## What I (the AI) can do here

| Intent | Action | Notes |
|---|---|---|
| User wants to add a document | `vault.uploadDocument` | Ask source if not specified. |
| User says "delete X" | `vault.deleteDocument({ documentId })` | Resolve `X` to ID via `vault.searchDocuments` first. |
| User says "merge these" | `pdf.merge({ documentIds })` | Only if 2+ selected. Confirm filename. |
| User says "find my passport" | `vault.searchDocuments({ q: 'passport' })` | Then offer to open. |

## State I should check first
- `documentCount === 0` → onboard the user, suggest scan/upload.
- `isLoading` → tell the user the list is still loading; don't act yet.
- `selectedIds.length >= 2` → bulk operations available; mention them.

## Things I must NOT do
- Read document content. I only have metadata.
- Delete without surfacing the Undo toast.
- Encrypt without explicit user confirmation of the password.

## Voice examples I should recognize
- "मेरा आधार दिखाओ" → `vault.searchDocuments({ q: 'aadhaar' })`
- "इसे delete करो" → resolve from currently focused doc, then `vault.deleteDocument`
- "merge selected" → `pdf.merge({ documentIds: selectedIds })` (requires 2+ selected)
```

### Why both files?

- The **`.agent.ts`** is consumed by code: routing, tests, the AgentSitemap generator, the inspector tool.
- The **`.skill.md`** is loaded into the LLM's context when the page becomes active, *like* a Claude skill. It's where ambiguity lives — voice examples, dos and don'ts, soft heuristics. Markdown because LLMs read markdown better than they read TypeScript.

The two files are kept in sync by a lint rule: every action listed in `availableActions` must appear in the skill.

---

## The AgentSitemap

At build time, every `*.agent.ts` is collected into a single `agent-sitemap.json`:

```json
{
  "pages": {
    "vault.list":     { "route": "/vault", "primary": "vault.uploadDocument", ... },
    "vault.detail":   { "route": "/vault/:id", ... },
    "scanner":        { "route": "/scan", ... },
    "ai.chat":        { "route": "/ai", ... },
    "csc.serviceList":{ "route": "/services", ... }
  },
  "actions": { "...": "see Action Registry" },
  "voiceIndex": [
    { "utterance": "upload", "pages": ["vault.list", "scanner"], "action": "vault.uploadDocument" },
    { "utterance": "मेरा आधार", "pages": ["vault.list"], "action": "vault.searchDocuments" }
  ]
}
```

The AI assistant uses the sitemap to:
- Decide which page to navigate to before invoking an action.
- Resolve ambiguous voice commands ("scan" → scanner page or vault page?).
- Generate help text ("Here's what you can ask me on this screen").

---

## Form-filling protocol

Filling forms (CSC service applications, share dialog, settings) is the highest-value agent workflow. Forms get a richer manifest.

### `Form` component contract

```tsx
<Form
  agentId="csc.panCard.applyForm"
  schema={panApplicationSchema}            // Zod
  initialValues={{}}
  autofillSources={['vault.aadhaar', 'profile']}
  onSubmit={...}
>
  <Field name="fullName"      label="Full Name (as on Aadhaar)" />
  <Field name="dateOfBirth"   label="Date of Birth" type="date" />
  <Field name="aadhaarNumber" label="Aadhaar Number" mask="0000-0000-0000" />
  <Field name="father.name"   label="Father's Name" />
  <FieldGroup name="address">
    <Field name="line1" label="Address Line 1" />
    <Field name="pinCode" label="PIN Code" mask="000000" />
  </FieldGroup>
</Form>
```

Internally, `<Form>` exposes a `form.fillField` and `form.submit` action automatically — the developer doesn't register them per-field.

### Agent-side API

```ts
// What the agent calls:
await agent.invoke('form.fillField', {
  formId: 'csc.panCard.applyForm',
  field:  'aadhaarNumber',
  value:  '1234-5678-9012',
});

await agent.invoke('form.fillFromDocument', {
  formId:     'csc.panCard.applyForm',
  documentId: 'doc_aadhaar_xyz',
});

await agent.invoke('form.validate', {
  formId: 'csc.panCard.applyForm',
});

await agent.invoke('form.submit', {
  formId: 'csc.panCard.applyForm',
});
```

### Autofill from documents

`autofillSources` declares which vault documents the form is allowed to read via OCR. When the user (or agent) triggers autofill:

1. `image-engine` runs OCR on the document.
2. A field-mapping resolver (declared in the page manifest) maps OCR fields → form fields.
3. The agent presents *suggested* values; the user (or agent) confirms before submission.

The user always sees a diff: "These 4 fields will be filled from your Aadhaar — confirm?"

### Field-level state

Each field exposes (via `data-agent-state` on the input):

| State | Meaning |
|---|---|
| `pristine` | Untouched |
| `dirty` | Changed by user/agent |
| `autofilled` | Filled from a document — needs human ack |
| `error` | Validation failing |
| `valid` | Validation passing |
| `submitting` | Form in-flight |

Agents read these to know whether to act. Example: an agent never submits a form where any field is in `error` or `autofilled` (not yet acked).

---

## State contract

A page is **"agent-operable"** if it satisfies:

1. Every interactive element has `data-agent-id`, `data-agent-state`.
2. `availableActions` covers every user-facing capability.
3. `observableState` returns enough to decide "did the action succeed?"
4. `successPredicates` describes at least one observable outcome per action.

Lint rule `agent/completeness` enforces (1) and (2). Tests enforce (3) and (4).

---

## Failure & recovery semantics

When an agent invokes an action that fails:

```ts
type ActionResult<T> =
  | { ok: true;  data: T }
  | { ok: false; code: ActionErrorCode; message: string; retryable: boolean; userMessage: string };
```

`userMessage` is what the AI assistant should say to the user — pre-translated to the active locale, plain-language, never tech jargon. The agent doesn't have to translate "VAULT_E_FILE_TOO_LARGE" — the action already did.

`retryable: true` tells the agent it may retry without asking the user. `retryable: false` means surface to the user and stop.

---

## Examples — three full pages

### Example 1: Scanner page

```ts
// ScannerPage.agent.ts
export const ScannerPageAgent = definePage({
  id: 'scanner',
  route: '/scan',
  intent: 'Capture a physical document with the camera, crop, and save to vault.',
  primaryAction: scannerActions.capture,
  availableActions: [
    scannerActions.capture,
    scannerActions.retake,
    scannerActions.addPage,
    scannerActions.adjustCorners,
    scannerActions.applyFilter,
    scannerActions.save,
  ],
  observableState: {
    pageCount: () => useScannerStore.getState().pages.length,
    cornersDetected: () => useScannerStore.getState().cornersDetected,
    activeFilter: () => useScannerStore.getState().filter,
  },
  voiceExamples: [
    { utterance: 'capture', action: 'scanner.capture' },
    { utterance: 'फिर से लो', action: 'scanner.retake' },
    { utterance: 'save as PDF', action: 'scanner.save', args: { format: 'pdf' } },
  ],
});
```

### Example 2: AI Chat page

The chat page is the *meta-agent surface* — its actions are how the user talks to the AI itself.

```ts
// ChatPageAgent.agent.ts
export const ChatPageAgent = definePage({
  id: 'ai.chat',
  route: '/ai',
  intent: 'Conversational interface to the on-device AI assistant.',
  primaryAction: aiActions.sendMessage,
  availableActions: [
    aiActions.sendMessage,
    aiActions.startVoice,
    aiActions.stopVoice,
    aiActions.clearConversation,
    aiActions.exportConversation,
  ],
  observableState: {
    isModelLoading: () => useAiStore.getState().modelStatus !== 'ready',
    messageCount:   () => useAiStore.getState().messages.length,
    isStreaming:    () => useAiStore.getState().isStreaming,
  },
});
```

### Example 3: CSC Service Application (V3)

The richest example — a multi-step form driven end-to-end by the agent.

```ts
// PanApplicationPage.agent.ts
export const PanApplicationPageAgent = definePage({
  id: 'csc.panCard.apply',
  route: '/services/pan-card/apply',
  intent: 'Fill and submit a PAN Card application.',
  primaryAction: cscActions.submitPanApplication,
  availableActions: [
    cscActions.fillField,
    cscActions.autofillFromDocument,
    cscActions.nextStep,
    cscActions.previousStep,
    cscActions.submitPanApplication,
    cscActions.payFees,
  ],
  observableState: {
    currentStep: () => useFormStore.getState().step,                // 1..5
    fieldErrors: () => useFormStore.getState().errors,
    isReadyToSubmit: () =>
      Object.keys(useFormStore.getState().errors).length === 0 &&
      useFormStore.getState().step === 5,
  },
  successPredicates: {
    'application submitted': (ctx) => ctx.applicationId != null,
  },
});
```

And the matching skill file teaches the AI how to *guide* the user:

```markdown
# Skill: csc.panCard.apply

## Purpose
Help the user fill a PAN Card application step by step. They may be unfamiliar with the fields — explain in plain language.

## What I do
1. Offer to autofill from their Aadhaar. Read fields from OCR, show the diff, ask for confirmation.
2. For each field, if the user asks "what does this mean?", explain in their language.
3. If they have multiple Aadhaars in the vault, ask which one.
4. At step 5 (review), summarize every entered value before pay-and-submit.

## Voice examples
- "fill from Aadhaar" → `cscActions.autofillFromDocument({ documentId: <user's Aadhaar> })`
- "next" → `cscActions.nextStep`
- "मेरा नाम राहुल है" → `cscActions.fillField({ field: 'fullName', value: 'राहुल' })`

## Must NOT
- Submit without explicit user confirmation at step 5.
- Auto-pay. Always have user confirm payment.
```

---

## Tooling

| Tool | Purpose | Status |
|---|---|---|
| `@kagaz/agent-kit` | `defineAction`, `definePage`, `useAgentProps` | V1 |
| `vite-plugin-agent-kit` | Build-time: emit `agent-sitemap.json`, `agent-manifest.json` | V1 |
| `eslint-plugin-agent` | Lint rules: `agent/completeness`, `agent/stable-ids`, `agent/skill-in-sync` | V1 |
| AgentInspector (dev) | Devtool overlay showing live `data-agent-*` graph | V1 |
| `@kagaz/agent-test` | E2E test harness driven by the Action Registry | V1 |
| Remote Agent Bridge (MCP) | V2 — expose the Action Registry to remote agents via MCP server | V2 |
| Computer-Use adapter | V2 — accept `screenshot + action` style calls and map to actions | V2 |

---

## Versioning

- `data-agent-id` and Action Registry `id` are **public API**.
- Renames require: deprecation notice in changelog → 2-version transition → removal.
- Adding a new action or field is non-breaking.
- Skill `.md` files are versioned per page; the AI is informed when a skill version changes.

---

## When NOT to add an agent annotation

Not everything needs one. Skip:

- Pure decorative elements (illustrations, dividers).
- Elements whose state is fully determined by their parent's `data-agent-state`.
- Transient overlays that aren't user-actionable (loading veils, tooltips).

Rule of thumb: if a human can tap it or read it for meaning, the agent should see it. If it's pixels for a vibe, it doesn't need a name.

---

## Open questions / future work

| Question | Direction |
|---|---|
| Should voice examples live in the skill or in `defineAction`? | Currently both — duplication is intentional for now. Decide after V1 telemetry. |
| Cross-page workflows (apply for PAN → upload to vault → share) | V2: add `Workflow` definitions that orchestrate multiple page skills. |
| Remote agent auth | V2: per-action scopes + per-session capability tokens. |
| Agent-driven visual snapshots for debugging | V2: AgentInspector logs annotated screenshots for every action. |

---

*Last updated: 2026-06-10 · Kagaz Agent Interface v1.0*
