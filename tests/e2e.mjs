// Test bout-en-bout : questionnaire → plan → import .fit → export workout .fit relu par fit-file-parser
const { chromium } = (await import('module')).createRequire('/opt/npm-tools/node_modules/x.js')('playwright');
import fs from 'fs'; import path from 'path'; import { createRequire } from 'module';
const require = createRequire(process.env.SCRATCH + '/package.json');
const FP = require('fit-file-parser'); const FitParser = FP.default || FP;
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = process.env.SCRATCH;
const b = await chromium.launch(); const pg = await b.newPage({ viewport:{ width:400, height:860 }, acceptDownloads:true });
const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type()==='error' && errs.push(m.text()));
await pg.clock.setFixedTime(new Date('2026-10-20T10:00:00+02:00'));
await pg.goto('file://' + root + '/index.html');
// pré-remplissage depuis le .fit
const fc = pg.waitForEvent('filechooser'); await pg.click('#prefill'); (await fc).setFiles(root + '/tests/2026-10-19_seance.fit');
await pg.waitForFunction(() => document.querySelector('#prefillInfo').textContent.length > 5);
console.log('PREFILL:', await pg.textContent('#prefillInfo'));
await pg.fill('[name=ftp]', '255');
await pg.fill('[name=name]', 'Arnaud');
await pg.screenshot({ path: out + '/01-questionnaire.png', fullPage:true });
await pg.click('button[type=submit]');
await pg.waitForSelector('#tabs:not(.hidden)');
const st = await pg.evaluate(() => { const S = FTPB.S; return { n:S.plan.length, mand:S.plan.filter(s=>s.kind!=='optional').length, first:S.plan.slice(0,6).map(s=>s.date+' '+s.workoutId+' '+s.kind), tests:S.plan.filter(s=>s.kind==='test').map(s=>s.date), last:S.plan.slice(-3).map(s=>s.date+' '+s.workoutId), weeks:[...new Set(S.plan.map(s=>s.block))] }; });
console.log('PLAN', JSON.stringify(st, null, 1));
// règle des 48 h
const viol = await pg.evaluate(() => { const H=new Set(['test','ss','thr','vo2']); const p=FTPB.S.plan.filter(s=>H.has(FTPB.WORKOUTS[s.workoutId].type)); const v=[]; for(let i=1;i<p.length;i++){ const d=(new Date(p[i].date)-new Date(p[i-1].date))/864e5; if(d<2) v.push(p[i-1].date+'/'+p[i].date);} return v; });
console.log('VIOLATIONS 48h:', viol);
await pg.screenshot({ path: out + '/02-today.png', fullPage:true });
// import de la séance du 19/10
await pg.click('button[data-log=""]');
await pg.click('#dropZone').catch(()=>{});
const fc2 = pg.waitForEvent('filechooser', { timeout: 3000 }).catch(()=>null);
await pg.click('#dropZone'); const ch = await fc2; await ch.setFiles(root + '/tests/2026-10-19_seance.fit');
await pg.waitForSelector('#lSave');
const metr = await pg.$$eval('#logResult .kpi', ks => ks.map(k => k.innerText.replace(/\n/g,' ')));
console.log('METRICS', metr, await pg.textContent('#logResult .small.muted'));
await pg.click('[data-feel=rpe] button[data-v="7"]'); await pg.click('[data-feel=legs] button[data-v="3"]');
await pg.screenshot({ path: out + '/03-import.png', fullPage:true });
await pg.click('#lSave');
// progression
await pg.click('button[data-tab=prog]'); await pg.screenshot({ path: out + '/04-prog.png', fullPage:true });
await pg.click('button[data-tab=cal]'); await pg.screenshot({ path: out + '/05-cal.png' });
// export workout
const first = await pg.evaluate(() => FTPB.S.plan.find(s=>s.workoutId==='ou_3x9' || s.workoutId==='vo2_3030')?.id || FTPB.S.plan[3].id);
await pg.click(`[data-open="${first}"]`);
await pg.screenshot({ path: out + '/06-session.png', fullPage:true });
const dl = pg.waitForEvent('download'); await pg.click(`dialog [data-export="${first}"]`); const d = await dl; const fp = out + '/' + d.suggestedFilename(); await d.saveAs(fp);
console.log('EXPORT', d.suggestedFilename());
// test20 aussi
const tb = await pg.evaluate(() => Array.from(FTPB.encodeWorkout('test20', 255)));
fs.writeFileSync(out + '/test20.fit', Buffer.from(tb));
const { execFileSync } = await import('child_process');
console.log(execFileSync('node', [out + '/val.mjs', fp, out + '/test20.fit'], { cwd: out }).toString());
console.log('ERRORS', errs);
await b.close();
