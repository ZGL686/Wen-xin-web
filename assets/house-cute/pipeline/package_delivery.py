"""Package the final verified house files and verify every archived byte."""
from pathlib import Path
import hashlib
import json
import struct
import zipfile


ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "deliverables/Cute_House_2026"
ARCHIVE = ROOT / "deliverables/Cute_House_3dsMax2026_Package.zip"
FILES = ["3d.max", "House.glb", "House_Hero.png", "House_Alternate.png",
         "House_Hero.jpg", "House_Alternate.jpg", "使用说明.txt",
         "native-verification.txt", "native-verification.json", "House.verification.json"]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    native = json.loads((OUT / "native-verification.json").read_text(encoding="utf-8-sig"))
    web = json.loads((OUT / "House.verification.json").read_text(encoding="utf-8-sig"))
    if native.get("allChecksPass") is not True:
        raise ValueError("Native scene reopen checks must pass before packaging")
    if web["objects"] != native["parts"] or web["triangles"] + web["degenerateTrianglesSkipped"] != native["triangles"]:
        raise ValueError("GLB geometry does not match the verified native scene")
    if web["externalResources"] != 0 or web["normalSources"]["nativeCorners"] != native["parts"]:
        raise ValueError("Expected self-contained GLB with native corner normals")
    contents = {name: (OUT / name).read_bytes() for name in FILES}
    if contents["3d.max"][:8] != bytes.fromhex("d0cf11e0a1b11ae1"):
        raise ValueError("MAX is not a native compound file")
    glb = contents["House.glb"]
    if struct.unpack_from("<III", glb) != (0x46546C67, 2, len(glb)) or len(glb) != web["glbBytes"]:
        raise ValueError("Invalid GLB header or length")
    length = struct.unpack_from("<I", glb, 12)[0]
    document = json.loads(glb[20:20+length])
    if any("uri" in resource for key in ("buffers", "images") for resource in document.get(key, [])):
        raise ValueError("GLB references an external resource")
    for name in ("House_Hero.png", "House_Alternate.png"):
        raw = contents[name]
        if raw[:8] != b"\x89PNG\r\n\x1a\n" or struct.unpack_from(">II", raw, 16) != (1600, 1400):
            raise ValueError("Expected final 1600x1400 render: " + name)
    for name in ("House_Hero.jpg", "House_Alternate.jpg"):
        if contents[name][:2] != b"\xff\xd8" or contents[name][-2:] != b"\xff\xd9":
            raise ValueError("Invalid JPEG: " + name)
    manifest = {name: {"bytes": len(raw), "sha256": sha(raw)} for name, raw in contents.items()}
    encoded = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    (OUT / "SHA256SUMS.json").write_bytes(encoded)
    contents["SHA256SUMS.json"] = encoded
    with zipfile.ZipFile(ARCHIVE, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for name, raw in contents.items():
            archive.writestr("Cute_House_2026/" + name, raw)
    with zipfile.ZipFile(ARCHIVE) as archive:
        if archive.testzip() is not None or len(archive.namelist()) != len(contents):
            raise ValueError("ZIP CRC or entry count check failed")
        for name, raw in contents.items():
            packed = archive.read("Cute_House_2026/" + name)
            if len(packed) != len(raw) or sha(packed) != sha(raw):
                raise ValueError("ZIP entry differs from delivered file: " + name)
    archive_bytes = ARCHIVE.read_bytes()
    ARCHIVE.with_suffix(".zip.sha256").write_text(sha(archive_bytes) + "  " + ARCHIVE.name + "\n", encoding="utf-8")
    report = {"result": "passed", "nativeReopenChecks": True, "zipCrcPass": True,
              "zipEntries": len(contents), "fileShaChecks": len(contents),
              "archive": ARCHIVE.name, "archiveBytes": len(archive_bytes), "archiveSha256": sha(archive_bytes),
              "manifest": "SHA256SUMS.json", "manifestFiles": len(manifest),
              "evidenceExcludedFromArchive": ["package-verification.json"], "files": manifest}
    (OUT / "package-verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key != "files"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
