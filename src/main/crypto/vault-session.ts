export class VaultSession {
  private vaultKey: Buffer | null = null;

  isUnlocked(): boolean {
    return this.vaultKey !== null;
  }

  setVaultKey(vaultKey: Buffer): void {
    this.vaultKey = Buffer.from(vaultKey);
  }

  getVaultKeyOrThrow(): Buffer {
    if (!this.vaultKey) {
      throw new Error('Vault is locked');
    }

    return Buffer.from(this.vaultKey);
  }

  lock(): void {
    if (this.vaultKey) {
      this.vaultKey.fill(0);
    }

    this.vaultKey = null;
  }
}
