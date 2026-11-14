// Garage › catalogue : questionnaire cadre → génération → marque → électronique / mécanique → freins → déclinaison ; compatibilité cadre / groupe ; lecture d'une facture PDF
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const out = process.env.SCRATCH || '.';
const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs = []; pg.on('console', m => { if (/warn|error/.test(m.type())) console.log('[console]', m.type(), m.text().slice(0, 300)); }); pg.on('requestfailed', r => console.log('[échec requête]', r.url().slice(0, 120))); pg.on('pageerror', e => errs.push(e.message));
await pg.route('**/pdfjs-dist@3.11.174/build/*', r => r.fulfill({ path: out + '/node_modules/pdfjs-dist/build/' + r.request().url().split('/').pop(), contentType: 'application/javascript' }));
await pg.clock.setFixedTime(new Date('2026-11-13T20:00:00+01:00'));
await pg.addInitScript(() => {
  const days = {0:{avail:false,max:75},1:{avail:true,max:75},2:{avail:false,max:75},3:{avail:true,max:75},4:{avail:false,max:75},5:{avail:true,max:120},6:{avail:false,max:120}};
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:2, updatedAt:Date.now(), profile:{ name:'A', sex:'M', age:30, weightKg:80, heightCm:180, ftp:250, hrMax:195, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-20', days, keyPerWeek:2, optionalPerWeek:1, testProtocol:'20min', intensityAdj:1 }, plan:[], activities:[], ftpHistory:[{ date:'2026-10-20', ftp:250, source:'initial' }], settings:{ theme:'dark' } }));
});
await pg.goto(new URL('../index.html', import.meta.url).href); await pg.waitForTimeout(300);
let ok = true; const assert = (c, m) => { if (!c) { ok = false; console.error('ÉCHEC', m); } else console.log('ok', m); };
const ev = f => pg.evaluate(f), wz = async (a, v) => { await pg.tap(`[data-wz="${a}"]${v != null ? `[data-v="${v}"]` : ''}`); await pg.waitForTimeout(120); };
const sheet = () => pg.locator('#grSheet').innerText();
await pg.tap('#tabs [data-tab="profile"]'); await pg.waitForTimeout(150); await pg.tap('.gr-tile'); await pg.waitForTimeout(150);
await pg.tap('[data-gr="addask"]'); await pg.waitForTimeout(150);
assert(await pg.locator('[data-wz="frame"]').count() === 11, '10 cadres + « Autre vélo de route »');
await wz('frame', 'pinarello-dogma'); assert(/quelle génération/i.test(await sheet()), 'Dogma : choix de la génération');
await wz('gen', 'f');
const brands = await pg.locator('[data-wz="brand"]').allInnerTexts(); assert(brands.join() === 'Shimano,SRAM', `Dogma F (électronique seulement) : pas de Campagnolo mécanique (${brands})`);
await wz('brand', 'Shimano'); // électronique seule possibilité : question sautée
assert(/Freins/i.test(await sheet()), 'électronique / mécanique sautée quand une seule réponse');
await wz('brakes', 'rim'); const decl = await pg.locator('[data-wz="pick"]').allInnerTexts(); assert(decl.length === 2 && decl.some(x => /Dura-Ace/.test(x)) && decl.some(x => /R8050|Ultegra 11/.test(x)), 'Shimano Di2 patins : Ultegra 11 v et Dura-Ace');
await pg.screenshot({ path: out + '/catalogue-wizard.png' });
await wz('pick', 'sh-da-12:elec:rim'); await pg.waitForTimeout(400);
const r1 = await ev(() => { const b = S.garage.bikes[0], P = Garage.allParts(b).map(p => p.k); return { name: b.name, frame: b.frame, gs: b.groupset, coin: P.includes('coin'), di2: P.includes('di2'), axs: P.includes('axs'),
  tires: [b.tires.f, b.tires.r], txt: document.querySelector('.gr').innerText }; });
console.log(JSON.stringify({ ...r1, txt: undefined }));
assert(r1.name === 'Pinarello Dogma' && r1.frame.gen === 'f' && r1.gs === 'sh-da-12:elec:rim', 'vélo créé avec son cadre et son groupe');
assert(r1.coin && r1.di2 && !r1.axs, 'pièces suivies : batterie Di2 et piles des leviers (12 v)');
assert(r1.tires[0] <= 28 && r1.tires[1] <= 28, 'pneus ramenés au maximum du cadre (28 mm)');
await pg.tap('[data-gr="tab"][data-v="bike"]'); await pg.waitForTimeout(150);
const bt = await pg.locator('.gr-panel').innerText(); assert(/Pinarello Dogma/.test(bt) && /italien/i.test(bt) && /Dura-Ace Di2 12 v/.test(bt), 'onglet Vélo : cadre (boîtier italien) et transmission');
const spec = await ev(() => { const b = S.garage.bikes[0]; return Garage.allParts(b).filter(p => ['chain', 'padsF', 'rd'].includes(p.k)).map(p => p.spec).join(' | '); });
assert(/CN-M9100/.test(spec) && /BR-R9200/.test(spec) && /RD-R9250/.test(spec), `références du groupe dans les composants (${spec})`);
// changer de cadre vers un 765 Optimum (disques seulement) : le groupe à patins n'est plus compatible
await pg.tap('[data-gr="wzframe"]'); await pg.waitForTimeout(150); await wz('frame', 'look-765');
assert(/marque/i.test(await sheet()), 'après le cadre, on enchaîne sur la transmission');
const b765 = await pg.locator('[data-wz="brand"]').allInnerTexts(); assert(b765.includes('Campagnolo'), 'cadre mécanique possible : Campagnolo proposé');
await wz('brand', 'SRAM'); const sh = await pg.locator('[data-wz="shift"]').allInnerTexts(); assert(sh.some(x => /Mécanique/.test(x)) && sh.some(x => /Électronique/.test(x)), 'SRAM : électronique (AXS) ou mécanique (22)');
await wz('shift', 'meca'); const s22 = await pg.locator('[data-wz="pick"]').allInnerTexts(); assert(s22.length === 3 && /Rival 22/.test(s22.join()) && /Force 22/.test(s22.join()) && /Red 22/.test(s22.join()), `SRAM mécanique disques : Rival, Force, Red 22 (${s22.length})`);
await wz('back', 'brand');
await wz('brand', 'Campagnolo'); assert(/Quelle déclinaison/i.test(await sheet()), 'Campagnolo disques : mécanique et disques déduits');
await wz('pick', 'ca-chorus:meca:disc'); await pg.waitForTimeout(300);
const r2 = await ev(() => { const b = S.garage.bikes[0], P = Garage.allParts(b).map(p => p.k); return { name: b.modelName, gs: b.groupset, di2: P.includes('di2'), coin: P.includes('coin') }; });
assert(r2.name === '765 Optimum' && r2.gs === 'ca-chorus:meca:disc' && !r2.di2 && !r2.coin, 'cadre et groupe changés, plus d\'électronique à suivre');
// facture PDF → nouveau vélo Scott Addict RC + Ultegra Di2 12 v + achat
const mkPdf = lines => {
  const stream = 'BT /F1 12 Tf 50 750 Td 16 TL ' + lines.map(l => `(${l}) Tj T*`).join(' ') + ' ET';
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let s = '%PDF-1.4\n'; const off = []; objs.forEach((o, i) => { off.push(s.length); s += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = s.length; s += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + off.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(s, 'latin1'); };
const pdf = mkPdf(['FACTURE N 2023-0412', 'Cycles Dupont - Paris', 'Date : 12/03/2023', 'Velo SCOTT Addict RC 20 2023 taille M', 'Groupe Shimano Ultegra Di2 R8170 12v disc', 'Total TTC 4 999,00 EUR']);
await pg.tap('[data-gr="addask"]'); await pg.waitForTimeout(150);
const fc = pg.waitForEvent('filechooser'); await wz('inv'); (await fc).setFiles({ name: 'facture.pdf', mimeType: 'application/pdf', buffer: pdf });
await pg.waitForSelector('text=Facture lue', { timeout: 15000 });
const conf = await sheet(); console.log('FACTURE:', conf.replace(/\n+/g, ' | '));
assert(/texte lu sur la facture/i.test(conf), 'texte lu consultable');
assert(/Scott Addict RC/.test(conf) && /Ultegra Di2 12 v/.test(conf) && /12 mars 2023/.test(conf) && /4\s?999/.test(conf), 'facture lue : cadre, groupe, date, montant');
await pg.screenshot({ path: out + '/catalogue-facture.png' });
await pg.tap('[data-wz="pick"]'); await pg.waitForTimeout(400);
const r3 = await ev(() => { const g = S.garage, b = g.bikes.find(x => x.frame?.k === 'scott-addict-rc'); return b && { gs: b.groupset, purchased: b.purchased, since: b.since, rule: b.rule, buy: g.log.find(e => e.bikeId === b.id && e.kind === 'buy')?.price, n: g.bikes.length }; });
console.log(JSON.stringify(r3));
assert(r3 && r3.gs === 'sh-ult-12:elec:disc' && r3.purchased === '2023-03-12' && r3.buy === 4999 && r3.n === 2, 'vélo créé depuis la facture, avec son achat');
assert(r3 && !r3.rule.out && !r3.rule.ht, '2e vélo : ne prend pas les sorties du premier sans qu\'on le coche');
// cadre hors catalogue (Factor) : vélo créé quand même avec le groupe lu, et demande d'ajout envoyée à l'admin
await ev(() => { window._sent = []; const fake = { from: t => ({ insert: async row => { window._sent.push({ t, row }); return { error: null }; } }) };
  Object.defineProperty(Cloud, 'sb', { get: () => fake, configurable: true }); Object.defineProperty(Cloud, 'user', { get: () => ({ id: 'u1' }), configurable: true }); });
await pg.tap('[data-gr="addask"]'); await pg.waitForTimeout(150);
const fc3 = pg.waitForEvent('filechooser'); await wz('inv');
(await fc3).setFiles({ name: 'devis.pdf', mimeType: 'application/pdf', buffer: mkPdf(['PROPOSITION COMMERCIALE', 'DATE: 14 nov. 2026 10:26:26', 'KIT CADRE FACTOR OSTRO 2.0 SCARAB 56 (DAG-FS-Q56SC) 1 4250.00 20.00 4250.00 5100.00', 'GROUPE SRAM FORCE AXS 2x E1 (COT-108996) 1 1457.50 20.00 1457.50 1749.00', 'TOTAL (HT) TOTAL TVA TOTAL (TTC)', '5000.01 999.99 6000.00 EUR', 'Conditions : la totalite du montant 2000 EUR']) });
await pg.waitForSelector('text=Facture lue', { timeout: 15000 });
const fx = await sheet(); console.log('FACTOR:', fx.replace(/\n+/g, ' | '));
assert(/Factor Ostro 2\.0/.test(fx) && /hors catalogue/.test(fx) && /Force eTap AXS/.test(fx) && /14 nov/.test(fx) && /6\s?000/.test(fx), 'cadre hors catalogue deviné, groupe, date « 14 nov. 2026 », total TTC');
await wz('req'); const pre = await ev(() => ['grRqB', 'grRqM', 'grRqY', 'grRqG'].map(id => document.getElementById(id).value));
assert(pre[0] === 'Factor' && pre[1] === 'Ostro 2.0' && pre[2] === '2026' && /sram force axs 2x e1/i.test(pre[3]), `formulaire prérempli (${pre})`);
await pg.fill('#grRqN', 'Freins disques, taille 56'); await wz('send'); await pg.waitForTimeout(200);
const sent = await ev(() => window._sent); assert(sent.length === 1 && sent[0].t === 'bike_requests' && sent[0].row.brand === 'Factor' && sent[0].row.note === 'Freins disques, taille 56', 'demande envoyée dans bike_requests');
assert(/Demande envoyée/.test(await sheet()), 'retour à la facture, demande marquée envoyée');
await wz('pick'); await pg.waitForTimeout(300);
const fb = await ev(() => { const b = S.garage.bikes.find(x => x.name === 'Factor Ostro 2.0'); return b && { gs: b.groupset, brand: b.brand, frame: b.frame || null, buy: S.garage.log.find(e => e.bikeId === b.id && e.kind === 'buy')?.price }; });
assert(fb && fb.gs === 'sr-force:elec:disc' && fb.brand === 'Factor' && !fb.frame && fb.buy === 6000, `vélo hors catalogue créé (${JSON.stringify(fb)})`);
// facture scannée (aucun texte) : message clair, choix à la main
await pg.tap('[data-gr="addask"]'); await pg.waitForTimeout(150);
const fc2 = pg.waitForEvent('filechooser'); await wz('inv'); (await fc2).setFiles({ name: 'scan.pdf', mimeType: 'application/pdf', buffer: mkPdf([]) });
await pg.waitForSelector('text=Facture lue', { timeout: 15000 });
const sc = await sheet(); assert(/image/.test(sc) && /à la main/i.test(sc) && !/Créer ce vélo/.test(sc), 'PDF scanné : message clair, pas de création à l\'aveugle');
await wz('fix'); assert(await pg.locator('[data-wz="frame"]').count() === 11, '« Choisir à la main » ramène au catalogue');
console.log(ok && !errs.length ? 'OK' : 'ÉCHEC', errs); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
