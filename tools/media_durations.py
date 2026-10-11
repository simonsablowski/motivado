"""Measure the length of every converted video, so the site can say "30 Stunden Videomaterial".

Usage: python tools/media_durations.py content <converted media dir>

Writes content/media-durations.json: legacy file name (as used in content/media.json) -> seconds.
Existing entries are kept, so only new videos are probed. Needs ffprobe (ships with ffmpeg).
"""
import glob
import json
import os
import shutil
import subprocess
import sys


def find_ffprobe():
    hit = shutil.which('ffprobe')
    if hit:
        return hit
    base = os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Microsoft', 'WinGet', 'Packages')
    for p in glob.glob(os.path.join(base, 'Gyan.FFmpeg*', '**', 'ffprobe.exe'), recursive=True):
        return p
    raise SystemExit('ffprobe not found')


content, media_dir = sys.argv[1], sys.argv[2]
mapping = json.load(open(os.path.join(content, 'media.json'), encoding='utf-8'))
out_path = os.path.join(content, 'media-durations.json')
durations = json.load(open(out_path, encoding='utf-8')) if os.path.exists(out_path) else {}
ffprobe = find_ffprobe()

todo = [(name, rel) for name, rel in mapping.items() if rel.startswith('video/') and name not in durations]
for i, (name, rel) in enumerate(todo, 1):
    path = os.path.join(media_dir, rel)
    if not os.path.exists(path):
        continue
    r = subprocess.run([ffprobe, '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                       capture_output=True, text=True)
    try:
        durations[name] = round(float(r.stdout.strip()), 1)
    except ValueError:
        print('no duration:', rel)
    if i % 200 == 0:
        print(f'  {i}/{len(todo)}')

json.dump(dict(sorted(durations.items())), open(out_path, 'w', encoding='utf-8'), indent=0)
print(f'{len(durations)} durations, {sum(durations.values()) / 3600:.1f} hours in total')
