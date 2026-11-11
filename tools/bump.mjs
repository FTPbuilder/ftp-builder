// Nouvelle version : node tools/bump.mjs 0.32.1  → APP_VERSION + ?v= de chaque <script src="js/…"> (force les iPhone à recharger les fichiers)
import fs from 'fs';
const v = process.argv[2]; if (!/^\d+\.\d+\.\d+$/.test(v || '')) { console.error('usage : node tools/bump.mjs X.Y.Z'); process.exit(1); }
const p = new URL('../index.html', import.meta.url); let h = fs.readFileSync(p, 'utf8');
h = h.replace(/const APP_VERSION = '[\d.]+'/, `const APP_VERSION = '${v}'`).replace(/(<script src="js\/[^"?]+)\?v=[\d.]+"/g, `$1?v=${v}"`);
fs.writeFileSync(p, h); console.log('version', v);
