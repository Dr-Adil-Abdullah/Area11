# Area11 · Pharmacy workspace

A sample-data **Smart Pharmacy & Retail POS / Inventory Management System**. **Phases 1–3 are implemented as a working demo**, in the order specified by the [master blueprint](./complete_numbered_master_specs%20%281%29.md). Phases 4–5 remain later work.

> **Demo only.** Do not use this build for real pharmacy operations or real customer/financial data. Test roles are not authentication. Browser journals are not tamper-proof accounts or an immutable audit trail. Full offline startup, cloud synchronization, multi-device transactions, scheduled backups and production security are not implemented.

## Run locally

Requires Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
```

The dev server binds to `0.0.0.0:5173` and accepts Arena's `.e2b.app` preview hosts. Browser assets and fonts are self-hosted; no backend is required for this demo.

```sh
npm run build       # TypeScript check + assets in dist/
npm run preview     # Serve the built demo
```

**Cash workflow (preserved from Phase 2):** open **Cash drawer**, enter a sample operator label and the cash physically present as the **opening float**, and select **Open cash shift** before cash checkout, refunds, cash expenses owner cash entries or supplier cash settlements. A zero float is allowed; the app never invents an opening balance.

## Phase 1 · preserved

- Stock receiving, inline product registration, multiple delivery lines, separate automatic `PINV-0001` purchase codes and invoice history.
- Configurable `box → strip/inner pack → base unit` conversion: five boxes of two strips of ten tablets add **100 tablets**.
- Separate delivery lots, purchase/retail prices and expiry; nearest expiry first (FEFO). Expired and quarantined units cannot be sold.
- Product/barcode search, pack-specific barcodes, Box/Strip/Loose selectors, quantity and batch-level stock checks.
- Sequential `INV-0001` cash sales, stock deduction, tendered/change calculation and original invoice snapshots.
- **Confirmed rounding:** floor to ten rupees unless that would put the invoice below aggregate purchase cost. Rs. 545/cost Rs. 543 collects **Rs. 545**, not Rs. 540.
- 58mm/80mm receipt previews, browser printing/PDF and reprints without another sale. Physical printers/scanners remain **unverified**.
- Park/resume/discard carts. Holds retain exact batch, quantity, discount method/percentage and receipt phone, but never reserve stock. Checkout revalidates availability, expiry and the current cashier limit.
- English UI, integer-paisa PKR amounts, Asia/Karachi business dates, responsive layouts and keyboard shortcuts.

## Phase 2 · returns, cash and accounts

### Returns and lost-bill lookup

- Find an original invoice by number, medicine name, optional recorded phone or approximate date range. Phone punctuation is normalized, including full Pakistani mobile national/international number variants.
- Return a specific original **line index and batch** in smallest units. Cumulative returns cannot exceed sold quantities. The original invoice is not rewritten.
- Refund entitlement comes from the **actual collected amount**, after discounts and rounding—not today's price. Exact BigInt allocation and cumulative proration prevent lost paisa or over-refunds on repeated partial returns.
- Returns default to **quarantine**: physically recorded in the original lot, but excluded from counter/FEFO/scanner availability. Cashier cannot restock. Owner/Manager may explicitly choose inspected, unexpired restock; damaged/expired returns remain quarantined. This is a demo stock disposition, **not a legal/clinical approval to resell medicine**.
- Rush-time provisional returns record received products/quantities, actual cash refunded, reason, notes and optional phone. Unknown-batch goods stay **outside saleable inventory**.
- A persistent red pending-return indicator appears across pages and reloads. Only Owner/Manager may verify the original bill and match the exact goods. A matched refund moves **no cash again**.
- Refund differences require confirmed customer cash recovery/top-up. Owner alone may explicitly absorb an overpayment as an accounting expense, without deducting drawer cash twice. Underpayments cannot be written off.
- Stable UI refund request IDs reject retries of the same direct/provisional request; a linked provisional case cannot be linked twice.

### Cash drawer

- One active shift with an explicit float/operator, signed cash movements and source-document references.
- Expected cash = opening + net cash sales + owner deposits + recovered differences + received supplier cash refunds − customer refunds − expenses − owner withdrawals − cash paid to suppliers.
- Tendered/change are not counted as revenue: receiving Rs. 100 and returning Rs. 30 records **Rs. 70**.
- Actual counted close, saved expected balance, signed variance and an explanation for any shortage/excess.
- Atomic handover closes the old shift and opens the next with **actual counted cash**, not the expected figure.
- Payouts cannot overdraw the drawer; movements cannot be backdated before prior cash entries.
- No fake historical cash entries are created for migrated Phase 1 invoices.

### Owner drawings and shop expenses

- Owner-only cash withdrawals (debits), cash returned (credits) and personal medicine use.
- Medicine use is valued **at purchase cost in this demo**, deducts safe stock, and creates neither a sale nor a cash movement. This valuation is an implementation assumption, not a confirmed shop policy.
- Owner/Manager daily/monthly cash expenses with category/purpose, notes and a separate expense journal. Owner drawings are not operating expenses.
- Journals have no per-entry edit/delete controls, but explicit whole-demo reset remains available; these are **not immutable production records**.

### Discount safeguards

- Owner/Manager choose margin or retail percentage mode and the cashier percentage limit.
- Master example: cost Rs. 200/retail Rs. 300 at 10% → **Rs. 290 in margin mode**, **Rs. 270 in retail mode**.
- No role can discount a line below its original lot purchase cost. Protected invoice rounding remains in force.
- Percentages use basis points and exact integer math; discounts are floored to whole paisa per line.
- **Margin mode and a 10% cashier maximum are adjustable sample defaults—not confirmed business policy.** The explicit discount limit and final ten-rupee rounding are separate rules.

## Phase 3 · smart stock & suppliers

- Supplier profiles: name, agency/company, phone, address and explicitly confirmed starting balance. Contact edits preserve historical purchase-name snapshots.
- New purchases charge the supplier account; **they do not automatically pay drawer cash**. Actual cash payments/refunds are separate, reference-linked transactions with an open shift and available payable/credit/cash limits.
- Accepted supplier returns trace the **original supplier, invoice and batch**, remove separately chosen shelf/quarantine quantities and credit **original purchase cost**, never retail price. Unique credit references and stable request IDs block duplicate credits/retries.
- Negative supplier balance means vendor credit. It offsets the next invoice **once through the running balance**, without another cash deduction. Bonus returns remove stock but credit zero.
- Migrated historical costs are **reference-only**, not assumed unpaid. Owner/Manager verify the supplier's actual **current statement**; already-posted Phase 3 movements are subtracted to derive carry-forward rather than charged twice.
- Three mutually exclusive expiry windows with adjustable days/colors, supplier filter and a fourth fixed-red **Expired goods** tab. Sample defaults: **365 / 180 / 90 days**; printed expiry is valid through that date in this demo.
- Three **saleable-stock** reorder stages: warning / critical / out. Per-product sample critical/warning/target defaults of **1 / 2 / 4 boxes** are converted to base units and adjustable, with preferred-supplier routing.
- Supplier-specific quantity selection, reviewed/copyable **free WhatsApp Web purchase request**. Manual login/send only—no paid API, automatic send, delivery claim, purchase, balance, stock or cash posting.
- Per-line **sample/bonus stock costs exactly zero**. Pack conversion, retail price and original lot remain tracked; no purchase cost, expense or cash is invented.
- Supplier/expiry/reorder management is Owner/Manager-only in the demo UI/domain. These role restrictions remain **not authentication**.

These defaults and operator attestations are not confirmed shop policies, legal medicine-return permissions or real supplier integrations. [Phase 3 decisions and checks](./docs/phase-3-progress.md).

## Try the demo

Fresh data contains **12 sample products**, two labelled purchase deliveries and an expired lot, with **no fabricated sales, refunds, expenses, cash shifts or supplier settlements**. Fresh supplier purchase liabilities are labelled sample data; migrated real previous-version liabilities remain unknown until statement verification.

1. **Cash drawer:** enter a sample operator and Rs. 1,000 float; open the shift.
2. **Counter:** choose **Panadol 500 mg**, keep the nearest lot and one strip, then **Checkout → Complete sale**. Its initial Rs. 67.50 retail/Rs. 50 cost rounds to **Rs. 60**. Expected drawer: **Rs. 1,060**.
3. **Returns:** locate that invoice and return **2 tablets**, not two strips. Default quarantine, refund **Rs. 12**, expected drawer **Rs. 1,048**. The original invoice remains unchanged.
4. For a separate lost-bill scenario, make a **new sale**, then use **Provisional return**. Watch the pending indicator survive navigation/reload; Manager/Owner can **Verify & link bill**. Do not attempt to return the same previously returned units again.
5. **Accounts:** test owner withdrawal/repayment/medicine use, or daily tea/monthly rent under **Shop expenses**.
6. **Cash drawer:** count the actual sample balance, record any variance note and close or hand over to another operator.
7. **Settings:** adjust receipt identity, paper width and discount policy. Owner **Reset demo** requires typing `RESET` and intentionally removes current demo transactions.

Sample Panadol barcodes (search and Enter):

| Pack        | Barcode        |
| ----------- | -------------- |
| Base tablet | `110000000011` |
| Strip       | `110000000012` |
| Box         | `110000000013` |

Shortcuts: **F2 / Ctrl+K** product search, **F4** parked carts, **F8** checkout.

**Try Phase 3:** use **Suppliers** to inspect an account or create a confirmed-zero sample supplier; **Stock in** receives standard/zero-cost bonus lines; **Expiry** reviews four bands; **Reorder** filters low-stock products and prepares reviewed WhatsApp text. The seed supplier phones are intentionally blank: add your own test destination to enable the Web link. A step-by-step Urdu test with expected **100 tablets / Rs. 500 purchase → 2-tablet credit / Rs. 490 payable** is in the [testing/hosting guide](./docs/phase-3-testing-hosting.md).

## Browser data and migration

- The existing key **`area11.phase1.workspace.v1` is retained**; its snapshot now uses **`schemaVersion: 3`**.
- Startup strictly validates genuine V1/V2 root and nested data. V1 chains through a validated V2 intermediate; its **exact original JSON** is retained at **`area11.migration.phase1.original.v1`**. V2 is backed up at **`area11.migration.phase2.original.v2`** before upgrading the primary to V3. Stock/quarantine, IDs, invoice/refund sequences, receipt snapshots, cash sessions/entries, owner/expense journals, cart/discount/phone holds and shop settings are preserved.
- Failed validation, backup/storage failure, conflicting originals or an unsupported version **pause transactions without overwriting the original**. Do not reset merely to migrate. Resolve storage issues/reload, or preserve the saved data before a deliberate reset.
- Owner **Download saved snapshot** **Download original Phase 1** and **Download original Phase 2** provide recovery copies if originals exist. Both migration copies are retained on demo reset. These downloads are **not an import/restore workflow, scheduled backup or cloud service**.
- Data is tied to **this browser and this origin**. New preview domains, different browsers/devices and site-data removal do not transfer localStorage. Save a recovery copy before changing origins; scheduled backup/restore/sync remain later work.
- Use one active demo tab. Revision checks detect many stale-tab writes but are not a database mutex or a multi-counter guarantee.
- Validated persist-before-publish snapshots keep related cash/stock/documents together. This does not guarantee physical cash exchange; confirmations are operator attestations, and no payment processor is connected.

## Test and verify

```sh
npm run format:check
npm run typecheck
npm test
npm run build
npm audit
npx playwright install --with-deps chromium
npm run test:e2e
```

The **212 unit/repository + 36 Chromium E2E** tests cover Phases 1–3: exact packaging and protected discounts/rounding, batch-linked/cumulative refunds, provisional reconciliation, quarantine, cash/owner/expenses, supplier charges/credits/cash signs, zero-cost bonus lots, expiry boundaries/colors, reorder/WhatsApp side-effect freedom, genuine V1/V2 migration and failed-persistence rollback. Chromium E2E checks include responsive layouts, receipt printing/PDF, cash/return workflows and automated Axe checks. The final combined E2E suite runs against the compiled production preview; exact locally executed results are recorded in [Phase 3 progress](./docs/phase-3-progress.md).

The sandbox uses a Chromium 153 executable obtained through an **ignored, isolated** npm browser-tools directory when Playwright's CDN is unavailable. Normal environments can use the installer above. The CI template includes format/typecheck/unit/audit/build/Chromium E2E checks. It is in `docs/workflow-templates/ci.yml` pending GitHub workflow permissions; no automatic remote CI success is claimed.

## Preview and permanent hosting

Use Arena's **Live Preview → Pharmacy demo** for the temporary, session-bound website. The unauthenticated external sandbox URL is traffic-token protected, so it is **not a verified open/public share link**.

Two deployment paths are documented: **GitHub Pages** (prepared push-based template: `docs/workflow-templates/deploy-pages.yml`, requiring owner/workflow permission to install) and **Cloudflare Pages** (Git integration or built-assets Direct Upload). **Permanent public publishing is currently blocked by Pages-admin permissions**: the Arena connection received HTTP 403 when enabling Pages, and GitHub rejected active workflow files without the integration’s `workflows` permission. Templates are retained in `docs/workflow-templates/` rather than silently pretending Actions are installed. **Recommended now: connect this existing repository and the room’s branch to Cloudflare Pages**. For GitHub Pages, reconnect/authorize the Arena GitHub integration for workflows (or have the owner install the templates), then enable **Pages → GitHub Actions**. Exact links, fixed deployment branch, automatic-update behavior and the one-time setup are in [Permanent hosting & room updates](./docs/deployment.md). No predicted URL is claimed live before a successful, externally verified deployment.

```sh
# Root-domain hosting (Cloudflare Pages)
VITE_BASE_PATH=/ npm run build

# GitHub project path (or use the Pages workflow's configured base)
VITE_BASE_PATH=/Area11/ npm run build
VITE_BASE_PATH=/Area11/ npm run preview -- --port 4173
# http://localhost:4173/Area11/
```

The non-secret base can also be set in a local `.env` using `.env.example`. Icons/fonts/assets are base-path safe, and root plus project-path production builds were smoke-tested. **Static hosting serves only the demo**: it does not create a shared database, authentication, multi-device sync or scheduled backups. Changing origins does not transfer browser data; save a recovery copy first. Upload **only built `dist` assets**, never browser financial snapshots or credentials.

## Architecture and roadmap

- `src/domain/model.ts`: V3 schemas, monetary/pack/date helpers and snapshot validation.
- `src/domain/operations.ts`: products, stock, carts, discounts and sales.
- `src/domain/arithmetic.ts`, `returns.ts`, `cash.ts`, `accounts.ts`: exact refund allocation and atomic financial commands.
- `src/domain/suppliers.ts`, `alerts.ts`, `validation-stock.ts`: supplier accounting/returns/settlements, expiry/reorder/WhatsApp drafts and cross-record stock/ledger validation.
- `src/domain/legacy-v1.ts`, `legacy-v2.ts`, `legacy-validation-v2.ts`, `src/data/migrations.ts`: frozen strict legacy validation and exact-original upgrades.
- `src/data/repository.ts`: revision-checked browser persistence and recovery pause.
- `src/pages/`, `src/ui/`: functional counter, inventory, receipts, return queue, cash drawer, account journals, suppliers, expiry/reorder desks, settings and dialogs.

| Phase                            | Status                                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1 · Core lifeline                | Implemented demo; regressions retained                                                                |
| 2 · Returns, cash & accounts     | Implemented demo                                                                                      |
| 3 · Smart stock & suppliers      | Implemented demo; 0.3.0 / schema 3                                                                    |
| 4 · Customers & advanced billing | Later: profiles, credit, loyalty, price tiers, split pay, custom fields/categories                    |
| 5 · Intelligence & hybrid sync   | Later: immutable audit, advanced search/counting/reports, complete offline/cloud sync, backup/restore |

Confirmed starting choices: [Phase 1 decisions](./docs/phase-1-decisions.md). Historical deliveries: [Phase 1](./docs/phase-1-progress.md), [Phase 2](./docs/phase-2-progress.md). Current implementation decisions and verification: [Phase 3 progress](./docs/phase-3-progress.md). The master specifications remain unchanged.
