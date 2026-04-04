/**
 * Street Eats Pi — Database Setup
 * Creates the local SQLite database with the same schema as D1.
 * Run once: node setup-db.js
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'street-eats.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// Read and execute the schema from the main project
const schema = readFileSync(join(__dirname, '..', 'schema.sql'), 'utf-8');

// Execute each statement separately (better-sqlite3 doesn't support multi-statement exec by default)
const statements = schema
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

for (const stmt of statements) {
  try {
    db.exec(stmt + ';');
  } catch (err) {
    console.warn(`Warning: ${err.message} — skipping`);
  }
}

// Add sync tracking table (not in main schema)
db.exec(`
  CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    synced INTEGER NOT NULL DEFAULT 0,
    retries INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_sync_unsynced ON sync_queue(synced) WHERE synced = 0;
`);

console.log(`Database created at ${DB_PATH}`);
console.log('Tables:', db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name).join(', '));

db.close();
