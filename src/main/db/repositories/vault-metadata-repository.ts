import type { SqliteDatabase } from '../client';

export type VaultMetadataRecord = {
  vaultId: string;
  kdfAlgorithm: string;
  kdfParamsJson: string;
  kdfSalt: Buffer;
  wrappedVaultKey: Buffer;
  wrappedVaultKeyIv: Buffer;
  wrappedVaultKeyAuthTag: Buffer;
  keyVersion: number;
  trustedDeviceEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type VaultMetadataRow = {
  vault_id: string;
  kdf_algorithm: string;
  kdf_params_json: string;
  kdf_salt: Buffer;
  wrapped_vault_key: Buffer;
  wrapped_vault_key_iv: Buffer;
  wrapped_vault_key_auth_tag: Buffer;
  key_version: number;
  trusted_device_enabled: number;
  created_at: string;
  updated_at: string;
};

export class VaultMetadataRepository {
  constructor(private readonly database: SqliteDatabase) {}

  get(): VaultMetadataRecord | null {
    const row = this.database
      .prepare(
        `
          SELECT
            vault_id,
            kdf_algorithm,
            kdf_params_json,
            kdf_salt,
            wrapped_vault_key,
            wrapped_vault_key_iv,
            wrapped_vault_key_auth_tag,
            key_version,
            trusted_device_enabled,
            created_at,
            updated_at
          FROM vault_metadata
          LIMIT 1
        `,
      )
      .get() as VaultMetadataRow | undefined;

    return row ? mapVaultMetadataRow(row) : null;
  }

  create(input: VaultMetadataRecord): void {
    this.database
      .prepare(
        `
          INSERT INTO vault_metadata (
            vault_id,
            kdf_algorithm,
            kdf_params_json,
            kdf_salt,
            wrapped_vault_key,
            wrapped_vault_key_iv,
            wrapped_vault_key_auth_tag,
            key_version,
            trusted_device_enabled,
            created_at,
            updated_at
          ) VALUES (
            @vaultId,
            @kdfAlgorithm,
            @kdfParamsJson,
            @kdfSalt,
            @wrappedVaultKey,
            @wrappedVaultKeyIv,
            @wrappedVaultKeyAuthTag,
            @keyVersion,
            @trustedDeviceEnabled,
            @createdAt,
            @updatedAt
          )
        `,
      )
      .run({
        ...input,
        trustedDeviceEnabled: input.trustedDeviceEnabled ? 1 : 0,
      });
  }

  updateTrustedDeviceEnabled(enabled: boolean, now: string): void {
    this.database
      .prepare(
        `
          UPDATE vault_metadata
          SET trusted_device_enabled = ?, updated_at = ?
        `,
      )
      .run(enabled ? 1 : 0, now);
  }
}

function mapVaultMetadataRow(row: VaultMetadataRow): VaultMetadataRecord {
  return {
    vaultId: row.vault_id,
    kdfAlgorithm: row.kdf_algorithm,
    kdfParamsJson: row.kdf_params_json,
    kdfSalt: row.kdf_salt,
    wrappedVaultKey: row.wrapped_vault_key,
    wrappedVaultKeyIv: row.wrapped_vault_key_iv,
    wrappedVaultKeyAuthTag: row.wrapped_vault_key_auth_tag,
    keyVersion: row.key_version,
    trustedDeviceEnabled: row.trusted_device_enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
