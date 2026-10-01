# فیز 3 — ڈیمو دیکھنے، آزمانے اور ہوسٹنگ کی رہنمائی

**تاریخ:** 30 ستمبر 2026 · **ورژن:** `0.3.0` · English UI / PKR

> یہ sample-data demo ہے؛ حقیقی مریض، ادویات کا کاروبار، مالی کھاتے یا شناختی معلومات اس میں درج نہ کریں۔ Phase 4/5، authentication، مشترکہ database، مکمل offline/cloud sync اور backup/restore ابھی نافذ نہیں۔

## 1. ابھی ڈیمو کہاں دیکھیں؟

Arena میں اس session کا **Live Preview → Pharmacy demo** کھولیں۔ یہ عارضی، session-bound website preview ہے، مستقل عوامی hosting نہیں۔

بیرونی sandbox URL کی جانچ میں **Missing Traffic Access Token** آیا تھا۔ اس لیے اسے WhatsApp پر بانٹنے کے لیے کھلا public link نہیں کہا جا رہا، اور کسی access token/password کو اس گائیڈ میں شامل نہیں کیا گیا۔ Preview کو Arena کے فراہم کردہ viewer سے کھولیں؛ اگر آپ کو دوسرے فون یا افراد کے لیے مستقل public link چاہیے تو نیچے دیے گئے دو hosting راستوں میں سے ایک منتخب کریں۔

**نئی hosting ہدایت:** مستقل site اور auto-updates کی تازہ ترتیب [Permanent hosting & room updates](./deployment.md) میں ہے۔ Pages enable کرنے پر Arena connection کو HTTP 403 ملا، اور active workflow files کی push بھی workflow permission نہ ہونے سے رکی۔ templates `docs/workflow-templates/` میں محفوظ ہیں؛ آسان متبادل Cloudflare Git integration ہے۔ owner/provider setup کے بغیر کوئی permanent URL live ثابت نہیں ہوا۔

## 2. دس منٹ میں فیز 3 کا ٹیسٹ

اسی browser/origin میں ایک فعال tab استعمال کریں۔ اوپر **Owner** یا **Manager** منتخب رکھیں۔ پرانا ڈیٹا خود محفوظ migration سے upgrade ہوتا ہے؛ صرف upgrade کے لیے `Reset` نہ کریں۔ اپنی کوئی اہم demo entry ہو تو پہلے **Settings → Download saved snapshot** محفوظ کر لیں۔

### A. نیا supplier اور خریداری

1. **Stock in → New product** سے ایک الگ sample product بنائیں، مثلاً **Test tablets**۔
2. Packaging: **2 strips per box**، **10 base units per strip**؛ یعنی **1 box = 20 tablets**۔ بارکوڈ اختیاری ہے؛ دوسروں جیسا بارکوڈ استعمال نہ کریں۔
3. **New supplier** سے **Test Supplier** بنائیں، agency/phone صرف sample یا اپنے testing contact کی رکھیں۔ ایک نئے test account کے لیے starting balance **0** واضح طور پر درج اور confirm کریں۔
4. **Standard purchased stock** منتخب کریں۔ **5 boxes**، الگ batch number مثلاً `TEST-PAID-01`، آئندہ تاریخ، **cost/base Rs. 5** اور **retail/base Rs. 7** درج کریں۔
5. **Receive & save stock** کریں۔ نئی `PINV` انوائس میں **100 tablets**، **Rs. 500** خرید لاگت ہونی چاہیے۔
6. **Suppliers** میں Test Supplier منتخب کریں: payable **Rs. 500**۔ خرید سے drawer cash یا shop expense خود نہیں بدلتا۔

### B. supplier return اور اصل لاگت کی credit

1. اسی supplier کے کھاتے سے **Return goods to supplier** کھولیں۔
2. اصل `TEST-PAID-01` lot سے **2 shelf units** منتخب کریں — **2 tablets، دو boxes نہیں**۔ reason **Damaged** اور منفرد sample credit reference درج کریں۔
3. صرف sample scenario میں goods/credit کی acceptance confirm کریں۔ دکھائی گئی credit **Rs. 10** ہونی چاہیے، **Rs. 14 retail** نہیں۔
4. محفوظ ہونے کے بعد stock **98 tablets**، supplier payable **Rs. 490**؛ original purchase محفوظ اور drawer cash غیر تبدیل رہنا چاہیے۔
5. دوسری credit note کو وہی reference دینے سے duplicate credit/stock deduction رکنا چاہیے۔ Quarantine والے مال کی مقدار الگ field میں منتخب ہوتی ہے؛ guessed supplier کے ساتھ unknown-batch provisional goods واپس نہیں کیے جا سکتے۔

### C. مفت bonus stock

1. **Stock in** میں وہی product/supplier منتخب کریں؛ الگ lot مثلاً `TEST-BONUS-01` بنائیں۔
2. **Sample / bonus · zero purchase cost** اور **1 box** منتخب کریں۔ cost **0.00** locked ہوگی؛ retail/base کو مناسب sample value دیں۔
3. Receive کرنے سے **20 tablets** اضافہ: پچھلے scenario کے ساتھ total **118**۔ نئی انوائس cost **Rs. 0**، supplier payable اب بھی **Rs. 490**، نہ cash payment نہ shop expense۔
4. ایسے bonus goods کی supplier واپسی physical stock کم کرتی ہے لیکن **Rs. 0 credit** دیتی ہے۔

### D. expiry کی تین windows اور چوتھا expired tab

1. **Expiry** کھولیں۔ ابتدائی sample thresholds **365 / 180 / 90 days** ہیں؛ ہر on-hand lot صرف ایک band میں دکھتا ہے۔
2. **Expired goods** میں sample `DEMO-07-EXPIRED` / **ORS sachet** دیکھیں۔ یہ counter یا owner medicine use کے لیے blocked ہے؛ اصل supplier کو accepted return ممکن ہے۔
3. **Configure alert days & colors** سے ترتیب کے ساتھ days اور تین colors بدلیں: **near < middle < far**۔ غلط ترتیب save نہیں ہوگی۔
4. Printed expiry date والے دن lot ابھی unexpired ہے؛ اگلے دن expired۔ یہ صرف demo date rule ہے، قانونی/clinical اجازت یا supplier return cutoff کی تصدیق نہیں۔

### E. reorder اور مفت WhatsApp Web draft

1. **Reorder → Configure product thresholds** میں Test tablets منتخب کریں۔ آسان test کے لیے critical **120**، warning **140**، target **160** اور preferred supplier **Test Supplier** مقرر کریں۔
2. اوپر **Test Supplier** filter کریں۔ 118 saleable tablets کے scenario میں **Critical** اور suggested **42 base units** دکھنے چاہییں۔ Expired/quarantined units saleable count میں شامل نہیں۔
3. product کا **Order** checkbox منتخب کریں، quantity دیکھیں/بدلیں اور تیار شدہ message پڑھیں۔
4. Supplier profile میں اپنا valid test WhatsApp mobile/international phone شامل کریں۔ seed suppliers کے phones جان بوجھ کر خالی ہیں؛ خالی/غلط destination پر copy-only draft ملے گا۔
5. review checkbox کے بعد **Open WhatsApp Web** فعال ہوگا۔ WhatsApp login درکار ہو سکتا ہے؛ بھیجنے کا آخری فیصلہ آپ کا ہے۔ **کوئی paid API یا automatic send نہیں**۔ quantity بدلنے سے review دوبارہ ضروری ہوگا۔
6. draft تیار/copy/open کرنے سے stock، cash، supplier payable، purchase invoice یا “message delivered” record نہیں بنتا۔ تجربے کے لیے حقیقی supplier کو غیر مطلوب message نہ بھیجیں۔

### F. cash settlement، reload اور roles

1. Cash پرداخت آزمانے کے لیے **Cash drawer** میں sample operator اور actual sample **opening float Rs. 1,000** درج کرکے shift کھولیں۔ float پہلے سے بھری نہیں ہوتی۔
2. **Suppliers → Test Supplier → Record cash settlement** میں **Rs. 100** actual sample payment، reference اور confirmation دیں۔ اوپر کے scenario میں supplier payable **Rs. 390**، expected drawer **Rs. 900** ہوگا۔
3. مثبت payable سے زیادہ payment، drawer سے زیادہ cash، یا vendor credit سے زیادہ received refund قبول نہیں ہوگا۔ accepted return خود cash exchange نہیں۔
4. Reload سے انوائس، supplier credit، stock، colors، thresholds اور cash journal برقرار رہنے چاہییں۔ **Cashier** منتخب کرنے سے supplier/expiry/reorder management بند اور کوئی کھلا management dialog بند ہو جاتا ہے۔ یہ client-side test role ہے، حقیقی security/login نہیں۔
5. پرانی Phase 1/2 supplier invoices کا balance **Needs reconciliation** ہو سکتا ہے۔ پرانی purchase cost کو خودکار unpaid debt نہیں بنایا گیا؛ **Confirm current statement balance** میں اصل verified sample current statement درج کریں۔ نئی Phase 3 movements پہلے سے posted ہوں تو انہیں دوبارہ charge نہیں کیا جاتا۔

**موبائل:** نیچے والی navigation کو افقی swipe کرکے Suppliers، Expiry، Reorder تک پہنچیں۔ چوڑی tables اپنے container میں scroll ہوتی ہیں؛ پورا page sideways نہیں پھیلتا۔ اصل Android/hardware certification کا دعویٰ نہیں۔

## 3. مستقل hosting کے دو راستے

دونوں موجودہ **static demo** کو serve کر سکتے ہیں؛ یہ خود سے shared database، user authentication، device sync یا pharmacy production safety نہیں بناتے۔ Browser data ہر origin/device پر الگ ہوگی۔ `dist/` میں browser کے مالی records یا localStorage backups شامل نہیں ہوتے۔

### آپشن 1: GitHub Pages — موجودہ public ریپو کے ساتھ

اس ریپو کی visibility اس session میں public چیک ہوئی ہے۔ GitHub Free پر public repositories کے لیے Pages دستیاب ہے؛ private repository کے لیے اہل paid plan درکار ہو سکتا ہے۔ [1](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)

- **`docs/workflow-templates/deploy-pages.yml`** میں تیار workflow، owner کی طرف سے `.github/workflows/` میں install ہونے/connection کی workflow permission درست ہونے کے بعد اس room کی fixed branch **`arena/01a0f117-area11`** کی ہر GitHub push پر checks اور deployment چلاتا ہے؛ دوسرے branches/PRs publish نہیں کرتے۔ یہ تبدیلی صارف کی permanent/auto-update ہدایت پر ہے۔
- room کے local saves خود GitHub push نہیں ہیں؛ مکمل تبدیلی کو اسی branch پر commit/push کرنے کے بعد website build/deploy ہوگی، پھر browser reload کریں۔
- Pages enable کرنے کی API درخواست **403: Resource not accessible by integration** سے رکی؛ repository owner کو ایک مرتبہ **[Settings → Pages](https://github.com/Dr-Adil-Abdullah/Area11/settings/pages) → Source: GitHub Actions** منتخب کرنا ہوگا۔ password/token chat میں نہ دیں۔
- `github-pages` environment کی branch protection ہو تو اسی branch کو allow کریں۔ Settings enable ہونے سے پہلے run failed ہو تو Actions میں latest **Publish demo to GitHub Pages** run کو **Re-run all jobs** کریں؛ مکمل طریقہ [deployment guide](./deployment.md) میں ہے۔
- workflow format/type/unit/audit، Chromium E2E اور base-path production build کے بعد ہی publish کرتا ہے۔ source/build metadata GitHub artifact میں ہے؛ browser کھاتے upload نہیں ہوتے۔
- Vite base، favicon، logo اور assets configured Pages path کے مطابق بنتے ہیں؛ معمول کے project URL پر base **`/Area11/`** ہے، custom root domain پر **`/`**۔
- **اصل website link کامیاب deployment کے `page_url`/Settings سے لیں**؛ متوقع URL کو پہلے live site کہنا درست نہیں۔

مقامی Pages-path build:

```sh
VITE_BASE_PATH=/Area11/ npm run build
VITE_BASE_PATH=/Area11/ npm run preview -- --port 4173
# Browser: http://localhost:4173/Area11/
```

Workflow permissions/Pages setup: [official GitHub workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

### آپشن 2: Cloudflare Pages — Git integration یا Direct Upload

Cloudflare Pages کا Free plan موجود ہے؛ limits لاگو ہیں، مثلاً Git builds کی 500/month حد۔ [1](https://developers.cloudflare.com/pages/platform/limits/index.md) React/Vite کے build settings **`npm run build`** اور **`dist`** ہیں۔ [2](https://developers.cloudflare.com/pages/configuration/build-configuration/)

**سادہ manual Direct Upload:**

```sh
npm ci
VITE_BASE_PATH=/ npm run build
```

1. اپنے Cloudflare dashboard میں **Workers & Pages → Create application → Get started → Drag and drop your files** کا Pages upload flow کھولیں۔
2. project name طے کریں اور **`dist` کے contents / built assets folder** upload کریں — پوری Git repository، `.env`، `node_modules`، recovery snapshots یا browser exports نہیں۔ zip کریں تو archive کے root میں `index.html` ہونا چاہیے۔
3. **Deploy site / Save and Deploy** کے بعد dashboard کا **حقیقی `pages.dev` link** لے کر دوسرے browser/phone پر کھولیں۔ ابھی ایسا project/link بنایا نہیں گیا۔
4. اگلی release کے لیے updated root build upload کرنا ہوگا؛ automatic deploy چاہیں تو Git integration والے setup کا انتخاب کریں۔

Direct Upload folder/zip، dashboard flow اور CLI alternatives: [official Cloudflare guide](https://developers.cloudflare.com/pages/get-started/direct-upload/).

**Git integration کا متبادل:** existing repository connect کریں، root directory repo root، Node **22.22.3** (`NODE_VERSION`)، build `npm run build`، output `dist` اور `VITE_BASE_PATH=/` دیں۔ اس session کا code اسی branch `arena/01a0f117-area11` پر ہے؛ یہی **Production branch** منتخب کریں تاکہ GitHub پر اس room کی pushes سے site خود update ہو۔ provider سے GitHub access authorization اس کے اپنے dashboard میں کریں؛ chat میں password/token نہ بھیجیں۔

## 4. مقامی automated checks

```sh
npm ci
npm run format:check
npm run typecheck
npm test
npm audit
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

sandbox میں Playwright CDN کی جگہ ignored isolated Chromium fallback استعمال ہوا:

```sh
LD_LIBRARY_PATH=/tmp/al2023/lib \
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/tmp/chromium npm run test:e2e
```

تازہ executed نتائج اور assumptions [Phase 3 progress](./phase-3-progress.md) میں درج ہیں۔ Physical printer/scanner، WhatsApp login/send/delivery، real pharmacy use، cloud provider deployment اور GitHub remote CI کی verification الگ کام ہے۔
