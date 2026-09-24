import json
import xml.etree.ElementTree as ET
from pathlib import Path

root_dir = Path(__file__).resolve().parents[1]
osm_path = root_dir / "map" / "Nagcarlan.osm"
output_path = root_dir / "public" / "maps" / "Nagcarlan.geojson"
root = ET.parse(osm_path).getroot()
nodes = {
    node.attrib["id"]: [float(node.attrib["lon"]), float(node.attrib["lat"])]
    for node in root.findall("node")
}
features = []
way_keys = {"highway", "waterway", "landuse", "natural", "leisure", "building"}
property_keys = way_keys | {"name", "sport"}

for way in root.findall("way"):
    tags = {tag.attrib["k"]: tag.attrib["v"] for tag in way.findall("tag")}
    if not way_keys.intersection(tags):
        continue
    coordinates = [nodes[ref.attrib["ref"]] for ref in way.findall("nd") if ref.attrib["ref"] in nodes]
    if len(coordinates) < 2:
        continue
    is_area = (
        len(coordinates) > 3
        and coordinates[0] == coordinates[-1]
        and bool({"landuse", "natural", "leisure", "building"} & tags.keys())
    )
    geometry = {"type": "Polygon", "coordinates": [coordinates]} if is_area else {"type": "LineString", "coordinates": coordinates}
    features.append({
        "type": "Feature",
        "id": f"way/{way.attrib['id']}",
        "properties": {key: value for key, value in tags.items() if key in property_keys},
        "geometry": geometry,
    })

collection = {
    "type": "FeatureCollection",
    "name": "Nagcarlan OpenStreetMap data",
    "attribution": "© OpenStreetMap contributors",
    "bbox": [
        float(root.find("bounds").attrib["minlon"]),
        float(root.find("bounds").attrib["minlat"]),
        float(root.find("bounds").attrib["maxlon"]),
        float(root.find("bounds").attrib["maxlat"]),
    ],
    "features": features,
}
output_path.write_text(json.dumps(collection, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"Wrote {len(features)} OSM features to {output_path} ({output_path.stat().st_size:,} bytes)")

