# Media

Videos, images and documents are **not** in the repository (about 25 GB of
source). They are produced locally and uploaded to a media host.

## Pipeline

```bash
# 1. inventory: which file does each model reference, and where is it?
python tools/media_manifest.py content \
  videos=D:/Development/motivado/videos \
  documents=D:/Development/motivado/media/documents \
  images=D:/Development/motivado/media/player/images \
  images=D:/Development/motivado/backup/revival-public-player/assets/images

# 2. build the launch products (see content/site/launch.json)
python tools/build_media.py content out/media <same label=dir arguments>
```

`build_media.py` needs `ffmpeg` (`winget install Gyan.FFmpeg`). It is
resumable: finished files are skipped.

* The legacy clips are FLV with VP6 + alpha channel, which no browser plays.
  They are composited onto the page background colour (`STAGE` in
  `tools/build_media.py`, `--stage` in `apps/web/src/styles.css`; keep both in
  sync) and encoded as H.264/AAC MP4 with `faststart`.
* `content/media.json` maps the name used in the models to the file path
  below the media base URL. Missing files are simply absent from it, the
  player then hides them.
* `content/media-manifest.json` is the full inventory (name, source label,
  size, match quality). 1,517 of 1,525 referenced files exist.

## Hosting

Upload `out/media/` to a bucket (Cloudflare R2, see [DEPLOY.md](DEPLOY.md)) and
set `VITE_MEDIA_BASE_URL` at build time. The player requests
`<base>/video/<name>.mp4` with range requests.
