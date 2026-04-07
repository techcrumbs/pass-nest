import type { SqliteDatabase } from './client';

type Migration = {
  version: number;
  sql: string;
};

const migrations: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(name)
      );

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

      CREATE INDEX IF NOT EXISTS idx_entries_profile_id ON entries(profile_id);
      CREATE INDEX IF NOT EXISTS idx_entries_profile_name ON entries(profile_id, name);

      CREATE TABLE IF NOT EXISTS vault_metadata (
        vault_id TEXT PRIMARY KEY,
        kdf_algorithm TEXT NOT NULL,
        kdf_params_json TEXT NOT NULL,
        kdf_salt BLOB NOT NULL,
        wrapped_vault_key BLOB NOT NULL,
        wrapped_vault_key_iv BLOB NOT NULL,
        wrapped_vault_key_auth_tag BLOB NOT NULL,
        key_version INTEGER NOT NULL,
        trusted_device_enabled INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
];

export function migrateDatabase(database: SqliteDatabase): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set<number>(
    database
      .prepare('SELECT version FROM schema_migrations ORDER BY version ASC')
      .all()
      .map((row) => Number((row as { version: number }).version)),
  );

  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      continue;
    }

    try {
      database.exec('BEGIN');
      database.exec(migration.sql);
      database
        .prepare(
          'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        )
        .run(migration.version, new Date().toISOString());
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
}
