"""
Prepare the media of the launch products for upload.

    python tools/build_media.py content out/media videos=D:/.../videos documents=... images=...

* videos  -> H.264/AAC MP4, composited on the stage colour (the clips are
             VP6 with alpha channel, which no browser can play)
* images, documents are copied

Writes <out>/video|image|document/<normalised-name>.<ext> and
content/media.json mapping the legacy name used in the models to the path
relative to the media base URL. Existing outputs are skipped, so the script
can be stopped and resumed.
"""
import concurrent.futures
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import unicodedata

STAGE = '0xF2EFE9'  # keep in sync with --stage in apps/web
CRF = '25'


def find_tool(name):
    hit = shutil.which(name)
    if hit:
        return hit
    base = os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Microsoft', 'WinGet', 'Packages')
    for p in glob.glob(os.path.join(base, 'Gyan.FFmpeg*', '**', name + '.exe'), recursive=True):
        return p
    raise SystemExit(f'{name} not found')


def slug(name):
    s = unicodedata.normalize('NFKD', name.strip().lower())
    s = s.replace('ß', 'ss')
    s = ''.join(c for c in s if ord(c) < 128)
    s = re.sub(r'\s+', '-', s)
    stem, ext = os.path.splitext(s)
    return re.sub(r'[^a-z0-9._-]', '', stem) + ext


def launch_models(content_dir):
    site = os.path.join(content_dir, 'site')
    config = json.load(open(os.path.join(site, 'launch.json'), encoding='utf-8'))
    launch = config['products']
    products = {p['slug']: p for p in json.load(open(os.path.join(site, 'products.json'), encoding='utf-8'))}
    alias = json.load(open(os.path.join(site, 'model-map.json'), encoding='utf-8'))
    index = {c['key'] for c in json.load(open(os.path.join(content_dir, 'index.json'), encoding='utf-8'))}
    keys = []
    for slug_ in launch:
        for k in products[slug_]['coachings']:
            m = alias.get(k, k)
            if m in index and m not in keys:
                keys.append(m)
    for f in config.get('featured', []):
        if f['coaching'] in index and f['coaching'] not in keys:
            keys.append(f['coaching'])
    return keys


def transcode(ffmpeg, ffprobe, src, dst):
    probe = subprocess.run(
        [ffprobe, '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src],
        capture_output=True, text=True)
    m = re.match(r'(\d+),(\d+)', probe.stdout.strip())
    if not m:
        return f'probe failed: {src}'
    w, h = (int(m.group(1)) // 2 * 2, int(m.group(2)) // 2 * 2)
    tmp = dst + '.part.mp4'
    cmd = [
        ffmpeg, '-v', 'error', '-y',
        '-f', 'lavfi', '-i', f'color=c={STAGE}:s={w}x{h}:r=25',
        '-i', src,
        '-filter_complex', f'[1:v]scale={w}:{h}[v];[0][v]overlay=shortest=1,format=yuv420p',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', CRF, '-r', '25',
        '-c:a', 'aac', '-b:a', '80k', '-ac', '1',
        '-movflags', '+faststart', tmp,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return f'ffmpeg failed: {src}: {r.stderr.strip()[:200]}'
    os.replace(tmp, dst)
    return None


def main(content_dir, out_dir, sources):
    manifest = json.load(open(os.path.join(content_dir, 'media-manifest.json'), encoding='utf-8'))
    dirs = {}
    for label, d in sources:
        dirs.setdefault(label, []).append(d)

    def locate(entry):
        for d in dirs.get(entry['source'], []):
            for root, _, files in os.walk(d):
                if entry['file'] in files:
                    return os.path.join(root, entry['file'])
        return None

    wanted = set()
    for key in launch_models(content_dir):
        wanted.update(manifest['coachings'].get(key, []))

    ffmpeg, ffprobe = find_tool('ffmpeg'), find_tool('ffprobe')
    mapping, jobs, problems = {}, [], []
    for name in sorted(wanted):
        e = manifest['files'][name]
        if e['match'] == 'missing':
            continue
        src = locate(e)
        if not src:
            problems.append(f'not found: {name}')
            continue
        kind = e['kind']
        ext = '.mp4' if kind == 'video' else os.path.splitext(e['file'])[1].lower()
        rel = f'{kind}/{os.path.splitext(slug(e["file"]))[0]}{ext}'
        dst = os.path.join(out_dir, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        mapping[name] = rel
        if os.path.exists(dst):
            continue
        if kind == 'video':
            jobs.append((src, dst))
        else:
            shutil.copyfile(src, dst)

    print(f'{len(wanted)} files wanted, {len(jobs)} videos to transcode')
    done = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) // 2)) as pool:
        futures = [pool.submit(transcode, ffmpeg, ffprobe, s, d) for s, d in jobs]
        for f in concurrent.futures.as_completed(futures):
            done += 1
            err = f.result()
            if err:
                problems.append(err)
            if done % 25 == 0 or done == len(jobs):
                print(f'  {done}/{len(jobs)}', flush=True)

    with open(os.path.join(content_dir, 'media.json'), 'w', encoding='utf-8') as f:
        json.dump(dict(sorted(mapping.items())), f, ensure_ascii=False, indent=1)
        f.write('\n')
    total = sum(os.path.getsize(os.path.join(r, x)) for r, _, fs in os.walk(out_dir) for x in fs)
    print(f'done: {len(mapping)} mapped, output {total / 1e6:.0f} MB, {len(problems)} problems')
    for p in problems:
        print(' ', p)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], [a.split('=', 1) for a in sys.argv[3:]])
