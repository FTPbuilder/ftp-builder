"use strict";
// FTP Builder · catalogue du garage : 10 cadres, 10 groupes (transmission + freinage), lecture d'une facture
/* ============ catalogue vélo ============ */
const BIKE_CAT = (() => {
  // gens : générations ; brakes = freinages possibles ; tire = pneu max (mm) ; elecOnly = passage de câbles prévu pour l'électronique seulement
  // spec : pièces propres au cadre (boîtier, direction, tige de selle, cockpit) ; m3d = gabarit de la maquette 3D
  const FRAMES = [
    { k: 'canyon-aeroad', brand: 'Canyon', model: 'Aeroad', gens: [
      { k: 'cfsl', l: 'CF SL (2015-2020, patins)', brakes: ['rim'], tire: 25, m3d: 'aeroad-cfsl', spec: { headset: 'Jeu de direction Aeroad', bb: 'Boîtier PF86', seatpost: 'Canyon S27 Aero VCLS CF', cockpit: 'Canyon H36 Aerocockpit CF' } },
      { k: 'cfr', l: 'CF SLX / CFR (2021+, disques)', brakes: ['disc'], tire: 30, m3d: 'aeroad-cfr', spec: { headset: 'Jeu de direction Aeroad', bb: 'Boîtier PF86', seatpost: 'Canyon SP0105 Aero', cockpit: 'Canyon CP0048 PACE T-Bar' } } ] },
    { k: 'scott-addict-rc', brand: 'Scott', model: 'Addict RC', gens: [
      { k: '2020', l: '2020-2024 (RC 15, 20, 30, 40, Pro…)', brakes: ['disc'], tire: 30, spec: { bb: 'Boîtier BB86 pressfit', headset: 'Syncros Addict RC intégré', seatpost: 'Syncros Duncan (profil en D)', cockpit: 'Syncros Creston iC (intégré)' } } ] },
    { k: 'look-795', brand: 'Look', model: '795 Blade RS', gens: [
      { k: '1', l: '1re génération (2019-2022)', brakes: ['rim', 'disc'], tire: 30, spec: { bb: 'Boîtier PF86,5', seatpost: 'Look Aeropost 3', cockpit: 'Look ADH (cintre-potence)' } },
      { k: '2', l: 'Blade 2 RS (2023+)', brakes: ['disc'], tire: 32, elecOnly: true, spec: { bb: 'Boîtier T47 fileté (85,5 mm)', cockpit: 'Look Combo Aero Carbon' } } ] },
    { k: 'lapierre-xelius', brand: 'Lapierre', model: 'Xelius', gens: [
      { k: 'sl3', l: 'Xelius SL 3e génération (2022+)', brakes: ['disc'], tire: 32, spec: { bb: 'Boîtier pressfit', seatpost: 'Tige de selle 27,2 mm', headset: 'Direction intégrée 1,5"' } },
      { k: 'drs', l: 'Xelius DRS (2024+)', brakes: ['disc'], tire: 32, spec: { bb: 'Boîtier pressfit', seatpost: 'Lapierre Xelius DRS (carbone)' } } ] },
    { k: 'look-765', brand: 'Look', model: '765 Optimum', gens: [
      { k: '2023', l: '2023+ (endurance)', brakes: ['disc'], tire: 34, spec: { bb: 'Boîtier T47 fileté (85,5 mm)', seatpost: 'Tige de selle 27,2 mm' } } ] },
    { k: 'pinarello-dogma', brand: 'Pinarello', model: 'Dogma', gens: [
      { k: 'f12', l: 'F12 (2019-2021)', brakes: ['rim', 'disc'], tire: 28, spec: { bb: 'Boîtier italien fileté', seatpost: 'Pinarello Dogma (aéro)', cockpit: 'Most Talon (intégré)' } },
      { k: 'f', l: 'F (2021-2024)', brakes: ['rim', 'disc'], tire: 28, elecOnly: true, spec: { bb: 'Boîtier italien fileté', seatpost: 'Pinarello Dogma F (aéro)', cockpit: 'Most Talon Ultra (intégré)' } },
      { k: 'f25', l: 'F (2025+, disques)', brakes: ['disc'], tire: 30, elecOnly: true, spec: { bb: 'Boîtier italien fileté', seatpost: 'Pinarello Dogma F (aéro)', cockpit: 'Most Talon Ultra (intégré)' } } ] },
    { k: 'specialized-tarmac', brand: 'Specialized', model: 'Tarmac', gens: [
      { k: 'sl7', l: 'SL7 (2021-2023)', brakes: ['disc'], tire: 32, spec: { bb: 'Boîtier BSA fileté', seatpost: 'Specialized Tarmac (aéro)' } },
      { k: 'sl8', l: 'SL8 (2024+)', brakes: ['disc'], tire: 32, spec: { bb: 'Boîtier BSA fileté', seatpost: 'Specialized Tarmac (aéro)' } } ] },
    { k: 'trek-madone', brand: 'Trek', model: 'Madone', gens: [
      { k: 'gen8', l: 'Gen 8 (2025+)', brakes: ['disc'], tire: 32, spec: { bb: 'Boîtier T47 fileté' } } ] },
    { k: 'canyon-ultimate', brand: 'Canyon', model: 'Ultimate', gens: [
      { k: 'cf', l: 'CF SL / CF SLX (2021+, disques)', brakes: ['disc'], tire: 30, spec: { bb: 'Boîtier PF86' } } ] },
    { k: 'giant-tcr', brand: 'Giant', model: 'TCR Advanced', gens: [
      { k: '2021', l: '2021+ (disques)', brakes: ['disc'], tire: 32, spec: { bb: 'Boîtier PowerCore pressfit', seatpost: 'Giant Variant (carbone)' } } ] },
  ];
  // groupes : une famille = une ligne de produit ; ses déclinaisons = électronique / mécanique × patins / disques
  const SH_RIM = 'Patins Shimano R55C4', L03 = e => `Plaquettes Shimano L03A (étrier ${e})`, L05 = e => `Plaquettes Shimano L05A-RF (étrier ${e})`;
  const pads = s => ({ padsF: s, padsR: s });
  const GROUPS = [
    { k: 'sh-105-11', brand: 'Shimano', l: '105 11 v (R7000)', speeds: 11, base: { chain: 'Shimano CN-HG601 · 11 v', cassette: 'Shimano 105 CS-R7000 · 11-30', rings: 'Shimano 105 FC-R7000 · 50/34', fd: 'Shimano 105 FD-R7000', rd: 'Shimano 105 RD-R7000', jockey: 'Galets RD-R7000' },
      v: [{ shift: 'meca', brakes: 'rim', l: 'Mécanique, patins (ST-R7000)', spec: pads(SH_RIM) }, { shift: 'meca', brakes: 'disc', l: 'Mécanique, disques hydrauliques (ST-R7020)', spec: pads(L03('BR-R7070')) }] },
    { k: 'sh-105-12', brand: 'Shimano', l: '105 12 v (R7100)', speeds: 12, base: { chain: 'Shimano CN-M7100 · 12 v', cassette: 'Shimano 105 CS-R7101 · 11-34', rings: 'Shimano 105 FC-R7100 · 50/34', jockey: 'Galets du dérailleur 105', ...pads(L05('BR-R7170')) },
      v: [{ shift: 'meca', brakes: 'disc', l: 'Mécanique, disques (ST-R7120)', spec: { fd: 'Shimano 105 FD-R7100', rd: 'Shimano 105 RD-R7100' } },
        { shift: 'elec', brakes: 'disc', l: 'Di2, disques (ST-R7170)', spec: { fd: 'Shimano 105 Di2 FD-R7150', rd: 'Shimano 105 Di2 RD-R7150', di2: 'Shimano BT-DN300', coin: 'Piles CR1632 des leviers ST-R7170' } }] },
    { k: 'sh-ult-11', brand: 'Shimano', l: 'Ultegra 11 v (R8000)', speeds: 11, base: { chain: 'Shimano Ultegra CN-HG701 · 11 v', cassette: 'Shimano Ultegra CS-R8000 · 11-28', rings: 'Shimano Ultegra FC-R8000 · 52/36', jockey: 'Galets du dérailleur Ultegra' },
      v: [{ shift: 'meca', brakes: 'rim', l: 'Mécanique, patins (ST-R8000)', spec: { fd: 'Shimano Ultegra FD-R8000', rd: 'Shimano Ultegra RD-R8000', ...pads(SH_RIM) } },
        { shift: 'meca', brakes: 'disc', l: 'Mécanique, disques (ST-R8020)', spec: { fd: 'Shimano Ultegra FD-R8000', rd: 'Shimano Ultegra RD-R8000', ...pads(L03('BR-R8070')) } },
        { shift: 'elec', brakes: 'rim', l: 'Di2, patins (ST-R8050)', spec: { fd: 'Shimano Ultegra Di2 FD-R8050', rd: 'Shimano Ultegra Di2 RD-R8050', di2: 'Shimano BT-DN110', ...pads(SH_RIM) } },
        { shift: 'elec', brakes: 'disc', l: 'Di2, disques (ST-R8070)', spec: { fd: 'Shimano Ultegra Di2 FD-R8050', rd: 'Shimano Ultegra Di2 RD-R8050', di2: 'Shimano BT-DN110', ...pads(L03('BR-R8070')) } }] },
    { k: 'sh-ult-12', brand: 'Shimano', l: 'Ultegra Di2 12 v (R8100)', speeds: 12, base: { chain: 'Shimano CN-M8100 · 12 v', cassette: 'Shimano Ultegra CS-R8100 · 11-30', rings: 'Shimano Ultegra FC-R8100 · 52/36', fd: 'Shimano Ultegra Di2 FD-R8150', rd: 'Shimano Ultegra Di2 RD-R8150', jockey: 'Galets RD-R8150', di2: 'Shimano BT-DN300' },
      v: [{ shift: 'elec', brakes: 'disc', l: 'Di2, disques (ST-R8170)', spec: { ...pads(L05('BR-R8170')), coin: 'Piles CR1632 des leviers ST-R8170' } }] },
    { k: 'sh-da-12', brand: 'Shimano', l: 'Dura-Ace Di2 12 v (R9200)', speeds: 12, base: { chain: 'Shimano Dura-Ace CN-M9100 · 12 v', cassette: 'Shimano Dura-Ace CS-R9200 · 11-30', rings: 'Shimano Dura-Ace FC-R9200 · 52/36', fd: 'Shimano Dura-Ace Di2 FD-R9250', rd: 'Shimano Dura-Ace Di2 RD-R9250', jockey: 'Galets RD-R9250', di2: 'Shimano BT-DN300' },
      v: [{ shift: 'elec', brakes: 'disc', l: 'Di2, disques (ST-R9270)', spec: { ...pads(L05('BR-R9270')), coin: 'Piles CR1632 des leviers ST-R9270' } },
        { shift: 'elec', brakes: 'rim', l: 'Di2, patins (ST-R9250)', spec: { ...pads('Patins Dura-Ace (étrier BR-R9200)'), coin: 'Piles CR1632 des leviers ST-R9250' } }] },
    { k: 'sr-rival', brand: 'SRAM', l: 'Rival eTap AXS', speeds: 12, base: { chain: 'SRAM Rival Flattop · 12 v', cassette: 'SRAM XG-1250 · 10-36', rings: 'SRAM Rival · 46/33', fd: 'SRAM Rival eTap AXS', rd: 'SRAM Rival eTap AXS', jockey: 'Galets du dérailleur Rival', coin: 'Piles CR2032 des cocottes', ...pads('Plaquettes SRAM organiques') },
      v: [{ shift: 'elec', brakes: 'disc', l: 'AXS sans fil, disques hydrauliques' }] },
    { k: 'sr-force', brand: 'SRAM', l: 'Force eTap AXS', speeds: 12, base: { chain: 'SRAM Force Flattop · 12 v', cassette: 'SRAM XG-1270 · 10-33', rings: 'SRAM Force · 48/35', fd: 'SRAM Force eTap AXS', rd: 'SRAM Force eTap AXS', jockey: 'Galets du dérailleur Force', coin: 'Piles CR2032 des cocottes', ...pads('Plaquettes SRAM organiques') },
      v: [{ shift: 'elec', brakes: 'disc', l: 'AXS sans fil, disques hydrauliques' }] },
    { k: 'sr-red', brand: 'SRAM', l: 'Red eTap AXS', speeds: 12, base: { chain: 'SRAM Red Flattop · 12 v', cassette: 'SRAM XG-1290 · 10-28', rings: 'SRAM Red · 48/35', fd: 'SRAM Red eTap AXS', rd: 'SRAM Red eTap AXS', jockey: 'Galets du dérailleur Red', coin: 'Piles CR2032 des cocottes', ...pads('Plaquettes SRAM organiques') },
      v: [{ shift: 'elec', brakes: 'disc', l: 'AXS sans fil, disques hydrauliques' }] },
    { k: 'ca-chorus', brand: 'Campagnolo', l: 'Chorus 12 v', speeds: 12, base: { chain: 'Campagnolo Chorus · 12 v', cassette: 'Campagnolo Chorus · 11-32', rings: 'Campagnolo Chorus · 48/32', fd: 'Campagnolo Chorus 12 v', rd: 'Campagnolo Chorus 12 v', jockey: 'Galets du dérailleur Chorus' },
      v: [{ shift: 'meca', brakes: 'rim', l: 'Mécanique, patins', spec: pads('Patins Campagnolo') }, { shift: 'meca', brakes: 'disc', l: 'Mécanique, disques hydrauliques', spec: pads('Plaquettes Campagnolo') }] },
    { k: 'ca-record', brand: 'Campagnolo', l: 'Record 12 v', speeds: 12, base: { chain: 'Campagnolo Record · 12 v', cassette: 'Campagnolo Record · 11-29', rings: 'Campagnolo Record · 50/34', fd: 'Campagnolo Record 12 v', rd: 'Campagnolo Record 12 v', jockey: 'Galets du dérailleur Record' },
      v: [{ shift: 'meca', brakes: 'rim', l: 'Mécanique, patins', spec: pads('Patins Campagnolo') }, { shift: 'meca', brakes: 'disc', l: 'Mécanique, disques hydrauliques', spec: pads('Plaquettes Campagnolo') }] },
  ];
  const vKey = (g, v) => `${g.k}:${v.shift}:${v.brakes}`;
  const ALL = GROUPS.flatMap(g => g.v.map(v => ({ key: vKey(g, v), g, v, spec: { ...g.base, ...(v.spec || {}) },
    group: g.brand === 'SRAM' ? 'axs' : v.shift === 'elec' ? 'di2' : 'meca', name: `${g.brand} ${g.l}` })));
  const groupOf = key => ALL.find(x => x.key === key) || null;
  const frameOf = (fk, gk) => { const f = FRAMES.find(x => x.k === fk); const g = f?.gens.find(x => x.k === gk) || f?.gens[0]; return f ? { f, g } : null; };
  // questionnaire descendant : ne propose que ce qui existe (et ce que le cadre accepte)
  const BRANDS = ['Shimano', 'SRAM', 'Campagnolo'];
  function options(q = {}, gen = null){
    const ok = x => (!gen || gen.brakes.includes(x.v.brakes)) && (!gen?.elecOnly || x.v.shift === 'elec');
    const pool = ALL.filter(ok);
    const by = (k, val) => x => k === 'brand' ? x.g.brand === val : x.v[k] === val;
    let p = pool;
    const brands = BRANDS.filter(b => p.some(by('brand', b))); if (q.brand) p = p.filter(by('brand', q.brand));
    const shifts = ['elec', 'meca'].filter(s => p.some(by('shift', s))); if (q.shift) p = p.filter(by('shift', q.shift));
    const brakes = ['disc', 'rim'].filter(s => p.some(by('brakes', s))); if (q.brakes) p = p.filter(by('brakes', q.brakes));
    return { brands, shifts, brakes, list: p };
  }

  // facture PDF : texte → cadre, groupe, date, montant (à confirmer par l'utilisateur)
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const FRAME_RX = { 'canyon-aeroad': [/aeroad/, { cfsl: /cf ?sl(?!x)/, cfr: /cfr|cf ?slx|disc/ }], 'scott-addict-rc': [/addict ?rc/], 'look-795': [/795/, { 1: /blade rs(?! ?2)|light/, 2: /blade ?2|2023|2024|2025/ }],
    'lapierre-xelius': [/xelius/, { drs: /drs/, sl3: /\bsl\b/ }], 'look-765': [/765/], 'pinarello-dogma': [/dogma/, { f12: /f12/, f25: /2025|2026/, f: /dogma f\b/ }], 'specialized-tarmac': [/tarmac/, { sl7: /sl ?7/, sl8: /sl ?8/ }],
    'trek-madone': [/madone/], 'canyon-ultimate': [/ultimate/], 'giant-tcr': [/\btcr\b/] };
  // références précises d'abord, puis noms de gamme (un « Ultegra Di2 » sans référence est supposé 12 v, le plus courant depuis 2021)
  const GROUP_RX = [['sh-da-12', /dura.?ace|r92[057]0/], ['sh-ult-11', /r80[0257]0|ultegra[^\n]{0,20}11 ?v/], ['sh-ult-12', /r81[057]0|ultegra[^\n]{0,20}(di2|12 ?v)/], ['sh-ult-11', /ultegra/],
    ['sh-105-11', /r70[027]0|105[^\n]{0,20}11 ?v/], ['sh-105-12', /r71[0257]0|105 ?di2|105[^\n]{0,20}12 ?v/], ['sh-105-11', /shimano 105\b(?![,.]\d)/], ['sr-red', /\bred\b.*axs|red etap/], ['sr-force', /force.*axs|force etap/], ['sr-rival', /rival.*axs|rival etap|rival e1/], ['ca-record', /record/], ['ca-chorus', /chorus/]];
  function parseInvoice(text){
    const t = norm(text), out = { frame: null, gen: null, group: null, date: null, price: null, raw: t.slice(0, 2000) };
    for (const [k, [rx, gens]] of Object.entries(FRAME_RX)) if (rx.test(t)) { out.frame = k; if (gens) out.gen = Object.keys(gens).find(g => gens[g].test(t)) || null; break; }
    const gm = GROUP_RX.find(([, rx]) => rx.test(t)); if (gm) {
      const g = GROUPS.find(x => x.k === gm[0]), elec = /di2|etap|axs|eps|electron/.test(t), gen = out.frame && frameOf(out.frame, out.gen)?.g;
      const disc = /disc|disque|hydraul|r[0-9]{2}70|r[0-9]{2}20/.test(t), rim = !disc && (/patin|rim brake|caliper|sur jante|r[0-9]{2}50|st-r[78]000/.test(t) || (!!gen && gen.brakes.length === 1 && gen.brakes[0] === 'rim'));
      const v = g.v.find(x => (x.shift === 'elec') === (elec || g.brand === 'SRAM') && x.brakes === (rim ? 'rim' : 'disc')) || g.v.find(x => (x.shift === 'elec') === elec) || g.v[0];
      out.group = vKey(g, v); }
    const d = t.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d\d)\b/); if (d) out.date = `${d[3]}-${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}`;
    else { const m = t.match(/\b(20\d\d)-(\d\d)-(\d\d)\b/); if (m) out.date = m[0]; }
    // montant : « 4 999,00 », « 9.890,00 », « 8500 » ; la virgule est décimale, l'espace ou le point sépare les milliers
    const amt = s => { s = s.replace(/[\s  ]/g, ''); s = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/\.(?=\d{3}$)/, ''); return +s || 0; };
    const tot = [...t.matchAll(/total[^\d\n]{0,40}?(\d[\d\s  .,]*\d|\d)/g)].map(m => amt(m[1])).filter(v => v > 50 && v < 30000);
    const any = [...t.matchAll(/(\d[\d\s  .,]*\d)\s*(?:€|eur)/g)].map(m => amt(m[1])).filter(v => v > 50 && v < 30000);
    out.price = (tot.length ? Math.max(...tot) : any.length ? Math.max(...any) : null) || null;
    return out;
  }
  async function pdfText(file, loadPdf){
    const lib = await loadPdf(), doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; let s = '';
    for (let i = 1; i <= Math.min(doc.numPages, 4); i++) { const c = await (await doc.getPage(i)).getTextContent(); s += c.items.map(x => x.str + (x.hasEOL ? '\n' : ' ')).join('') + '\n'; }
    return s;
  }
  return { FRAMES, GROUPS, ALL, BRANDS, groupOf, frameOf, options, parseInvoice, pdfText, vKey };
})();
