import { getDb, initSchema, closeDb } from './index.js';

console.log('[db:init] initializing schema...');
const db = getDb();
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as Array<{ name: string }>;
db.exec('PRAGMA foreign_keys = OFF;');
for (const { name } of tables) {
  db.exec(`DROP TABLE IF EXISTS "${name}";`);
}
db.exec('PRAGMA foreign_keys = ON;');
initSchema();
console.log('[db:init] done.');
closeDb();
