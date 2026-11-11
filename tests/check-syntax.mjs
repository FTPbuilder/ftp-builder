// Contrôle rapide sans navigateur : chaque fichier JS (et les scripts inline d'index.html) se compile, l'ordre de chargement est cohérent.
import fs from 'fs'; import vm from 'vm';
const root = new URL('../', import.meta.url), html = fs.readFileSync(new URL('index.html', root), 'utf8'); let ko = 0;
const files = [...html.matchAll(/<script src="(js\/[^"?]+)\?v=([\d.]+)"/g)];
const ver = (html.match(/const APP_VERSION = '([\d.]+)'/) || [])[1];
for (const [, f, v] of files) { try { new vm.Script(fs.readFileSync(new URL(f, root), 'utf8'), { filename: f }); } catch(e){ ko++; console.error('✘', f, e.message); } if (v !== ver) { ko++; console.error('✘', f, `?v=${v} ≠ APP_VERSION ${ver}`); } }
const onDisk = fs.readdirSync(new URL('js/', root)).filter(f => f.endsWith('.js')).map(f => 'js/' + f), listed = files.map(m => m[1]);
for (const f of onDisk) if (!listed.includes(f)) { ko++; console.error('✘', f, "n'est pas chargé par index.html"); }
for (const [i, m] of [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].entries()) { try { new vm.Script(m[1], { filename: `inline#${i}` }); } catch(e){ ko++; console.error('✘ inline', i, e.message); } }
console.log(ko ? `${ko} problème(s)` : `OK — ${files.length} fichiers JS, version ${ver}`); process.exit(ko ? 1 : 0);
