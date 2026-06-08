# Kagaz — Agent & Automation Rules

> **Automation & Agent Guidelines** · Last Updated: 2026-06-08

This document defines mandatory rules for AI agents, code generators, and automation tools working on Kagaz. These rules ensure consistency, documentation quality, and architectural integrity.

---

## Table of Contents

- [Golden Rules](#golden-rules)
- [Architecture Changes](#architecture-changes)
- [Code Changes](#code-changes)
- [Documentation Requirements](#documentation-requirements)
- [Module Creation](#module-creation)
- [Testing Requirements](#testing-requirements)
- [Review Checklist](#review-checklist)

---

## Golden Rules

### **Rule #1: Documentation is Code**

❌ **FORBIDDEN**: Write code without updating documentation

✅ **REQUIRED**: Every code change must have a corresponding documentation update

**Example:**
```typescript
// ❌ WRONG - Code without docs
export class NewPDFService {
  async optimizePDF(file: File) {
    // implementation
  }
}

// ✅ RIGHT - Code with docs
/**
 * Optimizes PDF file size while maintaining quality.
 * 
 * @param file - PDF file to optimize
 * @returns Promise resolving to optimized PDF buffer
 * @example
 * ```typescript
 * const optimized = await pdfService.optimizePDF(pdfFile);
 * ```
 */
export class NewPDFService {
  async optimizePDF(file: File) {
    // implementation
  }
}
```

---

### **Rule #2: Architecture Changes Require Doc Updates (WITHOUT FAIL)**

❌ **CRITICAL**: Changes to architecture MUST be documented before/during implementation

✅ **MANDATORY**: Any architectural change requires updates to:
- `docs/architecture/01-system-architecture.md` (module structure, layers)
- `docs/architecture/08-tech-stack-decisions.md` (if tech changes)
- Module-specific `README.md` files
- `CONTRIBUTING.md` (if patterns change)

**When is architecture changed?**
- Adding new modules or layers
- Changing dependency flows
- Introducing new protocols/interfaces
- Modifying folder structure
- Adding new external libraries
- Changing state management patterns

**Example Flow:**
```
1. Plan: "Add new image-compression-v2 module"
   ↓
2. Update Docs: 
   - Add to docs/architecture/01-system-architecture.md
   - Create docs/guides/image-compression-v2.md
   - Update CONTRIBUTING.md with new module scope
   ↓
3. Implement: Create the actual module
   ↓
4. Test: Write tests & verify docs match code
   ↓
5. PR: Include both code AND doc changes
```

---

### **Rule #3: New Code → Relevant Doc Change (ALWAYS)**

❌ **FORBIDDEN**: Add features without documentation

✅ **REQUIRED**: Document:
- What the code does (JSDoc comments)
- Why it exists (README sections)
- How to use it (examples & API docs)
- Where it fits architecturally (module docs)

**Checklist for new features:**
```
□ JSDoc comments on all public methods
□ Module README updated with new feature
□ API documentation updated
□ Architecture docs updated (if applicable)
□ Contributing guide updated (if new patterns)
□ Examples provided in docs
□ Tests written (80% coverage minimum)
```

---

## Architecture Changes

### **Adding a New Module**

**Mandatory Documentation Updates:**

1. **Update `docs/architecture/01-system-architecture.md`**
   ```markdown
   ## Module Structure
   
   Add to src/modules/ section:
   
   ├── new-module/            # V?: Description
   │   ├── components/
   │   ├── services/
   │   ├── hooks/
   │   ├── store/
   │   ├── types/
   │   ├── pages/
   │   ├── __tests__/
   │   ├── index.ts
   │   └── README.md
   ```

2. **Update Module Dependency Map**
   ```markdown
   ## Module Dependency Map
   
   Add to graph:
   - new-module dependencies
   - modules that depend on new-module
   - confirm unidirectional rule (V1 → V2 → V3)
   ```

3. **Create Module README**
   ```
   docs/architecture/modules/new-module.md
   
   Contents:
   - Overview
   - Key Interfaces
   - Services
   - Components
   - Hooks
   - State Management
   - Testing
   - Dependencies
   - Known Limitations
   ```

4. **Update `CONTRIBUTING.md`**
   ```markdown
   Add to "Branch Naming Conventions":
   feature/new-module-feature
   
   Add to "Commit Message Format" scopes:
   new-module
   ```

5. **Update `docs/guides/parallel-development.md`**
   - Explain how new module integrates
   - Show protocol examples
   - Document dependencies

---

### **Changing Architecture Patterns**

**Example: Adding new state management approach**

❌ **WRONG**: Just add new pattern to code

✅ **RIGHT**: 
1. Document why (ADR in architecture docs)
2. Show comparison with existing patterns
3. Provide migration guide
4. Update all relevant architecture docs
5. Add examples in code

---

## Code Changes

### **New Service Implementation**

```typescript
// 1. Create with JSDoc
/**
 * Handles document encryption/decryption operations.
 * 
 * Supports:
 * - AES-256 encryption
 * - Password-based key derivation
 * - Streaming for large files
 * 
 * @example
 * ```typescript
 * const encrypted = await encryptionService.encrypt(file, password);
 * ```
 */
export class EncryptionService {
  async encrypt(file: File, password: string): Promise<ArrayBuffer> {
    // implementation
  }
}

// 2. Update module README
// docs/architecture/modules/pdf-engine.md
## Services
### EncryptionService
Handles PDF encryption with password protection...

// 3. Update contributing guide (if new patterns)
// CONTRIBUTING.md
## Module Documentation
### API Documentation
Add EncryptionService example...
```

### **New Component**

```typescript
// 1. Create with JSDoc + Storybook comment
/**
 * Displays encrypted PDF with unlock prompt.
 * 
 * @component
 * @example
 * ```tsx
 * <EncryptedPDFViewer
 *   pdfUrl="/docs/encrypted.pdf"
 *   onUnlock={(password) => handleUnlock(password)}
 * />
 * ```
 */
export function EncryptedPDFViewer(props: Props) {
  return <div>...</div>;
}

// 2. Update module README
// docs/architecture/modules/pdf-engine.md
## Components
### EncryptedPDFViewer
Displays PDFs with encryption protection...
```

### **New Hook**

```typescript
// 1. Create with JSDoc
/**
 * Manages encrypted document operations.
 * 
 * @returns Object with methods and state
 * @example
 * ```typescript
 * const { encrypt, decrypt, loading } = useEncryption();
 * ```
 */
export function useEncryption() {
  // implementation
}

// 2. Update module README
// docs/architecture/modules/pdf-engine.md
## Hooks
### useEncryption
Manages encryption/decryption state and operations...
```

---

## Documentation Requirements

### **JSDoc Standards**

Every public function/class must have JSDoc:

```typescript
/**
 * Brief description (1 line)
 * 
 * Detailed explanation (can span multiple lines).
 * Explain the why, not just the what.
 * 
 * @param paramName - Description of parameter
 * @returns Description of return value
 * @throws {ErrorType} When this error occurs
 * 
 * @example
 * ```typescript
 * // Good example that shows actual usage
 * const result = await myFunction(param);
 * ```
 * 
 * @see {@link RelatedFunction} for related functionality
 * @deprecated Use {@link NewFunction} instead
 */
export async function myFunction(paramName: string): Promise<Result> {
  // implementation
}
```

### **README Updates**

When adding features to a module:

```markdown
# Module Name

Brief description.

## Overview
Detailed explanation of what this module does and why.

## Services
### NewService
- What it does
- When to use it
- Example usage

## Components
### NewComponent
- Props and their types
- Example usage
- Accessibility notes

## Hooks
### useNewHook
- Return type
- Example usage
- Dependencies

## Testing
How to test this feature.

## Dependencies
Other modules or external libs used.
```

### **API Documentation**

In `docs/api-reference/`:

```markdown
# Module API Reference

## Classes

### ClassName

**Description:**
What this class does.

**Constructor Parameters:**
- param1: Type - Description

**Methods:**

#### methodName(param: Type): Type
Description of what method does.

**Example:**
```typescript
const instance = new ClassName();
const result = await instance.methodName(param);
```
```

---

## Module Creation

### **Checklist: Creating New Module**

```bash
□ Create folder structure
  mkdir -p src/modules/new-module/{components,services,hooks,store,types,pages,__tests__}

□ Create index.ts (barrel exports)
  export * from './services';
  export * from './components';

□ Create README.md
  - Overview
  - Architecture
  - Key Interfaces
  - Services, Components, Hooks, Store
  - Testing
  - Dependencies

□ Update architecture docs
  - docs/architecture/01-system-architecture.md (add to structure + dependency map)
  - docs/architecture/modules/new-module.md (create new file)
  - CONTRIBUTING.md (add module scope)

□ Create services with JSDoc

□ Create components with JSDoc

□ Create hooks with JSDoc

□ Create tests (80% coverage minimum)

□ Update CONTRIBUTING.md examples

□ Add to docs/api-reference/

□ Verify no circular dependencies
```

---

## Testing Requirements

### **Mandatory for New Code**

```bash
□ Unit tests for all services (80% coverage)
□ Hook tests with mock providers
□ Component tests (render, interaction)
□ Integration tests for module interactions
□ Error handling tests
□ Edge case tests

# Verify coverage
pnpm test:coverage
```

**Test Documentation:**

```typescript
// Document WHY you're testing this
describe('DocumentService', () => {
  describe('uploadDocument', () => {
    it('should upload document successfully', async () => {
      // WHAT you're testing
      // WHY it matters
    });

    it('should reject oversized files', async () => {
      // Security requirement: enforce file size limits
    });
  });
});
```

---

## Review Checklist

### **Before Creating PR (For Agents/Generators)**

```markdown
## Code Changes
☐ All code follows TypeScript strict mode (no `any`)
☐ All public APIs have JSDoc comments
☐ Code follows naming conventions (camelCase for functions, PascalCase for classes)
☐ No console.log in production code (use error logging)
☐ No circular dependencies between modules
☐ Follows protocol-based design (interfaces, not direct imports)

## Testing
☐ Unit tests written (80% coverage minimum)
☐ Tests pass locally: `pnpm test`
☐ Coverage thresholds met: `pnpm test:coverage`
☐ No skipped tests (no .only, .skip)

## Documentation
☐ JSDoc comments on all public functions/classes
☐ Module README updated (if applicable)
☐ Architecture docs updated (if architectural change)
☐ API reference updated (if new public API)
☐ CONTRIBUTING.md updated (if new patterns/modules)
☐ Examples provided in docs
☐ AGENT.md rules followed (this file!)

## Quality
☐ `pnpm lint` passes
☐ `pnpm format` applied
☐ Bundle size checked: `pnpm build:analyze`
☐ No security vulnerabilities: `pnpm audit`

## Git
☐ Commit messages follow Conventional Commits
☐ Branch naming follows convention (feature/, bugfix/, etc.)
☐ PR title is clear and descriptive
☐ PR description explains what and why
☐ Related issues linked
```

---

## Enforcement

### **Violations & Consequences**

| Violation | Consequence |
|-----------|-------------|
| Code without JSDoc | PR rejected, request changes |
| Architectural change without doc update | PR blocked, MUST update docs |
| Tests missing | PR rejected |
| Commit message not following convention | PR rejected |
| Module created without README | PR rejected |
| TypeScript `any` used | PR rejected |
| Breaking change not documented | PR rejected |

---

## Examples of Good Practices

### ✅ Good: Feature with Complete Documentation

```bash
# 1. Create feature branch
git checkout -b feature/document-encryption

# 2. Implement service with JSDoc
src/modules/pdf-engine/services/encryption.service.ts

# 3. Write tests
src/modules/pdf-engine/services/__tests__/encryption.service.test.ts

# 4. Update module README
src/modules/pdf-engine/README.md
- Add EncryptionService section
- Add usage examples

# 5. Update architecture docs
docs/architecture/modules/pdf-engine.md
- Add Encryption section

# 6. Update API reference
docs/api-reference/pdf-engine.md
- Add EncryptionService documentation

# 7. Commit with message
git commit -m "feat(pdf-engine): add document encryption

Implement AES-256 encryption for PDFs with password protection.

Changes:
- Add EncryptionService for encrypt/decrypt operations
- Support password-based key derivation
- Support streaming for large files
- Update module README with examples
- Add comprehensive tests (85% coverage)

Docs updated:
- README.md
- docs/api-reference/pdf-engine.md"
```

### ❌ Bad: Code Without Documentation

```bash
# Just adding code files without docs
src/modules/pdf-engine/services/encryption.service.ts

# NO tests
# NO JSDoc
# NO README update
# NO architecture docs update
# Commit: "add encryption"

→ PR REJECTED ✗
```

---

## For AI Agents & Code Generators

### **When Using AI to Generate Code**

1. **Always request documentation generation**
   ```
   "Generate DocumentService with JSDoc comments, module README section,
    API docs, and unit tests (80% coverage). Update CONTRIBUTING.md
    with new patterns."
   ```

2. **Verify all rules applied**
   ```bash
   pnpm lint          # Check code quality
   pnpm test          # Verify tests pass
   pnpm test:coverage # Verify coverage
   ```

3. **Include docs in PR**
   - Code files
   - Test files
   - Documentation updates
   - Architecture updates

---

## Quick Reference

**TL;DR Rules:**

1. ✅ **Code → JSDoc** (always)
2. ✅ **New Feature → README Update** (always)
3. ✅ **Architecture Change → Docs First** (WITHOUT FAIL)
4. ✅ **New Module → Complete Structure** (including README)
5. ✅ **No Code** → **No PR** without matching docs

---

**Last Updated**: 2026-06-08  
**Maintainer**: @omanandswami2005  
**Version**: 1.0
