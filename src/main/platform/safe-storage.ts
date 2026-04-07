import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { safeStorage } from 'electron';

export class SafeStorageService {
  constructor(private readonly trustedDeviceSecretPath: string) {}

  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  getBackend(): string | null {
    if (
      typeof safeStorage.getSelectedStorageBackend === 'function'
    ) {
      return safeStorage.getSelectedStorageBackend();
    }

    return null;
  }

  canUseTrustedDeviceUnlock(): boolean {
    if (!this.isAvailable()) {
      return false;
    }

    if (process.platform === 'linux' && this.getBackend() === 'basic_text') {
      return false;
    }

    return true;
  }

  saveTrustedDeviceSecret(vaultKey: Buffer): void {
    const encrypted = safeStorage.encryptString(vaultKey.toString('base64'));
    writeFileSync(this.trustedDeviceSecretPath, encrypted);
  }

  loadTrustedDeviceSecret(): Buffer | null {
    if (!this.canUseTrustedDeviceUnlock() || !existsSync(this.trustedDeviceSecretPath)) {
      return null;
    }

    const encrypted = readFileSync(this.trustedDeviceSecretPath);
    const decrypted = safeStorage.decryptString(encrypted);
    return Buffer.from(decrypted, 'base64');
  }

  clearTrustedDeviceSecret(): void {
    if (existsSync(this.trustedDeviceSecretPath)) {
      unlinkSync(this.trustedDeviceSecretPath);
    }
  }
}
