import copy
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


def optimize_composition(original):
    composition = copy.deepcopy(original)
    assets = {asset['id']: asset for asset in composition['assets']}

    def strip_hidden_images(layers):
        for layer in layers:
            if layer.get('hd') is True and layer.get('ty') == 2:
                layer['ty'] = 3
                layer.pop('refId', None)

    strip_hidden_images(composition['layers'])
    for asset in assets.values():
        strip_hidden_images(asset.get('layers', []))
    reachable = set()

    def visit(layers):
        for layer in layers:
            reference = layer.get('refId')
            if reference and reference not in reachable:
                reachable.add(reference)
                visit(assets[reference].get('layers', []))

    visit(composition['layers'])
    composition['assets'] = [asset for asset in composition['assets'] if asset['id'] in reachable]

    image_assets = {asset['id']: asset for asset in composition['assets'] if 'p' in asset}
    layer_groups = [composition['layers']] + [asset['layers'] for asset in composition['assets'] if 'layers' in asset]
    for layers in layer_groups:
        parent_indices = {layer.get('parent') for layer in layers}
        for layer in layers:
            if layer.get('ty') != 2:
                continue
            if layer['ind'] in parent_indices or layer.get('masksProperties') or layer.get('ef'):
                raise ValueError('Image layer cannot be resized without changing child or effect geometry.')
            anchor = layer['ks']['a']
            if anchor['a'] != 0:
                raise ValueError('Expected a static image anchor.')
            anchor['k'][:2] = [value / 2 for value in anchor['k'][:2]]
            scale = layer['ks']['s']
            if scale['a'] == 0:
                scale['k'][:2] = [value * 2 for value in scale['k'][:2]]
            else:
                for keyframe in scale['k']:
                    for field in ('s', 'e'):
                        if field in keyframe:
                            keyframe[field][:2] = [value * 2 for value in keyframe[field][:2]]
    for asset in image_assets.values():
        if asset['w'] % 2 or asset['h'] % 2:
            raise ValueError('Image dimensions must be divisible by two.')
        asset['w'] //= 2
        asset['h'] //= 2
    return composition


def optimize_archive(source, target):
    with ZipFile(source) as archive:
        animation_path = next(name for name in archive.namelist() if name.startswith('a/') and name.endswith('.json'))
        original = json.loads(archive.read(animation_path))
        optimized = optimize_composition(original)
        kept_images = {asset['p'] for asset in optimized['assets'] if 'p' in asset}
        removed_images = {asset['p'] for asset in original['assets'] if 'p' in asset} - kept_images
        with ZipFile(target, 'w', compression=ZIP_DEFLATED, compresslevel=9) as output:
            for entry in archive.infolist():
                if entry.filename.startswith('i/') and Path(entry.filename).name in removed_images:
                    continue
                data = archive.read(entry.filename)
                if entry.filename == animation_path:
                    data = json.dumps(optimized, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
                output.writestr(entry.filename, data)
    return removed_images


if __name__ == '__main__':
    asset_directory = Path(__file__).resolve().parents[3] / 'assets' / 'Ecobud Mascot' / 'New Lottie files'
    source = asset_directory / 'Wave.lottie'
    target = asset_directory / 'HomeWave.lottie'
    removed = optimize_archive(source, target)
    print(f'Home mascot: {source.stat().st_size:,} -> {target.stat().st_size:,} bytes; removed {len(removed)} hidden image assets.')
