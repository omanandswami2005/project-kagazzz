# Page Skill Template

> Copy this when you add a new page. Every page in Kagaz ships **three files**:
> - `PageName.tsx` — the React component (with `data-agent-*` annotations).
> - `PageName.agent.ts` — the typed manifest (consumed by code).
> - `PageName.skill.md` — the natural-language skill (loaded into the AI's context).
>
> See [agent-interface.md](./agent-interface.md) for the full spec.

---

## Quickstart checklist

When adding `MyPage`, copy the templates below and complete every `TODO`. Then run:

```bash
pnpm agent:lint        # checks data-agent-* coverage
pnpm agent:sitemap     # regenerates agent-sitemap.json
pnpm test MyPage       # runs the agent-driven E2E suite
```

The lint will fail the build if any of these are missing:

- [ ] `data-agent-id` on every interactive element
- [ ] `data-agent-state` on every stateful element
- [ ] Every action listed in `availableActions` is exported from a `.actions.ts`
- [ ] Every action in `availableActions` appears in the skill `.md`
- [ ] `primaryAction` is set (or explicitly `null` with justification)
- [ ] At least one `voiceExample`
- [ ] At least one `successPredicate`

---

## Template 1 — `MyPage.agent.ts`

```ts
import { definePage } from '@kagaz/agent-kit';
import { myModuleActions } from '../../myModule.actions';

export const MyPageAgent = definePage({
  /** Stable, dot-separated, module-prefixed. Never renamed without deprecation. */
  id: 'myModule.myPage',

  /** Route pattern this page is mounted at. */
  route: '/my-route/:id?',

  /**
   * One sentence describing what the user accomplishes here.
   * The AI assistant uses this to decide whether to navigate to this page.
   */
  intent: 'TODO: one sentence — what does the user do on this page?',

  /** Where this page surfaces. */
  surfaces: ['screen'],   // 'screen' | 'modal' | 'sheet' | 'drawer'

  /**
   * THE one action this page exists for. Used by Principle #1 (one primary action).
   * Set to null only if there is genuinely no primary action (e.g., Settings index).
   */
  primaryAction: myModuleActions.doTheThing,

  /** Every action the user (or agent) can invoke on this page. */
  availableActions: [
    myModuleActions.doTheThing,
    // myModuleActions.somethingElse,
  ],

  /**
   * Live, read-only state the agent can query.
   * Each entry is a function that reads from the store/hooks.
   * Keep these cheap — agents may poll.
   */
  observableState: {
    // isLoading:    () => useMyStore.getState().isLoading,
    // itemCount:    () => useMyStore.getState().items.length,
  },

  /**
   * Predicates the agent can use to detect "did my action succeed?".
   * The key is human-readable; the value is a boolean function.
   */
  successPredicates: {
    // 'item created': (ctx) => ctx.itemCount > ctx.startCount,
  },

  /** Voice samples the AI assistant should match. Used by the AgentSitemap voiceIndex. */
  voiceExamples: [
    // { utterance: 'do the thing', action: 'myModule.doTheThing' },
    // { utterance: 'ये काम करो',   action: 'myModule.doTheThing' },
  ],
});
```

---

## Template 2 — `MyPage.skill.md`

Keep this **under 800 tokens** — it gets loaded into the AI's system prompt when the user navigates here.

```markdown
# Skill: <module>.<pageId>

## Purpose
TODO: 1–2 sentences. What is the user trying to accomplish here? Who is the typical user?

## What I (the AI) can do here

| User intent | Action to invoke | Notes / args |
|---|---|---|
| TODO | `module.action`        | TODO |
| TODO | `module.otherAction`   | TODO |

## State I should check first
- `isLoading === true` → tell the user the page is still loading; don't act yet.
- TODO: page-specific preconditions

## Voice examples I should recognize
- "english phrase"        → `module.action(...)`
- "हिन्दी वाक्य"           → `module.action(...)`
- "hinglish vakya bhi"   → `module.action(...)`

## Things I must NOT do
- TODO: page-specific guardrails.
- Never invoke a destructive action without the user's explicit, separate confirmation.

## Error messages to the user
When `module.action` fails:
- `E_NETWORK` → "Looks like you're offline. I'll try again when you're back online."
- `E_VALIDATION` → quote the field and what's wrong.

## Cross-page handoffs
- If the user asks for X (out of scope here), navigate to `module.otherPage`.
```

---

## Template 3 — Annotating the TSX

Below is the *minimum* annotation density. See [agent-interface.md § Layer 1](./agent-interface.md#layer-1--dom-annotations) for the full attribute spec.

```tsx
import { useAgentProps, useAgentPage } from '@kagaz/agent-kit';
import { MyPageAgent } from './MyPage.agent';

export function MyPage() {
  // Registers this page with the agent runtime on mount.
  useAgentPage(MyPageAgent);

  const { state, dispatch } = useMyPageState();

  return (
    <Page data-agent-id="myModule.myPage">
      <Toolbar data-agent-id="myModule.myPage.toolbar">
        <SearchInput
          {...useAgentProps({
            id: 'myModule.myPage.search',
            action: 'myModule.search',
            state: state.q ? 'dirty' : 'pristine',
            value: state.q,
          })}
        />
      </Toolbar>

      <List data-agent-id="myModule.myPage.list" data-agent-state={state.isLoading ? 'loading' : 'idle'}>
        {state.items.map(item => (
          <ListItem
            key={item.id}
            {...useAgentProps({
              id: `myModule.myPage.item-${item.id}`,
              action: 'myModule.openItem',
              state: item.selected ? 'selected' : 'idle',
            })}
          />
        ))}
      </List>

      <FAB
        {...useAgentProps({
          id: 'myModule.myPage.primary-fab',
          action: 'myModule.doTheThing',
          role: 'primary-action',
          state: state.canDoThing ? 'idle' : 'disabled',
        })}
      />
    </Page>
  );
}
```

---

## Worked example — `vault.list`

A short reference implementation showing all three files in their finished form.

### `ListPage.agent.ts`

```ts
import { definePage } from '@kagaz/agent-kit';
import { vaultActions } from '../../vault.actions';
import { useVaultStore } from '../../vault.store';

export const ListPageAgent = definePage({
  id: 'vault.list',
  route: '/vault',
  intent: 'Browse, search, filter, and operate on the user\'s documents.',
  surfaces: ['screen'],
  primaryAction: vaultActions.uploadDocument,
  availableActions: [
    vaultActions.uploadDocument,
    vaultActions.searchDocuments,
    vaultActions.deleteDocument,
    vaultActions.openDocument,
    vaultActions.toggleSelection,
    vaultActions.bulkMergeSelected,
  ],
  observableState: {
    documentCount: () => useVaultStore.getState().documents.length,
    selectedIds:   () => useVaultStore.getState().selectedIds,
    isLoading:     () => useVaultStore.getState().isLoading,
    query:         () => useVaultStore.getState().query,
  },
  successPredicates: {
    'document added':     (ctx) => ctx.documentCount > ctx.startCount,
    'document removed':   (ctx) => ctx.documentCount < ctx.startCount,
    'search results updated': (ctx) => ctx.query !== ctx.startQuery,
  },
  voiceExamples: [
    { utterance: 'upload',            action: 'vault.uploadDocument' },
    { utterance: 'scan a document',   action: 'vault.uploadDocument', args: { source: 'camera' } },
    { utterance: 'find my Aadhaar',   action: 'vault.searchDocuments', args: { q: 'aadhaar' } },
    { utterance: 'मेरा पैन कार्ड',     action: 'vault.searchDocuments', args: { q: 'pan' } },
    { utterance: 'merge these',       action: 'vault.bulkMergeSelected' },
  ],
});
```

### `ListPage.skill.md`

```markdown
# Skill: vault.list

## Purpose
The user is on the main document list. They view, search, filter, multi-select, and operate on their documents.

## What I (the AI) can do here
| User intent | Action | Notes |
|---|---|---|
| Add a document | `vault.uploadDocument` | Ask source ('camera' / 'gallery' / 'files') if unspecified. |
| Find a document | `vault.searchDocuments({ q })` | Use document name keywords from the user. |
| Open a document | `vault.openDocument({ documentId })` | Resolve from name via search first. |
| Delete one | `vault.deleteDocument({ documentId })` | Soft delete — Undo toast appears for 30s. |
| Merge selected | `vault.bulkMergeSelected` | Requires 2+ documents in `selectedIds`. |

## State I should check first
- `isLoading === true` → tell the user the vault is still loading.
- `documentCount === 0` → offer to scan or upload; this is an empty vault.
- `selectedIds.length >= 2` → mention bulk merge / share are available.

## Voice examples
- "मेरा आधार दिखाओ" → `vault.searchDocuments({ q: 'aadhaar' })`
- "scan a new doc" → `vault.uploadDocument({ source: 'camera' })`
- "merge these two" → `vault.bulkMergeSelected`

## Things I must NOT do
- Read document content (I only have metadata).
- Delete without surfacing the Undo affordance.
- Submit any destructive bulk operation without confirming the count.

## Errors
- `E_VAULT_OFFLINE` → "You're offline. I'll show what I have cached."
- `E_DOC_NOT_FOUND` → "I couldn't find that document. Try a different name?"
```

### `ListPage.tsx` (excerpt)

```tsx
export function ListPage() {
  useAgentPage(ListPageAgent);
  const { documents, isLoading, query, selectedIds } = useVaultStore();

  return (
    <Page data-agent-id="vault.list">
      <SearchBar
        {...useAgentProps({
          id: 'vault.list.search',
          action: 'vault.searchDocuments',
          state: query ? 'dirty' : 'pristine',
          value: query,
        })}
      />

      <DocumentGrid
        data-agent-id="vault.list.grid"
        data-agent-state={isLoading ? 'loading' : documents.length === 0 ? 'empty' : 'idle'}
      >
        {documents.map(doc => (
          <DocumentCard
            key={doc.id}
            document={doc}
            {...useAgentProps({
              id: `vault.list.item-${doc.id}`,
              action: 'vault.openDocument',
              state: selectedIds.includes(doc.id) ? 'selected' : 'idle',
            })}
          />
        ))}
      </DocumentGrid>

      <FAB
        {...useAgentProps({
          id: 'vault.list.upload-fab',
          action: 'vault.uploadDocument',
          role: 'primary-action',
          state: 'idle',
        })}
        icon="Upload"
        label="Upload"
      />
    </Page>
  );
}
```

---

## Anti-patterns

| ❌ Don't | ✅ Do |
|---|---|
| `data-agent-id="item-0"` | `data-agent-id="vault.list.item-{docId}"` |
| Action handler that calls `confirm()` natively | Set `requiresConfirmation: true` on the action |
| Skill .md > 800 tokens | Split into multiple sub-skills or trim |
| Listing an action in `availableActions` that isn't usable from this page | Remove it; agents will try to use it. |
| Same `id` on two elements | Build will fail; lint catches it. |
| Action with no Zod schema | Build will fail; schema is required for tool-call generation. |

---

*Last updated: 2026-06-10 · Kagaz Page Skill Template v1.0*
