# برانچیں اور merge — صاف نقشہ (کون سی merge کریں، کون سی نہیں)

> مالک (Dr. Adil Abdullah) کے لیے · تاریخ **7-Oct-2026** · ورژن **0.6.2**
> یہ فائل ہمیشہ کے لیے ہے: جب بھی شبہ ہو کہ «اب کس برانچ کو merge کرنا ہے» — اسی کو کھولیں۔

---

## 1. ریپو کی بنیادی معلومات

| چیز | قدر |
|---|---|
| ریپو | `Dr-Adil-Abdullah/Area11` |
| **اصل (default) برانچ** | **`main`** |
| **موجودہ کام والی برانچ** | **`arena/01a10395-area11`** (یہی اس سیشن کی برانچ) |
| برانچ پر کوئی پابندی (protection) | ❌ نہیں — merge خودکار طور پر نہیں رکا جا سکتا |
| چیک پوائنٹ ٹیگز | 44 (`stage-1` … `stage-44`) — ہمیشہ محفوظ رہتے ہیں |

---

## 2. GitHub پر موجود **تمام برانچیں** اور ان کا فیصلہ

| # | برانچ | آخری کمِٹ | PR | حالت | **فیصلہ** |
|---|-------|----------|----|------|-----------|
| 1 | **`main`** | `c04f3a2` | — | اصل برانچ (پرانا Vite ڈیمو؛ اسی سے `marea11.netlify.app` چل رہا ہے) | ❌ merge نہ کریں — یہ **منزل** ہے |
| 2 | `arena/01a0f117-area11` | `3dd5078` | **PR #1** | ✅ **MERGED** (پہلے ہی main میں) | ❌ کچھ نہیں کرنا |
| 3 | `arena/01a0f0cf-area11` | `a357873` | **PR #2** | بند — **بغیر merge** | ❌ merge کی ضرورت نہیں |
| 4 | **`arena/01a10395-area11`** | `31baf57` | **PR #3** | 🟢 **کھلا — MERGEABLE** | ✅ **صرف یہی merge کریں** |

### پرانی برانچ (نمبر 3) کو merge کیوں نہیں کرنا؟
کیوں کہ اس کے **سارے 10 کمِٹ پہلے سے ہماری برانچ (نمبر 4) کی تاریخ میں موجود ہیں** — میں نے ایک ایک کر کے
جانچا (`git merge-base --is-ancestor`):

```
006693c Initial commit                        ✅ شامل
ed5d0ab ساتون 0: بنیادی ڈھانچہ               ✅ شامل
9a51ecd Data                                  ✅ شامل
5c7a9a3 سٹون 0: ماسٹر سپیک                   ✅ شامل
1fc329d merge: main se master spec            ✅ شامل
1f5350a سٹون 0: نمبر دار ضابطہ (164 نکات)     ✅ شامل
4fb4b04 سٹون 0.5: ایپ کی بنیاد                ✅ شامل
25316c4 فیز 1 (کاؤنٹر چالو)                  ✅ شامل
c3b163e merge: Vite ڈیمو → legacy-demo-vite/  ✅ شامل
a357873 فیز 1 مکمل + فیز 2 ضروری              ✅ شامل
```

اس لیے PR #2 دوبارہ چلانے کا **کوئی فائدہ نہیں** — صرف الجھن پیدا ہو گی۔

---

## 3. ✅ کام کا اصل نسخہ: **PR #3 merge کریں**

`arena/01a10395-area11`  →  `main`

جانچ کر کے دیکھ لیا گیا ہے:

- ✔️ **تصادم (conflict) بالکل نہیں** — 0
- ✔️ GitHub کی رپورٹ: **MERGEABLE**
- ✔️ `main` پر کوئی پابندی نہیں
- 📦 فرق: **256 فائلیں**، **66 کمِٹ**

### ⚠️ Netlify کے 3 چیک «fail» کیوں دکھ رہے ہیں؟
یہ **رکاوٹ نہیں** ہیں اور merge کو نہیں روک سکتے۔ وجہ صرف یہ ہے کہ Netlify ریپو کی **جڑ (root)** سے
Next.js ایپ بنانے کی کوشش کر رہا ہے (جو Node + ڈیٹا بیس مانگتی ہے)۔
**حل:** merge کے بعد **Base directory = `legacy-demo-vite`** کر دیں (نیچے حصّہ 5) — پھر یہ چیک خودبخود سبز ہو جائیں گے۔

---

## 4. merge کرنے کا طریقہ

### طریقہ الف — GitHub کی ویب سائٹ سے (سب سے آسان، 1 منٹ)
1. لنک کھولیں: **https://github.com/Dr-Adil-Abdullah/Area11/pull/3**
2. صفحہ کے آخر میں **“Merge pull request”** کا بٹن دبائیں
3. اوپر والا آپشن **“Create a merge commit”** ہی رہنے دیں
   (اس سے 66 کمِٹ اور 44 ٹیگ سب محفوظ رہتے ہیں؛ **Squash نہ کریں**)
4. **“Confirm merge”** دبائیں → ہو گیا ✅

### طریقہ ب — کمانڈ لائن سے (کمپیوٹر پر)
```bash
cd Area11
git checkout main
git pull origin main
git merge --no-ff origin/arena/01a10395-area11 -m "Merge PR #3: Area11 v0.6.2"
git push origin main
```

### merge کے فوراً بعد (لازمی)
1. `main` پر ایپ ایک بار چلا کر دیکھ لیں (`npm install && npm start`)۔
2. **مالک کا ڈیفالٹ پاس ورڈ `area11` بدل دیں**۔
3. ایک **بیک اپ** لے لیں (Settings → Backup)۔

---

## 5. Netlify کی سیٹنگ (merge کے بعد)

1. <https://app.netlify.com> → پروجیکٹ **marea11** کھولیں
2. **Site configuration** (یا *Site settings*) پر جائیں
3. بائیں مینو: **Build & deploy** → **Continuous deployment**
4. **Base directory** کے خانے میں لکھیں:
   ```
   legacy-demo-vite
   ```
5. **Save** دبائیں → پھر **Deploys** میں “Trigger deploy → Deploy site”
6. چند منٹ بعد <https://marea11.netlify.app> تازہ ڈیمو دکھانے لگے گی

> سیٹنگ فائل میں بھی یہی درج ہے: `legacy-demo-vite/netlify.toml`
> (اصل ایپ Netlify پر **نہیں** چل سکتی — وجہ اور متبادل: [`docs/CHALANE-KA-TARIQA.md`](CHALANE-KA-TARIQA.md) حصّہ 3)

---

## 6. merge کے بعد پرانی برانچیں؟

| برانچ | مشورہ |
|---|---|
| `arena/01a0f117-area11` | ڈیلیٹ کی جا سکتی ہے (PR #1 merge ہو چکا) |
| `arena/01a0f0cf-area11` | ڈیلیٹ کی جا سکتی ہے (اس کا کام PR #3 میں شامل ہے) |
| `arena/01a10395-area11` | **رکھیں** — یہ ہماری کام والی برانچ ہے، آئندہ کام اسی پر ہوتا رہے گا |

ڈیلیٹ کرنا ہو تو (کوئی ڈیٹا ضائع نہیں ہوتا — 44 ٹیگز میں سب محفوظ ہے):
```bash
git push origin --delete arena/01a0f117-area11
git push origin --delete arena/01a0f0cf-area11
```

---

## 7. ایک نظر میں خلاصہ

```
main  ←  arena/01a10395-area11      ✅ MERGE KAREIN (PR #3)
         arena/01a0f0cf-area11      ❌ zaroorat nahi (kaam pehle se shamil)
         arena/01a0f117-area11      ❌ merge ho chuka (PR #1)
```

**بس ایک ہی merge ہے۔** اس کے بعد باقی صرف: Netlify base directory · (اختیاری) Supabase چابیاں ·
ٹیکس رپورٹ · پرنٹر/اسکینر کی جانچ · پاس ورڈ تبدیل۔
