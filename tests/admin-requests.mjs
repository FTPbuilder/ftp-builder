// Profil : carré 📮 « Demandes » réservé à l'admin (is_admin), liste des demandes d'ajout au catalogue, copie pour Claude, statut
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const out = process.env.SCRATCH || '.';
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'], permissions: ['clipboard-read', 'clipboard-write'] });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-11-14T22:00:00+01:00'));
await pg.addInitScript(() => {
  const days = {0:{avail:false,max:75},1:{avail:true,max:75},2:{avail:false,max:75},3:{avail:true,max:75},4:{avail:false,max:75},5:{avail:true,max:120},6:{avail:false,max:120}};
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:2, updatedAt:Date.now(), profile:{ name:'A', sex:'M', age:30, weightKg:80, heightCm:180, ftp:250, hrMax:195, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-20', days, keyPerWeek:2, optionalPerWeek:1, testProtocol:'20min', intensityAdj:1 }, plan:[], activities:[], ftpHistory:[{ date:'2026-10-20', ftp:250, source:'initial' }], settings:{ theme:'dark' } }));
});
await pg.goto(new URL('../index.html', import.meta.url).href); await pg.waitForTimeout(300);
let ok = true; const assert = (c, m) => { if (!c) { ok = false; console.error('ÉCHEC', m); } else console.log('ok', m); };
const ev = f => pg.evaluate(f);
// faux Supabase : is_admin selon le compte, deux demandes
const mock = admin => pg.evaluate(admin => { window._upd = []; const rows = [{ id: 7, at: '2026-11-14T21:40:00Z', brand: 'Cervélo', model: 'S5', year: '2025', groupset: 'sram force axs e1', note: 'taille 56', status: 'nouveau' }, { id: 3, at: '2026-11-10T10:00:00Z', brand: 'BMC', model: 'Teammachine', year: null, groupset: null, note: null, status: 'ajoute' }];
  const q = { select: () => q, order: () => q, limit: async () => ({ data: rows, error: null }) };
  const fb = [{ id: 11, at: '2026-11-22T09:00:00Z', survey: 'avis-2026-11', who: 'Léa', answers: { sat: 4, follow: 'souvent', fit: 2, sync_dev: 'oui', sync_app: 'non', ease: 3, social: 'inconnu' }, comment: 'La 3D rame sur mon iPhone', app_version: '0.54.0', device: '390×844 · app · Mozilla', seen: false },
    { id: 9, at: '2026-11-21T09:00:00Z', survey: 'avis-2026-11', who: 'Tom', answers: { sat: 2, follow: 'jamais', fit: 4, sync_dev: 'na', sync_app: 'oui', ease: 5, social: 'souvent' }, comment: null, app_version: '0.54.0', seen: true }];
  const fq = { select: () => fq, order: () => fq, limit: async () => ({ data: fb, error: null }) };
  const fake = { rpc: async n => ({ data: n === 'is_admin' ? admin : null, error: null }), from: t => t === 'feedback_surveys' ? { ...fq, update: v => ({ eq: async (k, id) => { window._upd.push({ t, v, id }); return { error: null }; } }) } : ({ ...q, update: v => ({ eq: async (k, id) => { window._upd.push({ v, id }); return { error: null }; } }) }) };
  Object.defineProperty(Cloud, 'sb', { get: () => fake, configurable: true }); Object.defineProperty(Cloud, 'user', { get: () => ({ id: admin ? 'adm' : 'usr' }), configurable: true }); }, admin);
await mock(false); await pg.tap('#tabs [data-tab="profile"]'); await pg.waitForTimeout(400);
assert(await pg.locator('[data-req="open"]').count() === 0, 'compte normal : pas de boîte aux lettres');
await mock(true); await ev(() => render()); await pg.waitForTimeout(400);
const tile = pg.locator('[data-req="open"]'); assert(await tile.count() === 1 && /2/.test(await tile.innerText()), 'admin : carré 📮 avec 2 nouveautés (1 demande + 1 avis non lu)');
const h = await ev(() => [document.querySelector('.set-row .set-btn').getBoundingClientRect().height, document.querySelector('.set-mail').getBoundingClientRect().width]); assert(h[0] < 64 && h[1] < 90, `tuile Réglages réduite (${h.map(Math.round)})`);
await pg.locator('.set-row').screenshot({ path: out + '/admin-tile.png' });
await tile.tap(); await pg.waitForTimeout(300);
const pane = await pg.locator('.pane-in').innerText(); assert(/Cervélo S5/.test(pane) && /Traitées/i.test(pane) && /BMC Teammachine/.test(pane), 'liste : nouvelles puis traitées');
await pg.screenshot({ path: out + '/admin-pane.png' });
await pg.tap('[data-req="copy"][data-id="7"]'); await pg.waitForTimeout(200);
const clip = await ev(() => navigator.clipboard.readText()); assert(/Ajoute au catalogue.*Cervélo S5 \(2025\).*sram force axs e1.*taille 56.*n° 7/.test(clip), `copie pour Claude (${clip})`);
await pg.tap('[data-req="set"][data-s="ajoute"][data-id="7"]'); await pg.waitForTimeout(200);
const upd = await ev(() => window._upd); assert(upd.length === 1 && upd[0].v.status === 'ajoute' && upd[0].id === 7, 'statut « Ajoutée » envoyé');
assert(!/Aucune nouvelle demande/.test(await pg.locator('.pane-in').innerText()) === false, 'plus de nouvelle demande');
// onglet Avis : moyennes, avis non lu avec commentaire, copie, marquer lu
await pg.tap('[data-req="tab"][data-t="fb"]'); await pg.waitForTimeout(300);
const fbp = await pg.locator('.pane-in').innerText();
assert(/2 réponses/.test(fbp) && /3,0 \/ 5/.test(fbp) && /4,0 \/ 5/.test(fbp) && /Activités → app/.test(fbp) && /Je ne savais pas/.test(fbp) && /La 3D rame/.test(fbp) && /Léa/.test(fbp) && /Lus/.test(fbp), `avis : moyennes et réponses (${fbp.slice(0, 120)})`);
await pg.screenshot({ path: out + '/admin-avis.png', fullPage: true });
await pg.tap('[data-req="fbcopy"][data-fid="11"]'); await pg.waitForTimeout(200);
assert(/Léa.*Programme adapté 2\/5.*Activités → app Non.*La 3D rame/.test(await ev(() => navigator.clipboard.readText())), 'avis copié pour Claude');
await pg.tap('[data-req="fbseen"][data-fid="11"]'); await pg.waitForTimeout(200);
assert((await ev(() => window._upd)).some(u => u.t === 'feedback_surveys' && u.v.seen === true && u.id === 11) && /Aucun nouvel avis/.test(await pg.locator('.pane-in').innerText()), 'avis marqué lu');
await pg.tap('[data-settings="back"]'); await pg.waitForTimeout(200); assert(await pg.locator('.set-row').count() === 1, 'retour au profil');
console.log(ok && !errs.length ? 'OK' : 'ÉCHEC', errs); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
