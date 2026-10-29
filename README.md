# Drama Soundboard

Web statis (HTML/CSS/JS biasa) untuk memutar efek suara dan musik drama. Tanpa backend, tanpa build.

## Menambah scene dan audio (cara cepat: skrip)
1. Buat folder scene di `assets/audio/`, mis. `01-pembukaan`, lalu taruh MP3 di dalamnya.
2. Atur lewat nama file:
   - Awalan jenis: `music_`, `sfx_`, `amb_` (tanpa awalan = efek).
   - Akhiran `_loop` = berulang, `_v70` = volume awal 70%.
   - Contoh: `amb_suara-malam_loop_v80.mp3` jadi "Suara Malam", suasana, berulang, volume 0.8.
   - Angka di depan (`01_`) hanya mengatur urutan.
   - Nama folder `01-pembukaan` jadi "Scene 1 - Pembukaan". Deskripsi scene (opsional): isi `deskripsi.txt` di folder itu.
3. Di folder proyek jalankan `python tools/generate.py` (di Termux: `pkg install python`). Skrip membuat `data/scenes.json` dan menampilkan peringatan (file besar, nama berspasi, format tidak dikenal). Versi lama disimpan di `data/scenes.json.bak`.
4. `git add . && git commit -m "Tambah audio" && git push`, tunggu 1-2 menit.
5. Di tiap HP operator, tekan **Simpan ke HP** lagi.

Cara manual (tanpa skrip): taruh file lalu edit `data/scenes.json`. Tiap audio: `id` (unik, jangan diubah agar favorit tetap), `title`, `file` (path relatif), `type` (`music` | `sfx` | `ambience`), `loop`, `volume` (0-1).

## Pemakaian
- Ketuk kartu untuk memutar. Warna kartu menunjukkan jenis: biru musik, merah efek, hijau suasana.
- Status audio ditulis di kartu: Siap ✓, Memutar, Jeda, Gagal.
- Mode Eksklusif (default) menghentikan audio sebelumnya. Mode Tumpuk membolehkan beberapa audio bersamaan.
- Volume di atas adalah volume master. Volume awal tiap audio diatur lewat `volume` di JSON.
- ☆ pada kartu menandai favorit (tersimpan per HP). Filter: Semua, Musik, Efek, Suasana, Favorit.
- **Simpan ke HP** mengunduh semua audio ke penyimpanan browser: bunyi tanpa delay dan tanpa internet. Lakukan sekali per HP sebelum pentas.

## Publikasi
Push ke GitHub, lalu Settings > Pages > Deploy from a branch > `main` > `/ (root)`.

## Keterbatasan
- Simpanan di HP bisa terhapus bila data browser dibersihkan. Tekan Simpan ke HP lagi.
- Favorit tidak ikut ke HP lain.
- Di iOS volume lewat kode sering diabaikan.
- Batas lunak GitHub Pages: sekitar 1 GB situs, 100 MB per file. Hanya pakai audio yang boleh dipublikasikan.
