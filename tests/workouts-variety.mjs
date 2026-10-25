const pw = (await import('module')).createRequire('/opt/npm-tools/node_modules/x.js')('playwright');
import fs from 'fs';
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs=[]; pg.on('pageerror', e=>errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-10-25T09:00:00+01:00'));
await pg.goto('file:///home/claude/ftp-builder/index.html');
await pg.fill('[name=age]','27'); await pg.fill('[name=weightKg]','83'); await pg.fill('[name=ftp]','255');
await pg.evaluate(()=>document.querySelector('button[type=submit]').click()); await pg.waitForSelector('#tabs:not(.hidden)');
const r = await pg.evaluate(() => {
  const W = FTPB.WORKOUTS, P = FTPB.S.plan;
  const uniq = [...new Set(P.map(s=>s.workoutId))];
  const byType = {}; P.forEach(s => { const t = W[s.workoutId].type; byType[t] = (byType[t]||0)+1; });
  const H = new Set(['test','ss','thr','vo2','force']); const hard = P.filter(s=>H.has(W[s.workoutId].type)); let viol = 0; for (let i=1;i<hard.length;i++) if ((new Date(hard[i].date)-new Date(hard[i-1].date))/864e5 < 2) viol++;
  const lad = Object.keys(W).filter(k=>W[k].type!=='test').map(k => `${k}: ↓${neighbor(k,-1)||'—'} ↑${neighbor(k,1)||'—'}`);
  const durs = Object.keys(W).map(k => `${k} ${Math.round(wDur(k)/60)}' TSS${wTSS(k)}`);
  return { n:P.length, uniq: uniq.length, byType, viol, weeks: P.slice(0,24).map(s=>s.date.slice(5)+' '+s.workoutId).join(' | '), lad, durs };
});
console.log('séances', r.n, '· modèles différents', r.uniq, '· par type', JSON.stringify(r.byType), '· viol48h', r.viol);
console.log(r.weeks); console.log(r.lad.join('\n')); console.log(r.durs.join(' · '));
// FIT valides pour toutes les nouvelles séances
for (const k of ['ss_4x10','ss_ou','force_5x5','force_4x8','tempo_end','thr_5x6','thr_prog','thr_2x15','vo2_4x5','vo2_8x2','vo2_pyr','vo2_4020','end_neuro']) fs.writeFileSync(`w_${k}.fit`, Buffer.from(await pg.evaluate(k=>Array.from(FTPB.encodeWorkout(k,255)), k)));
// boutons d'ajustement sur la séance du jour (via calendrier)
const sid = await pg.evaluate(() => FTPB.S.plan.find(s=>s.kind==='key').id);
await pg.evaluate(id => sessionDlg(id), sid); await pg.waitForTimeout(150);
await pg.click('#dlg [data-sadj="0.95"]'); console.log('adj', await pg.evaluate(id=>FTPB.S.plan.find(s=>s.id===id).adj, sid), '| bloc row:', (await pg.textContent('#dlg .steps')).match(/Sweet spot[^W]*W/)?.[0]);
await pg.click('#dlg [data-sx="harder"]'); console.log('harder ->', await pg.evaluate(id=>{const s=FTPB.S.plan.find(s=>s.id===id); return s.workoutId+' (orig '+s.origWorkoutId+')';}, sid));
await pg.click('#dlg [data-sx="orig"]'); console.log('orig ->', await pg.evaluate(id=>FTPB.S.plan.find(s=>s.id===id).workoutId, sid));
const before = await pg.evaluate(id=>FTPB.S.plan.find(s=>s.id===id).date, sid);
await pg.click('#dlg [data-sx="post"]'); console.log('post', before, '->', await pg.evaluate(id=>FTPB.S.plan.find(s=>s.id===id).date, sid));
await pg.screenshot({ path:'adj.png', fullPage:false });
console.log('errs', errs); await b.close();
