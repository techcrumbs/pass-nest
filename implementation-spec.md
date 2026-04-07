# PassNest Implementation Spec

## Scope

This document converts the high-level design into a concrete implementation plan for the v1 PassNest desktop application.

This spec assumes:

- Greenfield repository
- Electron as the desktop shell
- TypeScript across main, preload, renderer, and shared code
- SQLite stored at `~/.passnest/passnest.db`
- `tags_json` for v1 instead of normalized tag tables
- Master password required at setup
- Optional trusted-device unlock only when OS secure storage is trustworthy

## Current Bootstrap Variant

The first implementation slice is using Node built-ins where practical to reduce Electron native-module friction during initial scaffolding:

- SQLite access: `node:sqlite`
- Password-based KDF in code today: `scrypt`

The security design target still prefers `Argon2id` for the master-password KDF. Once the Electron packaging toolchain is stable, we can evaluate whether moving to an Argon2id dependency is worth the added native-module complexity.

## MVP Decisions

The following product and implementation choices are fixed for v1:

- No password reveal in the UI
- One local vault per OS user profile
- One selected profile at a time in the main list view
- Clipboard copy is the only way to use a stored password
- Entry secrets are encrypted with a random vault key
- The vault key is wrapped by a key derived from the master password
- OS secure storage is convenience-only and not the canonical unlock path

## Proposed Project Layout

```text
pass-nest/
  src/
    main/
      bootstrap/
        app-paths.ts
        init-app.ts
      crypto/
        kdf.ts
        vault-crypto.ts
        vault-session.ts
      db/
        client.ts
        migrate.ts
        schema.ts
        repositories/
          entries-repository.ts
          profiles-repository.ts
          vault-metadata-repository.ts
      ipc/
        channels.ts
        handlers/
          entries.ts
          profiles.ts
          vault.ts
      platform/
        clipboard.ts
        safe-storage.ts
      main.ts
    preload/
      index.ts
      api-types.ts
    renderer/
      app/
        App.tsx
        routes.tsx
      components/
        ProfileSelect.tsx
        EntryList.tsx
        EntryRow.tsx
        EmptyState.tsx
        UnlockScreen.tsx
        CreateEntryDialog.tsx
        EditEntryDialog.tsx
        ProfileDialog.tsx
      hooks/
        useProfiles.ts
        useEntries.ts
        useVaultStatus.ts
      state/
        ui-store.ts
      styles/
        globals.css
      index.tsx
    shared/
      dto/
        entries.ts
        profiles.ts
        vault.ts
      validation/
        entries.ts
        profiles.ts
        vault.ts
      constants/
        crypto.ts
        ipc.ts
```

## Responsibilities By Layer

### `src/main`

Owns all privileged operations:

- filesystem access
- SQLite access
- cryptography
- Electron clipboard operations
- trusted-device secret storage
- IPC handler registration

### `src/preload`

Exposes a narrow `window.passNest` bridge to the renderer with typed methods only.

### `src/renderer`

Owns the user interface and local view state. It must never:

- open SQLite directly
- call Node APIs directly
- perform cryptographic operations on stored vault data

### `src/shared`

Contains shared DTOs, channel names, and input validation schemas that can be imported from both privileged and unprivileged code.

## App Bootstrap Sequence

Startup order:

1. Electron app becomes ready
2. Ensure `~/.passnest` exists
3. Open SQLite database at `~/.passnest/passnest.db`
4. Run pending migrations
5. Initialize platform services:
   - clipboard service
   - safe storage service
   - in-memory vault session store
6. Register IPC handlers
7. Create browser window with hardened security settings
8. Renderer asks for bootstrap status:
   - first run
   - locked
   - unlocked
   - trusted-device-unlock-available

## Browser Window Security Settings

The Electron browser window should be created with:

- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`
- `webSecurity: true`
- `allowRunningInsecureContent: false`

The preload script is the only bridge between renderer and privileged APIs.

## Filesystem Layout

Directory:

- `~/.passnest/`

Files:

- `passnest.db`
- future migrations or logs only if needed

Do not create plaintext export files, temp decrypted files, or local JSON mirrors of vault entries.

## Database Choice And Access

Use a synchronous SQLite client from the Electron main process so all database work stays centralized and deterministic.

Selection criteria:

- stable Electron compatibility
- parameterized query support
- transaction support
- predictable local packaging

The renderer must never talk to SQLite directly.

## Migration Strategy

Use numbered SQL or code-driven migrations tracked in a dedicated migration table.

Required migration table:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
```

Migration rules:

- migrations are append-only
- no in-place editing of applied migrations
- each migration runs in a transaction
- startup fails if a migration cannot complete cleanly

## Initial DDL

### `profiles`

```sql
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(name)
);
```

Notes:

- `id` should be an opaque string such as UUID or ULID
- `name` is globally unique for v1

### `entries`

```sql
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  name TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  ciphertext BLOB NOT NULL,
  iv_nonce BLOB NOT NULL,
  auth_tag BLOB NOT NULL,
  key_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);
```

Recommended indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_entries_profile_id ON entries(profile_id);
CREATE INDEX IF NOT EXISTS idx_entries_profile_name ON entries(profile_id, name);
```

### `vault_metadata`

```sql
CREATE TABLE IF NOT EXISTS vault_metadata (
  vault_id TEXT PRIMARY KEY,
  kdf_algorithm TEXT NOT NULL,
  kdf_params_json TEXT NOT NULL,
  kdf_salt BLOB NOT NULL,
  wrapped_vault_key BLOB NOT NULL,
  wrapped_vault_key_iv BLOB NOT NULL,
  wrapped_vault_key_auth_tag BLOB NOT NULL,
  password_verifier BLOB,
  password_verifier_salt BLOB,
  key_version INTEGER NOT NULL,
  trusted_device_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Notes:

- `password_verifier` is optional for v1
- only one row is expected in v1
- `kdf_params_json` stores the Argon2id settings

## Data Model Types

### Profile

```ts
type ProfileRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};
```

### Entry

```ts
type EntryRecord = {
  id: string;
  profileId: string;
  name: string;
  tagsJson: string;
  ciphertext: Buffer;
  ivNonce: Buffer;
  authTag: Buffer;
  keyVersion: number;
  createdAt: string;
  updatedAt: string;
};
```

### Vault Metadata

```ts
type VaultMetadataRecord = {
  vaultId: string;
  kdfAlgorithm: string;
  kdfParamsJson: string;
  kdfSalt: Buffer;
  wrappedVaultKey: Buffer;
  wrappedVaultKeyIv: Buffer;
  wrappedVaultKeyAuthTag: Buffer;
  passwordVerifier: Buffer | null;
  passwordVerifierSalt: Buffer | null;
  keyVersion: number;
  trustedDeviceEnabled: 0 | 1;
  createdAt: string;
  updatedAt: string;
};
```

## Crypto Spec

### Algorithms

- Entry encryption: `AES-256-GCM`
- Vault key size: `32` bytes
- Entry IV size: `12` bytes
- Wrapped vault key IV size: `12` bytes
- Master password KDF: `Argon2id`

### KDF Configuration

Store the KDF configuration per vault so future upgrades remain possible.

Suggested config object:

```ts
type Argon2Params = {
  memoryCostKiB: number;
  timeCost: number;
  parallelism: number;
  hashLength: number;
};
```

Initial target:

```ts
const DEFAULT_KDF_PARAMS = {
  algorithm: 'scrypt',
  cost: 16384,
  blockSize: 8,
  parallelization: 1,
  keyLength: 32,
} as const;
```

### Entry Encryption Payload

The password value is encrypted before persistence.

Algorithm:

1. Generate random `ivNonce`
2. Encrypt plaintext password using `vaultKey`
3. Capture `ciphertext`
4. Capture `authTag`
5. Save all three in `entries`

Associated data is optional in v1. We can add profile or entry identifiers as AAD later if desired.

### Vault Key Wrapping

The vault key is wrapped using a key derived from the master password:

1. Generate random `kdfSalt`
2. Derive `masterDerivedKey` with Argon2id
3. Generate `wrappedVaultKeyIv`
4. Encrypt the raw `vaultKey` using `masterDerivedKey` with AES-256-GCM
5. Store:
   - `wrapped_vault_key`
   - `wrapped_vault_key_iv`
   - `wrapped_vault_key_auth_tag`
   - `kdf_salt`
   - `kdf_params_json`

### In-Memory Session Rules

When unlocked:

- keep the decrypted `vaultKey` in memory only in the main process
- never persist the plaintext `vaultKey`
- never expose the plaintext `vaultKey` to the renderer

When locking:

- zero or release the in-memory key material as best as the runtime allows
- clear unlock state
- cancel pending trusted-device auto-unlock timers if present

## Trusted Device Unlock

### Purpose

Trusted-device unlock reduces repeated master password prompts on machines with real OS-backed secure storage.

### Allowed Behavior

If safe storage is available and backed by a trustworthy platform backend:

- user may opt into "Remember unlock on this device"
- app may store a device-wrapped convenience secret in OS secure storage

### Disallowed Behavior

- do not rely on OS-only unlock as the sole source of truth
- do not enable trusted-device unlock when the safe storage backend is weak

### Stored OS Secret

For v1, store a device-wrapped copy of the vault key in OS secure storage under a stable service/account label.

Suggested label:

- service: `PassNest`
- account: `vault-key:<vaultId>`

### Trusted Device Unlock Flow

1. App starts
2. App checks whether trusted-device unlock is enabled in `vault_metadata`
3. App checks whether platform safe storage is available
4. On Linux, app verifies backend is not weak fallback
5. App reads the device secret from OS secure storage
6. If successful, app restores the vault key into in-memory session state
7. If any step fails, app falls back to locked state and prompts for master password

## Unlock State Machine

Use a small explicit state machine in the main process.

States:

- `uninitialized`
- `needs-setup`
- `locked`
- `unlocking`
- `unlocked`
- `error`

Transitions:

1. `uninitialized -> needs-setup`
   Trigger: no `vault_metadata` row exists
2. `uninitialized -> locked`
   Trigger: vault exists but no trusted-device unlock was used
3. `uninitialized -> unlocking`
   Trigger: trusted-device unlock attempt starts
4. `unlocking -> unlocked`
   Trigger: trusted-device secret succeeds
5. `unlocking -> locked`
   Trigger: trusted-device secret fails
6. `locked -> unlocking`
   Trigger: user submits master password
7. `unlocking -> unlocked`
   Trigger: master password unwrap succeeds
8. `unlocking -> locked`
   Trigger: master password unwrap fails
9. `unlocked -> locked`
   Trigger: manual lock, timeout lock, or safe-storage error requiring relock

## IPC Contract

IPC should be request/response oriented and explicitly versioned by channel naming.

Suggested namespace:

- `vault:*`
- `profiles:*`
- `entries:*`
- `app:*`

### App Channels

```ts
type BootstrapStatus =
  | { kind: 'needs-setup' }
  | {
      kind: 'locked';
      trustedDeviceAvailable: boolean;
    }
  | {
      kind: 'unlocked';
      selectedProfileId: string | null;
    };
```

Methods:

- `app:getBootstrapStatus(): Promise<BootstrapStatus>`

### Vault Channels

Setup request:

```ts
type SetupVaultInput = {
  masterPassword: string;
  enableTrustedDeviceUnlock: boolean;
};
```

Unlock request:

```ts
type UnlockVaultInput = {
  masterPassword: string;
};
```

Methods:

- `vault:setup(input: SetupVaultInput): Promise<{ ok: true }>`
- `vault:unlock(input: UnlockVaultInput): Promise<{ ok: true } | { ok: false; code: 'INVALID_PASSWORD' }>`
- `vault:lock(): Promise<{ ok: true }>`
- `vault:getStatus(): Promise<{ state: 'needs-setup' | 'locked' | 'unlocked' }>`
- `vault:setTrustedDeviceUnlock(input: { enabled: boolean }): Promise<{ ok: true } | { ok: false; code: 'UNAVAILABLE' }>`

### Profile Channels

```ts
type CreateProfileInput = {
  name: string;
};

type UpdateProfileInput = {
  id: string;
  name: string;
};
```

Methods:

- `profiles:list(): Promise<ProfileDto[]>`
- `profiles:create(input: CreateProfileInput): Promise<ProfileDto>`
- `profiles:update(input: UpdateProfileInput): Promise<ProfileDto>`
- `profiles:delete(input: { id: string }): Promise<{ ok: true }>`

Deletion policy for v1:

- deleting a profile cascades and deletes contained entries
- UI must require explicit confirmation

### Entry Channels

```ts
type EntryDto = {
  id: string;
  profileId: string;
  name: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type CreateEntryInput = {
  profileId: string;
  name: string;
  password: string;
  tags: string[];
};

type UpdateEntryInput = {
  id: string;
  profileId: string;
  name: string;
  password?: string;
  tags: string[];
};
```

Methods:

- `entries:listByProfile(input: { profileId: string }): Promise<EntryDto[]>`
- `entries:create(input: CreateEntryInput): Promise<EntryDto>`
- `entries:update(input: UpdateEntryInput): Promise<EntryDto>`
- `entries:delete(input: { id: string }): Promise<{ ok: true }>`
- `entries:copyPassword(input: { id: string }): Promise<{ ok: true }>`

Important response rule:

- entry DTOs returned to the renderer never include decrypted password values

## Validation Rules

Centralize validation in `src/shared/validation`.

### Profile Rules

- name is required
- trim surrounding whitespace
- minimum length: `1`
- maximum length: `80`

### Entry Rules

- `profileId` is required
- `name` is required
- `name` max length: `120`
- `password` is required on create
- `password` max length should be generous enough for generated secrets
- `tags` max count: `20`
- each tag should be trimmed and deduplicated
- each tag max length: `40`

### Master Password Rules

- minimum length for v1: `12`
- allow passphrases
- no forced composition rules

## Repository Interfaces

Define repository interfaces early so the rest of the main process is easy to test.

Example:

```ts
interface ProfilesRepository {
  list(): ProfileRecord[];
  create(input: { id: string; name: string; now: string }): ProfileRecord;
  update(input: { id: string; name: string; now: string }): ProfileRecord;
  delete(id: string): void;
}

interface EntriesRepository {
  listByProfile(profileId: string): EntryRecord[];
  create(input: EntryRecord): EntryRecord;
  update(input: EntryRecord): EntryRecord;
  delete(id: string): void;
  findById(id: string): EntryRecord | null;
}

interface VaultMetadataRepository {
  get(): VaultMetadataRecord | null;
  create(input: VaultMetadataRecord): void;
  updateTrustedDeviceEnabled(enabled: boolean, now: string): void;
}
```

## Service Interfaces

### Crypto Service

```ts
interface VaultCryptoService {
  deriveMasterKey(input: {
    masterPassword: string;
    salt: Buffer;
    params: Argon2Params;
  }): Promise<Buffer>;
  wrapVaultKey(input: {
    vaultKey: Buffer;
    masterDerivedKey: Buffer;
  }): {
    wrappedVaultKey: Buffer;
    iv: Buffer;
    authTag: Buffer;
  };
  unwrapVaultKey(input: {
    wrappedVaultKey: Buffer;
    iv: Buffer;
    authTag: Buffer;
    masterDerivedKey: Buffer;
  }): Buffer;
  encryptEntryPassword(input: {
    vaultKey: Buffer;
    plaintext: string;
  }): {
    ciphertext: Buffer;
    iv: Buffer;
    authTag: Buffer;
  };
  decryptEntryPassword(input: {
    vaultKey: Buffer;
    ciphertext: Buffer;
    iv: Buffer;
    authTag: Buffer;
  }): string;
}
```

### Session Service

```ts
interface VaultSessionService {
  isUnlocked(): boolean;
  setVaultKey(vaultKey: Buffer): void;
  getVaultKeyOrThrow(): Buffer;
  lock(): void;
}
```

### Safe Storage Service

```ts
interface SafeStorageService {
  isAvailable(): boolean;
  canUseTrustedDeviceUnlock(): boolean;
  saveTrustedDeviceSecret(input: { vaultId: string; vaultKey: Buffer }): void;
  loadTrustedDeviceSecret(input: { vaultId: string }): Buffer | null;
  clearTrustedDeviceSecret(input: { vaultId: string }): void;
  getBackendInfo(): { available: boolean; backend: string | null };
}
```

## Renderer UI Spec

### First-Run Setup Screen

Inputs:

- master password
- confirm master password
- remember unlock on this device checkbox, only when supported

Actions:

- create vault

### Locked Screen

Inputs:

- master password

Actions:

- unlock vault

Optional behavior:

- show whether trusted-device unlock is available but failed

### Main Screen

Regions:

- top bar with profile dropdown and profile actions
- entry list for selected profile
- button to create new entry
- lock action

### Entry List Row

Visible data:

- entry name
- tags
- copy button
- edit button
- delete button

Never visible:

- password value

### Empty States

- no profiles yet
- no entries in selected profile
- locked vault

## Clipboard Behavior

Copy flow:

1. renderer requests `entries:copyPassword`
2. main process decrypts selected entry
3. main process writes password to clipboard
4. main process returns success result
5. renderer shows toast

Optional hardening for v1.1:

- auto-clear clipboard after `30` to `60` seconds

## Error Handling

Use structured application errors from the main process.

Suggested codes:

- `INVALID_PASSWORD`
- `VAULT_LOCKED`
- `ENTRY_NOT_FOUND`
- `PROFILE_NOT_FOUND`
- `DUPLICATE_PROFILE_NAME`
- `TRUSTED_DEVICE_UNAVAILABLE`
- `VALIDATION_ERROR`
- `INTERNAL_ERROR`

Renderer should map these to human-friendly messages without exposing sensitive internal details.

## Logging Rules

Allowed logs:

- app startup
- migration progress
- IPC request timing
- non-sensitive error diagnostics

Forbidden logs:

- plaintext passwords
- master passwords
- decrypted vault key material
- ciphertext buffers dumped in full

## Testing Strategy

### Unit Tests

- Argon2 parameter encoding and decoding
- vault key wrap and unwrap
- entry encryption and decryption
- validation schemas
- repository CRUD behavior
- state machine transitions

### Integration Tests

- first-run vault setup
- unlock with valid master password
- unlock failure with invalid master password
- create profile and list profiles
- create entry and list by profile
- copy password while unlocked
- reject entry actions while locked

### Manual Verification

- database created under `~/.passnest`
- raw passwords are absent from SQLite
- trusted-device unlock is disabled on weak backend
- locking the vault blocks create, edit, delete, and copy actions

## Delivery Plan

### Phase 1

- scaffold Electron + TypeScript app
- establish build tooling
- add window security defaults

### Phase 2

- implement app paths
- implement SQLite client and migrations
- implement repositories

### Phase 3

- implement crypto services
- implement vault setup and unlock
- implement trusted-device service

### Phase 4

- implement preload bridge
- implement renderer setup and unlock screens

### Phase 5

- implement profile CRUD
- implement entry CRUD
- implement copy-to-clipboard flow

### Phase 6

- add tests
- harden error handling
- polish UX around lock and setup flows

## Immediate Next Build Step

The next coding task after this spec should be:

1. scaffold the Electron + TypeScript project structure
2. add the initial migration with the tables defined here
3. implement the app bootstrap status flow
4. stub the preload API and locked/setup screens
