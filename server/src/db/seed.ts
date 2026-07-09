import { getDb, closeDb } from './index.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('[db:seed] seeding data...');

const seedSql = readFileSync(join(__dirname, 'seed.sql'), 'utf-8');
const db = getDb();
db.exec('PRAGMA foreign_keys = OFF;');
db.exec(seedSql);
db.exec('PRAGMA foreign_keys = ON;');

console.log('[db:seed] done.');
closeDb();