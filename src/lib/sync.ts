// ---------------------------------------------------------------------------
// Area11 - Cloud sync (Supabase) — dukan ka data ghar se dekhne ke liye
// ---------------------------------------------------------------------------
// Local SQLite hamesha ASAL rahega (Q: "100 % offline"). Supabase sirf ek
// **aina** (mirror) hai: dukan ka data wahan bhej diya jata hai, aur zaroorat
// par wapas laya ja sakta hai. Internet na ho to app waise hi chalti rahe.
//
// Tareeqa:
//   1) Supabase me EK table banayein (SQL: docs/SUPABASE.md)
//   2) Settings me project URL + anon key daalein
//   3) "Abhi bhejein" (push) → poora snapshot wahan chala jata hai
//   4) Doosri jagah se "Abhi laayein" (pull) → data yahan aa jata hai
//
// Suraksha:
//   * Koi bhi key na ho to push/pull sirf "not_configured" kahega -- koi
//     chup-chapat failure nahi.
//   * Pull karte waqt pehle HAZIR data ka backup ban jata hai.
// ---------------------------------------------------------------------------

import { get, query, run, tx, getDbPath } from "./db";
import { getSettings, type AppSettings } from "./settings";
import { audit } from "./audit";
import fs from "node:fs";
import path from "node:path";

export const SYNC_VERSION = 1;

export type SyncPacket = {
  version: number;
  shop: string;
  sentAt: string;
  counts: Record<string, number>;
  data: Record<string, Record<string, unknown>[]>;
};

/** Kaun kaun se table bhejein (aur kis hisaab se chhote rakhein) */
const TABLES: { name: string; where?: string; limit?: number; order?: string }[] = [
  { name: "categories" },
  { name: "companies" },
  { name: "products", where: "active = 1" },
  { name: "customers", where: "active = 1" },
  { name: "suppliers", where: "active = 1" },
  { name: "batches", where: "active = 1" },
  // bikri: pichhle 90 din (poori tareekh bhejni zaroori nahi -- size ka khayal)
  { name: "sales", where: "status <> 'void' AND date >= date('now','localtime','-90 days')", order: "date DESC" },
  { name: "sale_items", limit: 20000 },
  { name: "purchases", where: "date >= date('now','localtime','-90 days')", order: "date DESC" },
  { name: "payments", where: "date >= date('now','localtime','-90 days')", order: "date DESC" },
  { name: "expenses", where: "date >= date('now','localtime','-90 days')", order: "date DESC" },
  { name: "stock_movements", limit: 20000 },
];

/** Dukan ka data ka snapshot (bhejne layak) */
export function buildPacket(): SyncPacket {
  const s = getSettingsSync();
  const data: Record<string, Record<string, unknown>[]> = {};
  const counts: Record<string, number> = {};

  for (const t of TABLES) {
    const where = t.where ? ` WHERE ${t.where}` : "";
    const order = t.order ? ` ORDER BY ${t.order}` : "";
    const limit = t.limit ? ` LIMIT ${t.limit}` : "";
    const rows = query<Record<string, unknown>>(`SELECT * FROM ${t.name}${where}${order}${limit}`);
    data[t.name] = rows.map((r) => ({ ...r }));
    counts[t.name] = rows.length;
  }

  return {
    version: SYNC_VERSION,
    shop: String(s["store.name"] ?? "Area11"),
    sentAt: new Date().toISOString(),
    counts,
    data,
  };
}

/** Settings ko seedha (sync ke liye) */
function getSettingsSync(): AppSettings {
  // getSettings async hai; yahan ek chhoti synchronous copy padhte hain
  const rows = query<{ key: string; value: string }>("SELECT key, value FROM settings");
  const out: Record<string, unknown> = {};
  for (const r of rows) {
    try {
      out[r.key] = JSON.parse(r.value);
    } catch {
      out[r.key] = r.value;
    }
  }
  return out as AppSettings;
}

export type SyncConfig = {
  enabled: boolean;
  url: string;
  key: string;
  table: string;
  shopId: string;
};

export function syncConfig(): SyncConfig {
  const s = getSettingsSync();
  return {
    enabled: Boolean(s["sync.enabled"]),
    url: String(s["sync.url"] ?? "").replace(/\/+$/, ""),
    key: String(s["sync.key"] ?? ""),
    table: String(s["sync.table"] ?? "area11_sync"),
    shopId: String(s["sync.shopId"] ?? "shop-1"),
  };
}

export type SyncResult = {
  ok: boolean;
  action: "push" | "pull" | "none";
  message: string;
  bytes?: number;
  counts?: Record<string, number>;
  at?: string;
};

function setStatus(text: string, at?: string) {
  const set = (k: string, v: string) =>
    run("UPDATE settings SET value = ? WHERE key = ?", [JSON.stringify(v), k]);
  set("sync.status", text);
  if (at) set("sync.lastSyncAt", at);
}

// ---------------------------------------------------------------------------
// PUSH — snapshot ko cloud me bhejein
// ---------------------------------------------------------------------------
export async function pushSync(user?: { id?: number; name?: string }): Promise<SyncResult> {
  const cfg = syncConfig();
  if (!cfg.url || !cfg.key) {
    setStatus("not_configured");
    return {
      ok: false, action: "none",
      message: "Supabase ka URL / key abhi nahi dala gaya — Settings me daal dein.",
    };
  }

  const packet = buildPacket();
  const body = JSON.stringify(packet);
  const url = `${cfg.url}/rest/v1/${cfg.table}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        shop_id: cfg.shopId,
        shop_name: packet.shop,
        sent_at: packet.sentAt,
        version: packet.version,
        payload: JSON.parse(body), // object ke tor par (jsonb column)
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      setStatus("error");
      return {
        ok: false, action: "push",
        message: `Bhej nahi saka (${res.status}): ${text.slice(0, 200) || res.statusText}`,
      };
    }

    const at = new Date().toISOString();
    setStatus("pushed", at);
    void audit({
      action: "sync", userId: user?.id ?? null, userName: user?.name ?? null,
      entity: "Supabase", details: { direction: "push", counts: packet.counts, bytes: body.length },
    });
    return {
      ok: true, action: "push",
      message: `Bhej diya: ${Object.values(packet.counts).reduce((a, b) => a + b, 0)} records (${Math.round(body.length / 1024)} KB).`,
      bytes: body.length, counts: packet.counts, at,
    };
  } catch (e) {
    setStatus("error");
    return {
      ok: false, action: "push",
      message: e instanceof Error ? `Rabta nahi ho saka: ${e.message}` : "Rabta nahi ho saka.",
    };
  }
}

// ---------------------------------------------------------------------------
// PULL — cloud se snapshot laayein (aur apni jagah lagayein)
// ---------------------------------------------------------------------------
export type PullResult = SyncResult & { packet?: SyncPacket; applied?: Record<string, number> };

export async function pullSync(
  opts: { apply?: boolean } = {},
  user?: { id?: number; name?: string }
): Promise<PullResult> {
  const cfg = syncConfig();
  if (!cfg.url || !cfg.key) {
    setStatus("not_configured");
    return { ok: false, action: "none", message: "Supabase ka URL / key abhi nahi dala gaya." };
  }

  const url = `${cfg.url}/rest/v1/${cfg.table}?shop_id=eq.${encodeURIComponent(cfg.shopId)}&select=*&order=sent_at.desc&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      setStatus("error");
      return { ok: false, action: "pull", message: `La nahi saka (${res.status}): ${text.slice(0, 200)}` };
    }
    const rows = (await res.json()) as { payload?: SyncPacket; sent_at?: string }[];
    const row = rows?.[0];
    if (!row?.payload) {
      return { ok: false, action: "pull", message: "Cloud me is dukan ka koi data nahi mila — pehle push karein." };
    }

    const packet = row.payload;
    if (!opts.apply) {
      return {
        ok: true, action: "pull",
        message: `Cloud se data mil gaya (${row.sent_at ?? "—"}): ${Object.values(packet.counts ?? {}).reduce((a, b) => a + b, 0)} records. Lagane ke liye dobara "la kar lagayein" dabayein.`,
        packet, counts: packet.counts, at: row.sent_at,
      };
    }

    const applied = applyPacket(packet);
    const at = new Date().toISOString();
    setStatus("pulled", at);
    void audit({
      action: "sync", userId: user?.id ?? null, userName: user?.name ?? null,
      entity: "Supabase", details: { direction: "pull", applied, sentAt: row.sent_at },
    });
    return {
      ok: true, action: "pull",
      message: `Cloud ka data lag gaya: ${Object.entries(applied).map(([k, v]) => `${k} ${v}`).join(" · ")}`,
      packet, applied, counts: packet.counts, at,
    };
  } catch (e) {
    setStatus("error");
    return {
      ok: false, action: "pull",
      message: e instanceof Error ? `Rabta nahi ho saka: ${e.message}` : "Rabta nahi ho saka.",
    };
  }
}

// ---------------------------------------------------------------------------
// APPLY — cloud ka snapshot local DB me daalo (pehle backup!)
// ---------------------------------------------------------------------------
/** Har table ki primary key */
const PK: Record<string, string> = {
  categories: "id", companies: "id", products: "id", customers: "id",
  suppliers: "id", batches: "id", sales: "id", sale_items: "id",
  purchases: "id", payments: "id", expenses: "id", stock_movements: "id",
};

export function applyPacket(packet: SyncPacket): Record<string, number> {
  const applied: Record<string, number> = {};

  // Hifazati copy: ghalti ho to wapas mil jaye
  try {
    const target = getDbPath();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    fs.mkdirSync(path.join(process.cwd(), "data", "backups"), { recursive: true });
    fs.copyFileSync(target, path.join(process.cwd(), "data", "backups", `area11-before-sync-${stamp}.db`));
  } catch {
    /* backup na ban sake to bhi aage barho */
  }

  tx(() => {
    for (const [table, rows] of Object.entries(packet.data ?? {})) {
      if (!Array.isArray(rows) || rows.length === 0) continue;
      const pk = PK[table];
      if (!pk) continue;
      let n = 0;
      for (const r of rows) {
        const cols = Object.keys(r).filter((c) => c !== pk || r[pk] != null);
        const placeholders = cols.map(() => "?").join(",");
        const updates = cols
          .filter((c) => c !== pk)
          .map((c) => `${c} = excluded.${c}`)
          .join(",");
        run(
          `INSERT INTO ${table} (${cols.join(",")}) VALUES (${placeholders})
           ON CONFLICT(${pk}) DO UPDATE SET ${updates}`,
          cols.map((c) => (r[c] === undefined ? null : (r[c] as string | number | null)))
        );
        n++;
      }
      applied[table] = n;
    }
  });

  return applied;
}

// ---------------------------------------------------------------------------
// Haal-e-haal
// ---------------------------------------------------------------------------
export function syncStatus(): {
  status: string;
  lastSyncAt: string;
  enabled: boolean;
  configured: boolean;
  counts: Record<string, number>;
} {
  const s = getSettingsSync();
  const cfg = syncConfig();
  const counts: Record<string, number> = {};
  for (const t of ["products", "customers", "suppliers", "sales", "batches"]) {
    counts[t] = get<{ v: number }>(`SELECT COUNT(*) v FROM ${t}`)?.v ?? 0;
  }
  return {
    status: String(s["sync.status"] ?? "not_configured"),
    lastSyncAt: String(s["sync.lastSyncAt"] ?? ""),
    enabled: cfg.enabled,
    configured: Boolean(cfg.url && cfg.key),
    counts,
  };
}
