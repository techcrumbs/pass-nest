import type { SqliteDatabase } from '../client';
import type { ProfileDto } from '../../../shared/dto/profiles';

type ProfileRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export class ProfilesRepository {
  constructor(private readonly database: SqliteDatabase) {}

  list(): ProfileDto[] {
    const rows = this.database
      .prepare(
        'SELECT id, name, created_at, updated_at FROM profiles ORDER BY name ASC',
      )
      .all() as ProfileRow[];

    return rows.map(mapProfileRow);
  }

  create(input: { id: string; name: string; now: string }): ProfileDto {
    this.database
      .prepare(
        `
          INSERT INTO profiles (id, name, created_at, updated_at)
          VALUES (@id, @name, @now, @now)
        `,
      )
      .run(input);

    return this.getById(input.id);
  }

  update(input: { id: string; name: string; now: string }): ProfileDto {
    this.database
      .prepare(
        `
          UPDATE profiles
          SET name = @name, updated_at = @now
          WHERE id = @id
        `,
      )
      .run(input);

    return this.getById(input.id);
  }

  delete(id: string): void {
    this.database.prepare('DELETE FROM profiles WHERE id = ?').run(id);
  }

  getById(id: string): ProfileDto {
    const row = this.database
      .prepare(
        'SELECT id, name, created_at, updated_at FROM profiles WHERE id = ?',
      )
      .get(id) as ProfileRow | undefined;

    if (!row) {
      throw new Error(`Profile not found: ${id}`);
    }

    return mapProfileRow(row);
  }
}

function mapProfileRow(row: ProfileRow): ProfileDto {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
