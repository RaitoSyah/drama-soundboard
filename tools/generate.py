#!/usr/bin/env python3
"""Membuat data/scenes.json otomatis dari isi folder assets/audio/.

Jalankan dari folder proyek:  python tools/generate.py

Aturan:
- Tiap folder di assets/audio/ = satu scene. "01-pembukaan" jadi "Scene 1 - Pembukaan".
- Deskripsi scene (opsional): file deskripsi.txt di folder itu, baris pertama.
- Awalan nama file menentukan jenis: music_ (musik), sfx_ (efek), amb_ (suasana).
  Tanpa awalan = efek.
- Akhiran _loop = berulang. Akhiran _v70 = volume awal 70%.
- Contoh: amb_suara-malam_loop_v80.mp3 -> "Suara Malam", suasana, berulang, volume 0.8
- Angka di depan (01_) hanya untuk mengatur urutan, tidak ditampilkan.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / "assets" / "audio"
OUT = ROOT / "data" / "scenes.json"
EXTS = {".mp3", ".m4a", ".aac", ".ogg", ".opus", ".wav"}
TYPES = {"music": "music", "musik": "music", "sfx": "sfx", "efek": "sfx",
         "amb": "ambience", "ambience": "ambience", "suasana": "ambience"}
DEFAULT_VOL = {"music": 0.7, "sfx": 1.0, "ambience": 0.7}
BIG = 5 * 1024 * 1024


def natural(s):
    return [int(x) if x.isdigit() else x.lower() for x in re.split(r"(\d+)", s)]


def pretty(s):
    return " ".join(w.capitalize() for w in re.split(r"[-_ ]+", s) if w)


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def scene_title(folder):
    m = re.fullmatch(r"(?:scene[-_ ]?)?(\d+)(?:[-_ ]+(.*))?", folder, re.I)
    if not m:
        return pretty(folder)
    rest = pretty(m.group(2) or "")
    return f"Scene {int(m.group(1))}" + (f" - {rest}" if rest else "")


def parse(stem):
    tokens = [t for t in stem.split("_") if t]
    if tokens and tokens[0].isdigit():
        tokens.pop(0)
    typ = "sfx"
    if tokens and tokens[0].lower() in TYPES:
        typ = TYPES[tokens.pop(0).lower()]
    loop, vol = False, None
    while tokens:
        t = tokens[-1].lower()
        if t == "loop":
            loop = True
        elif re.fullmatch(r"v\d{1,3}", t):
            vol = min(int(t[1:]), 100) / 100
        else:
            break
        tokens.pop()
    return typ, loop, vol, pretty("_".join(tokens)) or pretty(stem)


def main():
    if not AUDIO.is_dir():
        sys.exit(f"Folder tidak ditemukan: {AUDIO}")
    scenes, warns, ids, total = [], [], set(), 0
    folders = sorted((p for p in AUDIO.iterdir() if p.is_dir()), key=lambda p: natural(p.name))
    for d in folders:
        tracks = []
        for f in sorted(d.iterdir(), key=lambda p: natural(p.name)):
            if f.is_dir() or f.name.startswith(".") or f.name == "deskripsi.txt":
                continue
            if f.suffix.lower() not in EXTS:
                warns.append(f"Dilewati (format tidak dikenal): {d.name}/{f.name}")
                continue
            if re.search(r"[A-Z ]", f.name):
                warns.append(f"Sebaiknya huruf kecil tanpa spasi: {d.name}/{f.name}")
            size = f.stat().st_size
            total += size
            if size > BIG:
                warns.append(f"File besar ({size / 1048576:.1f} MB): {d.name}/{f.name}")
            typ, loop, vol, title = parse(f.stem)
            base = slug(f"{d.name}-{f.stem}") or "audio"
            tid, n = base, 2
            while tid in ids:
                tid, n = f"{base}-{n}", n + 1
            ids.add(tid)
            tracks.append({"id": tid, "title": title, "file": f"assets/audio/{d.name}/{f.name}",
                           "type": typ, "loop": loop, "volume": DEFAULT_VOL[typ] if vol is None else vol})
        if not tracks:
            if any(not f.name.startswith(".") for f in d.iterdir()):
                warns.append(f"Tidak ada audio yang bisa dipakai, scene dilewati: {d.name}")
            continue
        desc = ""
        dfile = d / "deskripsi.txt"
        if dfile.is_file():
            lines = dfile.read_text(encoding="utf-8").strip().splitlines()
            desc = lines[0].strip() if lines else ""
        scenes.append({"id": slug(d.name), "title": scene_title(d.name), "description": desc, "tracks": tracks})

    if not scenes:
        sys.exit("Belum ada audio di assets/audio/<folder-scene>/. data/scenes.json tidak diubah.")

    text = json.dumps({"scenes": scenes}, ensure_ascii=False, indent=2) + "\n"
    if OUT.is_file() and OUT.read_text(encoding="utf-8") != text:
        OUT.with_name("scenes.json.bak").write_text(OUT.read_text(encoding="utf-8"), encoding="utf-8")
    OUT.write_text(text, encoding="utf-8")

    print(f"Selesai: {len(scenes)} scene, {sum(len(s['tracks']) for s in scenes)} audio, {total / 1048576:.1f} MB")
    for s in scenes:
        print(f"  - {s['title']}: {len(s['tracks'])} audio")
    for w in warns:
        print("  ! " + w)


if __name__ == "__main__":
    main()
