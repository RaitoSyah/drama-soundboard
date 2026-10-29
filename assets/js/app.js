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
  const state = { scenes: [], sceneId: null, query: '', filter: 'all', exclusive: true, master: 1 };
  const players = new Map(); // id track -> { id, track, scene, audio, status, error, userVol }

  // Favorit: hanya kemudahan per HP (disimpan di browser), bukan sumber daftar audio
  const favs = new Set();
  try { JSON.parse(localStorage.getItem('ds-favs') || '[]').forEach((x) => favs.add(x)); } catch (_) {}
  const saveFavs = () => { try { localStorage.setItem('ds-favs', JSON.stringify([...favs])); } catch (_) {} };

  // Audio yang disimpan di HP (IndexedDB) supaya bunyi tanpa delay dan tanpa internet
  const localUrls = new Map(); // path file -> blob URL
  let dbp;
  const idb = () => (dbp ||= new Promise((res, rej) => { const r = indexedDB.open('DramaSoundboardCache', 1); r.onupgradeneeded = () => r.result.createObjectStore('audio'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const wait = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const store = async (mode) => (await idb()).transaction('audio', mode).objectStore('audio');
  function setLocal(file, blob) {
    const url = URL.createObjectURL(blob); localUrls.set(file, url);
    players.forEach((p) => { if (p.track.file === file && p.status === 'stopped') { p.audio.src = url; p.ready = true; p.preloading = false; } });
  }
  async function loadLocal() {
    try {
      const keys = await wait((await store('readonly')).getAllKeys());
      for (const k of keys) setLocal(k, await wait((await store('readonly')).get(k)));
    } catch (_) { /* penyimpanan lokal tidak tersedia: pakai jaringan */ }
  }
  function updateDl() {
    const all = state.scenes.flatMap((s) => s.tracks);
    $('dl').textContent = `⬇ Simpan ke HP (${all.filter((t) => localUrls.has(t.file)).length}/${all.length})`;
  }
  async function downloadAll() {
    const btn = $('dl'), all = state.scenes.flatMap((s) => s.tracks);
    btn.disabled = true; navigator.storage?.persist?.();
    let ok = 0, bad = 0;
    for (const t of all) {
      btn.textContent = `Mengunduh ${ok + bad + 1}/${all.length}…`;
      try {
        const r = await fetch(t.file, { cache: 'reload' });
        if (!r.ok) throw new Error(r.status);
        const blob = await r.blob();
        await wait((await store('readwrite')).put(blob, t.file));
        setLocal(t.file, blob); ok++;
      } catch (_) { bad++; }
    }
    btn.disabled = false; updateDl(); updateCards();
    toast(bad ? `${ok} audio tersimpan, ${bad} gagal (file hilang atau penyimpanan penuh).` : `${ok} audio tersimpan di HP.`, !bad);
  }

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
    audio.src = localUrls.get(track.file) || track.file;
    p = { id: track.id, track, scene, audio, status: 'stopped', error: '', userVol: track.volume, ready: localUrls.has(track.file), preloading: false, preloaded: false, touched: false };
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
  function toast(msg, good) {
    const t = $('toast'); t.textContent = msg; t.className = good ? 'toast good' : 'toast'; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 5000);
  }

  const FILTERS = [['all', 'Semua'], ['music', '♪ Musik'], ['sfx', '⚡ Efek'], ['ambience', '≈ Suasana'], ['fav', '⭐ Favorit']];
  function renderFilters() {
    const box = $('filters'); box.replaceChildren();
    FILTERS.forEach(([k, label]) => box.append(h('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(state.filter === k),
      onclick: () => { state.filter = k; state.query = ''; $('search').value = ''; renderFilters(); renderTabs(); renderPanel(); }
    }, label)));
  }

  function trackCard(track, scene, showScene) {
    const ty = TYPES[track.type];
    const star = () => (favs.has(track.id) ? '⭐' : '☆');
    const fav = h('button', {
      class: 'fav', type: 'button', 'aria-label': `Favorit: ${track.title}`, 'aria-pressed': String(favs.has(track.id)),
      onclick: () => {
        if (favs.has(track.id)) favs.delete(track.id); else favs.add(track.id);
        saveFavs();
        if (state.filter === 'fav') renderPanel();
        else { fav.textContent = star(); fav.setAttribute('aria-pressed', String(favs.has(track.id))); }
      }
    }, star());
    return h('div', { class: 'card' },
      h('button', { class: `track type-${track.type}`, type: 'button', dataset: { id: track.id }, onclick: () => play(track, scene) },
        h('span', { class: 't' }, `${ty.icon} ${track.title}`),
        h('span', { class: 'm' }, [ty.label, track.loop ? ' · ↻ Berulang' : ' · Sekali', showScene ? ` · ${scene.title}` : ''].join('')),
        h('span', { class: 'st' }, STATUS.stopped)),
      fav);
  }

  function renderTabs() {
    const tabs = $('tabs'); tabs.replaceChildren();
    state.scenes.forEach((s) => tabs.append(h('button', {
      class: 'tab', type: 'button', 'aria-pressed': String(s.id === state.sceneId && !state.query && state.filter !== 'fav'),
      onclick: () => {
        state.sceneId = s.id; state.query = ''; if (state.filter === 'fav') state.filter = 'all';
        $('search').value = ''; renderFilters(); renderTabs(); renderPanel();
        tabs.querySelector('[aria-pressed=true]')?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
      }
    }, s.title)));
  }

  function renderPanel() {
    const panel = $('panel'); panel.replaceChildren();
    const q = state.query.trim().toLowerCase();
    const all = state.scenes.flatMap((s) => s.tracks.map((t) => [t, s]));
    const showList = (title, hits, empty) => {
      panel.append(h('div', { class: 'scene-head' }, h('h2', {}, title)));
      panel.append(hits.length ? h('div', { class: 'grid' }, hits.map(([t, s]) => trackCard(t, s, true))) : h('p', { class: 'empty' }, empty));
    };
    if (q) {
      const hits = all.filter(([t, s]) => t.title.toLowerCase().includes(q) || s.title.toLowerCase().includes(q));
      showList(`Hasil pencarian: ${hits.length} audio`, hits, 'Tidak ada audio atau scene yang cocok. Coba kata lain.');
    } else if (state.filter === 'fav') {
      const hits = all.filter(([t]) => favs.has(t.id));
      showList(`Favorit: ${hits.length} audio`, hits, 'Belum ada favorit. Ketuk ☆ pada kartu audio.');
    } else {
      const s = state.scenes.find((x) => x.id === state.sceneId);
      if (!s) return;
      const list = s.tracks.filter((t) => state.filter === 'all' || t.type === state.filter);
      panel.append(h('div', { class: 'scene-head' }, h('h2', {}, s.title), s.description ? h('p', {}, s.description) : null));
      panel.append(list.length ? h('div', { class: 'grid' }, list.map((t) => trackCard(t, s, false)))
        : h('p', { class: 'empty' }, s.tracks.length ? 'Tidak ada audio jenis ini di scene ini.' : 'Scene ini belum punya audio.'));
      preloadScene(s);
    }
    refresh();
  }

  // Muat audio scene yang sedang dibuka di latar belakang (scene lain tidak diunduh)
  function preloadScene(scene) {
    scene.tracks.forEach((t) => {
      const p = getPlayer(t, scene);
      if (p.ready || p.preloaded || p.status !== 'stopped') return;
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
          h('button', { type: 'button', onclick: () => stop(p) }, '■ Stop'))));
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
    $('mode').addEventListener('click', (e) => { state.exclusive = !state.exclusive; e.currentTarget.textContent = 'Mode: ' + (state.exclusive ? 'Eksklusif' : 'Tumpuk'); });
    $('dl').addEventListener('click', downloadAll);
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
      await loadLocal();
      const total = scenes.reduce((n, s) => n + s.tracks.length, 0);
      setAppStatus(`Siap · ${scenes.length} scene · ${total} audio`, 'ok');
      if (warnings.length) {
        const n = $('notice'); n.hidden = false;
        n.append(h('strong', {}, 'Ada data yang tidak lengkap:'), h('ul', {}, warnings.map((w) => h('li', {}, w))));
      }
      renderFilters(); renderTabs(); renderPanel(); updateDl();
    } catch (e) {
      setAppStatus('Gagal memuat data', 'err');
      const n = $('notice'); n.hidden = false;
      n.textContent = `Daftar scene tidak bisa dibaca (${e.message}). Buka lewat HTTPS/GitHub Pages atau server lokal, bukan langsung dari file.`;
    }
  }
  init();
})();
