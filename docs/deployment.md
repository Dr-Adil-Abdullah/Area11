# مستقل ویب سائٹ اور اس Arena room کی updates

**30 ستمبر 2026 — صارف کی نئی ہدایت:** مستقل shareable website اور اسی room کے code کی automatic deployments۔

> موجودہ build sample-data demo ہے۔ Static hosting سے مشترکہ cloud database، login/security یا multi-device stock sync خود نہیں بنتے۔ حقیقی مالی/مریضوں کے records upload نہ کریں۔

## موجودہ حالت — code GitHub پر موجود، hosting کا account setup باقی

**application code کامیابی سے اسی [GitHub branch](https://github.com/Dr-Adil-Abdullah/Area11/tree/arena/01a0f117-area11) پر push اور remote API سے verify کیا گیا ہے۔** Cloudflare میں اسے ابھی connect کیا جا سکتا ہے۔ مستقل public website ابھی deploy/verify نہیں ہوئی۔

Arena کے GitHub connection نے repository access دیا، لیکن **Pages enable کرنے کی درخواست HTTP 403: `Resource not accessible by integration`** سے روکی گئی۔ Pages پہلے سے enabled بھی ثابت نہیں ہوئی۔ Active `.github/workflows` files کے ساتھ Git push بھی connection کی **workflows permission** نہ ہونے سے رد ہوئی۔ اس لیے ابھی کسی متوقع public URL کو working/live website نہیں کہا جا رہا۔

Password، personal access token یا 2FA code chat میں دینے کی ضرورت نہیں۔ **اس connection کے ساتھ ترجیح: Cloudflare Pages + Git integration**؛ application code اسی session branch پر push ہو چکا ہے؛ Cloudflare کو ایک بار connect کرنے کے بعد وہ ہر نئی push پر خود build/deploy کرے گا۔ GitHub Pages اختیار کرنا ہو تو Arena میں GitHub connection دوبارہ connect/اس کی workflow اجازت درست کریں، یا repository owner نیچے دیے ہوئے workflow templates خود install کرے۔

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
Cloudflare Git integration: configured production build
(یا permissions کے بعد installed GitHub Actions: checks + tests + build)
   ↓ کامیاب build/deployment کے بعد
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

## راستہ C — Netlify، Cloudflare کا Git-connected متبادل

`netlify.toml` ریپو میں شامل ہے: build **`npm run build`**، publish **`dist`**، Node **22.22.3**، root base **`/`**۔ یہ صرف build configuration ہے؛ provider account authorization یا live deployment کا دعویٰ نہیں۔

1. **[Netlify signup/dashboard](https://app.netlify.com/)** کھولیں؛ account بنائیں یا login کریں۔
2. **Add new project → Import an existing project → GitHub** منتخب کریں اور اپنے account سے Netlify کو existing repository کی access دیں۔ [1](https://docs.netlify.com/start/quickstarts/deploy-from-repository/)
3. existing **`Dr-Adil-Abdullah/Area11`** repository اور **Production branch `arena/01a0f117-area11`** منتخب کریں۔ `main` یا نئی copy/fork نہیں؛ اس room کی branch ضروری ہے۔
4. `netlify.toml` سے build settings آ جائیں گی؛ پھر بھی build `npm run build`، publish `dist`، base directory root/blank check کریں۔
5. **Publish** کریں۔ نئے credit-based accounts پر projects private-by-default ہو سکتے ہیں؛ عوامی لنک کے لیے **Publish / Make public** لازم ہے۔ Incognito browser میں `*.netlify.app` link کھول کر check کریں کہ login/token نہ مانگے۔ [1](https://docs.netlify.com/start/quickstarts/deploy-from-repository/)
6. اصل dashboard link مجھے دیں تاکہ site اور assets externally verify کیے جا سکیں۔ ابھی Netlify account connect نہیں ہوا اور کوئی Netlify URL live نہیں کہا جا رہا۔
7. Git integration کے بعد اس production branch کی push نئی build/deploy خود چلائے گی؛ room کا local save کافی نہیں۔ [2](https://docs.netlify.com/deploy/create-deploys/)

[Netlify pricing](https://www.netlify.com/pricing/) کے 30 ستمبر 2026 کے official page پر Free plan **300 credits/month** دکھاتا ہے؛ production deploys، bandwidth وغیرہ credit استعمال کرتے ہیں۔ اسے unlimited free hosting/updates نہ سمجھیں؛ limits بڑھنے یا بدلنے پر provider کی موجودہ pricing دیکھیں۔

### InfinityFree کا فرق

اگر صارف کی مراد **[InfinityFree](https://www.infinityfree.com/)** ہے تو یہ build کی static files host کرنے کا متبادل ہے۔ React/Vite project کو پہلے `npm run build` کریں، پھر صرف built `dist` contents کو hosting کے `htdocs` میں upload کریں؛ raw repository/node_modules/browser recovery records نہیں۔

اس کا native free-hosting GitHub integration نہیں؛ documented workaround FTP deployment کے لیے الگ CI pipeline ہے۔ [3](https://forum.infinityfree.com/t/github-integration/76439) اس Arena connection کی workflow permission پہلے ہی blocked ہے، اس لیے InfinityFree پر خودکار Git updates اس وقت one-click راستہ نہیں۔ صرف manual file upload سے ہر push کے بعد website خود update نہیں ہوگی۔ FTP/account credentials chat یا repo میں نہ رکھیں؛ اگر یہ provider بعد میں منتخب ہو تو owner اپنی secret-management screen سے setup کرے۔

اس room کی **push-based auto-update** ضرورت کے لیے پہلے Cloudflare Git integration یا Netlify Git import استعمال کرنا زیادہ سیدھا ہے۔

## Browser data کے بارے میں اہم بات

Website code کی deployment اور shop data کی synchronization الگ چیزیں ہیں۔ Same permanent origin پر browser data عموماً نئی frontend build کے بعد موجود رہتی ہے اور supported schema migration سے upgrade ہوتی ہے، مگر site-data clearing، device/browser change یا نیا hosting domain data خود منتقل نہیں کرتا۔ Provider کو صرف built app assets ملتے ہیں؛ آپ کے localStorage کھاتے نہیں۔ پہلے **Settings → Download saved snapshot** محفوظ کریں۔ Restore/shared database/scheduled backups roadmap کے بعد کے کام ہیں۔
