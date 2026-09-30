# مستقل ویب سائٹ اور اس Arena room کی updates

**30 ستمبر 2026 — صارف کی نئی ہدایت:** مستقل shareable website اور اسی room کے code کی automatic deployments۔

> موجودہ build sample-data demo ہے۔ Static hosting سے مشترکہ cloud database، login/security یا multi-device stock sync خود نہیں بنتے۔ حقیقی مالی/مریضوں کے records upload نہ کریں۔

## موجودہ blocker — GitHub Pages کی ایک بار owner setup

Arena کے GitHub connection نے repository access دیا، لیکن **Pages enable کرنے کی درخواست HTTP 403: `Resource not accessible by integration`** سے روکی گئی۔ Pages پہلے سے enabled بھی ثابت نہیں ہوئی۔ Active `.github/workflows` files کے ساتھ Git push بھی connection کی **workflows permission** نہ ہونے سے رد ہوئی۔ اس لیے ابھی کسی متوقع public URL کو working/live website نہیں کہا جا رہا۔

Password، personal access token یا 2FA code chat میں دینے کی ضرورت نہیں۔ **اس connection کے ساتھ ترجیح: Cloudflare Pages + Git integration**؛ application code اسی session branch پر push کیا جا سکتا ہے، اور Cloudflare خود build/deploy کرے گا۔ GitHub Pages اختیار کرنا ہو تو Arena میں GitHub connection دوبارہ connect/اس کی workflow اجازت درست کریں، یا repository owner نیچے دیے ہوئے workflow templates خود install کرے۔

## راستہ A — GitHub Pages

1. **[اس repository کی Pages settings کھولیں](https://github.com/Dr-Adil-Abdullah/Area11/settings/pages)**۔ اپنے repository-owner GitHub account سے login ہوں۔
2. پہلے **`docs/workflow-templates/ci.yml`** اور **`docs/workflow-templates/deploy-pages.yml`** templates کو owner access سے اسی branch کے **`.github/workflows/`** میں install کریں، یا Arena GitHub connection کی workflow permission درست ہونے کے بعد مجھے یہ کام کرنے کو کہیں۔ اس کے بعد **Build and deployment → Source → GitHub Actions** منتخب کریں۔ Repository پہلے ہی public ہے؛ visibility بدلنے کی ضرورت نہیں۔
3. اگر `github-pages` environment branch protection لگا ہو تو **[Environments](https://github.com/Dr-Adil-Abdullah/Area11/settings/environments)** میں deployment branch **`arena/01a0f117-area11`** کو allow کریں۔ existing protections غیر ضروری طور پر remove نہ کریں۔
4. **[GitHub Actions](https://github.com/Dr-Adil-Abdullah/Area11/actions)** میں **Publish demo to GitHub Pages** کا اس branch والا تازہ run کھولیں۔ Settings enable ہونے سے پہلے run failed ہو تو **Re-run all jobs** کریں، یا مجھے کہیں تاکہ اسی branch کا deployment دوبارہ trigger/check کروں۔ Workflow manual Run button default branch میں workflow کی موجودگی پر منحصر ہو سکتا ہے؛ push-trigger اس room کی branch کے لیے تیار ہے۔
5. کامیاب `deploy` job کے **github-pages environment URL / page_url** سے اصل public website کھولیں۔ Settings میں بھی اصل URL ملتا ہے۔ دونوں browser/phone پر site، CSS، favicon اور Counter/Suppliers/Expiry/Reorder کھول کر verify کریں۔

عام project-path کا **متوقع** address `https://dr-adil-abdullah.github.io/Area11/` ہے، لیکن **successful deployment اور external verification سے پہلے اسے live link نہ سمجھیں**۔ Existing custom domain ہو تو اصل address مختلف ہو سکتا ہے؛ Actions/Settings کا URL authoritative ہے۔

### کیا خودکار ہے، کیا نہیں؟

```text
اس room میں code change
   ↓ commit + push to arena/01a0f117-area11
GitHub Actions: checks + Chromium tests + production build
   ↓ only if all steps pass
اسی مستقل public website کی نئی deployment
   ↓ browser reload
آپ کو نئی UI/code changes نظر آئیں گی
```

- GitHub Pages کا **تیار template `docs/workflow-templates/deploy-pages.yml`** ہے؛ workflow permission ملنے/owner installation کے بعد اسے `.github/workflows/deploy-pages.yml` میں رکھنا ہوگا۔ Installed workflow کی صرف **`arena/01a0f117-area11`** کی pushes publish کرتی ہیں۔ دوسرے branches/PRs publish نہیں کرتے۔
- یہ session اسی branch سے بندھا ہے؛ default `main` کو نہ switch کیا گیا، نہ direct push کیا جاتا ہے۔
- **Arena کا خودکار local save GitHub push نہیں ہے۔** مکمل تبدیلیوں کو agent/user اسی working branch پر commit/push کرے گا؛ اس کے بعد hosting خود deploy کرتی ہے۔ ہر keystroke کا background git-push watcher نہیں لگایا گیا۔
- تیار GitHub workflow templates کے checks میں format، TypeScript، unit/repository tests، dependency audit اور Chromium E2E شامل ہیں۔ Cloudflare Git integration default طور پر configured build چلاتی ہے، پوری test suite نہیں؛ agent ہر push سے پہلے local checks کرے یا provider میں الگ CI gate ترتیب دے۔ failed check پر نئی site publish نہیں ہوگی؛ پہلے کی successful deployment برقرار رہ سکتی ہے۔
- `VITE_BASE_PATH` Pages metadata سے project path یا custom root domain کے مطابق مقرر ہوتی ہے؛ icons/fonts/assets بھی اسی base پر ہیں۔
- build artifact کا `deployment.json` صرف app version، deployed commit، branch اور build timestamp رکھتا ہے؛ financial data/credentials نہیں۔ اس سے واقعی شائع شدہ revision verify کی جا سکتی ہے۔
- دستی public deployment کے لیے confirmation والا manual trigger بھی برقرار ہے، لیکن publishing اسی fixed working branch تک محدود ہے۔

## راستہ B — Cloudflare Pages کو GitHub سے connect کریں

یہ راستہ GitHub کی Pages-admin permission نہیں مانگتا؛ Cloudflare account میں repository access آپ اس کے اپنے authorization screen پر دیتے ہیں۔

1. **[Cloudflare dashboard](https://dash.cloudflare.com/)** میں اپنے account سے login ہوں۔
2. **Workers & Pages → Create application → Pages → Import an existing Git repository / Connect to Git** کھولیں۔
3. GitHub provider منتخب کر کے موجودہ **`Dr-Adil-Abdullah/Area11`** repository authorize/select کریں۔ نیا repo نہ بنائیں۔
4. ان settings سے project بنائیں:

| Setting                      | Value                                                                    |
| ---------------------------- | ------------------------------------------------------------------------ |
| Production branch            | `arena/01a0f117-area11` — `main` نہیں، اس room کا code اسی branch میں ہے |
| Root directory               | repository root / blank                                                  |
| Framework preset             | React (Vite)                                                             |
| Build command                | `npm run build`                                                          |
| Build output directory       | `dist`                                                                   |
| Environment `NODE_VERSION`   | `22.22.3`                                                                |
| Environment `VITE_BASE_PATH` | `/`                                                                      |

5. **Save and Deploy** کریں۔ کامیاب deployment کے بعد dashboard کا اصل **`*.pages.dev` URL** کھولیں اور مجھے link دیں تاکہ باہر سے website/asset checks کر سکوں۔
6. Git integration کے ساتھ اسی production branch کی ہر نئی GitHub push نئی website deployment بنائے گی۔ اسی URL پر code updates کے لیے browser reload کریں؛ deployment dashboard میں result دیکھیں۔ صرف folder/zip کی Direct Upload کرنے سے automatic Git updates نہیں ملتیں؛ اس مقصد کے لیے Git integration منتخب کریں۔

Cloudflare setup کی official guide: [React deployment](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/)۔ GitHub setup: [custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)۔

## Browser data کے بارے میں اہم بات

Website code کی deployment اور shop data کی synchronization الگ چیزیں ہیں۔ Same permanent origin پر browser data عموماً نئی frontend build کے بعد موجود رہتی ہے اور supported schema migration سے upgrade ہوتی ہے، مگر site-data clearing، device/browser change یا نیا hosting domain data خود منتقل نہیں کرتا۔ Provider کو صرف built app assets ملتے ہیں؛ آپ کے localStorage کھاتے نہیں۔ پہلے **Settings → Download saved snapshot** محفوظ کریں۔ Restore/shared database/scheduled backups roadmap کے بعد کے کام ہیں۔
