import { randomUUID } from 'node:crypto';
import { ipcMain } from 'electron';
import type { EntriesRepository } from '../../db/repositories/entries-repository';
import { AppError } from '../../errors/app-error';
import { encryptEntryPassword, decryptEntryPassword } from '../../crypto/vault-crypto';
import type { VaultSession } from '../../crypto/vault-session';
import type { ClipboardService } from '../../platform/clipboard';
import { IPC_CHANNELS } from '../channels';
import {
  createEntrySchema,
  deleteEntrySchema,
  listEntriesByProfileSchema,
  updateEntrySchema,
} from '../../../shared/validation/entries';

export function registerEntryHandlers(input: {
  entriesRepository: EntriesRepository;
  vaultSession: VaultSession;
  clipboardService: ClipboardService;
}): void {
  const { entriesRepository, vaultSession, clipboardService } = input;

  ipcMain.handle(
    IPC_CHANNELS.entriesListByProfile,
    async (_event, payload: unknown) => {
      if (!vaultSession.isUnlocked()) {
        throw new AppError('VAULT_LOCKED', 'Vault is locked.');
      }

      const parsed = listEntriesByProfileSchema.parse(payload);
      return entriesRepository.listByProfile(parsed.profileId);
    },
  );

  ipcMain.handle(IPC_CHANNELS.entriesCreate, async (_event, payload: unknown) => {
    const parsed = createEntrySchema.parse(payload);

    if (!vaultSession.isUnlocked()) {
      throw new AppError('VAULT_LOCKED', 'Vault is locked.');
    }

    const vaultKey = vaultSession.getVaultKeyOrThrow();
    const encrypted = encryptEntryPassword({
      vaultKey,
      password: parsed.password,
    });

    return entriesRepository.create({
      id: randomUUID(),
      profileId: parsed.profileId,
      name: parsed.name,
      tagsJson: JSON.stringify(parsed.tags),
      ciphertext: encrypted.ciphertext,
      ivNonce: encrypted.iv,
      authTag: encrypted.authTag,
      keyVersion: 1,
      now: new Date().toISOString(),
    });
  });

  ipcMain.handle(IPC_CHANNELS.entriesUpdate, async (_event, payload: unknown) => {
    const parsed = updateEntrySchema.parse(payload);

    if (!vaultSession.isUnlocked()) {
      throw new AppError('VAULT_LOCKED', 'Vault is locked.');
    }

    const existingEntry = entriesRepository.getById(parsed.id);
    if (!existingEntry) {
      throw new AppError('ENTRY_NOT_FOUND', 'Entry not found.');
    }

    const vaultKey = vaultSession.getVaultKeyOrThrow();
    const encrypted = parsed.password
      ? encryptEntryPassword({
          vaultKey,
          password: parsed.password,
        })
      : {
          ciphertext: existingEntry.ciphertext,
          iv: existingEntry.iv_nonce,
          authTag: existingEntry.auth_tag,
        };

    return entriesRepository.update({
      id: parsed.id,
      profileId: parsed.profileId,
      name: parsed.name,
      tagsJson: JSON.stringify(parsed.tags),
      ciphertext: encrypted.ciphertext,
      ivNonce: encrypted.iv,
      authTag: encrypted.authTag,
      keyVersion: existingEntry.key_version,
      now: new Date().toISOString(),
    });
  });

  ipcMain.handle(IPC_CHANNELS.entriesDelete, async (_event, payload: unknown) => {
    if (!vaultSession.isUnlocked()) {
      throw new AppError('VAULT_LOCKED', 'Vault is locked.');
    }

    const parsed = deleteEntrySchema.parse(payload);
    entriesRepository.delete(parsed.id);
    return { ok: true as const };
  });

  ipcMain.handle(
    IPC_CHANNELS.entriesCopyPassword,
    async (_event, payload: unknown) => {
      const parsed = deleteEntrySchema.parse(payload);

      if (!vaultSession.isUnlocked()) {
        throw new AppError('VAULT_LOCKED', 'Vault is locked.');
      }

      const entry = entriesRepository.getById(parsed.id);
      if (!entry) {
        throw new AppError('ENTRY_NOT_FOUND', 'Entry not found.');
      }

      const vaultKey = vaultSession.getVaultKeyOrThrow();
      const password = decryptEntryPassword({
        vaultKey,
        ciphertext: entry.ciphertext,
        iv: entry.iv_nonce,
        authTag: entry.auth_tag,
      });

      clipboardService.writeText(password);

      return { ok: true as const };
    },
  );
}
