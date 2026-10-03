# HANDOFF — read this first (any new agent)

> **اردو خلاصہ:** یہ ریپو ایک **آف لائن فارمیسی POS + انوینٹری** ایپ ہے (مالک: Dr. Adil Abdullah، اردو بولنے والے)۔ اصل ایپ **روٹ فولڈر** میں ہے (Next.js + SQLite)۔ فیز 1 مکمل اور فیز 2 کے ضروری حصے (ریٹرن، ادھار وصولی، کیش/ڈے-اینڈ، بیک اپ) بن چکے ہیں — **کام کرتا ہوا اور آج (2026-10-03) دوبارہ verify شدہ**۔ **سوالات (Q-01…Q-19) سب حل ہیں — دوبارہ نہ پوچھیں۔** اگلا کام "§4 REMAINING" میں ہے (سب سے پہلے: **PR #3 merge** اور login+roles)۔ ہر کام کے بعد یہ فائل اپ ڈیٹ کریں۔

Last updated: **2026-10-03 (evening)** · App version **0.6.1 (Phase 1 done + Phase 2 essentials + login/roles)** · Session branch **`arena/01a10395-area11`** → PR **[#3](https://github.com/Dr-Adil-Abdullah/Area11/pull/3)** into `main` · Newest tag: see `git tag` (`stage-1 … stage-8` + this work).

---

## 0. The 60-second picture

| | |
|---|---|
| **Product** | "Smart Pharmacy & Retail POS / Inventory Management" — web app (PWA-ready) for one pharmacy: 2 counters + owner's phone on the shop LAN, **100 % usable without internet**. |
| **Single source of truth (spec)** | [`complete_numbered_master_specs (1).md`](./complete_numbered_master_specs%20%281%29.md) — 16 sections, 5 phases, built **strictly in order**. Copy verbatim in `INPUT-INFORMATION.md` Part 1. |
| **Real app** | **Repo root** — Next.js 15 (App Router) + TypeScript + Tailwind + **`node:sqlite`** (Node's built-in SQLite, zero DB dependency). 19 tables, 33 routes. |
| **Login** | **Live since 2026-10-03**: owner = password, staff = name + 4-digit PIN, roles Owner/Manager/Cashier. Default owner password `area11` — change it in Settings → Staff. Forgot it? `node scripts/reset-login.mjs --owner "new-password"`. |
| **Reference only** | [`legacy-demo-vite/`](./legacy-demo-vite) — a *different* browser-only Vite demo (phases 1-3, sample data, 212 unit tests, docs) from an earlier session. **Do not merge into root.** Mine it for logic/tests (see §7). It is also the only thing currently published to the public web (§10). |
| **This branch** | `arena/01a10395-area11` — contains everything from `arena/01a0f0cf-area11` (fast-forwarded 2026-10-03) **plus** this memory rewrite. PR #3 carries it into `main`. |
| **Language / currency** | UI **English**; money **PKR**, stored as **integer paisa** (`*_paisa`). Dates local time (Asia/Karachi). |
| **Owner's language** | Urdu — talk to the owner in Urdu (Roman-Urdu/Urdu script both fine); code & UI in English. |

## 1. Standing rules from the owner (numbered in `PHASE-TWO-INFORMATION.md`, 116 points — `bash scripts/rules-count.sh` must say `SAB THEEK`)

1. **Questions are already answered** (`INPUT-INFORMATION.md` Part 2, Q-01…Q-19). Do **not** re-ask them. If something truly new blocks you: ask via **multiple-choice in chat (with a "type your own" option) — never write questions into project files**; ask all of them together, up front.
2. **Reuse existing code in any form; write as little new code as possible** (U-08/R-*). Check `legacy-demo-vite/`, npm libraries, and open-source repos before writing from scratch.
3. **Everything must be editable later** (app name, logo, colours, categories, rates, discount limits, expiry windows, receipt layout…) → via **Settings**, never hard-coded. A change made in the UI must reach the database automatically (E-*, S-*).
4. **Business-reliable**: no recurring technical errors; money in integer paisa; DB writes inside `tx()`; never delete data (soft-delete / reversing rows).
5. **Live preview** while working (bind dev server to `0.0.0.0`; `next.config.ts` already allows `*.e2b.app`).
6. **Always checkpoint**: `bash scripts/ckpt.sh save "what changed"` then `bash scripts/ckpt.sh push`. The owner must be able to return to any earlier stage (see §6).
7. **Every new owner instruction gets a new number** appended in `PHASE-TWO-INFORMATION.md` (short meaning + number), then update the `V` matrix (`rules-count.sh` verifies).
8. **After each piece of work update this file (§3 status + §4 TODO) and README.**

## 2. Run it

```bash
# Node >= 22.5 required (node:sqlite).  Tested on Node 22.22.3
npm install
npm run dev          # http://localhost:3000   (0.0.0.0, live preview friendly)
# production on the shop PC:
npm run build && npm start     # same port 3000; other devices: http://<PC-IP>:3000
```

* DB file: `data/area11.db` (**git-ignored**, created + migrated automatically on first request; owner account + 5 categories + settings seeded by `src/lib/bootstrap.ts`).
* **First login:** owner password `area11` (from `.env`). Staff accounts are added by the owner in **Settings → Staff** (name + PIN). **Change the owner password on day one.**
* **Locked out?** `node scripts/reset-login.mjs --list` · `node scripts/reset-login.mjs --owner "new-password"` · `node scripts/reset-login.mjs --user "Bilal" --pin 1234` (works while the app is running).
* **Tests:** `npm test` (Node's built-in runner, no extra library) covers password/PIN hashing, session-token signing/expiry/tampering and the discount-limit maths. `npm run test:watch` for continuous runs.
* `node_modules/`, `data/`, `.next/` are **not** in git. A fresh sandbox needs `npm install` again.
* Health check: `GET /api/health` → `{ok:true, database:"connected", ...}`.
* Backup: Cash page → **Download database backup** (`GET /api/backup`, uses `VACUUM INTO`, safe while running). Restore = stop app, replace `data/area11.db`.
* `node:sqlite` prints an *ExperimentalWarning* — harmless.
* The legacy demo is its own Vite project: `cd legacy-demo-vite && npm ci && npm run dev` (its own `package.json`, tests and `netlify.toml`).

## 3. What is DONE

**Where things stand on 2026-10-03:** the app was re-verified in the morning (docs only); in the evening **login + roles** (stage-9) were built, then a follow-up fixed the health version (stage-10), and then **cash-change calculator + stock write-off/adjust + URL-level page guard** (stage-11) — those are the code changes this branch adds on top of PR #2.

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npm run build` | **passes**, 36 routes (incl. `/stock`, `/import`, `/api/import/*`) |
| `bash scripts/rules-count.sh` | **SAB THEEK** — phase-two 116 points; INPUT A-49 + Q-19 |
| Live Excel import smoke (stage-12) | Template downloads (`28 KB .xlsx`) · preview on a 7-line test file → Products `2 ok · 1 skip · 1 error`, Customers `2 ok`, Suppliers `1 ok` · commit → `{products:2, customers:2, suppliers:1, batches:2, stockBase:185}`, opening stock 180 tablets on batch `A-77` (expiry 2027-03), customer balance Rs 1,200, supplier payable Rs 25,000 · **re-uploading the same file imports 0** (duplicates auto-skipped) · bad cost (`abc`) rejected as `error` · cashier → `403` |
| Live API smoke (stage-11) | `{ok:true, database:"connected", version 0.6.1}` · product id 1 · **`PINV-0001`** `totalPaisa 100000` · **`PINV-0001`** re-run OK · stock write-off `2 strip → value 10000, newQty 180` · over-write-off **blocked 400** ("sirf 180 tablet hain") · **`INV-0001`** with change: tender Rs 1000 → `tenderedPaisa 100000`, `changePaisa 94000` · adjustment list shows summary `todayPaisa 10000` · cashier → restricted pages **307 → `/pos`**, `/api/stock/adjust` **403** `{"error":"Owner or Manager only"}` · receipt prints *Cash received* + *Change returned* |
| Legacy demo (`legacy-demo-vite/`) | `npm run typecheck` ✓ · `npm test` → **212/212** |
| Public demo URL `https://marea11.netlify.app` | **live, public**, renders the Vite demo (checked from outside the sandbox) |

| Area | Where | Notes |
|---|---|---|
| Settings (≈50 keys) | `/settings`, `src/lib/settings.ts`, `settings/actions.ts` | brand/logo/colour, store info, bill prefixes & padding, tax (OFF), discount mode/limits, 3 expiry levels (365/180/90), loyalty (structure only), printer 58/80, receipt layout, payments, security, sync flags. Saved + audited. |
| DB layer | `src/lib/db.ts`, `schema.ts` | WAL, FK on, `tx()`, migrations `001_core` (18 tables), `002_returns` (**19 tables total**). **Add new migrations at the end; never edit old ones** (S-06). Rows are plain objects (null-prototype fix). |
| Products | `/products`, `lib/catalog.ts`, `/api/products*` | pack formula 1 Box = X Strip = Y base unit; retail/VIP/doctor rates; barcode; rack; category/company created from the UI; soft delete; price changes audited. |
| Suppliers | `/suppliers` | running balance; **Pay** button (supplier payment). |
| Purchases (Stock-In) | `/purchases`, `/purchases/new`, `lib/purchases.ts` | auto `PINV-0001`, batch + expiry per line, updates stock, cost/rates, supplier balance, payment row, stock movement. Sample/bonus flag exists in API (`isSample`), **no UI toggle yet**. |
| Counter / POS | `/pos`, `lib/sales.ts`, `lib/pos.ts` | search by name/salt/brand/barcode/rack, **nearest-expiry-first (FEFO)** batches, expired batches blocked, Box/Strip/Tablet, hold cart (localStorage), discount (margin/retail mode), cash/credit, `INV-0001`, F2 search / F4 save. |
| **Rounding** | `lib/money.ts` | floor to Rs 10 **unless it drops below purchase cost** (owner-confirmed: 545/cost 543 → 545; 545/cost 500 → 540). Warning if bill < cost. |
| Receipt | `/receipt/[id]` (`?type=purchase`) | 58/80 mm layout, browser print dialog, reprint any time. |
| **Sales history / Returns / Void** | `/sales`, `lib/returns.ts` | find by date/bill/customer; partial **return** by item (refund = share of the amount actually collected; default **quarantine**, optional "put back in stock"); credit is reduced before cash is refunded; **void** whole bill (only if no returns). Originals never edited. |
| **Customers & credit** | `/customers`, `lib/customers.ts`, `lib/cash.ts` | add/list, balance, **Receive payment** (applied to oldest bills first). Credit-limit warning at sale time. |
| **Cash & day-end** | `/cash`, `lib/cash.ts` | day summary (sales, credit, returns, profit, cash in/out), expected cash vs counted, expenses, owner drawings, backup button. |
| **Expiry & stock alerts** | `/alerts`, `lib/alerts.ts` | windows from Settings; expired value at cost; reorder list from per-product reorder level. |
| Audit log (write side) | `lib/audit.ts` → `audit_logs` | create/update/delete/price_change/void/return/settings_change/backup. **No viewer yet.** |
| **Login & roles** | `/login`, `lib/session.ts`, `lib/auth.ts`, `lib/users.ts`, `lib/roles.ts`, `api/auth/*`, `api/users*` | HMAC-signed HttpOnly cookie (secret from `.env` or auto-generated in the DB), owner password / staff PIN, 5-try throttle, audit `login`/`login_failed`/`logout`, idle auto-lock (`security.autoLockMinutes`, default 15), session lifetime (`security.sessionHours`, default 12). Protected page group `src/app/(protected)/` + `guard()` on every API route. Role limits: cashier cannot create products/purchases/suppliers/supplier payments; Settings → Staff (owner only). |
| **Discount guard (spec 7.3)** | `lib/sales.ts`, `lib/roles.ts`, `lib/settings.ts` | Server-side: percent limit per role (**cashier 5% · manager 20% · owner unlimited** — editable in Settings) **and** a hard block on any discount that would take a line or the bill below purchase cost (`discount.blockBelowCost`, default ON). |
| **Cash change calculator** | `/pos`, `lib/sales.ts`, `sales.change_paisa` (migration 003) | Cashier types what the customer handed over (quick buttons Exact/100/500/1000/2000/5000) → **live change** shown before saving and printed on the receipt ("Cash received" / "Change returned"). Tendering is **not revenue**; change is stored per sale. |
| **Stock write-off / adjust** | `/stock`, `lib/stock.ts`, `api/stock/adjust`, table `stock_adjustments` (migration 003) | Owner/Manager: choose product+batch, direction **out** (expired/damaged/lost/count-correction) or **in** (found/returned), reason + note; writes a `stock_movements` row (`writeoff`/`adjust`), moves the batch and product quantity, values the loss **at cost**, and lists history with today/month write-off totals. Over-writing more than the batch holds is blocked. |
| **Excel import of old data (Q-19)** | `/import`, `lib/import.ts`, `api/import/{template,preview,commit}` | Owner/manager: download the **template workbook** (Products · Customers · Suppliers + an Instructions sheet with column meanings), fill it, upload → **dry-run preview** per line (`theek` / `skip` / `galat` with reasons, per-sheet counts, filter buttons) → import. No database change happens until you press import; imports run in one transaction (all-or-nothing), write opening batches + `stock_movements` (`import`), set customer credit balances and supplier payables, skip anything that already exists (by name/phone), and log an `Import` audit row. Rates are typed in **rupees**, the app converts to paisa. |
| **Page guard (roles, URL level)** | `lib/page-guard.ts` | Hiding a nav item is not enough: cashier opening `/products`, `/purchases`, `/suppliers`, `/cash`, `/settings` or `/stock` directly is redirected to `/pos` (owner/manager only). |
| **Login reset script** | `scripts/reset-login.mjs` | `--list`, `--owner "new-password"`, `--user "Name" --pin 1234` — also writes an audit row. |
| Dev tooling | `scripts/ckpt.sh`, `rules-count.sh`, `sync-spec.sh`, `reset-login.mjs` | checkpoint/rollback, numbering check, spec copy, login reset. |

## 4. REMAINING — in priority order

### P0 · repo / merge / hosting (do this first)
1. **Merge PR #3** (this branch → `main`). Afterwards PR **#2** is superseded and can be closed; branch `arena/01a0f0cf-area11` stays for history.
2. **After the merge, check the Netlify project** `marea11` still builds (`https://marea11.netlify.app`). See §10 for the base-directory caveat.
3. **Decide where the real app will actually run** (shop PC `npm start` is the simplest; a Node host with a persistent disk is the alternative). Static/serverless hosting **cannot** hold the SQLite file (§10).

### P1 · finish Phase 1 / blockers for real use
1. ~~**Login + roles** (Q-13, Q-18)~~ — **DONE 2026-10-03** (see §3). Still open from that item: a visible role switcher when several people share one counter (today you log out/in), and per-user "shift" reporting.
2. ~~**Cash change calculator** at counter~~ — **DONE 2026-10-03 (stage-11)**: tender + quick cash buttons + live change + receipt line; change is not revenue.
3. ~~**Unit-level stock write-off / adjustment**~~ — **DONE 2026-10-03 (stage-11)**: `/stock` page (owner/manager), direction out/in, reason, value at cost, movement row, over-write-off blocked.
4. ~~**Excel import of old data** (Q-19)~~ — **DONE 2026-10-03 (stage-12)**: template download, dry-run preview per line, transactional import of products (+ opening batches/expiry), customers (with udhaar) and suppliers (with payable); duplicates skipped by name/phone; SheetJS `xlsx` added.
5. **Offline hardening**: service worker + cached shell so the UI loads with no internet (manifest exists, SW doesn't). Server runs on the shop PC so DB is already local.
6. Small UI gaps: customer edit (API `PATCH /api/customers` exists), category rename/delete (API exists), supplier-purchase "sample/bonus" checkbox. ~~product stock adjust screen~~ ✅ done (`/stock`), ~~receipt cost columns owner-only~~ ✅ done.

### P2 · Phase 2 remainder (spec §9, §14)
* Persisted **shift open/close** with opening float & variance (`shifts` table exists; `/cash` computes expected cash only) — port ideas from `legacy-demo-vite/src/domain/cash.ts`.
* **Provisional ("rush-time") returns** and lost-bill lookup by phone/medicine/date; role-gated restock (cashier cannot restock) — see `legacy-demo-vite/src/domain/returns.ts`.
* Discount safety rules end-to-end (never below cost, per-role limits).

### P3 · Phase 3 (spec §6, §10.2, §11.2, §11.3)
Supplier ledger & **supplier returns**, bonus/sample stock UI, reorder list → **WhatsApp order text** (free `wa.me` link, Q-11), daily report via WhatsApp, expiry-return to supplier flow.

### P4 · Phase 4 (spec §7.1, §8.5, §10.1, §2)
Customer profiles/stars/**loyalty** (structure exists, OFF), multi-tier rates (VIP/doctor already used at POS), **split payments**, credit-limit enforcement, custom fields & categories (everything editable).

### P5 · Phase 5 (spec §1.2, §11.1, §13, §15)
**Audit-log viewer** ("blackbox"), smart search, analytics/reports, stock-take, **Supabase cloud sync** (owner's phone from home; local SQLite stays primary — `sync.*` settings reserved), scheduled backups, restore UI, Windows/Android install polish, real thermal ESC/POS + USB barcode scanner verification on hardware (scanner currently works as keyboard input).

## 5. Gotchas (save yourself an hour)

* **Prisma is dead here** (engine download blocked). Use `node:sqlite` helpers `query/get/run/scalar/tx` from `src/lib/db.ts`. Don't add an ORM.
* `lib/db.ts`: `let migrated` must stay **above** `export const db` (TDZ bug fixed once).
* Next 15: `params` / `searchParams` are **Promises** — `await` them.
* Timestamps are stored with `datetime('now','localtime')`; "today" = `date(date)=date('now','localtime')`.
* `payments`: rows with `purchase_id`/`supplier_id` = money **out**; others = money **in** (refunds are negative). Day summary relies on this.
* Never pass raw DB rows with null prototypes to client components (already fixed in `db.ts`).
* After `npm run dev` code changes, hot reload is enough; a new migration applies on next request.
* Typecheck: `npx tsc --noEmit` (root `tsconfig.json` excludes `legacy-demo-vite`). Keep it at **0 errors**.
* **Auth gotchas:** `cookies()` is async; cookies can only be *set* in route handlers/server actions. Pages under `src/app/(protected)/` are login-gated by their layout; every API route must call `guard()` (or `handle()`/`handleOwner()`). `guard(SHOP_ROLES)` = owner/manager only.
* The session secret lives in the `settings` table under `security.sessionSecret` (not in `SETTING_DEFAULTS`, so the Settings page never shows it); `.env`'s `SESSION_SECRET` overrides it.
* Tests use Node's built-in runner with **type stripping**: `npm test` runs `node --experimental-strip-types --test src/lib/*.test.ts`. Test files import with explicit `.ts` extensions (hence `allowImportingTsExtensions` in `tsconfig.json`).
* A **fresh clone has no `data/area11.db`** — the first request creates it with the default owner (`area11`) and 5 categories, and no products.
* **Two package.json files exist**: root = the real Next.js app; `legacy-demo-vite/package.json` = the old demo. Install/run them separately; don't mix their `node_modules` assumptions.
* **The root of the repo is not a static site any more.** `/` serves the Next.js app; the Vite demo now builds only from `legacy-demo-vite/` (`npm run build` → `legacy-demo-vite/dist`). Any hosting config that still points at the repo root will therefore build the wrong thing (§10).

## 6. Going back (even after merges)

* Stages are git tags: `stage-1 … stage-8` (all pushed). List: `bash scripts/ckpt.sh list`. (`stage-7` = the 2026-10-03 memory rewrite, `stage-8` = PR links added. If a fresh clone shows no tags, `git fetch origin --tags` **before** `ckpt.sh save` — otherwise it would restart numbering at `stage-1`.)
* **Look at an old stage:** `git checkout stage-3` (then `git checkout <your-branch>` to return). **Return a branch to it:** `bash scripts/ckpt.sh go 3` (non-destructive; history stays).
* **Undo a merged PR:** `git revert -m 1 <merge-commit-sha>` (creates a new commit; nothing is lost).
* Merging never removes tags or commits. **Never delete tags, never force-push.**
* `ckpt.sh` needs a git repo with full history; in a shallow clone run `git fetch --unshallow --tags` first.

## 7. Reusing the legacy demo (`legacy-demo-vite/`)

Browser/localStorage app (React 19 + Vite), phases 1-3 with **tests** (`vitest`, 212 unit tests + 36 Playwright specs) and docs in `legacy-demo-vite/docs/` (decisions, per-phase progress, deployment). Useful, already-reviewed logic to port into `src/lib/*` instead of rewriting:
`src/domain/returns.ts` (exact refund allocation, quarantine, provisional returns), `cash.ts` (drawer, handover, variance), `accounts.ts` (owner drawings/expenses), `suppliers.ts` (ledger/returns), `alerts.ts` (expiry/reorder), `arithmetic.ts`, tests in `*.test.ts` (reuse as spec for the SQL versions).
Its README says "demo only" — that is about *that* build (no real DB, fake auth), not this one.

## 8. Decisions already made by the owner (full list: `INPUT-INFORMATION.md` Q-01…Q-19)

Stack Next.js+TS+SQLite · English UI · expiry levels from settings (365/180/90 → blue/yellow/red) · `PINV-0001` / `INV-0001` · tax OFF (master switch) · round down to 10s **with cost guard** · discount default on margin · 58 + 80 mm printers, USB barcode scanner · reports via free WhatsApp · Supabase later (local SQLite primary) · offline 100 % · loyalty/discount structure only for now · staff PIN + owner password · 1 shop, 2 counters + owner mobile, LAN only · cash + credit payments · owner-only roles first · old data from Excel · app name default "Area11", editable.

## 9. Quick verification recipe (≈2 min)

```bash
npm run dev &                    # then, with curl:
curl -s localhost:3000/api/health
curl -s -XPOST localhost:3000/api/products -H 'Content-Type: application/json' \
  -d '{"name":"Panadol","barcode":"5012345","boxStrips":10,"stripTablets":10,"costPaisa":200,"retailPaisa":300}'
curl -s -XPOST localhost:3000/api/purchases -H 'Content-Type: application/json' \
  -d '{"items":[{"productId":1,"unit":"box","qty":5,"batchNo":"B1","expiryDate":"2027-12","costPaisa":200,"retailPaisa":300}]}'   # → PINV-0001, stock 500
curl -s -XPOST localhost:3000/api/sales -H 'Content-Type: application/json' \
  -d '{"paymentMethod":"cash","items":[{"productId":1,"batchId":1,"unit":"strip","qty":1,"unitPricePaisa":300},{"productId":1,"batchId":1,"unit":"base","qty":5,"unitPricePaisa":300}]}'  # Rs45 → Rs40 (round down)
```

Static gates (must all pass before any push): `npx tsc --noEmit` · `npm run build` · `bash scripts/rules-count.sh` (`SAB THEEK`).
Delete test rows afterwards (or delete `data/area11.db` on a dev box) so the owner starts clean.

## 10. Branch, PR, hosting & merge situation (as of 2026-10-03)

**Branches / PRs**

* `main` = PR #1 (the **Vite demo only**). Still the default branch; **does not contain the real app yet**.
* `arena/01a0f0cf-area11` = previous session's branch (Next.js app, tags `stage-1 … stage-6`). PR **#2** was opened from it on 2026-10-01, is mergeable/clean, but was never merged.
* **`arena/01a10395-area11` = current session branch.** On 2026-10-03 it was **fast-forwarded onto `arena/01a0f0cf-area11`** (nothing lost, no conflicts — the old branch already contained `main`), then this memory rewrite was added. **[PR #3](https://github.com/Dr-Adil-Abdullah/Area11/pull/3)** carries it into `main`; PR #2 becomes redundant and may be closed (the old branch/tags stay). No open issues; no GitHub Actions workflows are installed (only templates in `legacy-demo-vite/docs/workflow-templates/`).

**Hosting — what is actually live today**

* ✅ **Public demo:** <https://marea11.netlify.app> — Netlify project `marea11`, connected to this repo, serving the **Vite demo** (sample data). Verified from outside the sandbox on 2026-10-03. The per-PR deploy preview (`deploy-preview-2--marea11.netlify.app`) also serves the demo.
* ⚠️ **Netlify base-directory caveat:** the project builds the demo, not the repo root. Evidence: PR #2's deploy preview (2026-10-01 01:06 UTC) succeeded while the branch root had already become a Next.js app with no root `netlify.toml`. This was **not** re-checked in the Netlify dashboard (no account access from here) — if the settings really point at the repo root, the first deploy after merging PR #3 would fail. Before/after merging, open **Netlify → Site configuration → Build & deploy** and confirm: base directory `legacy-demo-vite`, build `npm run build`, publish `dist`, `NODE_VERSION` = 22.22.3, `VITE_BASE_PATH` = `/`.
* ⚠️ **Vercel:** a production deployment of `main` exists (`area11-ekfim1j3c-dr92.vercel.app`, 2026-10-01) but it is **SSO/login-protected** — not a public site, not usable.
* ❌ **GitHub Pages:** still blocked (the Arena GitHub connection gets HTTP 403 on Pages enable; pushes containing active workflow files are rejected without the `workflows` permission).

**Where the real app must run**

Static/serverless hosts (Netlify, Vercel, GitHub Pages) **cannot** run it: the database is a SQLite **file** that needs a writable, persistent disk, and `node:sqlite` needs Node ≥ 22.5. Realistic options: **(a) the shop PC** — `npm run build && npm start`, other devices on the LAN use `http://<PC-IP>:3000` (simplest, matches the "100 % offline" decision); **(b) a Node host with a persistent volume** (Render/Railway/Fly/… or a small VPS) if it must be reachable from outside the LAN. Phase 5's Supabase sync is the long-term answer for the owner's phone — local SQLite stays primary.

**Housekeeping for the next agent**

* `legacy-demo-vite/docs/deployment.md` and `phase-3-*.md` still name the **old** branch `arena/01a0f117-area11` and treat the repo root as the Vite demo. They are **historical records** inside the legacy folder — read them as reference, not as current instructions.
* After every piece of work: `bash scripts/ckpt.sh save "…"` → `bash scripts/ckpt.sh push`, and update **this file (§3 + §4) and `README.md`**.
