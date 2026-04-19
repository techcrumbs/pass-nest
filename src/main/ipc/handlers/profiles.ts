import { randomUUID } from 'node:crypto';
import { ipcMain } from 'electron';
import type { ProfilesRepository } from '../../db/repositories/profiles-repository';
import type { VaultSession } from '../../crypto/vault-session';
import { AppError } from '../../errors/app-error';
import { IPC_CHANNELS } from '../channels';
import {
  createProfileSchema,
  deleteByIdSchema,
  updateProfileSchema,
} from '../../../shared/validation/profiles';

export function registerProfileHandlers(
  profilesRepository: ProfilesRepository,
  vaultSession: VaultSession,
): void {
  ipcMain.handle(IPC_CHANNELS.profilesList, async () => {
    assertUnlocked(vaultSession);
    return profilesRepository.list();
  });

  ipcMain.handle(IPC_CHANNELS.profilesCreate, async (_event, input: unknown) => {
    assertUnlocked(vaultSession);
    const parsed = createProfileSchema.parse(input);

    try {
      return profilesRepository.create({
        id: randomUUID(),
        name: parsed.name,
        now: new Date().toISOString(),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes('unique')
      ) {
        throw new AppError(
          'DUPLICATE_PROFILE_NAME',
          'A profile with this name already exists.',
        );
      }

      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.profilesUpdate, async (_event, input: unknown) => {
    assertUnlocked(vaultSession);
    const parsed = updateProfileSchema.parse(input);

    try {
      return profilesRepository.update({
        id: parsed.id,
        name: parsed.name,
        now: new Date().toISOString(),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes('unique')
      ) {
        throw new AppError(
          'DUPLICATE_PROFILE_NAME',
          'A profile with this name already exists.',
        );
      }

      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.profilesDelete, async (_event, input: unknown) => {
    assertUnlocked(vaultSession);
    const parsed = deleteByIdSchema.parse(input);
    profilesRepository.delete(parsed.id);
    return { ok: true as const };
  });
}

function assertUnlocked(vaultSession: VaultSession): void {
  if (!vaultSession.isUnlocked()) {
    throw new AppError('VAULT_LOCKED', 'Vault is locked.');
  }
}
