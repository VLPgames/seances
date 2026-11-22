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
const APP_VERSION = '5.2';
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
const CATS = {
  salle: { e: '🏋️', t: 'Salle de sport', s: 'Push, pull, leg day…' },
  maison: { e: '🏠', t: 'À la maison', s: 'Poids du corps, sans matériel' },
  exterieur: { e: '🌳', t: 'Extérieur', s: 'Course, vélo, marche…' },
  repos: { e: '😴', t: 'Repos', s: 'Jour off, rien à faire' },
};
/* Palettes de couleurs (Profil > Apparence). Les couleurs réelles sont dans style.css. */
const PALETTES = [
  { id: 'graphite', t: 'Graphite', c: ['#18181b', '#52525b', '#a1a1aa'] },
  { id: 'ocean', t: 'Océan', c: ['#0ea5e9', '#2563eb', '#4f46e5'] },
  { id: 'foret', t: 'Forêt', c: ['#22c55e', '#0d9488', '#0e7490'] },
  { id: 'sunset', t: 'Sunset', c: ['#7c3aed', '#ec4899', '#f97316'] },
  { id: 'feu', t: 'Feu', c: ['#dc2626', '#ea580c', '#f59e0b'] },
  { id: 'neon', t: 'Néon', c: ['#bef264', '#84cc16', '#22d3ee'] },
];
const SALLE_TYPES =['Push', 'Pull', 'Leg day', 'Full body', 'Haut du corps', 'Bas du corps'];
/* Catalogue : groupe -> exercices. Suffixe « | pdc », « | pdc sec » ou « | cardio » ; par défaut muscu (charge en kg). */
const CATALOG = {
  salle: {
    'Pectoraux': ['Développé couché (barre)', 'Développé couché haltères', 'Développé couché à la Smith', 'Développé incliné', 'Développé décliné', 'Presse pectoraux (machine)', 'Pec deck / butterfly', 'Écarté poulie vis-à-vis', 'Dips | pdc'],
    'Dos': ['Tirage vertical (poulie haute)', 'Tirage horizontal (poulie basse)', 'Rowing barre', 'Rowing haltère', 'Rowing machine', 'Pull-over poulie', 'Tractions | pdc', 'Soulevé de terre', 'Extension lombaires'],
    'Épaules': ['Développé militaire', 'Développé épaules (machine)', 'Élévations latérales', 'Élévations latérales poulie', 'Oiseau (machine reverse fly)', 'Face pull', 'Shrugs'],
    'Biceps': ['Curl barre', 'Curl haltères', 'Curl marteau', 'Curl pupitre', 'Curl poulie'],
    'Triceps': ['Extension triceps poulie', 'Barre au front', 'Extension nuque haltère', 'Dips machine', 'Kickback'],
    'Jambes': ['Squat', 'Squat à la Smith', 'Presse à cuisses', 'Hack squat', 'Fentes', 'Leg extension', 'Leg curl allongé', 'Leg curl assis', 'Soulevé de terre roumain', 'Hip thrust', 'Hip thrust (machine)', 'Adducteurs (machine)', 'Abducteurs (machine)', 'Mollets debout', 'Mollets assis'],
    'Abdos': ['Crunch machine', 'Crunch poulie', 'Relevé de jambes | pdc', 'Gainage | pdc sec', 'Rotations russes | pdc'],
    'Cardio': ['Tapis de course | cardio', 'Vélo | cardio', 'Rameur | cardio', 'Elliptique | cardio', 'Stairmaster | cardio'],
  },
  maison: {
    'Haut du corps': ['Pompes | pdc', 'Pompes diamant | pdc', 'Pompes inclinées | pdc', 'Pike push-up | pdc', 'Dips sur chaise | pdc', 'Tractions (barre de porte) | pdc'],
    'Bas du corps': ['Squats | pdc', 'Fentes | pdc', 'Squats sautés | pdc', 'Pont fessier | pdc', 'Chaise | pdc sec', 'Mollets | pdc'],
    'Abdos / gainage': ['Gainage | pdc sec', 'Gainage latéral | pdc sec', 'Crunchs | pdc', 'Relevés de jambes | pdc', 'Mountain climbers | pdc sec', 'Russian twist | pdc'],
    'Cardio': ['Burpees | pdc', 'Jumping jacks | pdc sec', 'Corde à sauter | pdc sec', 'Montées de genoux | pdc sec'],
  },
  exterieur: {
    'Activités': ['Course | cardio', 'Fractionné | cardio', 'Vélo | cardio', 'Marche rapide | cardio', 'Randonnée | cardio', 'Natation | cardio'],
  },
};
/* ---------- Profil sportif ---------- */
const GOALS = {
  muscle: { e: '💪', t: 'Prendre du muscle', s: 'Séries de 8 à 12 reps', reps: 10, rest: 90 },
  force: { e: '🏋️', t: 'Gagner en force', s: 'Charges lourdes, 3 à 6 reps', reps: 5, rest: 150 },
  perte: { e: '🔥', t: 'Perdre du poids', s: 'Séances dynamiques, repos courts', reps: 12, rest: 60 },
  forme: { e: '🌿', t: 'Être en forme', s: 'Bouger régulièrement, sans pression', reps: 12, rest: 75 },
  endurance: { e: '🏃', t: 'Endurance', s: 'Plus de reps, cardio', reps: 15, rest: 45 },
};
const LEVELS = {
  debutant: { t: 'Débutant', s: 'Moins de 6 mois de pratique', sets: 3 },
  inter: { t: 'Intermédiaire', s: '6 mois à 2 ans', sets: 4 },
  confirme: { t: 'Confirmé', s: 'Plus de 2 ans', sets: 4 },
};
const PLACES = {
  salle: { e: '🏋️', t: 'En salle de sport' },
  maison: { e: '🏠', t: 'À la maison' },
  mixte: { e: '🔁', t: 'Les deux' },
  exterieur: { e: '🌳', t: 'Surtout dehors (course, vélo…)' },
};
/* Enseignes : aucune ne publie la liste exacte de ses machines (ça varie selon le club).
   On part d'une liste « équipement courant » que l'utilisateur ajuste dans Profil > Ma salle. */
const RARE = ['Hack squat', 'Hip thrust (machine)', 'Stairmaster', 'Leg curl allongé', 'Oiseau (machine reverse fly)'];
const GYMS = {
  basicfit: { t: 'Basic-Fit', minus: ['Hack squat', 'Hip thrust (machine)'] },
  fitnesspark: { t: 'Fitness Park', minus: [] },
  orangebleue: { t: "L'Orange Bleue", minus: RARE },
  keepcool: { t: 'Keepcool', minus: RARE },
  onair: { t: 'On Air', minus: [] },
  neoness: { t: 'Neoness', minus: ['Hack squat', 'Hip thrust (machine)'] },
  autre: { t: 'Autre salle', minus: RARE },
};
const profile = () => db.profile || {};
const hasGym = () => ['salle', 'mixte'].includes(profile().place) && profile().gym && profile().gym !== 'none';
function gymLabel() {
  const p = profile();
  if (!p.gym || p.gym === 'none') return 'Pas d\'abonnement';
  if (p.gym === 'autre') return [p.gymName || 'Autre salle', p.gymCity].filter(Boolean).join(' · ');
  return (GYMS[p.gym]?.t || '') + (p.gymCity ? ' · ' + p.gymCity : '');
}
const allSalleItems = () => Object.values(CATALOG.salle).flat().map(s => parseItem(s).name);
/* Machines disponibles dans la salle de l'utilisateur (null = pas de salle renseignée) */
function gymMachines() {
  const p = profile();
  if (!hasGym()) return null;
  if (Array.isArray(p.machines)) return new Set(p.machines);
  const minus = GYMS[p.gym]?.minus || RARE;
  return new Set(allSalleItems().filter(n => !minus.includes(n)));
}
/* Groupes mis en avant selon le type de séance salle */
const FOCUS = {
  'Push': ['Pectoraux', 'Épaules', 'Triceps'], 'Pull': ['Dos', 'Biceps'], 'Leg day': ['Jambes', 'Abdos'],
  'Haut du corps': ['Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps'], 'Bas du corps': ['Jambes', 'Abdos'],
};
function parseItem(s) {
  const [name, tag = ''] = s.split(' | ');
  const type = tag.startsWith('cardio') ? 'cardio' : tag.startsWith('pdc') ? 'pdc' : 'muscu';
  return { name, type, unit: tag.includes('sec') ? 'sec' : 'reps' };
}
/* Valeurs proposées selon l'objectif et le niveau du profil */
function exFromItem(s) {
  const { name, type, unit } = parseItem(s), cardio = type === 'cardio';
  const p = profile(), goal = GOALS[p.goal], level = LEVELS[p.level];
  const sets = level ? level.sets : (type === 'muscu' ? 4 : 3);
  const reps = unit === 'sec' ? (p.goal === 'endurance' ? 45 : 30)
    : type === 'muscu' ? (goal ? goal.reps : 10)
    : (['perte', 'endurance'].includes(p.goal) ? 20 : 15);
  return {
    id: uid(), name, type, unit,
    sets: cardio ? null : sets, reps: cardio ? null : reps,
    kg: null, km: cardio ? (p.goal === 'endurance' ? 8 : 5) : null, min: cardio ? (p.goal === 'endurance' ? 45 : 30) : null, rest: null,
  };
}

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
const toTop = () => { const m = document.getElementById('main'); if (m) m.scrollTop = 0; };
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
  return { version: 3, exClean: true, programs: [], sessions: [], active: null, activeClearedAt: 0, deleted: {}, settings: { rest: 90, weeklyGoal: 3, goalAuto: true, theme: 'auto', palette: 'graphite' }, settingsU: 0, body: [], profile: null };
}
const V1_EXAMPLES = {
  'Push (pecs, épaules, triceps)': ['Développé couché', 'Développé incliné haltères', 'Écarté poulie vis-à-vis', 'Élévations latérales', 'Extension triceps poulie'],
  'Circuit maison': ['Pompes', 'Squats poids du corps', 'Gainage'],
  'Pull + jambes': ['Tirage poulie haute', 'Rowing poulie basse', 'Squat', 'Presse à cuisses', 'Curl biceps'],
  'Footing': ['Course'],
};
function isExampleProgram(p) {
  const ex = V1_EXAMPLES[p.name];
  return !!ex && (p.exercises || []).map(e => e.name).join('|') === ex.join('|');
}
function inferCat(p) {
  const ex = p.exercises || [];
  if (!ex.length) return 'salle';
  if (ex.every(e => e.type === 'cardio')) return 'exterieur';
  if (ex.some(e => e.type === 'muscu')) return 'salle';
  return 'maison';
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
  const wasClean = !!d.exClean; // (emptyDb() vaut true : lire la valeur d'origine)
  d = { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) }, deleted: { ...(d.deleted || {}) }, exClean: wasClean };
  if ((d.version || 1) < 2) {
    d.programs.forEach(p => { p.u = p.u || 1; p.exercises.forEach(e => { if (e.kg === undefined) e.kg = null; }); });
    d.sessions.forEach(s => { s.u = s.u || 1; s.exercises = s.exercises.map(e => migrateEntry(e, true)); });
    if (d.active) { d.active.u = d.active.u || 1; d.active.exercises = d.active.exercises.map(e => migrateEntry(e, false)); }
    d.version = 2;
  }
  // Une seule fois : retirer les séances d'exemple de la V1 (jamais demandées par l'utilisateur)
  if (!d.exClean) {
    d.programs = d.programs.filter(p => {
      if (!isExampleProgram(p)) return true;
      d.deleted[p.id] = now(); return false;
    });
    d.exClean = true;
  }
  d.programs.forEach(p => {
    if (!p.cat) p.cat = inferCat(p);
    p.days = (p.days || []).filter(x => Number.isInteger(x) && x >= 0 && x <= 6);
  });
  d.version = 3;
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
  const out = { version: 3, deleted, exClean: !!(a.exClean || b.exClean) };
  out.programs = mergeList(a.programs, b.programs, deleted);
  out.sessions = mergeList(a.sessions, b.sessions, deleted);
  out.body = mergeList(a.body, b.body, deleted);
  out.profile = ((b.profile && b.profile.u) || 0) > ((a.profile && a.profile.u) || 0) ? b.profile : (a.profile || b.profile || null);
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
  // Adresse de retour après le clic dans l'email de confirmation : l'appli elle-même (et pas la racine du site)
  const back = location.origin + location.pathname;
  const j = await authReq('signup?redirect_to=' + encodeURIComponent(back), { email, password });
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
  cal: null, calSel: null,
};
if (db.active) ui.view = 'session';
else if (cloudOn() && !auth && !welcomed()) ui.view = 'auth';
else if (!db.profile && !db.programs.length && !db.sessions.length) { ui.ob = { data: {}, i: 0 }; ui.view = 'onboard'; }

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
/* Thème : auto (suit le téléphone), clair ou sombre */
function applyTheme() {
  const t = db.settings.theme || 'auto', root = document.documentElement;
  if (t === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
  root.setAttribute('data-palette', db.settings.palette || 'graphite');
  root.style.fontSize = { l: '112.5%', xl: '125%' }[db.settings.textSize] || '100%';
  if (db.settings.motion === 'reduced') root.setAttribute('data-motion', 'reduced'); else root.removeAttribute('data-motion');
  const dark = t === 'dark' || (t === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0d0a14' : '#f7f3fb');
}
function render(dir) {
  applyTheme();
  let html;
  if (ui.view === 'confirmed') html = viewConfirmed();
  else if (ui.view === 'onboard' && ui.ob) html = viewOnboard();
  else if (ui.view === 'gym' && hasGym()) html = viewGym();
  else if (ui.view === 'auth' && cloudOn()) html = viewAuth();
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
  render(d); toTop();
}

const listRow = ({ act, attrs = '', title, sub = '', right = '', cls = '' }) =>
  `<button class="lrow ${cls}" data-act="${act}" ${attrs}><span class="lrow-main"><span class="lrow-t">${title}</span>${sub ? `<span class="lrow-s">${sub}</span>` : ''}</span><span class="lrow-r">${right}${ic('chevron')}</span></button>`;

function goalCard() {
  const g = weeklyGoal(), n = weekCount();
  return `<div class="card goal">
    <div class="row-between"><span class="goal-t">${ic('badge')} Objectif de la semaine</span><span class="muted">${n} sur ${g}</span></div>
    <div class="bar"><span style="width:${Math.min(100, n / g * 100)}%"></span></div>
  </div>`;
}

/* ----- Accueil ----- */
function viewToday() {
  const t = todayIdx(), d = ui.day;
  const pn = profile().name;
  let h = `<header class="top"><p class="eyebrow">${pn ? 'Salut ' + esc(pn) + ' 👋 · ' : ''}${pn ? new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : cap(new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))}</p><h1>Aujourd'hui</h1></header>`;
  if (!profile().done) {
    h += `<button class="card ob-invite" data-act="openOnboard">
      <span class="ob-e">👋</span><span class="ob-txt"><strong>Personnalise ton appli</strong><span>Objectif, niveau, ta salle… 1 minute</span></span>${ic('chevron')}</button>`;
  }
  if (db.active) {
    const a = db.active, n = a.exercises.filter(e => e.done).length;
    h += `<button class="card resume" data-act="resume">
      <span class="row-between"><strong>${esc(a.programName)}</strong><span class="pill">En cours</span></span>
      <span class="muted small">${n} sur ${a.exercises.length} exercices · commencée à ${fmtTime(a.start)}</span>
      <span class="btn primary block">Reprendre</span></button>`;
  }
  h += heroCard();
  const done = doneDaysThisWeek();
  h += `<div class="week">${JOURS_COURT.map((j, i) =>
    `<button data-act="pickDay" data-i="${i}" class="${i === d ? 'on' : ''} ${i === t ? 'today' : ''} ${done.has(i) ? 'done' : ''}" aria-label="${JOURS[i]}${done.has(i) ? ' (séance faite)' : ''}">${done.has(i) ? ic('check') : j}</button>`
  ).join('')}</div>`;
  h += `<h2>${d === t ? 'Séance du jour' : 'Séance du ' + JOURS[d].toLowerCase()}</h2>`;
  const list = trainingFor(d);
  if (list.length) h += list.map(todayCard).join('');
  else if (isRestDay(d)) h += `<div class="card rest"><h3>😴 Jour de repos</h3><p class="muted">Rien à faire, profite pour récupérer.</p></div>`;
  else h += `<div class="card todo-card"><h3>À programmer</h3>
      <p class="muted">Aucune séance prévue le ${JOURS[d].toLowerCase()}.</p>
      <button class="btn primary block" data-act="dayPlan" data-day="${d}">Programmer le ${JOURS[d].toLowerCase()}</button></div>`;
  return h;
}
/* Volume d'une séance = Σ séries × reps × kg (muscu) */
function volumeOf(s) { return s.exercises.reduce((a, e) => a + (e.type === 'muscu' && e.kg ? (e.sets || 0) * (e.reps || 0) * e.kg : 0), 0); }
function chronoText() {
  if (!db.active) return '';
  const sec = Math.max(0, Math.floor((now() - new Date(db.active.start)) / 1000));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
}
setInterval(() => { const el = document.getElementById('chrono'); if (el) el.textContent = chronoText(); }, 1000);
/* Objectif de la semaine : auto = nombre de jours d'entraînement programmés */
function weeklyGoal() {
  if (db.settings.goalAuto !== false) {
    const days = new Set(db.programs.filter(p => p.cat !== 'repos').flatMap(p => p.days));
    if (days.size) return days.size;
  }
  return db.settings.weeklyGoal || 3;
}
/* Groupe musculaire d'un exercice (d'après le catalogue) */
const GROUP_OF = (() => {
  const m = new Map();
  for (const cat of Object.values(CATALOG)) for (const [g, items] of Object.entries(cat)) for (const s of items) m.set(nkey(parseItem(s).name), g);
  return m;
})();
function musclesOf(p) { return [...new Set(p.exercises.map(e => GROUP_OF.get(nkey(e.name))).filter(g => g && g !== 'Activités'))]; }
/* Durée estimée : ~40 s par série + repos ; cardio = durée prévue */
function estMinutes(p) {
  let s = 0;
  for (const ex of p.exercises) {
    const e = planFor(ex);
    if (e.type === 'cardio') s += (e.min || 0) * 60;
    else s += (e.sets || 3) * (40 + (e.rest ?? db.settings.rest));
  }
  return Math.max(5, Math.round(s / 300) * 5);
}
/* Lundi 0 h de la semaine contenant la date */
function weekStart(dt) { const m = new Date(dt); m.setHours(0, 0, 0, 0); m.setDate(m.getDate() - (m.getDay() + 6) % 7); return m; }
/* Nombre de semaines d'affilée où l'objectif est atteint (la semaine en cours compte si c'est déjà fait) */
function streakWeeks() {
  const goal = weeklyGoal(), per = new Map();
  for (const s of db.sessions) { const k = weekStart(s.start).getTime(); per.set(k, (per.get(k) || 0) + 1); }
  const w = weekStart(new Date());
  let n = 0;
  if ((per.get(w.getTime()) || 0) >= goal) n++;
  for (;;) {
    w.setDate(w.getDate() - 7);
    if ((per.get(w.getTime()) || 0) >= goal) n++; else break;
  }
  return n;
}
function heroCard() {
  const g = weeklyGoal(), n = weekCount(), pct = Math.min(1, n / g);
  const R = 52, C = 2 * Math.PI * R, st = streakWeeks(), left = Math.max(0, g - n);
  return `<div class="card hero">
    <div class="ring">
      <svg viewBox="0 0 128 128" aria-hidden="true">
        <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--g1)"/><stop offset=".55" style="stop-color:var(--g2)"/><stop offset="1" style="stop-color:var(--g3)"/></linearGradient></defs>
        <circle class="r-bg" cx="64" cy="64" r="${R}"/>
        <circle class="r-fg" cx="64" cy="64" r="${R}" style="--c:${C.toFixed(1)}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - pct)).toFixed(1)}" ${n ? '' : 'opacity="0"'}/>
      </svg>
      <div class="ring-c"><strong>${n}<small>/${g}</small></strong><span>cette semaine</span></div>
    </div>
    <div class="streak">
      <strong><span class="flame">🔥</span> ${st}</strong>
      <p>${st ? `semaine${st > 1 ? 's' : ''} d'affilée` : 'Lance ta série !'}</p>
      <p class="muted small">${left ? `Encore ${left} séance${left > 1 ? 's' : ''} pour l'objectif de la semaine` : 'Objectif de la semaine atteint 💪'}</p>
    </div>
  </div>`;
}
/* Séances (hors repos) prévues un jour donné */
function trainingFor(day) { return db.programs.filter(p => p.cat !== 'repos' && p.days.includes(day)); }
function isRestDay(day) { return db.programs.some(p => p.cat === 'repos' && p.days.includes(day)); }
function doneDaysThisWeek() {
  const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - todayIdx());
  const out = new Set();
  for (const s of db.sessions) { const dt = new Date(s.start); if (dt >= monday) out.add((dt.getDay() + 6) % 7); }
  return out;
}
function lastDoneOf(p) { return db.sessions.filter(s => s.programId === p.id).sort((a, b) => (a.start < b.start ? 1 : -1))[0]; }
function todayCard(p) {
  const last = lastDoneOf(p), doneToday = last && sameDay(last.start, new Date());
  const cat = CATS[p.cat] || CATS.salle, n = p.exercises.length;
  return `<div class="card poster">
    <div class="row-between"><p class="p-eyebrow">${cat.e} ${cat.t}</p>${doneToday ? '<span class="pill ok">✓ Faite</span>' : ''}</div>
    <h3>${esc(p.name)}</h3>
    <p class="muted small">${n} exercice${n > 1 ? 's' : ''} · ~${fmtDuree(estMinutes(p))} · ${last ? 'dernière fois ' + fmtDate(last.start) : 'première fois'}</p>
    ${musclesOf(p).length ? `<div class="tags">${musclesOf(p).map(g => `<span>${esc(g)}</span>`).join('')}</div>` : ''}
    <ul class="plan">${p.exercises.map(ex => { const e = planFor(ex); return `<li><span>${esc(e.name)}</span><span class="plan-v">${planText(e)}</span></li>`; }).join('')}</ul>
    <button class="btn primary block" data-act="start" data-id="${p.id}">${doneToday ? 'Refaire' : 'Démarrer'}</button>
  </div>`;
}

/* ----- Séance en cours ----- */
function viewSession() {
  const a = db.active, n = a.exercises.filter(e => e.done).length, tot = a.exercises.length;
  let h = `<header class="top"><button class="back" data-act="home">‹ Accueil</button><h1>${esc(a.programName)}</h1>
    <p class="muted small">⏱ <span class="chrono" id="chrono">${chronoText()}</span> · commencée à ${fmtTime(a.start)}</p></header>
    <div class="card goal"><div class="row-between"><span class="goal-t">Progression</span><span class="muted">${n} sur ${tot}</span></div>
    <div class="bar"><span style="width:${tot ? n / tot * 100 : 0}%"></span></div></div>`;
  h += a.exercises.map(exCard).join('');
  h += `<button class="btn ghost block" data-act="addExSession">+ Ajouter un exercice</button>`;
  h += `<div class="footer-actions"><button class="btn text danger" data-act="cancelSession">Abandonner</button><button class="btn primary" data-act="finishSession">Terminer la séance</button></div>`;
  return h;
}
function exCard(e, i) {
  const editing = ui.editIdx === i && !e.done, fb = e.done && ui.fbIdx === i;
  let h = `<section class="card exc ${e.done ? 'done' : ''} ${ui.popIdx === i ? 'pop' : ''}">
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
      <p class="explain">${feelEffect(e)}</p>
      <input class="txt" data-scope="act" data-i="${i}" data-f="note" data-text="1" placeholder="À améliorer la prochaine fois (optionnel)" value="${esc(e.note)}">
      <p class="explain">📝 Ta note s'affichera sous cet exercice à ta prochaine séance.</p>
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

/* Ce que le ressenti change pour la prochaine séance */
function nextUp(e) {
  if (e.type === 'cardio') return null;
  if (e.type === 'muscu' && e.kg != null) return `${fmtNum(r2(e.kg + 2.5))} kg`;
  return `${fmtNum((e.reps || 0) + (isSec(e) ? 5 : 1))} ${unitOf(e)}`;
}
function feelEffect(e) {
  if (!e.feel) return 'Ton ressenti prépare ta prochaine séance : 💪 trop facile → je monte la charge, 😮‍💨 trop dur ou 👌 parfait → on garde pareil.';
  if (e.feel === 'easy') return nextUp(e) ? `➜ Prochaine séance : je te proposerai <strong>${nextUp(e)}</strong> au lieu de ${e.type === 'muscu' && e.kg != null ? fmtNum(e.kg) + ' kg' : fmtNum(e.reps) + ' ' + unitOf(e)}.` : '➜ Prochaine séance : vise un peu plus loin ou plus vite !';
  if (e.feel === 'hard') return '➜ Prochaine séance : on garde les mêmes valeurs pour bien les valider.';
  return '➜ Prochaine séance : mêmes valeurs. Quand ça devient facile, dis-le et ça montera.';
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
/* =========================================================
   Questionnaire d'accueil (profil sportif) — tout est facultatif
   ========================================================= */
const OB_STEPS = () => {
  const d = (ui.ob && ui.ob.data) || {};
  return ['hello', 'goal', 'level', 'place', ...(['salle', 'mixte'].includes(d.place) ? ['gym'] : []), 'body', 'days', 'recap'];
};
function startOnboarding(step) {
  const steps = OB_STEPS();
  void steps;
  const data = JSON.parse(JSON.stringify(db.profile || {}));
  const lastW = [...(db.body || [])].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (lastW && data.consent) data.weight = lastW.kg;
  ui.ob = { data, i: 0 };
  if (step) ui.ob.i = Math.max(0, OB_STEPS().indexOf(step));
  ui.view = 'onboard'; render(); toTop();
}
function obOption(f, k, o) {
  const on = ui.ob.data[f] === k;
  return `<button class="ob-opt ${on ? 'on' : ''}" data-act="obPick" data-f="${f}" data-v="${k}">
    ${o.e ? `<span class="ob-e">${o.e}</span>` : ''}<span class="ob-txt"><strong>${esc(o.t)}</strong>${o.s ? `<span>${esc(o.s)}</span>` : ''}</span>
    <span class="ob-check">${on ? ic('check') : ''}</span></button>`;
}
function viewOnboard() {
  const steps = OB_STEPS(), i = Math.min(ui.ob.i, steps.length - 1), step = steps[i], d = ui.ob.data;
  let h = `<div class="ob">
    <div class="ob-top">
      ${i > 0 ? `<button class="back" data-act="obBack">‹ Retour</button>` : '<span></span>'}
      <button class="btn text" data-act="obSkip">${db.profile && db.profile.done ? 'Fermer' : 'Plus tard'}</button>
    </div>
    <div class="ob-dots">${steps.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>`;
  if (step === 'hello') {
    h += `<h1>Personnalisons ton appli</h1>
      <p class="muted">Quelques questions, moins d'une minute. Tout est facultatif et chaque réponse change ce que l'appli te propose.</p>
      <label class="lbl" for="obName">Ton prénom (pour te saluer)</label>
      <input id="obName" class="txt big" data-ob="name" value="${esc(d.name || '')}" placeholder="Facultatif" autocomplete="given-name">`;
  } else if (step === 'goal') {
    h += `<h1>Ton objectif principal ?</h1><p class="muted">Il règle le nombre de répétitions et le temps de repos proposés.</p>
      <div class="ob-list">${Object.entries(GOALS).map(([k, o]) => obOption('goal', k, o)).join('')}</div>`;
  } else if (step === 'level') {
    h += `<h1>Ton niveau ?</h1><p class="muted">Il règle le nombre de séries proposées.</p>
      <div class="ob-list">${Object.entries(LEVELS).map(([k, o]) => obOption('level', k, o)).join('')}</div>`;
  } else if (step === 'place') {
    h += `<h1>Tu t'entraînes où ?</h1><p class="muted">Pour te proposer les bons exercices.</p>
      <div class="ob-list">${Object.entries(PLACES).map(([k, o]) => obOption('place', k, o)).join('')}</div>`;
  } else if (step === 'gym') {
    h += `<h1>Ta salle de sport ?</h1><p class="muted">Les machines de ta salle seront proposées en premier quand tu crées une séance.</p>
      <div class="ob-list">${Object.entries(GYMS).map(([k, o]) => obOption('gym', k, { t: o.t })).join('')}${obOption('gym', 'none', { t: "Je n'ai pas d'abonnement" })}</div>
      ${d.gym === 'autre' ? `<label class="lbl" for="obGymName">Nom de ta salle</label><input id="obGymName" class="txt" data-ob="gymName" value="${esc(d.gymName || '')}" placeholder="ex. Club Atlas">` : ''}
      ${d.gym && d.gym !== 'none' ? `<label class="lbl" for="obGymCity">Ville (facultatif)</label><input id="obGymCity" class="txt" data-ob="gymCity" value="${esc(d.gymCity || '')}" placeholder="ex. Tarbes">` : ''}`;
  } else if (step === 'body') {
    h += `<h1>Quelques infos sur toi</h1>
      <p class="muted">Ton âge, ta taille et ton poids servent à suivre ton évolution. Ce sont des données de santé : elles restent sur ton téléphone (et sur ton compte si tu en crées un), ne sont jamais partagées et tu peux les effacer à tout moment dans le Profil.</p>
      <label class="consent"><input type="checkbox" data-ob="consent" ${d.consent ? 'checked' : ''}><span>J'accepte que l'appli enregistre ces informations pour personnaliser mon suivi.</span></label>
      ${d.consent ? `<div class="grid2">
        <div><label class="lbl" for="obBirth">Année de naissance</label><input id="obBirth" class="txt" inputmode="numeric" data-ob="birthYear" value="${esc(d.birthYear || '')}" placeholder="ex. 2006"></div>
        <div><label class="lbl" for="obHeight">Taille (cm)</label><input id="obHeight" class="txt" inputmode="numeric" data-ob="height" value="${esc(d.height || '')}" placeholder="ex. 178"></div>
      </div>
      <label class="lbl" for="obWeight">Poids actuel (kg)</label><input id="obWeight" class="txt" inputmode="decimal" data-ob="weight" value="${esc(fmtIn(d.weight))}" placeholder="ex. 72,5">` : '<p class="muted small">Tu peux aussi passer cette étape.</p>'}`;
  } else if (step === 'days') {
    const n = d.days || 3;
    h += `<h1>Combien de séances par semaine ?</h1><p class="muted">Ce sera ton objectif de la semaine (l'anneau de l'accueil). Les repères santé conseillent de travailler chaque muscle au moins 2 fois par semaine.</p>
      <div class="ob-days">${[1, 2, 3, 4, 5, 6].map(k => `<button class="${n === k ? 'on' : ''}" data-act="obDays" data-v="${k}">${k}</button>`).join('')}</div>`;
  } else if (step === 'recap') {
    const g = GOALS[d.goal], l = LEVELS[d.level];
    const rows = [
      ['Séries × reps proposées', `${l ? l.sets : 4} × ${g ? g.reps : 10}`, `${l ? l.t : 'niveau non renseigné'} · ${g ? g.t.toLowerCase() : 'objectif non renseigné'}`],
      ['Repos entre les exercices', `${g ? g.rest : db.settings.rest} s`, g ? `adapté à « ${g.t.toLowerCase()} »` : 'valeur actuelle'],
      ['Objectif de la semaine', `${d.days || 3} séance${(d.days || 3) > 1 ? 's' : ''}`, 'remplace par tes jours programmés quand ta semaine est remplie'],
    ];
    if (['salle', 'mixte'].includes(d.place) && d.gym && d.gym !== 'none') rows.push(['Machines', d.gym === 'autre' ? (d.gymName || 'Ta salle') : GYMS[d.gym].t, 'proposées en premier — ajustables dans Profil › Ma salle']);
    if (d.place === 'maison') rows.push(['Exercices', 'À la maison', 'poids du corps proposés en premier']);
    h += `<h1>${d.name ? esc(d.name) + ', c' : 'C'}e que ça change</h1>
      <div class="list">${rows.map(([t, v, s]) => `<div class="lrow static"><span class="lrow-main"><span class="lrow-t">${t}</span><span class="lrow-s">${esc(s)}</span></span><strong>${esc(v)}</strong></div>`).join('')}</div>
      <p class="muted small">Tu pourras tout modifier dans le Profil.</p>`;
  }
  const last = step === 'recap', autoNext = ['goal', 'level', 'place', 'gym', 'days'].includes(step) && !d[step];
  h += `<div class="footer-actions"><button class="btn primary" data-act="${last ? 'obFinish' : 'obNext'}">${last ? "C'est parti 🚀" : autoNext ? 'Passer' : 'Suivant'}</button></div></div>`;
  return h;
}
/* Écran « Ma salle » : cocher les machines présentes */
function viewGym() {
  const p = profile(), have = gymMachines() || new Set();
  let h = `<header class="top"><button class="back" data-act="closeGym">‹ Profil</button><h1>Ma salle</h1>
    <p class="muted">${esc(gymLabel())}</p></header>
    <div class="card"><p class="small">Les enseignes ne publient pas la liste exacte de leurs machines : elle change d'un club à l'autre. On part d'une liste d'équipement courant ; <strong>décoche ce qui n'existe pas dans ta salle</strong> et coche ce qui manque.</p>
      <div class="row"><button class="btn small" data-act="gymAll">Tout cocher</button><button class="btn small" data-act="gymReset">Liste type ${esc(GYMS[p.gym]?.t || '')}</button><button class="btn small" data-act="gymEdit">Changer de salle</button></div></div>`;
  for (const [g, items] of Object.entries(CATALOG.salle)) {
    h += `<p class="cat-t">${esc(g)}</p><div class="chips tight">${items.map(s => {
      const n = parseItem(s).name, on = have.has(n);
      return `<button class="chip ${on ? 'on' : ''}" data-act="gymToggle" data-n="${esc(n)}" aria-pressed="${on}">${on ? '✓ ' : ''}${esc(n)}</button>`;
    }).join('')}</div>`;
  }
  return h;
}
const progLabel = p => `${CATS[p.cat]?.e || ''} ${esc(p.name)}`;
function viewPrograms() {
  let h = `<header class="top"><h1>Séances</h1><p class="muted">Ta semaine type : touche un jour pour le programmer.</p></header>`;
  h += `<h2>Ma semaine</h2><div class="list">${JOURS.map((j, i) => {
    const tr = trainingFor(i), rest = !tr.length && isRestDay(i);
    const sub = tr.length ? tr.map(progLabel).join(' + ') : rest ? '😴 Repos' : '<span class="todo">À programmer</span>';
    return listRow({ act: 'dayPlan', attrs: `data-day="${i}"`, title: j, sub });
  }).join('')}</div>`;
  return h;
}
/* Séances existantes portant le même nom (ex. « Push » déjà le lundi) */
function sameSessions(draft) {
  const k = nkey(draft.name);
  if (!k) return [];
  const type = SALLE_TYPES.find(t => nkey(t) === k);
  return db.programs.filter(o => o.id !== draft.id && o.cat !== 'repos' && o.days.length &&
    (nkey(o.name) === k || (type && nkey(o.name).startsWith(nkey(type)))));
}
/* Catalogue à afficher dans l'éditeur : groupes utiles d'abord */
function catalogFor(p) {
  const groups = CATALOG[p.cat] || {};
  const focus = p.cat === 'salle' ? FOCUS[p.name.trim()] : null;
  const names = Object.keys(groups);
  const shown = focus && !ui.allMachines ? names.filter(g => focus.includes(g)) : names;
  return { groups, shown, hidden: names.length - shown.length };
}
function viewEditor() {
  const p = ui.draft, isNew = !db.programs.some(x => x.id === p.id), cat = CATS[p.cat];
  let h = `<header class="top"><button class="back" data-act="cancelEdit">‹ Annuler</button>
    <p class="eyebrow">${cat.e} ${cat.t}</p><h1>${p.cat === 'repos' ? 'Jours de repos' : isNew ? 'Nouvelle séance' : 'Modifier'}</h1></header><div class="card">`;
  if (p.cat === 'salle') {
    h += `<label class="lbl">Type de séance</label><div class="chips tight">${SALLE_TYPES.map(t => `<button class="chip ${p.name.trim() === t ? 'on' : ''}" data-act="pickType" data-v="${t}">${t}</button>`).join('')}</div>`;
  }
  if (isNew && p.cat !== 'repos') {
    for (const o of sameSessions(p)) {
      const days = o.days.map(i => JOURS[i].toLowerCase()).join(' et ');
      h += `</div><div class="card reuse">
        <p>💡 Tu as déjà une séance <strong>${esc(o.name)}</strong> le ${days}.</p>
        <p class="muted small">La reprendre telle quelle ? Mêmes exercices, mêmes poids, progrès en commun.</p>
        <button class="btn primary block" data-act="reuseProgram" data-id="${o.id}">Oui, comme ${o.days.length ? JOURS[o.days[0]].toLowerCase() : 'avant'}</button>
      </div><div class="card">`;
    }
  }
  if (p.cat !== 'repos') h += `<label class="lbl">Nom</label><input class="txt big" data-draft="name" value="${esc(p.name)}" placeholder="${p.cat === 'salle' ? 'ex. Push' : p.cat === 'maison' ? 'ex. Circuit maison' : 'ex. Footing'}">`;
  h += `<label class="lbl">Jours</label>
    <div class="days">${JOURS_COURT.map((j, i) => `<button data-act="toggleDay" data-i="${i}" class="${p.days.includes(i) ? 'on' : ''}">${j}</button>`).join('')}</div></div>`;
  if (p.cat !== 'repos') {
    h += `<h2>Exercices</h2>`;
    if (p.exercises.length) h += `<div class="list">${p.exercises.map((e, i) => listRow({ act: 'editExDraft', attrs: `data-i="${i}"`, title: esc(e.name), sub: planText(e) })).join('')}</div>`;
    const have = new Set(p.exercises.map(e => nkey(e.name)));
    const { groups, shown, hidden } = catalogFor(p);
    const mine = p.cat === 'salle' ? gymMachines() : null; // machines de la salle de l'utilisateur
    let notInGym = 0;
    h += `<div class="card catalog"><p class="cat-head">${p.cat === 'salle' ? (mine ? `📍 Machines de ta salle (${esc(gymLabel())})` : 'Machines et exercices') : p.cat === 'maison' ? 'Exercices à la maison' : 'Activités'} — touche pour ajouter</p>`;
    for (const g of shown) {
      const items = groups[g].filter(s => {
        const ok = !mine || ui.allMachines || mine.has(parseItem(s).name) || have.has(nkey(parseItem(s).name));
        if (!ok) notInGym++;
        return ok;
      });
      if (!items.length) continue;
      h += `<p class="cat-t">${esc(g)}</p><div class="chips tight">${items.map(s => {
        const { name } = parseItem(s), added = have.has(nkey(name)), absent = mine && !mine.has(name);
        return `<button class="chip ${added ? 'on' : ''} ${absent && !added ? 'absent' : ''}" data-act="${added ? 'noop' : 'pickItem'}" data-item="${esc(s)}">${added ? '✓ ' : ''}${esc(name)}</button>`;
      }).join('')}</div>`;
    }
    if (mine && notInGym && !ui.allMachines) h += `<p class="muted small">${notInGym} machine${notInGym > 1 ? 's' : ''} masquée${notInGym > 1 ? 's' : ''} car pas cochée${notInGym > 1 ? 's' : ''} dans ta salle.</p>`;
    if (hidden || (mine && notInGym && !ui.allMachines)) h += `<button class="btn text block" data-act="toggleMachines">Voir toutes les machines${hidden ? ` (${hidden} groupes de plus)` : ''}</button>`;
    else if (ui.allMachines && p.cat === 'salle' && (FOCUS[p.name.trim()] || mine)) h += `<button class="btn text block" data-act="toggleMachines">${mine ? 'Afficher seulement ma salle' : 'Afficher seulement ' + esc(p.name.trim())}</button>`;
    h += `<button class="btn text block" data-act="addExDraft">Mon exercice n'est pas dans la liste</button></div>`;
  }
  if (!isNew) h += `<button class="btn text danger block" data-act="deleteProgram">Supprimer ${p.cat === 'repos' ? 'les jours de repos' : 'cette séance'}</button>`;
  h += `<div class="footer-actions">${!isNew && p.cat !== 'repos' ? `<button class="btn" data-act="start" data-id="${p.id}">Démarrer</button>` : ''}<button class="btn primary" data-act="saveProgram">Enregistrer</button></div>`;
  return h;
}
function viewSheet() {
  if (ui.sheet.kind === 'cat') return viewCatSheet();
  return viewExSheet();
}
function viewCatSheet() {
  const day = ui.sheet.day, rest = day != null && isRestDay(day);
  return `<div class="sheet-bg" data-act="closeSheet"></div>
  <div class="sheet" role="dialog" aria-label="Programmer"><div class="grab"></div>
    <h3>${day != null ? 'Le ' + JOURS[day].toLowerCase() + ', ' : ''}c'est…</h3>
    <div class="list">${Object.entries(CATS).map(([k, c]) => listRow({ act: 'pickCat', attrs: `data-v="${k}"`, title: `${c.e} ${c.t}`, sub: c.s })).join('')}
    ${rest ? listRow({ act: 'clearDay', title: 'Remettre à programmer', cls: 'danger' }) : ''}</div>
  </div>`;
}
function viewExSheet() {
  const s = ui.sheet, e = s.ex, isNew = s.index < 0;
  return `<div class="sheet-bg" data-act="closeSheet"></div>
  <div class="sheet" role="dialog" aria-label="Exercice">
    <div class="grab"></div>
    ${s.fromCatalog ? `<h3>${esc(e.name)}</h3><p class="muted small">${e.type === 'cardio' ? 'Indique ta distance et ta durée habituelles.' : e.type === 'muscu' ? 'Indique le poids que tu fais, tes séries et tes reps.' : 'Indique tes séries et tes reps.'}</p>` : `
    <h3>${isNew ? 'Nouvel exercice' : 'Exercice'}</h3>
    <input class="txt big" data-sheet="name" value="${esc(e.name)}" placeholder="Nom (ex. Tirage poulie haute)" list="exNames" autocomplete="off">
    <div class="chips">${Object.entries(TYPES).map(([k, v]) => `<button class="chip ${e.type === k ? 'on' : ''}" data-act="sheetType" data-v="${k}">${v}</button>`).join('')}</div>`}
    ${e.type === 'pdc' && !s.fromCatalog ? `<div class="chips">${[['reps', 'En répétitions'], ['sec', 'En secondes']].map(([k, v]) => `<button class="chip ${(e.unit || 'reps') === k ? 'on' : ''}" data-act="sheetUnit" data-v="${k}">${v}</button>`).join('')}</div>` : ''}
    <div class="steps">${steppersFor(e, 'sheet', 0)}${e.type !== 'cardio' ? stepper('Repos', 'sheet', 0, 'rest', e.rest, 15, 's') : ''}</div>
    ${s.mode === 'draft' && !isNew ? `<div class="row"><button class="btn small" data-act="moveEx" data-d="-1">↑ Monter</button><button class="btn small" data-act="moveEx" data-d="1">↓ Descendre</button><button class="btn small danger" data-act="delEx">Supprimer</button></div>` : ''}
    <button class="btn primary block" data-act="saveSheet">${s.mode === 'session' ? 'Ajouter à la séance' : 'Valider'}</button>
  </div>
  <datalist id="exNames">${knownExerciseNames().map(n => `<option value="${esc(n)}">`).join('')}</datalist>`;
}

/* ----- Historique ----- */
function viewHistory() {
  const n = new Date();
  if (!ui.cal) ui.cal = { y: n.getFullYear(), m: n.getMonth() };
  const { y, m } = ui.cal;
  const first = new Date(y, m, 1), nbDays = new Date(y, m + 1, 0).getDate(), offset = (first.getDay() + 6) % 7;
  const byDay = new Map();
  for (const s of db.sessions) {
    const d = new Date(s.start);
    if (d.getFullYear() === y && d.getMonth() === m) {
      const k = d.getDate();
      byDay.set(k, [...(byDay.get(k) || []), s].sort((a, b) => (a.start < b.start ? -1 : 1)));
    }
  }
  const count = [...byDay.values()].reduce((a, l) => a + l.length, 0);
  let h = `<header class="top"><h1>Historique</h1></header>
    <div class="card cal">
      <div class="cal-head">
        <button class="icon-btn" data-act="calMove" data-d="-1" aria-label="Mois précédent">‹</button>
        <strong>${cap(first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }))}</strong>
        <button class="icon-btn" data-act="calMove" data-d="1" aria-label="Mois suivant">›</button>
      </div>
      <div class="cal-grid">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(j => `<span class="cal-wd">${j}</span>`).join('')}
        ${'<span></span>'.repeat(offset)}
        ${Array.from({ length: nbDays }, (_, i) => {
          const d = i + 1, list = byDay.get(d), isToday = sameDay(new Date(y, m, d), n), sel = ui.calSel === `${y}-${m}-${d}`;
          return `<button class="cal-d ${list ? 'done' : ''} ${isToday ? 'today' : ''} ${sel ? 'sel' : ''}" ${list ? `data-act="calPick" data-k="${y}-${m}-${d}"` : 'disabled'}>
            ${d}</button>`;
        }).join('')}
      </div>
      <p class="muted small">${count ? `${count} séance${count > 1 ? 's' : ''} ce mois-ci` : 'Aucune séance ce mois-ci'}</p>
    </div>`;
  const [sy, sm, sd] = (ui.calSel || '').split('-').map(Number);
  const selList = ui.calSel && sy === y && sm === m ? byDay.get(sd) : null;
  if (selList) {
    h += `<h2>${cap(new Date(sy, sm, sd).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))}</h2>
      <div class="list">${selList.map(s => {
        const dur = s.end ? (new Date(s.end) - new Date(s.start)) / 60000 : null, prs = newRecords(s).length;
        return listRow({ act: 'openSession', attrs: `data-id="${s.id}"`, title: esc(s.programName),
          sub: `${fmtTime(s.start)} · ${fmtDuree(dur)} · ${s.exercises.length} exercice${s.exercises.length > 1 ? 's' : ''}`,
          right: prs ? `<span class="pill ok">🏆 ${prs}</span>` : '' });
      }).join('')}</div>`;
  } else if (count) h += `<p class="muted small center">Touche un jour vert pour voir ta séance.</p>`;
  return h;
}
function viewSessionDetail() {
  const s = db.sessions.find(x => x.id === ui.sessionId);
  const dur = s.end ? (new Date(s.end) - new Date(s.start)) / 60000 : null;
  const prs = newRecords(s);
  let h = `<header class="top"><button class="back" data-act="closeDetail">‹ Retour</button><h1>${esc(s.programName)}</h1>
    <p class="muted small">${cap(new Date(s.start).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))} · ${fmtTime(s.start)} · ${fmtDuree(dur)}</p></header>`;
  const vol = volumeOf(s), prev = db.sessions.filter(x => x.programId === s.programId && x.start < s.start).sort((a, b) => (a.start < b.start ? 1 : -1))[0];
  const pv = prev ? volumeOf(prev) : 0, dv = pv ? Math.round((vol - pv) / pv * 100) : null;
  h += `<div class="tiles">
    <div class="tile"><strong>${fmtDuree(dur)}</strong><span>durée</span></div>
    <div class="tile"><strong>${vol ? fmtNum(Math.round(vol)) + ' kg' : '–'}</strong><span>volume soulevé</span>${dv != null && vol ? `<span class="delta ${dv >= 0 ? 'up' : 'down'}">${dv >= 0 ? '▲ +' : '▼ '}${dv} % vs dernière fois</span>` : ''}</div>
    <div class="tile"><strong>${s.exercises.length}</strong><span>exercice${s.exercises.length > 1 ? 's' : ''}</span></div>
    <div class="tile"><strong>${prs.length ? '🏆 ' + prs.length : '0'}</strong><span>record${prs.length > 1 ? 's' : ''} battu${prs.length > 1 ? 's' : ''}</span></div>
  </div>`;
  if (prs.length) h += `<div class="card record"><strong>🏆 Nouveaux records</strong>${prs.map(p => `<p>${esc(p)}</p>`).join('')}</div>`;
  h += `<div class="list">${s.exercises.map(e => `<div class="lrow static"><span class="lrow-main"><span class="lrow-t">${esc(e.name)}</span>
    <span class="lrow-s">${summary(e)}${e.feel ? ' · ' + FEEL[e.feel].e + ' ' + FEEL[e.feel].t : ''}</span>
    ${e.feel === 'easy' && nextUp(e) ? `<span class="lrow-s up">➜ Prochaine fois : ${nextUp(e)}</span>` : ''}
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
  if (db.sessions.length) h += volumeCard() + musclesCard();
  h += bodyCard();
  const labels = new Map();
  for (const s of db.sessions) for (const e of s.exercises) labels.set(nkey(e.name), e.name);
  if (!labels.size) return h + `<div class="card"><p class="muted">Termine une séance pour voir ta progression par exercice.</p></div>`;
  h += recordsCard(labels);
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
/* Volume soulevé sur les 8 dernières semaines */
function volumeCard() {
  const cur = weekStart(new Date()), weeks = [];
  for (let k = 7; k >= 0; k--) { const w = new Date(cur); w.setDate(w.getDate() - 7 * k); weeks.push({ t: w.getTime(), v: 0, n: 0 }); }
  for (const s of db.sessions) {
    const w = weeks.find(x => x.t === weekStart(s.start).getTime());
    if (w) { w.v += volumeOf(s); w.n++; }
  }
  const max = Math.max(1, ...weeks.map(w => w.v)), last = weeks[7].v;
  return `<div class="card"><div class="row-between"><strong>Volume par semaine</strong><span class="muted small">${fmtNum(Math.round(last))} kg cette semaine</span></div>
    <div class="vbars">${weeks.map((w, i) => `<div class="vbar ${i === 7 ? 'cur' : ''}" title="${fmtNum(Math.round(w.v))} kg · ${w.n} séance(s)">
      <b style="height:${Math.round(w.v / max * 100)}%; animation-delay:${i * 40}ms"></b><span>${i === 7 ? 'Cette' : fmtShort(new Date(w.t).toISOString())}</span></div>`).join('')}</div>
    <p class="muted small">Volume = séries × reps × kg, toutes séances de muscu confondues.</p></div>`;
}
/* Séries par muscle cette semaine (repère ACSM 2026 : ~10 séries/semaine/muscle pour prendre du muscle) */
function musclesCard() {
  const ws = weekStart(new Date()), counts = new Map();
  for (const s of db.sessions) {
    if (new Date(s.start) < ws) continue;
    for (const e of s.exercises) {
      const g = GROUP_OF.get(nkey(e.name));
      if (!g || e.type === 'cardio' || g === 'Cardio' || g === 'Activités') continue;
      counts.set(g, (counts.get(g) || 0) + (e.sets || 0));
    }
  }
  const main = ['Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Jambes', 'Abdos'];
  const groups = [...new Set([...main, ...counts.keys()])];
  const target = 10;
  return `<div class="card"><div class="row-between"><strong>Muscles cette semaine</strong><span class="muted small">séries</span></div>
    <div class="mbars">${groups.map(g => { const n = counts.get(g) || 0; return `<div class="mbar"><span class="mb-l">${esc(g)}</span><span class="mb-t"><b style="width:${Math.min(100, n / target * 100)}%"></b></span><span class="mb-v ${n >= target ? 'ok' : ''}">${n}${n >= target ? ' ✓' : ''}</span></div>`; }).join('')}</div>
    <p class="muted small">Repère : environ ${target} séries par muscle et par semaine pour prendre du muscle (ACSM 2026). Pas besoin d'aller à l'échec.</p></div>`;
}
/* Poids du corps : saisie + courbe */
function bodyCard() {
  const list = [...(db.body || [])].sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = list[list.length - 1], first = list[0];
  const diff = last && first && list.length > 1 ? r2(last.kg - first.kg) : null;
  return `<div class="card"><div class="row-between"><strong>Poids du corps</strong>${last ? `<span class="muted small">${fmtNum(last.kg)} kg${diff != null ? ` · ${diff >= 0 ? '+' : ''}${fmtNum(diff)} kg depuis le début` : ''}</span>` : ''}</div>
    ${list.length >= 2 ? chart(list.slice(-20).map(b => ({ d: b.date, y: b.kg })), v => fmtNum(v) + ' kg') : `<p class="muted small">Note ton poids de temps en temps pour suivre ton évolution.</p>`}
    <div class="bw-add"><input class="txt" id="bwInput" inputmode="decimal" placeholder="Ton poids aujourd'hui (kg)" value="${last && sameDay(last.date, new Date()) ? esc(fmtIn(last.kg)) : ''}"><button class="btn primary" data-act="addBody">Noter</button></div>
  </div>`;
}
/* Meilleur record par exercice */
function recordsCard(labels) {
  const rows = [];
  for (const [, name] of labels) {
    const r = records(name), h = historyOf(name), type = h[h.length - 1].entry.type, u = unitOf(h[h.length - 1].entry);
    const val = type === 'cardio' ? (r.km != null ? fmtNum(r.km) + ' km' : '–') : r.maxKg != null ? fmtNum(r.maxKg) + ' kg' : fmtNum(r.maxReps) + ' ' + u;
    rows.push({ name, val, when: h[h.length - 1].session.start });
  }
  rows.sort((a, b) => (a.when < b.when ? 1 : -1));
  return `<h2>🏆 Mes records</h2><div class="list">${rows.slice(0, 12).map(r => `<div class="lrow static"><span class="lrow-main"><span class="lrow-t">${esc(r.name)}</span><span class="lrow-s">dernière fois ${fmtDate(r.when)}</span></span><strong>${r.val}</strong></div>`).join('')}</div>
    <h2>Par exercice</h2>`;
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
  const pr = profile();
  const age = pr.birthYear ? new Date().getFullYear() - pr.birthYear : null;
  h += `<h2>Mon profil sportif</h2><div class="list">
    ${listRow({ act: 'openOnboard', title: pr.done ? `${GOALS[pr.goal]?.e || '🎯'} ${GOALS[pr.goal]?.t || 'Objectif non renseigné'}` : '👋 Compléter mon profil', sub: pr.done ? [LEVELS[pr.level]?.t, PLACES[pr.place]?.t, pr.days ? pr.days + ' séances / semaine' : ''].filter(Boolean).join(' · ') || 'Modifier' : 'Objectif, niveau, salle… 1 minute' })}
    ${hasGym() ? listRow({ act: 'openGym', title: '📍 Ma salle et ses machines', sub: esc(gymLabel()) + ` · ${gymMachines().size} machines cochées` }) : ''}
    ${pr.consent && (age || pr.height) ? `<div class="lrow static"><span class="lrow-main"><span class="lrow-t">Infos perso</span><span class="lrow-s">${[age ? age + ' ans' : '', pr.height ? pr.height + ' cm' : ''].filter(Boolean).join(' · ')}</span></span></div>` : ''}
    ${pr.done ? listRow({ act: 'clearProfile', title: 'Effacer mes infos perso', sub: 'Profil, âge, taille et poids', cls: 'danger' }) : ''}
  </div>`;
  const th = db.settings.theme || 'auto', pal = db.settings.palette || 'graphite';
  h += `<h2>Apparence</h2><div class="list">
    <div class="lrow static"><span class="lrow-main"><span class="lrow-t">Mode</span><span class="lrow-s">${th === 'auto' ? 'suit ton téléphone' : th === 'dark' ? 'toujours sombre' : 'toujours clair'}</span></span>
      <div class="seg" role="group" aria-label="Mode">${[['auto', 'Auto'], ['light', 'Clair'], ['dark', 'Sombre']].map(([k, v]) => `<button class="${th === k ? 'on' : ''}" data-act="setTheme" data-v="${k}">${v}</button>`).join('')}</div></div>
    <div class="lrow static"><span class="lrow-main"><span class="lrow-t">Couleurs</span><span class="lrow-s">s'applique à toute l'appli</span></span></div>
    <div class="lrow static"><span class="lrow-main"><span class="lrow-t">Taille du texte</span><span class="lrow-s">plus lisible à la salle</span></span>
      <div class="seg" role="group" aria-label="Taille du texte">${[['m', 'A'], ['l', 'A+'], ['xl', 'A++']].map(([k, v]) => `<button class="${(db.settings.textSize || 'm') === k ? 'on' : ''}" data-act="setPref" data-k="textSize" data-v="${k}" aria-label="Texte ${v}">${v}</button>`).join('')}</div></div>
    <div class="lrow static"><span class="lrow-main"><span class="lrow-t">Animations</span><span class="lrow-s">confettis, transitions…</span></span>
      <div class="seg" role="group" aria-label="Animations">${[['auto', 'Normales'], ['reduced', 'Réduites']].map(([k, v]) => `<button class="${(db.settings.motion || 'auto') === k ? 'on' : ''}" data-act="setPref" data-k="motion" data-v="${k}">${v}</button>`).join('')}</div></div>
    <div class="palettes">${PALETTES.map(p => `<button class="pal ${pal === p.id ? 'on' : ''}" data-act="setPalette" data-v="${p.id}" aria-pressed="${pal === p.id}">
      <i style="background:linear-gradient(135deg,${p.c[0]},${p.c[1]} 55%,${p.c[2]})">${pal === p.id ? '<span style="color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.5)">✓</span>' : ''}</i>${p.t}</button>`).join('')}</div>
  </div>`;
  h += `<h2>Réglages</h2><div class="list">
    <div class="lrow static"><span class="lrow-main"><span class="lrow-t">Temps de repos</span><span class="lrow-s">par défaut, après chaque exercice</span></span>${miniStepper('rest', 15, 's')}</div>
    <div class="lrow static"><span class="lrow-main"><span class="lrow-t">Objectif par semaine</span><span class="lrow-s">${db.settings.goalAuto !== false ? `auto : ${weeklyGoal()} = tes jours d'entraînement programmés` : 'nombre de séances, choisi par toi'}</span></span>
      <div class="seg" role="group" aria-label="Objectif">${[['auto', 'Auto'], ['manual', 'Manuel']].map(([k, v]) => `<button class="${(db.settings.goalAuto !== false) === (k === 'auto') ? 'on' : ''}" data-act="setGoalMode" data-v="${k}">${v}</button>`).join('')}</div></div>
    ${db.settings.goalAuto === false ? `<div class="lrow static"><span class="lrow-main"><span class="lrow-t">Séances par semaine</span></span>${miniStepper('weeklyGoal', 1)}</div>` : ''}
  </div>
  <h2>Mes données</h2><div class="list">
    ${listRow({ act: 'export', title: 'Exporter une sauvegarde' })}
    ${listRow({ act: 'import', title: 'Importer une sauvegarde' })}
    ${auth ? listRow({ act: 'logout', title: 'Se déconnecter' }) : ''}
    ${listRow({ act: 'deleteProgress', title: 'Supprimer mes progrès', sub: 'Historique, records et graphiques (ta semaine est gardée)', cls: 'danger' })}
    ${listRow({ act: 'wipe', title: 'Tout effacer', sub: 'Progrès + séances programmées + réglages', cls: 'danger' })}
  </div>
  <p class="muted small center">${db.programs.length} séance(s) programmée(s) · ${db.sessions.length} entraînement(s) enregistré(s)</p>
  <p class="muted small center">Version ${APP_VERSION}</p>`;
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
/* Marque un jour comme repos (sans jour : ouvre l'éditeur des jours de repos) */
function setRest(day) {
  ui.sheet = null;
  const existing = db.programs.find(p => p.cat === 'repos');
  if (day == null) {
    ui.draft = existing ? JSON.parse(JSON.stringify(existing)) : { id: uid(), cat: 'repos', name: 'Repos', days: [], exercises: [] };
    ui.view = 'editProgram'; render(); return;
  }
  let r = existing;
  if (!r) { r = { id: uid(), cat: 'repos', name: 'Repos', days: [], exercises: [] }; db.programs.push(r); }
  setDay(r, day); saveDb(); render(); toast(`${JOURS[day]} : repos 😴`);
}
/* Met la séance p ce jour-là (et l'enlève des autres) */
function setDay(p, day) {
  db.programs.forEach(o => { if (o.id !== p.id && o.days.includes(day)) { o.days = o.days.filter(x => x !== day); o.u = now(); } });
  if (!p.days.includes(day)) p.days = [...p.days, day].sort();
  p.u = now();
}
function newEx() { return { id: uid(), name: '', type: 'muscu', unit: 'reps', sets: 3, reps: 10, kg: null, km: null, min: null, rest: null }; }
function cleanEntry(e) { const { hint, lastNote, done, ...rest } = e; return rest; }
/* Écran affiché après le clic sur le lien de confirmation de l'email */
function viewConfirmed() {
  return `<div class="auth confirmed">
    <div class="logo">${ic('check')}</div>
    <h1 class="center">Compte confirmé !</h1>
    <p class="center">Merci d'avoir confirmé ton adresse${ui.confirmedEmail ? ` <strong>${esc(ui.confirmedEmail)}</strong>` : ''}.</p>
    <div class="card">
      <p><strong>📱 Tu as installé l'appli sur ton écran d'accueil ?</strong></p>
      <p class="muted">Ferme cette page et retourne dans l'appli <strong>Séances</strong>, puis connecte-toi avec ton email et ton mot de passe (Profil › Se connecter).</p>
      <p style="margin-top:12px"><strong>💻 Tu es sur ton ordinateur ?</strong></p>
      <p class="muted">Tu es déjà connecté ici : tu peux continuer directement.</p>
    </div>
    <button class="btn primary block" data-act="confirmedGo">Continuer ici</button>
  </div>`;
}
/* Après l'écran de connexion : questionnaire pour un nouvel utilisateur, sinon l'accueil */
function afterAuthScreen() {
  if (!db.profile && !db.programs.length && !db.sessions.length) { startOnboarding(); return; }
  ui.view = null; ui.tab = auth ? 'profile' : 'today'; render(); toTop();
}
/* Retour depuis le lien de confirmation email : Supabase renvoie les jetons dans l'adresse (#access_token=…) */
async function authFromLink() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (!cloudOn()) return;
  if (h.get('error_description')) {
    history.replaceState(null, '', location.pathname);
    toast('Lien expiré ou déjà utilisé : connecte-toi avec ton email et ton mot de passe');
    return;
  }
  const at = h.get('access_token'), rt = h.get('refresh_token');
  if (!at || !rt) return;
  history.replaceState(null, '', location.pathname); // retirer les jetons de l'adresse
  try {
    const r = await fetch(`${CFG.supabaseUrl}/auth/v1/user`, { headers: { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + at } });
    if (!r.ok) throw new Error();
    const user = await r.json();
    setAuth({ access_token: at, refresh_token: rt, expires_in: +(h.get('expires_in') || 3600), user });
    markWelcomed();
    ui.confirmedEmail = user.email; ui.view = 'confirmed'; render(); toTop();
    sync();
  } catch (e) { toast('Connexion impossible depuis ce lien : connecte-toi avec ton email'); }
}
function authMsg(t) { const el = $('#authMsg'); if (el) el.textContent = t; }

const actions = {
  tab(d) { goTab(d.tab); },
  pickDay(d) { ui.day = +d.i; render(); },
  home() { ui.view = null; ui.tab = 'today'; render(); toTop(); },
  resume() { ui.view = 'session'; render(); keepAwake(true); toTop(); },

  /* Séance */
  start(d) {
    const p = db.programs.find(x => x.id === d.id);
    if (!p) return;
    if (db.active && !confirm(`La séance « ${db.active.programName} » est déjà en cours. La remplacer ?`)) return;
    db.active = { id: uid(), programId: p.id, programName: p.name, start: new Date().toISOString(), u: now(), exercises: p.exercises.map(ex => planFor(ex)) };
    ui.fbIdx = null; ui.editIdx = null;
    saveDb(); ui.view = 'session'; render(); keepAwake(true); toTop();
  },
  tick(d) {
    const i = +d.i, e = db.active.exercises[i];
    e.done = !e.done; touchActive(); saveDb();
    if (e.done) {
      ui.fbIdx = i; ui.editIdx = null; ui.popIdx = i;
      try { navigator.vibrate && navigator.vibrate(30); } catch (err) { /* */ }
      if (e.type !== 'cardio') startTimer(e.rest ?? db.settings.rest);
    } else if (ui.fbIdx === i) ui.fbIdx = null;
    render(); ui.popIdx = null;
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
    const sd = new Date(session.start);
    ui.cal = { y: sd.getFullYear(), m: sd.getMonth() }; ui.calSel = `${sd.getFullYear()}-${sd.getMonth()}-${sd.getDate()}`;
    ui.view = 'sessionDetail'; ui.sessionId = session.id; ui.tab = 'history';
    render(); toTop();
    if (newRecords(session).length) { confetti(); toast('🏆 Nouveau record !'); } else toast('Séance enregistrée 💪');
  },
  cancelSession() {
    if (!confirm('Abandonner cette séance ? Rien ne sera enregistré.')) return;
    clearActive(); saveDb(); actions.home();
  },

  /* Programmes */
  newProgram(d) { ui.sheet = { kind: 'cat', day: d && d.day != null ? +d.day : null }; render(); },
  pickCat(d) {
    const day = ui.sheet.day;
    if (d.v === 'repos') { setRest(day); return; }
    const name = d.v === 'maison' ? 'Circuit maison' : d.v === 'exterieur' ? 'Footing' : '';
    ui.draft = { id: uid(), cat: d.v, name, days: day != null ? [day] : [], exercises: [] };
    ui.sheet = null; ui.view = 'editProgram'; render(); toTop();
  },
  pickType(d) { ui.draft.name = d.v; ui.allMachines = false; render(); },
  /* Touche une machine : on ouvre la fiche pour régler poids, séries, reps */
  pickItem(d) { ui.sheet = { mode: 'draft', index: -1, ex: exFromItem(d.item), fromCatalog: true }; render(); },
  toggleMachines() { ui.allMachines = !ui.allMachines; render(); },
  /* Même séance sur un jour de plus (ex. Push lundi + jeudi) */
  reuseProgram(d) {
    const o = db.programs.find(x => x.id === d.id); if (!o) return;
    const days = ui.draft.days;
    days.forEach(day => setDay(o, day));
    saveDb(); ui.draft = null; ui.view = null; ui.tab = 'programs'; render(); toTop();
    toast(`${o.name} : ${o.days.map(i => JOURS[i].toLowerCase()).join(' et ')}`);
  },
  noop() {},
  /* Jour vide (ou repos) : les 4 choix ; jour avec séance : on la modifie */
  dayPlan(d) {
    const day = +d.day, tr = trainingFor(day);
    if (tr.length) { actions.editProgram({ id: tr[0].id }); return; }
    ui.sheet = { kind: 'cat', day }; render();
  },
  assignRest() { setRest(ui.sheet ? ui.sheet.day : null); },
  clearDay() {
    const day = ui.sheet.day;
    db.programs.forEach(p => { if (p.days.includes(day)) { p.days = p.days.filter(x => x !== day); p.u = now(); } });
    saveDb(); ui.sheet = null; render();
  },
  editProgram(d) {
    const p = db.programs.find(x => x.id === d.id); if (!p) return;
    ui.sheet = null; ui.draft = JSON.parse(JSON.stringify(p)); ui.view = 'editProgram'; render(); toTop();
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
    p.name = (p.name || '').trim() || (p.cat === 'repos' ? 'Repos' : '');
    if (!p.name) { toast('Donne un nom à la séance'); return; }
    if (p.cat !== 'repos' && !p.exercises.length) { toast('Ajoute au moins un exercice'); return; }
    p.u = now();
    // Un seul programme par jour : on libère ces jours dans les autres séances
    db.programs.forEach(o => {
      if (o.id === p.id) return;
      const keep = o.days.filter(x => !p.days.includes(x));
      if (keep.length !== o.days.length) { o.days = keep; o.u = now(); }
    });
    const i = db.programs.findIndex(x => x.id === p.id);
    if (i >= 0) db.programs[i] = p; else db.programs.push(p);
    saveDb(); ui.draft = null; ui.view = null; ui.tab = 'programs'; render(); toast('Enregistré ✅');
  },
  deleteProgram() {
    if (!confirm(ui.draft.cat === 'repos' ? 'Retirer tous les jours de repos ?' : `Supprimer la séance « ${ui.draft.name} » ? Ton historique est conservé.`)) return;
    db.deleted[ui.draft.id] = now();
    db.programs = db.programs.filter(x => x.id !== ui.draft.id);
    saveDb(); ui.draft = null; ui.view = null; render();
  },

  /* Historique */
  calMove(d) {
    const c = new Date(ui.cal.y, ui.cal.m + +d.d, 1);
    ui.cal = { y: c.getFullYear(), m: c.getMonth() }; render();
  },
  calPick(d) { ui.calSel = ui.calSel === d.k ? null : d.k; render(); },
  openSession(d) { ui.sessionId = d.id; ui.view = 'sessionDetail'; render(); toTop(); },
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
  openAuth() { ui.view = 'auth'; render(); toTop(); },
  skipAuth() { markWelcomed(); afterAuthScreen(); },
  confirmedGo() { ui.confirmedEmail = null; afterAuthScreen(); },
  async signIn() {
    const email = $('#authEmail').value.trim(), pw = $('#authPw').value;
    if (!email || !pw) { authMsg('Renseigne ton email et ton mot de passe'); return; }
    authMsg('Connexion…');
    try { await apiSignIn(email, pw); }
    catch (e) { authMsg(e.message); return; }
    markWelcomed(); toast('Connecté ✅'); await sync(); afterAuthScreen();
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
    markWelcomed(); toast('Compte créé ✅'); await sync(); afterAuthScreen();
  },
  syncNow() { sync(); },
  setTheme(d) { db.settings.theme = d.v; db.settingsU = now(); saveDb(); render(); },
  /* ----- Questionnaire ----- */
  openOnboard() { startOnboarding(); },
  obPick(d) {
    ui.ob.data[d.f] = d.v;
    if (d.f === 'gym' && d.v === 'autre') { render(); return; }
    if (d.f === 'gym' && d.v !== 'none') { render(); return; } // laisser saisir la ville
    actions.obNext();
  },
  obDays(d) { ui.ob.data.days = +d.v; actions.obNext(); },
  obNext() { ui.ob.i = Math.min(ui.ob.i + 1, OB_STEPS().length - 1); render(); toTop(); },
  obBack() { ui.ob.i = Math.max(0, ui.ob.i - 1); render(); toTop(); },
  obSkip() {
    if (!db.profile) { db.profile = { skipped: true, u: now() }; saveDb(); }
    ui.ob = null; ui.view = null; ui.tab = 'today'; render();
  },
  obFinish() {
    const d = { ...ui.ob.data }, prev = db.profile || {};
    if (prev.gym !== d.gym) delete d.machines; // nouvelle salle : repartir de sa liste type
    const w = num(d.weight);
    delete d.weight; delete d.skipped;
    if (!d.consent) { delete d.birthYear; delete d.height; }
    else {
      d.birthYear = num(d.birthYear); d.height = num(d.height);
      if (w && w >= 25 && w <= 350) {
        db.body = db.body || [];
        const ex = db.body.find(b => sameDay(b.date, new Date()));
        if (ex) { ex.kg = w; ex.u = now(); } else db.body.push({ id: uid(), u: now(), date: new Date().toISOString(), kg: w });
      }
    }
    d.done = true; d.u = now();
    db.profile = d;
    if (GOALS[d.goal]) db.settings.rest = GOALS[d.goal].rest;
    if (d.days) db.settings.weeklyGoal = d.days;
    db.settingsU = now();
    saveDb(); ui.ob = null; ui.view = null; ui.tab = 'today'; render(); toTop();
    toast(d.name ? `C'est prêt, ${d.name} 💪` : "C'est prêt 💪");
  },
  clearProfile() {
    if (!confirm('Effacer tes infos perso (profil, âge, taille et historique de poids) ? Tes séances et ton historique d\'entraînement sont conservés.')) return;
    const t = now();
    (db.body || []).forEach(b => { db.deleted[b.id] = t; });
    db.body = [];
    db.profile = { skipped: true, u: t };
    saveDb(); render(); toast('Infos perso effacées');
  },
  /* ----- Ma salle ----- */
  openGym() { ui.view = 'gym'; render(); toTop(); },
  closeGym() { ui.view = null; ui.tab = 'profile'; render(); },
  gymToggle(d) {
    const set = gymMachines();
    if (set.has(d.n)) set.delete(d.n); else set.add(d.n);
    db.profile.machines = [...set]; db.profile.u = now(); saveDb(); render();
  },
  gymAll() { db.profile.machines = allSalleItems(); db.profile.u = now(); saveDb(); render(); },
  gymReset() { delete db.profile.machines; db.profile.u = now(); saveDb(); render(); toast('Liste type rétablie'); },
  gymEdit() { startOnboarding('gym'); },
  addBody() {
    const v = num($('#bwInput').value);
    if (v == null || v < 25 || v > 350) { toast('Indique un poids valide en kg'); return; }
    const today = new Date();
    db.body = db.body || [];
    const ex = db.body.find(b => sameDay(b.date, today));
    if (ex) { ex.kg = v; ex.u = now(); } else db.body.push({ id: uid(), u: now(), date: today.toISOString(), kg: v });
    saveDb(); render(); toast('Poids noté ✅');
  },
  setGoalMode(d) {
    if (d.v === 'manual' && db.settings.goalAuto !== false) db.settings.weeklyGoal = weeklyGoal();
    db.settings.goalAuto = d.v === 'auto'; db.settingsU = now(); saveDb(); render();
  },
  setPref(d) { if (!['textSize', 'motion'].includes(d.k)) return; db.settings[d.k] = d.v; db.settingsU = now(); saveDb(); render(); },
  setPalette(d) { db.settings.palette = d.v; db.settingsU = now(); saveDb(); render(); },
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
  deleteProgress() {
    const n = db.sessions.length;
    if (!n && !db.active) { toast("Tu n'as pas encore de progrès enregistrés"); return; }
    if (!confirm(`Êtes-vous sûr de vouloir supprimer vos progrès ?\n\n${n} séance(s) de l'historique, tes records et tes graphiques seront effacés définitivement. Ta semaine programmée est conservée.`)) return;
    const t = now();
    db.sessions.forEach(s => { db.deleted[s.id] = t; });
    db.sessions = [];
    if (db.active) clearActive();
    ui.calSel = null; ui.statKey = null;
    saveDb(); render(); toast('Progrès supprimés');
  },
  wipe() {
    if (!confirm(auth ? 'Tout effacer, sur cet appareil ET sur ton compte ?' : 'Tout effacer (séances, historique, réglages) ?')) return;
    if (!confirm('Vraiment ? Action définitive. Pense à exporter avant.')) return;
    const t = now(), deleted = { ...db.deleted };
    [...db.programs, ...db.sessions, ...(db.body || [])].forEach(x => { deleted[x.id] = t; });
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
  if (d.ob && ui.ob) { if (t.type !== 'checkbox') ui.ob.data[d.ob] = t.value; return; }
  if (d.draft && ui.draft) { ui.draft[d.draft] = t.value; return; }
  if (d.sheet && ui.sheet) { ui.sheet.ex[d.sheet] = t.value; }
});

document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.tagName === 'SELECT' && t.dataset.stat) { ui.statKey = t.value; render(); }
  if (t.type === 'checkbox' && t.dataset.ob && ui.ob) { ui.ob.data[t.dataset.ob] = t.checked; render(); }
  // Après saisie d'une valeur de séance, rafraîchir l'affichage (ligne résumé)
  if (t.dataset.scope === 'act' && !t.dataset.text) render();
  // Nom de séance tapé à la main : vérifier s'il existe déjà un autre jour
  if (t.dataset.draft === 'name' && ui.draft) render();
});

document.addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && ev.target.id === 'authPw') actions.signIn();
  if (ev.key === 'Enter' && ev.target.id === 'bwInput') actions.addBody();
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
  ui.timer = { end: now() + sec * 1000, total: sec };
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
  const arc = $('#timerArc');
  if (arc) arc.style.strokeDashoffset = (94.25 * (1 - Math.min(1, left / Math.max(ui.timer.total, left)))).toFixed(2);
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

/* ---------- Confettis ---------- */
function confetti() {
  if (db.settings.motion === 'reduced' || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  const wrap = document.createElement('div');
  wrap.className = 'confetti';
  const cs = getComputedStyle(document.documentElement);
  const colors = ['--g1', '--g2', '--g3'].map(v => cs.getPropertyValue(v).trim()).concat(['#facc15', '#34d399']);
  for (let k = 0; k < 70; k++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + '%';
    p.style.background = colors[k % colors.length];
    p.style.setProperty('--dx', (Math.random() * 160 - 80).toFixed(0) + 'px');
    p.style.setProperty('--r', (Math.random() * 900 - 450).toFixed(0) + 'deg');
    p.style.animationDuration = (1.6 + Math.random() * 1.4).toFixed(2) + 's';
    p.style.animationDelay = (Math.random() * .35).toFixed(2) + 's';
    wrap.appendChild(p);
  }
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 3600);
}

/* ---------- Toast ---------- */
let toastT = null;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2500);
}

/* ---------- Démarrage ---------- */
buildTabbar();
render();
authFromLink();
if (db.active) keepAwake(true);
scheduleSync(300);
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { /* */ }
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
  // Nouvelle version installée : recharger une fois pour l'afficher tout de suite (sauf en pleine saisie)
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded || isTyping()) return;
    reloaded = true; location.reload();
  });
}
