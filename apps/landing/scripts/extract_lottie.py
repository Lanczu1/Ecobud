"""Unpack the mobile app's .lottie files into public/lottie for the landing page.

Mascot layers are shrunk to their display size and saved as WebP so phones
on slow connections download ~10x less than the originals.
Run from apps/landing:  python scripts/extract_lottie.py
"""
import io
import json
import re
import zipfile
from pathlib import Path

from PIL import Image

ASSETS = Path(__file__).resolve().parents[2] / 'mobile' / 'assets'
OUT = Path(__file__).resolve().parents[1] / 'public' / 'lottie'
SOURCES = {
    'mascot': ASSETS / 'Ecobud Mascot' / 'New Lottie files' / 'HomeWave.lottie',
    'fire': ASSETS / 'Fire.lottie',
    'loading': ASSETS / 'Loading.lottie',
    'celebrate': ASSETS / 'Ecobud Mascot' / 'New Lottie files' / 'Celebrate.lottie',
    'confetti': ASSETS / 'Celebrate.lottie',
}

for name, source in SOURCES.items():
    target = OUT / name
    target.mkdir(parents=True, exist_ok=True)
    for f in target.iterdir():
        if f.is_file():
            f.unlink()
    with zipfile.ZipFile(source) as archive:
        scene = next(n for n in archive.namelist() if n.endswith('.json') and n != 'manifest.json')
        data = json.loads(archive.read(scene))
        for asset in data.get('assets', []):
            if 'p' not in asset:
                continue
            raw = archive.read('i/' + asset['p'])
            image = Image.open(io.BytesIO(raw)).resize((asset['w'], asset['h']), Image.Resampling.LANCZOS)
            filename = re.sub(r'[^a-z0-9]+', '-', asset['p'].rsplit('_', 1)[0].lower()).strip('-') + '.webp'
            image.save(target / filename, 'WEBP', quality=86, method=6)
            asset['u'], asset['p'], asset['e'] = '', filename, 0
    (target / 'data.json').write_text(json.dumps(data, separators=(',', ':')), encoding='utf-8')
    print(name, sum(f.stat().st_size for f in target.iterdir()) // 1024, 'KB')
