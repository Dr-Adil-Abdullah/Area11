// Area11 - UI language (owner's choice in Settings: English / Urdu / Roman Urdu).
// Add a key here with all three versions, then use t(lang, "key") in the UI.
// Pages not yet converted still show their original text.

export type Lang = "en" | "ur" | "roman";

export const LANGS: { value: Lang; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ur", label: "اردو (Urdu)" },
  { value: "roman", label: "Roman Urdu" },
];

export function normLang(v: unknown): Lang {
  return v === "ur" || v === "roman" ? v : "en";
}

type Entry = { en: string; ur: string; roman: string };

const DICT = {
  // ---- sidebar groups ----
  "nav.sell": { en: "Sell", ur: "فروخت", roman: "Bechna" },
  "nav.stock": { en: "Stock & Suppliers", ur: "اسٹاک اور سپلائر", roman: "Stock aur Suppliers" },
  "nav.money": { en: "Cash & Reports", ur: "کیش اور رپورٹس", roman: "Cash aur Reports" },
  "nav.admin": { en: "Admin", ur: "انتظامیہ", roman: "Intezaam" },
  // ---- sidebar links ----
  "nav.counter": { en: "Counter / Billing", ur: "کاؤنٹر / بلنگ", roman: "Counter / Billing" },
  "nav.sales": { en: "Sales & Returns", ur: "فروخت اور واپسی", roman: "Bikri aur Wapsi" },
  "nav.customers": { en: "Customers & Credit", ur: "گاہک اور ادھار", roman: "Customers aur Udhaar" },
  "nav.products": { en: "Products", ur: "پروڈکٹس", roman: "Products" },
  "nav.purchases": { en: "Purchases (Stock-in)", ur: "خریداری (اسٹاک میں اندراج)", roman: "Khareedari (Stock-in)" },
  "nav.adjust": { en: "Adjust / Write-off", ur: "ایڈجسٹمنٹ / ضائع", roman: "Adjust / Write-off" },
  "nav.stocktake": { en: "Stock-take", ur: "اسٹاک گنتی", roman: "Ginti (Stock-take)" },
  "nav.alerts": { en: "Expiry & stock alerts", ur: "میعاد اور اسٹاک الرٹس", roman: "Expiry aur Stock alerts" },
  "nav.suppliers": { en: "Suppliers", ur: "سپلائرز", roman: "Suppliers" },
  "nav.cash": { en: "Cash & Day-end", ur: "کیش اور دن کا اختتام", roman: "Galla aur Day-end" },
  "nav.reports": { en: "Reports", ur: "رپورٹس", roman: "Reports" },
  "nav.import": { en: "Excel import / update", ur: "ایکسل امپورٹ / اپڈیٹ", roman: "Excel import / update" },
  "nav.audit": { en: "Black box & Backup", ur: "بلیک باکس اور بیک اپ", roman: "Black box aur Backup" },
  "nav.sync": { en: "Cloud sync", ur: "کلاؤڈ سنک", roman: "Cloud sync" },
  "nav.settings": { en: "Settings", ur: "ترتیبات", roman: "Settings" },
  // ---- header / footer / shell ----
  "app.pharmacyPos": { en: "Pharmacy POS", ur: "فارمیسی پی او ایس", roman: "Pharmacy POS" },
  "app.offlineReady": { en: "Offline ready", ur: "آف لائن تیار", roman: "Offline ready" },
  "app.goDashboard": { en: "Go to Dashboard", ur: "ڈیش بورڈ پر جائیں", roman: "Dashboard par jaayein" },
  "app.openMenu": { en: "Open menu", ur: "مینو کھولیں", roman: "Menu kholein" },
  "app.closeMenu": { en: "Close menu", ur: "مینو بند کریں", roman: "Menu band karein" },
  "app.lockNow": { en: "Lock now", ur: "ابھی لاک کریں", roman: "Abhi lock karein" },
  "app.logout": { en: "Log out", ur: "لاگ آؤٹ", roman: "Logout" },
  "app.footer": { en: "{app} · Pharmacy & Retail POS", ur: "{app} · فارمیسی اور ریٹیل پی او ایس", roman: "{app} · Pharmacy & Retail POS" },
  // ---- negative stock banner ----
  "neg.title": { en: "Negative stock: {n} medicine(s)", ur: "منفی اسٹاک: {n} دوا", roman: "Negative stock: {n} dawa" },
  "neg.detail": { en: "(worst: {worst}) · fix it with Stock-take or a purchase", ur: "(سب سے زیادہ: {worst}) · اسٹاک گنتی یا خریداری سے درست کریں", roman: "(sab se zyada: {worst}) · Stock-take ya purchase se theek karein" },
  "neg.viewNow": { en: "View now", ur: "ابھی دیکھیں", roman: "Abhi dekhein" },
  // ---- dashboard ----
  "home.welcome": { en: "Welcome, {name}", ur: "خوش آمدید، {name}", roman: "Khush aamdeed, {name}" },
  "home.subtitle": { en: "{store} — today at a glance", ur: "{store} — آج کا خلاصہ", roman: "{store} — aaj ka khulasa" },
  "home.newSale": { en: "New sale", ur: "نئی فروخت", roman: "Nayi bikri" },
  "home.securityTitle": { en: "Security: the default owner password is still in use", ur: "سیکیورٹی: مالک کا ڈیفالٹ پاس ورڈ ابھی استعمال ہو رہا ہے", roman: "Security: owner ka default password abhi istemal ho raha hai" },
  "home.securityText": { en: "Change it in Settings before you start billing.", ur: "بلنگ شروع کرنے سے پہلے ترتیبات میں اسے تبدیل کریں۔", roman: "Billing shuru karne se pehle Settings mein ise tabdeel karein." },
  "home.todaysSales": { en: "Today's sales", ur: "آج کی فروخت", roman: "Aaj ki bikri" },
  "home.bills": { en: "{n} bills", ur: "{n} بل", roman: "{n} bills" },
  "home.products": { en: "Products", ur: "پروڈکٹس", roman: "Products" },
  "home.suppliers": { en: "Suppliers", ur: "سپلائرز", roman: "Suppliers" },
  "home.batches": { en: "Batches in stock", ur: "اسٹاک میں بیچز", roman: "Stock mein batches" },
  "home.customers": { en: "Customers", ur: "گاہک", roman: "Customers" },
  "home.totalBills": { en: "{n} total bills", ur: "کل {n} بل", roman: "kul {n} bills" },
  "home.quick": { en: "Quick actions", ur: "فوری کام", roman: "Foori kaam" },
  "home.newPurchase": { en: "New purchase", ur: "نئی خریداری", roman: "Nayi khareedari" },
  // ---- settings: language section ----
  "settings.language": { en: "Language", ur: "زبان", roman: "Zaban" },
  "settings.languageDesc": { en: "Choose the language for menus, labels and screens.", ur: "مینو، لیبلز اور اسکرینز کی زبان منتخب کریں۔", roman: "Menu, labels aur screens ki zaban chunein." },
  "settings.languageLabel": { en: "Display language", ur: "ڈسپلے زبان", roman: "Display zaban" },
} satisfies Record<string, Entry>;

export type TKey = keyof typeof DICT;

/** Text for `key` in `lang`, with {placeholders} filled from `vars`. */
export function t(lang: Lang, key: TKey, vars?: Record<string, string | number>): string {
  let s: string = DICT[key][lang] ?? DICT[key].en;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}
