(() => {
  'use strict';
  const DATA_URL = 'data/scenes.json'; // relatif: aman untuk https://user.github.io/nama-repo/
  const TYPES = {
    music: { icon: '♪', label: 'Musik' },
    sfx: { icon: '⚡', label: 'Efek' },
    ambience: { icon: '≈', label: 'Suasana' }
  };
  const STATUS = { stopped: 'Berhenti', loading: 'Memuat…', playing: '▶ Memutar', paused: '❚❚ Jeda', error: '⚠ Gagal' };

  const $ = (id) => document.getElementById(id);
  const state = { scenes: [], sceneId: null, query: '', exclusive: true, master: 1 };
  const players = new Map(); // id track -> { id, track, scene, audio, status, error, userVol }

  function h(tag, props = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (v !== false && v != null) el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null) el.append(kid);
    return el;
  }
  const clamp = (n, d) => (typeof n === 'number' && isFinite(n) ? Math.min(1, Math.max(0, n)) : d);
  const fmt = (s) => (isFinite(s) ? Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') : '–:––');

  // ---------- Validasi data ----------
  function validate(data) {
    const warnings = [];
    const scenes = [];
    const ids = new Set();
    if (!data || !Array.isArray(data.scenes)) return { scenes, warnings: ['scenes.json harus berisi array "scenes".'] };
    data.scenes.forEach((s, i) => {
      if (!s || !s.id || !s.title || !Array.isArray(s.tracks)) { warnings.push(`Scene #${i + 1} dilewati: perlu id, title, dan tracks.`); return; }
      const tracks = [];
      s.tracks.forEach((t, j) => {
        if (!t || !t.id || !t.title || !t.file) { warnings.push(`${s.id}, audio #${j + 1} dilewati: perlu id, title, dan file.`); return; }
        if (ids.has(t.id)) { warnings.push(`ID "${t.id}" dobel, audio dilewati.`); return; }
        ids.add(t.id);
        tracks.push({ id: t.id, title: t.title, file: t.file, type: TYPES[t.type] ? t.type : 'sfx', loop: t.loop === true, volume: clamp(t.volume, 1) });
      });
      scenes.push({ id: s.id, title: s.title, description: s.description || '', tracks });
    });
    return { scenes, warnings };
  }

  // ---------- Audio ----------
  function getPlayer(track, scene) {
    let p = players.get(track.id);
    if (p) return p;
    const audio = new Audio();
    audio.preload = 'none'; // tidak mengunduh apa pun sebelum ditekan
    audio.loop = track.loop;
    audio.src = track.file;
    p = { id: track.id, track, scene, audio, status: 'stopped', error: '', userVol: track.volume, ready: false, preloading: false, preloaded: false, touched: false };
    applyVolume(p);
    audio.addEventListener('playing', () => setStatus(p, 'playing'));
    audio.addEventListener('waiting', () => { if (p.status === 'playing') setStatus(p, 'loading'); });
    audio.addEventListener('pause', () => { if (p.status === 'playing' || p.status === 'loading') setStatus(p, 'paused'); });
    audio.addEventListener('ended', () => setStatus(p, 'stopped'));
    audio.addEventListener('timeupdate', () => progress(p));
    audio.addEventListener('loadedmetadata', () => progress(p));
    audio.addEventListener('canplaythrough', () => { p.ready = true; p.preloading = false; updateCards(); });
    audio.addEventListener('error', () => fail(p, new DOMException('', 'NotSupportedError')));
    players.set(track.id, p);
    return p;
  }
  const applyVolume = (p) => { p.audio.volume = clamp(p.userVol * state.master, 1); };
  function setStatus(p, s) { p.status = s; if (s !== 'error') p.error = ''; refresh(); }
  function fail(p, e) {
    p.status = 'error';
    p.error = e.name === 'NotAllowedError'
      ? 'Browser menolak memutar. Tekan tombol sekali lagi.'
      : `File tidak ditemukan atau tidak bisa dibuka (${p.track.file}).`;
    p.preloading = false;
    if (p.touched) toast(`"${p.track.title}": ${p.error}`);
    refresh();
  }
  async function play(track, scene) {
    const p = getPlayer(track, scene);
    if (p.status === 'playing' || p.status === 'loading') return; // cegah klik ganda
    p.touched = true;
    if (state.exclusive) stopAll(p.id);
    if (p.status === 'error') p.audio.load();
    p.status = 'loading'; p.error = '';
    applyVolume(p); refresh();
    try { await p.audio.play(); } catch (e) { if (e.name !== 'AbortError') fail(p, e); }
  }
  function stop(p) {
    p.status = 'stopped'; p.error = '';
    p.audio.pause();
    try { p.audio.currentTime = 0; } catch (_) {}
    refresh();
  }
  function stopAll(exceptId) { players.forEach((p) => { if (p.id !== exceptId && p.status !== 'stopped') stop(p); }); }
  async function resume(p) {
    p.status = 'loading'; refresh();
    try { await p.audio.play(); } catch (e) { if (e.name !== 'AbortError') fail(p, e); }
  }

  // ---------- Tampilan ----------
  let toastTimer;
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 5000);
  }

  function trackCard(track, scene, showScene) {
    const ty = TYPES[track.type];
    return h('button', { class: 'track', type: 'button', dataset: { id: track.id }, onclick: () => play(track, scene) },
      h('span', { class: 't' }, `${ty.icon} ${track.title}`),
      h('span', { class: 'm' }, [ty.label, track.loop ? ' · ↻ Berulang' : ' · Sekali', showScene ? ` · ${scene.title}` : ''].join('')),
      h('span', { class: 'st' }, STATUS.stopped));
  }

  function renderTabs() {
    const tabs = $('tabs'); tabs.replaceChildren();
    state.scenes.forEach((s) => tabs.append(h('button', {
      class: 'tab', type: 'button', 'aria-pressed': String(s.id === state.sceneId && !state.query),
      onclick: (e) => { state.sceneId = s.id; state.query = ''; $('search').value = ''; renderTabs(); renderPanel(); e.currentTarget.scrollIntoView?.({ inline: 'center', block: 'nearest' }); }
    }, s.title)));
  }

  function renderPanel() {
    const panel = $('panel'); panel.replaceChildren();
    const q = state.query.trim().toLowerCase();
    if (q) {
      const hits = [];
      state.scenes.forEach((s) => s.tracks.forEach((t) => {
        if (t.title.toLowerCase().includes(q) || s.title.toLowerCase().includes(q)) hits.push([t, s]);
      }));
      panel.append(h('div', { class: 'scene-head' }, h('h2', {}, `Hasil pencarian: ${hits.length} audio`)));
      if (!hits.length) panel.append(h('p', { class: 'empty' }, 'Tidak ada audio atau scene yang cocok. Coba kata lain.'));
      else panel.append(h('div', { class: 'grid' }, hits.map(([t, s]) => trackCard(t, s, true))));
    } else {
      const s = state.scenes.find((x) => x.id === state.sceneId);
      if (!s) return;
      panel.append(h('div', { class: 'scene-head' }, h('h2', {}, s.title), s.description ? h('p', {}, s.description) : null));
      panel.append(s.tracks.length ? h('div', { class: 'grid' }, s.tracks.map((t) => trackCard(t, s, false))) : h('p', { class: 'empty' }, 'Scene ini belum punya audio.'));
      preloadScene(s);
    }
    refresh();
  }

  // Muat audio scene yang sedang dibuka di latar belakang (scene lain tidak diunduh)
  function preloadScene(scene) {
    scene.tracks.forEach((t) => {
      const p = getPlayer(t, scene);
      if (p.preloaded || p.status !== 'stopped') return;
      p.preloaded = true; p.preloading = true;
      p.audio.preload = 'auto';
      p.audio.load();
    });
    updateCards();
  }

  function progress(p) {
    const row = document.querySelector(`.row[data-id="${CSS.escape(p.id)}"]`);
    if (!row) return;
    const a = p.audio, pct = a.duration ? (a.currentTime / a.duration) * 100 : 0;
    row.querySelector('.bartrack > i').style.width = pct + '%';
    row.querySelector('.time').textContent = `${fmt(a.currentTime)} / ${fmt(a.duration)}${p.track.loop ? ' (berulang)' : ''}`;
  }

  function renderNow() {
    const now = $('now'); now.replaceChildren();
    const active = [...players.values()].filter((p) => p.status !== 'stopped');
    if (!active.length) { now.append(h('p', { class: 'empty' }, 'Tidak ada audio yang aktif. Status: berhenti.')); return; }
    active.forEach((p) => {
      const vol = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: p.userVol, 'aria-label': `Volume ${p.track.title}`,
        oninput: (e) => { p.userVol = Number(e.target.value); applyVolume(p); } });
      now.append(h('div', { class: 'row', dataset: { id: p.id, status: p.status } },
        h('div', { class: 'head' }, h('span', { class: 'name' }, p.track.title), h('span', {}, STATUS[p.status])),
        h('div', { class: 'sub' }, `Scene: ${p.scene.title}`),
        p.error ? h('div', { class: 'sub' }, p.error) : null,
        h('div', { class: 'bartrack' }, h('i')),
        h('div', { class: 'time' }, '–:–– / –:––'),
        h('div', { class: 'acts' },
          p.status === 'paused' || p.status === 'error'
            ? h('button', { type: 'button', onclick: () => (p.status === 'error' ? play(p.track, p.scene) : resume(p)) }, p.status === 'error' ? '↻ Coba lagi' : '▶ Lanjut')
            : h('button', { type: 'button', onclick: () => p.audio.pause() }, '❚❚ Jeda'),
          h('button', { type: 'button', onclick: () => stop(p) }, '■ Stop'),
          vol)));
      progress(p);
    });
  }

  function updateCards() {
    document.querySelectorAll('.track').forEach((b) => {
      const p = players.get(b.dataset.id);
      const s = p ? p.status : 'stopped';
      b.dataset.status = s;
      let label = STATUS[s];
      if (s === 'error') label = `${STATUS.error}: ${p.error}`;
      else if (s === 'stopped' && p) label = p.ready ? 'Siap ✓' : p.preloading ? 'Menyiapkan…' : STATUS.stopped;
      b.querySelector('.st').textContent = label;
    });
  }

  function refresh() {
    updateCards();
    renderNow();
  }

  function setAppStatus(text, s) { const el = $('app-status'); el.textContent = text; el.dataset.s = s; }

  // ---------- Awal ----------
  async function init() {
    $('stop-all').addEventListener('click', () => stopAll());
    $('search').addEventListener('input', (e) => { state.query = e.target.value; renderTabs(); renderPanel(); });
    $('exclusive').addEventListener('change', (e) => { state.exclusive = e.target.checked; });
    $('master').addEventListener('input', (e) => {
      state.master = Number(e.target.value); $('master-out').textContent = Math.round(state.master * 100) + '%';
      players.forEach(applyVolume);
    });
    renderNow();
    try {
      const res = await fetch(DATA_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const { scenes, warnings } = validate(await res.json());
      if (!scenes.length) throw new Error('Tidak ada scene valid di ' + DATA_URL);
      state.scenes = scenes; state.sceneId = scenes[0].id;
      const total = scenes.reduce((n, s) => n + s.tracks.length, 0);
      setAppStatus(`Siap · ${scenes.length} scene · ${total} audio`, 'ok');
      if (warnings.length) {
        const n = $('notice'); n.hidden = false;
        n.append(h('strong', {}, 'Ada data yang tidak lengkap:'), h('ul', {}, warnings.map((w) => h('li', {}, w))));
      }
      renderTabs(); renderPanel();
    } catch (e) {
      setAppStatus('Gagal memuat data', 'err');
      const n = $('notice'); n.hidden = false;
      n.textContent = `Daftar scene tidak bisa dibaca (${e.message}). Buka lewat HTTPS/GitHub Pages atau server lokal, bukan langsung dari file.`;
    }
  }
  init();
})();
