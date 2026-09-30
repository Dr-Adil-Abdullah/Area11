# فیز 3 — Smart Stock & Suppliers

> یہ Phase 3 implementation/delivery record ہے۔ بعد میں صارف نے permanent hosting اور push-based updates کی ہدایت دی؛ اس کی تازہ permission/setup حالت [deployment guide](./deployment.md) میں ہے۔

**تاریخ:** 30 ستمبر 2026

**ریپو:** `Dr-Adil-Abdullah/Area11`

**ڈیمو ورژن:** `0.3.0` · `schemaVersion: 3`

صارف کی ہدایت کے مطابق فیز 3 **پہلے نافذ** کیا گیا؛ testing/preview/دو hosting راستوں کی رہنمائی [اس گائیڈ](./phase-3-testing-hosting.md) میں ہے۔ فیز 1/2 کے حفاظتی اصول برقرار ہیں۔ اصل [ماسٹر دستاویز](../complete_numbered_master_specs%20%281%29.md) نہیں بدلی گئی۔

## 1. ماسٹر روڈ میپ کے پانچ حصے

| ضرورت                                        | نافذ شدہ ڈیمو                                                                                                                                                                       |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| supplier profile اور ledger                  | نام، agency/company، phone، address؛ explicit confirmed opening، historical invoice links، chronological running ledger، supplier cash payment/refund                               |
| expired/damaged goods کی supplier واپسی      | exact original supplier/delivery/batch؛ shelf اور quarantine الگ؛ supplier-accepted credit reference؛ اصل lot purchase cost پر credit؛ physical stock اور account credit اکٹھے save |
| تین configurable expiry levels + expired tab | ordered adjustable days، تین hex colors؛ mutually exclusive far/middle/near windows؛ fixed red expired-goods view اور supplier filter                                               |
| تین reorder stages + free WhatsApp Web order | per-product critical/warning/target limits؛ saleable-stock warning/critical/out stages، supplier filter، quantity/review/copy اور manual WhatsApp Web draft                         |
| sample/bonus stock at zero cost              | ہر delivery line پر stock type؛ bonus cost locked exactly 0، pack conversion/retail/lot معمول کے مطابق، supplier cost/expense/cash میں کوئی اضافہ نہیں                              |

UI میں **Suppliers، Expiry، Reorder** نئے functional pages ہیں۔ **Stock in** میں supplier dropdown/inline profile creation اور per-line bonus selector ہیں۔ Inventory، Counter اور batch dialog میں alert cues، purchase/return detail میں original traceability؛ settings میں expiry days/colors اور original Phase 2 download شامل ہے۔ فون پر bottom navigation افقی swipe ہو سکتی ہے؛ wide tables کا scroll اپنی surface کے اندر ہے۔

## 2. supplier حساب کی اہم حفاظت

- **مثبت balance = ہم supplier کو دینے ہیں؛ منفی balance = supplier کے پاس ہمارا credit۔**
- `balance = confirmed opening + new invoice costs − accepted return credits − cash payments + received vendor cash refunds`۔
- نئی purchase مکمل cost سے account میں post ہوتی ہے، **automatic drawer payment نہیں**۔ supplier کی cash settlement الگ actual-exchange confirmation، reference اور کھلے cash shift کے ساتھ ہوتی ہے۔ supplier payment shop expense نہیں۔
- مثال: confirmed zero account، purchase **Rs. 500**، accepted goods **2 × Rs. 5 = Rs. 10** → payable **Rs. 490**؛ original invoice اب بھی Rs. 500، cash نہیں بدلا۔
- settled supplier سے returned goods vendor credit بنا سکتے ہیں۔ **Rs. 20 credit + نئی Rs. 50 purchase → Rs. 30 payable**۔ credit کو نئی invoice اور cash میں دوبارہ deduct نہیں کیا جاتا۔
- supplier-specific accepted credit reference case/space normalization سے duplicate نہیں ہو سکتا؛ UI کا stable request ID اسی کھلے credit/payment request کے retry کو دوبارہ post نہیں کرتا۔
- shelf/quarantine quantities الگ availability سے check ہوتی ہیں۔ supplier return exact original lot کی quantity/cost سے بنتا ہے؛ retail rate یا guessed supplier سے نہیں۔ bonus goods remove ہوتے ہیں مگر zero supplier credit ملتی ہے۔
- unknown-batch provisional customer goods کسی guessed supplier کو assign نہیں ہوتے۔ پہلے Phase 2 کا اصل bill/lot reconciliation ضروری ہے۔
- cash payment known payable اور drawer amount سے زیادہ نہیں؛ actual supplier cash refund known negative vendor credit سے زیادہ نہیں۔ ہر settlement کا drawer journal میں ایک ہی counterpart اور `SPAY` reference ہے۔
- ledger events کا الگ monotonically increasing order ہے؛ same-time invoice/credit/payment کی ترتیب بھی deterministic ہے۔ invalid backdated ledger/financial histories save نہیں ہوتیں۔
- invoice/credit/stock/cash/counter changes **validated persist-before-publish snapshot** میں جاتے ہیں۔ storage failure پر UI/store/primary میں partial movement نہیں بنتا۔ original invoices normal operations میں edit/delete نہیں ہوتے؛ whole-demo reset اور browser devtools کی وجہ سے انہیں production-immutable records نہیں کہا جا رہا۔

## 3. پرانے supplier کھاتوں کو فرضی debt نہیں بنایا

Phase 1/2 میں supplier کے actual payments record نہیں تھے، اس لیے پرانی purchase cost کو unpaid liability فرض کرنا غلط ہوتا۔

- migrated suppliers کی opening **unconfirmed/unknown** ہے؛ UI **Needs reconciliation** دکھاتی ہے۔ پرانی purchase invoices `legacy-reference` ہیں، نہ نئی charge نہ cash entry۔
- Owner/Manager **actual current statement**، direction، amount، note اور attestation دیتے ہیں۔ zero balance بھی خود سے confirm نہیں کیا جاتا۔
- already-posted Phase 3 movements current statement میں شامل ہوں تو `derived carry-forward = entered current statement − new net movements`؛ انہیں دوبارہ charge نہیں کیا جاتا۔
- اس opening کو دوبارہ edit کرنے کا راستہ نہیں؛ یہ full settlement/import/audit workflow نہیں، conservative demo migration decision ہے۔

## 4. expiry اور reorder مفروضے

| sample default / rule                              | حیثیت                                                                                                                         |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| far 365 / middle 180 / near 90 days                | قابل تبدیلی initial sample defaults، user-confirmed supplier cutoff نہیں                                                      |
| far `#19776d` / middle `#a16b09` / near `#b44827`  | تین configurable hex colors؛ expired fixed red                                                                                |
| near 0–90، middle 91–180، far 181–365، پھر outside | mutually exclusive lists؛ on-hand quarantine بھی expiry review میں، saleable count سے باہر                                    |
| printed expiry date valid through that day         | demo business-date rule؛ اگلے دن expired/blocked                                                                              |
| critical 1 box / warning 2 boxes / target 4 boxes  | per-product base-unit conversion، adjustable sample reorder defaults                                                          |
| saleable count                                     | expired/quarantined quantities excluded؛ parked carts stock reserve نہیں کرتے                                                 |
| preferred supplier یا original receipt history     | request ایک selected supplier کے لیے؛ unassigned product کو policy میں supplier دیا جا سکتا ہے                                |
| WhatsApp request                                   | formatted reviewed draft، copy/manual Web link؛ کوئی paid API، automatic send، delivery confirmation یا purchase posting نہیں |

WhatsApp destination valid normalized mobile/international number نہ ہو تو copy-only text ملتی ہے۔ text/phone URL-encoded ہیں؛ product/supplier change پر quantities/review revalidate ہوتے ہیں۔ stock، invoice، cash، account balance unchanged رہتے ہیں۔ Actual WhatsApp login/send/delivery اس session میں آزمائی نہیں گئی۔

## 5. محفوظ V1/V2 migration

- primary key **`area11.phase1.workspace.v1`** برقرار؛ current snapshot **3**۔
- حقیقی V1 اور V2 کے **root اور nested schemas strict** ہیں؛ V2 validation اپنے frozen previous-version stock/finance rules کے ساتھ ہے۔ صرف version بدل کر V3 fields چھپانے سے انہیں silently strip نہیں کیا جاتا۔
- حقیقی V2 original JSON پہلے **`area11.migration.phase2.original.v2`** میں exact bytes سے save، پھر upgraded primary۔ V1 original **`area11.migration.phase1.original.v1`** الگ برقرار؛ V1→V2 intermediate→V3 chain بھی supported ہے۔
- IDs، stock/quarantine، purchase/sale/refund records، cash sessions/entries، close/handover، expenses/drawings، invoice counters، unfinished cart اور held batch/discount/phone محفوظ ہیں۔ صرف new metadata/counters/defaults اور ایک revision اضافہ۔
- validation failure، original backup conflict، backup write یا primary write failure → transactions pause، پرانا primary overwrite نہیں۔ retry اسی original سے ممکن ہے؛ reload migration دوبارہ نہیں چلاتا۔
- Owner current snapshot، original Phase 1 اور original Phase 2 (اگر موجود) download کر سکتا ہے۔ explicit demo reset originals نہیں مٹاتا۔ downloads **full import/restore، scheduled backup یا cloud sync نہیں**۔
- origin/browser-bound localStorage ہے؛ hosting بدلنے سے data خود منتقل نہیں ہوتی۔ ایک active tab استعمال کریں؛ revision checks database mutex نہیں۔

## 6. آخری مقامی verification

| check                                   | executed نتیجہ                                                                                                                                            |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check`                  | پاس                                                                                                                                                       |
| `npm run typecheck`                     | پاس                                                                                                                                                       |
| `npm test`                              | **212/212**: 30 operations + 54 finance + 5 repository + 16 V1 migration/atomic + 87 smart-stock + 20 V2 migration/Phase 3 atomic                         |
| `npm audit`                             | **0** معلوم root-project dependency vulnerabilities                                                                                                       |
| `npm run build`                         | root build پاس                                                                                                                                            |
| `VITE_BASE_PATH=/Area11/ npm run build` | Pages project-path build پاس                                                                                                                              |
| production smoke `/` اور `/Area11/`     | 12 products، schema 3، favicon/logo/fonts/assets؛ runtime errors **0**، failed asset responses **0**                                                      |
| complete Chromium E2E                   | **36/36**، آخری combined run **1.3 منٹ**؛ 10 Phase 1 + 13 Phase 2 + 13 Phase 3، **compiled production build** پر                                          |
| responsive checks                       | 390px viewport پر نئی pages/dialogs سمیت پورے page کی horizontal overflow نہیں؛ desktop/mobile screenshots inspected                                      |
| automated Axe checks                    | counter، stock، finance، new stock pages، supplier/return/cash/reorder dialogs اور expiry settings checks پاس؛ مکمل human/assistive-technology audit نہیں |
| preview Host check                      | `.e2b.app` Host پر local production server HTTP **200**؛ external unauthenticated sandbox URL access-token gate دکھاتا ہے                                 |
| `git diff --check` / master unchanged   | پاس                                                                                                                                                       |

نئے Chromium flows bonus conversion، inline supplier/draft preservation، purchase-on-account، payment/refund journal refs، credit-next-invoice offset، shelf/quarantine return، expired return without cash shift، days/colors validation، supplier-specific reviewed WhatsApp draft، duplicate-credit block، V2 migration/download، failed-save retry، role downgrade، accessibility/mobile check کرتے ہیں۔

Chromium 153 fallback ignored isolated tools directory سے چلا؛ اصل Android، barcode scanner، thermal printer، physical cash exchange یا حقیقی clinical operations کی certification نہیں۔ دو upstream Zod annotation-position warnings nonfatal ہیں؛ build exits 0۔ vendor chunks الگ کرنے کے بعد oversized JS-chunk warning نہیں ہے۔

## 7. preview، hosting اور باقی فیز

- **Live Preview → Pharmacy demo** عارضی compiled website ہے؛ sandbox session ختم ہونے کے بعد مستقل availability نہیں۔ direct external URL publicly accessible ثابت نہیں، اس لیے اسے public deployment نہیں کہا گیا۔
- root Cloudflare Pages اور project-path GitHub Pages builds تیار؛ Phase 3 delivery کے وقت manual-only Pages workflow، non-secret base-path example اور [testing/hosting guide](./phase-3-testing-hosting.md) شامل ہے۔
- GitHub repo public ہونے کی metadata check ہوئی ہے۔ Phase 3 delivery کے وقت provider account/Pages project setup، public deployment، remote CI، git commit/push یا PR نہیں کیے گئے تھے؛ hosting کی بعد کی ہدایت کا ریکارڈ deployment guide میں ہے۔ کوئی secrets مانگی/شائع نہیں کی گئیں۔
- Phase 4: customer profiles/credit/loyalty/tiered pricing/split payment/custom fields بعد میں۔
- Phase 5: immutable audit/advanced reports/counting/full offline-cloud synchronization/scheduled backup-restore بعد میں۔
- confirmed choices بدستور **demo first، English/PKR، sample data، purchase-cost priority** ہیں۔ temporary preview یا static hosting انہیں production security/shared database میں تبدیل نہیں کرتے۔
