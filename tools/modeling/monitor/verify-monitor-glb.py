"""Read-only verification of the monitor GLB against the native reopen receipt."""

import argparse
import hashlib
import json
import math
import struct
from pathlib import Path


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read_glb(path):
    raw = path.read_bytes()
    require(len(raw) >= 28, "Truncated GLB header")
    require(struct.unpack_from("<III", raw) == (0x46546C67, 2, len(raw)), "Invalid GLB2 header or file length")
    json_length, json_type = struct.unpack_from("<II", raw, 12)
    require(json_type == 0x4E4F534A and json_length % 4 == 0, "Invalid GLB JSON chunk")
    binary_header = 20 + json_length
    require(binary_header + 8 <= len(raw), "Missing GLB BIN chunk")
    binary_length, binary_type = struct.unpack_from("<II", raw, binary_header)
    require(binary_type == 0x004E4942 and binary_length % 4 == 0, "Invalid GLB BIN chunk")
    require(binary_header + 8 + binary_length == len(raw), "Invalid GLB BIN length or extra chunks")
    doc = json.loads(raw[20:binary_header])
    require(doc["asset"]["version"] == "2.0", "Invalid glTF asset version")
    require(doc["buffers"] == [{"byteLength": binary_length}], "Expected one internal BIN buffer")
    require(not doc.get("images") and not doc.get("textures"), "Expected material colors without images or textures")
    return raw, doc, memoryview(raw)[binary_header + 8:]


def read_accessor(doc, binary, index, vector):
    require(0 <= index < len(doc["accessors"]), "Invalid accessor index")
    accessor = doc["accessors"][index]
    component = accessor["componentType"]
    if vector:
        require(component == 5126 and accessor["type"] == "VEC3", "Expected float VEC3 attributes")
        fmt = "<3f"
    else:
        require(component in (5121, 5123, 5125) and accessor["type"] == "SCALAR", "Expected unsigned scalar indices")
        fmt = {5121: "<B", 5123: "<H", 5125: "<I"}[component]
    view_index = accessor["bufferView"]
    require(0 <= view_index < len(doc["bufferViews"]), "Invalid buffer view index")
    view = doc["bufferViews"][view_index]
    require(view["buffer"] == 0 and "sparse" not in accessor and not accessor.get("normalized"), "Unexpected accessor storage")
    width = struct.calcsize(fmt)
    require(view.get("byteStride", width) == width, "Expected packed accessor")
    start = view.get("byteOffset", 0)
    offset = accessor.get("byteOffset", 0)
    end = offset + accessor["count"] * width
    require(accessor["count"] > 0 and 0 <= offset < end <= view["byteLength"], "Accessor outside buffer view")
    require(0 <= start <= start + view["byteLength"] <= len(binary), "Buffer view outside BIN chunk")
    return list(struct.iter_unpack(fmt, binary[start + offset:start + end]))


def bounds(points):
    axes = tuple(zip(*points))
    return tuple(min(axis) for axis in axes), tuple(max(axis) for axis in axes)


def close_vec(a, b, tolerance=0.00005):
    return len(a) == len(b) and all(math.isclose(x, y, rel_tol=0, abs_tol=tolerance) for x, y in zip(a, b))


def verify(glb_path, native_path, export_path):
    native = json.loads(native_path.read_text(encoding="utf-8-sig"))
    receipt = json.loads(export_path.read_text(encoding="utf-8-sig"))
    require(all(native.get(key) is True for key in ("allChecksPass", "reopened", "unitsPass", "screenPass")), "Native reopen receipt has not passed")
    raw, doc, binary = read_glb(glb_path)
    nodes, meshes, materials = doc["nodes"], doc["meshes"], doc["materials"]
    scene_index = doc.get("scene", 0)
    require(0 <= scene_index < len(doc["scenes"]), "Invalid default scene")
    scene = doc["scenes"][scene_index]
    require(sorted(scene["nodes"]) == list(range(len(nodes))), "Default scene must contain each baked node once")
    require(len(nodes) == len(meshes) == native["parts"] == receipt["objects"], "Native and GLB part counts differ")
    require(sorted(node["mesh"] for node in nodes) == list(range(len(meshes))), "Expected a mesh per node")
    require(len(materials) == native["materials"] == receipt["materials"], "Native and GLB material counts differ")
    require(receipt["units"] == "meters" and receipt["axes"] == "Y-up" and receipt["glbBytes"] == len(raw), "GLB export receipt units, axes or bytes differ")
    require(receipt["externalResources"] == 0 and receipt["normalSources"]["nativeCorners"] == len(nodes), "Expected native face-corner normals and an internal model")

    point_groups, used_materials, named_bounds = [], set(), {}
    triangles = vertices = 0
    max_normal_error = 0.0
    for node in nodes:
        name = node["name"]
        require(not any(key in node for key in ("matrix", "translation", "rotation", "scale", "children", "skin")), f"Node {name} must have baked world coordinates")
        mesh = meshes[node["mesh"]]
        require(len(mesh["primitives"]) == 1, f"Expected one primitive for {name}")
        primitive = mesh["primitives"][0]
        require(primitive.get("mode", 4) == 4, f"Expected TRIANGLES for {name}")
        material = primitive["material"]
        require(0 <= material < len(materials), f"Invalid material index for {name}")
        used_materials.add(material)
        attrs = primitive["attributes"]
        positions = read_accessor(doc, binary, attrs["POSITION"], vector=True)
        normals = read_accessor(doc, binary, attrs["NORMAL"], vector=True)
        indices = [value for (value,) in read_accessor(doc, binary, primitive["indices"], vector=False)]
        require(all(math.isfinite(v) for xyz in positions for v in xyz), f"Nonfinite positions for {name}")
        require(len(normals) == len(positions), f"Normal count differs for {name}")
        for normal in normals:
            error = abs(sum(axis * axis for axis in normal) - 1)
            require(math.isfinite(error) and error <= 1e-5, f"Invalid unit normal for {name}")
            max_normal_error = max(max_normal_error, error)
        require(len(indices) % 3 == 0 and max(indices) < len(positions), f"Invalid triangle indices for {name}")
        require(all(len(set(indices[i:i+3])) == 3 for i in range(0, len(indices), 3)), f"Repeated vertex index in a triangle for {name}")
        lo, hi = bounds(positions)
        position_accessor = doc["accessors"][attrs["POSITION"]]
        require(close_vec(lo, position_accessor["min"]) and close_vec(hi, position_accessor["max"]), f"Incorrect binary POSITION min/max for {name}")
        named_bounds.setdefault(name, []).append((lo, hi))
        point_groups.extend((lo, hi))
        vertices += len(positions)
        triangles += len(indices) // 3

    require(len(used_materials) == len(materials), "Unused GLB material")
    skipped = receipt["degenerateTrianglesSkipped"]
    require(type(skipped) is int and skipped >= 0, "Invalid degenerate triangle count")
    require(triangles == receipt["triangles"] and triangles + skipped == native["triangles"], "GLB + skipped triangles do not match Max")
    require(vertices == receipt["vertices"], "GLB vertex count differs from export receipt")
    lo, hi = bounds(point_groups)
    nlo, nhi = native["boundsCm"]["min"], native["boundsCm"]["max"]
    expected_lo = (nlo[0]*.01, nlo[2]*.01, -nhi[1]*.01)
    expected_hi = (nhi[0]*.01, nhi[2]*.01, -nlo[1]*.01)
    require(close_vec(lo, expected_lo) and close_vec(hi, expected_hi), "Binary bounds disagree with Max cm/Z-up to GLB m/Y-up")
    require(close_vec(lo, receipt["bounds"]["min"]) and close_vec(hi, receipt["bounds"]["max"]), "Binary bounds disagree with GLB export receipt")
    for name in ("Screen_Active", "Front_Bezel", "Back_Shell", "Stand_Upright", "Base_Foot"):
        require(len(named_bounds.get(name, [])) == 1, f"Required node {name} absent or duplicated")
    screen_lo, screen_hi = named_bounds["Screen_Active"][0]
    width = 100 * (screen_hi[0] - screen_lo[0])
    height = 100 * (screen_hi[1] - screen_lo[1])
    screen_cm = (width, height, math.hypot(width, height))
    native_screen_cm = tuple(native["screenCm"][axis] for axis in ("width", "height", "diagonal"))
    require(close_vec(screen_cm, native_screen_cm, .01) and close_vec(screen_cm, (59.77, 33.62, 68.58), .25), "27-inch active-screen dimensions differ")
    return {"result": "passed", "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw),
            "objects": len(nodes), "materials": len(materials), "triangles": triangles,
            "nativeTriangles": native["triangles"], "degenerateTrianglesSkipped": skipped,
            "verticesAndNormals": vertices, "maxSquaredNormalLengthError": max_normal_error,
            "boundsMetersYUp": {"min": lo, "max": hi},
            "screenCm": dict(zip(("width", "height", "diagonal"), screen_cm)), "externalResources": 0}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("glb", type=Path)
    parser.add_argument("native_receipt", type=Path)
    parser.add_argument("export_receipt", type=Path, nargs="?")
    args = parser.parse_args()
    print(json.dumps(verify(args.glb, args.native_receipt, args.export_receipt or args.glb.with_suffix(".verification.json")), indent=2))
