/*
 * Little Grades: storage.
 *
 * Everything lives in this browser (localStorage). Nothing is sent anywhere.
 * Two keys:
 *   - appearance (theme, colours, fonts): always plain, so the lock screen can look right.
 *   - data (profile, courses, notes...): plain, or encrypted with a passphrase (AES-256-GCM,
 *     key made with PBKDF2). The passphrase is never stored. Forget it and the data is gone.
 */
(function () {
  'use strict';
  const LG = window.LG;
  const u = LG.u;

  const KEY_DATA = 'little-grades-data-v2';
  const KEY_LOOK = 'little-grades-look-v2';
  const PBKDF2_ROUNDS = 250000;

  const canEncrypt = !!(window.crypto && window.crypto.subtle && window.isSecureContext !== false);
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  // ------------------------------------------------------------- crypto
  function toB64(buf) {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function fromB64(str) {
    const s = atob(str);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  async function deriveKey(pass, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: PBKDF2_ROUNDS, hash: 'SHA-256' },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }
  async function encryptJSON(key, salt, obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
    return { enc: true, salt: toB64(salt), iv: toB64(iv), ct: toB64(ct) };
  }
  async function decryptJSON(key, wrap) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(wrap.iv) }, key, fromB64(wrap.ct));
    return JSON.parse(dec.decode(pt));
  }

  // ------------------------------------------------------------ defaults
  function defaultState() {
    return {
      v: 2,
      profile: { name: '', grade: '', region: 'us', goal: '', colleges: [], onboarded: false },
      prefs: {
        weighted: false,
        bonus: { regular: 0, honors: 0.5, ap: 1, ib: 1 },
        customScale: {
          label: 'My scale',
          pointsLabel: 'Points',
          bonus: false,
          bands: [
            { min: 90, letter: 'A', points: 4 },
            { min: 80, letter: 'B', points: 3 },
            { min: 70, letter: 'C', points: 2 },
            { min: 60, letter: 'D', points: 1 },
            { min: 0, letter: 'F', points: 0 },
          ],
        },
        remindersOn: false,
        termId: '',
      },
      terms: [{ id: u.uid('t'), name: 'Term 1' }],
      courses: [],
      activities: [],
      notes: [],
      reminded: {},
    };
  }

  /** Fill in anything missing so older saves keep working after an update. */
  function migrate(data) {
    const d = defaultState();
    if (!data || typeof data !== 'object') return d;
    const out = Object.assign({}, d, data);
    out.profile = Object.assign({}, d.profile, data.profile);
    out.prefs = Object.assign({}, d.prefs, data.prefs);
    out.prefs.bonus = Object.assign({}, d.prefs.bonus, (data.prefs || {}).bonus);
    out.prefs.customScale = Object.assign({}, d.prefs.customScale, (data.prefs || {}).customScale);
    ['colleges'].forEach((k) => { if (!Array.isArray(out.profile[k])) out.profile[k] = []; });
    ['terms', 'courses', 'activities', 'notes'].forEach((k) => { if (!Array.isArray(out[k])) out[k] = []; });
    if (out.terms.length === 0) out.terms = d.terms;
    if (!out.reminded || typeof out.reminded !== 'object') out.reminded = {};
    out.v = 2;
    return out;
  }

  // --------------------------------------------------------------- store
  const store = {
    state: defaultState(),
    appearance: Object.assign({}, LG.theme.DEFAULT_APPEARANCE),
    locked: false,
    encrypted: false,
    canEncrypt,
    saveError: false,
    _key: null,
    _salt: null,
    _pending: null,
    _listeners: [],
  };

  store.on = (fn) => { store._listeners.push(fn); };
  store.emit = (what) => { store._listeners.forEach((fn) => { try { fn(what); } catch (e) { console.error(e); } }); };

  // ---- appearance
  store.loadAppearance = () => {
    try {
      const raw = localStorage.getItem(KEY_LOOK);
      if (raw) {
        const a = JSON.parse(raw);
        store.appearance = Object.assign({}, LG.theme.DEFAULT_APPEARANCE, a);
        store.appearance.custom = Object.assign({}, LG.theme.DEFAULT_APPEARANCE.custom, a.custom);
      }
    } catch (e) { /* use defaults */ }
    return store.appearance;
  };
  store.setAppearance = (patch) => {
    store.appearance = Object.assign({}, store.appearance, patch);
    if (patch.custom) store.appearance.custom = Object.assign({}, LG.theme.DEFAULT_APPEARANCE.custom, store.appearance.custom, patch.custom);
    try { localStorage.setItem(KEY_LOOK, JSON.stringify(store.appearance)); } catch (e) { /* ignore */ }
    LG.theme.apply(store.appearance);
    store.emit('appearance');
  };

  // ---- data
  store.load = () => {
    store.saveError = false;
    let raw = null;
    try { raw = localStorage.getItem(KEY_DATA); } catch (e) { /* blocked storage */ }
    if (!raw) {
      store.state = defaultState();
      store.encrypted = false;
      store.locked = false;
      return { locked: false };
    }
    try {
      const wrap = JSON.parse(raw);
      if (wrap.enc) {
        store.encrypted = true;
        store.locked = true;
        store._pending = wrap;
        return { locked: true };
      }
      store.state = migrate(wrap.data);
      store.encrypted = false;
      store.locked = false;
    } catch (e) {
      console.error('Could not read saved data', e);
      store.state = defaultState();
    }
    return { locked: false };
  };

  store.unlock = async (pass) => {
    const wrap = store._pending;
    if (!wrap) return;
    const salt = fromB64(wrap.salt);
    const key = await deriveKey(pass, salt);
    const data = await decryptJSON(key, wrap); // throws if the passphrase is wrong
    store.state = migrate(data);
    store._key = key;
    store._salt = salt;
    store.locked = false;
    store._pending = null;
    store.emit('unlocked');
  };

  async function persist() {
    if (store.locked) return;
    try {
      let wrap;
      if (store.encrypted && store._key) wrap = Object.assign({ v: 2 }, await encryptJSON(store._key, store._salt, store.state));
      else wrap = { v: 2, enc: false, data: store.state };
      localStorage.setItem(KEY_DATA, JSON.stringify(wrap));
      if (store.saveError) { store.saveError = false; store.emit('save-ok'); }
    } catch (e) {
      store.saveError = true;
      store.emit('save-error');
    }
  }
  const saveSoon = u.debounce(persist, 250);
  store.save = () => { saveSoon(); };
  store.saveNow = persist;
  window.addEventListener('pagehide', () => { persist(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist(); });

  store.setPassphrase = async (pass) => {
    if (!canEncrypt) throw new Error('This browser cannot encrypt here.');
    store._salt = crypto.getRandomValues(new Uint8Array(16));
    store._key = await deriveKey(pass, store._salt);
    store.encrypted = true;
    await persist();
  };
  store.removePassphrase = async () => {
    store.encrypted = false;
    store._key = null;
    store._salt = null;
    await persist();
  };

  store.wipe = () => {
    try { localStorage.removeItem(KEY_DATA); localStorage.removeItem(KEY_LOOK); } catch (e) { /* ignore */ }
    store.state = defaultState();
    store.appearance = Object.assign({}, LG.theme.DEFAULT_APPEARANCE);
    store.encrypted = false;
    store.locked = false;
    store._key = null;
    store._salt = null;
    store._pending = null;
    LG.theme.apply(store.appearance);
    store.emit('wiped');
  };

  // ---- backup files
  store.exportBackup = async (pass) => {
    const body = { app: 'little-grades', v: 2, exported: new Date().toISOString() };
    const payload = { state: store.state, appearance: store.appearance };
    if (pass) {
      if (!canEncrypt) throw new Error('This browser cannot encrypt here.');
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const key = await deriveKey(pass, salt);
      return JSON.stringify(Object.assign(body, await encryptJSON(key, salt, payload)), null, 1);
    }
    return JSON.stringify(Object.assign(body, { enc: false, payload }), null, 1);
  };
  /** Returns { needsPassphrase: true } for encrypted files without a passphrase. */
  store.importBackup = async (text, pass) => {
    let file;
    try { file = JSON.parse(text); } catch (e) { throw new Error('That file is not a Little Grades backup.'); }
    if (!file || file.app !== 'little-grades') throw new Error('That file is not a Little Grades backup.');
    let payload = file.payload;
    if (file.enc) {
      if (!pass) return { needsPassphrase: true };
      try {
        payload = await decryptJSON(await deriveKey(pass, fromB64(file.salt)), file);
      } catch (e) { throw new Error('That passphrase did not open the backup.'); }
    }
    if (!payload || !payload.state) throw new Error('That backup looks empty or damaged.');
    store.state = migrate(payload.state);
    if (payload.appearance) {
      store.appearance = Object.assign({}, LG.theme.DEFAULT_APPEARANCE, payload.appearance);
      store.appearance.custom = Object.assign({}, LG.theme.DEFAULT_APPEARANCE.custom, payload.appearance.custom);
      try { localStorage.setItem(KEY_LOOK, JSON.stringify(store.appearance)); } catch (e) { /* ignore */ }
      LG.theme.apply(store.appearance);
    }
    await persist();
    store.emit('imported');
    return { ok: true };
  };

  // ---- small helpers used by several pages
  store.scale = () => LG.E.getScale(store.state.profile.region, store.state.prefs.customScale);
  store.gpaOpts = () => ({ weighted: !!store.state.prefs.weighted, bonus: store.state.prefs.bonus });
  store.currentTerm = () => {
    const s = store.state;
    return s.terms.filter((t) => t.id === s.prefs.termId)[0] || s.terms[s.terms.length - 1];
  };
  store.course = (id) => store.state.courses.filter((c) => c.id === id)[0];

  LG.E = window.GradeEngine;
  LG.store = store;
})();
