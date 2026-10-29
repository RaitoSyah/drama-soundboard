# Drama Soundboard

Web statis (HTML/CSS/JS biasa) untuk memutar efek suara dan musik drama. Tanpa backend, tanpa build.

## Menambah scene dan audio
1. Taruh MP3 di `assets/audio/<scene>/` (nama huruf kecil, tanpa spasi).
2. Edit `data/scenes.json`. Tiap audio: `id` (unik), `title`, `file` (path relatif), `type` (`music` | `sfx` | `ambience`), `loop` (true/false), `volume` (0-1, volume awal audio itu).
3. `git add . && git commit -m "Tambah audio" && git push`, tunggu 1-2 menit.
4. Di tiap HP operator, tekan **Simpan ke HP** lagi supaya audio baru atau yang diganti ikut tersimpan.

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
