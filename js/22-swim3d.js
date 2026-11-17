"use strict";
// FTP Builder · « Comprendre la séance » (natation) : bassin de 25 m en 3D, le coach explique la séance face à toi, mime puis montre
// chaque éducatif au ralenti sous l'eau, tu plonges et tu vois toute la séance en accéléré (allures sur ta CSS, départs, récup).
/* ============ Swim3D ============
   - plan(x)   : séance du plan tri → blocs (allure /100 m sur la CSS, départ à la pendule, éducatif) + script du coach (texte affiché / texte dit).
   - scène     : bassin 25 m (6 couloirs), eau animée (reflets, ondes, caustiques), vue sous l'eau, pendule des départs, tableau de la séance.
   - persos    : nageur et coach de models/nageurs.js (tools/swim3d), animés par cinématique inverse : crawl, rattrapé, chien, poings fermés,
                 pull-buoy, plaquettes, visée, coulée, virage, repos au mur, plongeon ; debout : écoute, parole, présentation du tableau, mime penché.
   - réalisateur : plans de caméra enchaînés sur le script ; voix française du téléphone + sous-titres ; séance entière en accéléré.
   Repère de la scène : x le long du bassin (0 = mur des plots, 25 = mur opposé), y vers le haut (0 = surface de l'eau), z en travers (couloirs).
   Visible pour le compte admin seulement tant que PUBLIC = false. */
const Swim3D = (() => {
  const PUBLIC = false;
  const CDN = 'https://cdn.jsdelivr.net/npm/three@0.147.0/';
  const script = src => new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error('bibliothèque 3D injoignable')); document.head.appendChild(s); });
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a)*t, smooth = t => { t = clamp(t, 0, 1); return t*t*(3 - 2*t); };
  const ease = t => { t = clamp(t, 0, 1); return t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2; };
  const TAU = Math.PI*2, POOL = 25, LANE = 2.5, DECK = 0.15, DEPTH = 2.0;
  const fmtP = s => `${Math.floor(s/60)}'${String(Math.round(s % 60) % 60).padStart(2, '0')}`; // 97 → 1'37
  const fmtT = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s/3600), m = Math.floor(s/60) % 60, x = s % 60; return h ? `${h}h${String(m).padStart(2, '0')}` : `${m}'${String(x).padStart(2, '0')}`; };

  /* ---------------------------------------------------------------- éducatifs : ce que le coach dit, mime et montre */
  const DRILLS = {
    catchup: { name: 'Rattrapé', style: 'catchup',
      why: "Le bras devant attend que l'autre vienne le rattraper : tu apprends à glisser et à allonger chaque mouvement.",
      cues: ['Le bras devant reste tendu et attend', "L'autre main vient toucher la première avant de repartir", 'Respire sur le côté, sans lever la tête'],
      sum: 'Glisse, attends, puis tire : un bras à la fois.' },
    fist: { name: 'Poings fermés', style: 'fist',
      why: "Sans la main, c'est l'avant-bras qui doit prendre l'appui : ça oblige à garder le coude haut.",
      cues: ['Poings fermés, pouce rentré', "Coude haut : l'avant-bras devient ta pagaie", 'Quand tu rouvres les mains, sens la différence'],
      sum: "Coude haut, l'avant-bras tire l'eau vers l'arrière." },
    dog: { name: 'Chien', style: 'dog',
      why: "Les bras repartent sous l'eau, tête hors de l'eau : tu sens l'appui de la main devant toi.",
      cues: ["Tête hors de l'eau, regard vers l'avant", "Les bras reviennent sous l'eau, près du corps", 'Appuie vers le bas puis vers l\'arrière, battements réguliers'],
      sum: "Tête haute, retour des bras sous l'eau, sens l'appui." },
    buoy: { name: 'Pull-buoy jambes serrées', style: 'buoy',
      why: "Le pull-buoy entre les cuisses, jambes serrées, sans battre : ton gainage doit garder le bassin haut.",
      cues: ['Pull-buoy en haut des cuisses, chevilles serrées', 'Ventre rentré : le bassin reste près de la surface', 'Pas de battements : la rotation vient des épaules et des hanches'],
      sum: 'Gainé, jambes serrées, le bassin reste haut.' },
    paddles: { name: 'Pull plaquettes', style: 'paddles',
      why: "Plaquettes et pull-buoy : de l'amplitude et de la force, sans casser la nage.",
      cues: ['Entre la main dans l\'axe de l\'épaule', 'Allonge loin devant avant de tirer', 'Pousse jusqu\'à la cuisse, sans forcer sur les épaules'],
      sum: 'Long, loin devant, jusqu\'à la cuisse.' },
    sight: { name: 'Visée', style: 'sight',
      why: "Comme en lac : toutes les 6 coups de bras, tu lèves juste les yeux pour viser, puis tu respires sur le côté.",
      cues: ['Juste les yeux au-dessus de l\'eau, comme un crocodile', 'Vise pendant que le bras devant appuie', "Tourne la tête pour respirer, sans casser l'allure"],
      sum: 'Les yeux devant, puis respiration sur le côté.' },
  };
  const drillOf = l => /rattrap/i.test(l) ? 'catchup' : /poing/i.test(l) ? 'fist' : /chien/i.test(l) ? 'dog' : /pull.?buoy|jambes serr/i.test(l) ? 'buoy' : /plaquette/i.test(l) ? 'paddles' : /vis[ée]e/i.test(l) ? 'sight' : null;

  /* ---------------------------------------------------------------- séance → blocs + script */
  const nb = n => ({ 2: 'deux', 3: 'trois', 4: 'quatre', 5: 'cinq', 6: 'six', 8: 'huit', 10: 'dix', 12: 'douze' }[n] || String(n));
  // texte affiché → texte dit par la voix (allures, ×, CSS, flèches, unités)
  const spoken = t => String(t)
    .replace(/(\d+)'(\d{2})/g, (_, m, s) => `${m} minute${m > 1 ? 's' : ''} ${+s ? +s : ''}`.trim())
    .replace(/(\d+)\s*[×x]\s*(\d+)/g, '$1 fois $2').replace(/\/\s*100(\s*m(?![a-zà-ÿ]))?/gi, ' aux 100').replace(/(\d)\s*m(?![a-zà-ÿ])/gi, '$1 mètres')
    .replace(/\bCSS\b/g, 'C.S.S.').replace(/→/g, 'à').replace(/(\d+)\s*s(?![a-zà-ÿ])/gi, '$1 secondes').replace(/\bnat\b/gi, 'natation').replace(/\s+/g, ' ').trim();
  function plan(x, opts = {}){
    const T = (typeof tri === 'function' && tri()) || {}, css = opts.css || T.css || 105, pool = T.pool || 25;
    const W = opts.W || triWorkout(x), steps = W.steps || [];
    const blocks = steps.map((s, i) => {
      const z = SW_Z[s.z] || SW_Z.z2, pace = css + z.k, swim = s.d/100*pace;
      const drill = s.z === 'drill' ? drillOf(s.l) || 'catchup' : /plaquette/i.test(s.l) ? 'paddles' : /vis[ée]e/i.test(s.l) ? 'sight' : /pull/i.test(s.l) ? 'buoy' : null;
      const kind = s.z === 'drill' ? 'drill' : i === 0 && s.z === 'z1' ? 'warmup' : i === steps.length - 1 && s.z === 'z1' ? 'cooldown' : 'main';
      const gear = { buoy: drill === 'buoy' || drill === 'paddles', paddles: drill === 'paddles' };
      const dep = s.n > 1 && s.r ? Math.ceil((swim + s.r)/5)*5 : 0;
      const style = drill ? DRILLS[drill].style : kind === 'warmup' && /dos/i.test(s.l) ? 'mix' : 'free';
      return { i, n: s.n, d: s.d, z: s.z, zl: z.l, l: s.l || z.l, r: s.r || 0, pace, swim, dep, kind, drill, gear, style, dist: s.n*s.d, sec: s.n*(swim + (s.r || 0)) };
    });
    const total = blocks.reduce((a, b) => a + b.dist, 0), sec = blocks.reduce((a, b) => a + b.sec, 0);
    return { W, css, pool, blocks, total, sec, name: W.name || 'Séance de natation', goal: W.goal || '', lines: scriptOf(W, blocks, css, total, sec) };
  }
  // ce que le coach dit, bloc par bloc ; chaque réplique : { t: affiché, b: bloc, act: 'intro' | 'block' | 'mime' | 'demo' | 'clock' | 'outro' }
  function scriptOf(W, blocks, css, total, sec){
    const first = (typeof S !== 'undefined' && S.profile?.name && S.profile.name.length > 1) ? ' ' + S.profile.name.split(/\s+/)[0] : '';
    const L = [];
    const say = (t, act, b = null, extra = {}) => L.push({ t, act, b, ...extra });
    say(`Salut${first} ! Aujourd'hui : ${W.name.replace(/^Nat /, 'nat ')}.`, 'intro');
    if (W.goal) say(W.goal, 'intro');
    say(`Au programme : ${total} m, environ ${Math.round(sec/60)} minutes. Ta CSS est à ${fmtP(css)} aux 100 : toutes les allures partent de là.`, 'intro');
    let clockDone = false;
    for (const b of blocks) {
      const reps = b.n > 1 ? `${b.n} × ${b.d} m` : `${b.d} m`, rec = b.r ? ` ${b.r} secondes de récup entre chaque.` : '';
      if (b.kind === 'warmup') say(`On démarre par ${b.d} m d'échauffement${/dos/i.test(b.l) ? ', en crawl et en dos' : ''}, tout en souplesse, vers ${fmtP(b.pace)} aux 100.`, 'block', b);
      else if (b.kind === 'cooldown') say(`Et on termine par ${b.d} m de récupération, très souple.`, 'block', b);
      else if (b.kind === 'drill') {
        const D = DRILLS[b.drill];
        say(`Ensuite, ${reps} d'éducatif : ${D.name.toLowerCase()}.${rec}`, 'block', b);
        say(D.why, 'mime', b); say(`Regarde, je te le montre dans l'eau.`, 'demo', b);
        D.cues.forEach((c, k) => say(c + '.', 'cue', b, { k }));
        say(D.sum, 'block', b);
      } else {
        let t = `${reps}${b.l && !/allure css/i.test(b.l) ? ` ${b.l.charAt(0).toLowerCase() + b.l.slice(1)}` : ''}`;
        if (b.z === 'css') t = `Le cœur de la séance : ${reps} à ta CSS, ${fmtP(b.pace)} aux 100.${rec} Le premier doit ressembler au dernier.`;
        else if (b.z === 'race') t = `${reps} à ton allure course, ${fmtP(b.pace)} aux 100.${rec} C'est l'allure que tu tiendras sur le lac.`;
        else if (b.z === 'fast') t = `${t} : rapide, vers ${fmtP(b.pace)} aux 100, mais une nage propre.${rec}`;
        else if (b.z === 'max') t = `${t} : à fond, explosif dès le mur.${rec}`;
        else if (b.z === 'z2') t = b.n > 1 ? `${t}, en aérobie vers ${fmtP(b.pace)} aux 100.${rec}` : `${b.d} m en continu, aérobie, vers ${fmtP(b.pace)} aux 100.`;
        else t = `${t}, vers ${fmtP(b.pace)} aux 100.${rec}`;
        say(t, 'block', b);
        if (b.drill && b.kind === 'main') { const D = DRILLS[b.drill]; say(D.why, 'mime', b); say(`Regarde, je te le montre dans l'eau.`, 'demo', b); D.cues.forEach((c, k) => say(c + '.', 'cue', b, { k })); }
        if (b.dep && !clockDone) { clockDone = true; say(`Départ toutes les ${fmtP(b.dep)} : regarde la pendule, tu pars quand la grande aiguille repasse en haut.`, 'clock', b); }
      }
    }
    const main = blocks.find(b => b.z === 'css' || b.z === 'race');
    say(main ? "Si l'allure ne tient pas, garde la technique et rallonge un peu la récup. Allez, à l'eau !" : "Pense à la glisse plutôt qu'à la force. Allez, à l'eau !", 'outro');
    return L;
  }

  /* ---------------------------------------------------------------- chargement : three.js (CDN versionné), GLTFLoader, meshopt, nageurs */
  let libs = null, chars = null;
  const loadLibs = () => libs ||= (async () => {
    if (!window.THREE) await script(CDN + 'build/three.min.js');
    if (!THREE.GLTFLoader) await script(CDN + 'examples/js/loaders/GLTFLoader.js');
    if (!window.MeshoptDecoder) await script(CDN + 'examples/js/libs/meshopt_decoder.js');
  })().catch(e => { libs = null; throw e; });
  const b64 = s => { const bin = atob(s), n = bin.length, u = new Uint8Array(n); for (let i = 0; i < n; i++) u[i] = bin.charCodeAt(i); return u; };
  const loadChars = () => chars ||= (async () => {
    await loadLibs();
    if (!window.FTPB_SWIM) await script('models/nageurs.js?v=' + (typeof APP_VERSION === 'string' ? APP_VERSION : '0'));
    await MeshoptDecoder.ready;
    const loader = new THREE.GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    return await new Promise((ok, ko) => loader.parse(b64(window.FTPB_SWIM.glb).buffer, '', ok, e => ko(new Error('nageurs illisibles : ' + (e?.message || e)))));
  })().catch(e => { chars = null; throw e; });

  /* ---------------------------------------------------------------- textures peintes (canvas) */
  function canvasTex(w, h, draw, { repeat = null, aniso = 4 } = {}){
    const T = THREE, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = aniso;
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(...repeat); }
    return t;
  }
  const grain = (g, w, h, a = 10, n = 2200) => { for (let i = 0; i < n; i++) { const v = Math.random()*a*2 - a | 0; g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v)/255})`; g.fillRect(Math.random()*w, Math.random()*h, 2, 2); } };
  // carrelage du bassin : petits carreaux blancs légèrement bleutés, joints gris
  const tiles = (g, x0, y0, w, h, step, base = '#e9f1f4', joint = '#b9c7cc') => {
    g.fillStyle = base; g.fillRect(x0, y0, w, h); g.fillStyle = joint;
    for (let x = x0; x <= x0 + w; x += step) g.fillRect(x, y0, Math.max(1, step*.07), h);
    for (let y = y0; y <= y0 + h; y += step) g.fillRect(x0, y, w, Math.max(1, step*.07));
  };
  function floorTex(){ // fond du bassin : 25 m × 15 m, lignes de nage noires terminées en T à 2 m des murs
    const ppm = 64; return canvasTex(POOL*ppm, 15*ppm, (g, w, h) => {
      tiles(g, 0, 0, w, h, .125*ppm); grain(g, w, h, 8, 9000);
      g.fillStyle = '#14304a';
      for (let i = 0; i < 6; i++) { const zc = (i + .5)*LANE*ppm; g.fillRect(2*ppm, zc - .125*ppm, (POOL - 4)*ppm, .25*ppm); for (const xe of [2, POOL - 2]) g.fillRect((xe - (xe < 5 ? 0 : .25))*ppm - (xe < 5 ? 0 : 0), zc - .5*ppm, .25*ppm, ppm); }
    }, { aniso: 8 });
  }
  function wallTex(len, ends){ // parois : carrelage, cibles en croix au bout des couloirs, profondeur peinte
    const ppm = 64, H = DEPTH + DECK; return canvasTex(Math.round(len*ppm), Math.round(H*ppm), (g, w, h) => {
      tiles(g, 0, 0, w, h, .125*ppm); grain(g, w, h, 8, 2500);
      g.fillStyle = '#c9dbe1'; g.fillRect(0, 0, w, .10*ppm); // margelle
      if (ends) { g.fillStyle = '#14304a'; for (let i = 0; i < 6; i++) { const c = (i + .5)*LANE*ppm; g.fillRect(c - .125*ppm, h - 1.75*ppm, .25*ppm, 1.15*ppm); g.fillRect(c - .5*ppm, h - 1.75*ppm + .3*ppm, ppm, .25*ppm); } }
      else { g.fillStyle = '#1b3a55'; g.font = `bold ${.22*ppm}px Inter, Arial`; for (const x of [1.2, 12.5, 23.8]) g.fillText('2,00 m', x*ppm, .45*ppm); }
    });
  }
  const deckTex = () => canvasTex(512, 512, (g, w, h) => { tiles(g, 0, 0, w, h, 128, '#cfc8bb', '#a9a294'); grain(g, w, h, 14, 6000); for (let i = 0; i < 1400; i++) { g.fillStyle = 'rgba(80,70,60,.08)'; g.fillRect(Math.random()*w, Math.random()*h, 3, 3); } }, { repeat: [18, 12] });
  const clockTex = () => canvasTex(512, 512, (g, w) => {
    const c = w/2; g.fillStyle = '#f7f7f2'; g.beginPath(); g.arc(c, c, c*.98, 0, TAU); g.fill(); g.lineWidth = 14; g.strokeStyle = '#1e2a33'; g.stroke();
    for (let i = 0; i < 60; i++) { const a = i/60*TAU, r1 = c*.88, r0 = i % 5 ? c*.82 : c*.74; g.lineWidth = i % 5 ? 4 : 9; g.strokeStyle = i % 15 ? '#1e2a33' : '#d6261e';
      g.beginPath(); g.moveTo(c + Math.sin(a)*r0, c - Math.cos(a)*r0); g.lineTo(c + Math.sin(a)*r1, c - Math.cos(a)*r1); g.stroke(); }
    g.fillStyle = '#1e2a33'; g.font = 'bold 44px Inter, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 5; i <= 60; i += 5) { const a = i/60*TAU; g.fillText(String(i), c + Math.sin(a)*c*.6, c - Math.cos(a)*c*.6); }
  });
  const blockNumTex = n => canvasTex(128, 128, (g, w) => { g.fillStyle = '#0f2f4f'; g.fillRect(0, 0, w, w); g.fillStyle = '#fff'; g.font = 'bold 92px Inter, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), w/2, w/2 + 4); });
  const bannerTex = () => canvasTex(1024, 192, (g, w, h) => { g.fillStyle = '#0f1115'; g.fillRect(0, 0, w, h); g.font = 'italic 900 120px Inter, Arial'; g.textBaseline = 'middle';
    g.fillStyle = '#ffffff'; g.fillText('FTP', 70, h/2 + 6); g.fillStyle = '#ff8a4c'; g.fillText('·', 300, h/2 + 6); g.fillStyle = '#ffffff'; g.fillText('BUILDER', 350, h/2 + 6);
    g.fillStyle = '#19c3c9'; g.fillRect(70, h - 28, w - 140, 8); });
  const skyTex = () => canvasTex(256, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9cc9f0'); gr.addColorStop(.62, '#e7f2fb'); gr.addColorStop(1, '#cfe2d4'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(70,110,80,.55)'; for (let i = 0; i < 40; i++) { const x = Math.random()*w, r = 10 + Math.random()*26; g.beginPath(); g.arc(x, h - 6 + Math.random()*10, r, 0, TAU); g.fill(); } });
  const softDot = () => canvasTex(64, 64, (g, w) => { const gr = g.createRadialGradient(w/2, w/2, 0, w/2, w/2, w/2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.45, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });

  /* ---------------------------------------------------------------- eau : surface, caustiques, absorption (morceaux de shader partagés) */
  const GLSL_CAUSTIC = `
    float s3dCaustic(vec2 uv, float t){ // caustiques « tileable water caustic » : boucle d'interférences
      vec2 p = mod(uv*6.28318, 6.28318) - 250.0, i = p; float c = 1.0, inten = .005;
      for (int n = 0; n < 4; n++) { float tt = t*(1.0 - (3.5/float(n + 1)));
        i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
        c += 1.0/length(vec2(p.x/(sin(i.x + tt)/inten), p.y/(cos(i.y + tt)/inten))); }
      c /= 4.0; c = 1.17 - pow(c, 1.4); return clamp(pow(abs(c), 8.0), 0.0, 3.0); }`;
  const U = { time: { value: 0 }, camUnder: { value: 0 }, waterC: { value: null }, absorb: { value: null }, caustI: { value: 1 } };
  // toute matière de la scène : caustiques sous la surface, et couleur absorbée par l'eau (vue d'au-dessus)
  function patch(m, key = ''){
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, { s3dTime: U.time, s3dUnder: U.camUnder, s3dWaterC: U.waterC, s3dAbs: U.absorb, s3dCI: U.caustI });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 s3dW;')
        .replace('#include <project_vertex>', `#include <project_vertex>
          #ifdef USE_INSTANCING
            s3dW = (modelMatrix*instanceMatrix*vec4(transformed, 1.0)).xyz;
          #else
            s3dW = (modelMatrix*vec4(transformed, 1.0)).xyz;
          #endif`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 s3dW; uniform float s3dTime, s3dUnder, s3dCI; uniform vec3 s3dWaterC, s3dAbs;\n${GLSL_CAUSTIC}`)
        .replace('#include <fog_fragment>', `if (s3dW.y < 0.0) {
            float dpt = -s3dW.y, cs = s3dCaustic(s3dW.xz*.42 + vec2(s3dTime*.012, 0.0), s3dTime*.55);
            gl_FragColor.rgb *= 0.80 + s3dCI*0.75*cs*exp(-dpt*.35);
            if (s3dUnder < .5) { vec3 vd = normalize(cameraPosition - s3dW); float path = dpt/max(abs(vd.y), .28) + dpt;
              vec3 ab = exp(-s3dAbs*path); gl_FragColor.rgb = gl_FragColor.rgb*ab + s3dWaterC*(1.0 - ab)*.62; }
          }
          #include <fog_fragment>`);
    };
    m.customProgramCacheKey = () => 's3d' + key; return m;
  }
  function waterMaterial(env){
    const T = THREE;
    const u = { uTime: U.time, uUnder: U.camUnder, uEnv: { value: env }, uSun: { value: new T.Vector3(-.35, .8, -.5).normalize() }, uRip: { value: Array.from({ length: 16 }, () => new T.Vector4(0, 0, -99, 0)) },
      uDeep: { value: new T.Color(0x0c5d7a) }, uShal: { value: new T.Color(0x3fb7c9) }, uWake: { value: new T.Vector4(0, 0, 0, 0) }, uWake2: { value: new T.Vector4(0, 0, 0, 0) } };
    return new T.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, side: T.DoubleSide,
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float uTime, uUnder; uniform samplerCube uEnv; uniform vec3 uSun, uDeep, uShal; uniform vec4 uRip[16], uWake, uWake2; varying vec3 vW;
        vec2 wv(vec2 p, vec2 d, float k, float a, float s){ float ph = dot(p, d)*k + uTime*s; return d*(a*k*cos(ph)); }
        vec2 wake(vec2 p, vec4 w){ // sillage et vague d'étrave autour du nageur : x, z, cap (rad), vitesse
          if (w.w < .05) return vec2(0.0); vec2 d = vec2(cos(w.z), sin(w.z)), q = p - w.xy; float a = dot(q, d), b = dot(q, vec2(-d.y, d.x));
          float env = exp(-max(-a, 0.0)*.45)*exp(-abs(b)*1.4)*smoothstep(1.2, -.2, a)*step(-9.0, a);
          float ph = length(q)*9.0 - uTime*7.0; float h = sin(ph)*env*.018*w.w;
          return normalize(q + 1e-4)*h*9.0 + d*exp(-pow(a - .2, 2.0)*6.0)*exp(-b*b*8.0)*.05*w.w; }
        void main(){
          vec2 p = vW.xz, g = vec2(0.0);
          g += wv(p, normalize(vec2(1.0, .3)), 1.9, .010, 1.3) + wv(p, normalize(vec2(-.4, 1.0)), 2.7, .007, 1.7) + wv(p, normalize(vec2(.7, -.8)), 4.3, .004, 2.3);
          g += wv(p, normalize(vec2(.2, 1.0)), 9.0, .0016, 3.1) + wv(p, normalize(vec2(-1.0, -.1)), 13.0, .0011, 3.7) + wv(p, normalize(vec2(.9, .6)), 21.0, .0006, 5.0);
          for (int i = 0; i < 16; i++) { vec4 r = uRip[i]; float age = uTime - r.z; if (age < 0.0 || age > 3.5) continue;
            vec2 q = p - r.xy; float d = length(q) + 1e-4, f = d - age*.55; float h = r.w*exp(-age*1.2)*exp(-f*f*14.0)*cos(f*26.0); g += q/d*h*.9; }
          g += wake(p, uWake) + wake(p, uWake2);
          vec3 n = normalize(vec3(-g.x, 1.0, -g.y)), v = normalize(cameraPosition - vW);
          if (uUnder > .5) { // vue de dessous : fenêtre de Snell vers le plafond, réflexion totale ailleurs
            vec3 nu = -n; float c = dot(nu, v), win = smoothstep(.60, .74, abs(c));
            vec3 sky = textureCube(uEnv, refract(-v, nu, 1.33)).rgb*1.15, tir = mix(uDeep*.55, uShal*.7, .35);
            gl_FragColor = vec4(mix(tir, sky, win), 1.0); return; }
          float F = .02 + .98*pow(1.0 - max(dot(n, v), 0.0), 5.0);
          vec3 R = reflect(-v, n), refl = textureCube(uEnv, R).rgb;
          float sp = pow(max(dot(R, uSun), 0.0), 380.0)*5.0 + pow(max(dot(R, vec3(0.0, 1.0, 0.0)), 0.0), 900.0)*1.5;
          vec3 body = mix(uShal, uDeep, .35);
          vec3 col = mix(body*.42, refl, F) + sp;
          float a = clamp(mix(.30, 1.0, F) + sp, 0.0, 1.0);
          gl_FragColor = vec4(col, a);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }` });
  }

  /* ---------------------------------------------------------------- particules : éclaboussures, bulles */
  function particles(scene, tex){
    const T = THREE, N = 900, pos = new Float32Array(N*3), siz = new Float32Array(N), alp = new Float32Array(N), colA = new Float32Array(N*3).fill(1);
    const P = { v: new Float32Array(N*3), life: new Float32Array(N), max: new Float32Array(N), kind: new Uint8Array(N), next: 0 };
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('size', new T.BufferAttribute(siz, 1)); g.setAttribute('alpha', new T.BufferAttribute(alp, 1)); g.setAttribute('pcol', new T.BufferAttribute(colA, 3));
    const m = new T.ShaderMaterial({ uniforms: { map: { value: tex }, scale: { value: 400 } }, transparent: true, depthWrite: false,
      vertexShader: `attribute float size, alpha; attribute vec3 pcol; varying float vA; varying vec3 vC; uniform float scale; void main(){ vA = alpha; vC = pcol; vec4 mv = modelViewMatrix*vec4(position, 1.0); gl_PointSize = size*scale/max(-mv.z, .05); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D map; varying float vA; varying vec3 vC; void main(){ vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, c.a*vA); if (gl_FragColor.a < .01) discard; }` });
    const pts = new T.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 3; scene.add(pts);
    P.emit = (x, y, z, vx, vy, vz, life, size, kind, c = null) => { const i = P.next = (P.next + 1) % N; pos[i*3] = x; pos[i*3 + 1] = y; pos[i*3 + 2] = z; P.v[i*3] = vx; P.v[i*3 + 1] = vy; P.v[i*3 + 2] = vz; P.life[i] = life; P.max[i] = life; siz[i] = size; P.kind[i] = kind;
      if (c) { colA[i*3] = c[0]; colA[i*3 + 1] = c[1]; colA[i*3 + 2] = c[2]; } else { colA[i*3] = .94; colA[i*3 + 1] = .98; colA[i*3 + 2] = 1; } };
    P.trail = (v, c = [1, .69, .18]) => P.emit(v.x, v.y, v.z, 0, 0, 0, 1.1, .022, 2, c);
    P.clear = () => { P.life.fill(0); alp.fill(0); };
    P.splash = (x, z, k = 1, dir = 0) => { for (let j = 0; j < 14*k; j++) { const a = Math.random()*TAU, s = (.3 + Math.random()*.9)*k; P.emit(x, .02, z, Math.cos(a)*s*.5 + Math.cos(dir)*.4, (1 + Math.random()*1.6)*k, Math.sin(a)*s*.5 + Math.sin(dir)*.4, .35 + Math.random()*.4, .012 + Math.random()*.02, 0); } };
    P.bubbles = (x, y, z, n = 6, sp = .05) => { for (let j = 0; j < n; j++) P.emit(x + (Math.random() - .5)*sp, y, z + (Math.random() - .5)*sp, (Math.random() - .5)*.1, .25 + Math.random()*.35, (Math.random() - .5)*.1, 1.2 + Math.random()*1.4, .006 + Math.random()*.012, 1); };
    P.update = dt => {
      for (let i = 0; i < N; i++) { if (P.life[i] <= 0) { alp[i] = 0; continue; } P.life[i] -= dt; const k = P.kind[i], o = i*3;
        if (k === 2) { alp[i] = .9*P.life[i]/P.max[i]; continue; }
        if (k === 0) { P.v[o + 1] -= 9.8*dt; if (pos[o + 1] < 0 && P.v[o + 1] < 0) P.life[i] = 0; } else { P.v[o + 1] = Math.min(P.v[o + 1] + .6*dt, .6); P.v[o] *= .98; P.v[o + 2] *= .98; if (pos[o + 1] > -.01) P.life[i] = 0; }
        pos[o] += P.v[o]*dt; pos[o + 1] += P.v[o + 1]*dt; pos[o + 2] += P.v[o + 2]*dt; alp[i] = (k === 0 ? .8 : .55)*clamp(P.life[i]/P.max[i]*2, 0, 1); }
      g.attributes.position.needsUpdate = g.attributes.alpha.needsUpdate = g.attributes.size.needsUpdate = g.attributes.pcol.needsUpdate = true;
    };
    return P;
  }

  /* ---------------------------------------------------------------- la piscine */
  function buildPool(R){
    const T = THREE, sc = R.scene, M = (o, key) => patch(new T.MeshStandardMaterial(o), key);
    U.waterC.value = new T.Color(0x0f7f99); U.absorb.value = new T.Vector3(.40, .085, .055);
    const add = (geo, mat, x, y, z, ry = 0, rx = 0) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.receiveShadow = true; sc.add(m); return m; };
    // bassin : fond, parois, margelle
    add(new T.PlaneGeometry(POOL, 15), M({ map: floorTex(), roughness: .55 }, 'floor'), POOL/2, -DEPTH, 0, 0, -Math.PI/2);
    const wl = M({ map: wallTex(POOL, false), roughness: .5 }, 'w'), we = M({ map: wallTex(15, true), roughness: .5 }, 'we'), HW = DEPTH + DECK, yc = (DECK - DEPTH)/2;
    add(new T.PlaneGeometry(POOL, HW), wl, POOL/2, yc, -7.5); add(new T.PlaneGeometry(POOL, HW), wl, POOL/2, yc, 7.5, Math.PI);
    add(new T.PlaneGeometry(15, HW), we, 0, yc, 0, Math.PI/2); add(new T.PlaneGeometry(15, HW), we, POOL, yc, 0, -Math.PI/2);
    // plage : quatre bandes autour du bassin, goulotte à grille
    const dk = M({ map: deckTex(), roughness: .82 }, 'deck');
    dk.map.repeat.set(1, 1);
    const slab = (x0, x1, z0, z1) => { const geo = new T.BoxGeometry(x1 - x0, .3, z1 - z0), cx = (x0 + x1)/2, cz = (z0 + z1)/2, ps = geo.attributes.position, uv = geo.attributes.uv; // UV en mètres : carreaux de 25 cm partout
      for (let i = 0; i < ps.count; i++) uv.setXY(i, (ps.getX(i) + cx)*1.0, (ps.getZ(i) + cz)*1.0 + ps.getY(i)); return add(geo, dk, cx, DECK - .15, cz); };
    slab(-7, -.3, -12, 12); slab(POOL + .3, POOL + 7, -12, 12); slab(-.3, POOL + .3, -12, -7.8); slab(-.3, POOL + .3, 7.8, 12);
    const gm = M({ color: 0x9aa3a8, roughness: .45, metalness: .3 }, 'grate');
    const grate = (x0, x1, z0, z1) => add(new T.BoxGeometry(x1 - x0, .04, z1 - z0), gm, (x0 + x1)/2, DECK - .03, (z0 + z1)/2);
    grate(-.3, 0, -7.8, 7.8); grate(POOL, POOL + .3, -7.8, 7.8); grate(-.3, POOL + .3, -7.8, -7.5); grate(-.3, POOL + .3, 7.5, 7.8);
    // eau
    const water = add(new T.PlaneGeometry(POOL, 15), waterMaterial(null), POOL/2, 0, 0, 0, -Math.PI/2); water.receiveShadow = false; water.renderOrder = 2; R.water = water;
    // rayons de soleil sous l'eau (visibles en vue sous-marine)
    const shaftTex = canvasTex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const gx = g.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(.5, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = gx; g.fillRect(0, 0, w, h); });
    R.shafts = new T.Group(); R.shafts.visible = false; sc.add(R.shafts);
    for (let i = 0; i < 26; i++) { const m = new T.Mesh(new T.PlaneGeometry(.5 + Math.random()*.9, 2.6), new T.MeshBasicMaterial({ map: shaftTex, transparent: true, opacity: .08, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, color: 0xbff4ff }));
      m.geometry.translate(0, -1.3, 0); m.position.set(Math.random()*POOL, -.02, -7 + Math.random()*14); m.rotation.set(-.32, Math.random()*Math.PI, .18); m.userData.ph = Math.random()*TAU; R.shafts.add(m); }
    // lignes d'eau (flotteurs rouges les 5 premiers et derniers mètres, puis bleu / blanc) — instanciées, ondulation dans le shader
    const fg = new T.CylinderGeometry(.055, .055, .085, 14, 1); fg.rotateZ(Math.PI/2);
    const fm = new T.MeshStandardMaterial({ roughness: .35 }); patch(fm, 'float');
    const fo = fm.onBeforeCompile; fm.onBeforeCompile = sh => { fo(sh); sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      { vec4 ip = instanceMatrix*vec4(0.0, 0.0, 0.0, 1.0); transformed.y += sin(ip.x*1.7 + s3dTime*1.4 + ip.z)*.012 + sin(ip.x*.6 - s3dTime*.8)*.008; }`).replace('#include <common>', '#include <common>\nuniform float s3dTime;'); };
    const per = Math.floor(POOL/.092), ropes = 5, inst = new T.InstancedMesh(fg, fm, per*ropes), mm = new T.Matrix4(), col = new T.Color();
    for (let r = 0; r < ropes; r++) for (let i = 0; i < per; i++) { const x = .05 + i*.092, z = -7.5 + (r + 1)*LANE; mm.makeTranslation(x, .01, z); inst.setMatrixAt(r*per + i, mm);
      col.set(x < 5 || x > POOL - 5 ? (i % 2 ? 0xd62828 : 0xf2f2f2) : (i % 6 < 3 ? 0x1b5fb5 : 0xf2f2f2)); inst.setColorAt(r*per + i, col); }
    inst.castShadow = true; sc.add(inst);
    // fanions de dos à 5 m des murs
    const pole = M({ color: 0xd8dde0, roughness: .3, metalness: .6 }, 'pole'), fl = new T.MeshStandardMaterial({ side: T.DoubleSide, roughness: .8 });
    for (const x of [5, POOL - 5]) {
      for (const z of [-8.3, 8.3]) add(new T.CylinderGeometry(.03, .03, 2.0, 8), pole, x, DECK + 1.0, z);
      const tri = new T.BufferGeometry(); const pts = []; const cols = [];
      for (let i = 0; i < 40; i++) { const z = -8.2 + i*.41; pts.push(x, 1.95 + DECK, z, x, 1.95 + DECK, z + .3, x, 1.65 + DECK, z + .15); const c = new T.Color([0xd62828, 0xf2f2f2, 0x1b5fb5][i % 3]); for (let k = 0; k < 3; k++) cols.push(c.r, c.g, c.b); }
      tri.setAttribute('position', new T.Float32BufferAttribute(pts, 3)); tri.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); tri.computeVertexNormals();
      const fm2 = fl.clone(); fm2.vertexColors = true; add(tri, fm2, 0, 0, 0);
      add(new T.CylinderGeometry(.006, .006, 16.6, 4), pole, x, DECK + 1.95, 0, 0, Math.PI/2).rotation.set(Math.PI/2, 0, 0);
    }
    // plots de départ (mur x = 0)
    const bm = M({ color: 0xf3f4f5, roughness: .35, metalness: .1 }, 'blk'), bt = M({ color: 0x24313a, roughness: .9 }, 'blkt'), steel = M({ color: 0xcfd6da, roughness: .25, metalness: .9 }, 'steel');
    R.blocks = [];
    for (let i = 0; i < 6; i++) {
      const z = -7.5 + (i + .5)*LANE, g = new T.Group(); g.position.set(-.38, DECK, z);
      const base = new T.Mesh(new T.BoxGeometry(.5, .62, .52), bm); base.position.y = .31; g.add(base);
      const top = new T.Mesh(new T.BoxGeometry(.56, .045, .56), bt); top.position.set(.03, .67, 0); top.rotation.z = -.15; g.add(top);
      const num = new T.Mesh(new T.PlaneGeometry(.26, .26), new T.MeshBasicMaterial({ map: blockNumTex(i + 1) })); num.position.set(.252, .38, 0); num.rotation.y = Math.PI/2; g.add(num);
      for (const s of [-1, 1]) { const h = new T.Mesh(new T.TorusGeometry(.09, .012, 6, 14, Math.PI), steel); h.position.set(.2, .58, s*.2); h.rotation.set(0, Math.PI/2, Math.PI/2); g.add(h); }
      g.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); sc.add(g); R.blocks.push(g);
    }
    // échelles inox
    const curve = (pts) => new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p)));
    for (const [x, z, s] of [[1.2, -7.5, 1], [1.2, 7.5, -1], [POOL - 1.2, -7.5, 1], [POOL - 1.2, 7.5, -1]]) for (const dx of [-.25, .25]) {
      add(new T.TubeGeometry(curve([[x + dx, -1.2, z + s*.16], [x + dx, .2, z + s*.16], [x + dx, .75, z - s*.05], [x + dx, .62, z - s*.42], [x + dx, DECK, z - s*.48]]), 24, .02, 8), steel, 0, 0, 0); }
    // halle : murs, baies vitrées côté z < 0, gradins côté z > 0, plafond lumineux
    const wallM = M({ color: 0xe9e6df, roughness: .9 }, 'hall'), ceilM = M({ color: 0xf4f3ef, roughness: .95 }, 'ceil');
    add(new T.PlaneGeometry(40, 9), wallM, 12.5, 4.5, 12, Math.PI); add(new T.PlaneGeometry(26, 9), wallM, -7, 4.5, 0, Math.PI/2); add(new T.PlaneGeometry(26, 9), wallM, POOL + 7, 4.5, 0, -Math.PI/2);
    add(new T.PlaneGeometry(40, 26), ceilM, 12.5, 9, 0, 0, Math.PI/2);
    const sky = new T.MeshBasicMaterial({ map: skyTex() }); sky.toneMapped = false; sky.color.setScalar(1.25);
    add(new T.PlaneGeometry(40, 9), sky, 12.5, 4.5, -12.4);
    const mul = M({ color: 0x55606a, roughness: .5, metalness: .5 }, 'mul');
    for (let x = -7; x <= POOL + 7; x += 2.4) add(new T.BoxGeometry(.12, 9, .2), mul, x, 4.5, -12.0);
    for (const y of [.9, 3.6, 6.4]) add(new T.BoxGeometry(40, .12, .2), mul, 12.5, y, -12.0);
    const lampM = new T.MeshBasicMaterial({ color: 0xffffff }); lampM.toneMapped = false; lampM.color.setScalar(1.6);
    for (let x = -4; x <= POOL + 4; x += 4.2) for (const z of [-6, 0, 6]) add(new T.BoxGeometry(2.4, .06, .25), lampM, x, 8.92, z);
    const beam = M({ color: 0xcfd3d6, roughness: .6, metalness: .4 }, 'beam'); for (let x = -5; x <= POOL + 6; x += 6) add(new T.BoxGeometry(.25, .6, 24), beam, x, 8.6, 0);
    const bench = M({ color: 0x2c6e9b, roughness: .6 }, 'bench');
    for (let k = 0; k < 4; k++) add(new T.BoxGeometry(24, .45, .9), bench, 12.5, DECK + .225 + k*.45, 9.0 + k*.75);
    const ban = add(new T.PlaneGeometry(6, 1.125), new T.MeshBasicMaterial({ map: bannerTex() }), 12.5, 5.6, 11.95, Math.PI); ban.material.toneMapped = false;
    // pendules des départs : côté gradins près des plots, et mur du fond
    R.clocks = [];
    for (const [x, y, z, ry] of [[3.0, 2.5, 11.9, Math.PI], [POOL + 6.9, 3.2, 0, -Math.PI/2]]) {
      const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = ry; sc.add(g);
      const face = new T.Mesh(new T.CircleGeometry(.62, 48), new T.MeshBasicMaterial({ map: clockTex() })); face.material.toneMapped = false; g.add(face);
      const rim = new T.Mesh(new T.TorusGeometry(.63, .035, 8, 48), M({ color: 0x1e2a33, roughness: .4 }, 'rim')); g.add(rim);
      const hand = (c, w, l) => { const h = new T.Mesh(new T.PlaneGeometry(w, l), new T.MeshBasicMaterial({ color: c })); h.geometry.translate(0, l/2 - .06, 0); h.position.z = .01; g.add(h); return h; };
      g.userData.red = hand(0xd6261e, .035, .58); g.userData.blk = hand(0x111111, .045, .44); g.userData.blk.position.z = .012; R.clocks.push(g);
    }
    // tableau de la séance (chevalet près des personnages)
    const bc = document.createElement('canvas'); bc.width = 1024; bc.height = 1280; const btex = new T.CanvasTexture(bc); btex.encoding = T.sRGBEncoding; btex.anisotropy = 8;
    const board = new T.Group(); board.position.set(-2.6, DECK, 3.35); board.rotation.y = .55 + Math.PI/2; sc.add(board);
    const face = new T.Mesh(new T.PlaneGeometry(.92, 1.15), new T.MeshStandardMaterial({ map: btex, roughness: .35 })); face.position.y = 1.32; board.add(face);
    const frameM = M({ color: 0x9aa4ab, roughness: .3, metalness: .7 }, 'frame');
    for (const [w, h, x, y] of [[.96, .03, 0, 1.9], [.96, .03, 0, .74], [.03, 1.2, -.47, 1.32], [.03, 1.2, .47, 1.32]]) { const b = new T.Mesh(new T.BoxGeometry(w, h, .03), frameM); b.position.set(x, y, -.01); board.add(b); }
    for (const s of [-1, 1]) { const l = new T.Mesh(new T.CylinderGeometry(.015, .015, 1.95, 6), frameM); l.position.set(s*.4, .9, -.25); l.rotation.x = .25; board.add(l); }
    const bl = new T.Mesh(new T.CylinderGeometry(.015, .015, 1.95, 6), frameM); bl.position.set(0, .9, -.5); bl.rotation.x = -.35; board.add(bl);
    board.traverse(o => { if (o.isMesh) o.castShadow = true; });
    R.board = { group: board, canvas: bc, tex: btex, face };
  }

  /* ---------------------------------------------------------------- personnages : matières, squelette (pose de référence = T-pose, rotations neutres) */
  const SIDE = { L: 1, R: -1 };
  function setupChar(R, root, pre, opts){
    const T = THREE, mats = {};
    const mk = (key, o) => mats[key] ||= patch(new T.MeshStandardMaterial(o), 'c' + key);
    const tone = new T.Color(opts.skin || 0xc98d6b);
    const MAT = { corps: 'skin', suit: 'suit', shorts: 'suit', cap: 'cap', shirt: 'shirt', hair: 'hair', brow: 'brow', oeil: 'eye', lunettes_verres: 'lens', lunettes_monture: 'goggle',
      lunettes_elastique: 'strap', sifflet: 'whistle', cordon: 'cord', pull_buoy: 'buoy', plaquette: 'paddle', sangle: 'strap', paupieres: 'skin' };
    const NEW = { skin: () => ({ color: tone, vertexColors: true, roughness: .52 }), suit: () => ({ color: opts.suit || 0x0b1530, roughness: .42, metalness: .05 }), cap: () => ({ color: opts.cap || 0xff8a4c, roughness: .26 }),
      shirt: () => ({ color: opts.shirt || 0x123064, roughness: .62 }), hair: () => ({ color: 0x1c140f, roughness: .9 }), brow: () => ({ color: 0x1c140f, roughness: .95 }), eye: () => ({ vertexColors: true, roughness: .08 }),
      lens: () => ({ color: 0x1d3550, roughness: .04, metalness: .85 }), goggle: () => ({ color: 0x15181c, roughness: .35 }), strap: () => ({ color: 0x15181c, roughness: .5 }), whistle: () => ({ color: 0xd62828, roughness: .35 }),
      cord: () => ({ color: 0xeeeeee, roughness: .7 }), buoy: () => ({ color: 0xffc21a, vertexColors: true, roughness: .7 }), paddle: () => ({ color: 0x1d6fd8, roughness: .22, transparent: true, opacity: .88 }) };
    const key = o => { const n = o.name.startsWith(pre) ? o.name : o.parent?.name || ''; return n.startsWith(pre) ? n.slice(pre.length) : ''; };
    root.traverse(o => {
      if (!o.isMesh) return; const k = key(o), mk = MAT[k] || MAT[k.replace(/_[LR]$/, '')];
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      if (mk) o.material = mats[mk] ||= patch(new T.MeshStandardMaterial({ envMapIntensity: mk === 'lens' ? 1.2 : .42, ...NEW[mk]() }), 'c' + mk);
    });
    const bones = {}; root.traverse(o => { if (o.isBone && o.name.startsWith(pre)) bones[o.name.slice(pre.length)] = o; });
    const names = Object.keys(bones).sort((a, b) => depth(bones[a]) - depth(bones[b]));
    function depth(b){ let d = 0; while (b.parent && b.parent.isBone) { d++; b = b.parent; } return d; }
    const rest = {}, restW = {}, par = {};
    for (const n of names) { rest[n] = bones[n].position.clone(); const p = bones[n].parent; par[n] = p && p.isBone ? p.name.slice(pre.length) : null; }
    for (const n of names) restW[n] = par[n] ? restW[par[n]].clone().add(rest[n]) : rest[n].clone();
    const L = (a, b) => restW[b].clone().sub(restW[a]).length();
    const acc = {}; root.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) { const g = o.name.startsWith(pre) ? o : o.parent; acc[g.name.slice(pre.length)] = g; } });
    const rig = { root, pre, bones, names, rest, restW, par, mats, acc, skin: tone, wet: 0,
      len: { arm: L('L_Arm', 'L_ForeArm'), fore: L('L_ForeArm', 'L_Hand'), thigh: L('L_UpLeg', 'L_Leg'), shin: L('L_Leg', 'L_Foot') } };
    R.scene.add(root); return rig;
  }
  const show = (rig, re, on) => { for (const [k, o] of Object.entries(rig.acc)) if (re.test(k)) o.visible = on; };

  /* ---------------------------------------------------------------- outils de pose (repère du perso : y = tête, z = devant, x = sa gauche) */
  let V3, Q4, M4, _v1, _v2, _v3, _q1, _m1;
  function mathInit(){ const T = THREE; V3 = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z); Q4 = () => new T.Quaternion(); M4 = () => new T.Matrix4(); _v1 = V3(); _v2 = V3(); _v3 = V3(); _q1 = Q4(); _m1 = M4(); }
  const qAx = (x, y, z, a) => Q4().setFromAxisAngle(_v1.set(x, y, z).normalize(), a);
  const qX = a => qAx(1, 0, 0, a), qY = a => qAx(0, 1, 0, a), qZ = a => qAx(0, 0, 1, a);
  const qm = (...q) => q.reduce((a, b) => a.multiply(b), Q4());
  // rotation qui amène le repère de repos (a0, b0) sur le repère voulu (a, b)
  function qBasis(a0, b0, a, b){
    const A0 = a0.clone().normalize(), B0 = b0.clone().sub(A0.clone().multiplyScalar(b0.dot(A0))).normalize(), C0 = A0.clone().cross(B0);
    const A = a.clone().normalize(); let B = b.clone().sub(A.clone().multiplyScalar(b.dot(A))); if (B.lengthSq() < 1e-8) B = Math.abs(A.y) < .9 ? V3(0, 1, 0) : V3(1, 0, 0), B.sub(A.clone().multiplyScalar(B.dot(A))); B.normalize();
    const C = A.clone().cross(B), m0 = M4().makeBasis(A0, B0, C0), m1 = M4().makeBasis(A, B, C);
    return Q4().setFromRotationMatrix(m1.multiply(m0.transpose()));
  }
  // cinématique inverse à deux segments : épaule S, cible W, longueurs a, b, direction du coude (pôle)
  function ik2(S, W, a, b, pole){
    const d = W.clone().sub(S); let L = d.length(); const u = L > 1e-6 ? d.clone().divideScalar(L) : V3(0, -1, 0);
    L = clamp(L, Math.abs(a - b) + 1e-3, (a + b)*.9985); const Wc = S.clone().add(u.clone().multiplyScalar(L));
    let m = pole.clone().sub(u.clone().multiplyScalar(pole.dot(u))); if (m.lengthSq() < 1e-8) m = Math.abs(u.z) < .9 ? V3(0, 0, 1) : V3(1, 0, 0); m.normalize();
    const ca = clamp((a*a + L*L - b*b)/(2*a*L), -1, 1), E = S.clone().add(u.multiplyScalar(a*ca)).add(m.clone().multiplyScalar(a*Math.sqrt(1 - ca*ca)));
    return { E, W: Wc, m };
  }
  class Pose {
    constructor(rig){ this.r = rig; this.Q = {}; this.P = {}; }
    hips(p, q){ this.P.Hips = p.clone(); this.Q.Hips = q.clone(); return this; }
    need(n){ if (this.Q[n]) return; const p = this.r.par[n]; if (!p) { this.P[n] = this.r.rest[n].clone(); this.Q[n] = Q4(); return; } this.need(p); this.set(n, this.Q[p].clone()); } // os non posé : suit son parent
    set(n, q){ const p = this.r.par[n]; this.need(p); this.P[n] = this.P[p].clone().add(this.r.rest[n].clone().applyQuaternion(this.Q[p])); this.Q[n] = q.clone(); return this; }
    loc(n, q){ const p = this.r.par[n]; this.need(p); return this.set(n, this.Q[p].clone().multiply(q)); } // rotation relative au parent
    at(n){ const p = this.r.par[n]; if (p) this.need(p); return this.P[n] ? this.P[n].clone() : this.P[p].clone().add(this.r.rest[n].clone().applyQuaternion(this.Q[p])); }
    // bras : poignet W (repère du perso), coude vers « pole », paume vers « palm », doigts vers « fing », serrage du poing
    arm(sd, W, pole, palm, fing, fist = 0, spread = 0){
      const k = SIDE[sd], r = this.r, S = this.at(sd + '_Arm');
      const { E, W: Wc, m } = ik2(S, W, r.len.arm, r.len.fore, pole);
      const ua = E.clone().sub(S).normalize(), uf = Wc.clone().sub(E).normalize();
      let bend = uf.clone().sub(ua.clone().multiplyScalar(uf.dot(ua))); if (bend.lengthSq() < 1e-6) bend = m.clone().negate();
      this.set(sd + '_Arm', qBasis(V3(k, 0, 0), V3(0, 0, 1), ua, bend));
      const pn = palm.clone().normalize(), th = sd === 'L' ? pn.clone().cross(uf) : uf.clone().cross(pn);
      this.set(sd + '_ForeArm', qBasis(V3(k, 0, 0), V3(0, 0, 1), uf, th));
      const f = fing.clone().normalize(), th2 = sd === 'L' ? pn.clone().cross(f) : f.clone().cross(pn);
      this.set(sd + '_Hand', qBasis(V3(k, -.03, 0), V3(0, 0, 1), f, th2));
      const c1 = .12 + fist*1.45, c2 = .15 + fist*1.55;
      this.loc(sd + '_Fing1', qZ(-k*c1)); this.loc(sd + '_Fing2', qZ(-k*c2));
      this.loc(sd + '_Thumb', qm(qY(k*(.25 + fist*.55)), qZ(-k*(.1 + fist*.55))));
      return this;
    }
    // jambe : cheville A, genou vers « pole », pied vers « toe » (dessus vers « up »)
    leg(sd, A, pole, toe, up){
      const r = this.r, Hp = this.at(sd + '_UpLeg'), { E: K, W: Ac } = ik2(Hp, A, r.len.thigh, r.len.shin, pole);
      const ut = K.clone().sub(Hp).normalize(), us = Ac.clone().sub(K).normalize();
      let front = us.clone().sub(ut.clone().multiplyScalar(us.dot(ut))).negate(); if (front.lengthSq() < 1e-6) front = pole.clone(); front.normalize();
      this.set(sd + '_UpLeg', qBasis(V3(0, -1, 0), V3(0, 0, 1), ut, front));
      const fs = pole.clone().sub(us.clone().multiplyScalar(pole.dot(us)));
      this.set(sd + '_Leg', qBasis(V3(0, -1, 0), V3(0, 0, 1), us, fs.lengthSq() > 1e-6 ? fs : front));
      const t0 = r.restW[sd + '_Toe'].clone().sub(r.restW[sd + '_Foot']);
      this.set(sd + '_Foot', qBasis(t0, V3(0, 1, 0), toe, up)); this.loc(sd + '_Toe', Q4());
      return this;
    }
    // jambe en rotations (battements) : flexion de hanche (vers l'avant / le bas), genou, pointe du pied, rotation interne
    legFK(sd, hip, knee, ankle, inrot = 0, abd = 0){
      const k = SIDE[sd]; this.loc(sd + '_UpLeg', qm(qX(-hip), qY(k*inrot), qZ(k*abd))); this.loc(sd + '_Leg', qX(knee)); this.loc(sd + '_Foot', qX(ankle)); this.loc(sd + '_Toe', qX(ankle*.25)); return this;
    }
    spine(q0, q1, q2){ this.loc('Spine', q0); this.loc('Spine1', q1); this.loc('Spine2', q2); return this; }
    head(qn, qh, jaw = 0){ this.loc('Neck', qn); this.loc('Head', qh); this.loc('Jaw', qX(jaw)); return this; }
    clav(sd, up, fwd = 0){ const k = SIDE[sd]; this.loc(sd + '_Clav', qm(qZ(k*up), qY(-k*fwd))); return this; }
    apply(){
      const r = this.r, inv = {};
      for (const n of r.names) {
        const b = r.bones[n], p = r.par[n]; if (!this.Q[n]) { this.Q[n] = p ? this.Q[p].clone() : Q4(); }
        if (!p) { b.position.copy(this.P.Hips || r.rest.Hips); b.quaternion.copy(this.Q[n]); }
        else b.quaternion.copy(inv[p] ||= this.Q[p].clone().invert()).multiply(this.Q[n]);
      }
    }
  }
  const lerpQ = (a, b, t) => a.clone().slerp(b, t);
  function blendPose(r, A, B, t){ // mélange de deux poses (transitions)
    const P = new Pose(r); t = clamp(t, 0, 1);
    for (const n of r.names) { const qa = A.Q[n], qb = B.Q[n]; if (qa && qb) P.Q[n] = lerpQ(qa, qb, t); else P.Q[n] = (qa || qb || Q4()).clone(); }
    P.P.Hips = (A.P.Hips || r.rest.Hips).clone().lerp(B.P.Hips || r.rest.Hips, t); return P;
  }

  /* ---------------------------------------------------------------- nage : trajectoire du poignet (bras gauche, repère de nage : x côté, y vers l'avant, z vers le fond) */
  // [phase, poignet / épaule, coude (pôle), normale de la paume, direction des doigts]
  const FREE = [
    [0.00, [-0.02, 0.42, -0.07], [0.40, 0.10, -1.0], [0.45, 0.10, 0.88], [0.0, 0.88, 0.47]],
    [0.12, [0.00, 0.552, 0.08], [0.35, 0.00, -1.0], [0.10, -0.15, 1.0], [0.0, 1.0, 0.12]],
    [0.25, [0.06, 0.45, 0.26], [0.95, 0.15, -0.40], [0.0, -0.70, 0.72], [0.0, 0.25, 0.97]],
    [0.38, [-0.04, 0.17, 0.40], [0.95, 0.00, -0.30], [-0.10, -1.0, 0.15], [0.0, -0.25, 0.97]],
    [0.50, [0.03, -0.13, 0.36], [0.45, -0.25, -0.85], [0.05, -1.0, -0.22], [0.0, -0.80, 0.60]],
    [0.57, [0.08, -0.36, 0.19], [0.30, -0.40, -0.90], [0.30, -0.62, -0.70], [0.10, -0.99, -0.05]],
    [0.63, [0.11, -0.37, 0.00], [0.40, -0.30, -1.0], [-0.70, -0.20, -0.60], [0.15, -0.70, -0.65]],
    [0.73, [0.18, -0.19, -0.19], [0.55, 0.00, -1.0], [-0.40, -0.55, -0.70], [0.10, -0.05, 0.99]],
    [0.83, [0.17, 0.07, -0.29], [0.45, 0.10, -1.0], [-0.20, -0.30, 0.90], [0.0, 0.35, 0.93]],
    [0.93, [0.06, 0.30, -0.22], [0.40, 0.10, -1.0], [0.25, -0.10, 0.95], [0.0, 0.78, 0.60]],
  ];
  const DOG = [ // « chien » : retour des bras sous l'eau, tête hors de l'eau
    [0.00, [0.00, 0.40, 0.12], [0.60, 0.0, -0.8], [0.0, -0.20, 1.0], [0.0, 0.95, 0.30]],
    [0.30, [0.03, 0.22, 0.30], [0.80, 0.0, -0.6], [0.0, -0.70, 0.70], [0.0, 0.20, 1.0]],
    [0.52, [0.00, 0.02, 0.31], [0.70, -0.2, -0.7], [0.0, -1.0, 0.10], [0.0, -0.30, 0.95]],
    [0.76, [-0.02, 0.12, 0.20], [0.50, -0.4, -0.8], [0.0, -0.10, 1.0], [0.0, 0.60, 0.80]],
  ];
  const BACK = [ // dos crawlé (bras gauche ; le perso est sur le dos : z > 0 hors de l'eau)
    [0.00, [0.12, 0.54, -0.06], [0.20, 0.0, -1.0], [1.0, 0.10, -0.10], [0.10, 1.0, -0.10]],
    [0.12, [0.25, 0.41, -0.22], [0.30, 0.0, -1.0], [0.20, -0.80, -0.50], [0.90, 0.30, 0.10]],
    [0.28, [0.36, 0.06, -0.14], [0.00, -0.2, -1.0], [0.00, -1.0, 0.0], [1.0, 0.10, 0.30]],
    [0.42, [0.22, -0.30, -0.16], [0.20, 0.0, -1.0], [0.20, -0.60, -0.80], [0.30, -0.70, -0.30]],
    [0.50, [0.15, -0.42, -0.12], [0.40, 0.0, -1.0], [0.0, 0.0, -1.0], [0.0, -1.0, 0.0]],
    [0.57, [0.14, -0.42, 0.07], [1.0, 0.0, 0.2], [-1.0, 0.0, 0.0], [0.0, -1.0, 0.20]],
    [0.70, [0.06, -0.20, 0.40], [1.0, 0.0, 0.0], [-1.0, 0.0, 0.0], [0.0, -0.30, 1.0]],
    [0.80, [0.02, 0.08, 0.56], [1.0, 0.0, 0.0], [-0.6, 0.0, 0.3], [0.0, 0.20, 1.0]],
    [0.90, [0.07, 0.40, 0.38], [1.0, 0.0, 0.0], [0.7, 0.0, 0.3], [0.0, 0.80, 0.60]],
  ];
  const STREAM = [[-0.035, 0.55, -0.03], [0.6, 0.0, -0.8], [0.1, 0.0, 1.0], [0.0, 1.0, 0.0]]; // bras tendus au-dessus de la tête
  function pathAt(K, ph){ // Catmull-Rom périodique sur des clés à phases non uniformes
    ph = ((ph % 1) + 1) % 1; let i = K.length - 1; while (i > 0 && K[i][0] > ph) i--;
    const n = K.length, p0 = K[(i - 1 + n) % n], p1 = K[i], p2 = K[(i + 1) % n], p3 = K[(i + 2) % n];
    const t0 = p1[0], t1 = i + 1 < n ? p2[0] : 1, t = (ph - t0)/Math.max(t1 - t0, 1e-6);
    const cr = (a, b, c, d) => { const t2 = t*t, t3 = t2*t; return .5*((2*b) + (-a + c)*t + (2*a - 5*b + 4*c - d)*t2 + (-a + 3*b - 3*c + d)*t3); };
    return [1, 2, 3, 4].map(j => V3(cr(p0[j][0], p1[j][0], p2[j][0], p3[j][0]), cr(p0[j][1], p1[j][1], p2[j][1], p3[j][1]), cr(p0[j][2], p1[j][2], p2[j][2], p3[j][2])));
  }
  const mirror = v => V3(-v.x, v.y, v.z);
  const bump = (x, c, w) => { const d = (((x - c) % 1) + 1.5) % 1 - .5; return Math.exp(-(d*d)/(2*w*w)); };

  // nage dans le repère du perso (le root tourne le corps : tête dans le sens de nage, ventre vers le fond)
  // st : style (free | catchup | fist | buoy | paddles | sight | dog | glide | kick), u : cycles de bras écoulés, o : options
  function swimPose(r, st, u, o = {}){
    const P = new Pose(r), S = STYLES[st] || STYLES.free, cyc = ((u % 1) + 1) % 1;
    let phL, phR;
    if (S.catchup) { const a = cyc < .5 ? .12 + cyc*2 : .12, b = cyc >= .5 ? .12 + (cyc - .5)*2 : .12; phL = a; phR = b; }
    else { phL = cyc; phR = cyc + .5; }
    const strokeL = cyc < .5; // pour le rattrapé : bras actif
    const roll = S.catchup ? S.roll*Math.sin(TAU*cyc) : S.back ? -S.roll*Math.sin(TAU*(phL + .0)) : S.roll*Math.sin(TAU*(phL - .10));
    const hipRoll = S.catchup ? S.hip*Math.sin(TAU*(cyc - .03)) : S.back ? -S.hip*Math.sin(TAU*(phL - .04)) : S.hip*Math.sin(TAU*(phL - .14));
    const pitch = (S.pitch || 0) + (o.pitch || 0);
    const kickW = TAU*3*u; // 6 temps
    const bob = Math.sin(kickW)*.006*(S.kick || 0);
    P.hips(r.rest.Hips.clone().add(V3(0, 0, bob)), qm(qX(pitch), qY(-hipRoll)));
    const rr = roll - hipRoll;
    P.spine(qY(-rr*.30), qY(-rr*.35), qm(qY(-rr*.35), qX(S.dog ? -.12 : 0)));
    // respiration (tous les 3 temps, côté du bras en retour) et visée
    let yaw = 0, lift = 0;
    if (S.dog) lift = 1.05;
    else if (S.back) lift = -.12;
    else {
      const stroke = Math.floor(u*2 + .25), side = stroke % 2 ? -1 : 1; // +1 : respiration à droite (bras gauche en traction)
      const every = S.breath || 3, br = stroke % every === every - 1 || S.breath === 1;
      const w = bump(u*2, Math.floor(u*2) + .55, .13);
      if (br && !S.catchup) yaw = side*w*.95;
      if (S.catchup) yaw = (strokeL ? 1 : -1)*bump(cyc*2, .62, .14)*.95*((Math.floor(u) % 2 === 0) === strokeL ? 1 : 0);
      if (S.sight && stroke % S.sight === 0) { const ws = bump(u*2, Math.floor(u*2) + .15, .10); lift = ws*.62; }
    }
    const headRollOnChest = -roll*.15; // la tête reste dans l'axe pendant le roulis
    P.head(qm(qY(-(yaw*.35) + headRollOnChest), qX(-lift*.45)), qm(qY(-(yaw*.65)), qX(-.12 - lift*.55)), o.jaw || (yaw ? Math.abs(yaw)*.28 : 0));
    // bras
    const shoulder = sd => P.at(sd + '_Arm');
    const arm = (sd, ph) => {
      const K = S.dog ? DOG : S.back ? BACK : FREE; let [w, pole, palm, fing] = pathAt(K, ph);
      if (sd === 'R') { w = mirror(w); pole = mirror(pole); palm = mirror(palm); fing = mirror(fing); }
      if (S.paddles) w.multiplyScalar(1.03);
      const reach = S.back ? bump(ph, .02, .10) : bump(ph, .08, .10);
      P.clav(sd, .30*reach + .12, .10*reach);
      const Sh = shoulder(sd), W = Sh.clone().add(w);
      P.arm(sd, W, pole, palm, fing, S.fist ? 1 : (S.dog ? .15 : .05));
    };
    if (st === 'glide' || st === 'kick') {
      for (const sd of ['L', 'R']) { const k = SIDE[sd]; P.clav(sd, .42, .08); const Sh = shoulder(sd);
        P.arm(sd, Sh.clone().add(V3(STREAM[0][0]*k, STREAM[0][1], STREAM[0][2] + (sd === 'L' ? -.012 : .012))), V3(STREAM[1][0]*k, STREAM[1][1], STREAM[1][2]), V3(STREAM[2][0]*k, 0, 1), V3(0, 1, 0), 0); }
    } else { arm('L', phL); arm('R', phR); }
    // jambes : battements 6 temps, jambes serrées au pull-buoy
    const kk = S.kick ?? 1, amp = (S.kickAmp || 1)*(o.kickAmp ?? 1);
    for (const sd of ['L', 'R']) {
      const ph = kickW + (sd === 'L' ? 0 : Math.PI);
      if (kk) { const hip = .06 + .17*amp*Math.sin(ph), knee = .10 + .34*amp*smooth(.5 + .5*Math.sin(ph - 1.25)), ank = 1.0 + .12*Math.sin(ph + .6);
        P.legFK(sd, hip + (S.dog ? .35 : 0), knee + (S.dog ? .25 : 0), ank, .14, -.02); }
      else P.legFK(sd, .02 + .02*Math.sin(ph*.33), .04, 1.05, .16, -.045); // jambes passives, serrées
    }
    return { P, roll, phL, phR, yaw, lift };
  }
  const STYLES = {
    free: { roll: .68, hip: .40, kick: 1, breath: 3 }, catchup: { roll: .55, hip: .34, kick: 1, catchup: 1 }, fist: { roll: .66, hip: .40, kick: 1, breath: 3, fist: 1 },
    buoy: { roll: .78, hip: .50, kick: 0, breath: 3 }, paddles: { roll: .72, hip: .46, kick: 0, breath: 3, paddles: 1 }, sight: { roll: .64, hip: .38, kick: 1, breath: 3, sight: 6 },
    dog: { roll: .08, hip: .05, kick: 1, kickAmp: 1.25, dog: 1, pitch: -.42 }, glide: { roll: 0, hip: 0, kick: 0 }, kick: { roll: 0, hip: 0, kick: 1, kickAmp: 1.1 },
    mix: { roll: .68, hip: .40, kick: 1, breath: 3 }, back: { roll: .62, hip: .38, kick: 1, back: 1 },
  };
  // durée d'un cycle de bras (2 mouvements) selon l'allure et le style
  const cycleOf = (style, pace) => style === 'dog' ? 1.05 : style === 'catchup' ? 2.7 : 1.80*pace/100*(style === 'paddles' ? 1.1 : style === 'fist' ? .92 : 1); // ~1,8 m par cycle

  /* ---------------------------------------------------------------- debout : écoute, parole, présentation, mime penché, mains sur les hanches */
  function standPose(r, t, o = {}){
    const P = new Pose(r), k = o.seed || 0, sway = Math.sin(t*.55 + k)*.012, br = Math.sin(t*1.7 + k);
    const hip = r.rest.Hips.clone().add(V3(sway, -.012 - (o.crouch || 0), (o.hipBack || 0)));
    const bend = o.bend || 0; // mime : buste penché vers l'avant
    P.hips(hip, qm(qY(o.turn || 0), qX(bend*.55), qZ(sway*.6)));
    P.spine(qX(bend*.25 + .01), qX(bend*.22 + br*.008), qX(bend*.17 - .02 + br*.012));
    // regard (point visé dans le repère du perso)
    const look = o.look || V3(0, 1.6, 2), H = P.at('Neck'), d = look.clone().sub(H).applyQuaternion(P.Q.Spine2.clone().invert());
    const yaw = clamp(Math.atan2(d.x, d.z), -1.2, 1.2), pit = clamp(Math.atan2(d.y - .12, Math.hypot(d.x, d.z)), -.8, .9 + bend*.8);
    P.head(qm(qY(yaw*.4), qX(-pit*.35)), qm(qY(yaw*.6), qX(-pit*.65), qZ(o.tilt || 0)), o.jaw || 0);
    // bras
    const arms = o.arms || 'rest', sp = o.speak || 0;
    for (const sd of ['L', 'R']) {
      const s = SIDE[sd], Sh = () => P.at(sd + '_Arm'); let W, pole, palm, fing, fist = .25;
      P.clav(sd, (arms === 'hips' ? .05 : 0) + .02*br, 0);
      if (arms === 'hips') { W = V3(s*.175, 1.0, .01); pole = V3(s, 0, -.4); palm = V3(-s*.2, -.3, -.9); fing = V3(-s*.2, -.95, -.25); fist = .45; }
      else if (arms === 'talk' && (sd === 'R' || sp > .5)) {
        const a = t*2.2 + (sd === 'L' ? 1.7 : 0) + k, g = sp*(.7 + .3*Math.sin(t*.9 + k));
        W = V3(s*(.12 + .04*Math.sin(a*.7)), 1.05 + .08*g + .04*Math.sin(a), .27 + .06*g + .03*Math.sin(a*1.3)); pole = V3(s, -.5, -.5); palm = V3(-s*.6, .6, .1); fing = V3(s*.05, .1, 1); fist = .25;
      } else if (arms === 'present' && sd === (o.hand || 'R')) {
        const tg = (o.at || V3(-s*1, 1.4, 1)).clone(), dir = tg.sub(Sh()).normalize();
        W = Sh().add(dir.clone().multiplyScalar(.50)); pole = V3(s*.6, -1, -.3); palm = V3(dir.z*-s*.3, .55, .3).add(V3(-s*.6, 0, 0)); fing = dir.clone(); fist = .05;
      } else if (arms === 'goggles') { const w = .5 + .5*Math.sin(t*3); W = V3(s*(.055 + .01*w), 1.70 + .005*w, .155); pole = V3(s, -.7, -.2); palm = V3(-s*.25, 0, -1); fing = V3(-s*.25, 1, .15); fist = .35;
      } else if (arms === 'hold' && sd === 'R') { W = V3(s*.12, 1.22, .30); pole = V3(s, -.5, -.3); palm = V3(0, .2, -1); fing = V3(-s*.3, 0, 1); fist = .85; }
      else { const sw = Math.sin(t*.8 + s + k)*.012; W = V3(s*.215, .86 + .01*br, .03 + sw); pole = V3(s*.25, 0, -1); palm = V3(-s, 0, .15); fing = V3(s*.05, -1, .12); fist = .3; }
      if (arms === 'mime') continue;
      P.arm(sd, W, pole, palm, fing, fist);
    }
    if (arms === 'mime') { // le coach mime le geste, penché : la trajectoire de nage dans le repère du buste
      const qs = P.Q.Spine2.clone(), st = STYLES[o.style] || STYLES.free, u = o.u || 0, cyc = ((u % 1) + 1) % 1;
      let phL = cyc, phR = cyc + .5; if (st.catchup) { phL = cyc < .5 ? .12 + cyc*2 : .12; phR = cyc >= .5 ? .12 + (cyc - .5)*2 : .12; }
      const roll = st.catchup ? .25*Math.sin(TAU*cyc) : .30*Math.sin(TAU*(phL - .1));
      const qr = qY(-roll*.6), frame = qs.clone().multiply(qr);
      if (o.style === 'dog') { frame.copy(P.Q.Spine2).multiply(qX(Math.PI/2*.0)); }
      for (const sd of ['L', 'R']) {
        let [w, pole, palm, fing] = pathAt(o.style === 'dog' ? DOG : FREE, sd === 'L' ? phL : phR);
        if (sd === 'R') { w = mirror(w); pole = mirror(pole); palm = mirror(palm); fing = mirror(fing); }
        if (o.style === 'dog') { const sw = q => V3(q.x, -q.z, q.y); w = sw(w); pole = sw(pole); palm = sw(palm); fing = sw(fing); }
        const W = P.at(sd + '_Arm').add(w.clone().multiplyScalar(.93).applyQuaternion(frame));
        P.clav(sd, .18*bump(sd === 'L' ? phL : phR, .08, .1), 0);
        P.arm(sd, W, pole.applyQuaternion(frame), palm.applyQuaternion(frame), fing.applyQuaternion(frame), st.fist ? 1 : .1);
      }
    }
    // jambes : pieds au sol
    for (const sd of ['L', 'R']) {
      const s = SIDE[sd], fp = o.feet?.[sd] || r.restW[sd + '_Foot'].clone().add(V3(s*.01, 0, 0));
      P.leg(sd, fp, V3(s*.12, 0, 1), V3(s*.12, -.42, 1), V3(0, 1, 0));
    }
    return P;
  }

  /* ---------------------------------------------------------------- placement dans le bassin */
  const LANE4 = -7.5 + 3.5*LANE; // couloir 4
  const SPOT = { swimmer: [-1.55, 1.55], coach: [-1.55, 3.05], board: [-2.45, 3.65] }; // (x, z) sur la plage, près du plot 4
  function placeStand(rig, x, z, yaw, y = DECK){ rig.root.position.set(x, y, z); rig.root.quaternion.setFromAxisAngle(V3(0, 1, 0), yaw); rig.root.updateMatrixWorld(true); }
  // corps couché : tête dans la direction « heading », ventre vers le fond ; centre du buste en « c » ; attitude en plus (repère du perso)
  function placeBody(rig, c, heading, att){
    const q = qY(Math.atan2(heading.x, heading.z)).multiply(qX(Math.PI/2)); if (att) q.multiply(att);
    rig.root.quaternion.copy(q); rig.root.position.copy(c).sub(V3(0, 1.20, -.01).applyQuaternion(q)); rig.root.updateMatrixWorld(true);
  }
  const toRig = (rig, p) => { rig.root.updateMatrixWorld(true); return rig.root.worldToLocal(p.clone()); };
  const boneW = (rig, n, v = V3()) => rig.bones[n].getWorldPosition(v);
  const yawTo = (x0, z0, x1, z1) => Math.atan2(x1 - x0, z1 - z0);

  /* ---------------------------------------------------------------- moteur : rendu, boucle */
  let R = null;
  async function buildWorld(el){
    const T = THREE; mathInit();
    const webdriver = !!navigator.webdriver;
    const r = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: webdriver });
    r.setPixelRatio(webdriver ? 1 : Math.min(devicePixelRatio || 1, 1.6)); r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = .80;
    r.shadowMap.enabled = !webdriver; r.shadowMap.type = T.PCFSoftShadowMap;
    el.appendChild(r.domElement);
    const scene = new T.Scene(); scene.background = new T.Color(0xcad9e0);
    const cam = new T.PerspectiveCamera(42, 1, .03, 140);
    const W = { r, scene, cam, el, clockT: 0 };
    R = W;
    buildPool(W);
    W.board.group.position.set(SPOT.board[0], DECK, SPOT.board[1]); W.board.group.rotation.y = yawTo(SPOT.board[0], SPOT.board[1], SPOT.swimmer[0] + .5, SPOT.swimmer[1] + .4);
    // lumières : soleil du matin par les baies, ciel, plafonniers
    const hemi = new T.HemisphereLight(0xc4dbe8, 0x5f4e40, .34); scene.add(hemi);
    const sun = new T.DirectionalLight(0xffe0bd, 2.05); sun.position.set(-4, 13, -15); sun.target.position.set(0, 0, 2); scene.add(sun, sun.target);
    sun.castShadow = !webdriver; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 2, far: 40 }); sun.shadow.bias = -.0006; sun.shadow.normalBias = .02;
    const fill = new T.DirectionalLight(0xcfe0ff, .32); fill.position.set(10, 12, 9); scene.add(fill);
    W.sun = sun;
    // reflets de la halle (cube) pour l'eau et l'éclairage d'ambiance
    const crt = new T.WebGLCubeRenderTarget(256, { encoding: T.sRGBEncoding, generateMipmaps: true, minFilter: T.LinearMipmapLinearFilter });
    const cc = new T.CubeCamera(.1, 80, crt); cc.position.set(12.5, 1.2, 0); W.water.visible = false; cc.update(r, scene); W.water.visible = true;
    W.water.material.uniforms.uEnv.value = crt.texture;
    const pm = new T.PMREMGenerator(r); scene.environment = pm.fromCubemap(crt.texture).texture; pm.dispose();
    scene.traverse(o => { const m = o.material; if (m && m.isMeshStandardMaterial) m.envMapIntensity = .62; });
    W.fx = particles(scene, softDot());
    // personnages
    const gl = await loadChars(); gl.userData.nag ||= gl.scene.getObjectByName('Nageur'); gl.userData.coa ||= gl.scene.getObjectByName('Coach');
    W.swimmer = setupChar(W, gl.userData.nag, 'N_', { skin: 0xc98d6b, cap: 0xff7a35, suit: 0x0b1530 });
    W.coach = setupChar(W, gl.userData.coa, 'C_', { skin: 0xb98260, shirt: 0x143a7a, suit: 0x101317 });
    // le coach emprunte le pull-buoy et les plaquettes du nageur pour ses démonstrations
    W.gear = {};
    for (const [k, bone] of [['pull_buoy', 'Hips'], ['plaquette_L', 'L_Hand'], ['sangle_L', 'L_Hand'], ['plaquette_R', 'R_Hand'], ['sangle_R', 'R_Hand']]) {
      const src = W.swimmer.acc[k]; if (!src || W.coach.acc[k]) continue; const c = src.clone(); c.name = 'C_' + k; W.coach.bones[bone].add(c); W.coach.acc[k] = c; }
    show(W.swimmer, /pull_buoy|plaquette|sangle/, false); show(W.coach, /pull_buoy|plaquette|sangle|lunettes/, false);
    W.ripN = 0;
    return W;
  }
  function resize(){ if (!R) return; const w = R.el.clientWidth || innerWidth, h = R.el.clientHeight || innerHeight; R.r.setSize(w, h, false); R.r.domElement.style.width = '100%'; R.r.domElement.style.height = '100%'; R.cam.aspect = w/h; R.cam.updateProjectionMatrix(); }
  function ripple(x, z, a = 1){ if (!R) return; const u = R.water.material.uniforms.uRip.value[R.ripN = (R.ripN + 1) % 16]; u.set(x, z, U.time.value, .02*a); }
  function setClocks(t){ for (const g of R.clocks) { const s = t % 60, m = (t/60) % 60; g.userData.red.rotation.z = -s/60*TAU; g.userData.blk.rotation.z = -m/60*TAU; } }
  function drawBoard(P, hi = -1){
    const c = R.board.canvas, g = c.getContext('2d'), w = c.width, h = c.height;
    g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, w, h); g.fillStyle = '#e9ecef'; g.fillRect(0, 0, w, 150);
    g.fillStyle = '#0f2f4f'; g.font = 'bold 54px Inter, Arial'; g.fillText(P.name.slice(0, 30), 50, 95);
    g.font = '36px Inter, Arial'; g.fillStyle = '#556'; g.fillText(`CSS ${fmtP(P.css)} /100 m · bassin 25 m`, 50, 200);
    let y = 290;
    P.blocks.forEach((b, i) => {
      if (i === hi) { g.fillStyle = 'rgba(255,214,0,.55)'; g.fillRect(30, y - 58, w - 60, 92); }
      g.fillStyle = '#16202a'; g.font = 'bold 50px Inter, Arial'; g.fillText(b.n > 1 ? `${b.n} × ${b.d}` : `${b.d}`, 50, y);
      g.font = '38px Inter, Arial'; g.fillStyle = '#2a3540'; g.fillText((b.drill && b.kind === 'drill' ? DRILLS[b.drill].name : b.l).slice(0, 26), 300, y - 8);
      g.font = '30px Inter, Arial'; g.fillStyle = '#c0392b'; g.fillText(`${fmtP(b.pace)}/100${b.dep ? ` · départ ${fmtP(b.dep)}` : b.r ? ` · r ${b.r}"` : ''}`, 300, y + 26);
      y += Math.min(130, (h - 420)/Math.max(P.blocks.length, 1));
    });
    g.fillStyle = '#0f2f4f'; g.font = 'bold 44px Inter, Arial'; g.fillText(`Total ${P.total} m · ~${Math.round(P.sec/60)} min`, 50, h - 70);
    g.strokeStyle = '#19c3c9'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
    R.board.tex.needsUpdate = true;
  }

  /* ---------------------------------------------------------------- caméra */
  const CAM = { p: null, t: null, fov: 42, shake: 0 };
  function camSet(p, t, fov){ CAM.p = p.clone(); CAM.t = t.clone(); CAM.fov = fov || CAM.fov; }
  function camApply(now){
    const c = R.cam, s = CAM.shake; c.position.copy(CAM.p); if (s) c.position.add(V3(Math.sin(now*1.3)*s, Math.sin(now*1.7 + 1)*s*.7, Math.sin(now*.9 + 2)*s));
    c.fov = CAM.fov; c.updateProjectionMatrix(); c.lookAt(CAM.t);
    const under = c.position.y < -.004; U.camUnder.value = under ? 1 : 0;
    if (R.shafts) { R.shafts.visible = under; if (under) R.shafts.children.forEach(m => { m.material.opacity = .05 + .045*Math.sin(now*.8 + m.userData.ph); }); }
    R.scene.fog = under ? (R.fogU ||= new THREE.FogExp2(0x0d6f86, .12)) : null;
    R.scene.background.set(under ? 0x0d6f86 : 0xdfe9ee);
  }

  /* ---------------------------------------------------------------- poses dans le monde */
  // nageur couché dans son couloir : x le long du bassin, dir = ±1, profondeur du buste
  function swimAt(rig, st, u, x, z, dir, o = {}){
    const s = swimPose(rig, st, u, o);
    const att = o.att || (st === 'dog' ? qX(-.32) : st === 'back' ? qY(Math.PI).multiply(qX(.06)) : st === 'glide' || st === 'kick' ? qX(.03) : null);
    placeBody(rig, V3(x, o.depth ?? (st === 'dog' ? -.20 : -.095), z), V3(dir, 0, 0), att);
    s.P.apply(); rig.root.updateMatrixWorld(true); return s;
  }
  function standAt(rig, x, z, yaw, t, o = {}){
    placeStand(rig, x, z, yaw, o.y ?? DECK);
    if (o.lookW) o.look = toRig(rig, o.lookW);
    if (o.atW) o.at = toRig(rig, o.atW);
    const P = standPose(rig, t, o); P.apply(); rig.root.updateMatrixWorld(true); return P;
  }
  const wetness = (rig, w) => { rig.wet = w; const m = rig.mats; if (m.skin) m.skin.roughness = lerp(.52, .24, w); if (m.suit) m.suit.roughness = lerp(.42, .2, w); if (m.shirt) m.shirt.roughness = lerp(.62, .3, w); if (m.hair) m.hair.roughness = lerp(.9, .45, w); };

  /* ---------------------------------------------------------------- plongeon, virage, repos au mur, poussée */
  const BLOCK_TOP = DECK + .69;
  function diveAt(rig, tau, z){
    // trajectoire du bassin (hanches) et assiette du corps (0 debout, π/2 couché tête devant, > π/2 tête vers le bas)
    let hp, pitch, mode;
    if (tau < 1.2) { const k = smooth(tau/1.2); hp = V3(-.47 + .02*k, BLOCK_TOP + .80 - .05*k, z); pitch = .95 + .18*k; mode = 'ready'; }
    else if (tau < 1.55) { const k = (tau - 1.2)/.35; hp = V3(lerp(-.45, .10, ease(k)), lerp(BLOCK_TOP + .75, BLOCK_TOP + .52, k), z); pitch = lerp(1.13, 1.30, k); mode = 'drive'; }
    else if (tau < 2.15) { const t = tau - 1.55; hp = V3(.10 + 4.2*t, BLOCK_TOP + .52 + 1.0*t - 4.9*t*t, z); pitch = lerp(1.30, 2.05, smooth(t/.6)); mode = 'flight'; }
    else if (tau < 3.3) { const t = tau - 2.15, v0 = 4.2, x = .10 + 4.2*.6 + v0*t - .9*t*t; const y = -.55*Math.sin(Math.min(t/1.15, 1)*Math.PI*.85) - .05; hp = V3(x, y, z); pitch = lerp(2.05, 1.45, smooth(t/1.0)); mode = 'glide'; }
    else { const t = tau - 3.3, x = .10 + 2.52 + 4.2*1.15 - .9*1.15*1.15 + 1.7*t; hp = V3(x, lerp(-.48, -.14, smooth(t/1.3)), z); pitch = lerp(1.45, 1.57, smooth(t/1.0)); mode = 'kick'; }
    const q = qY(Math.PI/2).multiply(qX(pitch));
    rig.root.quaternion.copy(q); rig.root.position.copy(hp).sub(rig.restW.Hips.clone().applyQuaternion(q)); rig.root.updateMatrixWorld(true);
    let P;
    if (mode === 'ready' || mode === 'drive') {
      const k = mode === 'drive' ? smooth((tau - 1.2)/.35) : 0;
      P = new Pose(rig).hips(rig.restW.Hips.clone(), Q4());
      P.spine(qX(.12 - .1*k), qX(.12 - .1*k), qX(.10 - .08*k)); P.head(qX(.25 - .2*k), qX(.35 - .35*k));
      for (const sd of ['L', 'R']) {
        const s = SIDE[sd], grip = toRig(rig, V3(-.08, BLOCK_TOP - .015, z + s*.11));
        if (mode === 'ready') P.arm(sd, grip, toRig(rig, V3(-.6, BLOCK_TOP + 1.2, z + s*.6)).sub(P.at(sd + '_Arm')), toRig(rig, V3(-.08, BLOCK_TOP - 1, z)).sub(grip).normalize(), toRig(rig, V3(.2, BLOCK_TOP - .6, z)).sub(grip).normalize(), .7);
        else { const Sh = P.at(sd + '_Arm'); P.clav(sd, .3*k, .1*k); P.arm(sd, Sh.clone().add(V3(-s*.03, lerp(-.2, .55, k), lerp(.35, -.03, k))), V3(s*.6, 0, -.8), V3(s*.1, 0, 1), V3(0, lerp(-.2, 1, k), lerp(1, 0, k)), 0); }
        const front = sd === 'L', fx = front ? -.20 : -.48, lift = mode === 'drive' ? smooth((tau - 1.38)/.17) : 0;
        const foot = toRig(rig, V3(fx + lift*.3, BLOCK_TOP + .02 + lift*.25, z + s*.09));
        const knee = V3(1, -.2, 0).applyQuaternion(rig.root.quaternion.clone().invert());
        P.leg(sd, foot, knee, toRig(rig, V3(fx + .3, BLOCK_TOP - .05, z + s*.09)).sub(foot).normalize(), toRig(rig, V3(fx, BLOCK_TOP + 1, z)).sub(foot).normalize());
      }
    } else P = swimPose(rig, mode === 'kick' ? 'kick' : 'glide', tau*1.2, { kickAmp: mode === 'kick' ? 1 : 0 }).P;
    P.apply(); rig.root.updateMatrixWorld(true);
    return { mode, hp };
  }
  // repos au mur : debout dans l'eau, une main sur la goulotte, regard vers la pendule
  function restAt(rig, wallX, z, t, o = {}){
    const inward = wallX < 1 ? 1 : -1, yaw = inward > 0 ? -Math.PI/2 : Math.PI/2; // face au mur
    placeStand(rig, wallX + inward*.34, z, yaw, -1.60 + Math.sin(t*1.3)*.012);
    const P = new Pose(rig).hips(rig.restW.Hips.clone().add(V3(0, 0, -.06)), qX(-.10));
    const heave = Math.sin(t*2.6)*.03*(o.puff ?? 1);
    P.spine(qX(.05), qX(.04 + heave*.5), qX(-.04 + heave));
    const clk = toRig(rig, V3(3.0, 2.5, 11.9)), H = P.at('Neck'), d = clk.sub(H);
    const look = o.lookClock ? 1 : .25, yw = clamp(Math.atan2(d.x, d.z), -1.3, 1.3)*look;
    P.head(qY(yw*.4), qm(qY(yw*.6), qX(-.15*look)));
    for (const sd of ['L', 'R']) {
      const s = SIDE[sd], edge = toRig(rig, V3(wallX + inward*.02, DECK - .03, z + s*(sd === 'L' ? .24 : .30)));
      if (sd === 'L' || o.twoHands) P.arm(sd, edge, V3(s, -.2, -.6), V3(0, -1, .3), V3(0, .2, 1), .65);
      else { const Sh = P.at(sd + '_Arm'); P.arm(sd, Sh.clone().add(V3(s*.18, -.42, .2 + .05*Math.sin(t*1.7))), V3(s, 0, -.5), V3(0, -1, .2), V3(0, -.3, 1), .2); }
      const ph = t*3.2 + (sd === 'L' ? 0 : Math.PI);
      P.legFK(sd, .25 + .12*Math.sin(ph), .45 + .15*Math.sin(ph + 1), .6, .1, .05);
    }
    P.apply(); rig.root.updateMatrixWorld(true);
  }
  // virage culbute : p de 0 à 1 (fin de longueur → retournement → pieds au mur → poussée sur le dos puis vrille)
  function turnAt(rig, p, wallX, z, dir, u, toBack = false){
    const tuck = smooth(p/.25)*(1 - smooth((p - .62)/.18)), spin = Math.PI*ease(clamp((p - .12)/.48, 0, 1));
    const twist = toBack ? 0 : Math.PI*ease(clamp((p - .66)/.34, 0, 1));
    const after = p > .5 ? -dir : dir; // direction de nage après le mur
    const xc = p < .55 ? wallX - dir*lerp(1.25, .62, ease(p/.55)) : wallX + after*lerp(.62, 2.0, ease((p - .55)/.45));
    const depth = p < .55 ? lerp(-.16, -.50, smooth(p/.55)) : lerp(-.50, -.36, smooth((p - .55)/.45));
    const qBase = qY(Math.atan2(dir, 0)).multiply(qX(Math.PI/2)).multiply(qX(spin)); // culbute autour de l'axe des épaules
    const q = p > .55 ? qY(Math.atan2(-dir, 0)).multiply(qX(Math.PI/2)).multiply(qY(Math.PI - twist)) : qBase;
    rig.root.quaternion.copy(q); rig.root.position.copy(V3(xc, depth, z)).sub(V3(0, 1.20, -.01).applyQuaternion(q)); rig.root.updateMatrixWorld(true);
    const A = swimPose(rig, p < .3 ? 'free' : toBack && p > .82 ? 'back' : 'glide', u, { kickAmp: .5 }).P;
    const B = new Pose(rig).hips(rig.restW.Hips.clone(), qX(tuck*.55));
    B.spine(qX(tuck*.30), qX(tuck*.28), qX(tuck*.2)); B.head(qX(tuck*.35), qX(tuck*.4));
    for (const sd of ['L', 'R']) { const s = SIDE[sd], Sh = B.at(sd + '_Arm');
      if (p < .55) B.arm(sd, Sh.clone().add(V3(s*.12, -.42, .18)), V3(s, 0, -.6), V3(-s, 0, .3), V3(0, -.6, .8), .2);
      else { B.clav(sd, .4, .08); B.arm(sd, Sh.clone().add(V3(-s*.035, .55, -.02)), V3(s*.6, 0, -.8), V3(s*.1, 0, 1), V3(0, 1, 0), 0); }
      const push = smooth((p - .6)/.2); B.legFK(sd, lerp(1.55, .05, push)*Math.max(tuck, 1 - push), lerp(2.1, .05, push)*Math.max(tuck, 1 - push), 1.0, .1, 0); }
    const P = p < .1 ? blendPose(rig, A, B, p/.1) : p > .82 ? blendPose(rig, B, A, (p - .82)/.18) : B;
    P.apply(); rig.root.updateMatrixWorld(true);
  }
  // départ du mur après une récup : p de 0 à 1 (on coule, on se retourne, poussée, coulée)
  function pushAt(rig, p, wallX, z, dir, u){
    const after = dir, inward = wallX < 1 ? 1 : -1;
    const k = ease(clamp(p/.5, 0, 1)), k2 = ease(clamp((p - .45)/.55, 0, 1));
    const qStand = qY(inward > 0 ? -Math.PI/2 : Math.PI/2), qProne = qY(Math.atan2(after, 0)).multiply(qX(Math.PI/2)).multiply(qY(-Math.PI/2*(1 - k2)));
    const q = qStand.clone().slerp(qProne, k);
    const c = V3(wallX + inward*lerp(.34, .55, k) + after*lerp(0, 2.2, k2), lerp(-.25, -.48, k) + .2*k2, z);
    rig.root.quaternion.copy(q); rig.root.position.copy(c).sub(V3(0, 1.20, -.01).applyQuaternion(q)); rig.root.updateMatrixWorld(true);
    const A = new Pose(rig).hips(rig.restW.Hips.clone(), qX(.5*k*(1 - k2)));
    A.spine(qX(.2*k*(1 - k2)), qX(.15*k*(1 - k2)), Q4()); A.head(qX(.2*(1 - k2)), qX(.25*(1 - k2)));
    for (const sd of ['L', 'R']) { const s = SIDE[sd], Sh = A.at(sd + '_Arm'); A.clav(sd, .4*k2, .08*k2);
      A.arm(sd, Sh.clone().add(V3(lerp(s*.2, -s*.035, k2), lerp(.1, .55, k2), lerp(.3, -.02, k2))), V3(s*.6, 0, -.8), V3(s*.1, 0, 1), V3(0, lerp(.2, 1, k2), lerp(1, 0, k2)), 0);
      A.legFK(sd, lerp(1.3, .05, k2)*k + .2*(1 - k), lerp(1.9, .05, k2)*k + .4*(1 - k), 1.0, .1, 0); }
    const P = p > .8 ? blendPose(rig, A, swimPose(rig, 'glide', u).P, (p - .8)/.2) : A;
    P.apply(); rig.root.updateMatrixWorld(true);
  }

  /* ---------------------------------------------------------------- voix du coach, sons de la piscine */
  const Voice = { on: true, ok: typeof speechSynthesis !== 'undefined', v: null, jaw: 0, lastSpeak: 0 };
  function pickVoice(){
    if (!Voice.ok) return null; const vs = speechSynthesis.getVoices().filter(v => /^fr/i.test(v.lang));
    return vs.find(v => /fr.FR/i.test(v.lang) && /thomas|daniel|henri|paul|nicolas|mathieu|antoine|male|homme/i.test(v.name)) || vs.find(v => /fr.FR/i.test(v.lang)) || vs[0] || null;
  }
  function speak(text){
    const h = { done: false, t: 0, est: Math.max(1.8, String(text).split(/\s+/).length*.37 + .5) };
    if (!Voice.on || !Voice.ok || navigator.webdriver) { h.timed = true; return h; }
    try { if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(spoken(text)); u.lang = 'fr-FR'; Voice.v ||= pickVoice(); if (Voice.v) u.voice = Voice.v;
      u.rate = 1.03; u.pitch = .92; u.onboundary = () => { Voice.jaw = 1; }; u.onstart = () => { h.started = true; }; u.onend = u.onerror = () => { h.done = true; };
      speechSynthesis.speak(u); h.u = u; } catch (e) { h.timed = true; }
    return h;
  }
  const Snd = { ctx: null };
  function sndInit(){
    if (Snd.ctx) return; try { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; const c = Snd.ctx = new C();
      Snd.master = c.createGain(); Snd.master.gain.value = Voice.on ? .55 : 0; Snd.master.connect(c.destination);
      const n = c.sampleRate*3, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0); let last = 0;
      for (let i = 0; i < n; i++) { last = (last + .025*(Math.random()*2 - 1))/1.025; d[i] = last*3; }
      const src = c.createBufferSource(); src.buffer = buf; src.loop = true; Snd.lp = c.createBiquadFilter(); Snd.lp.type = 'lowpass'; Snd.lp.frequency.value = 1100;
      const g = c.createGain(); g.gain.value = .28; src.connect(Snd.lp).connect(g).connect(Snd.master); src.start();
      Snd.noise = c.createBuffer(1, c.sampleRate*.4, c.sampleRate); const e = Snd.noise.getChannelData(0); for (let i = 0; i < e.length; i++) e[i] = Math.random()*2 - 1;
    } catch (e) { Snd.ctx = null; } }
  function sndSplash(k = 1){
    if (!Snd.ctx || Snd.ctx.state !== 'running') return; const c = Snd.ctx, t = c.currentTime, s = c.createBufferSource(); s.buffer = Snd.noise;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = (U.camUnder.value ? 380 : 1300) + Math.random()*700; f.Q.value = .9;
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.22*k, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + .22 + .1*k);
    s.connect(f).connect(g).connect(Snd.master); s.start(t); s.stop(t + .4);
  }
  function sndWhistle(){
    if (!Snd.ctx) return; const c = Snd.ctx, t = c.currentTime, g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.16, t + .02); g.gain.setValueAtTime(.16, t + .42); g.gain.linearRampToValueAtTime(0, t + .5); g.connect(Snd.master);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 32; lg.gain.value = 60; lfo.connect(lg);
    for (const fq of [2850, 3120]) { const o = c.createOscillator(); o.frequency.value = fq; lg.connect(o.frequency); o.connect(g); o.start(t); o.stop(t + .52); } lfo.start(t); lfo.stop(t + .52);
  }
  const sndUnder = u => { if (Snd.lp) Snd.lp.frequency.value = u ? 320 : 1100; };
  const sndMute = () => { if (Snd.master) Snd.master.gain.value = Voice.on ? .55 : 0; if (!Voice.on && Voice.ok) try { speechSynthesis.cancel(); } catch (e) {} };

  /* ---------------------------------------------------------------- la séance en accéléré : longueurs, virages, récups */
  function buildSim(P){
    const segs = []; let t = 0, x = 0, dir = 1;
    P.blocks.forEach((b, bi) => {
      for (let r = 0; r < b.n; r++) {
        const L = Math.max(1, Math.round(b.d/POOL)), lt = b.swim/L;
        for (let j = 0; j < L; j++) { segs.push({ type: 'len', b: bi, r, j, L, t0: t, dur: lt, x0: x, dir, style: b.style === 'mix' ? (j % 2 ? 'back' : 'free') : b.style, turn: j < L - 1, fromRest: j === 0 });
          t += lt; x = dir > 0 ? POOL : 0; dir = -dir; }
        const rest = b.r || (r === b.n - 1 && bi < P.blocks.length - 1 ? 20 : 0);
        if (rest || (r === b.n - 1 && bi === P.blocks.length - 1)) { segs.push({ type: 'rest', b: bi, r, t0: t, dur: rest || 30, x, dir, last: bi === P.blocks.length - 1 && r === b.n - 1 }); t += rest || 30; }
      }
    });
    return { segs, total: t };
  }
  const segAt = (sim, T) => { let lo = 0, hi = sim.segs.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (sim.segs[m].t0 <= T) lo = m; else hi = m - 1; } return sim.segs[lo]; };

  /* ---------------------------------------------------------------- réalisateur : plans enchaînés sur le script */
  const D = { on: false };
  const AW = () => V3(SPOT.swimmer[0], DECK, SPOT.swimmer[1]), CW = () => V3(SPOT.coach[0], DECK, SPOT.coach[1]);
  const head = (p, h = 1.66) => V3(p.x, p.y + h, p.z);
  // plans fixes (avec un léger mouvement) : [position, cible, fov]
  const SHOT = {
    establish: k => [V3(lerp(17, 4.5, k), lerp(3.4, 2.2, k), lerp(-6.5, -2.4, k)), V3(lerp(-1.0, -1.6, k), 1.0, 2.2), 44],
    two: k => [V3(-4.5 + .25*k, 1.62, -.95 + .2*k), V3(-1.55, 1.3, 2.3), 40],
    ots: k => [V3(-1.27 - .04*k, 1.86, 1.02 + .05*k), head(CW(), 1.55), 33],
    cu: k => [V3(-1.18, 1.70, 1.62 - .06*k), head(CW(), 1.45), 34],
    rev: k => [V3(-1.80 + .05*k, 1.88, 3.55), head(AW(), 1.55), 31],
    board: k => [V3(-1.05 - .05*k, 1.58, 1.25), V3(-2.15, 1.32, 3.35), 42],
    mime: k => [V3(.15 - .1*k, 1.45, 1.35 + .1*k), V3(-1.55, 1.12, 3.05), 48],
    pool: k => [V3(-2.75 + .1*k, 1.95, 4.0), V3(1.5, .25, 1.6), 50],
    clock: k => [V3(1.2, 1.75 + .05*k, 5.6), V3(2.9, 2.3, 11.9), 40],
  };
  function beatsOf(P){
    const B = [], L = P.lines; let k = 0;
    const add = o => B.push(o);
    for (const ln of L.filter(l => l.act === 'intro')) add({ ch: 0, line: ln, shot: ['two', 'ots', 'cu'][k++ % 3], coach: 'talk' });
    for (const b of P.blocks) {
      const ls = L.filter(l => l.b === b), ch = b.i + 1;
      for (const ln of ls) {
        if (ln.act === 'block') add({ ch, line: ln, shot: ls.indexOf(ln) === 0 ? 'board' : 'ots', coach: ls.indexOf(ln) === 0 ? 'present' : 'talk', hi: b.i });
        else if (ln.act === 'mime') add({ ch, line: ln, shot: 'mime', coach: 'mime', style: DRILLS[b.drill].style, hi: b.i, min: 2*cycleOf(DRILLS[b.drill].style, b.pace)/ .8 });
        else if (ln.act === 'demo') add({ ch, line: ln, shot: 'pool', coach: 'presentPool', hi: b.i, demoStart: true, b });
        else if (ln.act === 'cue') add({ ch, line: ln, demo: true, cue: ln.k, style: DRILLS[b.drill].style, b, slow: ln.k < 2 ? .42 : 1, cam: ['uwSide', 'uwFront', 'awSide'][ln.k], min: ln.k < 2 ? 3.4 : 2.6 });
        else if (ln.act === 'clock') add({ ch, line: ln, shot: 'clock', coach: 'presentClock', hi: b.i });
      }
    }
    const out = L.find(l => l.act === 'outro'); add({ ch: P.blocks.length + 1, line: out, shot: 'rev', coach: 'talk', goggles: true });
    add({ ch: P.blocks.length + 1, dive: true, min: 5.6 });
    add({ ch: P.blocks.length + 2, sim: true });
    add({ ch: P.blocks.length + 3, end: true });
    return B;
  }
  function start(){
    D.i = -1; D.t = 0; D.paused = false; D.state = 'beats'; D.u = { coach: 0, swim: 0 }; D.demo = null; D.simT = 0; D.speedSel = 0; next();
  }
  function goto(i){ D.i = clamp(i, 0, D.beats.length - 1) - 1; next(); }
  function next(){
    D.i++; D.t = 0; D.say = null; const b = D.beats[D.i]; if (!b) return;
    if (b.line) { D.say = speak(b.line.t); subtitle(b.line.t); } else subtitle('');
    if (b.hi != null) drawBoard(D.P, b.hi);
    if (b.demoStart || (b.demo && !D.demo)) D.demo = { x: 2.4, u: 0, b: b.b }; if (!b.demo && !b.demoStart) D.demo = null;
    cues(b.demo ? DRILLS[b.b.drill] : null, b.cue);
    if (b.dive) { D.dive = { t: 0 }; sndWhistle(); subtitle(''); }
    if (b.sim) { D.sim = buildSim(D.P); D.simT = 8/(100/D.P.blocks[0].pace); D.simShot = -1; D.lastB = -1; hud(true); } else hud(false);
    if (b.end) endCard(); else card(null);
    D.el.querySelector('[data-a="prev"]').disabled = D.i === 0;
  }
  const chapterStart = ch => D.beats.findIndex(b => b.ch === ch);
  function skip(dir){ const ch = D.beats[D.i]?.ch ?? 0, tgt = dir > 0 ? ch + 1 : (D.t > 1.5 ? ch : ch - 1); const i = chapterStart(clamp(tgt, 0, D.beats[D.beats.length - 1].ch)); if (Voice.ok) try { speechSynthesis.cancel(); } catch (e) {} goto(i < 0 ? D.beats.length - 1 : i); }
  function beatDone(b){
    if (b.end) return false;
    if (b.sim) return D.simT >= D.sim.total;
    const min = (b.min || 0)/(D.rate || 1);
    if (b.dive) return D.t >= min;
    const s = D.say; if (!s) return D.t >= Math.max(min, 1);
    const spokeOk = s.timed ? D.t*(D.rate || 1) >= s.est : s.done || D.t > s.est*1.9 + 3 || (!s.started && D.t > 2.5 && D.t*(D.rate || 1) >= s.est);
    return spokeOk && D.t >= min + .25;
  }

  // une image : tout le monde bouge selon le plan en cours
  function frame(dt, now){
    const b = D.beats[D.i]; if (!b && D.state === 'beats') return;
    const W = R, sw = W.swimmer, co = W.coach;
    Voice.jaw = Math.max(0, Voice.jaw - dt*5);
    const speaking = D.say && !D.say.done && !(D.say.timed && D.t*(D.rate || 1) >= D.say.est);
    const jaw = speaking ? (D.say.timed || !D.say.started ? .10 + .10*Math.max(0, Math.sin(now*17)) : .06 + Voice.jaw*.16) : 0;
    let slow = 1, under = false;
    if (D.state === 'intro') { // plan d'ensemble avant « Faire la séance »
      const k = (now*.04) % 1;
      standAt(co, ...SPOT.coach, Math.PI, now, { arms: 'rest', lookW: head(AW(), 1.55) }); standAt(sw, ...SPOT.swimmer, 0, now, { arms: 'hips', lookW: head(CW(), 1.6), seed: 2 });
      const [p, t, f] = SHOT.establish(smooth(k*2)); camSet(p, t, f);
    } else if (b.sim) under = simFrame(dt, now);
    else if (b.dive) {
      D.dive.t += dt*(D.rate || 1); const tau = D.dive.t, sl = tau > 1.45 && tau < 2.35 ? .45 : 1; D.dive.tt = (D.dive.tt || 0) + dt*sl;
      const d = diveAt(sw, D.dive.tt, LANE4); wetness(sw, d.mode === 'glide' || d.mode === 'kick' ? 1 : 0);
      if (d.mode === 'glide' && !D.dive.spl) { D.dive.spl = 1; W.fx.splash(d.hp.x + .6, LANE4, 1.6, 0); ripple(d.hp.x + .6, LANE4, 3); sndSplash(1.6); }
      if (d.mode === 'glide' || d.mode === 'kick') { const hw = boneW(sw, 'Head'); if (Math.random() < .5) W.fx.bubbles(hw.x, hw.y, hw.z, 2, .1); }
      standAt(co, -1.1, LANE4 + 1.7, -2.4, now, { arms: 'hips', lookW: d.hp.clone() });
      const tt = D.dive.tt;
      if (tt < 1.5) camSet(V3(1.6, 1.05, LANE4 - 3.4), V3(.1, .85, LANE4), 44);
      else if (tt < 2.2) camSet(V3(1.6 + (tt - 1.5)*.6, 1.0, LANE4 - 3.4), V3(d.hp.x, .5, LANE4), 46);
      else { camSet(V3(d.hp.x - .6, -.55, LANE4 - 2.0), V3(d.hp.x + .4, -.35, LANE4), 50); }
      slow = sl;
    } else if (b.demo) { // le coach nage l'éducatif, au ralenti, vu sous l'eau
      const dm = D.demo, B0 = dm.b, st = b.style, pace = B0.pace + 18, v = 100/pace*(st === 'catchup' ? .8 : st === 'dog' ? .55 : 1);
      slow = b.slow; const dts = dt*slow*(D.rate || 1);
      dm.x = Math.min(dm.x + v*dts, 16); dm.u += dts/cycleOf(st, pace);
      show(co, /lunettes/, true); show(co, /sifflet|cordon/, false); show(co, /pull_buoy/, !!B0.gear.buoy); show(co, /plaquette|sangle/, !!B0.gear.paddles);
      const s = swimAt(co, st, dm.u, dm.x, LANE4, 1, {}); wetness(co, 1); strokeFx(co, s, 'coach', true);
      const wl = boneW(co, 'L_Hand'), wr = boneW(co, 'R_Hand'); if (slow < 1) { W.fx.trail(wl); W.fx.trail(wr, [.1, .85, .9]); }
      standAt(sw, -.5, LANE4 - 1.2, Math.PI/2 + .3, now, { arms: 'hips', lookW: V3(dm.x, 0, LANE4) });
      const x = dm.x, c = b.cam;
      if (c === 'uwSide') camSet(V3(x + 2.25, -.58, LANE4 - 2.55), V3(x + .3, -.3, LANE4), 50); // trois-quarts avant, sous l'eau : tout le corps tient dans l'écran
      else if (c === 'uwFront') camSet(V3(x + 2.7, -.72, LANE4 + .6), V3(x + .2, -.25, LANE4), 48);
      else camSet(V3(x + 1.1, .95, LANE4 - 2.3), V3(x + .3, -.05, LANE4), 44);
    } else { // sur la plage : le coach parle, présente le tableau, mime ; le nageur écoute
      show(co, /lunettes|pull_buoy|plaquette|sangle/, false); show(co, /sifflet|cordon/, true); wetness(co, Math.max(0, co.wet - dt*.08));
      const ca = b.coach, o = { look: null, lookW: head(AW(), 1.55), jaw, speak: speaking ? 1 : .2, seed: 1 };
      if (ca === 'talk') o.arms = 'talk';
      else if (ca === 'present') { o.arms = 'present'; o.hand = 'L'; o.atW = V3(SPOT.board[0], 1.4, SPOT.board[1]); o.lookW = D.t % 4 < 2.2 ? V3(SPOT.board[0], 1.35, SPOT.board[1]) : head(AW(), 1.55); }
      else if (ca === 'presentPool') { o.arms = 'present'; o.hand = 'R'; o.atW = V3(1.5, .2, LANE4); o.lookW = V3(2, .3, LANE4); }
      else if (ca === 'presentClock') { o.arms = 'present'; o.hand = 'R'; o.atW = V3(3.0, 2.5, 11.9); o.lookW = V3(3.0, 2.5, 11.9); }
      else if (ca === 'mime') { o.arms = 'mime'; o.style = b.style; D.u.coach += dt/cycleOf(b.style, 115)*.8; o.u = D.u.coach; o.bend = b.style === 'dog' ? .1 : .95; o.hipBack = b.style === 'dog' ? 0 : -.07; o.lookW = head(AW(), 1.5); }
      standAt(co, ...SPOT.coach, Math.PI, now, o);
      const lookS = b.shot === 'board' || ca === 'present' ? V3(SPOT.board[0], 1.4, SPOT.board[1]) : ca === 'presentClock' ? V3(3.0, 2.5, 11.9) : ca === 'presentPool' ? V3(2, .2, LANE4) : head(CW(), 1.6);
      standAt(sw, ...SPOT.swimmer, 0, now, { arms: b.goggles && D.t > 1.2 ? 'goggles' : 'hips', lookW: lookS, seed: 2, tilt: Math.sin(now*.5)*.04 });
      wetness(sw, 0);
      const [p, t, f] = SHOT[b.shot || 'two'](smooth(D.t/8)); camSet(p, t, f);
    }
    D.slow = slow; return under;
  }
  // éclaboussures à l'entrée des mains, bulles, petits battements
  function strokeFx(rig, s, key, coachDemo){
    const W = R, st = D.fxs ||= {}, prev = st[key] || { L: s.phL, R: s.phR }; st[key] = { L: s.phL, R: s.phR };
    for (const sd of ['L', 'R']) {
      const a = ((prev[sd] % 1) + 1) % 1, b = ((s[sd === 'L' ? 'phL' : 'phR'] % 1) + 1) % 1;
      if (a > .85 && b < .15) { const h = boneW(rig, sd + '_Hand'); if (h.y > -.25) { W.fx.splash(h.x, h.z, .55, 0); ripple(h.x, h.z, 1); sndSplash(.5); W.fx.bubbles(h.x, -.08, h.z, 5, .1); } }
    }
    if (Math.random() < .25) { const f = boneW(rig, Math.random() < .5 ? 'L_Toe' : 'R_Toe'); if (f.y > -.12) W.fx.splash(f.x, f.z, .18, 0); }
    if (!s.yaw && Math.random() < (coachDemo ? .5 : .3)) { const h = boneW(rig, 'Head'); W.fx.bubbles(h.x, h.y - .02, h.z, 1, .06); }
  }
  // séance en accéléré
  const SPEEDS = [null, 6, 25, 60];
  function simFrame(dt, now){
    const W = R, sim = D.sim, P = D.P, sw = W.swimmer, co = W.coach;
    const sg = segAt(sim, D.simT), b = P.blocks[sg.b];
    let speed = SPEEDS[D.speedSel];
    if (!speed) { const first = sg.type === 'len' && sg.r === 0 && sg.j === 0; speed = first ? 2.5 : sg.type === 'rest' ? 30 : 22; }
    speed *= D.rate || 1; if (D.simFreeze) speed = 1e-4;
    D.simT = Math.min(D.simT + dt*speed, sim.total); D.u.swim += dt*Math.min(speed, 3)/cycleOf(sg.style || 'free', b.pace);
    const T = D.simT, tau = T - sg.t0; let under = false;
    if (sg.type === 'len') {
      const p = clamp(tau/sg.dur, 0, 1), x = sg.x0 + sg.dir*POOL*p, wallX = sg.dir > 0 ? POOL : 0, toWall = sg.dur - tau, slowEnough = speed < 9;
      const prev = sim.segs[sim.segs.indexOf(sg) - 1];
      const nxt = sim.segs[sim.segs.indexOf(sg) + 1];
      if (slowEnough && sg.turn && toWall < .55 && sg.style !== 'back') turnAt(sw, (.55 - toWall)/.55*.55, wallX, LANE4, sg.dir, D.u.swim, nxt?.style === 'back');
      else if (slowEnough && prev && prev.type === 'len' && prev.turn && prev.style !== 'back' && tau < .5) turnAt(sw, .55 + tau/.5*.45, sg.x0, LANE4, -sg.dir, D.u.swim, sg.style === 'back');
      else if (slowEnough && sg.fromRest && prev && prev.type === 'rest' && tau < 1.3) pushAt(sw, tau/1.3, sg.x0, LANE4, sg.dir, D.u.swim);
      else { const s = swimAt(sw, sg.style, D.u.swim, clamp(x, .8, POOL - .8), LANE4, sg.dir, {}); if (speed < 30) strokeFx(sw, s, 'sw'); }
      W.water.material.uniforms.uWake.value.set(x, LANE4, sg.dir > 0 ? 0 : Math.PI, 1);
      show(sw, /pull_buoy/, !!b.gear.buoy); show(sw, /plaquette|sangle/, !!b.gear.paddles);
    } else { restAt(sw, sg.x, LANE4, now, { lookClock: tau > 1, puff: b.z === 'css' || b.z === 'fast' || b.z === 'max' ? 1.4 : .7 }); W.water.material.uniforms.uWake.value.w = 0; }
    wetness(sw, 1); setClocks(T);
    // le coach suit depuis le bord, annonce chaque bloc
    const swW = boneW(sw, 'Hips');
    standAt(co, -1.05, LANE4 + 1.75, -2.2, now, { arms: D.lastB !== sg.b || (D.say && !D.say.done) ? 'talk' : 'hips', lookW: swW, speak: 1, jaw: D.say && !D.say.done ? .1 + .1*Math.max(0, Math.sin(now*17)) : 0 });
    if (D.lastB !== sg.b) { D.lastB = sg.b; D.say = speak(`${b.n > 1 ? `${b.n} × ${b.d} m` : `${b.d} m`} ${b.drill ? DRILLS[b.drill].name.toLowerCase() : b.zl}.`); subtitle(blockTitle(b)); }
    // plans : on change à chaque répétition
    const key = sg.b*100 + sg.r, x = swW.x, dir = sg.dir;
    if (key !== D.simShot) { D.simShot = key; D.simCam = (D.simCam ?? -1) + 1; }
    const c = D.simCam % 5, z = LANE4, cx = v => clamp(v, .6, POOL - .6), wallX = dir > 0 ? POOL : 0, near = sg.type === 'len' && Math.abs(wallX - x) < 3.2 && speed < 9;
    if (sg.type === 'rest') camSet(V3(sg.x + (sg.x < 1 ? 2.6 : -2.6), .75, z - 2.2), V3(sg.x, .1, z), 42);
    else if (near && sg.turn) { camSet(V3(wallX - dir*2.4, -.55, z - 1.7), V3(wallX - dir*.8, -.35, z), 50); under = true; } // virage vu sous l'eau
    else if (c === 1) { camSet(V3(cx(x - dir*.3), -.6, z - 1.8), V3(x + dir*.4, -.28, z), 50); under = true; }
    else if (c === 2) camSet(V3(cx(x + dir*.8), 5.2, z - .7), V3(x + dir*.3, 0, z), 40);
    else if (c === 3) camSet(V3(-2.7, 2.3, z - .9), V3(x, 0, z), 34);
    else if (c === 4 && Math.abs(x + dir*3.5 - POOL/2) < POOL/2 - .6) camSet(V3(x + dir*3.5, .3, z + .9), V3(x, -.05, z), 40);
    else camSet(V3(cx(x - dir*.8), 1.55, z - 3.3), V3(x + dir*.35, -.12, z), 40);
    hudUpdate(sg, b, T);
    return under;
  }
  const blockTitle = b => `${b.n > 1 ? `${b.n} × ${b.d} m` : `${b.d} m`} · ${b.kind === 'drill' ? DRILLS[b.drill].name : b.l}`;

  /* ---------------------------------------------------------------- interface (sous-titres, points clés, HUD, cartes) */
  function subtitle(t){ const s = D.el?.querySelector('.s3d-sub'); if (!s) return; s.hidden = !t; s.querySelector('span').textContent = t || ''; }
  function cues(Dr, k){ const c = D.el.querySelector('.s3d-cues'); if (!Dr) { c.hidden = true; return; } c.hidden = false;
    c.innerHTML = `<b>${esc(Dr.name)}</b>${Dr.cues.map((x, i) => `<div class="${i === k ? 'on' : i < k ? 'done' : ''}"><i>${i + 1}</i>${esc(x)}</div>`).join('')}`; }
  function hud(on){ const h = D.el.querySelector('.s3d-hud'); h.hidden = !on; D.el.querySelector('[data-a="speed"]').hidden = !on; }
  function hudUpdate(sg, b, T){
    const h = D.el.querySelector('.s3d-hud'), P = D.P, done = P.blocks.slice(0, sg.b).reduce((a, x) => a + x.dist, 0) + (sg.type === 'len' ? sg.r*b.d + sg.j*POOL + clamp((T - sg.t0)/sg.dur, 0, 1)*POOL : (sg.r + 1)*b.d);
    h.innerHTML = `<div class="s3d-hb"><span>Bloc ${sg.b + 1}/${P.blocks.length}</span><b>${esc(blockTitle(b))}</b></div>
      <div class="s3d-hr"><span>${b.n > 1 ? `Rép. ${sg.r + 1}/${b.n}` : ''}${sg.type === 'rest' ? ' · récup' : ''}</span><span>${fmtP(b.pace)}/100${b.dep ? ` · départ ${fmtP(b.dep)}` : ''}</span></div>
      <div class="s3d-hr"><span class="num">⏱ ${fmtT(T)}</span><span class="num">${Math.round(done)} m</span></div><div class="s3d-bar"><i style="width:${(T/D.sim.total*100).toFixed(1)}%"></i></div>`;
    const sp = SPEEDS[D.speedSel]; D.el.querySelector('[data-a="speed"]').textContent = sp ? `×${sp}` : 'Auto';
  }
  function card(html){ const c = D.el.querySelector('.s3d-card'); c.hidden = !html; c.innerHTML = html || ''; }
  function introCard(){
    const P = D.P; card(`<div class="s3d-k">Comprendre la séance</div><h2>${esc(P.name)}</h2><p>${esc(P.goal)}</p>
      <div class="s3d-kp"><span><b class="num">${P.total} m</b>distance</span><span><b class="num">~${Math.round(P.sec/60)} min</b>durée</span><span><b class="num">${fmtP(P.css)}</b>CSS /100 m</span></div>
      <button class="btn primary" data-a="go">🏊 Faire la séance</button><p class="tiny muted">Le coach t'explique chaque bloc, te montre les éducatifs, puis tu vois toute la séance en accéléré. Son activé : vérifie que ton téléphone n'est pas en silencieux.</p>`);
  }
  function endCard(){
    const P = D.P, dr = [...new Set(P.blocks.filter(b => b.drill).map(b => b.drill))];
    card(`<div class="s3d-k">Séance comprise ✓</div><h2>${esc(P.name)}</h2><div class="s3d-kp"><span><b class="num">${P.total} m</b>distance</span><span><b class="num">~${Math.round(P.sec/60)} min</b>durée</span><span><b class="num">${P.blocks.length}</b>blocs</span></div>
      <ol class="s3d-rec">${P.blocks.map(b => `<li><b>${esc(blockTitle(b))}</b> <span>${fmtP(b.pace)}/100${b.dep ? ` · départ ${fmtP(b.dep)}` : b.r ? ` · ${b.r} s de récup` : ''}</span></li>`).join('')}</ol>
      <div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap">${dr.map(d => `<button class="btn sm" data-a="drill" data-d="${d}">↺ ${esc(DRILLS[d].name)}</button>`).join('')}<button class="btn sm" data-a="replay">↺ Revoir</button><button class="btn primary sm" data-a="close">Fermer</button></div>`);
    subtitle(''); hud(false);
  }
  function ui(){
    const el = document.createElement('div'); el.className = 's3d'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Comprendre la séance');
    el.innerHTML = `<div class="s3d-stage"></div><div class="s3d-top"><button class="s3d-b" data-a="close" aria-label="Fermer">✕</button><div class="s3d-ttl"></div><button class="s3d-b" data-a="snd" aria-label="Son">🔊</button></div>
      <div class="s3d-cues" hidden></div><div class="s3d-hud" hidden></div><div class="s3d-card" hidden></div><div class="s3d-sub" hidden><b>Coach</b><span></span></div>
      <div class="s3d-ctl"><button class="s3d-b" data-a="prev" aria-label="Revenir">⏮</button><button class="s3d-b" data-a="pause" aria-label="Pause">⏸</button><button class="s3d-b" data-a="next" aria-label="Passer">⏭</button><button class="s3d-b s3d-sp" data-a="speed" hidden>Auto</button></div>
      <div class="s3d-load"><div class="s3d-spin"></div><span>Préparation du bassin…</span></div>`;
    document.body.appendChild(el); return el;
  }
  function onClick(e){
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'close') return close();
    if (a === 'snd') { Voice.on = !Voice.on; e.target.textContent = Voice.on ? '🔊' : '🔇'; sndMute(); return; }
    if (a === 'go') { try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (er) {} sndInit(); Snd.ctx?.resume?.(); if (Voice.ok) try { speechSynthesis.getVoices(); } catch (er) {} card(null); D.state = 'beats'; D.el.classList.add('run'); start(); return; }
    if (D.state !== 'beats') return;
    if (a === 'pause') { D.paused = !D.paused; e.target.textContent = D.paused ? '▶' : '⏸'; if (Voice.ok) try { D.paused ? speechSynthesis.pause() : speechSynthesis.resume(); } catch (er) {} return; }
    if (a === 'next') return skip(1);
    if (a === 'prev') return skip(-1);
    if (a === 'speed') { D.speedSel = (D.speedSel + 1) % SPEEDS.length; return; }
    if (a === 'replay') { start(); return; }
    if (a === 'drill') { const d = e.target.closest('[data-d]').dataset.d, i = D.beats.findIndex(b => b.style === DRILLS[d].style && b.coach === 'mime'); goto(i < 0 ? 0 : i); }
  }

  /* ---------------------------------------------------------------- ouverture / fermeture */
  let raf = 0, last = 0, openedFrom = null;
  function loop(now){
    raf = requestAnimationFrame(loop); now /= 1000; let dt = Math.min(.05, now - (last || now)); last = now;
    if (!R || !D.on) return;
    if (D.paused) dt = 0;
    D.t += dt; D.clk = (D.clk || 0) + dt;
    if (D.state === 'beats') { const b = D.beats[D.i]; if (b && beatDone(b) && D.i < D.beats.length - 1) next(); }
    frame(dt, D.clk);
    const dts = dt*(D.slow ?? 1);
    U.time.value += dts; R.fx.update(dts);
    if (D.state !== 'beats' || !D.beats[D.i]?.sim) setClocks(D.clk);
    camApply(D.clk); sndUnder(U.camUnder.value > .5);
    R.r.render(R.scene, R.cam);
    D.frames = (D.frames || 0) + 1;
  }
  async function open(id){
    const x = (S.triPlan || []).find(y => y.id === id); if (!x || x.sport !== 'swim') return;
    close(true); openedFrom = id;
    if (typeof dlg !== 'undefined' && dlg.open) dlg.close();
    const P = plan(x), el = ui();
    Object.assign(D, { on: true, P, el, beats: beatsOf(P), state: 'loading', i: -1, t: 0, paused: false, rate: D.rate || 1, frames: 0 });
    el.querySelector('.s3d-ttl').textContent = P.name; el.addEventListener('click', onClick);
    try { await loadLibs(); await buildWorld(el.querySelector('.s3d-stage')); }
    catch (e) { el.querySelector('.s3d-load span').textContent = "Le bassin 3D n'a pas pu se charger (connexion ?). Réessaie plus tard."; if (typeof Errors !== 'undefined') Errors.report?.(e, 'swim3d'); D.state = 'error'; return; }
    if (!D.on) return;
    resize(); addEventListener('resize', resize); drawBoard(P, -1);
    el.querySelector('.s3d-load').hidden = true; D.state = 'intro'; introCard();
    last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  function close(silent){
    cancelAnimationFrame(raf); raf = 0; D.on = false; removeEventListener('resize', resize);
    if (Voice.ok) try { speechSynthesis.cancel(); } catch (e) {}
    if (Snd.ctx) { try { Snd.ctx.close(); } catch (e) {} Snd.ctx = null; }
    if (R) { for (const c of [R.swimmer, R.coach]) c && R.scene.remove(c.root);
      R.scene.traverse(o => { if (o.geometry && !o.isSkinnedMesh && !o.parent?.isBone) o.geometry.dispose?.(); const m = o.material; if (m && !o.isSkinnedMesh && !o.parent?.isBone) (Array.isArray(m) ? m : [m]).forEach(x => { x.map?.dispose?.(); x.dispose?.(); }); });
      R.r.dispose(); R.r.forceContextLoss?.(); R.r.domElement.remove(); R = null; }
    D.el?.remove(); D.el = null;
    if (!silent && openedFrom && typeof triDlg === 'function') { const id = openedFrom; openedFrom = null; setTimeout(() => triDlg(id), 0); }
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-swim3d]'); if (b) { e.preventDefault(); open(b.dataset.swim3d); } });
  // accès pour le développement et les tests
  const debug = {
    async init(el){ await loadLibs(); await buildWorld(el); resize(); return true; },
    still(o){ const t = o.t || 0; U.time.value = t;
      const vec = q => { for (const k of ['lookW', 'atW']) if (q && q[k] && !q[k].isVector3) q[k] = Array.isArray(q[k]) ? V3(...q[k]) : V3(q[k].x, q[k].y, q[k].z); };
      vec(o.swimStand); vec(o.coach);
      if (o.swim) { const s = o.swim; swimAt(R.swimmer, s.style || 'free', s.u || 0, s.x ?? 6, s.z ?? LANE4, s.dir || 1, s); wetness(R.swimmer, 1); }
      else if (o.swimStand) { const s = o.swimStand; standAt(R.swimmer, s.x ?? SPOT.swimmer[0], s.z ?? SPOT.swimmer[1], s.yaw ?? 0, t, s); }
      if (o.coach) { const c = o.coach; if (c.swim) { swimAt(R.coach, c.style || 'free', c.u || 0, c.x ?? 6, c.z ?? LANE4, c.dir || 1, c); wetness(R.coach, 1); show(R.coach, /lunettes/, true); show(R.coach, /sifflet|cordon/, false); }
        else standAt(R.coach, c.x ?? SPOT.coach[0], c.z ?? SPOT.coach[1], c.yaw ?? Math.PI, t, c); }
      if (o.board) drawBoard(o.board, o.hi ?? -1);
      setClocks(o.clock || 0);
      camSet(V3(...o.cam[0]), V3(...o.cam[1]), o.cam[2]); camApply(0); R.r.render(R.scene, R.cam); return true; },
    get R(){ return R; }, V3: (...a) => V3(...a), plan, spoken, DRILLS,
  };
  Object.assign(debug, { D, skip, goto, beatsOf, buildSim, seekDive(tt){ if (D.dive) Object.assign(D.dive, { t: tt, tt, spl: tt > 2.2 ? 1 : 0 }); }, set rate(v){ D.rate = v; }, get rate(){ return D.rate || 1; } });
  const available = () => PUBLIC || !!(typeof Garage !== 'undefined' && Garage.Adm?.is);
  // bouton de la fiche : si le statut admin n'est pas encore vérifié (il ne l'est qu'à l'ouverture du Profil), on le vérifie et on rouvre la fiche
  function button(id){
    if (available()) return `<button class="btn primary" data-swim3d="${id}">🏊 Comprendre la séance</button>`;
    const A = typeof Garage !== 'undefined' && Garage.Adm, u = typeof Cloud !== 'undefined' && Cloud.user;
    if (A && u && A.uid !== u.id && Garage.admCheck) Garage.admCheck().then(() => { if (available() && typeof dlg !== 'undefined' && dlg.open && document.querySelector(`[data-swim3d-slot="${id}"]`)) triDlg(id); });
    return `<span data-swim3d-slot="${id}" hidden></span>`;
  }
  return { plan, spoken, DRILLS, debug, open, close, available, button };
})();
