# Area11

**Smart Pharmacy & Retail POS + Inventory System** — offline-first, everything editable, live preview, go-back checkpoints.

> 🤖 **New agent / new person? Open [`HANDOFF.md`](./HANDOFF.md) first.** It has the status, TODO list, how to run, gotchas and rollback. (`AGENTS.md` is the short rule sheet.)
>
> 📁 Real app = **repo root** (Next.js + SQLite). `legacy-demo-vite/` = older browser-only demo kept for reference/reuse.

## Status (2026-10-05) — v0.6.1, latest checkpoint **stage-32**

**Branch:** `arena/01a10395-area11` → **[PR #3](https://github.com/Dr-Adil-Abdullah/Area11/pull/3)** into `main` (it already contains the earlier session's work `arena/01a0f0cf-area11` / PR #2, fast-forwarded on 2026-10-03). Verified today: `npx tsc --noEmit` 0 errors · `npm run build` **67 routes** · `npm test` **26/26** · `rules-count.sh` = `SAB THEEK` · live API smoke (purchase `PINV-0001` → sale `INV-0001` → stock write-off → change `94000` paisa) OK · cashier blocked from owner/manager pages · legacy demo tests 212/212.

| Stage | Work | State |
|---|---|---|
| Stone 0 / 0.5 | Repo, checkpoints, spec, 116 numbered rules, app foundation, editable Settings | ✅ |
| **Phase 1** | Products + pack formula, suppliers, purchases (PINV, batch/expiry), counter billing (FEFO, Box/Strip/Tab, hold cart, round-off **with cost guard**), **cash tendered → change calculator** (quick cash buttons, receipt line), **stock write-off/adjust page** (expired/damaged/count correction, value at cost), **Excel import of old data** (template → dry-run preview → import, opening stock/batches, customer udhaar, supplier payable), thermal receipt, **login + roles (owner password / staff PIN) + URL-level page guard**, **offline/PWA shell** (installable app, offline page, internet-off banner) | ✅ **COMPLETE (stages 9–14)** |
| **Phase 2 (essentials)** | Sales history, partial returns / void, customer credit & payment receiving, supplier payments, cash/day-end, expenses, owner drawings, DB backup, **cash shifts (galla): opening float → live expected cash → close with counted cash + variance + history**, **lost-bill lookup (bill / customer / phone / medicine) with rush-time provisional returns + link-to-bill + role-gated restock** | ✅ **Phase 2 COMPLETE** (+ **shift handover** — ginta hua cash agle shift ka float, "kis ne → kis ko", handover parchi) |
| **Discount guard (spec 7.3)** | Role percent limits (cashier 5 · manager 20 · owner unlimited) **and** no discount below purchase cost — both server-side and editable in Settings | ✅ |
| Phase 2 rest, 3, 4, 5 | bulk update, stock-take, shift handover, supplier returns, WhatsApp orders, loyalty, split pay, audit viewer, **reports**, Supabase sync … | ⏳ see `HANDOFF.md` §4 (about **92 %** built overall) |

**Owner's baseline rule — everything is customizable (`U-17`):** make your own fields on any screen, click any row to open its full detail, small clickable option blocks inside Settings, and filters / sorting / groups on every list. Nothing is hard-coded. Also: git and docs are updated with **every** change (`U-23`).

**Latest changes (stages 26–32):** `/reports` is live — **aaj / 7 din / 30 din / is mahina** with KPI cards (bills, bikri, **munafa + margin**, average bill, cash vs udhaar, refunds, expenses, purchases), a per-day bar chart, **top-10 dawayen**, a **category split** and a **dead-stock list** (60 din se nahi biki); owner/manager only (a cashier is sent back to `/pos`). While building it a **real accounting bug surfaced and was fixed**: round-off and loyalty rebates were only taken off the bill total, never off the item lines, so every bill's items added up to more than the bill itself (a Rs 7.50 gap on a typical bill — visible on the receipt and in every report). Item totals are now reconciled line by line, so **bill = items, always**, and six new tests guard it.

**Stage-32:** **shift handover** — galla band karte waqt batayein *kaun senbhalega*: ginta hua cash agle shift ka opening float ban jata hai, "kis ne → kis ko" mehfooz rehta hai، اور ایک **handover parchi** (ساری لائنیں + فرق + دونوں دستخط) چھاپ سکتے ہیں۔

**Stage-31:** **backup ab photos کے ساتھ** — ایک ہی `.zip` میں پورا ڈیٹا بیس + `data/photos/` کی ساری تصویریں؛ restore بھی `.zip` سے۔ ساتھ ہی **روزانہ خودکار بیک اپ** (`data/backups/`، Settings سے آن/آف، پرانے خود بخود کٹ جاتے ہیں)۔

**Stage-30:** **sare records ek file se UPDATE** — "Data (Excel)" safhe par *Apna data download karein* se poori file milti hai (dawayen, gahak, supplier, categories, companies, batches, settings — **photos ke baghair**); usi me jo badalna hai badlein, wapas upload karein, pehle poora preview (purana → naya) phir ek click se update. **Khaali cell = koi tabdeeli nahi**, khata aur stock ki quantity file se nahi badalti, security settings band, aur Settings ke liye alag tick.

**Stage-29:** **ginti (stock-take)** — dukan band kar ke ginne ka poora chakkar: session kholo aur kitab ka stock freeze ho jata hai, har dawa ke aage "kitab / ginti / farq / qeemat" likho, "sirf farq wali" se chhan lo, phir ek click se **lagu** — batches durust, movement record, kami/ziyada ki qeemat cost par, aur **kitab ka manfi stock bhi theek ho jata hai**. Sirf owner lagu kar sakta hai aur ek session dobara lagu nahi hota.

**Stage-28:** **udhaar ki hadd ab sakht ho sakti hai** — Settings me "Udhaar (Credit) ki hadd" section: hadd poori hone par udhaar **band** kar do (sirf warning ki jagah), manager ko ijazat do ya na do, owner ko hamesha ijazat. Cashier ko saaf paishani milti hai ke purana udhaar + is bill ka = kul kitna.

**Stages 23–25:** a bill can be paid **part cash, part credit** (or any mix) from a Split pad at the counter; **loyalty points** are now earned *and spent* (1 point = Rs 1, capped at what the customer has); and **categories can have sub-categories** (`Medicines › Dard/Bukhar`) — pick a parent in the filter and all its children come along. Also: expired batches can be ticked on the alerts page and sent back to the supplier in one click, and free/sample stock has its own table.

**Stages 21–22:** suppliers are now a full ledger — open a supplier to see every purchase bill, payment and return, pay them from the same screen, and **send goods back** (`SR-0001`, expired / damaged / wrong items) which removes the stock and reduces what you owe (or turns it into a credit note). And the reorder list on **Expiry & stock alerts** became a WhatsApp **order pad**: tick the medicines, set the quantities, add the supplier's number and WhatsApp opens with the text ready — plus a one-tap "today's summary" message. Free `wa.me` links, no API key.

**Stages 19–20:** the **black box** is now browsable at `/audit` — every action with who/when/what and filters — and **backup/restore** sits right next to it: download the whole database, or drop a `.db` back in (the app validates it, auto-saves the old one and switches over *without a restart*). Photos now go to the **`data/photos/` folder** instead of the database, products have a **room/almari** field, and **filters + sorting** were added to the product, customer and sales lists, with the product list also able to **group by category, company or room** (click a group header to fold it).

**Stages 17–18:** everything is now customizable from inside — make **your own fields** for customers/products/suppliers (CNIC, shelf, discount group…; required or optional; switch on/off), **click a customer** to see their photo, khata and every bill/payment/return, **click a product** to see its batches, expiry, sales, price history and full stock ledger, **Settings sections open when clicked**, and a **new category or company can be created right inside the product form**. Photos are resized on the device and stored in the database (offline-friendly).

**Stage-16:** lost-bill handling — search past bills by **medicine name**, give a customer their money back at rush time without a bill (`PR-xxxx`, goods stay **quarantined**, a red pending badge keeps blinking), then tag the real bill later (optionally putting the goods back in stock). Only owner/manager can put returned goods back into stock; a cashier's return always stays in quarantine. Also fixed: sale lines without an explicit batch now automatically take the nearest-expiry batch, so batch stock and the movement ledger can no longer drift apart.

**Stage-15:** **cash shift (galla)** — open the drawer with an opening float, the screen keeps showing the expected cash as billing/expenses happen, and closing asks for the counted cash and stores the difference (short/excess) in a shift history list. The counter shows a small reminder while no shift is open. The auto-created empty shift at first start is gone.

**Stage-14:** P1 finished — **customer edit** (inline row), **category & company rename/delete** (deleting only unlinks products, never deletes them), and a **Free / sample-bonus tick** on purchase lines that puts the goods into stock without adding them to the bill or the supplier payable.

**Stage-13:** works offline — the app can be installed on the shop tablet/PC ("Add to Home Screen"), shows a small amber bar when the internet is down, `/api` is never cached so billing data is always live. Static UI files are cached so the counter does not go blank if the internet drops.

**Stage-12:** import screen `/import` — the shop's old list can come from Excel (with a ready template and a line-by-line preview before anything is saved) · duplicate names/phones are skipped automatically, rates are typed in rupees and stored as paisa, opening stock arrives as a proper batch with expiry.

**Stage-11:** `/stock` write-off & adjustment screen for owner/manager · cash-received box at the counter with live change + quick buttons · change printed on the receipt · purchased-cost guard still blocks below-cost discounts · a cashier typing an owner-only URL is sent back to `/pos`.

**Live link (demo only):** <https://marea11.netlify.app> — Netlify project `marea11` publishes the **`legacy-demo-vite/` demo** (sample data) for now. The real app needs a **Node ≥ 22.5 host with a persistent disk** (shop PC / Node host with volume): a SQLite file cannot live on static or serverless hosting. Details in `HANDOFF.md` §10.

## 📁 Files (naqsha)

| File | Kaam |
|---|---|
| **`PHASE-TWO-INFORMATION.md`** | ⭐ **Zabta + mansooba** — 116 numbered rules (U/R/E/S/P/B/Z/T/M/Q) |
| **`INPUT-INFORMATION.md`** | Part 1: master spec **hoobahoo** • Part 2: A-01…A-49 (tay shuda) + Q-01…Q-19 (aap ke faisle) |
| **`complete_numbered_master_specs (1).md`** | Asal master spec — **Single Source of Truth** |
| **`HANDOFF.md`** | ⭐ Naye agent ke liye pehla safha: **kya ho chuka / kya baqi hai**, run, gotchas, hosting, rollback — har kaam ke baad update karein |
| **`AGENTS.md`** | Chhota rule sheet (non-negotiables) |
| `src/` | App ka code (Next.js + TypeScript) |
| `legacy-demo-vite/` | Purana browser-demo (reference / reuse) |
| `scripts/ckpt.sh` | **Wapas jane ka system** (checkpoint) |
| `scripts/sync-spec.sh` | Spec → INPUT Part 1 khud-ba-khud copy |
| `scripts/rules-count.sh` | Numbered points ki ginti (koi baat miss na ho) |
| `data/area11.db` | Aap ka **asli data** (SQLite — backup = ek file ki copy) |

---

## 🚀 Roz-marra ka kaam

```bash
npm run dev            # App chalayein (http://localhost:3000)
npm test               # Unit tests (Node ka built-in runner - koi library nahi)
bash scripts/ckpt.sh save "kaam ka naam"    # Save point
bash scripts/ckpt.sh list                   # Saare stages dekhein
bash scripts/ckpt.sh go 3                   # Kisi bhi stage par wapas
bash scripts/ckpt.sh undo                   # Ek qadam peeche
bash scripts/ckpt.sh push                   # GitHub par mehfooz
bash scripts/rules-count.sh                 # Numbered rules check
```

**Backup:** `data/area11.db` file ki copy — bas itna hi.

**Login:** owner password `area11` (pehle din badal lein: Settings → Staff). Staff = naam + 4-hindsi PIN (owner banata hai).
**Password bhool gaye?** `node scripts/reset-login.mjs --owner "naya-password"` (app chalti hui bhi kaam karta hai).

---

## 🛠 Technology (kam code = kam error)

| Hissa | Kya | Kyun |
|---|---|---|
| App | **Next.js + TypeScript** | live preview, kam code |
| UI | **Tailwind CSS + Lucide icons** | tayyar cheezein |
| Database | **SQLite (Node ka built-in)** | **zero extra library**, ek file, offline |
| Money | **paisa (integer)** | calculation me kabhi ghalti nahi |
| Auth | Node ka built-in scrypt | staff PIN + owner password |
| Cloud | **Supabase** (Phase 5) | aap ka intekhab |

---


## 💡 Yaad rahe
- Har cheez badli ja sakti hai (Settings) — naam, logo, rang, rates, expiry levels, receipt…
- Frontend se badlav database me khud-ba-khud.
- Wapas jana: `git tag` (stage-1…N) → `bash scripts/ckpt.sh go N` — merge ke baad bhi.
