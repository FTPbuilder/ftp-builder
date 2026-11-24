// Conseil du jour en tête de l'accueil (énergie × séance dure du jour) : appliquer → rappel annulable ; export .zwo d'une séance
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const out = process.env.SCRATCH || '.';
const assert = (c, m) => { if (!c) { console.error('ÉCHEC', m); process.exitCode = 1; } else console.log('ok', m); };
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'], acceptDownloads: true });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-11-10T07:30:00+01:00'));
await pg.addInitScript(() => {
  if (localStorage.getItem('ftpb_state_v1')) return;
  const days = { 0:{avail:false,max:75}, 1:{avail:true,max:75}, 2:{avail:true,max:75}, 3:{avail:false,max:75}, 4:{avail:true,max:75}, 5:{avail:false,max:120}, 6:{avail:true,max:120} };
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:1, updatedAt:Date.now(), profile:{ name:'A', sex:'M', age:30, weightKg:84, heightCm:181, ftp:260, hrMax:193, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-21', days, keyPerWeek:2, optionalPerWeek:0, holidays:true, testProtocol:'ramp', intensityAdj:1, ctl0:40 }, plan:[], activities:[], ftpHistory:[], settings:{ theme:'auto' } }));
});
await pg.goto('file://' + new URL('../index.html', import.meta.url).pathname); await pg.waitForTimeout(300);
const sid = await pg.evaluate(() => {
  S.plan = generatePlan(S.profile);
  let s = S.plan.find(x => x.date === todayISO());
  if (!s) { s = S.plan.find(x => x.status === 'planned'); s.date = todayISO(); }
  s.workoutId = 'ss_3x12'; s.status = 'planned'; delete s.adj; delete s.origWorkoutId;
  window._sc = { v:45, level:'warn' }; Health.score = () => window._sc; render(); return s.id;
});
await pg.waitForTimeout(200);
// énergie moyenne : bandeau en haut de l'accueil, avant les bulles
const fa = pg.locator('#app .fadv.fa-home');
assert(await fa.count() === 1, 'accueil : bandeau « Conseil du jour »');
assert(/Énergie moyenne \(45\)/.test(await fa.innerText()), 'bandeau : énergie moyenne et sa valeur');
const above = await pg.evaluate(() => { const a = document.querySelector('.fadv.fa-home'); return !!a && ['.home', '.guide'].every(q => { const e = document.querySelector(q); return !e || (a.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING); }); });
assert(above, 'bandeau placé en premier, au-dessus du guide et des bulles');
await pg.screenshot({ path: out + '/forme-advice-1.png' });
await fa.locator('[data-sadj="0.95"]').tap(); await pg.waitForTimeout(200);
assert(await pg.evaluate(id => S.plan.find(s => s.id === id).adj, sid) === 0.95, '« Cibles −5 % » appliqué à la séance');
assert(/Séance du jour ajustée/.test(await fa.innerText()) && /−5 %/.test(await fa.innerText()), 'bandeau : rappel « Séance du jour ajustée · −5 % »');
await pg.screenshot({ path: out + '/forme-advice-2.png' });
await fa.locator('[data-sadj="1"]').tap(); await pg.waitForTimeout(200);
assert(!(await pg.evaluate(id => S.plan.find(s => s.id === id).adj, sid)), 'retour aux cibles prévues');
// énergie basse : récup proposée ; volet Programme : conseil en tête de la carte « Aujourd'hui », plus en double dans la séance
await pg.evaluate(() => { window._sc = { v:30, level:'bad' }; render(); });
assert(await pg.locator('.fadv.fa-home [data-sx="rec"]').count() === 1, 'énergie basse : « Récup à la place »');
await pg.tap('.home [data-pane="prog"]'); await pg.waitForTimeout(300);
assert(await pg.locator('#todayPane .today-card .fadv.fa-card').count() === 1, 'Programme : conseil dans la carte « Aujourd\'hui »');
assert(await pg.locator('#todayPane .fadv').count() === 1, 'Programme : un seul conseil affiché');
const first = await pg.evaluate(() => { const c = document.querySelector('.today-card'); return c.querySelector('.fadv').compareDocumentPosition(c.querySelector('.tlist')) & Node.DOCUMENT_POSITION_FOLLOWING; });
assert(!!first, 'conseil avant la liste des séances');
await pg.screenshot({ path: out + '/forme-advice-3.png' });
// énergie correcte : pas de bandeau
await pg.evaluate(() => { window._sc = { v:65, level:'ok' }; TODAY_PANE = null; render(); });
assert(await pg.locator('.fadv').count() === 0, 'énergie correcte : pas de conseil');
// .zwo : structure et durée
const z = await pg.evaluate(() => {
  const x = new DOMParser().parseFromString(FTPB.encodeZwo('ss_3x12'), 'application/xml'), w = x.querySelector('workout');
  const it = w.querySelector('IntervalsT');
  const dur = [...w.children].reduce((a, e) => a + (e.tagName === 'IntervalsT' ? +e.getAttribute('Repeat') * (+e.getAttribute('OnDuration') + +e.getAttribute('OffDuration')) : +e.getAttribute('Duration')), 0);
  return { err: !!x.querySelector('parsererror'), sport: x.querySelector('sportType')?.textContent, rep: it && +it.getAttribute('Repeat'), on: it && +it.getAttribute('OnPower'), onD: it && +it.getAttribute('OnDuration'), dur, want: wDur('ss_3x12'),
    k: +new DOMParser().parseFromString(FTPB.encodeZwo('ss_3x12', 0.95), 'application/xml').querySelector('IntervalsT').getAttribute('OnPower') };
});
console.log('zwo :', JSON.stringify(z));
assert(!z.err && z.sport === 'bike', '.zwo : XML valide, vélo');
assert(z.rep === 3 && z.on === 0.9 && z.onD === 720, '.zwo : 3 × 12 min à 90 % en IntervalsT');
assert(Math.abs(z.dur - z.want) <= 1, '.zwo : durée totale = durée de la séance');
assert(z.k === 0.855, '.zwo : ajustement de la séance (−5 %) appliqué');
const allOk = await pg.evaluate(() => Object.keys(WORKOUTS).every(k => { const d = new DOMParser().parseFromString(FTPB.encodeZwo(k), 'application/xml'); return !d.querySelector('parsererror') && d.querySelector('workout').children.length > 0; }));
assert(allOk, '.zwo : toutes les séances de la bibliothèque s\'exportent');
// bouton de la fiche séance → téléchargement .zwo
await pg.evaluate(id => sessionDlg(id), sid); await pg.waitForTimeout(200);
await pg.locator('#dlg details.more summary').first().tap();
const [dl] = await Promise.all([pg.waitForEvent('download'), pg.locator(`#dlg [data-zwo="${sid}"]`).tap()]);
assert(/\.zwo$/.test(dl.suggestedFilename()), 'fiche séance : téléchargement ' + dl.suggestedFilename());
assert(!errs.length, 'aucune erreur JS ' + errs.join(' | '));
await b.close();
