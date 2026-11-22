'use strict';

/* =========================================================
   Séances — V1
   Objectif : ouvrir directement la séance du jour et voir
   ce qu'on a fait la dernière fois pour progresser.
   Données stockées sur le téléphone (localStorage).
   ========================================================= */

/* ---------- Utilitaires ---------- */
const $ = s => document.querySelector(s);
const DB_KEY = 'seances.v1';
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const JOURS_COURT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const TYPES = { muscu: 'Muscu', pdc: 'Poids du corps', cardio: 'Cardio' };

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const nkey = name => String(name || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
const todayIdx = () => (new Date().getDay() + 6) % 7; // 0 = lundi
const dayIdxOf = iso => (new Date(iso).getDay() + 6) % 7;
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const fmtNum = n => n == null ? '–' : String(Math.round(n * 100) / 100).replace('.', ',');
const fmtIn = n => n == null ? '' : String(n).replace('.', ',');
const fmtDate = iso => new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtShort = iso => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' });
const fmtTime = iso => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const fmtDuree = min => {
  if (min == null) return '–';
  const m = Math.round(min);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
};
const fmtPace = p => { // minutes / km -> "5:36"
  if (!p) return '–';
  let m = Math.floor(p), s = Math.round((p - m) * 60);
  if (s === 60) { m++; s = 0; }
  return `${m}:${String(s).padStart(2, '0')}`;
};
const mmss = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/* ---------- Données ---------- */
function emptyDb() {
  return { version: 1, programs: [], sessions: [], active: null, settings: { rest: 90 } };
}
function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      const base = emptyDb();
      return { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) } };
    }
  } catch (e) { /* stockage indisponible ou corrompu */ }
  return emptyDb();
}
function saveDb() {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)); return true; }
  catch (e) { toast("⚠️ Impossible d'enregistrer sur cet appareil"); return false; }
}
let db = loadDb();

/* État de l'interface (non sauvegardé) */
const ui = { tab: 'today', day: todayIdx(), view: db.active ? 'session' : null, draft: null, sessionId: null, statKey: null, timer: null };

/* ---------- Historique & mesures ---------- */
function historyOf(name) {
  const k = nkey(name), out = [];
  for (const s of db.sessions) for (const e of s.exercises) if (nkey(e.name) === k) out.push({ session: s, entry: e });
  return out.sort((a, b) => (a.session.start < b.session.start ? -1 : 1));
}
function lastPerf(name, beforeIso) {
  const h = historyOf(name).filter(x => !beforeIso || x.session.start < beforeIso);
  return h[h.length - 1] || null;
}
function doneSets(e) { return (e.sets || []).filter(s => s.done); }

function metrics(e) {
  if (e.type === 'cardio') {
    const km = e.cardio?.km ?? null, min = e.cardio?.min ?? null;
    return { km, min, pace: km && min ? min / km : null };
  }
  const sets = doneSets(e);
  const reps = sets.map(s => s.reps || 0);
  const m = { maxReps: reps.length ? Math.max(...reps) : null, totalReps: reps.reduce((a, b) => a + b, 0) };
  if (e.type === 'muscu') {
    m.maxKg = null; m.rm = null; m.vol = 0;
    for (const s of sets) {
      if (s.kg == null) continue;
      if (m.maxKg == null || s.kg > m.maxKg) m.maxKg = s.kg;
      const rm = s.kg * (1 + (s.reps || 0) / 30); // estimation 1RM (Epley)
      if (m.rm == null || rm > m.rm) m.rm = rm;
      m.vol += s.kg * (s.reps || 0);
    }
  }
  return m;
}

function unitOf(e) { return e.type === 'pdc' && e.unit === 'sec' ? 's' : 'reps'; }

function summary(e) {
  if (e.type === 'cardio') {
    const m = metrics(e), parts = [];
    if (m.km != null) parts.push(fmtNum(m.km) + ' km');
    if (m.min != null) parts.push(fmtDuree(m.min));
    if (m.pace) parts.push(fmtPace(m.pace) + ' /km');
    return parts.join(' · ') || '—';
  }
  const sets = doneSets(e);
  if (!sets.length) return '—';
  if (e.type === 'muscu') {
    const kgs = new Set(sets.map(s => s.kg));
    if (kgs.size === 1) {
      const kg = sets[0].kg;
      return (kg != null ? fmtNum(kg) + ' kg × ' : '') + sets.map(s => fmtNum(s.reps)).join(', ');
    }
    return sets.map(s => `${fmtNum(s.kg)} kg×${fmtNum(s.reps)}`).join(' · ');
  }
  return sets.map(s => fmtNum(s.reps)).join(', ') + ' ' + unitOf(e);
}

/* Records d'un exercice (optionnellement avant une date) */
function records(name, beforeIso) {
  const h = historyOf(name).filter(x => !beforeIso || x.session.start < beforeIso);
  if (!h.length) return null;
  const r = { type: h[h.length - 1].entry.type, count: h.length };
  for (const { entry } of h) {
    const m = metrics(entry);
    if (entry.type === 'cardio') {
      if (m.km != null && (r.km == null || m.km > r.km)) r.km = m.km;
      if (m.pace && (r.pace == null || m.pace < r.pace)) r.pace = m.pace;
    } else {
      if (m.maxReps != null && (r.maxReps == null || m.maxReps > r.maxReps)) r.maxReps = m.maxReps;
      if (m.maxKg != null && (r.maxKg == null || m.maxKg > r.maxKg)) r.maxKg = m.maxKg;
      if (m.rm != null && (r.rm == null || m.rm > r.rm)) r.rm = m.rm;
    }
  }
  return r;
}
function recordText(e, r) {
  if (!r) return '';
  if (e.type === 'cardio') return [r.km != null ? `plus longue : ${fmtNum(r.km)} km` : '', r.pace ? `meilleure allure : ${fmtPace(r.pace)} /km` : ''].filter(Boolean).join(' · ');
  if (e.type === 'muscu' && r.maxKg != null) return `max ${fmtNum(r.maxKg)} kg · 1RM estimé ${fmtNum(Math.round(r.rm))} kg`;
  return r.maxReps != null ? `max ${fmtNum(r.maxReps)} ${unitOf(e)} en une série` : '';
}
/* Nouveaux records battus pendant une séance */
function newRecords(session) {
  const out = [];
  for (const e of session.exercises) {
    const prev = records(e.name, session.start);
    if (!prev) continue;
    const m = metrics(e);
    if (e.type === 'cardio') {
      if (m.km != null && prev.km != null && m.km > prev.km) out.push(`${e.name} : ${fmtNum(m.km)} km`);
      else if (m.pace && prev.pace && m.pace < prev.pace) out.push(`${e.name} : ${fmtPace(m.pace)} /km`);
    } else if (e.type === 'muscu' && m.maxKg != null && prev.maxKg != null && m.maxKg > prev.maxKg) {
      out.push(`${e.name} : ${fmtNum(m.maxKg)} kg`);
    } else if (m.maxReps != null && prev.maxReps != null && m.maxReps > prev.maxReps && (e.type !== 'muscu' || m.maxKg == null || m.maxKg >= (prev.maxKg ?? 0))) {
      out.push(`${e.name} : ${fmtNum(m.maxReps)} ${unitOf(e)}`);
    }
  }
  return out;
}

function knownExerciseNames() {
  const map = new Map();
  for (const p of db.programs) for (const e of p.exercises) if (e.name.trim()) map.set(nkey(e.name), e.name.trim());
  for (const s of db.sessions) for (const e of s.exercises) map.set(nkey(e.name), e.name.trim());
  return [...map.values()].sort((a, b) => a.localeCompare(b, 'fr'));
}

/* ---------- Rendu ---------- */
function render() {
  let html;
  if (ui.view === 'session' && db.active) html = viewSession();
  else if (ui.view === 'editProgram' && ui.draft) html = viewEditor();
  else if (ui.view === 'sessionDetail' && db.sessions.some(s => s.id === ui.sessionId)) html = viewSessionDetail();
  else {
    ui.view = null;
    html = ({ today: viewToday, programs: viewPrograms, history: viewHistory, stats: viewStats, settings: viewSettings }[ui.tab] || viewToday)();
  }
  $('#main').innerHTML = html;
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('on', !ui.view && b.dataset.tab === ui.tab));
  $('#tabbar').hidden = ui.view === 'session' || ui.view === 'editProgram';
}

const gearBtn = () => `<button class="icon-btn" data-act="tab" data-tab="settings" aria-label="Réglages">⚙️</button>`;

/* ----- Aujourd'hui ----- */
function viewToday() {
  const t = todayIdx(), d = ui.day;
  let h = `<header class="top"><div><p class="muted">${cap(new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))}</p><h1>Aujourd'hui</h1></div>${gearBtn()}</header>`;

  if (db.active) {
    const a = db.active;
    const all = a.exercises.flatMap(e => e.sets || []);
    h += `<button class="card resume" data-act="resume">
      <div class="card-head"><strong>${esc(a.programName)}</strong><span class="tag">En cours</span></div>
      <p class="muted small">Commencée à ${fmtTime(a.start)} · ${all.filter(s => s.done).length}/${all.length} séries</p>
      <div class="row"><span class="btn primary block">Reprendre la séance</span></div>
    </button>`;
  }

  h += `<div class="week">${JOURS_COURT.map((j, i) => {
    const has = db.programs.some(p => p.days.includes(i));
    return `<button data-act="pickDay" data-i="${i}" class="${i === d ? 'on' : ''} ${i === t ? 'today' : ''}">${j}<span class="dot ${has ? '' : 'empty'}"></span></button>`;
  }).join('')}</div>`;

  if (!db.programs.length) {
    return h + `<div class="card empty">
      <h3>Bienvenue 👋</h3>
      <p class="muted">Crée tes séances et attribue-les à des jours : elles s'afficheront ici le bon jour, avec ce que tu as fait la dernière fois.</p>
      <div class="row"><button class="btn primary" data-act="newProgram">Créer une séance</button><button class="btn" data-act="loadExample">Voir un exemple</button></div>
    </div>`;
  }

  const list = db.programs.filter(p => p.days.includes(d));
  h += `<h2>${d === t ? 'Séance du jour' : 'Séance du ' + JOURS[d].toLowerCase()}</h2>`;
  h += list.length ? list.map(p => programCard(p, 'detail')).join('')
    : `<div class="card"><p class="muted">Aucune séance prévue ${d === t ? "aujourd'hui" : 'ce jour-là'} — repos 😴</p></div>`;

  const others = db.programs.filter(p => !p.days.includes(d));
  if (others.length) h += `<h2>Autres séances</h2>` + others.map(p => programCard(p, 'compact')).join('');
  return h;
}

function programCard(p, mode) {
  const last = db.sessions.filter(s => s.programId === p.id).sort((a, b) => (a.start < b.start ? 1 : -1))[0];
  const doneToday = last && sameDay(last.start, new Date());
  const days = p.days.length ? [...p.days].sort().map(i => JOURS_COURT[i]).join(', ') : 'aucun jour';
  let h = `<div class="card">
    <div class="card-head"><h3>${esc(p.name)}</h3>${doneToday ? '<span class="tag ok">✓ Faite aujourd\'hui</span>' : ''}</div>
    <p class="muted small">${days} · ${p.exercises.length} exercice${p.exercises.length > 1 ? 's' : ''}${last ? ' · dernière fois ' + fmtDate(last.start) : ''}</p>`;
  if (mode === 'detail') {
    h += `<ul class="exlist">${p.exercises.map(e => {
      const lp = lastPerf(e.name);
      return `<li><strong>${esc(e.name)}</strong> <span class="muted small">${targetText(e)}</span>
        <div class="last">${lp ? 'Dernière fois : ' + esc(summary(lp.entry)) : 'Pas encore fait'}</div></li>`;
    }).join('')}</ul>`;
  }
  if (mode === 'manage') {
    h += `<div class="row"><button class="btn" data-act="editProgram" data-id="${p.id}">Modifier</button><button class="btn primary" data-act="start" data-id="${p.id}">Démarrer</button></div>`;
  } else {
    h += `<div class="row"><button class="btn ${mode === 'detail' ? 'primary' : ''}" data-act="start" data-id="${p.id}">${doneToday ? 'Refaire' : 'Démarrer'}</button></div>`;
  }
  return h + '</div>';
}

function targetText(e) {
  if (e.type === 'cardio') return [e.km ? fmtNum(e.km) + ' km' : '', e.min ? fmtDuree(e.min) : ''].filter(Boolean).join(' · ');
  if (!e.sets && !e.reps) return '';
  return `${e.sets || '?'} × ${e.reps || '?'}${e.type === 'pdc' && e.unit === 'sec' ? ' s' : ''}`;
}

/* ----- Séance en cours ----- */
function viewSession() {
  const a = db.active;
  let h = `<header class="top"><div>
      <button class="back" data-act="home">‹ Accueil</button>
      <h1>${esc(a.programName)}</h1>
      <p class="muted small">Commencée à ${fmtTime(a.start)}</p>
    </div></header>`;
  h += a.exercises.map((e, i) => exerciseBlock(e, i)).join('');
  h += `<div class="card">
    <h3>Ajouter un exercice</h3>
    <div class="inline-add">
      <input id="newExName" placeholder="Nom de l'exercice" list="exNames" autocomplete="off">
      <select id="newExType">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <button class="btn" data-act="addExSession">+ Ajouter</button>
    </div>
  </div>`;
  h += exNamesDatalist();
  h += `<div class="footer-actions">
    <button class="btn danger" data-act="cancelSession">Abandonner</button>
    <button class="btn primary" data-act="finishSession">Terminer la séance</button>
  </div>`;
  return h;
}

function exerciseBlock(e, i) {
  const lp = lastPerf(e.name);
  const rec = records(e.name);
  let h = `<section class="card ex">
    <div class="card-head"><h3>${esc(e.name)}</h3><span class="tag">${TYPES[e.type]}</span></div>
    <p class="last">${lp ? `<strong>Dernière fois</strong> (${fmtDate(lp.session.start)}) : ${esc(summary(lp.entry))}` : '🆕 Première fois sur cet exercice'}</p>
    ${rec ? `<p class="rec">🏆 Record : ${recordText(e, rec)}</p>` : ''}
    ${suggestion(e, lp, i)}`;

  if (e.type === 'cardio') {
    const c = e.cardio;
    const pace = c.km && c.min ? fmtPace(c.min / c.km) + ' /km' : '–';
    h += `<div class="sets">
      <div class="grid2">
        <div class="field"><label>Distance (km)</label><input inputmode="decimal" data-in="km" data-e="${i}" value="${esc(fmtIn(c.km))}"></div>
        <div class="field"><label>Durée (min)</label><input inputmode="decimal" data-in="min" data-e="${i}" value="${esc(fmtIn(c.min))}"></div>
      </div>
      <p class="pace" id="pace-${i}">Allure : ${pace}</p>
      <div class="row"><button class="btn ${c.done ? 'primary' : ''}" data-act="toggleCardio" data-e="${i}">${c.done ? '✓ Fait' : 'Marquer comme fait'}</button></div>
    </div>`;
  } else {
    const withKg = e.type === 'muscu';
    const u = e.type === 'pdc' && e.unit === 'sec' ? 'Secondes' : 'Reps';
    h += `<div class="sets">
      <div class="set-head ${withKg ? '' : 'two'}"><span>Série</span>${withKg ? '<span>Kg</span>' : ''}<span>${u}</span><span></span></div>
      ${e.sets.map((s, j) => `<div class="set ${withKg ? '' : 'two'} ${s.done ? 'done' : ''}">
        <span class="n">${j + 1}</span>
        ${withKg ? `<input inputmode="decimal" data-in="kg" data-e="${i}" data-s="${j}" value="${esc(fmtIn(s.kg))}" aria-label="Kg série ${j + 1}">` : ''}
        <input inputmode="numeric" data-in="reps" data-e="${i}" data-s="${j}" value="${esc(fmtIn(s.reps))}" aria-label="${u} série ${j + 1}">
        <button class="check" data-act="toggleSet" data-e="${i}" data-s="${j}" aria-label="Valider la série ${j + 1}">✓</button>
      </div>`).join('')}
      <div class="row">
        <button class="btn small" data-act="addSet" data-e="${i}">+ Série</button>
        <button class="btn small" data-act="removeSet" data-e="${i}" ${e.sets.length <= 1 ? 'disabled' : ''}>− Série</button>
        <button class="btn small danger" data-act="removeExSession" data-e="${i}">Retirer</button>
      </div>
    </div>`;
  }
  return h + '</section>';
}

function suggestion(e, lp, i) {
  if (!lp || e.bumped || e.type === 'cardio') return '';
  const sets = doneSets(lp.entry);
  const target = e.target?.reps;
  if (!sets.length || !target) return '';
  const okSets = e.target.sets ? sets.length >= e.target.sets : true;
  const okReps = sets.every(s => (s.reps || 0) >= target);
  if (!okSets || !okReps) return '';
  if (e.type === 'muscu' && sets[0].kg != null) {
    return `<div class="tip"><span>💪 Objectif atteint la dernière fois → monte la charge</span><button class="btn small" data-act="bump" data-e="${i}" data-v="2.5">+2,5 kg</button></div>`;
  }
  if (e.type === 'pdc') {
    const sec = e.unit === 'sec';
    return `<div class="tip"><span>💪 Objectif atteint la dernière fois → un peu plus</span><button class="btn small" data-act="bump" data-e="${i}" data-v="${sec ? 5 : 1}">+${sec ? '5 s' : '1 rep'}</button></div>`;
  }
  return '';
}

/* Prépare un exercice de séance à partir du programme + historique */
function buildEntry(ex) {
  const lp = lastPerf(ex.name);
  const e = { name: ex.name, type: ex.type, unit: ex.unit || 'reps', rest: ex.rest ?? null, target: { sets: ex.sets ?? null, reps: ex.reps ?? null } };
  if (ex.type === 'cardio') {
    e.cardio = { km: lp?.entry.cardio?.km ?? ex.km ?? null, min: lp?.entry.cardio?.min ?? ex.min ?? null, done: false };
    return e;
  }
  const last = lp ? doneSets(lp.entry) : [];
  const n = ex.sets || last.length || 3;
  e.sets = Array.from({ length: n }, (_, k) => {
    const ls = last[k] || last[last.length - 1];
    return { kg: ex.type === 'muscu' ? (ls?.kg ?? null) : null, reps: ls?.reps ?? ex.reps ?? null, done: false };
  });
  return e;
}

/* ----- Programmes ----- */
function viewPrograms() {
  let h = `<header class="top"><h1>Programmes</h1>${gearBtn()}</header>
    <p class="muted small">Une séance = une liste d'exercices + les jours où tu la fais.</p>`;
  if (!db.programs.length) h += `<div class="card empty"><p class="muted">Aucune séance pour l'instant.</p><div class="row"><button class="btn" data-act="loadExample">Voir un exemple</button></div></div>`;
  h += [...db.programs].sort((a, b) => (Math.min(...a.days, 9) - Math.min(...b.days, 9))).map(p => programCard(p, 'manage')).join('');
  h += `<button class="btn primary block" data-act="newProgram">+ Nouvelle séance</button>`;
  return h;
}

function viewEditor() {
  const p = ui.draft;
  const isNew = !db.programs.some(x => x.id === p.id);
  let h = `<header class="top"><div><button class="back" data-act="cancelEdit">‹ Annuler</button><h1>${isNew ? 'Nouvelle séance' : 'Modifier la séance'}</h1></div></header>
    <div class="card">
      <div class="field"><label>Nom de la séance</label><input data-draft="name" value="${esc(p.name)}" placeholder="ex. Push, Jambes, Footing…"></div>
      <div class="field"><label>Jours</label><div class="days">${JOURS_COURT.map((j, i) => `<button data-act="toggleDay" data-i="${i}" class="${p.days.includes(i) ? 'on' : ''}">${j}</button>`).join('')}</div></div>
    </div>
    <h2>Exercices</h2>`;
  h += p.exercises.map((e, i) => {
    let f = `<div class="card">
      <div class="card-head"><strong>${i + 1}.</strong>
        <span><button class="icon-btn" data-act="moveEx" data-i="${i}" data-d="-1" aria-label="Monter">↑</button><button class="icon-btn" data-act="moveEx" data-i="${i}" data-d="1" aria-label="Descendre">↓</button><button class="icon-btn" data-act="delEx" data-i="${i}" aria-label="Supprimer">✕</button></span>
      </div>
      <div class="field"><label>Exercice</label><input data-dx="${i}" data-df="name" value="${esc(e.name)}" placeholder="ex. Tirage poulie haute" list="exNames" autocomplete="off"></div>
      <div class="grid2">
        <div class="field"><label>Type</label><select data-dx="${i}" data-df="type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${e.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>`;
    if (e.type === 'pdc') f += `<div class="field"><label>Compté en</label><select data-dx="${i}" data-df="unit"><option value="reps" ${e.unit !== 'sec' ? 'selected' : ''}>Répétitions</option><option value="sec" ${e.unit === 'sec' ? 'selected' : ''}>Secondes</option></select></div>`;
    else if (e.type === 'muscu') f += `<div class="field"><label>Repos (s)</label><input inputmode="numeric" data-dx="${i}" data-df="rest" value="${esc(fmtIn(e.rest))}" placeholder="${db.settings.rest}"></div>`;
    else f += `<div></div>`;
    f += `</div>`;
    if (e.type === 'cardio') {
      f += `<div class="grid2" style="margin-top:8px">
        <div class="field"><label>Objectif distance (km)</label><input inputmode="decimal" data-dx="${i}" data-df="km" value="${esc(fmtIn(e.km))}"></div>
        <div class="field"><label>Objectif durée (min)</label><input inputmode="decimal" data-dx="${i}" data-df="min" value="${esc(fmtIn(e.min))}"></div></div>`;
    } else {
      f += `<div class="grid3" style="margin-top:8px">
        <div class="field"><label>Séries</label><input inputmode="numeric" data-dx="${i}" data-df="sets" value="${esc(fmtIn(e.sets))}"></div>
        <div class="field"><label>${e.type === 'pdc' && e.unit === 'sec' ? 'Secondes' : 'Reps visées'}</label><input inputmode="numeric" data-dx="${i}" data-df="reps" value="${esc(fmtIn(e.reps))}"></div>
        ${e.type === 'pdc' ? `<div class="field"><label>Repos (s)</label><input inputmode="numeric" data-dx="${i}" data-df="rest" value="${esc(fmtIn(e.rest))}" placeholder="${db.settings.rest}"></div>` : '<div></div>'}
      </div>`;
    }
    return f + `</div>`;
  }).join('');
  h += `<button class="btn block" data-act="addEx">+ Ajouter un exercice</button>`;
  h += exNamesDatalist();
  h += `<div class="row" style="margin-top:20px"><button class="btn primary" data-act="saveProgram">Enregistrer</button></div>`;
  if (!isNew) h += `<div class="row"><button class="btn danger" data-act="deleteProgram">Supprimer cette séance</button></div>`;
  return h;
}

function exNamesDatalist() {
  return `<datalist id="exNames">${knownExerciseNames().map(n => `<option value="${esc(n)}">`).join('')}</datalist>`;
}

/* ----- Historique ----- */
function viewHistory() {
  let h = `<header class="top"><h1>Historique</h1>${gearBtn()}</header>`;
  const list = [...db.sessions].sort((a, b) => (a.start < b.start ? 1 : -1));
  if (!list.length) return h + `<div class="card empty"><p class="muted">Tes séances terminées apparaîtront ici.</p></div>`;
  let month = '';
  for (const s of list) {
    const m = cap(new Date(s.start).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));
    if (m !== month) { month = m; h += `<h2>${m}</h2>`; }
    const dur = s.end ? (new Date(s.end) - new Date(s.start)) / 60000 : null;
    const prs = newRecords(s).length;
    h += `<button class="card" data-act="openSession" data-id="${s.id}">
      <div class="card-head"><strong>${esc(s.programName)}</strong>${prs ? `<span class="tag ok">🏆 ${prs}</span>` : ''}</div>
      <p class="muted small">${cap(fmtDate(s.start))} · ${fmtDuree(dur)} · ${s.exercises.length} exercice${s.exercises.length > 1 ? 's' : ''}</p>
    </button>`;
  }
  return h;
}

function viewSessionDetail() {
  const s = db.sessions.find(x => x.id === ui.sessionId);
  const dur = s.end ? (new Date(s.end) - new Date(s.start)) / 60000 : null;
  const prs = newRecords(s);
  let h = `<header class="top"><div><button class="back" data-act="closeDetail">‹ Retour</button><h1>${esc(s.programName)}</h1>
    <p class="muted small">${cap(new Date(s.start).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))} · ${fmtTime(s.start)} · ${fmtDuree(dur)}</p></div></header>`;
  if (prs.length) h += `<div class="card"><strong>🏆 Nouveaux records</strong><ul>${prs.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>`;
  h += `<div class="card"><table class="table">${s.exercises.map(e => `<tr><td>${esc(e.name)}</td><td>${esc(summary(e))}</td></tr>`).join('')}</table></div>`;
  h += `<div class="row"><button class="btn danger" data-act="deleteSession" data-id="${s.id}">Supprimer cette séance</button></div>`;
  return h;
}

/* ----- Progrès ----- */
function viewStats() {
  let h = `<header class="top"><h1>Progrès</h1>${gearBtn()}</header>`;
  const now = new Date();
  const monday = new Date(now); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - todayIdx());
  const week = db.sessions.filter(s => new Date(s.start) >= monday).length;
  const month = db.sessions.filter(s => { const d = new Date(s.start); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length;
  h += `<div class="kpis"><div class="kpi"><strong>${week}</strong><span>séance${week > 1 ? 's' : ''} cette semaine</span></div>
    <div class="kpi"><strong>${month}</strong><span>séance${month > 1 ? 's' : ''} ce mois-ci</span></div></div>`;

  const names = [...new Set(db.sessions.flatMap(s => s.exercises.map(e => nkey(e.name))))];
  if (!names.length) return h + `<div class="card empty"><p class="muted">Termine une séance pour voir ta progression par exercice.</p></div>`;
  const labels = new Map(); for (const s of db.sessions) for (const e of s.exercises) labels.set(nkey(e.name), e.name);
  const sorted = names.sort((a, b) => labels.get(a).localeCompare(labels.get(b), 'fr'));
  if (!ui.statKey || !names.includes(ui.statKey)) ui.statKey = sorted[0];

  h += `<div class="field" style="margin-top:16px"><label>Exercice</label><select data-stat="1">${sorted.map(k => `<option value="${esc(k)}" ${k === ui.statKey ? 'selected' : ''}>${esc(labels.get(k))}</option>`).join('')}</select></div>`;

  const hist = historyOf(labels.get(ui.statKey));
  const type = hist[hist.length - 1].entry.type;
  const rec = records(labels.get(ui.statKey));
  const unitLbl = hist[hist.length - 1].entry.unit === 'sec' ? 's' : 'reps';

  let pts, fmt, title;
  if (type === 'cardio') {
    h += `<div class="kpis"><div class="kpi"><strong>${fmtNum(rec.km)} km</strong><span>plus longue distance</span></div><div class="kpi"><strong>${fmtPace(rec.pace)}</strong><span>meilleure allure /km</span></div></div>`;
    pts = hist.map(x => ({ d: x.session.start, y: metrics(x.entry).km })).filter(p => p.y != null);
    fmt = v => fmtNum(v) + ' km'; title = 'Distance par séance';
  } else if (type === 'muscu' && rec.maxKg != null) {
    h += `<div class="kpis"><div class="kpi"><strong>${fmtNum(rec.maxKg)} kg</strong><span>charge max</span></div><div class="kpi"><strong>${fmtNum(Math.round(rec.rm))} kg</strong><span>1RM estimé</span></div></div>`;
    pts = hist.map(x => ({ d: x.session.start, y: metrics(x.entry).maxKg })).filter(p => p.y != null);
    fmt = v => fmtNum(v) + ' kg'; title = 'Charge max par séance';
  } else {
    h += `<div class="kpis"><div class="kpi"><strong>${fmtNum(rec.maxReps)} ${unitLbl}</strong><span>meilleure série</span></div><div class="kpi"><strong>${rec.count}</strong><span>séances</span></div></div>`;
    pts = hist.map(x => ({ d: x.session.start, y: metrics(x.entry).totalReps }));
    fmt = v => fmtNum(v) + ' ' + unitLbl; title = 'Total par séance';
  }
  h += `<div class="card"><strong>${title}</strong>${chart(pts.slice(-20), fmt)}</div>`;
  h += `<div class="card"><strong>Dernières séances</strong><table class="table">${hist.slice(-10).reverse().map(x => `<tr><td>${fmtDate(x.session.start)}</td><td>${esc(summary(x.entry))}</td></tr>`).join('')}</table></div>`;
  return h;
}

function chart(pts, fmt) {
  if (pts.length < 2) return `<p class="muted small">Le graphique apparaît à partir de 2 séances.</p>`;
  const W = 320, H = 170, L = 52, R = 10, T = 12, B = 22;
  const ys = pts.map(p => p.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (min === max) { min -= 1; max += 1; }
  const x = i => L + i * (W - L - R) / (pts.length - 1);
  const y = v => T + (max - v) * (H - T - B) / (max - min);
  const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Graphique de progression">
    <line class="grid" x1="${L}" x2="${W - R}" y1="${y(max)}" y2="${y(max)}"/>
    <line class="grid" x1="${L}" x2="${W - R}" y1="${y(min)}" y2="${y(min)}"/>
    <text class="lbl" x="${L - 6}" y="${y(max) + 4}" text-anchor="end">${esc(fmt(max))}</text>
    <text class="lbl" x="${L - 6}" y="${y(min) + 4}" text-anchor="end">${esc(fmt(min))}</text>
    <polyline class="ln" points="${line}"/>
    ${pts.map((p, i) => `<circle class="pt" cx="${x(i).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="3.5"><title>${esc(fmtDate(p.d))} : ${esc(fmt(p.y))}</title></circle>`).join('')}
    <text class="lbl" x="${L}" y="${H - 4}">${fmtShort(pts[0].d)}</text>
    <text class="lbl" x="${W - R}" y="${H - 4}" text-anchor="end">${fmtShort(pts[pts.length - 1].d)}</text>
  </svg>`;
}

/* ----- Réglages ----- */
function viewSettings() {
  return `<header class="top"><div><button class="back" data-act="tab" data-tab="today">‹ Accueil</button><h1>Réglages</h1></div></header>
    <div class="card">
      <div class="field"><label>Temps de repos par défaut (secondes)</label><input inputmode="numeric" data-setting="rest" value="${esc(fmtIn(db.settings.rest))}"></div>
    </div>
    <div class="card">
      <h3>Sauvegarde</h3>
      <p class="muted small">Tes données sont uniquement sur ce téléphone. Exporte-les de temps en temps (et avant de changer de téléphone).</p>
      <div class="row"><button class="btn" data-act="export">Exporter</button><button class="btn" data-act="import">Importer</button></div>
    </div>
    <div class="card">
      <h3>Données</h3>
      <p class="muted small">${db.programs.length} séance(s) programmée(s) · ${db.sessions.length} séance(s) enregistrée(s)</p>
      <div class="row"><button class="btn" data-act="loadExample">Ajouter l'exemple</button><button class="btn danger" data-act="wipe">Tout effacer</button></div>
    </div>`;
}

/* ---------- Actions ---------- */
function activeEx(d) { return db.active.exercises[+d.e]; }

const actions = {
  tab(d) { ui.tab = d.tab; ui.view = null; if (d.tab === 'today') ui.day = todayIdx(); render(); window.scrollTo(0, 0); },
  pickDay(d) { ui.day = +d.i; render(); },
  home() { ui.view = null; ui.tab = 'today'; render(); window.scrollTo(0, 0); },
  resume() { ui.view = 'session'; render(); keepAwake(true); window.scrollTo(0, 0); },

  start(d) {
    const p = db.programs.find(x => x.id === d.id);
    if (!p) return;
    if (db.active && !confirm(`Une séance « ${db.active.programName} » est déjà en cours. La remplacer ?`)) return;
    db.active = { id: uid(), programId: p.id, programName: p.name, start: new Date().toISOString(), exercises: p.exercises.filter(e => e.name.trim()).map(buildEntry) };
    saveDb();
    ui.view = 'session'; render(); keepAwake(true); window.scrollTo(0, 0);
  },
  toggleSet(d) {
    const s = activeEx(d).sets[+d.s];
    s.done = !s.done;
    saveDb(); render();
    if (s.done) startTimer(activeEx(d).rest ?? db.settings.rest);
  },
  toggleCardio(d) { const c = activeEx(d).cardio; c.done = !c.done; saveDb(); render(); },
  addSet(d) {
    const e = activeEx(d), last = e.sets[e.sets.length - 1];
    e.sets.push({ kg: last?.kg ?? null, reps: last?.reps ?? null, done: false });
    saveDb(); render();
  },
  removeSet(d) { const e = activeEx(d); if (e.sets.length > 1) { e.sets.pop(); saveDb(); render(); } },
  removeExSession(d) {
    const e = activeEx(d);
    if (!confirm(`Retirer « ${e.name} » de cette séance ?`)) return;
    db.active.exercises.splice(+d.e, 1); saveDb(); render();
  },
  bump(d) {
    const e = activeEx(d), v = +d.v;
    for (const s of e.sets) {
      if (s.done) continue;
      if (e.type === 'muscu') s.kg = Math.round(((s.kg ?? 0) + v) * 100) / 100;
      else s.reps = (s.reps ?? 0) + v;
    }
    e.bumped = true; saveDb(); render(); toast('Objectif mis à jour 💪');
  },
  addExSession() {
    const name = $('#newExName').value.trim();
    if (!name) { toast("Donne un nom à l'exercice"); return; }
    const type = $('#newExType').value;
    db.active.exercises.push(buildEntry({ name, type, unit: 'reps' }));
    saveDb(); render();
  },
  finishSession() {
    const a = db.active;
    // Séries modifiées à la main mais pas cochées (les valeurs pré-remplies seules ne comptent pas)
    const pending = a.exercises.flatMap(e => (e.sets || []).filter(s => !s.done && s.edited && s.reps != null));
    if (pending.length) {
      const count = confirm(`${pending.length} série(s) remplie(s) mais non cochée(s).\n\nOK = les compter comme faites\nAnnuler = les ignorer`);
      if (count) pending.forEach(s => { s.done = true; });
    }
    const exercises = a.exercises
      .map(e => e.type === 'cardio' ? e : { ...e, sets: doneSets(e).map(({ edited, ...s }) => s) })
      .filter(e => e.type === 'cardio' ? (e.cardio.done || e.cardio.edited) : e.sets.length)
      .map(e => { const { bumped, ...rest } = e; return rest; });
    if (!exercises.length) {
      if (!confirm("Aucune série validée. Terminer quand même sans rien enregistrer ?")) return;
      db.active = null; saveDb(); stopTimer(); keepAwake(false); actions.home(); return;
    }
    const session = { ...a, exercises, end: new Date().toISOString() };
    db.sessions.push(session);
    db.active = null;
    saveDb(); stopTimer(); keepAwake(false);
    ui.view = 'sessionDetail'; ui.sessionId = session.id; ui.tab = 'history';
    render(); window.scrollTo(0, 0);
    toast('Séance enregistrée 💪');
  },
  cancelSession() {
    if (!confirm('Abandonner cette séance ? Rien ne sera enregistré.')) return;
    db.active = null; saveDb(); stopTimer(); keepAwake(false); actions.home();
  },

  /* Programmes */
  newProgram() {
    ui.draft = { id: uid(), name: '', days: ui.tab === 'today' ? [ui.day] : [], exercises: [newDraftEx()] };
    ui.view = 'editProgram'; render(); window.scrollTo(0, 0);
  },
  editProgram(d) {
    const p = db.programs.find(x => x.id === d.id);
    ui.draft = JSON.parse(JSON.stringify(p));
    ui.view = 'editProgram'; render(); window.scrollTo(0, 0);
  },
  cancelEdit() { ui.draft = null; ui.view = null; render(); },
  toggleDay(d) {
    const i = +d.i, days = ui.draft.days;
    ui.draft.days = days.includes(i) ? days.filter(x => x !== i) : [...days, i].sort();
    render();
  },
  addEx() { ui.draft.exercises.push(newDraftEx()); render(); },
  delEx(d) { ui.draft.exercises.splice(+d.i, 1); render(); },
  moveEx(d) {
    const i = +d.i, j = i + +d.d, ex = ui.draft.exercises;
    if (j < 0 || j >= ex.length) return;
    [ex[i], ex[j]] = [ex[j], ex[i]]; render();
  },
  saveProgram() {
    const p = ui.draft;
    p.name = p.name.trim();
    if (!p.name) { toast('Donne un nom à la séance'); return; }
    p.exercises = p.exercises.map(e => ({ ...e, name: e.name.trim() })).filter(e => e.name);
    if (!p.exercises.length) { toast('Ajoute au moins un exercice'); return; }
    const i = db.programs.findIndex(x => x.id === p.id);
    if (i >= 0) db.programs[i] = p; else db.programs.push(p);
    saveDb(); ui.draft = null; ui.view = null; render(); toast('Séance enregistrée');
  },
  deleteProgram() {
    if (!confirm(`Supprimer la séance « ${ui.draft.name} » ? L'historique est conservé.`)) return;
    db.programs = db.programs.filter(x => x.id !== ui.draft.id);
    saveDb(); ui.draft = null; ui.view = null; render();
  },

  /* Historique */
  openSession(d) { ui.sessionId = d.id; ui.view = 'sessionDetail'; render(); window.scrollTo(0, 0); },
  closeDetail() { ui.view = null; ui.tab = 'history'; render(); },
  deleteSession(d) {
    if (!confirm('Supprimer définitivement cette séance de l\'historique ?')) return;
    db.sessions = db.sessions.filter(s => s.id !== d.id);
    saveDb(); ui.view = null; render();
  },

  /* Minuteur */
  timerAdd() { if (ui.timer) { ui.timer.end += 15000; tickTimer(); } },
  timerStop() { stopTimer(); },

  /* Réglages */
  export() {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `seances-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  import() { $('#importFile').click(); },
  loadExample() {
    db.programs.push(...examplePrograms());
    saveDb(); ui.tab = 'today'; ui.view = null; render(); toast('Exemple ajouté — modifie-le à ta sauce');
  },
  wipe() {
    if (!confirm('Tout effacer (séances, historique, réglages) ?')) return;
    if (!confirm('Vraiment ? Cette action est définitive. Pense à exporter avant.')) return;
    db = emptyDb(); saveDb(); stopTimer(); ui.tab = 'today'; ui.view = null; render();
  },
};

function newDraftEx() { return { id: uid(), name: '', type: 'muscu', unit: 'reps', sets: 3, reps: 10, rest: null }; }

function examplePrograms() {
  const ex = (name, type, sets, reps, extra = {}) => ({ id: uid(), name, type, unit: 'reps', sets, reps, rest: null, ...extra });
  return [
    { id: uid(), name: 'Push (pecs, épaules, triceps)', days: [0], exercises: [
      ex('Développé couché', 'muscu', 4, 8, { rest: 120 }),
      ex('Développé incliné haltères', 'muscu', 3, 10),
      ex('Écarté poulie vis-à-vis', 'muscu', 3, 12),
      ex('Élévations latérales', 'muscu', 3, 15),
      ex('Extension triceps poulie', 'muscu', 3, 12),
    ] },
    { id: uid(), name: 'Circuit maison', days: [1], exercises: [
      ex('Pompes', 'pdc', 4, 15),
      ex('Squats poids du corps', 'pdc', 4, 20),
      ex('Gainage', 'pdc', 3, 45, { unit: 'sec' }),
    ] },
    { id: uid(), name: 'Pull + jambes', days: [3], exercises: [
      ex('Tirage poulie haute', 'muscu', 4, 10),
      ex('Rowing poulie basse', 'muscu', 3, 10),
      ex('Squat', 'muscu', 4, 8, { rest: 150 }),
      ex('Presse à cuisses', 'muscu', 3, 12),
      ex('Curl biceps', 'muscu', 3, 12),
    ] },
    { id: uid(), name: 'Footing', days: [5], exercises: [
      ex('Course', 'cardio', null, null, { km: 5, min: 30 }),
    ] },
  ];
}

/* ---------- Événements ---------- */
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const fn = actions[b.dataset.act];
  if (fn) { ev.preventDefault(); fn(b.dataset, b); }
});

document.addEventListener('input', ev => {
  const t = ev.target;
  if (t.tagName === 'SELECT') return;
  const d = t.dataset;

  // Saisie pendant la séance (pas de re-rendu pour garder le focus)
  if (d.in && db.active) {
    const e = db.active.exercises[+d.e];
    if (!e) return;
    const v = num(t.value);
    if (e.type === 'cardio') {
      e.cardio[d.in] = v;
      e.cardio.edited = true;
      const p = $('#pace-' + d.e);
      if (p) p.textContent = 'Allure : ' + (e.cardio.km && e.cardio.min ? fmtPace(e.cardio.min / e.cardio.km) + ' /km' : '–');
    } else {
      e.sets[+d.s][d.in] = v;
      e.sets[+d.s].edited = true; // saisi à la main (≠ pré-rempli)
    }
    saveDb();
    return;
  }
  // Éditeur de séance
  if (d.draft && ui.draft) { ui.draft[d.draft] = t.value; return; }
  if (d.dx != null && ui.draft) {
    const e = ui.draft.exercises[+d.dx];
    e[d.df] = d.df === 'name' ? t.value : num(t.value);
    return;
  }
  // Réglages
  if (d.setting) {
    const v = num(t.value);
    if (v != null && v >= 0) { db.settings[d.setting] = Math.round(v); saveDb(); }
  }
});

document.addEventListener('change', ev => {
  const t = ev.target, d = t.dataset;
  if (t.tagName !== 'SELECT') return;
  if (d.dx != null && ui.draft) {
    const e = ui.draft.exercises[+d.dx];
    e[d.df] = t.value;
    if (d.df === 'type' && t.value === 'cardio') { e.sets = null; e.reps = null; }
    if (d.df === 'type' && t.value !== 'cardio' && !e.sets) { e.sets = 3; e.reps = 10; }
    render();
  }
  if (d.stat) { ui.statKey = t.value; render(); }
});

$('#importFile').addEventListener('change', async ev => {
  const file = ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.programs) || !Array.isArray(data.sessions)) throw new Error('format');
    if (!confirm(`Remplacer les données actuelles par cette sauvegarde (${data.programs.length} séances programmées, ${data.sessions.length} séances enregistrées) ?`)) return;
    const base = emptyDb();
    db = { ...base, ...data, settings: { ...base.settings, ...(data.settings || {}) } };
    saveDb(); ui.view = null; ui.tab = 'today'; render(); toast('Sauvegarde importée ✅');
  } catch (e) {
    toast("Ce fichier n'est pas une sauvegarde valide");
  }
});

/* ---------- Minuteur de repos ---------- */
let timerInt = null, audioCtx = null;
function startTimer(sec) {
  if (!sec) return;
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* pas de son */ }
  ui.timer = { end: Date.now() + sec * 1000 };
  $('#timerLabel').textContent = 'Repos';
  clearInterval(timerInt);
  timerInt = setInterval(tickTimer, 250);
  tickTimer();
}
function tickTimer() {
  const el = $('#timer');
  if (!ui.timer) { el.hidden = true; clearInterval(timerInt); return; }
  const left = Math.ceil((ui.timer.end - Date.now()) / 1000);
  if (left <= 0) {
    ui.timer = null; clearInterval(timerInt);
    alarm();
    $('#timerLabel').textContent = "C'est reparti ! 🔥";
    $('#timerVal').textContent = '';
    el.hidden = false;
    setTimeout(() => { if (!ui.timer) el.hidden = true; }, 3000);
    return;
  }
  el.hidden = false;
  $('#timerVal').textContent = mmss(left);
}
function stopTimer() { ui.timer = null; clearInterval(timerInt); $('#timer').hidden = true; }
function alarm() {
  try { navigator.vibrate && navigator.vibrate([250, 120, 250]); } catch (e) { /* */ }
  try {
    if (!audioCtx) return;
    [0, 0.25, 0.5].forEach(t => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 880; g.gain.value = 0.15;
      o.connect(g); g.connect(audioCtx.destination);
      o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.15);
    });
  } catch (e) { /* */ }
}

/* ---------- Écran allumé pendant la séance ---------- */
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release(); wakeLock = null;
    }
  } catch (e) { /* non supporté */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && db.active && ui.view === 'session') keepAwake(true);
});

/* ---------- Toast ---------- */
let toastT = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2500);
}

/* ---------- Démarrage ---------- */
render();
if (db.active) keepAwake(true);
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { /* */ }
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
