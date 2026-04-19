import { randomUUID } from 'node:crypto';
import { DEFAULT_KDF_PARAMS, deriveMasterKey, type KdfParams } from '../crypto/kdf';
import {
  generateSalt,
  generateVaultKey,
  wrapVaultKey,
  unwrapVaultKey,
} from '../crypto/vault-crypto';
import type { VaultSession } from '../crypto/vault-session';
import type { VaultMetadataRepository } from '../db/repositories/vault-metadata-repository';
import type { SafeStorageService } from '../platform/safe-storage';
import type {
  BootstrapStatus,
  VaultStatus,
  SetupVaultInput,
  UnlockVaultInput,
} from '../../shared/dto/vault';
import { AppError } from '../errors/app-error';

export class VaultService {
  constructor(
    private readonly vaultMetadataRepository: VaultMetadataRepository,
    private readonly vaultSession: VaultSession,
    private readonly safeStorageService: SafeStorageService,
  ) {}

  tryTrustedDeviceUnlock(): void {
    const metadata = this.vaultMetadataRepository.get();
    if (!metadata || !metadata.trustedDeviceEnabled) {
      return;
    }

    const vaultKey = this.safeStorageService.loadTrustedDeviceSecret();
    if (!vaultKey) {
      return;
    }

    this.vaultSession.setVaultKey(vaultKey);
  }

  getBootstrapStatus(): BootstrapStatus {
    const metadata = this.vaultMetadataRepository.get();

    if (!metadata) {
      return { kind: 'needs-setup' };
    }

    if (this.vaultSession.isUnlocked()) {
      return {
        kind: 'unlocked',
        selectedProfileId: null,
      };
    }

    return {
      kind: 'locked',
      trustedDeviceAvailable: this.safeStorageService.canUseTrustedDeviceUnlock(),
    };
  }

  getVaultStatus(): VaultStatus {
    const metadata = this.vaultMetadataRepository.get();
    if (!metadata) {
      return { state: 'needs-setup' };
    }

    return {
      state: this.vaultSession.isUnlocked() ? 'unlocked' : 'locked',
    };
  }

  async setupVault(input: SetupVaultInput): Promise<{ ok: true }> {
    if (this.vaultMetadataRepository.get()) {
      throw new AppError('VAULT_ALREADY_EXISTS', 'Vault already exists.');
    }

    const vaultKey = generateVaultKey();
    const kdfSalt = generateSalt();
    const masterDerivedKey = await deriveMasterKey({
      masterPassword: input.masterPassword,
      salt: kdfSalt,
      params: DEFAULT_KDF_PARAMS,
    });
    const wrapped = wrapVaultKey({
      masterDerivedKey,
      vaultKey,
    });
    const now = new Date().toISOString();

    this.vaultMetadataRepository.create({
      vaultId: randomUUID(),
      kdfAlgorithm: DEFAULT_KDF_PARAMS.algorithm,
      kdfParamsJson: JSON.stringify(DEFAULT_KDF_PARAMS),
      kdfSalt,
      wrappedVaultKey: wrapped.ciphertext,
      wrappedVaultKeyIv: wrapped.iv,
      wrappedVaultKeyAuthTag: wrapped.authTag,
      keyVersion: 1,
      trustedDeviceEnabled:
        input.enableTrustedDeviceUnlock &&
        this.safeStorageService.canUseTrustedDeviceUnlock(),
      createdAt: now,
      updatedAt: now,
    });

    this.vaultSession.setVaultKey(vaultKey);

    if (
      input.enableTrustedDeviceUnlock &&
      this.safeStorageService.canUseTrustedDeviceUnlock()
    ) {
      this.safeStorageService.saveTrustedDeviceSecret(vaultKey);
    }

    return { ok: true };
  }

  async unlockVault(input: UnlockVaultInput): Promise<{ ok: true }> {
    const metadata = this.vaultMetadataRepository.get();
    if (!metadata) {
      throw new AppError('VALIDATION_ERROR', 'Vault has not been set up yet.');
    }

    const masterDerivedKey = await deriveMasterKey({
      masterPassword: input.masterPassword,
      salt: metadata.kdfSalt,
      params: JSON.parse(metadata.kdfParamsJson) as KdfParams,
    });

    try {
      const vaultKey = unwrapVaultKey({
        masterDerivedKey,
        wrappedVaultKey: metadata.wrappedVaultKey,
        iv: metadata.wrappedVaultKeyIv,
        authTag: metadata.wrappedVaultKeyAuthTag,
      });

      this.vaultSession.setVaultKey(vaultKey);
    } catch {
      throw new AppError('INVALID_PASSWORD', 'The master password is invalid.');
    }

    return { ok: true };
  }

  lockVault(): { ok: true } {
    this.vaultSession.lock();
    return { ok: true };
  }

  setTrustedDeviceUnlock(enabled: boolean): { ok: true } {
    if (enabled && !this.safeStorageService.canUseTrustedDeviceUnlock()) {
      throw new AppError(
        'TRUSTED_DEVICE_UNAVAILABLE',
        'Trusted-device unlock is not available on this system.',
      );
    }

    const metadata = this.vaultMetadataRepository.get();
    if (!metadata) {
      throw new AppError('VALIDATION_ERROR', 'Vault has not been set up yet.');
    }

    this.vaultMetadataRepository.updateTrustedDeviceEnabled(
      enabled,
      new Date().toISOString(),
    );

    if (enabled) {
      if (!this.vaultSession.isUnlocked()) {
        throw new AppError('VAULT_LOCKED', 'Vault must be unlocked first.');
      }

      const vaultKey = this.vaultSession.getVaultKeyOrThrow();
      this.safeStorageService.saveTrustedDeviceSecret(vaultKey);
    } else {
      this.safeStorageService.clearTrustedDeviceSecret();
    }

    return { ok: true };
  }
}
