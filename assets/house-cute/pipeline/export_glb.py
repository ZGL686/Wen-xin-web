"""Pack evaluated Max house geometry as a self-contained color-only GLB.

Reuses the project's keyboard/teapot GLB layout, with native render normals.
Vertices and normals must be world-space, centimeters, Z-up. Triangle indices
are zero-based. Optional cornerNormals takes precedence over vertex normals.
"""
from pathlib import Path
import json
import math
import struct
import sys
import tempfile


def vec(value, label):
    if not isinstance(value, list) or len(value) != 3:
        raise ValueError(f"{label} must have three coordinates")
    result = tuple(float(x) for x in value)
    if not all(math.isfinite(x) for x in result):
        raise ValueError(f"{label} must be finite")
    return result


def unit(value):
    length = math.sqrt(sum(x * x for x in value))
    if length < 1e-20:
        raise ValueError("Nondegenerate face has a zero normal")
    return tuple(x / length for x in value)


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def linear(c):
    return c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4


def export(source, target, *, scene_name="Berry Cottage", material_options=None):
    objects = json.loads(source.read_text(encoding="utf-8-sig")).get("objects")
    if not isinstance(objects, list) or not objects:
        raise ValueError("Expected a nonempty objects array")
    generator = "3ds Max 2026 evaluated house meshes / Changxu" if scene_name == "Berry Cottage" else "3ds Max 2026 evaluated meshes / Changxu"
    g = {"asset": {"version": "2.0", "generator": generator},
         "scene": 0, "scenes": [{"name": scene_name, "nodes": []}],
         "nodes": [], "meshes": [], "materials": [], "accessors": [], "bufferViews": [], "buffers": []}
    binary = bytearray()
    materials = {}
    lo, hi = [math.inf]*3, [-math.inf]*3
    triangles = vertices = skipped = 0
    normal_sources = {"nativeCorners": 0, "nativeVertices": 0, "areaWeightedFallback": 0}

    def accessor(values, component, kind, buffer_target, bounds=False):
        while len(binary) % 4:
            binary.append(0)
        dimensions = 3 if kind == "VEC3" else 1
        flat = [x for v in values for x in v] if dimensions == 3 else values
        raw = struct.pack("<" + ("f" if component == 5126 else "I")*len(flat), *flat)
        view = len(g["bufferViews"])
        g["bufferViews"].append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(raw), "target": buffer_target})
        binary.extend(raw)
        result = {"bufferView": view, "componentType": component, "count": len(values), "type": kind}
        if bounds:
            result.update(min=[min(v[i] for v in values) for i in range(3)], max=[max(v[i] for v in values) for i in range(3)])
        index = len(g["accessors"])
        g["accessors"].append(result)
        return index

    for number, obj in enumerate(objects):
        name = str(obj.get("name", f"Part_{number+1}"))
        source_vertices = [vec(v, name+" vertex") for v in obj.get("vertices", [])]
        points = [(x*.01, z*.01, -y*.01) for x, y, z in source_vertices]
        faces = obj.get("faces", [])
        if not points or not faces:
            continue
        for face in faces:
            if not isinstance(face, list) or len(face) != 3 or any(type(i) is not int or i < 0 or i >= len(points) for i in face):
                raise ValueError(name+" has an invalid triangle index")
        corners, native = obj.get("cornerNormals"), obj.get("normals")
        if corners is not None:
            if len(corners) != len(faces) or any(len(c) != 3 for c in corners):
                raise ValueError(name+" cornerNormals must contain one triple per face")
            corners = [[vec(n, name+" corner normal") for n in row] for row in corners]
            normal_sources["nativeCorners"] += 1
        elif native is not None:
            if len(native) != len(points):
                raise ValueError(name+" normals must match vertices")
            native = [vec(n, name+" normal") for n in native]
            normal_sources["nativeVertices"] += 1
        else:
            normal_sources["areaWeightedFallback"] += 1
        weighted, valid, adjacent = [], [], [[] for _ in points]
        for fi, face in enumerate(faces):
            a, b, c = (points[i] for i in face)
            n = cross(tuple(b[i]-a[i] for i in range(3)), tuple(c[i]-a[i] for i in range(3)))
            weighted.append(n)
            if sum(x*x for x in n) < 1e-30:
                skipped += 1
                continue
            valid.append(fi)
            for vi in face:
                adjacent[vi].append(fi)
        if not valid:
            continue
        face_normals = {fi: unit(weighted[fi]) for fi in valid}
        positions, normals, indices, lookup = [], [], [], {}
        for fi in valid:
            for ci, vi in enumerate(faces[fi]):
                if corners is not None or native is not None:
                    x, y, z = corners[fi][ci] if corners is not None else native[vi]
                    normal = unit((x, z, -y))
                else:
                    selected = [j for j in adjacent[vi] if sum(face_normals[j][k]*face_normals[fi][k] for k in range(3)) >= math.cos(math.pi/4)-.001]
                    normal = unit(tuple(sum(weighted[j][k] for j in selected) for k in range(3)))
                key = (vi, normal)
                if key not in lookup:
                    lookup[key] = len(positions)
                    positions.append(points[vi])
                    normals.append(normal)
                indices.append(lookup[key])
        material_name = str(obj.get("material", "Clay"))
        color = vec(obj.get("color", [1, 1, 1]), name+" color")
        if any(c < 0 or c > 1 for c in color):
            raise ValueError(name+" color must be in 0..1")
        if material_name not in materials:
            materials[material_name] = len(g["materials"])
            options = material_options(material_name) if material_options else {}
            base_color = [linear(c) for c in color]
            material = {"name": material_name, "pbrMetallicRoughness": {"baseColorFactor": base_color+[1],
                        "metallicFactor": options.get("metallic", 0), "roughnessFactor": options.get("roughness", .78)}}
            if options.get("unlit"):
                material["extensions"] = {"KHR_materials_unlit": {}}
                g["extensionsUsed"] = ["KHR_materials_unlit"]
            g["materials"].append(material)
        primitive = {"attributes": {"POSITION": accessor(positions, 5126, "VEC3", 34962, True), "NORMAL": accessor(normals, 5126, "VEC3", 34962)},
                     "indices": accessor(indices, 5125, "SCALAR", 34963), "material": materials[material_name]}
        g["meshes"].append({"name": name, "primitives": [primitive]})
        g["nodes"].append({"name": name, "mesh": len(g["meshes"])-1})
        g["scenes"][0]["nodes"].append(len(g["nodes"])-1)
        for p in positions:
            for i in range(3):
                lo[i], hi[i] = min(lo[i], p[i]), max(hi[i], p[i])
        triangles += len(valid)
        vertices += len(positions)
    if not triangles:
        raise ValueError("No nondegenerate triangles")
    while len(binary) % 4:
        binary.append(0)
    g["buffers"] = [{"byteLength": len(binary)}]
    encoded = json.dumps(g, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8")
    encoded += b" "*((-len(encoded)) % 4)
    raw = struct.pack("<III", 0x46546C67, 2, 28+len(encoded)+len(binary))+struct.pack("<II", len(encoded), 0x4E4F534A)+encoded+struct.pack("<II", len(binary), 0x004E4942)+binary
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(raw)
    report = {"source": "3ds Max 2026 evaluated native meshes", "objects": len(g["meshes"]), "triangles": triangles, "vertices": vertices,
              "materials": len(materials), "glbBytes": len(raw), "externalResources": 0, "units": "meters", "axes": "Y-up",
              "normalSources": normal_sources, "degenerateTrianglesSkipped": skipped, "bounds": {"min": lo, "max": hi, "dimensions": [hi[i]-lo[i] for i in range(3)]}}
    target.with_suffix(".verification.json").write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8")
    return report


def self_test():
    with tempfile.TemporaryDirectory() as directory:
        source, target = Path(directory)/"mesh.json", Path(directory)/"mesh.glb"
        obj = {"name": "Triangle", "material": "Clay", "color": [.5, .7, .6], "vertices": [[0,0,0],[100,0,0],[0,100,0]], "faces": [[0,1,2]], "cornerNormals": [[[0,0,1]]*3]}
        source.write_text(json.dumps({"objects": [obj]}))
        report = export(source, target)
        raw = target.read_bytes()
        assert struct.unpack_from("<III", raw) == (0x46546C67, 2, len(raw))
        length = struct.unpack_from("<I", raw, 12)[0]
        doc = json.loads(raw[20:20+length])
        normal = doc["accessors"][1]
        view = doc["bufferViews"][normal["bufferView"]]
        assert struct.unpack_from("<3f", raw, 28+length+view["byteOffset"]) == (0,1,0)
        assert report["triangles"] == 1 and report["normalSources"]["nativeCorners"] == 1
        assert report["bounds"]["dimensions"] == [1,0,1]
        export(source, target, scene_name="Monitor", material_options=lambda _: {"unlit": True})
        raw = target.read_bytes()
        doc = json.loads(raw[20:20+struct.unpack_from("<I", raw, 12)[0]])
        assert doc["scenes"][0]["name"] == "Monitor"
        assert "KHR_materials_unlit" in doc["materials"][0]["extensions"]
        obj["faces"] = [[0,1,9]]
        source.write_text(json.dumps({"objects": [obj]}))
        try:
            export(source, target)
        except ValueError:
            pass
        else:
            raise AssertionError("Invalid triangle was accepted")
        obj.pop("cornerNormals")
        obj["vertices"].append([0,0,100])
        obj["faces"] = [[0,1,2],[0,3,1],[0,0,0]]
        source.write_text(json.dumps({"objects": [obj]}))
        report = export(source, target)
        assert report["triangles"] == 2 and report["vertices"] == 6
        assert report["normalSources"]["areaWeightedFallback"] == 1
        assert report["degenerateTrianglesSkipped"] == 1
    print("GLB self-check passed: native normals, hard edges, degenerate faces, bounds, headers, invalid indices")


if __name__ == "__main__":
    if sys.argv[1:] == ["--self-test"]:
        self_test()
    elif len(sys.argv) == 3:
        print(json.dumps(export(Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve())))
    else:
        raise SystemExit("Usage: export_glb.py native-meshes.json House.glb | --self-test")
