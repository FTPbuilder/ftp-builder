// Après le test final : semaines de consolidation variées (cycle 3 + 1 allégée) et alerte si le test final tombe bien avant la fin du plan
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const b = await pw.chromium.launch(); const pg = await (await b.newContext()).newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-11-09T08:00:00+01:00'));
await pg.goto('file:///home/claude/ftp-builder/index.html'); await pg.waitForTimeout(800);
const r = await pg.evaluate(() => { const days = {}; for (let d=0; d<7; d++) days[d] = { avail:[1,3,5].includes(d), max: d===3?60:75 };
  const p = { name:'P', sex:'M', age:30, weightKg:75, heightCm:178, ftp:250, hrMax:190, goalFtp:280, goalDate:'2026-12-04', endDate:'2027-03-15', minSessions:35, startDate:'2026-11-10', days, keyPerWeek:2, optionalPerWeek:1, holidays:true, testProtocol:'ramp', intensityAdj:1, ctl0:40 };
  const plan = generatePlan(p); const by = {}; for (const s of plan) (by[s.block + ' ' + s.week] ||= []).push(WORKOUTS[s.workoutId]?.name || s.workoutId);
  return { weeks: Object.entries(by).map(([k,v]) => k + ' : ' + v.join(' | ')), check: goalCheckText(p) }; });
console.log(r.weeks.join('\n')); console.log(r.check.replace(/<[^>]+>/g,'')); console.log('errs', errs); await b.close();
