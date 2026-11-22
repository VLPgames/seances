'use strict';

/* =========================================================
   Séances — V2
   - Séance du jour directement à l'ouverture
   - Un exercice = une ligne (4 × 8 · 42,5 kg) pré-remplie
   - Après chaque exercice : ressenti + note pour la prochaine fois
   - Compte + synchro multi-appareils (Supabase), hors ligne d'abord
   ========================================================= */

/* ---------- Utilitaires ---------- */
const $ = s => document.querySelector(s);
const DB_KEY = 'seances.v1';      // même clé qu'en V1 : les données sont migrées
const AUTH_KEY = 'seances.auth';
const WELCOME_KEY = 'seances.welcomed';
const CFG = window.SEANCES_CONFIG || {};
const TABS = ['today', 'programs', 'history', 'stats', 'profile'];
const TAB_LABELS = { today: 'Accueil', programs: 'Séances', history: 'Historique', stats: 'Progrès', profile: 'Profil' };
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const JOURS_COURT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const TYPES = { muscu: 'Muscu', pdc: 'Poids du corps', cardio: 'Cardio' };
const FEEL = { hard: { e: '😮‍💨', t: 'Trop dur' }, ok: { e: '👌', t: 'Parfait' }, easy: { e: '💪', t: 'Trop facile' } };

const now = () => Date.now();
const uid = () => now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const r2 = n => Math.round(n * 100) / 100;
const nkey = name => String(name || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
const todayIdx = () => (new Date().getDay() + 6) % 7; // 0 = lundi
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const fmtNum = n => n == null ? '–' : String(r2(n)).replace('.', ',');
const fmtIn = n => n == null ? '' : String(n).replace('.', ',');
const fmtDate = iso => new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtShort = iso => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' });
const fmtTime = iso => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const fmtDuree = min => {
  if (min == null) return '–';
  const m = Math.round(min);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
};
const fmtPace = p => {
  if (!p) return '–';
  let m = Math.floor(p), s = Math.round((p - m) * 60);
  if (s === 60) { m++; s = 0; }
  return `${m}:${String(s).padStart(2, '0')}`;
};
const mmss = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const stableStr = v => JSON.stringify(v, (k, val) => (val && typeof val === 'object' && !Array.isArray(val))
  ? Object.keys(val).sort().reduce((o, key) => { o[key] = val[key]; return o; }, {}) : val);
const isTyping = () => { const a = document.activeElement; return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); };

/* Icônes (traits fins) */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  dumbbell: '<path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  chart: '<path d="M3 20h18M6 16l4-5 3 3 5-7"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  badge: '<path d="M12 3l2.2 1.6 2.7-.1.8 2.6 2.2 1.6-.9 2.6.9 2.6-2.2 1.6-.8 2.6-2.7-.1L12 21l-2.2-1.6-2.7.1-.8-2.6-2.2-1.6.9-2.6-.9-2.6 2.2-1.6.8-2.6 2.7.1z"/><path d="m9 12 2 2 4-4"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 11a3.5 3.5 0 0 0 1 7z"/>',
};
const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

/* ---------- Données locales ---------- */
function emptyDb() {
  return { version: 2, programs: [], sessions: [], active: null, activeClearedAt: 0, deleted: {}, settings: { rest: 90, weeklyGoal: 3 }, settingsU: 0 };
}

/* Conversion d'un exercice V1 (série par série) vers V2 (une ligne) */
function migrateEntry(e, done) {
  if (e.type === 'cardio') {
    if (e.cardio) { e.km = e.cardio.km ?? null; e.min = e.cardio.min ?? null; delete e.cardio; }
  } else if (Array.isArray(e.sets)) {
    const ds = e.sets.filter(s => s.done !== false);
    const src = ds.length ? ds : e.sets;
    const reps = src.map(s => s.reps || 0);
    const kgs = src.map(s => s.kg).filter(v => v != null);
    e.sets = src.length || null;
    e.reps = reps.length ? Math.max(...reps) : null;
    e.kg = kgs.length ? Math.max(...kgs) : null;
  }
  delete e.target; delete e.bumped;
  e.feel = e.feel ?? null;
  e.note = e.note ?? '';
  e.done = done;
  return e;
}
function migrate(d) {
  const base = emptyDb();
  d = { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) }, deleted: d.deleted || {} };
  if ((d.version || 1) < 2) {
    d.programs.forEach(p => { p.u = p.u || 1; p.exercises.forEach(e => { if (e.kg === undefined) e.kg = null; }); });
    d.sessions.forEach(s => { s.u = s.u || 1; s.exercises = s.exercises.map(e => migrateEntry(e, true)); });
    if (d.active) { d.active.u = d.active.u || 1; d.active.exercises = d.active.exercises.map(e => migrateEntry(e, false)); }
    d.version = 2;
  }
  return d;
}
function readLocal() {
  try { const raw = localStorage.getItem(DB_KEY); if (raw) return migrate(JSON.parse(raw)); } catch (e) { /* */ }
  return emptyDb();
}
function writeLocal() {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)); return true; }
  catch (e) { toast("⚠️ Impossible d'enregistrer sur cet appareil"); return false; }
}
function saveDb() { writeLocal(); scheduleSync(); }
function touchActive() { if (db.active) db.active.u = now(); }

let db = readLocal();
writeLocal();

/* ---------- Fusion (synchro entre appareils) ---------- */
function mergeList(a, b, deleted) {
  const m = new Map();
  for (const x of [...(a || []), ...(b || [])]) {
    const cur = m.get(x.id);
    if (!cur || (x.u || 0) > (cur.u || 0)) m.set(x.id, x);
  }
  return [...m.values()].filter(x => !(deleted[x.id] && deleted[x.id] >= (x.u || 0)));
}
function mergeDb(a, b) {
  const deleted = { ...(a.deleted || {}) };
  for (const [k, v] of Object.entries(b.deleted || {})) deleted[k] = Math.max(deleted[k] || 0, v);
  const out = { version: 2, deleted };
  out.programs = mergeList(a.programs, b.programs, deleted);
  out.sessions = mergeList(a.sessions, b.sessions, deleted);
  out.activeClearedAt = Math.max(a.activeClearedAt || 0, b.activeClearedAt || 0);
  let act = [a.active, b.active].filter(Boolean).sort((x, y) => (y.u || 0) - (x.u || 0))[0] || null;
  if (act && (out.activeClearedAt >= (act.u || 0) || out.sessions.some(s => s.id === act.id))) act = null;
  out.active = act;
  const takeB = (b.settingsU || 0) > (a.settingsU || 0);
  out.settings = { ...emptyDb().settings, ...(takeB ? b.settings : a.settings) };
  out.settingsU = Math.max(a.settingsU || 0, b.settingsU || 0);
  return out;
}

/* ---------- Compte & synchro (Supabase, via fetch) ---------- */
const cloudOn = () => !!(CFG.supabaseUrl && CFG.supabaseKey);
let auth = (() => { try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch (e) { return null; } })();
function storeAuth() { try { auth ? localStorage.setItem(AUTH_KEY, JSON.stringify(auth)) : localStorage.removeItem(AUTH_KEY); } catch (e) { /* */ } }
const welcomed = () => { try { return !!localStorage.getItem(WELCOME_KEY); } catch (e) { return true; } };
const markWelcomed = () => { try { localStorage.setItem(WELCOME_KEY, '1'); } catch (e) { /* */ } };

function authError(j, status) {
  const raw = (j && (j.msg || j.error_description || j.message || j.error)) || '';
  const t = raw.toLowerCase();
  let msg = raw || `Erreur ${status}`;
  if (t.includes('invalid login')) msg = 'Email ou mot de passe incorrect';
  else if (t.includes('already registered') || t.includes('already been registered')) msg = 'Un compte existe déjà avec cet email : connecte-toi';
  else if (t.includes('not confirmed')) msg = 'Confirme ton email (lien reçu dans ta boîte mail), puis connecte-toi';
  else if (t.includes('password') && t.includes('characters')) msg = 'Mot de passe trop court (6 caractères minimum)';
  else if (t.includes('rate limit')) msg = 'Trop de tentatives, réessaie dans quelques minutes';
  else if (t.includes('invalid') && t.includes('email')) msg = 'Adresse email invalide';
  const err = new Error(msg); err.http = status; return err;
}
async function authReq(path, body) {
  let r;
  try {
    r = await fetch(`${CFG.supabaseUrl}/auth/v1/${path}`, {
      method: 'POST', headers: { apikey: CFG.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
  } catch (e) { throw new Error('Pas de connexion internet'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw authError(j, r.status);
  return j;
}
function setAuth(j) {
  auth = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: now() + (j.expires_in || 3600) * 1000, user: { id: j.user.id, email: j.user.email } };
  storeAuth();
}
async function apiSignIn(email, password) { setAuth(await authReq('token?grant_type=password', { email, password })); }
async function apiSignUp(email, password) {
  const j = await authReq('signup', { email, password });
  if (j.access_token) { setAuth(j); return true; }
  return false; // confirmation par email demandée
}
async function getToken() {
  if (!auth) return null;
  if (now() > auth.expires_at - 60000) {
    try { setAuth(await authReq('token?grant_type=refresh_token', { refresh_token: auth.refresh_token })); }
    catch (e) {
      if (e.http === 400 || e.http === 401) { auth = null; storeAuth(); toast('Session expirée : reconnecte-toi'); render(); }
      return null;
    }
  }
  return auth.access_token;
}
async function pull() {
  const t = await getToken(); if (!t) throw new Error('auth');
  const r = await fetch(`${CFG.supabaseUrl}/rest/v1/user_data?select=data&user_id=eq.${encodeURIComponent(auth.user.id)}`, {
    headers: { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + t },
  });
  if (!r.ok) throw new Error('pull ' + r.status);
  const rows = await r.json();
  return rows[0] ? rows[0].data : null;
}
async function push(data) {
  const t = await getToken(); if (!t) throw new Error('auth');
  const r = await fetch(`${CFG.supabaseUrl}/rest/v1/user_data?on_conflict=user_id`, {
    method: 'POST',
    headers: { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: auth.user.id, data, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error('push ' + r.status);
}

let syncing = false, syncAgain = false, syncTimer = null;
function scheduleSync(delay = 1500) {
  if (!cloudOn() || !auth) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(sync, delay);
}
async function sync() {
  if (!cloudOn() || !auth) return;
  if (syncing) { syncAgain = true; return; }
  syncing = true; setSyncState('busy');
  try {
    const remoteRaw = await pull();
    const remote = remoteRaw ? migrate(remoteRaw) : null;
    const merged = remote ? mergeDb(db, remote) : db;
    if (stableStr(merged) !== stableStr(db)) {
      db = merged; writeLocal();
      if (!isTyping() && !ui.sheet) render();
    }
    if (!remoteRaw || stableStr(merged) !== stableStr(remoteRaw)) await push(merged);
    setSyncState('ok');
  } catch (e) {
    setSyncState('err');
  } finally {
    syncing = false;
    if (syncAgain) { syncAgain = false; scheduleSync(300); }
  }
}
function setSyncState(s) {
  ui.sync = { state: s, at: s === 'ok' ? now() : ui.sync.at };
  const el = $('#syncText'); if (el) el.textContent = syncText();
}
function syncText() {
  if (!auth) return '';
  const s = ui.sync;
  if (s.state === 'busy') return 'Synchronisation…';
  if (s.state === 'err') return 'Hors ligne — synchro dès que possible';
  if (s.state === 'ok') {
    const min = Math.round((now() - s.at) / 60000);
    return 'Synchronisé ' + (min < 1 ? "à l'instant" : `il y a ${min} min`);
  }
  return 'Synchronisation en attente';
}

/* ---------- État de l'interface ---------- */
const ui = {
  tab: 'today', day: todayIdx(), view: null, draft: null, sheet: null, sessionId: null, statKey: null,
  timer: null, editIdx: null, fbIdx: null, sync: { state: 'idle', at: 0 }, suppressClick: false,
};
if (db.active) ui.view = 'session';
else if (cloudOn() && !auth && !welcomed()) ui.view = 'auth';

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
const isSec = e => e.type === 'pdc' && e.unit === 'sec';
const unitOf = e => isSec(e) ? 's' : 'reps';

function metrics(e) {
  if (e.type === 'cardio') return { km: e.km ?? null, min: e.min ?? null, pace: e.km && e.min ? e.min / e.km : null };
  const m = { maxReps: e.reps ?? null, totalReps: (e.sets || 0) * (e.reps || 0) };
  if (e.type === 'muscu' && e.kg != null) { m.maxKg = e.kg; m.rm = e.kg * (1 + (e.reps || 0) / 30); }
  return m;
}
function planText(e) {
  if (e.type === 'cardio') return [e.km != null ? fmtNum(e.km) + ' km' : '', e.min != null ? fmtDuree(e.min) : ''].filter(Boolean).join(' · ') || '—';
  let s = `${fmtNum(e.sets)} × ${fmtNum(e.reps)}${isSec(e) ? ' s' : ''}`;
  if (e.type === 'muscu' && e.kg != null) s += ` · ${fmtNum(e.kg)} kg`;
  return s;
}
function summary(e) {
  const m = metrics(e);
  return planText(e) + (e.type === 'cardio' && m.pace ? ` · ${fmtPace(m.pace)} /km` : '');
}
function records(name, beforeIso) {
  const h = historyOf(name).filter(x => !beforeIso || x.session.start < beforeIso);
  if (!h.length) return null;
  const r = { count: h.length };
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
function newRecords(session) {
  const out = [];
  for (const e of session.exercises) {
    const prev = records(e.name, session.start);
    if (!prev) continue;
    const m = metrics(e);
    if (e.type === 'cardio') {
      if (m.km != null && prev.km != null && m.km > prev.km) out.push(`${e.name} : ${fmtNum(m.km)} km`);
      else if (m.pace && prev.pace && m.pace < prev.pace) out.push(`${e.name} : ${fmtPace(m.pace)} /km`);
    } else if (m.maxKg != null && prev.maxKg != null && m.maxKg > prev.maxKg) {
      out.push(`${e.name} : ${fmtNum(m.maxKg)} kg`);
    } else if (m.maxReps != null && prev.maxReps != null && m.maxReps > prev.maxReps && (m.maxKg == null || m.maxKg >= (prev.maxKg ?? 0))) {
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
function weekCount() {
  const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - todayIdx());
  return db.sessions.filter(s => new Date(s.start) >= monday).length;
}

/* Prépare ce qu'il y a à faire pour un exercice : dernières valeurs + ajustement selon le ressenti */
function planFor(ex, useHistory = true) {
  const e = {
    name: ex.name, type: ex.type, unit: ex.unit || 'reps', rest: ex.rest ?? null,
    sets: ex.sets ?? null, reps: ex.reps ?? null, kg: ex.kg ?? null, km: ex.km ?? null, min: ex.min ?? null,
    done: false, feel: null, note: '', hint: '', lastNote: '',
  };
  const lp = useHistory ? lastPerf(ex.name) : null;
  if (!lp) return e;
  const l = lp.entry;
  if (e.type === 'cardio') { e.km = l.km ?? e.km; e.min = l.min ?? e.min; }
  else {
    e.sets = ex.sets ?? l.sets ?? 3;
    e.reps = l.reps ?? e.reps;
    if (e.type === 'muscu') e.kg = l.kg ?? e.kg;
    if (l.feel === 'easy') {
      if (e.type === 'muscu' && e.kg != null) { e.kg = r2(e.kg + 2.5); e.hint = '↑ +2,5 kg : c\'était trop facile la dernière fois'; }
      else if (e.reps != null) { const add = isSec(e) ? 5 : 1; e.reps += add; e.hint = `↑ +${add} ${isSec(e) ? 's' : 'rep'} : c'était trop facile la dernière fois`; }
    } else if (l.feel === 'hard') e.hint = 'On garde pareil : c\'était dur la dernière fois';
  }
  if (l.note) e.lastNote = l.note;
  return e;
}

/* ---------- Rendu ---------- */
function render(dir) {
  let html;
  if (ui.view === 'auth' && cloudOn()) html = viewAuth();
  else if (ui.view === 'session' && db.active) html = viewSession();
  else if (ui.view === 'editProgram' && ui.draft) html = viewEditor();
  else if (ui.view === 'sessionDetail' && db.sessions.some(s => s.id === ui.sessionId)) html = viewSessionDetail();
  else { ui.view = null; html = VIEWS[ui.tab](); }
  if (ui.sheet) html += viewSheet();
  const main = $('#main');
  main.innerHTML = html;
  if (dir) { main.classList.remove('in-left', 'in-right'); void main.offsetWidth; main.classList.add(dir > 0 ? 'in-right' : 'in-left'); }
  const showBar = !ui.view || ui.view === 'sessionDetail';
  $('#tabbar').hidden = !showBar;
  document.body.classList.toggle('with-bar', showBar);
  document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === ui.tab));
  moveBubble();
}
function goTab(tab) {
  const d = TABS.indexOf(tab) - TABS.indexOf(ui.tab);
  ui.tab = tab; ui.view = null;
  if (tab === 'today') ui.day = todayIdx();
  render(d); window.scrollTo(0, 0);
}

const listRow = ({ act, attrs = '', title, sub = '', right = '', cls = '' }) =>
  `<button class="lrow ${cls}" data-act="${act}" ${attrs}><span class="lrow-main"><span class="lrow-t">${title}</span>${sub ? `<span class="lrow-s">${sub}</span>` : ''}</span><span class="lrow-r">${right}${ic('chevron')}</span></button>`;

function goalCard() {
  const g = db.settings.weeklyGoal || 3, n = weekCount();
  return `<div class="card goal">
    <div class="row-between"><span class="goal-t">${ic('badge')} Objectif de la semaine</span><span class="muted">${n} sur ${g}</span></div>
    <div class="bar"><span style="width:${Math.min(100, n / g * 100)}%"></span></div>
  </div>`;
}

/* ----- Accueil ----- */
function viewToday() {
  const t = todayIdx(), d = ui.day;
  let h = `<header class="top"><p class="eyebrow">${cap(new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))}</p><h1>Aujourd'hui</h1></header>`;
  if (db.active) {
    const a = db.active, n = a.exercises.filter(e => e.done).length;
    h += `<button class="card resume" data-act="resume">
      <span class="row-between"><strong>${esc(a.programName)}</strong><span class="pill">En cours</span></span>
      <span class="muted small">${n} sur ${a.exercises.length} exercices · commencée à ${fmtTime(a.start)}</span>
      <span class="btn primary block">Reprendre</span></button>`;
  }
  if (!db.programs.length) {
    return h + `<div class="card empty">
      <div class="empty-ic">${ic('dumbbell')}</div>
      <h3>Crée ta première séance</h3>
      <p class="muted">Donne-lui un nom, des jours et tes exercices : elle s'affichera ici le bon jour, déjà remplie avec ce que tu as fait la dernière fois.</p>
      <button class="btn primary block" data-act="newProgram">Créer une séance</button></div>`;
  }
  h += goalCard();
  h += `<div class="week">${JOURS_COURT.map((j, i) => {
    const has = db.programs.some(p => p.days.includes(i));
    return `<button data-act="pickDay" data-i="${i}" class="${i === d ? 'on' : ''} ${i === t ? 'today' : ''}">${j}<span class="dot ${has ? '' : 'empty'}"></span></button>`;
  }).join('')}</div>`;
  const list = db.programs.filter(p => p.days.includes(d));
  h += `<h2>${d === t ? 'Séance du jour' : 'Séance du ' + JOURS[d].toLowerCase()}</h2>`;
  h += list.length ? list.map(todayCard).join('')
    : `<div class="card"><p class="muted">Rien de prévu ${d === t ? "aujourd'hui" : 'ce jour-là'} — repos 😴</p></div>`;
  const others = db.programs.filter(p => !p.days.includes(d));
  if (others.length) {
    h += `<h2>Autres séances</h2><div class="list">${others.map(p => listRow({
      act: 'start', attrs: `data-id="${p.id}"`, title: esc(p.name),
      sub: `${p.exercises.length} exercice${p.exercises.length > 1 ? 's' : ''}${p.days.length ? ' · ' + [...p.days].sort().map(i => JOURS_COURT[i]).join(', ') : ''}`,
      right: '<span class="muted small">Démarrer</span>',
    })).join('')}</div>`;
  }
  return h;
}
function lastDoneOf(p) { return db.sessions.filter(s => s.programId === p.id).sort((a, b) => (a.start < b.start ? 1 : -1))[0]; }
function todayCard(p) {
  const last = lastDoneOf(p), doneToday = last && sameDay(last.start, new Date());
  return `<div class="card">
    <div class="row-between"><h3>${esc(p.name)}</h3>${doneToday ? '<span class="pill ok">✓ Faite</span>' : ''}</div>
    <p class="muted small">${last ? 'Dernière fois ' + fmtDate(last.start) : 'Jamais faite'}</p>
    <ul class="plan">${p.exercises.map(ex => { const e = planFor(ex); return `<li><span>${esc(e.name)}</span><span class="plan-v">${planText(e)}</span></li>`; }).join('')}</ul>
    <button class="btn primary block" data-act="start" data-id="${p.id}">${doneToday ? 'Refaire' : 'Démarrer'}</button>
  </div>`;
}

/* ----- Séance en cours ----- */
function viewSession() {
  const a = db.active, n = a.exercises.filter(e => e.done).length, tot = a.exercises.length;
  let h = `<header class="top"><button class="back" data-act="home">‹ Accueil</button><h1>${esc(a.programName)}</h1></header>
    <div class="card goal"><div class="row-between"><span class="goal-t">Progression</span><span class="muted">${n} sur ${tot}</span></div>
    <div class="bar"><span style="width:${tot ? n / tot * 100 : 0}%"></span></div></div>`;
  h += a.exercises.map(exCard).join('');
  h += `<button class="btn ghost block" data-act="addExSession">+ Ajouter un exercice</button>`;
  h += `<div class="footer-actions"><button class="btn text danger" data-act="cancelSession">Abandonner</button><button class="btn primary" data-act="finishSession">Terminer la séance</button></div>`;
  return h;
}
function exCard(e, i) {
  const editing = ui.editIdx === i && !e.done, fb = e.done && ui.fbIdx === i;
  let h = `<section class="card exc ${e.done ? 'done' : ''}">
    <div class="exc-top">
      <button class="tick" data-act="tick" data-i="${i}" aria-label="${e.done ? 'Décocher' : 'Valider'} ${esc(e.name)}">${ic('check')}</button>
      <div class="exc-body"><div class="exc-name">${esc(e.name)}</div><div class="exc-plan">${planText(e)}</div></div>
      ${e.done ? '' : `<button class="link" data-act="editEx" data-i="${i}">${editing ? 'OK' : 'Modifier'}</button>`}
    </div>`;
  if (!e.done) {
    if (e.hint) h += `<p class="hint">${esc(e.hint)}</p>`;
    if (e.lastNote) h += `<p class="hint note">📝 ${esc(e.lastNote)}</p>`;
  }
  if (editing) h += `<div class="edit">${steppersFor(e, 'act', i)}</div>`;
  if (fb) {
    h += `<div class="fb">
      <p class="fb-q">Comment c'était ?</p>
      <div class="chips">${Object.entries(FEEL).map(([k, v]) => `<button class="chip ${e.feel === k ? 'on' : ''}" data-act="feel" data-i="${i}" data-v="${k}">${v.e} ${v.t}</button>`).join('')}</div>
      ${e.feel === 'easy' ? `<p class="hint">La prochaine fois : ${e.type === 'muscu' && e.kg != null ? '+2,5 kg' : e.type === 'cardio' ? 'à toi de pousser 😉' : isSec(e) ? '+5 s' : '+1 rep'} automatiquement</p>` : ''}
      <input class="txt" data-scope="act" data-i="${i}" data-f="note" data-text="1" placeholder="À améliorer la prochaine fois (optionnel)" value="${esc(e.note)}">
      <button class="btn small" data-act="fbClose">OK</button>
    </div>`;
  } else if (e.done) {
    const parts = [];
    if (e.feel) parts.push(`${FEEL[e.feel].e} ${FEEL[e.feel].t}`);
    if (e.note) parts.push('📝 ' + esc(e.note));
    h += `<button class="fb-sum" data-act="fbOpen" data-i="${i}">${parts.join(' · ') || 'Ajouter un ressenti'}</button>`;
  }
  return h + '</section>';
}

function stepper(label, scope, i, f, value, step, unit = '') {
  const a = `data-scope="${scope}" data-i="${i}" data-f="${f}"`;
  return `<div class="stepper"><span class="st-l">${label}</span>
    <div class="st-c"><button data-act="step" ${a} data-d="-${step}" aria-label="Moins">−</button>
    <input inputmode="decimal" ${a} value="${esc(fmtIn(value))}" ${f === 'rest' ? `placeholder="${db.settings.rest}"` : ''} aria-label="${label}">
    <button data-act="step" ${a} data-d="${step}" aria-label="Plus">+</button></div>
    <span class="st-u">${unit}</span></div>`;
}
function steppersFor(e, scope, i) {
  if (e.type === 'cardio') return stepper('Distance', scope, i, 'km', e.km, 0.5, 'km') + stepper('Durée', scope, i, 'min', e.min, 1, 'min');
  return stepper('Séries', scope, i, 'sets', e.sets, 1)
    + stepper(isSec(e) ? 'Durée' : 'Reps', scope, i, 'reps', e.reps, isSec(e) ? 5 : 1, isSec(e) ? 's' : '')
    + (e.type === 'muscu' ? stepper('Charge', scope, i, 'kg', e.kg, 2.5, 'kg') : '');
}

/* ----- Séances (programmes) ----- */
function viewPrograms() {
  let h = `<header class="top"><h1>Séances</h1></header>`;
  if (!db.programs.length) h += `<div class="card"><p class="muted">Aucune séance pour l'instant.</p></div>`;
  else {
    const sorted = [...db.programs].sort((a, b) => Math.min(...a.days, 9) - Math.min(...b.days, 9));
    h += `<div class="list">${sorted.map(p => listRow({
      act: 'editProgram', attrs: `data-id="${p.id}"`, title: esc(p.name),
      sub: `${p.days.length ? [...p.days].sort().map(i => JOURS_COURT[i]).join(', ') : 'Aucun jour'} · ${p.exercises.length} exercice${p.exercises.length > 1 ? 's' : ''}`,
    })).join('')}</div>`;
  }
  return h + `<button class="btn primary block" data-act="newProgram">+ Nouvelle séance</button>`;
}
function viewEditor() {
  const p = ui.draft, isNew = !db.programs.some(x => x.id === p.id);
  let h = `<header class="top"><button class="back" data-act="cancelEdit">‹ Annuler</button><h1>${isNew ? 'Nouvelle séance' : 'Modifier'}</h1></header>
    <div class="card">
      <label class="lbl">Nom</label>
      <input class="txt big" data-draft="name" value="${esc(p.name)}" placeholder="Push, Jambes, Footing…">
      <label class="lbl">Jours</label>
      <div class="days">${JOURS_COURT.map((j, i) => `<button data-act="toggleDay" data-i="${i}" class="${p.days.includes(i) ? 'on' : ''}">${j}</button>`).join('')}</div>
    </div>
    <h2>Exercices</h2>`;
  h += p.exercises.length
    ? `<div class="list">${p.exercises.map((e, i) => listRow({ act: 'editExDraft', attrs: `data-i="${i}"`, title: esc(e.name), sub: `${TYPES[e.type]} · ${planText(e)}` })).join('')}</div>`
    : `<p class="muted small">Ajoute les exercices dans l'ordre où tu les fais.</p>`;
  h += `<button class="btn ghost block" data-act="addExDraft">+ Ajouter un exercice</button>`;
  if (!isNew) h += `<button class="btn text danger block" data-act="deleteProgram">Supprimer cette séance</button>`;
  h += `<div class="footer-actions"><button class="btn primary" data-act="saveProgram">Enregistrer</button></div>`;
  return h;
}
function viewSheet() {
  const s = ui.sheet, e = s.ex, isNew = s.index < 0;
  return `<div class="sheet-bg" data-act="closeSheet"></div>
  <div class="sheet" role="dialog" aria-label="Exercice">
    <div class="grab"></div>
    <h3>${isNew ? 'Nouvel exercice' : 'Exercice'}</h3>
    <input class="txt big" data-sheet="name" value="${esc(e.name)}" placeholder="Nom (ex. Tirage poulie haute)" list="exNames" autocomplete="off">
    <div class="chips">${Object.entries(TYPES).map(([k, v]) => `<button class="chip ${e.type === k ? 'on' : ''}" data-act="sheetType" data-v="${k}">${v}</button>`).join('')}</div>
    ${e.type === 'pdc' ? `<div class="chips">${[['reps', 'En répétitions'], ['sec', 'En secondes']].map(([k, v]) => `<button class="chip ${(e.unit || 'reps') === k ? 'on' : ''}" data-act="sheetUnit" data-v="${k}">${v}</button>`).join('')}</div>` : ''}
    <div class="steps">${steppersFor(e, 'sheet', 0)}${e.type !== 'cardio' ? stepper('Repos', 'sheet', 0, 'rest', e.rest, 15, 's') : ''}</div>
    ${s.mode === 'draft' && !isNew ? `<div class="row"><button class="btn small" data-act="moveEx" data-d="-1">↑ Monter</button><button class="btn small" data-act="moveEx" data-d="1">↓ Descendre</button><button class="btn small danger" data-act="delEx">Supprimer</button></div>` : ''}
    <button class="btn primary block" data-act="saveSheet">${s.mode === 'session' ? 'Ajouter à la séance' : 'Valider'}</button>
  </div>
  <datalist id="exNames">${knownExerciseNames().map(n => `<option value="${esc(n)}">`).join('')}</datalist>`;
}

/* ----- Historique ----- */
function viewHistory() {
  let h = `<header class="top"><h1>Historique</h1></header>`;
  const list = [...db.sessions].sort((a, b) => (a.start < b.start ? 1 : -1));
  if (!list.length) return h + `<div class="card"><p class="muted">Tes séances terminées apparaîtront ici.</p></div>`;
  let month = '', rows = [];
  const flush = () => { if (rows.length) h += `<h2>${month}</h2><div class="list">${rows.join('')}</div>`; rows = []; };
  for (const s of list) {
    const m = cap(new Date(s.start).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));
    if (m !== month) { flush(); month = m; }
    const dur = s.end ? (new Date(s.end) - new Date(s.start)) / 60000 : null;
    const prs = newRecords(s).length;
    rows.push(listRow({
      act: 'openSession', attrs: `data-id="${s.id}"`, title: esc(s.programName),
      sub: `${cap(fmtDate(s.start))} · ${fmtDuree(dur)} · ${s.exercises.length} exercice${s.exercises.length > 1 ? 's' : ''}`,
      right: prs ? `<span class="pill ok">🏆 ${prs}</span>` : '',
    }));
  }
  flush();
  return h;
}
function viewSessionDetail() {
  const s = db.sessions.find(x => x.id === ui.sessionId);
  const dur = s.end ? (new Date(s.end) - new Date(s.start)) / 60000 : null;
  const prs = newRecords(s);
  let h = `<header class="top"><button class="back" data-act="closeDetail">‹ Retour</button><h1>${esc(s.programName)}</h1>
    <p class="muted small">${cap(new Date(s.start).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))} · ${fmtTime(s.start)} · ${fmtDuree(dur)}</p></header>`;
  if (prs.length) h += `<div class="card record"><strong>🏆 Nouveaux records</strong>${prs.map(p => `<p>${esc(p)}</p>`).join('')}</div>`;
  h += `<div class="list">${s.exercises.map(e => `<div class="lrow static"><span class="lrow-main"><span class="lrow-t">${esc(e.name)}</span>
    <span class="lrow-s">${summary(e)}${e.feel ? ' · ' + FEEL[e.feel].e + ' ' + FEEL[e.feel].t : ''}</span>
    ${e.note ? `<span class="lrow-s">📝 ${esc(e.note)}</span>` : ''}</span></div>`).join('')}</div>`;
  h += `<button class="btn text danger block" data-act="deleteSession" data-id="${s.id}">Supprimer cette séance</button>`;
  return h;
}

/* ----- Progrès ----- */
function viewStats() {
  let h = `<header class="top"><h1>Progrès</h1></header>`;
  const n = new Date();
  const month = db.sessions.filter(s => { const d = new Date(s.start); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); }).length;
  const week = weekCount();
  h += `<div class="kpis"><div class="kpi"><strong>${week}</strong><span>séance${week > 1 ? 's' : ''} cette semaine</span></div>
    <div class="kpi"><strong>${month}</strong><span>séance${month > 1 ? 's' : ''} ce mois-ci</span></div></div>`;
  const labels = new Map();
  for (const s of db.sessions) for (const e of s.exercises) labels.set(nkey(e.name), e.name);
  if (!labels.size) return h + `<div class="card"><p class="muted">Termine une séance pour voir ta progression par exercice.</p></div>`;
  const keys = [...labels.keys()].sort((a, b) => labels.get(a).localeCompare(labels.get(b), 'fr'));
  if (!ui.statKey || !labels.has(ui.statKey)) ui.statKey = keys[0];
  h += `<label class="lbl" style="margin-top:18px">Exercice</label><select class="txt" data-stat="1">${keys.map(k => `<option value="${esc(k)}" ${k === ui.statKey ? 'selected' : ''}>${esc(labels.get(k))}</option>`).join('')}</select>`;

  const name = labels.get(ui.statKey), hist = historyOf(name), lastE = hist[hist.length - 1].entry, rec = records(name);
  let pts, fmt, title;
  if (lastE.type === 'cardio') {
    h += `<div class="kpis"><div class="kpi"><strong>${fmtNum(rec.km)} km</strong><span>plus longue distance</span></div><div class="kpi"><strong>${fmtPace(rec.pace)}</strong><span>meilleure allure /km</span></div></div>`;
    pts = hist.map(x => ({ d: x.session.start, y: metrics(x.entry).km })).filter(p => p.y != null);
    fmt = v => fmtNum(v) + ' km'; title = 'Distance par séance';
  } else if (rec.maxKg != null) {
    h += `<div class="kpis"><div class="kpi"><strong>${fmtNum(rec.maxKg)} kg</strong><span>charge max</span></div><div class="kpi"><strong>${fmtNum(Math.round(rec.rm))} kg</strong><span>max sur 1 rep (estimé)</span></div></div>`;
    pts = hist.map(x => ({ d: x.session.start, y: metrics(x.entry).maxKg })).filter(p => p.y != null);
    fmt = v => fmtNum(v) + ' kg'; title = 'Charge par séance';
  } else {
    const u = unitOf(lastE);
    h += `<div class="kpis"><div class="kpi"><strong>${fmtNum(rec.maxReps)} ${u}</strong><span>meilleure série</span></div><div class="kpi"><strong>${rec.count}</strong><span>séances</span></div></div>`;
    pts = hist.map(x => ({ d: x.session.start, y: metrics(x.entry).totalReps }));
    fmt = v => fmtNum(v) + ' ' + u; title = 'Total par séance';
  }
  h += `<div class="card"><strong>${title}</strong>${chart(pts.slice(-20), fmt)}</div>`;
  h += `<div class="list">${hist.slice(-10).reverse().map(x => `<div class="lrow static"><span class="lrow-main"><span class="lrow-t">${summary(x.entry)}</span><span class="lrow-s">${cap(fmtDate(x.session.start))}${x.entry.feel ? ' · ' + FEEL[x.entry.feel].e : ''}</span></span></div>`).join('')}</div>`;
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

/* ----- Profil ----- */
function miniStepper(f, step, unit = '') {
  return `<div class="mini"><button data-act="step" data-scope="set" data-i="0" data-f="${f}" data-d="-${step}" aria-label="Moins">−</button>
    <span>${fmtNum(db.settings[f])}${unit ? ' ' + unit : ''}</span>
    <button data-act="step" data-scope="set" data-i="0" data-f="${f}" data-d="${step}" aria-label="Plus">+</button></div>`;
}
function viewProfile() {
  let h = `<header class="top"><h1>Profil</h1></header>`;
  if (auth) {
    h += `<div class="card acc"><div class="avatar">${esc(auth.user.email.charAt(0).toUpperCase())}</div>
      <div class="acc-main"><div class="acc-t">${esc(auth.user.email)}</div><div class="acc-s" id="syncText">${syncText()}</div></div>
      <button class="icon-btn" data-act="syncNow" aria-label="Synchroniser">${ic('cloud')}</button></div>`;
  } else if (cloudOn()) {
    h += `<div class="card acc"><div class="avatar">?</div><div class="acc-main"><div class="acc-t">Pas connecté</div>
      <div class="acc-s">Tes données sont seulement sur cet appareil</div></div></div>
      <button class="btn primary block" data-act="openAuth">Se connecter ou créer un compte</button>`;
  } else {
    h += `<div class="card acc"><div class="avatar">${ic('user')}</div><div class="acc-main"><div class="acc-t">Mode local</div>
      <div class="acc-s">Les comptes arrivent bientôt : tes données restent sur cet appareil.</div></div></div>`;
  }
  h += goalCard();
  h += `<h2>Réglages</h2><div class="list">
    <div class="lrow static"><span class="lrow-main"><span class="lrow-t">Temps de repos</span><span class="lrow-s">par défaut, après chaque exercice</span></span>${miniStepper('rest', 15, 's')}</div>
    <div class="lrow static"><span class="lrow-main"><span class="lrow-t">Objectif par semaine</span><span class="lrow-s">nombre de séances</span></span>${miniStepper('weeklyGoal', 1)}</div>
  </div>
  <h2>Mes données</h2><div class="list">
    ${listRow({ act: 'export', title: 'Exporter une sauvegarde' })}
    ${listRow({ act: 'import', title: 'Importer une sauvegarde' })}
    ${auth ? listRow({ act: 'logout', title: 'Se déconnecter' }) : ''}
    ${listRow({ act: 'wipe', title: 'Tout effacer', cls: 'danger' })}
  </div>
  <p class="muted small center">${db.programs.length} séance(s) programmée(s) · ${db.sessions.length} entraînement(s) enregistré(s)</p>`;
  return h;
}
function viewAuth() {
  const first = !welcomed();
  return `<div class="auth">
    <div class="logo">${ic('dumbbell')}</div>
    <h1 class="center">Séances</h1>
    <p class="muted center">Connecte-toi pour retrouver ton suivi sur ton téléphone, ton PC et tous tes appareils.</p>
    <div class="card">
      <label class="lbl" for="authEmail">Email</label>
      <input id="authEmail" class="txt" type="email" autocomplete="email" inputmode="email" autocapitalize="off">
      <label class="lbl" for="authPw">Mot de passe</label>
      <input id="authPw" class="txt" type="password" autocomplete="current-password" placeholder="6 caractères minimum">
      <p class="msg" id="authMsg" role="status"></p>
      <button class="btn primary block" data-act="signIn">Se connecter</button>
      <button class="btn block" data-act="signUp">Créer un compte</button>
    </div>
    <button class="btn text block" data-act="skipAuth">${first ? 'Continuer sans compte' : '‹ Retour'}</button>
  </div>`;
}

const VIEWS = { today: viewToday, programs: viewPrograms, history: viewHistory, stats: viewStats, profile: viewProfile };

/* ---------- Actions ---------- */
function scopeObj(scope, i) {
  if (scope === 'act') return db.active && db.active.exercises[+i];
  if (scope === 'sheet') return ui.sheet && ui.sheet.ex;
  if (scope === 'set') return db.settings;
  return null;
}
function afterScopeChange(scope) {
  if (scope === 'act') { touchActive(); saveDb(); }
  else if (scope === 'set') { db.settingsU = now(); saveDb(); }
}
function clearActive() {
  db.active = null; db.activeClearedAt = now();
  ui.fbIdx = null; ui.editIdx = null;
  stopTimer(); keepAwake(false);
}
function newEx() { return { id: uid(), name: '', type: 'muscu', unit: 'reps', sets: 3, reps: 10, kg: null, km: null, min: null, rest: null }; }
function cleanEntry(e) { const { hint, lastNote, done, ...rest } = e; return rest; }
function authMsg(t) { const el = $('#authMsg'); if (el) el.textContent = t; }

const actions = {
  tab(d) { goTab(d.tab); },
  pickDay(d) { ui.day = +d.i; render(); },
  home() { ui.view = null; ui.tab = 'today'; render(); window.scrollTo(0, 0); },
  resume() { ui.view = 'session'; render(); keepAwake(true); window.scrollTo(0, 0); },

  /* Séance */
  start(d) {
    const p = db.programs.find(x => x.id === d.id);
    if (!p) return;
    if (db.active && !confirm(`La séance « ${db.active.programName} » est déjà en cours. La remplacer ?`)) return;
    db.active = { id: uid(), programId: p.id, programName: p.name, start: new Date().toISOString(), u: now(), exercises: p.exercises.map(ex => planFor(ex)) };
    ui.fbIdx = null; ui.editIdx = null;
    saveDb(); ui.view = 'session'; render(); keepAwake(true); window.scrollTo(0, 0);
  },
  tick(d) {
    const i = +d.i, e = db.active.exercises[i];
    e.done = !e.done; touchActive(); saveDb();
    if (e.done) { ui.fbIdx = i; ui.editIdx = null; if (e.type !== 'cardio') startTimer(e.rest ?? db.settings.rest); }
    else if (ui.fbIdx === i) ui.fbIdx = null;
    render();
  },
  editEx(d) { ui.editIdx = ui.editIdx === +d.i ? null : +d.i; render(); },
  feel(d) { const e = db.active.exercises[+d.i]; e.feel = e.feel === d.v ? null : d.v; touchActive(); saveDb(); render(); },
  fbOpen(d) { ui.fbIdx = +d.i; render(); },
  fbClose() { ui.fbIdx = null; render(); },
  step(d) {
    const o = scopeObj(d.scope, d.i); if (!o) return;
    const base = o[d.f] ?? (d.f === 'rest' ? db.settings.rest : 0);
    const minV = (d.f === 'sets' || d.f === 'weeklyGoal') ? 1 : 0;
    o[d.f] = Math.max(minV, r2(base + +d.d));
    afterScopeChange(d.scope); render();
  },
  addExSession() { ui.sheet = { mode: 'session', index: -1, ex: newEx() }; render(); },
  finishSession() {
    const a = db.active, done = a.exercises.filter(e => e.done);
    if (!done.length) {
      if (!confirm('Aucun exercice coché. Quitter sans rien enregistrer ?')) return;
      clearActive(); saveDb(); actions.home(); return;
    }
    const left = a.exercises.length - done.length;
    if (left && !confirm(`${left} exercice(s) non coché(s) ne seront pas enregistrés. Terminer quand même ?`)) return;
    const session = { id: a.id, programId: a.programId, programName: a.programName, start: a.start, end: new Date().toISOString(), u: now(), exercises: done.map(cleanEntry) };
    db.sessions.push(session);
    clearActive(); saveDb();
    ui.view = 'sessionDetail'; ui.sessionId = session.id; ui.tab = 'history';
    render(); window.scrollTo(0, 0); toast('Séance enregistrée 💪');
  },
  cancelSession() {
    if (!confirm('Abandonner cette séance ? Rien ne sera enregistré.')) return;
    clearActive(); saveDb(); actions.home();
  },

  /* Programmes */
  newProgram() {
    ui.draft = { id: uid(), name: '', days: ui.tab === 'today' ? [ui.day] : [], exercises: [] };
    ui.view = 'editProgram'; render(); window.scrollTo(0, 0);
  },
  editProgram(d) {
    const p = db.programs.find(x => x.id === d.id); if (!p) return;
    ui.draft = JSON.parse(JSON.stringify(p)); ui.view = 'editProgram'; render(); window.scrollTo(0, 0);
  },
  cancelEdit() { ui.draft = null; ui.sheet = null; ui.view = null; render(); },
  toggleDay(d) {
    const i = +d.i;
    ui.draft.days = ui.draft.days.includes(i) ? ui.draft.days.filter(x => x !== i) : [...ui.draft.days, i].sort();
    render();
  },
  addExDraft() { ui.sheet = { mode: 'draft', index: -1, ex: newEx() }; render(); },
  editExDraft(d) { ui.sheet = { mode: 'draft', index: +d.i, ex: { ...ui.draft.exercises[+d.i] } }; render(); },
  closeSheet() { ui.sheet = null; render(); },
  sheetType(d) {
    const e = ui.sheet.ex; e.type = d.v;
    if (d.v === 'cardio') { e.km = e.km ?? 5; e.min = e.min ?? 30; }
    else { e.sets = e.sets ?? 3; e.reps = e.reps ?? 10; }
    render();
  },
  sheetUnit(d) { const e = ui.sheet.ex; if (e.unit !== d.v) { e.unit = d.v; e.reps = d.v === 'sec' ? 30 : 10; } render(); },
  saveSheet() {
    const s = ui.sheet, e = s.ex;
    e.name = (e.name || '').trim();
    if (!e.name) { toast("Donne un nom à l'exercice"); return; }
    if (s.mode === 'draft') { if (s.index >= 0) ui.draft.exercises[s.index] = e; else ui.draft.exercises.push(e); }
    else { db.active.exercises.push(planFor(e, false)); touchActive(); saveDb(); }
    ui.sheet = null; render();
  },
  moveEx(d) {
    const ex = ui.draft.exercises, i = ui.sheet.index, j = i + +d.d;
    if (j < 0 || j >= ex.length) return;
    ex[i] = ui.sheet.ex; [ex[i], ex[j]] = [ex[j], ex[i]];
    ui.sheet = null; render();
  },
  delEx() { ui.draft.exercises.splice(ui.sheet.index, 1); ui.sheet = null; render(); },
  saveProgram() {
    const p = ui.draft;
    p.name = (p.name || '').trim();
    if (!p.name) { toast('Donne un nom à la séance'); return; }
    if (!p.exercises.length) { toast('Ajoute au moins un exercice'); return; }
    p.u = now();
    const i = db.programs.findIndex(x => x.id === p.id);
    if (i >= 0) db.programs[i] = p; else db.programs.push(p);
    saveDb(); ui.draft = null; ui.view = null; render(); toast('Séance enregistrée');
  },
  deleteProgram() {
    if (!confirm(`Supprimer la séance « ${ui.draft.name} » ? Ton historique est conservé.`)) return;
    db.deleted[ui.draft.id] = now();
    db.programs = db.programs.filter(x => x.id !== ui.draft.id);
    saveDb(); ui.draft = null; ui.view = null; render();
  },

  /* Historique */
  openSession(d) { ui.sessionId = d.id; ui.view = 'sessionDetail'; render(); window.scrollTo(0, 0); },
  closeDetail() { ui.view = null; ui.tab = 'history'; render(); },
  deleteSession(d) {
    if (!confirm("Supprimer définitivement cette séance de l'historique ?")) return;
    db.deleted[d.id] = now();
    db.sessions = db.sessions.filter(s => s.id !== d.id);
    saveDb(); ui.view = null; render();
  },

  /* Minuteur */
  timerAdd() { if (ui.timer) { ui.timer.end += 15000; tickTimer(); } },
  timerStop() { stopTimer(); },

  /* Compte */
  openAuth() { ui.view = 'auth'; render(); window.scrollTo(0, 0); },
  skipAuth() { markWelcomed(); ui.view = null; render(); },
  async signIn() {
    const email = $('#authEmail').value.trim(), pw = $('#authPw').value;
    if (!email || !pw) { authMsg('Renseigne ton email et ton mot de passe'); return; }
    authMsg('Connexion…');
    try { await apiSignIn(email, pw); }
    catch (e) { authMsg(e.message); return; }
    markWelcomed(); ui.view = null; ui.tab = 'profile'; render(); toast('Connecté ✅'); sync();
  },
  async signUp() {
    const email = $('#authEmail').value.trim(), pw = $('#authPw').value;
    if (!email || !pw) { authMsg('Renseigne ton email et choisis un mot de passe'); return; }
    if (pw.length < 6) { authMsg('Mot de passe trop court (6 caractères minimum)'); return; }
    authMsg('Création du compte…');
    let logged;
    try { logged = await apiSignUp(email, pw); }
    catch (e) { authMsg(e.message); return; }
    if (!logged) { authMsg('Compte créé ! Clique sur le lien reçu par email, puis reviens ici et connecte-toi.'); return; }
    markWelcomed(); ui.view = null; ui.tab = 'profile'; render(); toast('Compte créé ✅'); sync();
  },
  syncNow() { sync(); },
  logout() {
    if (!confirm('Se déconnecter ? Tes données restent sur cet appareil.')) return;
    auth = null; storeAuth(); render();
  },

  /* Données */
  export() {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `seances-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  import() { $('#importFile').click(); },
  wipe() {
    if (!confirm(auth ? 'Tout effacer, sur cet appareil ET sur ton compte ?' : 'Tout effacer (séances, historique, réglages) ?')) return;
    if (!confirm('Vraiment ? Action définitive. Pense à exporter avant.')) return;
    const t = now(), deleted = { ...db.deleted };
    [...db.programs, ...db.sessions].forEach(x => { deleted[x.id] = t; });
    db = { ...emptyDb(), deleted, activeClearedAt: t, settingsU: t };
    stopTimer(); saveDb(); ui.tab = 'today'; ui.view = null; render();
  },
};

/* ---------- Événements ---------- */
document.addEventListener('click', ev => {
  if (ui.suppressClick) { ev.preventDefault(); return; }
  const b = ev.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const fn = actions[b.dataset.act];
  if (fn) { ev.preventDefault(); fn(b.dataset, b); }
});

document.addEventListener('input', ev => {
  const t = ev.target, d = t.dataset;
  if (t.tagName === 'SELECT') return;
  if (d.scope) {
    const o = scopeObj(d.scope, d.i); if (!o) return;
    o[d.f] = d.text ? t.value : num(t.value);
    afterScopeChange(d.scope);
    return;
  }
  if (d.draft && ui.draft) { ui.draft[d.draft] = t.value; return; }
  if (d.sheet && ui.sheet) { ui.sheet.ex[d.sheet] = t.value; }
});

document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.tagName === 'SELECT' && t.dataset.stat) { ui.statKey = t.value; render(); }
  // Après saisie d'une valeur de séance, rafraîchir l'affichage (ligne résumé)
  if (t.dataset.scope === 'act' && !t.dataset.text) render();
});

document.addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && ev.target.id === 'authPw') actions.signIn();
});

$('#importFile').addEventListener('change', async ev => {
  const file = ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.programs) || !Array.isArray(data.sessions)) throw new Error('format');
    if (!confirm(`Importer cette sauvegarde (${data.programs.length} séances, ${data.sessions.length} entraînements) ? Elle sera fusionnée avec tes données actuelles.`)) return;
    db = mergeDb(db, migrate(data));
    saveDb(); ui.view = null; ui.tab = 'today'; render(); toast('Sauvegarde importée ✅');
  } catch (e) {
    toast("Ce fichier n'est pas une sauvegarde valide");
  }
});

/* Glisser sur la barre « verre liquide » + swipe sur le contenu pour changer d'onglet */
function moveBubble(px) {
  const b = $('#bubble'); if (!b) return;
  if (px == null) { b.style.transition = ''; b.style.transform = `translateX(${TABS.indexOf(ui.tab) * 100}%)`; }
  else { b.style.transition = 'none'; b.style.transform = `translateX(${px}px)`; }
}
function buildTabbar() {
  const icons = { today: 'home', programs: 'dumbbell', history: 'calendar', stats: 'chart', profile: 'user' };
  const bar = $('#tabbar');
  bar.innerHTML = `<div class="bubble" id="bubble"></div>` + TABS.map(t => `<button data-act="tab" data-tab="${t}">${ic(icons[t])}<span>${TAB_LABELS[t]}</span></button>`).join('');
  let startX = null, moved = false, w = 0, startIdx = 0;
  bar.addEventListener('pointerdown', e => {
    startX = e.clientX; moved = false; w = (bar.clientWidth - 8) / TABS.length; startIdx = TABS.indexOf(ui.tab);
  });
  bar.addEventListener('pointermove', e => {
    if (startX == null) return;
    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) < 8) return;
    if (!moved) { moved = true; try { bar.setPointerCapture(e.pointerId); } catch (err) { /* */ } }
    moveBubble(Math.max(0, Math.min(w * (TABS.length - 1), startIdx * w + dx)));
  });
  const end = e => {
    if (startX == null) return;
    if (moved) {
      const idx = Math.max(0, Math.min(TABS.length - 1, Math.round((startIdx * w + e.clientX - startX) / w)));
      ui.suppressClick = true; setTimeout(() => { ui.suppressClick = false; }, 80);
      goTab(TABS[idx]);
    }
    startX = null;
  };
  bar.addEventListener('pointerup', end);
  bar.addEventListener('pointercancel', () => { startX = null; moveBubble(); });
}
let touch0 = null;
document.addEventListener('touchstart', e => {
  touch0 = null;
  if (ui.view || ui.sheet || e.target.closest('#tabbar, input, textarea, select, .week, .chart, .mini')) return;
  const t = e.touches[0]; touch0 = { x: t.clientX, y: t.clientY, t: now() };
}, { passive: true });
document.addEventListener('touchend', e => {
  if (!touch0) return;
  const t = e.changedTouches[0], dx = t.clientX - touch0.x, dy = t.clientY - touch0.y, fast = now() - touch0.t < 600;
  touch0 = null;
  if (fast && Math.abs(dx) > 70 && Math.abs(dy) < 45) {
    const i = TABS.indexOf(ui.tab) + (dx < 0 ? 1 : -1);
    if (i >= 0 && i < TABS.length) goTab(TABS[i]);
  }
}, { passive: true });

/* ---------- Minuteur de repos ---------- */
let timerInt = null, audioCtx = null;
function startTimer(sec) {
  if (!sec) return;
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* */ }
  ui.timer = { end: now() + sec * 1000 };
  $('#timerLabel').textContent = 'Repos';
  clearInterval(timerInt); timerInt = setInterval(tickTimer, 250); tickTimer();
}
function tickTimer() {
  const el = $('#timer');
  if (!ui.timer) { el.hidden = true; clearInterval(timerInt); return; }
  const left = Math.ceil((ui.timer.end - now()) / 1000);
  if (left <= 0) {
    ui.timer = null; clearInterval(timerInt); alarm();
    $('#timerLabel').textContent = "C'est reparti ! 🔥"; $('#timerVal').textContent = '';
    el.hidden = false; setTimeout(() => { if (!ui.timer) el.hidden = true; }, 3000);
    return;
  }
  el.hidden = false; $('#timerVal').textContent = mmss(left);
}
function stopTimer() { ui.timer = null; clearInterval(timerInt); $('#timer').hidden = true; }
function alarm() {
  try { navigator.vibrate && navigator.vibrate([250, 120, 250]); } catch (e) { /* */ }
  try {
    if (!audioCtx) return;
    [0, 0.25, 0.5].forEach(t => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 880; g.gain.value = 0.15; o.connect(g); g.connect(audioCtx.destination);
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
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (db.active && ui.view === 'session') keepAwake(true);
  scheduleSync(200);
});
window.addEventListener('online', () => scheduleSync(200));
setInterval(() => { if (document.visibilityState === 'visible') scheduleSync(0); }, 60000);

/* ---------- Toast ---------- */
let toastT = null;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2500);
}

/* ---------- Démarrage ---------- */
buildTabbar();
render();
if (db.active) keepAwake(true);
scheduleSync(300);
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { /* */ }
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
