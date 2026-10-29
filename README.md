# Drama Soundboard

Web statis (HTML/CSS/JS biasa) untuk memutar efek suara dan musik drama. Tanpa backend, tanpa build.

## Menambah scene dan audio
1. Taruh file MP3 di `assets/audio/<scene>/` (nama file huruf kecil, tanpa spasi).
2. Edit `data/scenes.json`. Tiap audio: `id` (unik), `title` (nama di layar), `file` (path relatif, tanpa `/` di awal), `type` (`music` | `sfx` | `ambience`), `loop` (true/false), `volume` (0-1).
3. Commit dan push. Muat ulang halaman.

Data yang tidak lengkap atau ID dobel dilewati dan dicatat di kotak peringatan di atas halaman.

## Publikasi di GitHub Pages
1. Push seluruh isi folder ini ke repository GitHub.
2. Settings > Pages > Source: branch `main`, folder `/ (root)`.
3. Buka `https://<username>.github.io/<nama-repo>/`. Semua path relatif, jadi aman di sub-folder repo.

Jika repo lama sudah berisi website, taruh proyek ini di sub-folder (mis. `soundboard/`) supaya file lama tidak tertimpa.

## Pemakaian
- Ketuk kartu audio untuk memutar. Mode eksklusif (default) menghentikan audio sebelumnya.
- Matikan "Mode eksklusif" bila perlu musik dan efek berjalan bersamaan.
- Panel "Sedang aktif": Jeda/Lanjut, Stop, volume per audio, progres. Stop All menghentikan semuanya.
- Pencarian mencocokkan nama audio dan nama scene.

## Keterbatasan
- Saat sebuah scene dibuka, semua audio di scene itu diunduh di latar belakang (kartu menampilkan "Siap ✓"). Buka semua tab scene sekali sebelum pentas dan jangan tutup halamannya. Mode hemat data di HP bisa menunda pemuatan ini.
- Belum ada pemutaran offline (sengaja tanpa service worker).
- Di iOS, volume lewat kode sering diabaikan; gunakan tombol volume perangkat.
- Perhatikan ukuran repo: batas lunak GitHub Pages sekitar 1 GB situs dan 100 MB per file.
- Hanya gunakan audio yang boleh dipublikasikan.
