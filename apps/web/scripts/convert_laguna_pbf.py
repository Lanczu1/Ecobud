"""Extract a lightweight Laguna map overlay from the supplied Philippines OSM PBF."""

import json
import struct
import zlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "map" / "philippines-260722.osm.pbf"
OUTPUT = ROOT / "public" / "maps" / "Laguna.geojson"
# The rectangle only limits work while reading the country extract. The exact
# map bounds are calculated from the Laguna administrative relation below.
SEARCH_BOUNDS = (120.95, 13.9, 121.8, 14.6)


def varint(data, position):
    value = 0
    shift = 0
    while True:
        byte = data[position]
        position += 1
        value |= (byte & 127) << shift
        if byte < 128:
            return value, position
        shift += 7


def fields(data):
    position = 0
    while position < len(data):
        key, position = varint(data, position)
        number, wire = key >> 3, key & 7
        if wire == 0:
            value, position = varint(data, position)
        elif wire == 2:
            length, position = varint(data, position)
            value = data[position:position + length]
            position += length
        elif wire == 1:
            value = data[position:position + 8]
            position += 8
        elif wire == 5:
            value = data[position:position + 4]
            position += 4
        else:
            raise ValueError(f"Unsupported PBF wire type {wire}")
        yield number, value


def signed(value):
    return (value >> 1) ^ -(value & 1)


def packed(data, zigzag=False):
    position = 0
    while position < len(data):
        value, position = varint(data, position)
        yield signed(value) if zigzag else value


def blocks():
    with SOURCE.open("rb") as source:
        while size_bytes := source.read(4):
            header_size = struct.unpack(">I", size_bytes)[0]
            header = dict(fields(source.read(header_size)))
            kind = header[1]
            blob_size = header[3]
            blob = dict(fields(source.read(blob_size)))
            if kind != b"OSMData":
                continue
            if 3 in blob:
                yield zlib.decompress(blob[3])
            elif 1 in blob:
                yield blob[1]
            else:
                raise ValueError("Unsupported PBF compression")


def primitive_groups(block):
    block_fields = list(fields(block))
    strings = [value for number, value in fields(next(value for number, value in block_fields if number == 1)) if number == 1]
    granularity = next((value for number, value in block_fields if number == 17), 100)
    lat_offset = next((signed(value) for number, value in block_fields if number == 19), 0)
    lon_offset = next((signed(value) for number, value in block_fields if number == 20), 0)
    for number, group in block_fields:
        if number == 2:
            yield strings, granularity, lat_offset, lon_offset, group


def tags(entity, strings):
    pairs = dict(fields(entity))
    keys = list(packed(pairs.get(2, b"")))
    values = list(packed(pairs.get(3, b"")))
    return {strings[key].decode("utf-8"): strings[value].decode("utf-8") for key, value in zip(keys, values)}


def relation_members(entity):
    values = dict(fields(entity))
    references = packed(values.get(9, b""), zigzag=True)
    kinds = packed(values.get(10, b""))
    ref = 0
    for delta, kind in zip(references, kinds):
        ref += delta
        if kind == 1:
            yield ref


def laguna_boundary_ways():
    for block in blocks():
        for strings, _, _, _, group in primitive_groups(block):
            for number, entity in fields(group):
                if number != 4:
                    continue
                properties = tags(entity, strings)
                if properties.get("name") == "Laguna" and properties.get("boundary") == "administrative" and properties.get("admin_level") == "4":
                    return set(relation_members(entity))
    raise ValueError("Laguna province boundary relation was not found in the PBF")


def extract(boundary_ways):
    nodes = {}
    ways = []
    boundary_nodes = set()
    for block in blocks():
        for strings, granularity, lat_offset, lon_offset, group in primitive_groups(block):
            for number, entity in fields(group):
                if number == 2:  # DenseNodes
                    dense = dict(fields(entity))
                    ids = packed(dense.get(1, b""), zigzag=True)
                    lats = packed(dense.get(8, b""), zigzag=True)
                    lons = packed(dense.get(9, b""), zigzag=True)
                    node_id = lat = lon = 0
                    for id_delta, lat_delta, lon_delta in zip(ids, lats, lons):
                        node_id += id_delta
                        lat += lat_delta
                        lon += lon_delta
                        point = ((lon_offset + granularity * lon) * 1e-9, (lat_offset + granularity * lat) * 1e-9)
                        if SEARCH_BOUNDS[0] <= point[0] <= SEARCH_BOUNDS[2] and SEARCH_BOUNDS[1] <= point[1] <= SEARCH_BOUNDS[3]:
                            nodes[node_id] = point
                elif number == 1:  # regular Node
                    values = dict(fields(entity))
                    point = ((lon_offset + granularity * signed(values[9])) * 1e-9, (lat_offset + granularity * signed(values[8])) * 1e-9)
                    if SEARCH_BOUNDS[0] <= point[0] <= SEARCH_BOUNDS[2] and SEARCH_BOUNDS[1] <= point[1] <= SEARCH_BOUNDS[3]:
                        nodes[signed(values[1])] = point
                elif number == 3:
                    values = dict(fields(entity))
                    way_id = values[1]
                    properties = tags(entity, strings)
                    refs = []
                    ref = 0
                    for delta in packed(values.get(8, b""), zigzag=True):
                        ref += delta
                        refs.append(ref)
                    if way_id in boundary_ways:
                        boundary_nodes.update(refs)
                    if any(ref in nodes for ref in refs) and (properties.get("highway") in {"motorway", "trunk", "primary", "secondary"} or properties.get("waterway") in {"river", "canal"} or properties.get("natural") == "water" or properties.get("landuse") == "reservoir"):
                        ways.append((way_id, properties, refs))

    boundary_points = [nodes[ref] for ref in boundary_nodes if ref in nodes]
    if len(boundary_points) < 50:
        raise ValueError(f"Incomplete Laguna boundary ({len(boundary_points)} points)")
    west = min(point[0] for point in boundary_points)
    south = min(point[1] for point in boundary_points)
    east = max(point[0] for point in boundary_points)
    north = max(point[1] for point in boundary_points)
    bbox = [west, south, east, north]
    features = []
    for way_id, properties, refs in ways:
        coordinates = [nodes[ref] for ref in refs if ref in nodes]
        if len(coordinates) < 2 or not any(west <= lon <= east and south <= lat <= north for lon, lat in coordinates):
            continue
        is_area = len(coordinates) >= 4 and coordinates[0] == coordinates[-1] and (properties.get("natural") == "water" or properties.get("landuse") == "reservoir")
        geometry = {"type": "Polygon", "coordinates": [coordinates]} if is_area else {"type": "LineString", "coordinates": coordinates}
        features.append({"type": "Feature", "id": f"way/{way_id}", "properties": {key: properties[key] for key in ("highway", "waterway", "natural", "landuse", "name") if key in properties}, "geometry": geometry})
    return bbox, features


if __name__ == "__main__":
    boundary_ways = laguna_boundary_ways()
    bbox, features = extract(boundary_ways)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({"type": "FeatureCollection", "name": "Laguna OpenStreetMap data", "attribution": "© OpenStreetMap contributors", "bbox": bbox, "features": features}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {len(features)} features; bounds {bbox}; {OUTPUT.stat().st_size:,} bytes")
