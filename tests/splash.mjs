// Écran d'ouverture : logo + roues qui tournent + éclairs, 2 s puis fondu ; absent sous test automatisé.
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const out = process.env.SCRATCH || '.';
const assert = (c, m) => { if (!c) { console.error('ÉCHEC', m); process.exitCode = 1; } else console.log('ok', m); };
const b = await pw.chromium.launch(); const url = 'file://' + new URL('../index.html', import.meta.url).pathname;
// 1) comme un vrai téléphone
let ctx = await b.newContext({ ...pw.devices['iPhone 13'], colorScheme:'dark' }); let pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
await pg.goto(url); await pg.waitForTimeout(250);
assert(await pg.locator('#splash').isVisible(), 'écran d\'ouverture affiché au lancement');
const rot = async () => pg.$eval('#splash .wh', g => getComputedStyle(g).transform);
const r1 = await rot(); await pg.screenshot({ path: out + '/splash-1.png' });
await pg.waitForTimeout(170); const r2 = await rot(); await pg.screenshot({ path: out + '/splash-2.png' });
assert(r1 !== r2, 'les roues tournent');
await pg.waitForTimeout(2300);
assert(await pg.locator('#splash').count() === 0, 'disparaît après ~2 s');
assert(await pg.locator('#app').isVisible(), 'l\'app est dessous, prête');
assert(!errs.length, 'aucune erreur JS ' + errs.join(' | '));
await ctx.close();
// 2) sous test automatisé : pas d'écran d'ouverture
ctx = await b.newContext({ ...pw.devices['iPhone 13'] }); pg = await ctx.newPage(); await pg.goto(url); await pg.waitForTimeout(100);
assert(await pg.locator('#splash').count() === 0, 'pas d\'écran d\'ouverture pour les tests');
await b.close();
