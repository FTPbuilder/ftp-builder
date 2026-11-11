// Lance tous les tests navigateur, un par un, et résume. Usage : node tests/run-all.mjs [filtre]
// Variables : SCRATCH (dossier de travail avec fit-file-parser + @garmin/fitsdk), THREE_JS (three.min.js local, optionnel), PW_REQUIRE
import { spawn } from 'child_process'; import fs from 'fs'; import path from 'path'; import os from 'os';
const dir = path.dirname(new URL(import.meta.url).pathname), only = process.argv[2];
const env = { ...process.env, SCRATCH: process.env.SCRATCH || fs.mkdtempSync(path.join(os.tmpdir(), 'ftpb-')) };
const files = fs.readdirSync(dir).filter(f => f.endsWith('.mjs') && f !== 'run-all.mjs' && f !== 'check-syntax.mjs' && (!only || f.includes(only))).sort();
const run = f => new Promise(res => { const t0 = Date.now(), p = spawn(process.execPath, [path.join(dir, f)], { env }); let out = '';
  p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
  const k = setTimeout(() => { p.kill('SIGKILL'); out += '\n[timeout]'; }, +(process.env.TEST_TIMEOUT || 240000));
  p.on('close', code => { clearTimeout(k); res({ f, ok: code === 0, s: ((Date.now() - t0) / 1000).toFixed(0), out }); }); });
const Q = new Set(fs.readFileSync(path.join(dir, 'quarantine.txt'), 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')));
const jobs = +(process.env.JOBS || 3), res = []; let i = 0;
await Promise.all(Array.from({ length: jobs }, async () => { while (i < files.length) { const r = await run(files[i++]); res.push(r); console.log(`${r.ok ? '✔' : Q.has(r.f) ? '⚠' : '✘'} ${r.f} (${r.s} s)${Q.has(r.f) ? (r.ok ? ' — passe : à sortir de la quarantaine' : ' (quarantaine)') : ''}`); if (!r.ok && !Q.has(r.f)) console.log(r.out.split('\n').filter(l => !/GL Driver/.test(l)).slice(-15).join('\n')); } }));
const ko = res.filter(r => !r.ok && !Q.has(r.f)), qk = res.filter(r => !r.ok && Q.has(r.f)).length; console.log(`\n${res.length - ko.length - qk}/${res.length} OK, ${qk} en quarantaine${ko.length ? ' — échecs : ' + ko.map(r => r.f).join(', ') : ''}`);
process.exit(ko.length ? 1 : 0);
