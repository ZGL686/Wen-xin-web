"""Export the monitor from the evaluated native Max meshes."""
from pathlib import Path
import json
import sys


ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "assets/house-cute/pipeline"))
from export_glb import export


def appearance(name):
    if name.startswith(("Wallpaper_", "Display_")) or name == "Power_LED":
        return {"unlit": True}
    if name in {"Satin_Graphite_Aluminum", "Connector_Brushed_Steel", "Connector_Contacts"}:
        return {"metallic": .45, "roughness": .48}
    return {"roughness": .64}


if __name__ == "__main__":
    out = ROOT / "formspace/outputs/monitor-native"
    print(json.dumps(export(out / "native-meshes.json", out / "Monitor_27.glb",
                            scene_name="27-inch Desktop Monitor", material_options=appearance)))
