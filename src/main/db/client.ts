import { DatabaseSync } from 'node:sqlite';
import type { AppPaths } from '../bootstrap/app-paths';

export type SqliteDatabase = DatabaseSync;

export function openDatabase(paths: AppPaths): SqliteDatabase {
  const database = new DatabaseSync(paths.databasePath);

  database.exec('PRAGMA foreign_keys = ON;');
  database.exec('PRAGMA journal_mode = WAL;');

  return database;
}
