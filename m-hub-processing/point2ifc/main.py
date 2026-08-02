"""Point2IFC — Punktwolke -> reduziertes IFC (Waende/Decken/Dach je Geschoss).

Pipeline als aufrufbare Funktion build_ifc() (fuer job_api) + CLI-Wrapper.
"""
import argparse
import os
import gc

import open3d as o3d

from io_util import load_pointcloud, clean_pointcloud, split_floors, define_masks
from walls_util import extract_walls
from slabs_util import extract_slabs
from roof_util import extract_roofs
from ifc_util import IFCBuilder


def build_ifc(input_path, out_dir="./out", visualize=False, debug=False, write_floors=True):
    """Rekonstruiert ein reduziertes IFC aus einer Punktwolke.

    Rueckgabe: dict mit ifc-Pfad + Zaehlern (storeys/walls/openings/slabs/roofs).
    """
    gc.collect()
    pcd = load_pointcloud(input_path)
    pcd = clean_pointcloud(pcd)
    floors, floor_meta = split_floors(pcd, visualize=visualize, debug=debug)

    ifc = IFCBuilder()
    direction_registry: list[float] = []
    n = {"storeys": 0, "walls": 0, "openings": 0, "slabs": 0, "roofs": 0}

    for i, floor in enumerate(floors):
        print(f"\n[build_ifc] floor {i+1}/{len(floors)}")
        points, normals, walls_dict, slabs_dict, roof_dict = define_masks(floor)
        walls, _peak = extract_walls(
            points, normals, walls_dict, visualize=visualize,
            storey_floor=floor_meta[i]["z_floor"],
            storey_ceiling=floor_meta[i]["z_ceiling"],
            direction_registry=direction_registry,
        )
        if len(walls) < 5:
            print(f"[build_ifc] floor {i+1}: only {len(walls)} walls -> skipped")
            continue
        floor_slab, ceil_slab = extract_slabs(points, slabs_dict)
        roofs = extract_roofs(points, normals, roof_dict, visualize=visualize)

        ifc.add_storey(i); n["storeys"] += 1
        ifc.add_walls(walls); n["walls"] += len(walls)
        n["openings"] += sum(len(w.get("openings", []) or []) for w in walls)

        if floor_slab:
            ifc.add_slab("Floor", floor_slab["polygon"], z_elevation=floor_slab["z"],
                         depth=0.2, direction_sense="NEGATIVE"); n["slabs"] += 1
        if roofs:
            for idx, facet in enumerate(roofs):
                ifc.add_roof(facet, idx); n["roofs"] += 1
        elif ceil_slab:
            ifc.add_slab("Ceiling", ceil_slab["polygon"], z_elevation=ceil_slab["z"],
                         depth=0.2, direction_sense="POSITIVE"); n["slabs"] += 1

    base = os.path.splitext(os.path.basename(input_path))[0]
    dst = os.path.join(out_dir, base)
    os.makedirs(dst, exist_ok=True)
    if write_floors:
        for i, floor in enumerate(floors, start=1):
            o3d.io.write_point_cloud(os.path.join(dst, f"floor_{i}.pcd"), floor)
    ifc_path = os.path.join(dst, f"{base}.ifc")
    ifc.write(ifc_path)

    result = {"ifc": ifc_path, "floors_total": len(floors), **n}
    print(f"[build_ifc] done: {result}")
    return result


def parse_args():
    p = argparse.ArgumentParser(description="Punktwolke -> reduziertes IFC.")
    p.add_argument("--input", "-i", required=True, help="Pfad zur .laz/.las/.ply/.pcd/.e57")
    p.add_argument("--out", "-o", default="./out", help="Ausgabeverzeichnis")
    p.add_argument("--debug", "-d", action="store_true")
    p.add_argument("--visualize", "-v", action="store_true")
    return p.parse_args()


def main():
    args = parse_args()
    build_ifc(args.input, out_dir=args.out, visualize=args.visualize, debug=args.debug)
    print("Done.")


if __name__ == "__main__":
    main()
