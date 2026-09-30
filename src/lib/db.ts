// ---------------------------------------------------------------------------
// Area11 - Database layer (SQLite, ZERO dependency)
// ---------------------------------------------------------------------------
// Kyun node:sqlite?  Pehle Prisma plan kiya tha, magar uske engine binaries
// download nahi ho sakte the (network block). Node 22 me SQLite BUILT-IN hai --
// is liye koi extra package nahi chahiye:
//   => kam cheezein = kam error (RULE U-08, U-06)
//
// AHEM: raqam PAISA (integer) me -- 1 rupee = 100 paisa. (RULE Z-03)
// ---------------------------------------------------------------------------

import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { MIGRATIONS } from "./schema";

const DB_PATH =
  process.env.DATABASE_FILE || path.join(process.cwd(), "data", "area11.db");

type GlobalDb = { __area11db?: DatabaseSync };
const g = globalThis as unknown as GlobalDb;

function open(): DatabaseSync {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const database = new DatabaseSync(DB_PATH);
  // WAL = tez + safe (bijli jane par bhi data salamat)
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA busy_timeout = 5000;");
  migrate(database);
  return database;
}

// Migration flag -- AHEM: yeh `db` se PEHLE hona zaroori hai (warna TDZ error)
let migrated = false;

export const db: DatabaseSync = g.__area11db ?? open();
if (process.env.NODE_ENV !== "production") g.__area11db = db;

// ---------------------------------------------------------------------------
// Migration runner (schema versioning -- data kabhi zaya nahi hota)
// ---------------------------------------------------------------------------
export function migrate(database: DatabaseSync = db): void {
  if (migrated) return;
  database.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const done = new Set(
    (database.prepare("SELECT id FROM _migrations").all() as { id: string }[]).map((r) => r.id)
  );
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    try {
      database.exec(m.sql);
      database.prepare("INSERT INTO _migrations (id) VALUES (?)").run(m.id);
      console.log(`[db] migration lagayi: ${m.id}`);
    } catch (e) {
      console.error(`[db] migration FAIL: ${m.id}`, e);
      throw e;
    }
  }
  migrated = true;
}

// ---------------------------------------------------------------------------
// Chhote helpers (poore app me yehi istemal hote hain)
// ---------------------------------------------------------------------------
type Param = string | number | bigint | null | Uint8Array;

export function query<T = Record<string, unknown>>(sql: string, params: Param[] = []): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function get<T = Record<string, unknown>>(sql: string, params: Param[] = []): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function run(
  sql: string,
  params: Param[] = []
): { changes: number; lastInsertRowid: number } {
  const r = db.prepare(sql).run(...params);
  return {
    changes: Number(r.changes),
    lastInsertRowid: Number(r.lastInsertRowid),
  };
}

export function scalar<T = number>(sql: string, params: Param[] = []): T {
  const row = get<Record<string, T>>(sql, params);
  if (!row) return 0 as unknown as T;
  const keys = Object.keys(row);
  return row[keys[0]];
}

/** Transaction: sab kuch ho jaye ya kuch bhi na ho */
export function tx<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function dbPath(): string {
  return DB_PATH;
}
