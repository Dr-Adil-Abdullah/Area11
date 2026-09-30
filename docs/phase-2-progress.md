# فیز 2 — ریٹرن، کیش اور کھاتے

> **تاریخی فیز 2 delivery record:** یہ فیز 2 کی تکمیل کے نتائج ہیں۔ موجودہ schema 3، محفوظ V1/V2 migration اور نئے checks [فیز 3 کی پیش رفت](./phase-3-progress.md) میں ہیں۔

**تاریخ:** 30 ستمبر 2026

**ریپو:** `Dr-Adil-Abdullah/Area11`

**ڈیمو ورژن:** `0.2.0` · `schemaVersion: 2`

فیز 1 کی تکمیل کے بعد صارف کے **“Keep going”** کے مطابق اسی ریپو میں ماسٹر روڈ میپ کا فیز 2 بنایا گیا ہے۔ اصل [ماسٹر دستاویز](../complete_numbered_master_specs%20%281%29.md) میں تبدیلی نہیں کی گئی۔ انٹرفیس English، رقم PKR، اور استعمال اب بھی sample-data demo ہے۔

## 1. نافذ شدہ چھ حصے

| ماسٹر فیز 2                    | کام کرنے والا نفاذ                                                                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| اصل بل سے سیلز ریٹرن           | اصل انوائس، line index اور اصل batch سے تعلق؛ چھوٹی اکائی میں مقدار؛ پچھلے ریٹرنز سمیت اصل فروخت سے زیادہ واپسی ممنوع                                       |
| گم شدہ بل / عارضی ریٹرن        | انوائس، دوا، recorded phone اور تاریخ سے lookup؛ فوری provisional cash refund؛ تمام صفحات/reload پر مستقل سرخ pending indicator؛ Manager/Owner verification |
| float، handover، closing       | ایک فعال shift؛ signed cash journal؛ actual count، expected cash، variance اور ضروری وضاحت؛ actual count ہی اگلی shift کا opening float                     |
| مالک کا ذاتی کھاتہ             | صرف Owner: cash withdrawal debit، cash repayment credit، medicine use debit؛ دوا کی مقدار متعلقہ محفوظ بیچ سے کم ہوتی ہے                                    |
| دکان کے اخراجات                | Owner/Manager daily/monthly cash expense، category/purpose، notes اور الگ journal؛ ذاتی drawings اس میں شامل نہیں                                           |
| خرید لاگت سے نیچے رعایت کا لاک | margin/retail طریقہ؛ Owner/Manager مقرر کردہ cashier cap؛ ہر لائن کا cost floor؛ فیز 1 کی تصدیق شدہ protected rounding برقرار                               |

### نیا آغازِ کاؤنٹر

**Cash drawer → operator label + opening float → Open cash shift**۔ اس کے بعد cash sale/refund/expense/owner cash entry ممکن ہے۔ ابتدائی shift یا رقم فرض نہیں کی گئی؛ zero float بھی جائز ہے۔ پرانے فیز 1 بل نئی shift کی آمدنی نہیں بن جاتے۔

## 2. ریٹرن اور اصل رقم کا تحفظ

- ریٹرن موجودہ قیمت سے نہیں، اصل بل میں **واقعی وصول شدہ رقم** سے نکلتا ہے۔ discounts، round-down اور original price snapshots برقرار رہتے ہیں۔
- انوائس کا round-down پہلے profit margin سے تقسیم ہوتا ہے؛ لائن کی purchase cost محفوظ رہتی ہے۔ باقی paisa کی تقسیم exact BigInt largest-remainder طریقے سے ہوتی ہے، tie اصل line order سے۔ تمام لائنز کا مجموعہ اصل وصولی کے برابر ہے۔
- جزوی واپسی cumulative proration سے نکلتی ہے۔ مثال: تین اکائیوں کی اصل وصولی Rs. 20 ہو تو الگ الگ refunds **6.66، 6.67، 6.67** ہوں گے؛ مجموعہ 20، نہ کم نہ زیادہ۔
- واپس مقدار cumulative اصل فروخت سے زیادہ نہیں ہو سکتی۔ ایک ہی original line کو ایک request میں دو مرتبہ دینا ممنوع ہے۔
- UI کی stable request identity، اسی direct/provisional refund request کے دوبارہ اجرا کو روکتی ہے۔ pending case کا دوسرا link بھی ممنوع ہے۔
- original invoice کا amount، price، discount، batch اور time ریٹرن سے تبدیل یا حذف نہیں ہوتا۔

### محفوظ اسٹاک کی حیثیت

Default **quarantine** ہے: مال اسی اصل batch کی total quantity میں واپس، مگر saleable quantity میں نہیں۔ scanner، FEFO، batch selector، cart validation اور Owner medicine use سب quarantine کو خارج کرتے ہیں۔

Cashier restock نہیں کر سکتا۔ Owner/Manager واضح انتخاب سے inspected، unexpired goods restock کر سکتا ہے؛ damaged/expired lines ہمیشہ quarantine ہیں۔ یہ **حقیقی دوا کی قانونی یا clinical suitability کی منظوری نہیں**۔ حقیقی returns/inspection/resale policy، supplier claims اور quarantine disposition ابھی الگ production تصدیق چاہتے ہیں۔

Unknown-batch provisional goods پہلے صرف pending record میں held رہتے ہیں؛ کسی بیچ میں اندازے سے اضافہ نہیں ہوتا۔ اصل bill verify ہونے پر exact received products/quantities متعلقہ اصل lots میں جاتے ہیں۔

## 3. provisional cash دوبارہ نہیں کٹتا

- matched original entitlement: **دوبارہ کوئی cash movement نہیں**؛ صرف bill linkage/stock recognition۔
- کم refund ہوا: صرف فرق customer کو ادا، موجودہ کھلی shift سے۔ اسے expense لکھ کر customer کی رقم ختم نہیں کی جا سکتی۔
- زیادہ refund ہوا: customer سے صرف فرق واقعی واپس وصول، یا **Owner کی واضح منظوری** سے overpayment accounting expense۔ پہلے ادا شدہ cash دوبارہ نہیں کٹتا۔
- Manager/Owner ہی pending bill clear کر سکتے ہیں؛ Customer goods کا product/quantity match ضروری ہے۔ نئی بعد کی sale کو پرانے provisional refund کا اصل bill بنانا ممنوع ہے۔
- matched/noncash resolution بند shift کے بعد بھی ممکن ہے؛ cash difference کے لیے نئی کھلی shift ضروری ہے۔
- pending indicator کسی dismiss timer سے ختم نہیں ہوتا؛ صرف کامیاب اصل bill linkage پر صاف ہوتا ہے۔ deliberate whole-demo reset/site-data removal الگ واضح destructive عمل ہیں۔

## 4. حساب اور persistence کی حدود

- cash sale میں **net due** journal ہوتا ہے، tendered پوری رقم نہیں۔ Rs. 100 received − Rs. 30 change = Rs. 70 cash in۔
- drawer expected = float + تمام signed cash entries۔ refund/expense/withdrawal موجودہ cash سے زیادہ نہیں ہو سکتا۔
- actual opening float اور counted close fields کو user خود درج کرتا ہے؛ calculated expected cash کو actual count میں خودکار نہیں بھرا جاتا۔
- closing variance = actual counted − expected؛ فرق کے لیے note لازم ہے۔ handover کا اگلا float actual count ہے۔ کمی/زیادتی خودکار owner drawing یا shop expense فرض نہیں ہوتی۔
- cash entries original source document سے مطابقت رکھتی ہیں؛ records، stock، quarantine، cash references اور closing snapshots validation سے گزرتے ہیں۔ cash arithmetic اور history-balance checks exact integer/BigInt ہیں۔
- operation کے متعلقہ cash، stock، account اور sequence changes ایک validated browser snapshot میں persist ہوتے ہیں، **persist-before-publish**۔ storage failure پر کوئی حصہ UI/store میں publish نہیں ہوتا۔
- cash confirmation operator کی attestation ہے، actual payment processor یا physical cash transfer کی ضمانت نہیں۔ یہ local demo ہے، server database transaction یا multi-counter mutex نہیں۔

## 5. محفوظ فیز 1 migration

Primary key **`area11.phase1.workspace.v1`** برقرار ہے، snapshot version 2 ہوگیا ہے۔

1. genuine V1 root **اور nested records** strict legacy schema سے validate ہوتے ہیں؛ version label بدل کر V2 records چھپانے سے financial data strip نہیں ہوتا۔
2. upgraded V2 بھی validate ہوتا ہے؛ اصل IDs، stock، original receipt amounts، purchase/sales sequences، unfinished cart، held batches اور shop settings محفوظ ہیں۔
3. اصل JSON بالکل اسی صورت میں **`area11.migration.phase1.original.v1`** میں لکھا جاتا ہے، پھر primary snapshot upgrade ہوتا ہے۔ revision بڑھتی ہے مگر bill counters نہیں۔
4. validation، backup/storage write، conflicting original یا unsupported snapshot کی ناکامی پر transactions pause؛ اصل primary JSON overwrite نہیں ہوتا۔ storage مسئلہ دور کرکے reload کریں؛ صرف migrate کرنے کے لیے reset نہ کریں۔
5. Owner recovery downloads current saved snapshot اور، اگر موجود ہو، original Phase 1 copy محفوظ کرنے دیتے ہیں۔ Owner demo reset original migration copy نہیں مٹاتا۔ یہ full import/restore، scheduled backup یا cloud service نہیں۔

**Same browser + same origin لازم ہے۔** الگ preview URL/domain، browser/device یا site-data clearing پر localStorage خود بخود منتقل نہیں ہوتا۔ پہلے recovery copy محفوظ کریں؛ مکمل backup/restore/sync روڈ میپ کے بعد کے حصے ہیں۔ ایک وقت میں ایک فعال demo tab استعمال کریں۔

## 6. صارف کے فیصلے بمقابلہ ڈیمو مفروضے

صارف کے تصدیق شدہ انتخاب بدستور: **demo first، English/PKR، sample data، purchase-cost priority**۔ نیا numeric refund/discount policy approval صارف سے منسوب نہیں کیا گیا۔

| فیصلہ / ترتیب                                          | حیثیت                                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| محفوظ invoice round-down / aggregate purchase cost     | پہلے سے صارف کا تصدیق شدہ اصول، برقرار                                                |
| margin mode + 10% cashier cap                          | صرف adjustable sample defaults؛ Owner/Manager Settings سے بدل سکتے ہیں                |
| ہر لائن کا discount floor / original lot cost          | ماسٹر safeguard؛ تمام roles پر لاگو، کوئی disable switch نہیں                         |
| percentage کی whole-paisa per-line flooring            | حسابی implementation convention؛ invoice rounding الگ ہے                              |
| اصل وصولی کی cost-preserving allocation                | consistent refund implementation؛ user-approved business policy کا دعویٰ نہیں         |
| owner medicine کو purchase cost پر debit               | demo accounting assumption؛ حقیقی shop valuation ابھی تصدیق نہیں                      |
| default quarantine / managerial inspected restock      | conservative demo disposition؛ legal/clinical approval نہیں                           |
| owner-only unrecovered provisional overpayment expense | explicit demo reconciliation control؛ حقیقی write-off approval policy ابھی تصدیق نہیں |

Manager بھی cashier maximum مقرر کر سکتا ہے، جیسا کہ master 7.3.2 میں ہے۔ Cashier کے فوری provisional returns master 9.2.2 کے مطابق ہیں؛ bill clearance Manager/Owner تک محدود ہے۔

## 7. مقامی verification

| Check                  | نتیجہ                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`    | پاس                                                                                                     |
| `npm test`             | **105** tests پاس: 30 original operations + 5 repository + 54 finance + 16 migration/atomic persistence |
| `npm run build`        | پاس؛ upstream Zod annotation warnings nonfatal ہیں                                                      |
| `npm audit`            | **0** معلوم root-project dependency vulnerabilities                                                     |
| `git diff --check`     | پاس                                                                                                     |
| `npm run format:check` | پاس                                                                                                     |
| `npm run test:e2e`     | **23/23 Chromium E2E tests** پاس، combined run **1.1 منٹ**؛ 10 original + 13 نئے                        |

اصل Phase 1 کے دسوں Chromium E2E tests نئے explicit-float workflow کے ساتھ پاس ہوئے ہیں۔ نئے tests direct/provisional returns، permanent alert، no-double-payment linkage، over/underpayment، handover/closing، owner/expense separation، discount/phone holds، genuine legacy migration، recovery download اور mobile/accessibility کو چیک کرتے ہیں۔

Chromium 153 sandbox executable ignored isolated browser-tools directory سے استعمال ہوا؛ actual Android device، assistive technology، printer/scanner اور physical cash کی جانچ کا دعویٰ نہیں۔ GitHub CI workflow موجود ہے، مگر remote execution اس session میں تصدیق شدہ نہیں۔

## 8. اگلا مرحلہ — فیز 3

**Supplier profiles / ledgers / returns، configurable expiry/reorder alerts، bonus stock**۔ نئی supplier transactions اور V2 → اگلی schema migration میں موجودہ invoice، returns، cash shifts اور accounts برقرار رکھنا ضروری ہے۔

Customers/credit/loyalty/price tiers/split payments/custom fields فیز 4؛ immutable audit، advanced reports/counting، full offline/cloud sync اور scheduled backup/restore فیز 5 میں رہیں گے۔ اصل shop identity، real stock، physical hardware، قانونی tax/returns policy اور server-enforced security کے بغیر اس ڈیمو کو حقیقی دکان میں استعمال نہ کریں۔
