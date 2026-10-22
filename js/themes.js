/*
 * grademapper: themes, fonts and colours.
 *
 * A theme gives three base colours (background, text, accent). Everything else
 * (cards, lines, muted text, tone colours) is worked out from those three, and
 * checked for contrast, so any colours the person picks stay readable.
 */
(function () {
  'use strict';
  const LG = window.LG;
  const u = LG.u;

  // ----------------------------------------------------------------- fonts
  // role 'both' = fine for all text. role 'display' = decorative, used for headings and big numbers only.
  const FONTS = [
    { id: 'noto-serif', name: 'Noto Serif', css: "'Noto Serif', Georgia, 'Times New Roman', serif", g: 'Noto+Serif:wght@400;500;600;700', role: 'both' },
    { id: 'cormorant', name: 'Cormorant Garamond', css: "'Cormorant Garamond', Georgia, serif", g: 'Cormorant+Garamond:wght@400;500;600;700', role: 'both' },
    { id: 'garamond', name: 'EB Garamond', css: "'EB Garamond', Georgia, serif", g: 'EB+Garamond:wght@400;500;600;700', role: 'both' },
    { id: 'uncial', name: 'Uncial Antiqua', css: "'Uncial Antiqua', 'EB Garamond', Georgia, serif", g: 'Uncial+Antiqua', role: 'display' },
    { id: 'syne-mono', name: 'Syne Mono', css: "'Syne Mono', ui-monospace, 'Courier New', monospace", g: 'Syne+Mono', role: 'both' },
    { id: 'lora', name: 'Lora', css: "Lora, Georgia, serif", g: 'Lora:wght@400;500;600;700', role: 'both' },
    { id: 'bitcount', name: 'Bitcount Ink', css: "'Bitcount Ink', ui-monospace, 'Courier New', monospace", g: 'Bitcount+Ink:wght@400;700', role: 'display' },
    { id: 'pacifico', name: 'Pacifico', css: "Pacifico, 'Brush Script MT', cursive", g: 'Pacifico', role: 'display' },
    { id: 'righteous', name: 'Righteous', css: "Righteous, 'Trebuchet MS', sans-serif", g: 'Righteous', role: 'display' },
    { id: 'caveat', name: 'Caveat', css: "Caveat, 'Comic Sans MS', cursive", g: 'Caveat:wght@400;600;700', role: 'display' },
    { id: 'quicksand', name: 'Quicksand', css: "Quicksand, system-ui, sans-serif", g: 'Quicksand:wght@400;500;600;700', role: 'both' },
    { id: 'fredoka', name: 'Fredoka', css: "Fredoka, system-ui, sans-serif", g: 'Fredoka:wght@400;500;600', role: 'both' },
    { id: 'work-sans', name: 'Work Sans', css: "'Work Sans', system-ui, sans-serif", g: 'Work+Sans:wght@400;500;600;700', role: 'both' },
    { id: 'lexend', name: 'Lexend', css: "Lexend, system-ui, sans-serif", g: 'Lexend:wght@400;500;600;700', role: 'both' },
    { id: 'atkinson', name: 'Atkinson Hyperlegible', css: "'Atkinson Hyperlegible', system-ui, sans-serif", g: 'Atkinson+Hyperlegible:wght@400;700', role: 'both' },
    { id: 'system', name: 'Your device font', css: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", g: '', role: 'both' },
  ];
  const fontById = (id) => FONTS.filter((f) => f.id === id)[0];

  const loadedFonts = new Set();
  function loadFont(id) {
    const f = fontById(id);
    if (!f || !f.g || loadedFonts.has(id)) return;
    loadedFonts.add(id);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + f.g + '&display=swap';
    document.head.appendChild(link);
  }
  function loadAllFonts() { FONTS.forEach((f) => loadFont(f.id)); }

  // ---------------------------------------------------------------- themes
  const THEMES = [
    {
      id: 'standard', name: 'Standard', blurb: 'Black ink on off-white paper.',
      display: 'noto-serif', body: 'noto-serif',
      light: { bg: '#F7F4EA', text: '#111111', accent: '#111111' },
      dark: { bg: '#0F0F0F', text: '#F5F1E4', accent: '#F5F1E4' },
    },
    {
      id: 'academic', name: 'Academic', blurb: 'Library browns with a touch of gold.',
      display: 'cormorant', body: 'cormorant',
      light: null,
      dark: { bg: '#4A2125', text: '#FBE4EA', accent: '#B8860B' },
    },
    {
      id: 'neon', name: 'Neon', blurb: 'Arcade blue with a warm glow.',
      display: 'bitcount', body: 'work-sans',
      light: null,
      dark: { bg: '#1B4079', text: '#FFF8B8', accent: '#FFC48A' },
    },
    {
      id: 'pink', name: 'Pink Flowey', blurb: 'Soft pinks and little printed flowers.',
      display: 'pacifico', body: 'quicksand',
      light: { bg: '#FFE6F0', text: '#4B1631', accent: '#D6336C' },
      dark: { bg: '#2B1021', text: '#FFE4EF', accent: '#FF7FB0' },
    },
    {
      id: 'retro', name: 'Retro', blurb: 'Seventies cream, orange and brown.',
      display: 'righteous', body: 'work-sans',
      light: { bg: '#F3E1BC', text: '#3A2616', accent: '#C2410C' },
      dark: { bg: '#2A1C12', text: '#F3E1BC', accent: '#E8793A' },
    },
    {
      id: 'paper', name: 'Paper', blurb: 'Periwinkle parchment, dark clay ink, a medieval hand.',
      display: 'uncial', body: 'garamond',
      light: { bg: '#CBC9F1', text: '#3A2218', accent: '#5B479C' },
      dark: { bg: '#3A241C', text: '#E3E0FA', accent: '#B0A4EC' },
    },
    {
      id: 'avocado', name: 'Avocado Smoothie', blurb: 'Olive greens, a pastel plum accent, a little garden.',
      display: 'syne-mono', body: 'syne-mono',
      light: null,
      dark: { bg: '#3A4720', text: '#F6F0C4', accent: '#D8A6CF' },
      // Light pastel olive is the second main colour: used for highlights, chosen items and the hero card.
      extra: { accentSoft: '#CBD8A5', accentSoftInk: '#2B3714', surface: '#46552A', surface2: '#526234' },
    },
    {
      id: 'dyslexic', name: 'Dyslexia friendly', blurb: 'Cream paper, clear letters, roomy spacing.',
      display: 'atkinson', body: 'atkinson', dys: true,
      light: { bg: '#FFF8E5', text: '#1D2A3A', accent: '#0B5C86' },
      dark: { bg: '#1A2230', text: '#F1EADB', accent: '#5BB3E0' },
    },
  ];
  const themeById = (id) => THEMES.filter((t) => t.id === id)[0] || THEMES[0];

  const BASE_SCALE = 1.232;

  const RADII = {
    square: { card: '0.2rem', ctl: '0.15rem', btn: '0.2rem' },
    soft: { card: '0.7rem', ctl: '0.45rem', btn: '0.5rem' },
    round: { card: '1.1rem', ctl: '0.7rem', btn: '0.8rem' },
    bubble: { card: '1.7rem', ctl: '1rem', btn: '999px' },
  };

  const DEFAULT_APPEARANCE = {
    theme: 'standard',
    mode: 'auto',            // auto | light | dark (only for themes that have both)
    custom: { on: false, bg: '#F7F4EA', text: '#111111', accent: '#111111' },
    font: 'theme',           // 'theme' or a font id
    radius: 'round',
    cards: 'outline',        // outline | flat | lifted
    density: 'cozy',         // cozy | compact
    anim: 'playful',         // playful | calm | off
    contrast: false,
    dys: false,
    scale: 1,
  };

  // --------------------------------------------------------------- palette
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function resolveBase(app) {
    const theme = themeById(app.theme);
    if (app.custom && app.custom.on) {
      const c = app.custom;
      const dark = u.lum(c.bg) < 0.35;
      return { theme, base: { bg: c.bg, text: c.text, accent: c.accent }, isDark: dark, custom: true, extra: null };
    }
    let isDark;
    if (!theme.light) isDark = true;
    else if (!theme.dark) isDark = false;
    else if (app.mode === 'dark') isDark = true;
    else if (app.mode === 'light') isDark = false;
    else isDark = !!(mq && mq.matches);
    return { theme, base: isDark ? theme.dark : theme.light, isDark, custom: false, extra: theme.extra || null };
  }

  /** Turn three base colours into the full set of tokens, checking contrast as it goes. */
  function derive(base, isDark, hc, extra) {
    const bg = hc ? (isDark ? '#000000' : '#ffffff') : base.bg;
    let text = hc ? (isDark ? '#ffffff' : '#000000') : base.text;
    text = u.ensureContrast(text, bg, hc ? 7 : 4.5);
    const ex = extra && !hc ? extra : null;   // a theme can pin a few surfaces (Avocado Smoothie's pastel olive)
    const surface = hc ? bg : ex && ex.surface ? ex.surface : isDark ? u.mix(bg, '#ffffff', 0.07) : u.mix(bg, '#ffffff', 0.55);
    const surface2 = hc ? u.mix(bg, text, 0.1) : ex && ex.surface2 ? ex.surface2 : isDark ? u.mix(bg, '#ffffff', 0.13) : u.mix(bg, text, 0.07);
    const line = u.mix(bg, text, hc ? 0.85 : isDark ? 0.3 : 0.22);
    let muted = u.mix(text, bg, 0.36);
    muted = u.ensureContrast(u.ensureContrast(muted, bg, hc ? 7 : 4.5), surface2, hc ? 7 : 4.5);

    const accent = u.ensureContrast(base.accent, bg, hc ? 7 : 3);
    const accentText = u.ensureContrast(base.accent, surface, hc ? 7 : 4.5);
    const accentInk = u.inkOn(accent, bg);
    const accentSoft = ex && ex.accentSoft ? ex.accentSoft : u.mix(surface, accent, isDark ? 0.26 : 0.16);
    const accentSoftInk = ex && ex.accentSoftInk ? u.ensureContrast(ex.accentSoftInk, accentSoft, 4.5) : u.ensureContrast(text, accentSoft, 4.5);

    const tones = {};
    const toneBases = { great: '#1f9d55', steady: accent, stretch: '#e08a00', reach: '#7d5bd6' };
    Object.keys(toneBases).forEach((k) => {
      const tb = u.mix(surface, toneBases[k], isDark ? 0.24 : 0.15);
      tones[k] = { fg: u.ensureContrast(toneBases[k], tb, 4.5), bg: tb };
    });
    const emptyBg = surface2;
    tones.empty = { fg: muted, bg: emptyBg };

    return { bg, text, surface, surface2, line, muted, accent, accentText, accentInk, accentSoft, accentSoftInk, tones, isDark };
  }

  /** The finished palette for an appearance setting. */
  function palette(app) {
    const r = resolveBase(app);
    const p = derive(r.base, r.isDark, !!app.contrast, r.extra);
    p.themeId = r.theme.id;
    p.custom = r.custom;
    return p;
  }

  /** Plain colours for the little swatches on theme cards. */
  function previewColors(themeId, wantDark) {
    const t = themeById(themeId);
    const base = !t.light ? t.dark : !t.dark ? t.light : wantDark ? t.dark : t.light;
    const dark = !t.light ? true : !t.dark ? false : !!wantDark;
    const p = derive(base, dark, false, t.extra);
    return { bg: p.bg, text: p.text, accent: p.accent, surface: p.surface, soft: p.accentSoft };
  }

  // ----------------------------------------------------------------- apply
  function resolveFonts(app, theme) {
    let displayId = theme.display;
    let bodyId = theme.body;
    if (app.font && app.font !== 'theme') {
      const f = fontById(app.font);
      if (f) {
        displayId = f.id;
        if (f.role === 'both') bodyId = f.id;
      }
    }
    if (app.dys || theme.dys) { displayId = 'atkinson'; bodyId = 'atkinson'; }
    return { displayId, bodyId };
  }

  function apply(appIn) {
    const app = Object.assign({}, DEFAULT_APPEARANCE, appIn || {});
    app.custom = Object.assign({}, DEFAULT_APPEARANCE.custom, (appIn && appIn.custom) || {});
    const root = document.documentElement;
    const r = resolveBase(app);
    const p = derive(r.base, r.isDark, !!app.contrast, r.extra);
    const set = (k, v) => root.style.setProperty(k, v);

    set('--bg', p.bg); set('--text', p.text); set('--surface', p.surface); set('--surface-2', p.surface2);
    set('--line', p.line); set('--muted', p.muted); set('--accent', p.accent); set('--accent-text', p.accentText);
    set('--accent-ink', p.accentInk); set('--accent-soft', p.accentSoft); set('--accent-soft-ink', p.accentSoftInk);
    Object.keys(p.tones).forEach((k) => { set('--t-' + k, p.tones[k].fg); set('--t-' + k + '-bg', p.tones[k].bg); });
    root.style.colorScheme = p.isDark ? 'dark' : 'light';

    const fonts = resolveFonts(app, r.theme);
    const fd = fontById(fonts.displayId) || FONTS[0];
    const fb = fontById(fonts.bodyId) || FONTS[0];
    loadFont(fd.id); loadFont(fb.id);
    set('--f-display', fd.css);
    set('--f-body', fb.css);
    // Every theme and font uses the Academic theme's size (1.232 = its old 1.1 x 1.12), so words and cards match everywhere.
    const userScale = Math.max(0.85, Math.min(1.3, Number(app.scale) || 1));
    set('--fs', String(+(BASE_SCALE * userScale).toFixed(4)));

    const rad = RADII[app.radius] || RADII.round;
    set('--r', rad.card); set('--r-sm', rad.ctl); set('--r-btn', rad.btn);
    set('--bw', app.contrast ? '2px' : '1px');

    const reduced = u.prefersReducedMotion();
    root.dataset.themeId = r.theme.id;
    root.dataset.anim = reduced ? 'off' : app.anim;
    root.dataset.cards = app.cards;
    root.dataset.density = app.density;
    root.dataset.dys = app.dys || r.theme.dys ? 'on' : 'off';
    root.dataset.dark = p.isDark ? 'yes' : 'no';
    root.dataset.custom = r.custom ? 'yes' : 'no';

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', p.bg);
    return p;
  }

  // Follow the phone's light/dark setting live when the person chose "auto".
  if (mq && mq.addEventListener) {
    mq.addEventListener('change', () => {
      if (LG.store && LG.store.appearance && LG.store.appearance.mode === 'auto') apply(LG.store.appearance);
    });
  }

  LG.theme = { THEMES, FONTS, RADII, BASE_SCALE, DEFAULT_APPEARANCE, themeById, fontById, loadFont, loadAllFonts, palette, previewColors, apply };
})();
