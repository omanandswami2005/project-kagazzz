# 10 — Security Architecture

> **Project:** Kagaz
> **Classification:** Security-Critical
> **Last Updated:** 2026-06-10

---

## Table of Contents

- [1. Security Philosophy](#1-security-philosophy)
- [2. Threat Model](#2-threat-model)
- [3. Local Security (V1)](#3-local-security-v1)
  - [3.1 Biometric Authentication](#31-biometric-authentication)
  - [3.2 Database Encryption (SQLCipher)](#32-database-encryption-sqlcipher)
  - [3.3 File System Security](#33-file-system-security)
  - [3.4 Secure Key Storage](#34-secure-key-storage)
  - [3.5 Offline-Only Guarantee](#35-offline-only-guarantee)
- [4. Sharing Security (V2)](#4-sharing-security-v2)
  - [4.1 End-to-End Encryption](#41-end-to-end-encryption)
  - [4.2 Access Controls](#42-access-controls)
  - [4.3 Anti-Abuse Protections](#43-anti-abuse-protections)
  - [4.4 Audit Logging](#44-audit-logging)
  - [4.5 Consent & Revocation](#45-consent--revocation)
- [5. AI Security](#5-ai-security)
  - [5.1 On-Device Model Execution](#51-on-device-model-execution)
  - [5.2 Data Boundary Enforcement](#52-data-boundary-enforcement)
  - [5.3 Tool Call Authorization](#53-tool-call-authorization)
  - [5.4 Model Integrity](#54-model-integrity)
- [6. Privacy Principles](#6-privacy-principles)
- [7. Security Architecture Diagram](#7-security-architecture-diagram)
- [8. Security Checklist by Version](#8-security-checklist-by-version)
- [9. Incident Response](#9-incident-response)

---

## 1. Security Philosophy

Kagaz follows a **zero-trust, offline-first, privacy-by-design** philosophy. The core principles are:

| Principle | Implementation |
|---|---|
| **Zero Knowledge** | We never see, access, or process user data |
| **Defense in Depth** | Multiple layers — biometric, encryption, sandboxing |
| **Least Privilege** | AI and features only access what they need |
| **Data Sovereignty** | Users own 100% of their data, always |
| **Transparency** | Users know exactly what's stored and where |
| **No Telemetry** | Zero analytics, tracking, or usage reporting |

> [!IMPORTANT]
> In V1, Kagaz is a **100% offline application**. No data ever leaves the user's device. There are no servers, no APIs, no analytics endpoints. This is the strongest possible privacy guarantee.

---

## 2. Threat Model

### Assets to Protect

| Asset | Sensitivity | Location |
|---|---|---|
| Personal documents (Aadhaar, PAN, etc.) | 🔴 Critical | Device file system |
| Document metadata & OCR text | 🟠 High | SQLite database |
| AI conversation history | 🟡 Medium | SQLite database |
| App settings & preferences | 🟢 Low | SQLite database |
| Database encryption key | 🔴 Critical | Secure enclave / Keychain |

### Threat Actors & Mitigations

| Threat | Attack Vector | Mitigation |
|---|---|---|
| **Device theft** | Physical access to unlocked device | App-level biometric lock, auto-lock on background |
| **Malicious app** | Reads Kagaz's data directory | App sandbox, SQLCipher encryption at rest |
| **Shoulder surfing** | Viewing sensitive docs on screen | Per-document biometric lock, blur on app switch |
| **Data extraction** | ADB/USB debugging, rooted device | Encrypted database, root detection warning |
| **Brute-force (V2)** | Guessing share codes | Rate limiting, account lockout, PIN protection |
| **Man-in-the-middle (V2)** | Intercepting shared docs | End-to-end encryption, certificate pinning |
| **AI data leakage** | Model exfiltrating data | 100% on-device model, no network access |
| **Backup exposure** | Unencrypted backup files | Encrypted backup archives with user key |

---

## 3. Local Security (V1)

### 3.1 Biometric Authentication

```mermaid
sequenceDiagram
    participant User
    participant App as Kagaz App
    participant Bio as Biometric API
    participant SecStore as Secure Storage
    participant DB as SQLCipher DB

    User->>App: Launch app
    App->>Bio: Request biometric authentication
    Bio->>User: Prompt fingerprint / face
    User->>Bio: Authenticate
    Bio->>App: Authentication result

    alt Success
        App->>SecStore: Retrieve DB encryption key
        SecStore->>App: Encryption key
        App->>DB: Open database with key
        DB->>App: Database ready
        App->>User: Show vault
    else Failure
        App->>User: Access denied
    end
```

#### App-Level Lock

| Feature | Behavior |
|---|---|
| **Lock trigger** | App goes to background, device locked, or manual lock |
| **Auth method** | Device biometric (fingerprint / face) via Capacitor plugin |
| **Fallback** | Device PIN/pattern (managed by OS) |
| **Auto-lock timeout** | Configurable: Immediate / 30s / 1min / 5min |
| **Failed attempts** | Handled by OS biometric system (typically 5 attempts → cooldown) |

#### Per-Document Lock

For documents marked as `is_locked = 1`:

- Viewing the document requires a **separate biometric prompt**
- Thumbnail is blurred in the document list
- Document content is not included in search results
- Per-document lock is independent of app-level lock

> [!TIP]
> Per-document biometric lock is ideal for highly sensitive documents like Aadhaar cards, financial statements, or medical records. Users can share their phone for casual use while keeping sensitive docs protected.

---

### 3.2 Database Encryption (SQLCipher)

| Parameter | Value |
|---|---|
| **Algorithm** | AES-256-CBC |
| **KDF** | PBKDF2-HMAC-SHA512 |
| **KDF iterations** | 256,000 (default in SQLCipher 4.x) |
| **Page size** | 4096 bytes |
| **HMAC** | SHA-512 per page (integrity verification) |
| **Key source** | Random 256-bit key stored in Secure Storage |

```typescript
// Database initialization with encryption
import { CapacitorSQLite } from '@capacitor-community/sqlite';

async function initializeDatabase() {
  // Retrieve or generate encryption key
  const encryptionKey = await getOrCreateEncryptionKey();

  // Open encrypted database
  const db = await CapacitorSQLite.createConnection({
    database: 'kagaz',
    encrypted: true,
    mode: 'encryption',
    version: 1,
    secret: encryptionKey,
  });

  await db.open();
  return db;
}
```

> [!CAUTION]
> The database encryption key must **never** be hardcoded, logged, or stored in plain text. It lives exclusively in the device's secure enclave (Keychain on iOS, Android Keystore on Android).

---

### 3.3 File System Security

| Layer | Protection |
|---|---|
| **OS Sandbox** | App data directory inaccessible to other apps (iOS/Android) |
| **Device encryption** | Full-disk encryption (enabled by default on modern devices) |
| **File paths** | Relative paths stored in DB — no absolute path leakage |
| **Temp files** | Cleaned up after operations (merge, compress, etc.) |
| **Screenshot prevention** | `FLAG_SECURE` on Android / screen capture prevention on iOS |
| **App switcher blur** | Document content blurred in app switcher / recent apps |

### File Storage Layout

```
[App Data Directory]/
├── documents/
│   ├── {uuid}.pdf
│   ├── {uuid}.jpg
│   └── ...
├── thumbnails/
│   ├── {uuid}_thumb.jpg
│   └── ...
├── temp/                    ← Cleaned on app launch
│   └── ...
└── backups/
    └── kagaz_backup_{timestamp}.enc
```

---

### 3.4 Secure Key Storage

Kagaz uses **Capacitor Secure Storage** (backed by platform-native secure storage) for all sensitive values:

| Platform | Backend | Security Level |
|---|---|---|
| **iOS** | Keychain Services | Hardware-backed Secure Enclave |
| **Android** | Android Keystore + EncryptedSharedPreferences | Hardware-backed (TEE/StrongBox) |

#### Stored Secrets

| Key | Purpose | Generated When |
|---|---|---|
| `db_encryption_key` | SQLCipher database encryption | First app launch |
| `backup_encryption_key` | Backup archive encryption | First backup creation |
| `biometric_enabled` | Flag for biometric auth state | User enables biometrics |

```typescript
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

// Store a key
await SecureStoragePlugin.set({
  key: 'db_encryption_key',
  value: generatedKey,
});

// Retrieve a key (after biometric auth)
const { value } = await SecureStoragePlugin.get({
  key: 'db_encryption_key',
});
```

---

### 3.5 Offline-Only Guarantee

In V1, Kagaz enforces a strict **no-network** policy:

| Measure | Details |
|---|---|
| **No HTTP calls** | No API endpoints, no REST/GraphQL clients |
| **No analytics SDKs** | No Firebase, no Mixpanel, no Sentry |
| **No crash reporting** | Errors logged locally only |
| **No remote config** | All configuration is bundled and local |
| **No push notifications** | No FCM/APNs integration |
| **Network permissions** | Not requested in app manifest (V1) |
| **CSP headers** | Content Security Policy blocks all outbound connections |

> [!NOTE]
> Users can verify the offline nature of V1 by using the app in airplane mode — every feature works identically with no network connection.

---

## 4. Sharing Security (V2)

> [!WARNING]
> V2 sharing features introduce network connectivity. This section describes the security measures that **must** be implemented before any data leaves the device.

### 4.1 End-to-End Encryption

```mermaid
sequenceDiagram
    participant Sender as Sender Device
    participant Server as Relay Server
    participant Receiver as Receiver Device

    Sender->>Sender: Generate AES-256 key
    Sender->>Sender: Encrypt document with AES key
    Sender->>Server: Upload encrypted blob + metadata
    Server->>Server: Store encrypted blob (cannot read)
    
    Sender->>Sender: Generate 5-char share code
    Note over Sender: Code encodes key fragment
    Sender->>Receiver: Share code (out-of-band)
    
    Receiver->>Server: Request blob with code
    Server->>Receiver: Return encrypted blob
    Receiver->>Receiver: Derive key from code + PIN
    Receiver->>Receiver: Decrypt document
```

| Component | Encryption |
|---|---|
| **Document payload** | AES-256-GCM (authenticated encryption) |
| **Key exchange** | Share code encodes key material; optional PIN adds entropy |
| **Transport** | TLS 1.3 with certificate pinning |
| **Server** | Zero-knowledge — stores only encrypted blobs |

---

### 4.2 Access Controls

| Control | Implementation |
|---|---|
| **Time-limited access (TTL)** | `expires_at` timestamp in `shared_links` table; server rejects after expiry |
| **Access count limits** | `max_access_count` — link deactivated when `current_access_count` reaches limit |
| **PIN protection** | Optional 4–8 digit PIN; bcrypt-hashed; required before decryption |
| **Permission granularity** | Per-link permissions: `{view: true, download: true, print: false}` |
| **Watermarking** | Invisible watermark embedded with receiver identifier for leak tracing |

### Watermarking Strategy

```mermaid
flowchart LR
    A["Original Document"] --> B["Add Invisible Watermark"]
    B --> C["Encode: Share Code + Timestamp"]
    C --> D["Watermarked Document"]
    D --> E{"Leak Detected?"}
    E -->|Yes| F["Extract Watermark"]
    F --> G["Identify Share Code & Recipient"]
```

- Watermarks are **invisible** (steganographic for images, metadata-based for PDFs)
- Each shared copy has a **unique watermark** tied to the share code
- If a document leaks, the watermark reveals which share link was compromised

---

### 4.3 Anti-Abuse Protections

| Protection | Details |
|---|---|
| **Rate limiting** | Max 5 code attempts per IP per 15 minutes |
| **Exponential backoff** | After 3 failed attempts: 30s, 60s, 120s delays |
| **CAPTCHA** | After 3 failed PIN entries |
| **IP blocking** | Temporary ban after 10 failed attempts in 1 hour |
| **Code entropy** | 5-char alphanumeric = 36⁵ = ~60 million combinations |
| **Code expiry** | Share codes auto-expire after configurable TTL |

### Brute-Force Resistance Analysis

```
Share code: 5 alphanumeric characters (a-z, 0-9)
Combinations: 36^5 = 60,466,176
Rate limit: 5 attempts / 15 min = 20 attempts / hour

Time to brute-force: 60,466,176 / 20 = 3,023,308 hours ≈ 345 years

With PIN (4 digits): 60,466,176 × 10,000 = 604,661,760,000
Time: Effectively impossible within any practical timeframe
```

---

### 4.4 Audit Logging

Every access to a shared link is logged in `shared_link_access_log`:

| Logged Data | Purpose |
|---|---|
| **Accessor IP** | Geographic identification |
| **User-Agent** | Device/browser identification |
| **Timestamp** | Temporal analysis |
| **Access result** | Success / failure / expired / revoked |

The sender can view the full access history for any shared link, enabling them to:
- See who accessed their documents and when
- Detect suspicious access patterns
- Make informed decisions about revocation

---

### 4.5 Consent & Revocation

| Feature | Behavior |
|---|---|
| **Explicit consent** | User must confirm before any document is shared |
| **Granular selection** | User selects exactly which documents to include |
| **Real-time revocation** | Sender can revoke a share link at any time |
| **Instant effect** | Revocation takes effect immediately — server deletes encrypted blob |
| **Notification** | Sender notified when shared docs are accessed |
| **Audit trail** | Full history preserved even after revocation |

---

## 5. AI Security

### 5.1 On-Device Model Execution

```mermaid
graph TB
    subgraph Device["User's Device (100% Local)"]
        UI["Chat Interface"]
        Engine["Inference Engine<br/>(ONNX Runtime / TFLite)"]
        Model["LLM Weights<br/>(Cached on device)"]
        Tools["Tool Functions<br/>(Document operations)"]
        DB["SQLite Database<br/>(Metadata only)"]
    end

    subgraph Never["❌ NEVER Leaves Device"]
        Cloud["Cloud API"]
        Analytics["Analytics"]
        Training["Training Pipeline"]
    end

    UI --> Engine
    Engine --> Model
    Engine --> Tools
    Tools --> DB

    Engine -.->|"BLOCKED"| Cloud
    Engine -.->|"BLOCKED"| Analytics
    Engine -.->|"BLOCKED"| Training

    style Cloud fill:#e74c3c,color:#fff
    style Analytics fill:#e74c3c,color:#fff
    style Training fill:#e74c3c,color:#fff
    style Device fill:#e8f5e9
```

| Property | Guarantee |
|---|---|
| **Model location** | 100% on-device — no cloud API calls |
| **Inference** | Runs locally via ONNX Runtime or TFLite |
| **Data sent to servers** | None — zero bytes |
| **Model updates** | Downloaded as app update, verified with checksum |

---

### 5.2 Data Boundary Enforcement

The AI assistant operates under strict data access boundaries:

| Data Type | AI Can Access? | Mechanism |
|---|---|---|
| Document **metadata** (name, type, size, tags, dates) | ✅ Yes | Via tool calls to DocumentDAO |
| Document **content** (actual file bytes, OCR text) | ❌ No | Not exposed as a tool |
| Document **thumbnails** | ❌ No | Not exposed as a tool |
| Folder structure | ✅ Yes | Via tool calls to FolderDAO |
| AI conversation history | ✅ Yes | Own conversation context |
| App settings | ✅ Yes | Read-only via SettingsDAO |
| Encryption keys | ❌ No | Not accessible from DAO layer |
| File system paths | ❌ No | Only relative paths via metadata |

> [!IMPORTANT]
> The AI assistant can help organize, search, and manage documents using metadata, but it **cannot read the actual content** of any document. This is an architectural boundary, not just a policy — the tool functions simply don't provide content access.

---

### 5.3 Tool Call Authorization

AI tool calls are categorized by risk level:

| Risk Level | Examples | Authorization Required |
|---|---|---|
| 🟢 **Read** | Search docs, list folders, get metadata | None — automatic |
| 🟡 **Modify** | Rename doc, move to folder, add tag | None — automatic |
| 🔴 **Destructive** | Delete doc, merge/split, clear conversations | **User confirmation required** |

### Confirmation Flow

```mermaid
sequenceDiagram
    participant User
    participant AI as AI Assistant
    participant Confirm as Confirmation Dialog
    participant Tool as Tool Function

    User->>AI: "Delete all expired documents"
    AI->>AI: Plan: call delete_documents tool
    AI->>Confirm: Request confirmation
    Confirm->>User: "AI wants to delete 5 documents. Confirm?"
    
    alt User approves
        User->>Confirm: ✅ Confirm
        Confirm->>Tool: Execute delete
        Tool->>AI: Result
        AI->>User: "Done! 5 documents deleted."
    else User denies
        User->>Confirm: ❌ Cancel
        Confirm->>AI: Denied
        AI->>User: "No problem, I didn't delete anything."
    end
```

---

### 5.4 Model Integrity

| Measure | Implementation |
|---|---|
| **Checksum verification** | SHA-256 hash checked against known-good value before loading |
| **Signed model files** | Model weights signed with app's certificate |
| **No runtime modification** | Model weights are read-only |
| **Version pinning** | Specific model version tied to app version |
| **Integrity check on launch** | Hash verification on every cold start |

```typescript
async function verifyModelIntegrity(modelPath: string): Promise<boolean> {
  const expectedHash = BUNDLED_MODEL_HASHES[modelPath];
  const actualHash = await computeSHA256(modelPath);

  if (actualHash !== expectedHash) {
    console.error('Model integrity check failed!');
    await deleteCorruptedModel(modelPath);
    return false;
  }
  return true;
}
```

---

## 6. Privacy Principles

### Zero-Knowledge Architecture

```mermaid
graph LR
    subgraph UserDevice["User's Device"]
        App["Kagaz App"]
        Data["User Data"]
        AI["AI Model"]
    end

    subgraph KagazTeam["Kagaz Team"]
        NoAccess["❌ No Access to User Data"]
        NoLogs["❌ No Usage Logs"]
        NoAnalytics["❌ No Analytics"]
    end

    App --- Data
    App --- AI
    UserDevice -.->|"ZERO DATA FLOW"| KagazTeam

    style NoAccess fill:#e74c3c,color:#fff
    style NoLogs fill:#e74c3c,color:#fff
    style NoAnalytics fill:#e74c3c,color:#fff
    style UserDevice fill:#e8f5e9
```

### Privacy Commitments

| Principle | Description | Implementation |
|---|---|---|
| **Zero knowledge** | We never see, access, or process user data | No servers in V1; E2E encryption in V2 |
| **No server-side processing (V1)** | All processing happens on device | Offline architecture, no API calls |
| **User data ownership** | Users own 100% of their data at all times | Data stored only on user's device |
| **Export all data** | Users can export everything they've stored | Full backup export to ZIP/encrypted archive |
| **Delete all data** | Complete data erasure on request | One-tap: delete database + all files + secure storage |
| **Transparency** | Clear documentation of what's stored and where | In-app "Data & Privacy" section |
| **No tracking** | Zero analytics, telemetry, or usage reporting | No analytics SDKs, no tracking pixels |
| **No advertising** | No ad networks, no user profiling | No ad SDKs integrated |
| **Minimal permissions** | Only request permissions that are strictly needed | Camera, storage — no location, contacts, etc. |

### Data Erasure Procedure

When a user chooses "Delete All Data":

```typescript
async function eraseAllData(): Promise<void> {
  // 1. Close database connection
  await db.close();

  // 2. Delete the encrypted database file
  await Filesystem.deleteFile({ path: 'kagaz.db', directory: Directory.Data });

  // 3. Delete all document files
  await Filesystem.rmdir({
    path: 'documents',
    directory: Directory.Data,
    recursive: true,
  });

  // 4. Delete all thumbnails
  await Filesystem.rmdir({
    path: 'thumbnails',
    directory: Directory.Data,
    recursive: true,
  });

  // 5. Delete all backups
  await Filesystem.rmdir({
    path: 'backups',
    directory: Directory.Data,
    recursive: true,
  });

  // 6. Clear secure storage (encryption keys)
  await SecureStoragePlugin.clear();

  // 7. Clear any in-memory caches
  clearAllCaches();

  // 8. Reset app to first-launch state
  navigateToOnboarding();
}
```

> [!CAUTION]
> Data erasure is **irreversible**. The app must present a multi-step confirmation (type "DELETE" to confirm) before executing this procedure. Consider prompting the user to create a backup first.

---

## 7. Security Architecture Diagram

```mermaid
graph TB
    subgraph Layer1["Layer 1: Physical Security"]
        DeviceLock["Device Lock<br/>(PIN / Biometric)"]
        Encryption["Full-Disk Encryption<br/>(OS-level)"]
    end

    subgraph Layer2["Layer 2: App Security"]
        AppLock["App Biometric Lock"]
        Screenshot["Screenshot Prevention"]
        AppSwitch["App Switcher Blur"]
        RootDetect["Root/Jailbreak Detection"]
    end

    subgraph Layer3["Layer 3: Data Security"]
        SQLCipher["SQLCipher Encryption<br/>(AES-256-CBC)"]
        SecureStore["Secure Key Storage<br/>(Keychain / Keystore)"]
        DocLock["Per-Document Lock"]
    end

    subgraph Layer4["Layer 4: Network Security (V2)"]
        E2E["E2E Encryption"]
        TLS["TLS 1.3"]
        CertPin["Certificate Pinning"]
        RateLimit["Rate Limiting"]
    end

    subgraph Layer5["Layer 5: AI Security"]
        OnDevice["On-Device Inference"]
        DataBound["Data Boundaries"]
        ToolAuth["Tool Authorization"]
        ModelVerify["Model Integrity"]
    end

    Layer1 --> Layer2
    Layer2 --> Layer3
    Layer3 --> Layer4
    Layer4 --> Layer5

    style Layer1 fill:#1a5276,color:#fff
    style Layer2 fill:#1e8449,color:#fff
    style Layer3 fill:#b7950b,color:#fff
    style Layer4 fill:#a93226,color:#fff
    style Layer5 fill:#6c3483,color:#fff
```

---

## 8. Security Checklist by Version

### V1 — Local Security

| # | Item | Status | Priority |
|---|---|---|---|
| 1 | App-level biometric authentication | 🔲 | P0 |
| 2 | SQLCipher database encryption | 🔲 | P0 |
| 3 | Secure key storage (Keychain/Keystore) | 🔲 | P0 |
| 4 | Per-document biometric lock | 🔲 | P0 |
| 5 | Screenshot prevention | 🔲 | P1 |
| 6 | App switcher content blur | 🔲 | P1 |
| 7 | Temp file cleanup | 🔲 | P1 |
| 8 | No network permissions | 🔲 | P0 |
| 9 | No analytics SDKs | 🔲 | P0 |
| 10 | Root/jailbreak detection (warning) | 🔲 | P2 |
| 11 | Encrypted backup export | 🔲 | P1 |
| 12 | Full data erasure | 🔲 | P1 |
| 13 | CSP headers blocking outbound | 🔲 | P0 |

### V2 — Sharing Security

| # | Item | Status | Priority |
|---|---|---|---|
| 14 | End-to-end encryption for shares | 🔲 | P0 |
| 15 | TLS 1.3 with certificate pinning | 🔲 | P0 |
| 16 | Time-limited access (TTL) | 🔲 | P0 |
| 17 | Access count limits | 🔲 | P1 |
| 18 | PIN-protected shares | 🔲 | P1 |
| 19 | Watermarking for leak prevention | 🔲 | P2 |
| 20 | Rate limiting (anti-brute-force) | 🔲 | P0 |
| 21 | Audit logging | 🔲 | P1 |
| 22 | Real-time revocation | 🔲 | P0 |
| 23 | CAPTCHA after failed attempts | 🔲 | P1 |

### AI Security (All Versions)

| # | Item | Status | Priority |
|---|---|---|---|
| 24 | On-device model execution only | 🔲 | P0 |
| 25 | Metadata-only access (no content) | 🔲 | P0 |
| 26 | User confirmation for destructive ops | 🔲 | P0 |
| 27 | No conversation data sent externally | 🔲 | P0 |
| 28 | Model checksum verification | 🔲 | P1 |
| 29 | Signed model weights | 🔲 | P2 |

---

## 9. Incident Response

### If a Security Vulnerability Is Discovered

| Step | Action | Responsible |
|---|---|---|
| 1 | **Identify** — Assess scope and severity | Security Lead |
| 2 | **Contain** — Disable affected feature if possible (via app update) | Dev Team |
| 3 | **Notify** — Inform affected users (if data exposure possible) | Product Lead |
| 4 | **Fix** — Develop and test patch | Dev Team |
| 5 | **Release** — Push emergency app update | Release Manager |
| 6 | **Post-mortem** — Document root cause and prevention measures | All |

### Severity Classification

| Severity | Definition | Response Time |
|---|---|---|
| **Critical** | User data exposure or bypass of encryption | < 24 hours |
| **High** | Authentication bypass, privilege escalation | < 48 hours |
| **Medium** | Information disclosure (metadata only) | < 1 week |
| **Low** | UI-level issues, non-sensitive info leak | Next release cycle |

---

*Security is not a feature — it's a foundation. Every architectural decision in Kagaz prioritizes user privacy and data protection above convenience or development speed.*
