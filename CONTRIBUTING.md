# Contributing to Kagaz

> **Contributing Guide** · Last Updated: 2026-06-08

Welcome to Kagaz! This document explains how to set up your development environment, understand the architecture, write code, and submit contributions.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
  - [Module Structure](#module-structure)
  - [Dependency Map](#dependency-map)
  - [Protocol-Based Design](#protocol-based-design)
- [Setup & Environment](#setup--environment)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the App](#running-the-app)
- [Code Style & Linting](#code-style--linting)
  - [ESLint Configuration](#eslint-configuration)
  - [Prettier Formatting](#prettier-formatting)
  - [TypeScript Strict Mode](#typescript-strict-mode)
- [Testing Requirements](#testing-requirements)
  - [Unit Testing](#unit-testing)
  - [Test Structure](#test-structure)
  - [Coverage Thresholds](#coverage-thresholds)
- [Branch Naming Conventions](#branch-naming-conventions)
- [Commit Message Format](#commit-message-format)
  - [Types](#types)
  - [Examples](#examples)
- [Module Documentation](#module-documentation)
  - [Creating a New Module](#creating-a-new-module)
  - [Module README Template](#module-readme-template)
  - [API Documentation](#api-documentation)
- [Performance & Security](#performance--security)
  - [Bundle Size Limits](#bundle-size-limits)
  - [Security Scanning](#security-scanning)
  - [Performance Benchmarks](#performance-benchmarks)
- [Parallel Development Guide](#parallel-development-guide)

---

## Architecture Overview

Kagaz follows a **Clean Architecture** pattern with **feature-based modular structure**. This enables:

- ✅ **Separation of concerns** — each layer has a clear responsibility
- ✅ **Parallel development** — teams can work independently on different modules
- ✅ **Testability** — business logic is isolated from framework code
- ✅ **Scalability** — new modules can be added without modifying existing ones
- ✅ **Maintainability** — modules are self-contained and independently deployable

### **Layered Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│ 🎨 PRESENTATION LAYER                                        │
│ (React Components, Pages, Ionic UI, Custom Hooks)           │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ ⚙️ APPLICATION LAYER                                         │
│ (Use Cases, Services, Zustand Stores, TanStack Query)       │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 🏛️ DOMAIN LAYER (Zero Dependencies)                         │
│ (Entities, Value Objects, Interfaces, Domain Events)        │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 🔧 INFRASTRUCTURE LAYER                                      │
│ (SQLite, Filesystem, WebLLM, Capacitor Plugins, Workers)   │
└─────────────────────────────────────────────────────────────┘
```

### **Module Structure**

```
src/
├── core/                          # Shared utilities
│   ├── config/                    # App configuration
│   ├── constants/                 # Global constants
│   ├── hooks/                     # Shared React hooks
│   ├── utils/                     # Utility functions
│   ├── types/                     # Global TypeScript types
│   └── i18n/                      # Internationalization (6 languages)
│
├── modules/
│   ├── document-vault/            # V1: Core document management
│   ├── document-scanner/          # V1: Camera/scan functionality
│   ├── pdf-engine/                # V1: PDF operations engine
│   ├── image-engine/              # V1: Image operations engine
│   ├── ai-assistant/              # V1: AI chatbot with tool calling
│   ├── search/                    # V1: Search & filter engine
│   ├── settings/                  # V1: App settings & preferences
│   ├── auth/                      # V1: Biometric + local auth
│   ├── sharing/                   # V2: Document sharing
│   ├── cloud-sync/                # V2: Cloud backup & sync
│   └── csc-services/              # V3: CSC service workflows
│
├── infrastructure/
│   ├── database/                  # SQLite setup, migrations, DAOs
│   ├── filesystem/                # File storage abstraction
│   ├── capacitor/                 # Capacitor plugin wrappers
│   └── ai/                        # AI engine initialization
│
├── design-system/                 # Shared UI components
│   ├── components/
│   ├── layouts/
│   ├── theme/
│   └── animations/
│
└── app/                           # App shell
    ├── routes/
    ├── providers/
    └── App.tsx
```

### **Dependency Map**

Each module has explicit, unidirectional dependencies:

```
✅ ALLOWED:
  Core ──→ All modules
  V1 Modules ──→ Infrastructure, Design System
  V2 Modules ──→ V1 Modules, Infrastructure, Design System
  V3 Modules ──→ V2 Modules, V1 Modules, Infrastructure, Design System

❌ BLOCKED:
  V1 ✗ V2 (V1 never depends on V2)
  V1 ✗ V3 (V1 never depends on V3)
  V2 ✗ V3 (V2 never depends on V3)
```

### **Protocol-Based Design**

All modules communicate via **TypeScript interfaces** (protocols), enabling:

- **Independent development** — modules don't need to know about each other's implementations
- **Easy testing** — mock implementations for unit tests
- **Future scalability** — swap implementations without changing module code

#### Example: Document Repository Protocol

```typescript
// Domain Layer: Interface definition (zero dependencies)
// src/modules/document-vault/types/document.types.ts
export interface IDocumentRepository {
  getDocument(id: string): Promise<Document>;
  saveDocument(doc: Document): Promise<void>;
  deleteDocument(id: string): Promise<void>;
  searchDocuments(query: string): Promise<Document[]>;
  listByFolder(folderId: string | null): Promise<Document[]>;
}

// Infrastructure Layer: Concrete implementation
// src/infrastructure/database/repositories/sqlite-document.repository.ts
export class SQLiteDocumentRepository implements IDocumentRepository {
  async getDocument(id: string): Promise<Document> {
    const dao = new DocumentDAO(this.db);
    return dao.getById(id);
  }

  async saveDocument(doc: Document): Promise<void> {
    const dao = new DocumentDAO(this.db);
    await dao.insert(doc);
  }

  async searchDocuments(query: string): Promise<Document[]> {
    const dao = new DocumentDAO(this.db);
    return dao.search(query);
  }
  // ... other methods
}

// Application Layer: Service using only the interface
// src/modules/document-vault/services/document.service.ts
export class DocumentService {
  constructor(private repository: IDocumentRepository) {}

  async uploadDocument(file: File, metadata: DocumentMetadata): Promise<Document> {
    const document = new Document({
      id: generateUUID(),
      name: file.name,
      filePath: await this.saveFile(file),
      ...metadata,
    });

    await this.repository.saveDocument(document);
    return document;
  }

  async search(query: string): Promise<Document[]> {
    // Uses interface, doesn't care about SQLite implementation!
    return this.repository.searchDocuments(query);
  }
}

// Presentation Layer: Component using service
// src/modules/document-vault/pages/VaultHomePage.tsx
export function VaultHomePage() {
  const documentService = useDocumentService();
  const [documents, setDocuments] = useState<Document[]>([]);

  const handleSearch = async (query: string) => {
    const results = await documentService.search(query);
    setDocuments(results);
  };

  return (
    <div>
      <SearchBar onSearch={handleSearch} />
      <DocumentGrid documents={documents} />
    </div>
  );
}
```

#### Why This Matters for Parallel Development

```typescript
// Developer A can work on document-vault/ without caring about
// Developer B's SQLite implementation!

// Developer B can later add a Cloud implementation:
export class CloudDocumentRepository implements IDocumentRepository {
  async getDocument(id: string): Promise<Document> {
    return fetch(`/api/documents/${id}`).then(r => r.json());
  }
  // ... other methods
}

// Just switch the implementation in the DI container:
const repository = isDev 
  ? new SQLiteDocumentRepository(db)
  : new CloudDocumentRepository();

// Developer A's code doesn't change at all!
```

---

## Setup & Environment

### **Prerequisites**

- **Node.js**: 22.12.0 or higher (LTS — Node 18 is end-of-life)
- **pnpm**: 10.0 or higher (we use pnpm, not npm)
- **Git**: 2.37.0 or higher
- **Android Studio** (for Android development) or **Xcode** (for iOS)
- **Java Development Kit (JDK)**: 17 or higher (for Android) — Android Studio bundles a JBR (currently Java 21), so a separate JDK install is usually unnecessary; point `JAVA_HOME` at it (see below)

### **Installation**

```bash
# 1. Clone the repository
git clone https://github.com/omanandswami2005/project-kagazzz.git
cd project-kagazzz

# 2. Install pnpm (if not already installed)
npm install -g pnpm

# 3. Install dependencies with pnpm
pnpm install

# 4. Set up environment files
cp .env.example .env.development
cp .env.example .env.production

# 5. Install Capacitor CLI
pnpm add -g @capacitor/cli

# 6. Install native dependencies (iOS)
cd ios
pod install
cd ..

# 7. Install native dependencies (Android)
# Open Android Studio once, let it auto-download SDK/NDK, and create an
# emulator (AVD) with an API 24+ system image (API 24 is our primary target).
```

### **Android CLI environment (macOS)**

Kagaz is driven from the terminal (agents can't click the Android Studio GUI), so put the SDK tools and a JDK on `PATH`. Add to `~/.zshrc`, then `source ~/.zshrc`:

```bash
# --- Android SDK + JDK (Kagaz dev) ---
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$JAVA_HOME/bin:$PATH"
# --- end Android SDK ---
```

Verify: `adb version`, `java -version`, and `emulator -list-avds` must all succeed. Full setup + the build/install/verify loop live in [docs/guides/device-verification.md](docs/guides/device-verification.md).

### **Running the App**

```bash
# Development server (web)
pnpm dev

# Build for web
pnpm build

# Preview production build
pnpm preview

# Build + install on Android (CLI — see docs/guides/device-verification.md)
emulator -avd Medium_Phone &          # boot an AVD; then: adb wait-for-device
pnpm --filter kagaz build:capacitor   # vite build + cap sync
cd apps/kagaz/android && ./gradlew assembleDebug   # macOS/Linux — NOT gradlew.bat
adb install -r app/build/outputs/apk/debug/app-debug.apk && cd ../../..
# (or, for the GUI:) pnpm --filter kagaz cap:open:android

# Build for iOS
pnpm build
pnpm exec cap sync ios
pnpm exec cap open ios

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format
```

---

## Code Style & Linting

### **ESLint Configuration**

We enforce code quality using **ESLint 10** (flat config — see `eslint.config.js` in the repo root). It layers `typescript-eslint` type-checked rules, `eslint-plugin-react` + `react-hooks`, `eslint-plugin-jsx-a11y` (accessibility lint is mandatory), `eslint-plugin-import-x`, and `eslint-config-prettier`, with these project rules:

```js
// eslint.config.js (excerpt — see the file for the full config)
rules: {
  // Use the structured logger (docs/architecture/14-observability-logging.md), never console.log
  'no-console': ['error', { allow: ['warn', 'error'] }],
  'no-debugger': 'error',
  'no-var': 'error',
  'prefer-const': 'error',
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/explicit-function-return-type': 'warn',
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
}
```

**Run linting:**

```bash
# Check all files
pnpm lint

# Fix auto-fixable issues
pnpm lint:fix
```

### **Prettier Formatting**

All code is automatically formatted using **Prettier**:

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always"
}
```

**Format code:**

```bash
pnpm format
```

**Your IDE should format on save** — install the Prettier extension:
- VS Code: `esbenp.prettier-vscode`
- WebStorm: Built-in

### **TypeScript Strict Mode**

**No `any` types allowed in production code!** Strict TypeScript settings:

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true
  }
}
```

**Good:**
```typescript
function processDocument(doc: Document): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    try {
      const result = validate(doc);
      resolve(result);
    } catch (error) {
      reject(error as Error);
    }
  });
}
```

**Bad:**
```typescript
function processDocument(doc: any): any {
  // ❌ No type safety!
  return doSomething(doc);
}
```

---

## Testing Requirements

### **Unit Testing**

We use **Vitest** for fast, modern testing:

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

### **Test Structure**

Tests live in `__tests__` folders at the same level as implementation:

```
src/modules/document-vault/
├── services/
│   ├── document.service.ts
│   └── __tests__/
│       └── document.service.test.ts
├── hooks/
│   ├── useDocuments.ts
│   └── __tests__/
│       └── useDocuments.test.ts
└── components/
    ├── DocumentCard.tsx
    └── __tests__/
        └── DocumentCard.test.tsx
```

### **Test Examples**

#### Service Testing

```typescript
// src/modules/document-vault/services/__tests__/document.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocumentService } from '../document.service';
import { IDocumentRepository } from '../../types/document.types';
import { Document } from '../../types/document.types';

describe('DocumentService', () => {
  let service: DocumentService;
  let mockRepository: IDocumentRepository;

  beforeEach(() => {
    // Mock the repository interface
    mockRepository = {
      getDocument: vi.fn(),
      saveDocument: vi.fn(),
      deleteDocument: vi.fn(),
      searchDocuments: vi.fn(),
      listByFolder: vi.fn(),
    };

    service = new DocumentService(mockRepository);
  });

  it('should upload a document successfully', async () => {
    // Arrange
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const expectedDocument: Document = {
      id: '123',
      name: 'test.pdf',
      filePath: '/documents/123.pdf',
      fileType: 'pdf',
      fileSize: 7,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(mockRepository.saveDocument).mockResolvedValue(undefined);

    // Act
    const result = await service.uploadDocument(file, { folderId: null });

    // Assert
    expect(mockRepository.saveDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'test.pdf',
        fileType: 'pdf',
      })
    );
  });

  it('should search documents correctly', async () => {
    // Arrange
    const mockResults: Document[] = [
      {
        id: '1',
        name: 'Aadhaar.pdf',
        filePath: '/documents/aadhaar.pdf',
        fileType: 'pdf',
        fileSize: 1024,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    vi.mocked(mockRepository.searchDocuments).mockResolvedValue(mockResults);

    // Act
    const results = await service.search('Aadhaar');

    // Assert
    expect(results).toEqual(mockResults);
    expect(mockRepository.searchDocuments).toHaveBeenCalledWith('Aadhaar');
  });

  it('should handle errors gracefully', async () => {
    // Arrange
    vi.mocked(mockRepository.getDocument).mockRejectedValue(
      new Error('Database error')
    );

    // Act & Assert
    await expect(service.getDocument('invalid-id')).rejects.toThrow(
      'Database error'
    );
  });
});
```

#### Hook Testing

```typescript
// src/modules/document-vault/hooks/__tests__/useDocuments.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDocuments } from '../useDocuments';
import { useDocumentService } from '../../services/useDocumentService';

vi.mock('../../services/useDocumentService');

describe('useDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch documents on mount', async () => {
    const mockDocuments = [
      { id: '1', name: 'doc1.pdf' },
      { id: '2', name: 'doc2.pdf' },
    ];

    vi.mocked(useDocumentService).mockReturnValue({
      listDocuments: vi.fn().mockResolvedValue(mockDocuments),
    } as any);

    const { result } = renderHook(() => useDocuments());

    await waitFor(() => {
      expect(result.current.documents).toEqual(mockDocuments);
    });
  });

  it('should handle loading state', async () => {
    vi.mocked(useDocumentService).mockReturnValue({
      listDocuments: vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 100))
      ),
    } as any);

    const { result } = renderHook(() => useDocuments());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });
});
```

#### Component Testing

```typescript
// src/modules/document-vault/components/__tests__/DocumentCard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DocumentCard } from '../DocumentCard';
import { Document } from '../../types/document.types';

describe('DocumentCard', () => {
  const mockDocument: Document = {
    id: '123',
    name: 'Sample Document',
    filePath: '/documents/sample.pdf',
    fileType: 'pdf',
    fileSize: 2048,
    createdAt: '2026-06-08T10:00:00Z',
    updatedAt: '2026-06-08T10:00:00Z',
  };

  it('should render document information', () => {
    render(<DocumentCard document={mockDocument} />);

    expect(screen.getByText('Sample Document')).toBeInTheDocument();
    expect(screen.getByText(/2 KB/)).toBeInTheDocument();
  });

  it('should call onSelect when clicked', async () => {
    const onSelect = vi.fn();
    const { user } = render(
      <DocumentCard document={mockDocument} onSelect={onSelect} />
    );

    await user.click(screen.getByRole('button'));

    expect(onSelect).toHaveBeenCalledWith(mockDocument);
  });
});
```

### **Coverage Thresholds**

We enforce minimum code coverage:

```json
// vitest.config.ts
{
  "coverage": {
    "provider": "v8",
    "reporter": ["text", "json", "html"],
    "all": true,
    "lines": 80,
    "functions": 80,
    "branches": 75,
    "statements": 80,
    "exclude": [
      "node_modules/",
      "src/**/*.types.ts",
      "src/**/*.test.ts",
      "src/**/__tests__/"
    ]
  }
}
```

**Minimum requirements per module:**
- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 75%
- **Statements**: 80%

---

## Branch Naming Conventions

Use descriptive branch names following these patterns:

```
feature/DESCRIPTION          # New feature
  feature/document-vault-search
  feature/pdf-merge-engine
  feature/ai-assistant-voice-input

bugfix/DESCRIPTION           # Bug fix
  bugfix/ocr-hindi-support
  bugfix/memory-leak-pdf-renderer
  bugfix/offline-sync-conflict

refactor/DESCRIPTION         # Code refactoring
  refactor/extract-pdf-service
  refactor/simplify-state-management
  refactor/improve-error-handling

docs/DESCRIPTION             # Documentation
  docs/architecture-guide
  docs/api-reference
  docs/migration-guide

chore/DESCRIPTION            # Maintenance
  chore/update-dependencies
  chore/setup-ci-pipeline
  chore/optimize-bundle-size

hotfix/DESCRIPTION           # Critical production fixes
  hotfix/security-vulnerability
  hotfix/crash-on-startup
```

---

## Commit Message Format

We follow the **Conventional Commits** specification for clear, structured commit messages.

### **Format**

```
<type>(<scope>): <subject>

<body>

<footer>
```

### **Types**

| Type | Description | Example |
|------|---|---|
| **feat** | New feature | `feat(document-vault): add bulk delete` |
| **fix** | Bug fix | `fix(pdf-engine): handle corrupted PDFs` |
| **docs** | Documentation | `docs: update contributing guide` |
| **style** | Code style (formatting, semicolons) | `style: format code with Prettier` |
| **refactor** | Code refactoring | `refactor(ai-assistant): simplify tool registry` |
| **perf** | Performance improvement | `perf(image-engine): optimize compression` |
| **test** | Add/update tests | `test(document-service): add upload tests` |
| **chore** | Maintenance, dependencies | `chore: update dependencies` |
| **ci** | CI/CD configuration | `ci: add GitHub Actions workflow` |

### **Scope**

Scope indicates which module/area is affected:

```
document-vault, pdf-engine, image-engine, ai-assistant, search, 
auth, settings, sharing, cloud-sync, csc-services, database, 
filesystem, design-system, core, infrastructure, app
```

### **Subject**

- Use imperative mood ("add" not "added" or "adds")
- Don't capitalize the first letter
- No period (.) at the end
- Max 50 characters

### **Body** (Optional but recommended)

- Explain **what** and **why**, not **how**
- Wrap at 72 characters
- Reference issues: `Fixes #123`, `Closes #456`
- Separate from subject with blank line

### **Footer** (Optional)

Use for breaking changes and issue references:

```
BREAKING CHANGE: IDocumentRepository now requires async implementations
Fixes #123
Related to #456
```

### **Examples**

#### Good ✅

```
feat(document-vault): add bulk document operations

Implement batch delete, move, and tag operations for selected documents.
- Add BulkActionBar component
- Create bulkActions store slice
- Add confirmation dialog
- Implement undo functionality

Fixes #234
```

```
fix(pdf-engine): handle zero-page PDFs gracefully

Prevent crash when pdf-lib encounters PDFs with no pages.
Validate page count before operations.

Fixes #567
```

```
refactor(ai-assistant): extract tool registry into separate service

Move tool registry logic from llm-engine.service to dedicated
tool-registry.service for better separation of concerns.

This enables easier testing and registration of new tools.
```

```
perf(image-engine): reduce memory usage during compression

Use streaming compression instead of loading entire image into memory.
Reduces peak memory by ~40% for large images.

Related to #890
```

```
test(document-service): add comprehensive upload tests

- Test successful upload flow
- Test file validation
- Test error handling
- Mock filesystem and database

Covers: upload, validation, error cases
Coverage: +15%
```

#### Bad ❌

```
Fixed stuff                          # ❌ Too vague
feat: add new thing                  # ❌ No scope
FEAT(VAULT): ADD NEW FEATURE         # ❌ Wrong format
feat(doc): impl file upload feat     # ❌ Unclear abbreviations
```

---

## Module Documentation

### **Creating a New Module**

When adding a new feature module, follow this structure:

```bash
mkdir -p src/modules/new-feature/{components,services,hooks,store,types,pages,__tests__}

# Create index.ts for barrel exports
touch src/modules/new-feature/index.ts
touch src/modules/new-feature/README.md
```

### **Module README Template**

Each module should have a `README.md` explaining its purpose and usage:

```markdown
# Feature Module Name

Brief description of what this module does.

## Overview

Detailed explanation of the module's functionality.

## Architecture

Describe how the module is structured and how it communicates with other modules.

## Key Interfaces

List the protocols/interfaces this module implements or uses.

```typescript
interface IFeatureRepository {
  // ...
}
```

## Services

### ServiceName

Description of what the service does.

```typescript
const service = useServiceName();
await service.doSomething(params);
```

## Components

### ComponentName

Description and usage example.

```tsx
<ComponentName prop1={value} onEvent={handler} />
```

## Hooks

### useHookName

What the hook does.

```typescript
const { data, loading, error } = useHookName();
```

## State Management

Describe Zustand store structure.

```typescript
const store = useFeatureStore();
store.actions.doSomething();
```

## Testing

Examples of testing this module.

## Dependencies

- Other modules this depends on
- External libraries used

## Known Limitations

Any limitations or TODOs.
```

### **API Documentation**

Use TypeScript JSDoc comments for all public APIs:

```typescript
/**
 * Uploads a document to the vault.
 * 
 * @param file - The file to upload
 * @param metadata - Document metadata (folder, tags, etc.)
 * @returns Promise resolving to the created Document
 * 
 * @example
 * ```typescript
 * const doc = await documentService.uploadDocument(file, {
 *   folderId: 'folder-123',
 *   tags: ['important', 'tax']
 * });
 * ```
 * 
 * @throws {ValidationError} If file size exceeds limits
 * @throws {DatabaseError} If save operation fails
 */
async uploadDocument(
  file: File,
  metadata: DocumentMetadata
): Promise<Document> {
  // Implementation
}
```

---

## Performance & Security

### **Bundle Size Limits**

Enforce bundle size limits in CI/CD:

```bash
pnpm build:analyze
```

**Size targets:**
- **Vendor chunk**: < 200KB
- **App chunk**: < 150KB
- **Module chunks** (lazy): < 100KB each
- **Total gzipped**: < 500KB

### **Security Scanning**

```bash
# Run security audit
pnpm audit

# Fix vulnerabilities
pnpm audit --fix

# Check dependencies for vulnerabilities
pnpm run security:check
```

**Security best practices:**
- ❌ Never commit `.env` files with secrets
- ❌ No API keys in code
- ✅ Use environment variables for secrets
- ✅ Validate user input at boundaries
- ✅ Sanitize HTML content
- ✅ Keep dependencies updated

### **Performance Benchmarks**

Track these metrics:

| Metric | Target | Tool |
|--------|--------|------|
| **Lighthouse Performance** | > 90 | `pnpm run audit:lighthouse` |
| **Core Web Vitals** | FCP < 2s, LCP < 2.5s | Lighthouse |
| **Bundle size (gzipped)** | < 500KB | `pnpm run build:analyze` |
| **Initial load time** | < 3s | Chrome DevTools |
| **Time to Interactive** | < 4s | Lighthouse |

---

## Parallel Development Guide

### **Scenario: Two teams working in parallel**

#### **Team A: Document Vault Module**

```bash
git checkout -b feature/document-vault-enhancements
cd src/modules/document-vault

# Work only in this module
# - Add new components
# - Create new services
# - Add hooks
# All within the module boundary
```

#### **Team B: PDF Engine Module**

```bash
git checkout -b feature/pdf-merge-improvements
cd src/modules/pdf-engine

# Work independently on PDF operations
# - Implement new merge strategy
# - Add compression
# - Optimize performance
```

**Key Rules:**

1. **Each team uses protocols (interfaces)**
   ```typescript
   // Team A uses this interface without knowing Team B's implementation
   import { IPDFService } from '../../pdf-engine/types';
   ```

2. **No direct imports between modules**
   ```typescript
   // ❌ WRONG - Direct implementation dependency
   import { PDFMergeService } from '../../pdf-engine/services/pdf-merge.service';

   // ✅ RIGHT - Interface dependency
   import { IPDFService } from '../../pdf-engine/types/pdf.types';
   ```

3. **Shared dependencies only through Core**
   ```typescript
   // ✅ OK - From core
   import { ValidationUtils } from '@/core/utils/validation.utils';

   // ✅ OK - From infrastructure
   import { DatabaseService } from '@/infrastructure/database';

   // ❌ WRONG - Direct module dependency
   import { DocumentService } from '../../document-vault/services';
   ```

4. **Merge with zero conflicts**
   - Each module = separate files
   - No merge conflicts expected
   - Fast, clean PRs

### **Example: Adding AI Tool without breaking existing code**

**AI Assistant needs to call PDF merge:**

```typescript
// src/modules/ai-assistant/services/tool-executor.service.ts

import { IPDFService } from '@/modules/pdf-engine/types';

export class ToolExecutor {
  constructor(
    private pdfService: IPDFService,  // Interface, not implementation!
  ) {}

  async executeMergeTool(params: MergeParams): Promise<ToolResult> {
    // Uses interface
    const result = await this.pdfService.mergePDFs(params.files);
    return { success: true, outputPath: result };
  }
}
```

**Later, someone can provide different implementation:**

```typescript
// src/modules/pdf-engine/services/pdf-merge-v2.service.ts

export class PDFMergeServiceV2 implements IPDFService {
  async mergePDFs(files: File[]): Promise<string> {
    // New, faster implementation
    return optimizedMerge(files);
  }
}

// Swap in DI container - AI assistant code unchanged!
const pdfService = useNewImplementation 
  ? new PDFMergeServiceV2()
  : new PDFMergeService();
```

---

## Submitting Changes

1. **Create a feature branch** from `develop`
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following code style & testing requirements

3. **Commit with proper messages** (see Commit Message Format)
   ```bash
   git commit -m "feat(module-name): clear description"
   ```

4. **Push to remote**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create a Pull Request** on GitHub with:
   - Clear title and description
   - Reference related issues
   - Screenshots for UI changes
   - Test coverage information

6. **Address review feedback** and iterate

---

## Getting Help

- **Architecture questions**: See `docs/architecture/01-system-architecture.md`
- **Tech stack decisions**: See `docs/architecture/08-tech-stack-decisions.md`
- **Module docs**: Check module-specific README files
- **Issues**: Search existing issues or create a new one
- **Discussions**: Use GitHub Discussions for questions

---

## Code of Conduct

Be respectful, inclusive, and constructive. We're building something great together! 🚀

---

**Last Updated**: 2026-06-08  
**Maintainer**: @omanandswami2005
