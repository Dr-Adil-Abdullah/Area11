# Supabase se cloud sync — آسان طریقہ

> **یاد رکھیں:** آپ کی دکان کا **اصل** ڈیٹا بیس وہی SQLite فائل ہے جو دکان کے کمپیوٹر پر ہے۔
> Supabase صرف ایک **آئینہ (mirror)** ہے — تاکہ آپ گھر سے (فون یا لیپ ٹاپ پر) اعداد دیکھ سکیں،
> اور کہیں حادثہ ہو جائے تو ایک کاپی باہر محفوظ رہے۔
> انٹرنیٹ نہ ہو تو ایپ ویسے ہی چلتی رہتی ہے۔

---

## 1. Supabase پروجیکٹ بنائیں

1. [supabase.com](https://supabase.com) پر جا کر **New project** بنائیں (مفت منصوبہ کافی ہے)۔
2. پروجیکٹ کھلنے کے بعد بائیں مینو میں **Project Settings → API** پر جائیں۔
3. وہاں سے دو چیزیں ملتی ہیں:
   - **Project URL** — جیسے `https://abcdefgh.supabase.co`
   - **anon public key** — لمبی سی کی (یا `service_role` key اگر صرف اپنے استعمال کے لیے ہے؛
     وہ **خفیہ رکھیں**، کسی کے ساتھ شیئر نہ کریں)۔

## 2. ایک ٹیبل بنائیں

بائیں مینو میں **SQL Editor** کھولیں اور یہ کوڈ چلا دیں:

```sql
-- Area11 ka cloud aina (mirror): har dukan ki EK line
create table if not exists public.area11_sync (
  shop_id   text primary key,
  shop_name text,
  sent_at   timestamptz,
  version   int,
  payload   jsonb,
  updated_at timestamptz default now()
);

-- Purana snapshot nayay se badal jaye
create or replace function public.area11_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists area11_touch on public.area11_sync;
create trigger area11_touch before update on public.area11_sync
for each row execute function public.area11_touch();
```

اگر آپ **مفت** منصوبے پر ہیں اور صرف خود دیکھنا چاہتے ہیں تو یہ کافی ہے۔
(سخت حفاظت کے لیے آگے **RLS** پالیسیاں لگائی جا سکتی ہیں — ضرورت ہو تو بتائیں۔)

## 3. ایپ میں ڈالیں

1. ایپ میں **Settings → Cloud sync (Supabase)** کھولیں۔
2. بھریں:
   - **Project URL** → قدم 1 والا URL
   - **API key** → قدم 1 والی key
   - **Shop id** → اپنی دکان کا کوئی نام، جیسے `area11-main`
     (اگر کبھی دو برانچ ہوں تو ہر ایک کے لیے الگ id رکھیں)
   - **Table name** → ویسا ہی رہنے دیں: `area11_sync`
3. **Save** کریں۔

## 4. استعمال

**Cloud sync** والے صفحے (`/sync`) پر تین بٹن ہیں:

| بٹن | کام |
|---|---|
| **Abhi bhejein (push)** | دکان کا ڈیٹا cloud پر بھیج دیتا ہے |
| **Cloud se dekhein** | cloud پر موجود ڈیٹا دکھاتا ہے (کچھ بدلا نہیں جاتا) |
| **La kar yahan lagayein** | cloud کا ڈیٹا اسی کمپیوٹر پر اتار دیتا ہے — **پہلے خودکار بیک اپ** بن جاتا ہے |

بھیجا جانے والا ڈیٹا: دوائیں، گاہک، سپلائر، کیٹیگریز، کمپنیاں، بیچز،
اور پچھلے **90 دن** کی بکری / خریداری / ادائیگیاں / اخراجات۔

**تصویریں cloud پر نہیں جاتیں** — وہ بیک اپ (`.zip`) کے ساتھ محفوظ رہتی ہیں۔

## 5. گھر سے دیکھنے کا طریقہ

دو آسان صورتیں:

1. **سب سے آسان:** دکان کے کمپیوٹر پر ایپ چل رہی ہو اور دونوں ڈیوائس ایک ہی وائی فائی پر ہوں
   → براؤزر میں `http://<دکان کے پی سی کا IP>:3000` کھولیں۔
2. **انٹرنیٹ سے:** دکان کے پی سی پر ایپ کو کسی مستقل Node ہوسٹ (یا VPS) پر چلائیں،
   تب `https://...` کا پتہ کہیں سے بھی کھل جائے گا۔

Supabase والا سنک فی الحال **ڈیٹا کی حفاظت اور منتقلی** کے لیے ہے —
براہِ راست "فون پر ایپ چلانے" کے لیے اوپر والا طریقہ 1 یا 2 استعمال کریں۔

## 6. مسئلہ آئے تو

| پیغام | مطلب اور حل |
|---|---|
| `Supabase ka URL / key abhi nahi dala gaya` | Settings میں URL / key خالی ہے |
| `Bhej nahi saka (401)` | key غلط ہے یا پرانی — دوبارہ کاپی کریں |
| `Bhej nahi saka (404)` | ٹیبل کا نام غلط، یا ٹیبل بنی ہی نہیں (قدم 2) |
| `Rabta nahi ho saka` | انٹرنیٹ بند ہے، یا URL میں ٹائپو |
| `Cloud me is dukan ka koi data nahi mila` | پہلے **push** کریں |

ہمیشہ کی طرح: ایپ کبھی انٹرنیٹ کے بغیر بھی پوری چلتی ہے،
اور ہر pull سے پہلے `data/backups/area11-before-sync-*.db` خودکار بن جاتا ہے۔
