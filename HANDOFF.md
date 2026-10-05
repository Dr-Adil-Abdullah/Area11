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
9. **Customization First (`U-17`)** — the owner's baseline expectation: on every screen the owner must be able to make **his own fields**, **click any row to open its full detail**, find **small clickable options inside Settings** (each opening its own detail), and use **filters / sorting / groups** on every list. Nothing is hard-coded. Related: `U-18` create-where-you-pick, `U-19` photos in folder, `U-20` discount base switchable, `U-21` room + camera photo, `U-22` filters & groups everywhere.
10. **Git after every single change (`U-23`)** — code *and* docs must both be on GitHub at all times, so the chat can be closed at any moment. **Finish the app first, then polish (`U-24`)**, one item at a time, keeping the done/remaining list readable inside the repo files.

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

**Where things stand on 2026-10-03 (evening):** the app was re-verified in the morning (docs only). In the evening the whole of **Phase 1 was finished**, one work item per checkpoint:
`stage-9` login + roles · `stage-10` health version from package.json · `stage-11` cash-change calculator + stock write-off/adjust + URL-level page guard · `stage-12` Excel import (template → dry-run preview → import) · `stage-13` offline mode / PWA (service worker, manifest, icons, offline page) · `stage-14` P1 tail UI (customer edit, category/company rename+delete, purchase sample/bonus tick, free goods excluded from the bill).
**Phase 4 wave (stages 24–25):**
- **stage-24 — split payment + loyalty:** a bill can now be paid with **several methods at once** (`splits: [{cash}, {credit}]`) — the cash parts land in the cash book as their own payment rows and the credit part goes to the customer's khata; the POS has a Split pad with "poora cash / poora udhaar / aadha aadha" shortcuts. **Loyalty** can now be *spent*: points show on the customer page and at the counter, and redeeming them reduces the bill (recorded as a `loyalty` payment row).
- **stage-25 — category tree:** categories can have **sub-categories** (2 levels, e.g. `Medicines › Dard/Bukhar`). Selecting a parent in the filter (or grouping) includes all its children; the selects show the hierarchy indented; a third level is refused with a clear message.
**Phase 3 started (stages 21–22):**
- **stage-21 — supplier returns + supplier ledger:** new `/suppliers/[id]` ledger page (khata, all purchase bills, payments, returns, inline edit + custom fields, "pay supplier"), and a **return-goods-to-supplier** flow (`SR-0001`) that removes the stock from the batch (FEFO when no batch is given), refuses to send back more than you have, reduces the supplier balance (or turns it into a credit note when nothing was owed), and optionally records cash received.
- **stage-22 — WhatsApp order text:** the reorder list on `/alerts` is now a pick-list; tick the medicines, set quantities, type the supplier's number and WhatsApp opens with the order text ready. A "today's summary" text (bills / sales / cash / credit / profit / expenses) can be sent the same way. Free `wa.me` link, no API key (Q-11). Pakistani `03xx` numbers are converted to `92…` automatically.
**Customization wave (stages 17–20):**
- **stage-19 — Black box & backup:** `/audit` page (owner/manager): every action with who/when/what, filters by action · entity · date · free text, one-click summary chips, and **Backup download** + **Restore** right there. Restore validates the file (real SQLite + `products` table), makes a safety copy `area11-before-restore-*.db`, swaps the database and **reopens it live — no restart needed** (the `db` handle is now a Proxy).
- **stage-20 — photos, rooms, filters, groups:** photos now live in **`data/photos/`** (not in the DB) and are served via `/api/photos?f=`; products got a **room/almari** field (plus rack); **filters + sorting** were added to all three lists (products: category / company / room / low-stock / out / expiring + 6 sort orders · customers: type / balance + 5 sort orders · sales: payment / status / profit-or-loss / min amount / date range + 4 sort orders); and the **product list can be grouped** by category, company or room with collapsible headers.
**Stages 17–18:** owner-defined **custom fields** per entity (customer/product/supplier) · **click-into details**: customer page (photo, khata, all bills/payments/returns, rush returns by phone) and product page (photo, rates, batches/expiry, sales totals, price history, full movement ledger) · **Settings sections now open on click** (`<details>`) · **new category/company can be created straight from the product form's select**. **Phase 1 is now complete** — see §4 for the next phases. **Phase 2 work is progressing:** `stage-15` cash shifts (galla) — opening float, live expected cash, counted cash at close, stored variance. `stage-16` lost-bill & rush-time returns — smart bill lookup (bill code / customer / phone / **medicine name**), provisional returns with an un-dismissable pending note, link-to-bill, and restocking restricted to owner/manager.

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npm test` | **11/11 pass** (scrypt hashing, token sign/verify/expiry/tamper, discount-limit math, shift expected-cash + variance math) |
| `npm run build` | **passes** — **48 routes** (29 API + 19 pages incl. `/customers/[id]` + `/products/[id]`) — check with `npm run build` after changes |

| `npm run build` old note | 46 routes (28 API + 18 pages: `/pos` `/products` `/purchases` `/purchases/new` `/stock` `/import` `/offline` `/sales` `/customers` `/suppliers` `/cash` `/alerts` `/settings` `/login` `/receipt/[id]` …) |
| `bash scripts/rules-count.sh` | **SAB THEEK** — phase-two 116 points; INPUT A-49 + Q-19 |
| Live audit/backup smoke (stage-19) | `GET /api/audit` returned the seeded actions with `byAction` counts · `GET /api/backup` produced a real 290 KB SQLite file · **restore** replaced the DB live: a product created after the backup disappeared, only the backed-up one remained, `area11-before-restore-*.db` was written, and the app kept serving queries with **no restart** (`{"ok":true,"needRestart":false}`) · a text file renamed `.db` was rejected (`Yeh asli SQLite backup nahi lagti.`) · cashier gets **403** on backup and **307** off `/audit` |
| Live split-payment smoke (stage-24) | `POST /api/sales` with `splits:[{cash:3000},{credit:3000}]` → `INV-0007` total 6000, paid 3000, due 3000, `payment_method: "split"`, status `partial`; only ONE payment row (`cash 3000`, note "Split payment (cash)") and the customer's balance rose by exactly the credit half |
| Live loyalty smoke (stage-24) | With `loyalty.rupeesPerPoint = 10`, a Rs 60 bill earned **6** points; the next bill with `redeemPoints: 5` came to **Rs 55** (`Loyalty points istemal hue: 5 (-5 Rs)`), points went 6 → 1 → +5 earned = 6, and a `loyalty` payment row of `-500` was written |
| Live category-tree smoke (stage-25) | `Medicines › Dard/Bukhar` created; putting Panadol in the child and filtering by the **parent** returned it (`total: 1`) while filtering by an unrelated parent returned 0; a third level was refused (`Zyada gehri category nahi — sirf 2 darje`); the tree endpoint returns depth + path (`Medicines › Dard/Bukhar`) and the product page shows the indented select |
| Live supplier-return smoke (stage-21) | `PINV-0001` (Rs 400) created a payable → `POST /api/supplier-returns` produced `SR-0001` (Rs 200) and the supplier balance dropped · returning **9999** of an item with only 1 in the batch → `Batch me sirf 1 hain` · returning 2 of a product with zero stock → `Brufen 400mg: hamare paas sirf 0 hain` · unknown supplier → `Supplier nahi mila.` · cashier → **403** · the ledger page renders Khata / Bills / Payments / Returns tabs |
| Live WhatsApp smoke (stage-22) | `GET /api/whatsapp?kind=reorder` → `1. Brufen 400mg — 50 tablet` with the store name from settings · `kind=day&phone=03001234567` → summary (Bills 2, Bikri Rs 80, Naqad Rs 60, Udhaar Rs 20, Munafa Rs 38) and link `https://wa.me/923001234567?text=…` (03xx → 92 conversion works) · `/alerts` renders the pick-list card |
| Live filters/rooms/photos smoke (stage-20) | `room=Hall` → 1 product; `stock=low` → 2 (first run returned SQL error, fixed); `sort=expiry`/`sold` reorder correctly; searching "hall" finds the product by room name · customers: `category=vip` → only Ali Raza Khan, `balance=clear`, `sort=due`, `q=ali` all work · sales: `method=cash` → INV-0001, `method=credit` → INV-0002, `margin=profit` → both, `min=5000` → only the bigger bill · photo saved to `data/photos/customer-1-<ts>.png` (302 B) served as `200 image/png`, and re-uploading **deleted the old file** (1 file left) · two SQL bugs found and fixed: column aliases can't be used in `WHERE` (stock/expiry filters) and `HAVING` needs `GROUP BY` (profit filter) |
| Live customization smoke (stages 17–18) | Created a customer field `CNIC` + a select field `Discount group` (A/B/C) and a product field `Shelf` → they appear in the forms and save (`35202-1234567-1`, `A`) · a **required** custom field left empty now **blocks the write before anything is created** (`"Shelf" zaroori hai…`, and no product row was added) and a bad select option is rejected · detail pages render with history (customer `Ali Raza Khan`: bills/khata/CNIC; product `Panadol 500mg`: batches including `B-2`, movements, price history) · photo upload stores a resized data-URL (and >400 KB is refused) · settings page renders **10 `<details>` sections** (click to open) · `POST /api/companies` returns the new id so the form can pick it |
| Live provisional-return smoke (stage-16) | Bill lookup by medicine name returns the right bills (`?q=Panadol` → `INV-0004…INV-0001`) · **cashier** records a rush return `PR-0001` (Rs 60, 10 tablets) → `pending: 1`, goods quarantined (batch untouched, movement `return_in` with qty **0**) · cashier trying to link/cancel → `Sirf owner ya manager…` · owner links it to `INV-0001` with restock → batch +10, movement `Provisional linked to INV-0001 -- restocked`, linking twice refused · cashier asking for restock on a normal return → `restockBlocked: true` (stays quarantined), owner's identical call restocks · **sale line with no batch now auto-picks the FEFO batch** (INV-0005 grabbed batch `B-2`, expiry 2027-09, and batch qty went 10 → 0) so batches and `stock_movements` can no longer drift apart |
| Live shift smoke (stage-15) | No auto-opened shift on a fresh DB (that seed was removed) → POS shows the amber "Galla khuli nahi hai" strip · opening a second shift is refused (`Shift pehle se khuli hui hai…`) · closing with no open shift is refused (`Koi shift khuli hui nahi hai`) · with float Rs 2,000 + one cash sale Rs 60 + expense Rs 150 the live expected cash read **191000 paisa** and after closing with counted Rs 1,910 the stored variance was **0**; a deliberately wrong count produced `differencePaisa 54000` (excess) and a short count `-3000`, both kept in history |
| Live P1-tail smoke (stage-14) | Customer `PATCH` → `Ali Raza Khan` becomes **vip** limit Rs 8,000 (`800000` paisa) · category rename + delete `200` (products keep existing, only the link is cleared) · company rename `200` · **sample purchase** `PINV-0002` — a 2-strip free/bonus line plus 1 paid strip → `totalPaisa 5000` (only the paid line), sample batch keeps its cost for write-off valuation, product stock 180 → 192 · cashier `PATCH /api/categories` → **403** |
| Live PWA / offline smoke (stage-13) | `/sw.js` `200` with `Cache-Control: no-cache` + `Service-Worker-Allowed: /` · `/manifest.webmanifest` served (3 icons, `standalone`) · `/offline` `200` (pre-cached by the SW) · `theme-color` + `rel=manifest` in the HTML · POS + import pages unaffected |
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
| **Offline mode / PWA (P1)** | `public/sw.js`, `public/manifest.webmanifest`, `public/icons/*`, `src/app/offline/page.tsx`, `src/components/ServiceWorkerRegistrar.tsx` | UI shell stays alive without internet: hashed `/_next/static/*` files are cache-first, pages are network-first (3 s timeout → cache → **offline page**), `/api/*` is **never** cached (data must be live), old caches are dropped on version change (bump `VERSION` in `sw.js` when the shell changes). Installable on Android/Windows (emerald + white-cross icon set, incl. maskable), theme colour `#047857`. An amber strip appears on the counter when the browser reports no internet ("Internet nahi hai — app chal rahi hai"). |
| **Black box (audit viewer) + backup/restore** | `/audit`, `lib/audit-view.ts`, `api/audit`, `api/backup` (GET + POST), `lib/photos.ts` | Owner-only backup: download a `VACUUM INTO` copy, or upload a `.db` to restore — the file is validated, the old DB is auto-saved as `area11-before-restore-*.db`, and the running app switches to the new file immediately (`reopenDb()`). The black box lists every action (login, create, update, price change, void, return, settings, backup, restore) with filters and per-action counts. |
| **Photos in a folder** | `lib/photos.ts`, `api/photos` | Uploads are decoded, size-checked and written to `data/photos/<entity>-<id>-<ts>.<ext>`; the DB stores only the file name. Old data-URLs still render. Re-uploading removes the previous file. Served through `/api/photos?f=` (login required, name is validated to avoid path traversal). |
| **Room / almari on products** | migration `006_product_room`, `lib/catalog.ts` | In addition to `rack_no`, each product has a **room** (Hall / Store / Fridge …). It is searchable, filterable, editable from the product form and the product detail page, and usable as a grouping. |
| **Filters & sorting everywhere** | `lib/catalog.ts` (`ProductFilter`), `lib/customers.ts` (`CustomerFilter`), `lib/sales.ts` | Products: free text (name/salt/brand/barcode/rack/room/category/company) + category + company + room + stock state (low / out / expiring) + sort by name · stock · expiry · margin · sold · newest. Customers: text + type (normal/vip/doctor) + balance (due/clear) + sort by name · due · recent visit · spend · newest. Sales: date range (or all time) + text (bill / customer / phone / **medicine**) + payment method + status (incl. "returned") + profit-or-loss + minimum amount + sort by newest / oldest / biggest / most profitable. |
| **Collapsible groups** | `products/ProductsClient.tsx` | The product list can be grouped **by category, company or room** — each group shows a header with a count and can be folded/unfolded by clicking it. |
| **Split payment** | `lib/sales.ts` (`splits`), POS Split pad | One bill, several methods: e.g. Rs 30 cash + Rs 30 credit. Cash/online/card parts each get their own `payments` row (so the cash book and shift totals stay exact) and the credit part goes to the customer's khata. If the split doesn't add up, the difference is folded into the cash part. The bill is saved with `payment_method: "split"` and status `partial` when something is still due. |
| **Loyalty — earn & spend** | `lib/sales.ts`, POS counter, customer page | Points are earned per Settings (`loyalty.rupeesPerPoint`) and can now be **redeemed** at the counter: 1 point = Rs 1, capped at the points the customer actually has, recorded as a `loyalty` payment row and shown in the sale warnings. The customer page shows points (and stars). |
| **Category tree (2 levels)** | `lib/catalog.ts` (`listCategoriesTree`, `categoryWithChildren`), `api/categories`, product page | Create a sub-category under any top-level one from the product page's Categories card ("ke neeche: …"). The filter/group select shows the hierarchy indented, and **filtering by a parent includes all its children** (recursive CTE). A third level is rejected — one clear parent › child model. |
| **Supplier returns** | `lib/supplier-returns.ts`, `api/supplier-returns` (migration `007_supplier_returns`) | Send expired / damaged / wrong goods back: `SR-0001` codes, per-line batch selection with **FEFO fallback**, a hard guard that you cannot send back more than the batch (or the product) holds, stock leaves via a `supplier_return` movement, and the supplier balance is reduced — if it was already zero the balance goes negative meaning *the supplier owes us* (credit note). Tick "naqad wapas mila" and it also lands in the cash book. Cashier cannot do it (403). |
| **Supplier ledger** | `/suppliers/[id]`, `getSupplierLedger()` | Full detail page: profile (editable + custom fields), khata (bought / paid / returned / outstanding, with "hum ne dena" vs "wo denge"), tabs for **purchase bills / payments / returns**, and a quick "pay supplier" box. Names in the supplier list are links now. |
| **WhatsApp order & summary** | `lib/whatsapp.ts`, `api/whatsapp`, `alerts/WhatsAppCard.tsx` | The reorder list becomes a **tick-list**: choose medicines, adjust quantities, add the supplier name/number/note → WhatsApp opens with ready text (`wa.me`, free, Q-11). "Aaj ka khulasa" sends the day's bills / sales / cash / credit / profit / expenses. `03xx…` → `923xx…`, no phone → plain `wa.me/?text=`. |
| **Custom fields (owner's own columns)** | `lib/custom-fields.ts`, `lib/custom-fields-shared.ts`, `api/custom-fields`, Settings → "Your own fields" | Per entity (customer / product / supplier): add a field with a **label + type** (text, number, date, list/select, haan-nahi), mark it **required**, then switch it **on/off** (off keeps the stored values) or delete it. Quick-add suggestions (CNIC, Address, Birthday, Shelf, NTN…). Values are validated **before** the record is written, so a missing required field can never leave a half-created product/customer behind. Cashier cannot manage fields (403). |
| **Detail pages (click into anything)** | `/customers/[id]`, `/products/[id]`, `lib/details.ts` | Customer: photo (camera/upload → resized data-URL in DB), inline edit of name/phone/type/credit limit/**notes**/custom fields, khata (bills, total kharid, wasooli, refunds, baqaya, last visit), tabs for **Bills / Payments / Returns**, and rush returns matched by phone. Product: photo, inline edit of cost/retail/VIP/doctor/rack/reorder/barcode + custom fields, hisab (stock, stock value at cost, sold qty/value/bills, last sale, per-unit margin, reorder warning), batches & expiry status (theek / jaldi expire / expired / khali), full **stock movement ledger** and **price history** from the audit log. Names in the lists are links now. |
| **Settings open on click** | `settings/page.tsx` | Every settings block is now a `<details>` card — the owner clicks a heading to open its small options and sees the description without scrolling past everything. |
| **New category/company from the form itself** | `products/ProductsClient.tsx` | The Category and Company dropdowns have a "＋ Nayi category… / ＋ Nayi company…" entry: type the name and the app creates it there and then selects it (no need to go to the side cards first). |
| **Lost bill & rush-time returns — P2** | `/sales` (ProvisionalCard), `lib/provisional.ts`, `lib/provisional-shared.ts`, `api/provisional` (migration `004_provisional_returns`) | Spec §9.2: (1) **smart bill lookup** — `/sales?q=` now matches bill code, customer name, phone **or medicine name/generic**; `/api/provisional?phone=` lists that customer's past bills. (2) **Rush return (provisional)** — cashier refunds cash on the spot (`PR-0001`), the goods are recorded as items and stay **quarantined** (no batch change), and a red **pending** badge keeps blinking until the real bill is tagged. (3) **Link to bill** — owner/manager searches the bill and links it (optionally restocking into that bill's batch); cancel with a reason otherwise. (4) **Role-gated restock** — a cashier's return can never put goods back into stock (`restockBlocked: true`), server-side. |
| **Cash shifts (galla) — P2** | `/cash` → ShiftCard, `lib/shifts.ts`, `lib/shift-math.ts`, `api/shifts` | Owner/manager: **open a shift** with the opening float, watch the live expected cash (float + cash sales + udhaar collections − refunds − supplier payments − expenses − drawings, all inside the shift's time window), then **close with counted cash** → expected / actual / variance are persisted and listed (history + today's total variance). A shift can't be opened twice and can't be closed if none is open. The POS shows a non-blocking amber reminder while no shift is open. `bootstrap.ts` no longer auto-opens an empty shift. Math lives in `lib/shift-math.ts` so it is unit-tested. |
| **Customer edit** | `/customers`, `api/customers` (`PATCH` already existed) | Edit button on each row → inline row opens (name, phone, normal/vip/doctor, credit limit) → Save; writes an `update` audit row. Balance is never edited by hand (it only changes through bills/payments). |
| **Category / company rename + delete** | `/products` (side cards), `api/categories`, `api/companies` (`PATCH` + `DELETE` added for companies) | Pencil / bin on each chip: rename in place (Enter = save, Esc = cancel) or delete with a confirm that spells out the consequence. Deleting **never deletes products** — it only clears the link (`category_id`/`company_id` → NULL, row goes `active = 0`). Both audited. |
| **Sample / bonus in purchases** | `/purchases/new` (Free tick), `lib/purchases.ts` | A **Free** checkbox per purchase line: qty still enters stock, the **bill and the supplier payable are not increased** (`lineTotal = 0`), the batch keeps the entered cost so write-off value/haulage stays correct, and the stock movement is written as type `sample` with the note "Sample / bonus (0 cost)". |
| **Page guard (roles, URL level)** | `lib/page-guard.ts` | Hiding a nav item is not enough: cashier opening `/products`, `/purchases`, `/suppliers`, `/cash`, `/settings` or `/stock` directly is redirected to `/pos` (owner/manager only). |
| **Login reset script** | `scripts/reset-login.mjs` | `--list`, `--owner "new-password"`, `--user "Name" --pin 1234` — also writes an audit row. |
| Dev tooling | `scripts/ckpt.sh`, `rules-count.sh`, `sync-spec.sh`, `reset-login.mjs` | checkpoint/rollback, numbering check, spec copy, login reset. |

## 4. REMAINING — in priority order

 > **Progress snapshot (2026-10-05, after stages 21–25):** Phase 1 **100 %**, Phase 2 **~95 %** (shift handover between cashiers is the last gap), Phase 3 **100 %** (supplier ledger + returns + WhatsApp order & daily summary + sample-stock view + expiry→supplier-return shortcut), Phase 4 **~90 %** (split payment, loyalty earn/redeem, category tree, detail pages and custom fields all in; only a hard credit-limit block is left), Phase 5 **~35 %** (black box + backup/restore done; reports, stock-take, Supabase sync, hardware checks open). **Roughly 80 % of the numbered spec is built** — the trading core (products, stock, purchases, counter, returns, credit, cash, shifts, custom fields, settings) is done; reports/analytics, supplier ledger & returns, WhatsApp ordering, loyalty usage, split pay, audit viewer, Supabase sync, restore UI and hardware verification are not.

### P0 · repo / merge / hosting (do this first)
1. **Merge PR #3** (this branch → `main`). Afterwards PR **#2** is superseded and can be closed; branch `arena/01a0f0cf-area11` stays for history.
2. **After the merge, check the Netlify project** `marea11` still builds (`https://marea11.netlify.app`). See §10 for the base-directory caveat.
3. **Decide where the real app will actually run** (shop PC `npm start` is the simplest; a Node host with a persistent disk is the alternative). Static/serverless hosting **cannot** hold the SQLite file (§10).

### P1 · finish Phase 1 — ✅ **COMPLETE (2026-10-03, stages 9–14)**
1. ~~**Login + roles** (Q-13, Q-18)~~ — **DONE 2026-10-03** (see §3). Still open from that item: a visible role switcher when several people share one counter (today you log out/in), and per-user "shift" reporting.
2. ~~**Cash change calculator** at counter~~ — **DONE 2026-10-03 (stage-11)**: tender + quick cash buttons + live change + receipt line; change is not revenue.
3. ~~**Unit-level stock write-off / adjustment**~~ — **DONE 2026-10-03 (stage-11)**: `/stock` page (owner/manager), direction out/in, reason, value at cost, movement row, over-write-off blocked.
4. ~~**Excel import of old data** (Q-19)~~ — **DONE 2026-10-03 (stage-12)**: template download, dry-run preview per line, transactional import of products (+ opening batches/expiry), customers (with udhaar) and suppliers (with payable); duplicates skipped by name/phone; SheetJS `xlsx` added.
5. ~~**Offline hardening**~~ — **DONE 2026-10-03 (stage-13)**: service worker (static cache-first, pages network-first → `/offline` fallback, API never cached), PWA manifest + icon set (installable "Add to Home Screen"), offline banner at the counter. Server still runs on the shop PC, so the DB is local (SW only keeps the UI alive).
6. ~~Small UI gaps~~ — **all done (stage-14)**: ~~customer edit~~ ✅ · ~~category rename/delete~~ ✅ (also companies) · ~~sample/bonus checkbox on purchases~~ ✅. Earlier in the same list: ~~product stock adjust screen~~ ✅ (`/stock`) · ~~receipt cost columns owner-only~~ ✅.

> **P1 has no open items.** Next work starts at P2 (see below).

### P2 · Phase 2 remainder (spec §9, §14)
* ~~Persisted **shift open/close** with opening float & variance~~ ✅ **done stage-15** (see §3). Nothing left from that item; a future nicety is a shift handover between cashiers (`shifts.previous_session_id` idea from the legacy demo).
* ~~**Provisional ("rush-time") returns** and lost-bill lookup by phone/medicine/date; role-gated restock~~ ✅ **done stage-16** (see §3).
* ~~Discount safety rules end-to-end (never below cost, per-role limits)~~ ✅ **done stage-9/10** (server-side, settings-driven: cashier 5 % · manager 20 % · owner unlimited + hard block below purchase cost).

### P3 · Phase 3 (spec §6, §10.2, §11.2, §11.3)
* ~~Supplier ledger & **supplier returns**~~ ✅ **done stage-21** (see §3).
* ~~reorder list → **WhatsApp order text** (free `wa.me` link, Q-11)~~ ✅ **done stage-22**.
* ~~daily report via WhatsApp~~ ✅ **done stage-22** ("Aaj ka khulasa" button on the same card).
* ~~bonus/sample stock **UI**~~ ✅ **done stage-23** ("Sample / bonus maal" table on `/alerts`, fed by the `is_sample` flag).
* ~~expiry-return-to-supplier shortcut~~ ✅ **done stage-23** ("Expiry wali dawaen wapas bhejein" — tick expired batches and send them back in one click).
* **P3 is complete.**

### P4 · Phase 4 (spec §7.1, §8.5, §10.1, §2)
* ~~**Split payments**~~ ✅ **done stage-24** (see §3).
* ~~**Loyalty** earn **and redeem**~~ ✅ **done stage-24**.
* ~~**Category tree / sub-categories**~~ ✅ **done stage-25**.
* ~~Customer profiles (detail page, photo, custom fields)~~ ✅ **done stage-17**.
* ~~Multi-tier rates (VIP/doctor)~~ ✅ already used at POS (stage-9/10).
* ~~Credit-limit enforcement~~ ✅ warning at the counter (spec 10.1.2) — **remaining nicety:** optionally *block* (or require owner approval) instead of only warning.
* **Remaining in P4:** nothing structural; only the hard-block option for credit limits and small polish.

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

### Decisions taken during the build (chat Q&A, 5-Oct-2026 — do NOT re-ask)

| Sawal | Owner ka faisla | Kya bana? |
|---|---|---|
| Dawa ke "kamre" se murad? | **Dono** — rack/kamra ka khana **aur** camera se tasveer | ✅ migration `006_product_room` + photo upload (`U-21`) |
| Discount kis cheez par lage? | **Dono** — malik Settings se chune (profit **ya** retail) | ✅ `discount.mode` = `margin` / `retail` (`U-20`) |
| Tasveerein kahan rahein? | **Folder me files** (database me na rahein) | ✅ `data/photos/` + `/api/photos` (`U-19`) |
| Filter kahan chahiye? | **Teeno jagah** — dawaiyan, gahak, bill | ✅ filters + sorting in all three lists (`U-22`) |
| "Folder barha/kam kar saken" se murad? | **Sadha group** — category/company/kamra ke hisaab se, na ke pedi (tree) | ✅ collapsible groups in the product list (`U-22`) |
| Agla bara kaam kaunsa? | **Black box (audit) + backup/restore** | ✅ `/audit` page + `api/backup` GET/POST (stage-19) |

Agla bara kaam (owner ki tarjih ke mutabiq, is ke baad): **Phase 3** — supplier ledger + supplier return + WhatsApp order text.

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
