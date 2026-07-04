import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!db) {
    const dbPath = process.env.DB_PATH ?? join(__dirname, '../../../linsight.db');
    db = new DatabaseSync(dbPath);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
  }
  return db;
}

export function initSchema(): void {
  const schemaSql = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  getDb().exec(schemaSql);
  console.log('[db] schema initialized');
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
