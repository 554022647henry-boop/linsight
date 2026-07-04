import { initSchema, closeDb } from './index.js';

console.log('[db:init] initializing schema...');
initSchema();
console.log('[db:init] done.');
closeDb();
