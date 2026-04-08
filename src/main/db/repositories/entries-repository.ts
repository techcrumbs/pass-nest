import type { SqliteDatabase } from '../client';
import type { EntryDto } from '../../../shared/dto/entries';

export type EntryRow = {
  id: string;
  profile_id: string;
  name: string;
  tags_json: string;
  ciphertext: Buffer;
  iv_nonce: Buffer;
  auth_tag: Buffer;
  key_version: number;
  created_at: string;
  updated_at: string;
};

export class EntriesRepository {
  constructor(private readonly database: SqliteDatabase) {}

  listByProfile(profileId: string): EntryDto[] {
    const rows = this.database
      .prepare(
        `
          SELECT id, profile_id, name, tags_json, ciphertext, iv_nonce, auth_tag, key_version, created_at, updated_at
          FROM entries
          WHERE profile_id = ?
          ORDER BY name ASC
        `,
      )
      .all(profileId) as EntryRow[];

    return rows.map(mapEntryRowToDto);
  }

  create(input: {
    id: string;
    profileId: string;
    name: string;
    tagsJson: string;
    ciphertext: Buffer;
    ivNonce: Buffer;
    authTag: Buffer;
    keyVersion: number;
    now: string;
  }): EntryDto {
    this.database
      .prepare(
        `
          INSERT INTO entries (
            id,
            profile_id,
            name,
            tags_json,
            ciphertext,
            iv_nonce,
            auth_tag,
            key_version,
            created_at,
            updated_at
          ) VALUES (
            @id,
            @profileId,
            @name,
            @tagsJson,
            @ciphertext,
            @ivNonce,
            @authTag,
            @keyVersion,
            @now,
            @now
          )
        `,
      )
      .run(input);

    return this.getDtoById(input.id);
  }

  update(input: {
    id: string;
    profileId: string;
    name: string;
    tagsJson: string;
    ciphertext: Buffer;
    ivNonce: Buffer;
    authTag: Buffer;
    keyVersion: number;
    now: string;
  }): EntryDto {
    this.database
      .prepare(
        `
          UPDATE entries
          SET
            profile_id = @profileId,
            name = @name,
            tags_json = @tagsJson,
            ciphertext = @ciphertext,
            iv_nonce = @ivNonce,
            auth_tag = @authTag,
            key_version = @keyVersion,
            updated_at = @now
          WHERE id = @id
        `,
      )
      .run(input);

    return this.getDtoById(input.id);
  }

  delete(id: string): void {
    this.database.prepare('DELETE FROM entries WHERE id = ?').run(id);
  }

  getById(id: string): EntryRow | null {
    const row = this.database
      .prepare(
        `
          SELECT id, profile_id, name, tags_json, ciphertext, iv_nonce, auth_tag, key_version, created_at, updated_at
          FROM entries
          WHERE id = ?
        `,
      )
      .get(id) as EntryRow | undefined;

    return row ?? null;
  }

  private getDtoById(id: string): EntryDto {
    const row = this.getById(id);

    if (!row) {
      throw new Error(`Entry not found: ${id}`);
    }

    return mapEntryRowToDto(row);
  }
}

function mapEntryRowToDto(row: EntryRow): EntryDto {
  return {
    id: row.id,
    profileId: row.profile_id,
    name: row.name,
    tags: JSON.parse(row.tags_json) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
