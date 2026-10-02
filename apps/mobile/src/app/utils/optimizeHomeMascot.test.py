import copy
import json
import unittest
from pathlib import Path
from zipfile import ZipFile
from optimizeHomeMascot import optimize_composition


class HomeMascotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        directory = Path(__file__).resolve().parents[3] / 'assets' / 'Ecobud Mascot' / 'New Lottie files'
        cls.original_archive = ZipFile(directory / 'Wave.lottie')
        cls.home_archive = ZipFile(directory / 'HomeWave.lottie')
        cls.original = json.loads(cls.original_archive.read('a/Main Scene.json'))
        cls.home = json.loads(cls.home_archive.read('a/Main Scene.json'))

    @classmethod
    def tearDownClass(cls):
        cls.original_archive.close()
        cls.home_archive.close()

    def test_archive_matches_regenerated_composition(self):
        self.assertEqual(self.home, optimize_composition(self.original))

    def test_visible_geometry_keyframes_and_timing_are_preserved(self):
        old_assets = {asset['id']: asset for asset in self.original['assets']}
        new_assets = {asset['id']: asset for asset in self.home['assets']}
        groups = [(self.original['layers'], self.home['layers'])]
        groups += [(old_assets[key]['layers'], asset['layers']) for key, asset in new_assets.items() if 'layers' in asset]
        for before, after in groups:
            self.assertEqual(len(before), len(after))
            for old_layer, new_layer in zip(before, after):
                restored = copy.deepcopy(new_layer)
                if old_layer.get('hd') is True:
                    self.assertEqual(restored['hd'], True)
                    self.assertEqual(restored['ks'], old_layer['ks'])
                    continue
                if old_layer['ty'] == 2:
                    anchor = restored['ks']['a']['k']
                    anchor[:2] = [value * 2 for value in anchor[:2]]
                    scale = restored['ks']['s']
                    if scale['a'] == 0:
                        scale['k'][:2] = [value / 2 for value in scale['k'][:2]]
                    else:
                        for keyframe in scale['k']:
                            for field in ('s', 'e'):
                                if field in keyframe:
                                    keyframe[field][:2] = [value / 2 for value in keyframe[field][:2]]
                self.assertEqual(restored, old_layer)
        for field in ('w', 'h', 'fr', 'ip', 'op'):
            self.assertEqual(self.original[field], self.home[field])

    def test_visible_png_pixels_and_manifest_are_untouched(self):
        for asset in self.home['assets']:
            if 'p' in asset:
                image = 'i/' + asset['p']
                self.assertEqual(self.home_archive.read(image), self.original_archive.read(image))
        self.assertEqual(self.home_archive.read('manifest.json'), self.original_archive.read('manifest.json'))

    def test_android_decoded_bitmap_budget_drops_by_at_least_75_percent(self):
        pixels = lambda composition: sum(asset['w'] * asset['h'] for asset in composition['assets'] if 'p' in asset)
        before, after = pixels(self.original), pixels(self.home)
        self.assertLessEqual(after, before / 4)
        print(f'Declared decoded RGBA: {before * 4 / 1024**2:.1f} MiB -> {after * 4 / 1024**2:.1f} MiB')

    def test_parented_images_fail_instead_of_changing_child_geometry(self):
        unsupported = copy.deepcopy(self.original)
        visible = next(layer for layer in unsupported['layers'] if layer['ty'] == 2 and not layer.get('hd'))
        unsupported['layers'].append({'ty': 3, 'ind': 100, 'parent': visible['ind']})
        with self.assertRaises(ValueError):
            optimize_composition(unsupported)


if __name__ == '__main__':
    unittest.main()
