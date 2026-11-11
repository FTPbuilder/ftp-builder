"use strict";
// FTP Builder · communauté : amis et défis partagés
/* ============ Communauté : amis et défis partagés (FTP / renfo) ============ */
// Les membres d'un défi ne voient que le pseudo et la progression dans ce défi.
// FTP : seuls les tests FTP faits pendant le défi comptent ; classement en % du chemin vers son propre objectif.
const Social = (() => {
  let D = { err: null, me: null, members: {}, friends: [], chals: [], rows: [], loaded: false, busy: false, results: null, q: '' };
  const sb = () => Cloud.sb, uid = () => Cloud.user?.id;
  const nameOf = id => D.members[id]?.display_name || 'Membre';
  const defaultName = () => (S.profile?.name || Cloud.user?.user_metadata?.full_name || Cloud.user?.user_metadata?.name || (Cloud.user?.email || '').split('@')[0] || 'Athlète').trim().slice(0, 40);
  const localId = cid => 'sh-' + cid;
  async function load(){
    if (!sb() || !uid() || D.busy) return; D.busy = true;
    try {
      let { data: me } = await sb().from('members').select('user_id, display_name, searchable').eq('user_id', uid()).maybeSingle();
      if (!me) { const n = defaultName(); const r = await sb().from('members').insert({ user_id: uid(), display_name: n.length >= 2 ? n : n + ' FTP' }).select().maybeSingle(); me = r.data; }
      D.me = me;
      const [f, m, c, r] = await Promise.all([sb().from('friendships').select('a, b, status, created_at'), sb().from('members').select('user_id, display_name'),
        sb().from('shared_challenges').select('*').order('end_date'), sb().from('challenge_members').select('*')]);
      D.friends = f.data || []; D.members = Object.fromEntries((m.data || []).map(x => [x.user_id, x])); D.chals = c.data || []; D.rows = r.data || [];
      D.loaded = true; D.err = null; linkLocal(); await pushProgress();
    } catch (e) { console.warn('social', e); D.err = e?.message || String(e); } finally { D.busy = false; }
  }
  // défi renfo partagé = un défi local relié (saisie habituelle avec les boutons +)
  function linkLocal(){
    let ch = false;
    for (const c of D.chals) { const mine = D.rows.find(r => r.challenge_id === c.id && r.user_id === uid()); if (c.kind !== 'renfo' || mine?.status !== 'joined') continue;
      let l = challenges().find(x => x.id === localId(c.id));
      if (!l) { l = { id: localId(c.id), shared: c.id, name: c.name, unit: c.unit, target: +mine.goal || 100, step: c.unit === 'min' ? [1, 2, 5] : [10, 20, 50], start: c.start_date, end: c.end_date, entries: {} }; challenges().push(l); ch = true; }
      else if (l.target !== +mine.goal && mine.goal) { l.target = +mine.goal; ch = true; } }
    if (ch) save();
  }
  const ftpProgress = c => { const tests = (S.ftpHistory || []).filter(h => h.source === 'test' && h.date >= c.start_date && h.date <= c.end_date); return tests.length ? tests[tests.length - 1] : null; };
  const renfoProgress = c => { const l = challenges().find(x => x.id === localId(c.id)); if (!l) return 0; return Object.entries(l.entries).filter(([d]) => d >= c.start_date && d <= c.end_date).reduce((a, [, v]) => a + v, 0); };
  async function pushProgress(){
    for (const c of D.chals) { const r = D.rows.find(x => x.challenge_id === c.id && x.user_id === uid()); if (r?.status !== 'joined') continue;
      let v, day = r.last_update;
      if (c.kind === 'ftp') { const t = ftpProgress(c); v = t ? t.ftp : +r.start_val; day = t ? t.date : r.last_update; } else v = Math.round(renfoProgress(c)*10)/10;
      if (v != null && +r.progress !== v) { const { error } = await sb().from('challenge_members').update({ progress: v, last_update: day || todayISO(), updated_at: new Date().toISOString() }).eq('challenge_id', c.id).eq('user_id', uid()); if (!error) { r.progress = v; r.last_update = day; } } }
  }
  let pushT = null; const pushSoon = () => { if (!D.loaded) return; clearTimeout(pushT); pushT = setTimeout(() => pushProgress(), 1500); };
  // % du chemin parcouru vers son propre objectif
  const pctOf = (c, r) => { if (r.status !== 'joined' || r.goal == null) return null;
    if (c.kind === 'ftp') { const s0 = +r.start_val, g = +r.goal, p = +(r.progress ?? s0); return g > s0 ? (p - s0)/(g - s0)*100 : null; }
    return +r.goal > 0 ? (+r.progress || 0)/(+r.goal)*100 : null; };
  const fmtV = (c, v) => c.kind === 'ftp' ? `${Math.round(v)} W` : fmtCh({ unit: c.unit }, +v || 0);
  const unitL = c => c.kind === 'ftp' ? 'FTP' : c.unit === 'min' ? 'minutes' : 'répétitions';
  const friendIds = () => D.friends.filter(f => f.status === 'accepted').map(f => f.a === uid() ? f.b : f.a);

  function chalHTML(c){
    const t = todayISO(), rows = D.rows.filter(r => r.challenge_id === c.id), mine = rows.find(r => r.user_id === uid());
    const ranked = rows.map(r => ({ r, p: pctOf(c, r) })).sort((x, y) => (y.p ?? -1e9) - (x.p ?? -1e9));
    const left = Math.max(0, diffDays(t, c.end_date)), over = t > c.end_date;
    const head = `<div class="row" style="align-items:flex-start;gap:8px;flex-wrap:nowrap"><div style="flex:1;min-width:0"><b>${c.kind === 'ftp' ? '⚡ ' : '💪 '}${esc(c.name)}</b><div class="tiny muted">${c.kind === 'ftp' ? 'Défi FTP · tests uniquement' : `Renfo · ${unitL(c)}`} · ${fmtShort(c.start_date)} → ${fmtShort(c.end_date)} · <span style="white-space:nowrap">${over ? 'terminé' : `J-${left}`}</span></div></div>
      <button class="btn sm ghost" data-soc="menu" data-c="${c.id}" aria-label="Options du défi" style="flex:0 0 auto">⋯</button></div>`;
    if (mine?.status === 'invited') return `<div class="card soc-ch">${head}<div class="note" style="margin:10px 0 8px">${esc(nameOf(c.owner))} t'invite à ce défi.</div>
      <div class="row"><button class="btn primary" data-soc="join" data-c="${c.id}">Rejoindre</button><button class="btn ghost" data-soc="leave" data-c="${c.id}">Refuser</button></div></div>`;
    const lb = ranked.map(({ r, p }, k) => { const me = r.user_id === uid(), pend = r.status !== 'joined';
      const sub = pend ? 'invitation envoyée' : c.kind === 'ftp' ? `${Math.round(r.start_val)} → <b class="num" style="color:var(--text)">${Math.round(r.progress ?? r.start_val)} W</b> / ${Math.round(r.goal)} W${r.last_update && +r.progress !== +r.start_val ? ` · test du ${fmtShort(r.last_update)}` : ' · pas encore de test'}` : `<b class="num" style="color:var(--text)">${fmtV(c, r.progress)}</b> / ${fmtV(c, r.goal)}`;
      return `<div class="soc-row${me ? ' me' : ''}"><span class="soc-rk num">${pend ? '·' : k + 1}</span><div style="flex:1;min-width:0"><div class="row between"><b>${esc(nameOf(r.user_id))}${me ? ' <span class="tiny muted">(toi)</span>' : ''}</b><span class="num small">${p == null ? '—' : `${Math.round(p)} %`}</span></div>
        <div class="bar" style="margin:5px 0"><i style="width:${clamp(p ?? 0, 0, 100)}%"></i></div><div class="tiny muted">${sub}</div></div></div>`; }).join('');
    return `<div class="card soc-ch">${head}<div style="margin-top:8px">${lb}</div>
      ${mine?.status === 'joined' && c.kind === 'ftp' ? `<p class="tiny muted" style="margin:8px 0 0">Ton classement bouge à chaque test FTP (rampe ou 20 min) fait dans l'app pendant le défi.</p>` : ''}
      ${mine?.status === 'joined' && c.kind === 'renfo' ? `<p class="tiny muted" style="margin:8px 0 0">Ajoute tes ${unitL(c)} dans la carte « ${esc(c.name)} » de « Mes défis » : ta progression part toute seule.</p>` : ''}</div>`;
  }
  function friendsHTML(){
    const inc = D.friends.filter(f => f.status === 'pending' && f.b === uid()), out = D.friends.filter(f => f.status === 'pending' && f.a === uid()), fr = friendIds();
    return `<div class="card"><div class="row between"><h2>Mes amis</h2><span class="tiny muted">${fr.length} ami${fr.length > 1 ? 's' : ''}</span></div>
      <div class="row" style="gap:8px;align-items:center;margin:0 0 10px"><span class="small muted">Ton pseudo :</span><b>${esc(D.me?.display_name || '')}</b><button class="btn sm ghost" data-soc="rename">Modifier</button></div>
      <label class="f" for="socQ">Ajouter un membre</label><div class="row" style="gap:8px"><input type="text" id="socQ" enterkeyhint="search" placeholder="Son pseudo" autocomplete="off" value="${esc(D.q)}" style="flex:1;min-width:0;width:auto"><button class="btn primary" data-soc="search">Chercher</button></div>
      ${D.results ? `<div style="margin-top:8px">${D.results.length ? D.results.map(x => `<div class="hist"><b style="flex:1">${esc(x.display_name)}</b>${x.rel === 'friend' ? '<span class="tiny muted">ami</span>' : x.rel === 'sent' ? '<span class="tiny muted">demande envoyée</span>' : x.rel === 'received' ? `<button class="btn sm primary" data-soc="accept" data-u="${x.user_id}">Accepter</button>` : `<button class="btn sm" data-soc="add" data-u="${x.user_id}">Ajouter</button>`}</div>`).join('') : '<p class="small muted" style="margin:0">Personne avec ce pseudo.</p>'}</div>` : ''}
      ${inc.length ? `<h3 style="margin-top:14px">Demandes reçues</h3>${inc.map(f => `<div class="hist"><b style="flex:1">${esc(nameOf(f.a))}</b><button class="btn sm primary" data-soc="accept" data-u="${f.a}">Accepter</button><button class="btn sm ghost" data-soc="unfriend" data-u="${f.a}">Refuser</button></div>`).join('')}` : ''}
      ${fr.length ? `<h3 style="margin-top:14px">Amis</h3>${fr.map(id => `<div class="hist"><b style="flex:1">${esc(nameOf(id))}</b><button class="btn sm ghost" data-soc="unfriend" data-u="${id}" aria-label="Retirer ${esc(nameOf(id))}">Retirer</button></div>`).join('')}` : ''}
      ${out.length ? `<h3 style="margin-top:14px">En attente</h3>${out.map(f => `<div class="hist"><span style="flex:1">${esc(nameOf(f.b))}</span><button class="btn sm ghost" data-soc="unfriend" data-u="${f.b}">Annuler</button></div>`).join('')}` : ''}
      <label style="display:flex;gap:10px;margin-top:12px;align-items:center;min-height:44px"><input type="checkbox" id="socFind" ${D.me?.searchable !== false ? 'checked' : ''} style="width:auto;min-height:0"><span class="small">Les membres peuvent me trouver par mon pseudo</span></label></div>`;
  }
  // deux carrés en tête du volet Défis : « Défis partagés » et « Amis » ; le carré touché déplie sa section dessous
  let OPEN = null;
  const SQ_IC = { chals:'<path d="M7 4h10v4a5 5 0 0 1-10 0zM12 13v4M8 21h8M10 17h4M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/>',
    friends:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M19 8v6M16 11h6"/>' };
  const sq = (k, col, big, lab, badge) => `<button type="button" data-socsq="${k}" class="${OPEN === k ? 'on' : ''}" style="--sq:${col}" aria-expanded="${OPEN === k}">
    ${badge ? `<span class="badge">${badge}</span>` : ''}<svg viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SQ_IC[k]}</svg>
    <span><span class="big num" style="color:${col}">${big}</span><br><span class="lab">${lab}</span></span></button>`;
  function html(){
    const ok = Cloud.user && D.loaded;
    if (Cloud.user && !D.loaded && !D.err && !D.busy) load().then(() => render());
    const act = ok ? D.chals.filter(c => c.end_date >= addDays(todayISO(), -14)) : [];
    const invites = ok ? D.rows.filter(r => r.user_id === uid() && r.status === 'invited').length : 0;
    const reqs = ok ? D.friends.filter(f => f.status === 'pending' && f.b === uid()).length : 0, fr = ok ? friendIds().length : 0;
    let h = `<div class="dsq">${sq('chals', 'var(--h-def)', ok ? act.length : '+', `Nouveaux défis<br>partagés`, invites ? `${invites} invit.` : '')}${sq('friends', 'var(--accent)', ok ? fr : '+', `Ajouter<br>des amis`, reqs ? `${reqs} demande${reqs > 1 ? 's' : ''}` : '')}</div>`;
    if (!OPEN) return h;
    if (!Cloud.user) return h + `<div class="card"><h2>Défis entre amis</h2><p class="small muted" style="margin:0 0 10px">Lance des défis FTP ou renfo avec tes potes : chacun son objectif, un classement commun.</p><button class="btn primary" data-auth="open">Créer mon compte</button></div>`;
    if (!D.loaded && D.err) return h + `<div class="card"><h2>Défis entre amis</h2><p class="small muted" style="margin:0 0 8px">Impossible de charger la communauté pour l'instant.</p><button class="btn sm" data-soc="retry">Réessayer</button></div>`;
    if (!D.loaded) return h + `<div class="card"><p class="small muted" style="margin:0">Chargement…</p></div>`;
    if (OPEN === 'friends') return h + friendsHTML();
    return h + `<div class="card"><div class="row between" style="align-items:center"><h2 style="margin:0">Défis partagés</h2><button class="btn sm primary" data-soc="new">+ Nouveau défi</button></div>
      ${act.length ? '' : `<p class="small muted" style="margin:10px 0 0">Pas encore de défi partagé. ${fr ? '' : 'Ajoute d\'abord un ami (carré « Ajouter des amis »), puis lance '}${fr ? 'Lance ' : ''}un défi FTP (chacun vise sa propre FTP, le classement compare le % de l'objectif atteint) ou un défi renfo (chaise, fentes…).</p>`}</div>` + act.map(chalHTML).join('');
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-socsq]'); if (!b) return; OPEN = OPEN === b.dataset.socsq ? null : b.dataset.socsq; render(); });
  // ---------- actions ----------
  const rpcErr = e => toast('Communauté : ' + (e?.message || e));
  async function act(a, el){
    const c = D.chals.find(x => x.id === el.dataset.c), u = el.dataset.u;
    try {
      if (a === 'search') { const q = ($('#socQ')?.value || '').trim(); D.q = q; if (q.length < 2) return toast('Au moins 2 lettres'); const { data, error } = await sb().rpc('social_search', { q }); if (error) throw error; D.results = data || []; }
      else if (a === 'add') { const { error } = await sb().from('friendships').insert({ a: uid(), b: u }); if (error) throw error; toast("Demande d'ami envoyée"); D.results = null; await load(); }
      else if (a === 'accept') { const { error } = await sb().from('friendships').update({ status: 'accepted' }).eq('a', u).eq('b', uid()); if (error) throw error; toast('Vous êtes amis 🤝'); D.results = null; await load(); }
      else if (a === 'unfriend') { await sb().from('friendships').delete().or(`and(a.eq.${uid()},b.eq.${u}),and(a.eq.${u},b.eq.${uid()})`); await load(); }
      else if (a === 'rename') return renameDlg();
      else if (a === 'new') return newDlg();
      else if (a === 'join') return joinDlg(c);
      else if (a === 'leave') { if (!confirmLeave(c)) return; await sb().from('challenge_members').delete().eq('challenge_id', c.id).eq('user_id', uid()); toast('Défi quitté'); await load(); }
      else if (a === 'menu') return menuDlg(c);
      else if (a === 'retry') { D.err = null; await load(); }
      render();
    } catch (e) { rpcErr(e); }
  }
  let _leaveArm = 0; const confirmLeave = c => { const n = Date.now(); if (n - _leaveArm < 4000) return true; _leaveArm = n; toast('Touche encore pour confirmer'); return false; };
  function renameDlg(){
    openDlg(`<h2>Ton pseudo</h2><p class="small muted">C'est le nom que tes amis voient et cherchent.</p><label class="f" for="socName">Pseudo</label><input type="text" id="socName" maxlength="40" value="${esc(D.me?.display_name || '')}">
      <div class="row" style="margin-top:12px"><button class="btn primary" id="socNameOk">Enregistrer</button></div>`);
    $('#socNameOk').onclick = async () => { const n = $('#socName').value.trim(); if (n.length < 2) return toast('Au moins 2 caractères');
      const { error } = await sb().from('members').update({ display_name: n, updated_at: new Date().toISOString() }).eq('user_id', uid()); if (error) return rpcErr(error); closeDlg(); await load(); render(); toast('Pseudo enregistré'); };
  }
  function newDlg(){
    const fr = friendIds(), t = todayISO();
    openDlg(`<h2>Nouveau défi entre amis</h2>
      <div class="seg" id="socKind" style="margin:8px 0 12px"><button type="button" class="on" data-k="ftp">⚡ FTP</button><button type="button" data-k="renfo">💪 Renfo</button></div>
      <label class="f" for="socCName">Nom du défi</label><input type="text" id="socCName" maxlength="60" value="Défi FTP de l'hiver">
      <label class="f" for="socDur">Durée</label><select id="socDur"><option value="2">2 mois</option><option value="3" selected>3 mois</option><option value="4">4 mois</option></select>
      <div id="socFtp"><div class="grid2"><div><label class="f" for="socS">Ta FTP de départ (W)</label><input type="number" id="socS" value="${ftp()}"></div><div><label class="f" for="socG">Ta FTP visée (W)</label><input type="number" id="socG" value="${S.profile?.goalFtp || ftp() + 20}"></div></div>
        <p class="tiny muted" style="margin:6px 0 0">Chacun fixe sa propre cible. Le classement compare le % du chemin parcouru, mesuré uniquement par les tests FTP.</p></div>
      <div id="socRen" class="hidden"><div class="grid2"><div><label class="f" for="socU">Unité</label><select id="socU"><option value="min">Minutes (chaise, gainage…)</option><option value="reps">Répétitions (fentes, squats…)</option></select></div><div><label class="f" for="socRG">Ton objectif total</label><input type="number" id="socRG" value="300"></div></div>
        <p class="tiny muted" style="margin:6px 0 0">Chacun choisit son objectif ; le classement compare le % atteint.</p></div>
      <h3 style="margin-top:14px">Inviter</h3>${fr.length ? fr.map(id => `<label class="row" style="gap:8px;align-items:center;min-height:44px"><input type="checkbox" class="socInv" value="${id}" style="width:auto;min-height:0" checked><span>${esc(nameOf(id))}</span></label>`).join('') : '<p class="small muted" style="margin:0">Ajoute d\'abord des amis (carré « Ajouter des amis »). Tu pourras les inviter ensuite.</p>'}
      <div class="row" style="margin-top:14px"><button class="btn primary" id="socCreate">Lancer le défi</button></div>`);
    let kind = 'ftp';
    $('#socKind').querySelectorAll('button').forEach(b => b.onclick = () => { kind = b.dataset.k; $('#socKind').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      $('#socFtp').classList.toggle('hidden', kind !== 'ftp'); $('#socRen').classList.toggle('hidden', kind !== 'renfo');
      const nm = $('#socCName'); if (/^Défi (FTP de l'hiver|chaise)$/.test(nm.value)) nm.value = kind === 'ftp' ? "Défi FTP de l'hiver" : 'Défi chaise'; });
    $('#socCreate').onclick = async () => {
      const name = $('#socCName').value.trim(), months = +$('#socDur').value, end = addDays(t, Math.round(months*30.4));
      const inv = [...document.querySelectorAll('.socInv:checked')].map(x => x.value);
      const isF = kind === 'ftp', s0 = isF ? +$('#socS').value : 0, g = isF ? +$('#socG').value : +$('#socRG').value;
      if (name.length < 2) return toast('Donne un nom au défi'); if (isF && !(g > s0 && s0 > 0)) return toast('La FTP visée doit dépasser la FTP de départ'); if (!(g > 0)) return toast('Indique ton objectif');
      const { error } = await sb().rpc('social_create_challenge', { p_kind: kind, p_name: name, p_unit: isF ? null : $('#socU').value, p_start: t, p_end: end, p_start_val: s0, p_goal: g, p_invitees: inv });
      if (error) return rpcErr(error); closeDlg(); await load(); render(); toast(inv.length ? `Défi lancé, ${inv.length} invitation${inv.length > 1 ? 's' : ''} envoyée${inv.length > 1 ? 's' : ''}` : 'Défi lancé');
    };
  }
  function joinDlg(c){
    const isF = c.kind === 'ftp';
    openDlg(`<h2>Rejoindre « ${esc(c.name)} »</h2><p class="small muted">Jusqu'au ${fmtShort(c.end_date)}. Fixe ta propre cible : le classement compare le % de l'objectif atteint.</p>
      ${isF ? `<div class="grid2"><div><label class="f" for="socJS">Ta FTP de départ (W)</label><input type="number" id="socJS" value="${ftp()}"></div><div><label class="f" for="socJG">Ta FTP visée (W)</label><input type="number" id="socJG" value="${S.profile?.goalFtp || ftp() + 20}"></div></div><p class="tiny muted">Seuls tes tests FTP faits dans l'app d'ici la fin du défi comptent.</p>`
        : `<label class="f" for="socJG">Ton objectif (${unitL(c)})</label><input type="number" id="socJG" value="${c.unit === 'min' ? 300 : 2000}">`}
      <div class="row" style="margin-top:12px"><button class="btn primary" id="socJoin">Rejoindre</button></div>`);
    $('#socJoin').onclick = async () => { const g = +$('#socJG').value, s0 = isF ? +$('#socJS').value : 0;
      if (isF && !(g > s0 && s0 > 0)) return toast('La FTP visée doit dépasser la FTP de départ'); if (!(g > 0)) return toast('Indique ton objectif');
      const { error } = await sb().from('challenge_members').update({ status: 'joined', start_val: s0, goal: g, progress: isF ? s0 : 0, last_update: todayISO(), updated_at: new Date().toISOString() }).eq('challenge_id', c.id).eq('user_id', uid());
      if (error) return rpcErr(error); closeDlg(); await load(); render(); toast("C'est parti 💪"); };
  }
  function menuDlg(c){
    const mine = D.rows.find(r => r.challenge_id === c.id && r.user_id === uid()), own = c.owner === uid();
    const inv = friendIds().filter(id => !D.rows.some(r => r.challenge_id === c.id && r.user_id === id));
    openDlg(`<h2>${esc(c.name)}</h2>
      ${mine?.status === 'joined' && inv.length ? `<h3>Inviter des amis</h3>${inv.map(id => `<label class="row" style="gap:8px;align-items:center;min-height:44px"><input type="checkbox" class="socInv2" value="${id}" style="width:auto;min-height:0"><span>${esc(nameOf(id))}</span></label>`).join('')}<div class="row" style="margin:8px 0 14px"><button class="btn primary" id="socInvBtn">Inviter</button></div>` : ''}
      ${mine?.status === 'joined' ? `<button class="btn" id="socEditGoal">Modifier mon objectif</button>` : ''}
      <div class="row" style="margin-top:14px">${own ? `<button class="btn danger" data-soc="delete" data-c="${c.id}">Supprimer le défi pour tous</button>` : `<button class="btn ghost" data-soc="leave" data-c="${c.id}">Quitter le défi</button>`}</div>`);
    const ib = $('#socInvBtn'); if (ib) ib.onclick = async () => { const ids = [...document.querySelectorAll('.socInv2:checked')].map(x => x.value); if (!ids.length) return toast('Coche au moins un ami');
      const { data, error } = await sb().rpc('social_invite', { p_challenge: c.id, p_invitees: ids }); if (error) return rpcErr(error); closeDlg(); await load(); render(); toast(`${data} invitation${data > 1 ? 's' : ''} envoyée${data > 1 ? 's' : ''}`); };
    const eg = $('#socEditGoal'); if (eg) eg.onclick = () => joinDlg(c);
  }
  document.addEventListener('click', async e => { const el = e.target.closest('[data-soc]'); if (!el) return;
    if (el.dataset.soc === 'delete') { const c = D.chals.find(x => x.id === el.dataset.c); if (!confirmLeave(c)) return; const { error } = await sb().from('shared_challenges').delete().eq('id', c.id); if (error) return rpcErr(error); closeDlg(); await load(); render(); toast('Défi supprimé'); return; }
    if (el.dataset.soc === 'leave' && el.closest('dialog')) closeDlg();
    act(el.dataset.soc, el); });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'socQ') { e.preventDefault(); act('search', e.target); } });
  document.addEventListener('change', async e => { if (e.target.id !== 'socFind') return; const { error } = await sb().from('members').update({ searchable: e.target.checked }).eq('user_id', uid()); if (error) return rpcErr(error); D.me.searchable = e.target.checked; toast(e.target.checked ? 'On peut te trouver par ton pseudo' : 'Tu n\'apparais plus dans la recherche'); });
  return { load, html, pushSoon, get data(){ return D; }, pctOf };
})();
