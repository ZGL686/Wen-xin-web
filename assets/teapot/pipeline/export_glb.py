"""Package evaluated 3ds Max teapot meshes and their UVs into a self-contained GLB.

Usage: <Max Python> export_glb.py native-meshes.json Porcelain_Teapot.glb
The native geometry must already be in world coordinates, centimeters, Z-up.
Only Python's standard library is used; no geometry is reconstructed here.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
import struct
import sys


TEXTURED_MATERIALS = {"BlueWhite_Peony", "Lid_Peony"}
TEXTURE_PATH = Path(__file__).resolve().parent.parent / "peony_albedo.png"


def vector(value, length, label):
    if not isinstance(value, list) or len(value) != length:
        raise ValueError(f"{label} must contain {length} coordinates")
    result = tuple(float(component) for component in value)
    if not all(math.isfinite(component) for component in result):
        raise ValueError(f"{label} contains a non-finite coordinate")
    return result


def index(value, count, label):
    if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value < count:
        raise ValueError(f"{label} index {value!r} is outside 0..{count - 1}")
    return value


def subtract(a, b):
    return tuple(a[axis] - b[axis] for axis in range(3))


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def normalize(value):
    magnitude = math.sqrt(sum(component * component for component in value))
    return tuple(component / magnitude for component in value) if magnitude > 1e-20 else (0.0, 1.0, 0.0)


def linear(value):
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def export(source_path, target_path):
    data = json.loads(source_path.read_text(encoding="utf-8-sig"))
    objects = data.get("objects")
    if not isinstance(objects, list) or not objects:
        raise ValueError("native-meshes.json must contain a nonempty objects array")
    document = {
        "asset": {"version": "2.0", "generator": "3ds Max 2026 evaluated teapot geometry / Changxu"},
        "scene": 0,
        "scenes": [{"name": "Porcelain Teapot", "nodes": []}],
        "nodes": [], "meshes": [], "materials": [], "accessors": [], "bufferViews": [], "buffers": [],
        "extensionsUsed": ["KHR_materials_clearcoat"],
    }
    binary = bytearray()
    materials = {}
    texture_index = None
    texture_bytes = 0
    bounds_min = [math.inf] * 3
    bounds_max = [-math.inf] * 3
    total_triangles = total_vertices = total_uvs = skipped_triangles = 0
    object_reports = []

    def add_view(raw, target=None):
        while len(binary) % 4:
            binary.append(0)
        view = {"buffer": 0, "byteOffset": len(binary), "byteLength": len(raw)}
        if target is not None:
            view["target"] = target
        binary.extend(raw)
        result = len(document["bufferViews"])
        document["bufferViews"].append(view)
        return result

    def add_accessor(values, dimensions, component_type, kind, target, bounds=False):
        flat = [component for value in values for component in value] if dimensions > 1 else values
        packing = "f" if component_type == 5126 else "I"
        raw = struct.pack("<" + packing * len(flat), *flat)
        accessor = {"bufferView": add_view(raw, target), "componentType": component_type, "count": len(values), "type": kind}
        if bounds:
            accessor["min"] = [min(value[axis] for value in values) for axis in range(dimensions)]
            accessor["max"] = [max(value[axis] for value in values) for axis in range(dimensions)]
        result = len(document["accessors"])
        document["accessors"].append(accessor)
        return result

    def embedded_texture():
        nonlocal texture_index, texture_bytes
        if texture_index is not None:
            return texture_index
        raw = TEXTURE_PATH.read_bytes()
        if len(raw) < 24 or raw[:8] != b"\x89PNG\r\n\x1a\n" or raw[12:16] != b"IHDR":
            raise ValueError("peony_albedo.png must be a valid PNG image")
        image = {"name": "Blue-and-white peony glaze", "bufferView": add_view(raw), "mimeType": "image/png"}
        document["images"] = [image]
        document["samplers"] = [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}]
        document["textures"] = [{"name": "Peony albedo", "source": 0, "sampler": 0}]
        texture_index = 0
        texture_bytes = len(raw)
        return texture_index

    def material_for(obj):
        name = str(obj.get("material", "White_Glaze"))
        if name in materials:
            return materials[name]
        textured = name in TEXTURED_MATERIALS
        color = vector(obj.get("color", [1.0, 1.0, 1.0]), 3, f"{name} color")
        if any(component < 0 or component > 1 for component in color):
            raise ValueError(f"{name} color must be normalized to 0..1")
        pbr = {"baseColorFactor": [1.0, 1.0, 1.0, 1.0] if textured else [linear(component) for component in color] + [1.0], "metallicFactor": 0.0, "roughnessFactor": 0.22}
        if textured:
            pbr["baseColorTexture"] = {"index": embedded_texture(), "texCoord": 0}
        material = {"name": name, "pbrMetallicRoughness": pbr, "extensions": {"KHR_materials_clearcoat": {"clearcoatFactor": 0.5, "clearcoatRoughnessFactor": 0.12}}}
        result = len(document["materials"])
        materials[name] = result
        document["materials"].append(material)
        return result

    for number, obj in enumerate(objects):
        name = str(obj.get("name", f"Part_{number + 1}"))
        raw_vertices = [vector(value, 3, f"{name} vertex") for value in obj.get("vertices", [])]
        vertices = [(x * 0.01, z * 0.01, -y * 0.01) for x, y, z in raw_vertices]
        faces = obj.get("faces", [])
        if not vertices or not faces:
            continue
        uvs = [vector(value, 2, f"{name} UV") for value in obj.get("uv", [])]
        uv_faces = obj.get("uvFaces", [])
        has_uv = bool(uvs and uv_faces)
        if str(obj.get("material", "")) in TEXTURED_MATERIALS and not has_uv:
            raise ValueError(f"Textured object {name} has no UV coordinates/faces")
        if has_uv and len(uv_faces) != len(faces):
            raise ValueError(f"{name} UV face count differs from geometry face count")
        normals = [[0.0, 0.0, 0.0] for _ in vertices]
        triangles = []
        local_skipped = 0
        for face_number, face in enumerate(faces):
            if not isinstance(face, list) or len(face) < 3:
                raise ValueError(f"{name} face {face_number} has fewer than three indices")
            face = tuple(index(value, len(vertices), f"{name} vertex") for value in face)
            uv_face = uv_faces[face_number] if has_uv else None
            if has_uv:
                if len(uv_face) != len(face):
                    raise ValueError(f"{name} UV and geometry face sizes disagree")
                uv_face = tuple(index(value, len(uvs), f"{name} UV") for value in uv_face)
            for corner in range(1, len(face) - 1):
                selected = (0, corner, corner + 1)
                tri = tuple(face[item] for item in selected)
                area_normal = cross(subtract(vertices[tri[1]], vertices[tri[0]]), subtract(vertices[tri[2]], vertices[tri[0]]))
                if sum(component * component for component in area_normal) <= 1e-30:
                    local_skipped += 1
                    continue
                tri_uv = tuple(uv_face[item] for item in selected) if has_uv else None
                triangles.append((tri, tri_uv))
                for vertex_index in tri:
                    for axis in range(3):
                        normals[vertex_index][axis] += area_normal[axis]
        if not triangles:
            skipped_triangles += local_skipped
            continue
        normals = [normalize(value) for value in normals]
        positions, packed_normals, packed_uvs, indices = [], [], [], []
        corner_lookup = {}
        for triangle, triangle_uv in triangles:
            for corner, vertex_index in enumerate(triangle):
                uv_index = triangle_uv[corner] if has_uv else None
                # Preserve UV seams while sharing each source vertex's smooth normal.
                key = (vertex_index, uv_index)
                packed_index = corner_lookup.get(key)
                if packed_index is None:
                    packed_index = len(positions)
                    corner_lookup[key] = packed_index
                    point = vertices[vertex_index]
                    positions.append(point)
                    packed_normals.append(normals[vertex_index])
                    if has_uv:
                        u, v = uvs[uv_index]
                        packed_uvs.append((u, 1.0 - v))
                    for axis in range(3):
                        bounds_min[axis] = min(bounds_min[axis], point[axis])
                        bounds_max[axis] = max(bounds_max[axis], point[axis])
                indices.append(packed_index)
        primitive = {
            "attributes": {"POSITION": add_accessor(positions, 3, 5126, "VEC3", 34962, bounds=True), "NORMAL": add_accessor(packed_normals, 3, 5126, "VEC3", 34962)},
            "indices": add_accessor(indices, 1, 5125, "SCALAR", 34963),
            "material": material_for(obj), "mode": 4,
        }
        if has_uv:
            primitive["attributes"]["TEXCOORD_0"] = add_accessor(packed_uvs, 2, 5126, "VEC2", 34962)
        mesh_index = len(document["meshes"])
        document["meshes"].append({"name": name, "primitives": [primitive]})
        node_index = len(document["nodes"])
        document["nodes"].append({"name": name, "mesh": mesh_index})
        document["scenes"][0]["nodes"].append(node_index)
        total_triangles += len(triangles)
        total_vertices += len(positions)
        total_uvs += len(packed_uvs)
        skipped_triangles += local_skipped
        object_reports.append({"name": name, "material": str(obj.get("material", "White_Glaze")), "vertices": len(positions), "triangles": len(triangles), "uvVertices": len(packed_uvs), "degenerateTrianglesSkipped": local_skipped})
    if not document["meshes"]:
        raise ValueError("No nondegenerate geometry was found; GLB was not written")
    while len(binary) % 4:
        binary.append(0)
    document["buffers"] = [{"byteLength": len(binary)}]
    encoded = json.dumps(document, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8")
    while len(encoded) % 4:
        encoded += b" "
    result = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(encoded) + 8 + len(binary)) + struct.pack("<II", len(encoded), 0x4E4F534A) + encoded + struct.pack("<II", len(binary), 0x004E4942) + binary
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_bytes(result)
    report = {
        "source": "3ds Max 2026 evaluated native meshes", "input": source_path.name, "output": target_path.name,
        "objects": len(document["meshes"]), "triangles": total_triangles, "vertices": total_vertices,
        "uvVertices": total_uvs, "uvMappedObjects": sum(item["uvVertices"] > 0 for item in object_reports),
        "materials": len(document["materials"]), "embeddedImages": len(document.get("images", [])), "embeddedTextureBytes": texture_bytes,
        "externalResources": 0, "glbBytes": len(result), "bufferBytes": len(binary), "degenerateTrianglesSkipped": skipped_triangles,
        "units": "meters", "axes": "Y-up", "bounds": {"min": bounds_min, "max": bounds_max, "dimensions": [bounds_max[axis] - bounds_min[axis] for axis in range(3)]},
        "parts": object_reports,
    }
    target_path.with_suffix(".verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: export_glb.py <native-meshes.json> <output.glb>")
    export(Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve())
