# PassNest Design Document

## Overview

PassNest is a desktop password manager built with TypeScript and Node.js runtime support. The recommended application architecture is Electron + TypeScript so the app can provide a desktop UI, local filesystem access, secure clipboard integration, and OS-backed secret storage integration where available.

Core product requirements:

- Support logical grouping of passwords with profiles
- Each password entry has a name, password value, and tags
- The UI shows only entries for the currently selected profile
- Passwords are never displayed in plaintext in the UI
- Users copy passwords through a copy-to-clipboard action only
- Data is stored locally in a SQLite database under `~/.passnest`
- Raw passwords must never be stored in the database

## Goals

- Build a local-first desktop password manager
- Keep the implementation simple enough for an MVP
- Apply a security model appropriate for a password manager
- Preserve usability with optional trusted-device convenience

## Non-Goals For V1

- Cloud sync
- Password sharing
- Browser extensions
- Password reveal in the UI
- Multi-user collaboration
- Cross-device key recovery workflows

## Recommended Tech Stack

- Desktop framework: Electron
- Language: TypeScript
- Runtime: Node.js
- Database: SQLite
- Crypto primitives: Node.js `crypto`
- Optional password KDF library: Argon2id-capable package for Node/Electron

## Why Passwords Cannot Be Hashed Like Login Passwords

Typical user authentication passwords should be stored with a one-way password hashing algorithm such as Argon2id. A password manager is different because it must later recover the original saved site password in order to copy it to the clipboard. That means saved vault entries must be encrypted, not one-way hashed.

For PassNest:

- The master password should be used with a KDF
- The saved vault entries should be encrypted
- The actual secret values stored in the database should always be ciphertext

## Security Model

### Core Principle

Use a random vault key to encrypt all password entries. The user master password does not encrypt each entry directly. Instead, it derives a key that protects the vault key.

### Recommended Crypto Choices

- Entry encryption: `AES-256-GCM`
- Master password key derivation: `Argon2id`
- Vault key: random 32-byte symmetric key
- Entry IV/nonce: random 12 bytes per encrypted entry

### Why This Split Is Important

- The vault key is optimized for encrypting and decrypting entries
- The master password is human-chosen and must be strengthened through a KDF
- Using a separate vault key makes key rotation and future upgrades easier
- The database can be copied without exposing secrets, because entries remain encrypted

## Data Storage Design

PassNest stores app data in `~/.passnest/passnest.db`.

### SQLite Is Allowed To Store

- Profile metadata
- Entry metadata such as name and tags
- Encrypted password ciphertext
- IV/nonce for each encrypted value
- Authentication metadata needed by the encryption format
- Wrapped vault key and KDF metadata

### SQLite Must Never Store

- Plaintext password values
- Plaintext master password
- Reversible master password
- Long-lived plaintext vault key

## Key Management Model

### Source Of Truth

The master-password-wrapped vault key stored in SQLite is the source of truth.

### Optional Convenience Layer

OS secure storage is used only as an optional convenience layer for trusted-device unlock. It is not the canonical storage location of vault secrets.

This allows:

- Recovery with the master password even if OS keychain state changes
- Consistent cross-platform behavior
- Safer operation when OS secure storage quality varies by platform

## Master Password And KDF

`KDF` stands for Key Derivation Function.

In PassNest, the master password is fed into a KDF such as Argon2id together with a salt and configured parameters. The output is a strong derived key that is used to wrap and unwrap the vault key.

Conceptual flow:

1. User enters master password
2. App derives a key using Argon2id + salt + parameters
3. Derived key unwraps the vault key
4. Vault key encrypts and decrypts saved password entries

This means the user-chosen master password is not used directly as an AES key. Instead, the KDF strengthens the password and turns it into a fixed-size cryptographic key suitable for protecting the vault key.

## Encryption Flow

### Encryption Metadata Terms

#### `iv_nonce`

`iv_nonce` is the random per-encryption input used by `AES-256-GCM` when encrypting a password entry.

It is stored alongside the ciphertext because it is required for decryption later. It does not need to be secret, but it must be unique for each encryption operation performed with the same key.

In practice, each saved password entry stores:

- `ciphertext`: the encrypted password value
- `iv_nonce`: the random input used during encryption
- `auth_tag`: the integrity tag produced by `AES-256-GCM`

#### `auth_tag`

`auth_tag` is the authentication tag produced by `AES-256-GCM`.

It allows the app to verify that the encrypted value has not been modified or corrupted before returning the decrypted password. During decryption, the app uses the stored `ciphertext`, `iv_nonce`, `auth_tag`, and the in-memory vault key together.

### First-Time Setup

1. User creates a master password
2. App generates a random vault key
3. App generates a random salt for the KDF
4. App derives a key from the master password using Argon2id
5. App wraps the vault key with the derived key
6. App stores KDF parameters, salt, and wrapped vault key in SQLite
7. App keeps the plaintext vault key only in memory for the active session

### Saving A Password Entry

1. User submits entry name, password value, tags, and selected profile
2. App encrypts the password value using the in-memory vault key with AES-256-GCM
3. App stores ciphertext and associated metadata in SQLite
4. Plaintext password is discarded from memory as soon as practical

### Copying A Password Entry

1. User clicks the copy icon for an entry
2. App decrypts only that entry using the in-memory vault key
3. App copies the plaintext password to the clipboard
4. App discards the plaintext immediately after the clipboard action
5. Optional hardening: clear clipboard contents after a short timeout

## OS Secure Storage Strategy

Electron provides access to OS-backed secure storage via `safeStorage`.

Recommended policy:

- Require a master password for the vault
- Optionally allow "Remember unlock on this device" only when OS secure storage is actually trustworthy
- Do not rely on OS-only protection as the sole security layer

### What OS Secure Storage Can Hold

- A device-wrapped copy of the vault key
- Or a device-bound convenience secret used to speed up unlock

### What OS Secure Storage Should Not Replace

- The master-password-protected vault key stored in SQLite

### Linux Caveat

On Linux, secure storage quality can vary depending on the available secret service backend. If Electron reports a weak fallback backend such as `basic_text`, trusted-device unlock should be disabled and the app should require the master password on cold start.

## Proposed Database Schema

### `profiles`

- `id`
- `name`
- `created_at`
- `updated_at`

### `entries`

- `id`
- `profile_id`
- `name`
- `tags_json`
- `ciphertext`
- `iv_nonce`
- `auth_tag`
- `key_version`
- `created_at`
- `updated_at`

### `vault_metadata`

- `vault_id`
- `kdf_algorithm`
- `kdf_params`
- `kdf_salt`
- `wrapped_vault_key`
- `wrapped_vault_key_iv`
- `wrapped_vault_key_auth_tag`
- `key_version`
- `created_at`
- `updated_at`

## UI Design Notes

### Main Behavior

- A profile dropdown controls which profile is active
- Only passwords belonging to the selected profile are listed
- Each row shows:
  - entry name
  - tags
  - copy icon
- Password values are never rendered visibly in the UI

### Entry Actions

- Create password entry
- Edit password entry
- Delete password entry
- Copy password to clipboard

### Profile Actions

- Create profile
- Rename profile
- Delete profile

## Desktop App Architecture

### Main Process Responsibilities

- Database access
- Cryptographic operations
- Filesystem setup under `~/.passnest`
- Clipboard copy operation
- OS secure storage integration
- IPC request validation

`IPC` stands for Inter-Process Communication.

In Electron, the main process is the privileged process that can access Node.js APIs, SQLite, cryptographic services, and the operating system. The renderer process is the UI process. The renderer must ask the main process to perform privileged work through IPC instead of accessing those systems directly.

`IPC request validation` means the main process validates every renderer request before doing work such as:

- confirming required fields are present
- rejecting malformed input
- rejecting actions when the vault is locked
- limiting renderer access to only the approved API surface

### Preload Responsibilities

- Expose a minimal safe API to the renderer
- Prevent direct renderer access to Node.js or SQLite internals

Example API surface:

- `listProfiles()`
- `createProfile(name)`
- `listEntries(profileId)`
- `createEntry(input)`
- `updateEntry(input)`
- `deleteEntry(entryId)`
- `copyPassword(entryId)`
- `unlockVault(masterPassword)`
- `enableTrustedDeviceUnlock()`

### Example Request Flow

When a user clicks the copy icon in the UI, the request should flow like this:

1. Renderer calls a preload API such as `copyPassword(entryId)`
2. Preload forwards the request through Electron IPC
3. Main process IPC handler validates the request
4. Main process loads the encrypted entry from SQLite
5. Main process decrypts the password using the in-memory vault key
6. Main process writes the plaintext password to the clipboard
7. Main process returns success to the renderer

This keeps database access, decryption, and clipboard handling inside the privileged main process.

### Renderer Responsibilities

- Render UI
- Manage selected profile state
- Trigger safe preload APIs
- Never directly access raw secrets at rest

## Security Defaults For V1

- `contextIsolation: true`
- renderer sandbox enabled
- restrictive Content Security Policy
- no remote content
- no direct database access from the renderer
- narrow IPC contracts only
- decrypt entries only when needed
- clear sensitive values from memory when practical

## Suggested MVP Build Order

1. Scaffold Electron + TypeScript app
2. Create app directory bootstrap under `~/.passnest`
3. Add SQLite connection and migrations
4. Implement vault metadata and KDF setup
5. Implement encryption and decryption services
6. Build preload IPC bridge
7. Build profiles UI and filtered entry list
8. Implement create/edit/delete entry flows
9. Implement copy-to-clipboard behavior
10. Add tests for crypto, DB, and profile filtering

## Open Decisions

These should be finalized before implementation starts:

- Whether tags should start as `tags_json` or normalized relational tables
- Whether clipboard auto-clear is enabled by default
- Whether the app should lock automatically after inactivity
- Whether "Remember unlock on this device" is enabled by default when supported
- Whether profile deletion should also delete contained entries or require migration

## Recommended V1 Position

- Use Electron + TypeScript
- Use SQLite in `~/.passnest/passnest.db`
- Encrypt password values with `AES-256-GCM`
- Use `Argon2id` for master-password-based key derivation
- Keep the master-password-wrapped vault key in SQLite as the canonical unlock path
- Use OS secure storage only as an optional convenience layer on trusted backends

## Next Step

The next design artifact should be a technical implementation spec covering:

- project folder structure
- initial package list
- exact SQL DDL
- IPC contract definitions
- unlock state machine
- crypto helper interfaces

## Glossary

### `auth_tag`

The integrity value produced by `AES-256-GCM` during encryption. It is used during decryption to detect tampering or corruption.

### `ciphertext`

The encrypted form of a password value stored in SQLite instead of plaintext.

### `IPC`

Short for Inter-Process Communication. In Electron, IPC is how the renderer asks the privileged main process to perform actions such as database access, decryption, and clipboard operations.

### `iv_nonce`

The random input used during an encryption operation. It is stored with the ciphertext and must be unique per encryption under the same key.

### `KDF`

Short for Key Derivation Function. A KDF turns a human password plus a salt and parameters into a cryptographic key suitable for protecting other secrets.

### `main process`

The privileged Electron process that can access Node.js APIs, the filesystem, SQLite, clipboard services, and OS secure storage.

### `master password`

The password chosen by the user to unlock the vault. It is not stored in plaintext and is used to derive a key that unwraps the vault key.

### `preload`

The Electron script that safely exposes a narrow API from the main process to the renderer.

### `renderer`

The Electron UI process that renders the app interface. It should not directly access SQLite, cryptographic services, or raw Node.js APIs.

### `trusted-device unlock`

An optional convenience feature that uses OS secure storage to reduce repeated master password prompts on machines with a trustworthy secure storage backend.

### `vault key`

The random symmetric key used to encrypt and decrypt saved password entries. It is the primary data-encryption key for the vault.
