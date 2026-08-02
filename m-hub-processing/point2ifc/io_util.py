from collections import defaultdict
from pathlib import Path
import laspy
import numpy as np
import open3d as o3d
# pye57 wird lazy im .e57-Zweig importiert (nicht noetig fuer .laz/.ply)
from scipy.signal import find_peaks, peak_widths
from scipy.ndimage import gaussian_filter1d
from vis_util import visualize_floors, debug_floors, debug_floor_profile


def load_pointcloud(input_path) -> o3d.geometry.PointCloud:
    ext = Path(input_path).suffix.lower()
    if ext in {".laz", ".las"}:
        with laspy.open(input_path) as fh:
            las = fh.read()
            coords = np.vstack((las.x, las.y, las.z)).T
        pcd = o3d.t.geometry.PointCloud()
        pcd.point.positions = o3d.core.Tensor(coords, o3d.core.float32)
    elif ext in {".pcd", ".ply", ".xyz", ".xyzn", ".xyzrgb", ".pts"}:
        pcd = o3d.t.io.read_point_cloud(input_path)
    elif ext == ".e57":
        from pye57 import E57
        e57 = E57(str(input_path))
        data = e57.read_scan(0, ignore_missing_fields=True)
        coords = np.vstack(
            [data["cartesianX"], data["cartesianY"], data["cartesianZ"]]
        ).T
        pcd = o3d.t.geometry.PointCloud()
        pcd.point.positions = o3d.core.Tensor(coords, o3d.core.float32)
    else:
        raise ValueError(f"Unsupported file extension: {ext}")
    if pcd.is_empty():
        raise ValueError(f"Loaded point cloud is empty: {input_path}")
    print(f"[load_pointcloud] loaded {pcd} from {input_path}")
    return pcd.to_legacy()


def clean_pointcloud(
    pcd: o3d.geometry.PointCloud,
    voxel: float = 0.05,
    nb_neighbors: int = 20,
    std_ratio: float = 2,
) -> o3d.geometry.PointCloud:
    """
    Downsample, remove statistical outliers, and centre at the origin.
    """
    pcd = pcd.voxel_down_sample(voxel_size=voxel)
    pcd, _ = pcd.remove_statistical_outlier(nb_neighbors, std_ratio)

    xyz_offset = np.asarray(pcd.points).min(axis=0)
    pcd.translate(-xyz_offset)
    print(f"[clean_pointcloud] offset=({xyz_offset[0]:.2f}, {xyz_offset[1]:.2f}, {xyz_offset[2]:.2f})")
    print(f"[clean_pointcloud] {pcd}")
    return pcd


def _occupancy_profile(
    pts: np.ndarray,
    z_min: float,
    z_bin: float,
    n_zbins: int,
    x_min: float,
    y_min: float,
    cell: float,
) -> np.ndarray:
    """
    Count the number of distinct occupied XY cells in each Z slice.

    Returns an (n_zbins,) int array of occupied-cell counts per Z bin.  Multiply
    by cell**2 to get square metres.
    """
    ix = np.floor((pts[:, 0] - x_min) / cell).astype(np.int64)
    iy = np.floor((pts[:, 1] - y_min) / cell).astype(np.int64)
    iz = np.floor((pts[:, 2] - z_min) / z_bin).astype(np.int64)

    inside = (iz >= 0) & (iz < n_zbins)
    ix, iy, iz = ix[inside], iy[inside], iz[inside]
    if len(iz) == 0:
        return np.zeros(n_zbins, dtype=np.int64)

    nx = int(ix.max()) + 1
    ny = int(iy.max()) + 1
    # Collapse each (ix, iy, iz) triple to a single integer key, unique it so
    # every occupied cell counts once, then tally how many fall in each Z bin.
    keys = np.unique((iz * ny + iy) * nx + ix)
    uiz = (keys // (nx * ny)).astype(np.int64)
    return np.bincount(uiz, minlength=n_zbins)[:n_zbins]


def _merge_thin_floors(z_bounds: np.ndarray, min_spacing: float) -> np.ndarray:
    """
    Iteratively remove boundaries that create intervals narrower than
    min_spacing.
      - A thin bottom floor merges upward  (boundary between floor 0 and 1 removed)
      - A thin top floor merges downward   (boundary between top-1 and top removed)
    Stops when all remaining intervals are wide enough or only one floor remains.
    """
    bounds = list(z_bounds)
    while len(bounds) > 2:
        widths = [bounds[i + 1] - bounds[i] for i in range(len(bounds) - 1)]
        if widths[0] < min_spacing:
            bounds.pop(1)       # merge bottom floor into the one above
        elif widths[-1] < min_spacing:
            bounds.pop(-2)      # merge top floor into the one below
        else:
            break
    return np.array(bounds)


def split_floors(
    pcd: o3d.geometry.PointCloud,
    edge_buffer: float = 0.0,
    min_floor_spacing_m: float = 2.8,
    horiz_normal_threshold: float = 0.85,
    cell_size_m: float = 0.20,
    z_bin_m: float = 0.05,
    min_surface_area_m2: float = 5.0,
    floor_area_frac: float = 0.15,
    slab_margin_m: float = 0.15,
    min_room_height_m: float = 1.5,
    debug: bool = False,
    visualize: bool = False,
) -> tuple[list[o3d.geometry.PointCloud], list[dict]]:
    """
    Split a point cloud into per-storey slices using a horizontal-AREA profile.
    """
    pts = np.asarray(pcd.points)
    point_labels = np.full(len(pts), -1, dtype=np.int32)
    z_all = pts[:, 2]
    z_min, z_max = float(z_all.min()), float(z_all.max())
    x_min, y_min = float(pts[:, 0].min()), float(pts[:, 1].min())
    height = z_max - z_min
    if height < 0.5:
        raise ValueError(f"Cloud height {height:.3f} m is too small to split floors.")

    # ── 1. Normals -> horizontal-surface points ─────────────────────────────
    pcd.estimate_normals(
        search_param=o3d.geometry.KDTreeSearchParamHybrid(radius=0.3, max_nn=60)
    )
    normals = np.asarray(pcd.normals)
    horiz_mask = np.abs(normals[:, 2]) > horiz_normal_threshold
    H = pts[horiz_mask]
    if len(H) < 50:
        print("[split_floors] WARNING: too few horizontal-normal points; "
              "returning whole cloud as one floor.")
        return [pcd], [{"z_floor": None, "z_ceiling": None}]

    # ── 2. Occupancy (area) profiles over Z ─────────────────────────────────
    # area_prof : occupied cells from horizontal points -> locates slab surfaces
    # occ_prof  : occupied cells from ALL points        -> detects empty voids
    n_zbins = max(16, int(np.ceil(height / z_bin_m)))
    z_centers = z_min + (np.arange(n_zbins) + 0.5) * z_bin_m
    area_prof = _occupancy_profile(
        H, z_min, z_bin_m, n_zbins, x_min, y_min, cell_size_m
    ).astype(float)
    occ_prof = _occupancy_profile(
        pts, z_min, z_bin_m, n_zbins, x_min, y_min, cell_size_m
    ).astype(float)

    cell_area = cell_size_m * cell_size_m
    min_cells = max(1, int(round(min_surface_area_m2 / cell_area)))
    area_smooth = gaussian_filter1d(area_prof, sigma=1.0)

    # ── 3. One storey datum per floor ───────────────────────────────────────
    floor_dist_bins = max(1, int(round(min_floor_spacing_m / z_bin_m)))
    height_thresh = max(float(min_cells), floor_area_frac * float(area_smooth.max()))
    surf_peaks, _ = find_peaks(
        area_smooth,
        height=height_thresh,
        distance=floor_dist_bins,
        prominence=0.5 * min_cells,
    )
    # Always report every candidate surface for tuning, even the rejected ones.
    raw_peaks, _ = find_peaks(area_smooth, height=min_cells,
                              distance=max(1, int(round(0.4 / z_bin_m))))
    print(f"[split_floors] {len(raw_peaks)} slab surface(s); "
          f"area threshold = {height_thresh * cell_area:.1f} m2:")
    kept = set(surf_peaks.tolist())
    for p in raw_peaks:
        tag = "FLOOR datum" if p in kept else "rejected"
        print(f"    z={float(z_centers[p]):6.2f} m  "
              f"area={area_prof[p] * cell_area:7.1f} m2  -> {tag}")

    if len(surf_peaks) == 0:
        print("[split_floors] WARNING: no floor datums found; one floor.")
        return [pcd], [{"z_floor": None, "z_ceiling": None}]

    floor_levels = [{"z_floor": float(z_centers[p])} for p in sorted(surf_peaks)]

    # ── 4. Bound each storey [floor, next floor]; gap -> floor below ─────────
    raw_z = z_centers[raw_peaks]
    f = [d["z_floor"] for d in floor_levels]
    storey_bounds: list[tuple[float, float]] = []
    for i in range(len(f)):
        low = z_min if i == 0 else f[i] - slab_margin_m
        if i == len(f) - 1:
            high = z_max + 1e-6          # last storey runs to the roof
            ceiling = None
        else:
            f_next = f[i + 1]
            cands = raw_z[(raw_z > f[i] + min_room_height_m)
                          & (raw_z < f_next - slab_margin_m)]
            ceiling = float(cands.max()) if len(cands) else None  # highest = ceiling
            # Extend the slice up to just under the next floor so the gap above
            # the ceiling is captured by this (lower) storey.
            high = f_next - slab_margin_m
        high = max(high, low + 0.1)
        floor_levels[i]["z_ceiling"] = ceiling
        storey_bounds.append((float(low), float(high)))

    print(f"[split_floors] {len(floor_levels)} storey(s):")
    for i, (lo, hi) in enumerate(storey_bounds):
        cz = floor_levels[i]["z_ceiling"]
        cz_s = f"{cz:.2f}" if cz is not None else " n/a"
        print(f"    storey {i + 1}: floor={f[i]:.2f}  ceiling={cz_s}  "
              f"slice=[{lo:.2f}, {hi:.2f}] m")

    # ── 5. Slice; storeys are now contiguous so only points below the first
    floor_pcds: list[o3d.geometry.PointCloud] = []
    floor_meta: list[dict] = []
    for i, (low, high) in enumerate(storey_bounds):
        last = i == len(storey_bounds) - 1
        lo = low + (edge_buffer if i > 0 else 0.0)
        hi = high - (edge_buffer if not last else 0.0)
        mask = (z_all >= lo) & (z_all <= hi) if last else (z_all >= lo) & (z_all < hi)
        idxs = np.where(mask)[0]
        if len(idxs) == 0:
            continue
        point_labels[idxs] = len(floor_pcds)
        floor_pcds.append(pcd.select_by_index(idxs.tolist()))
        floor_meta.append({
            "z_floor": float(f[i]),
            "z_ceiling": floor_levels[i]["z_ceiling"],   # may be None (e.g. attic)
        })
        print(f"[split_floors] Floor {len(floor_pcds)}: z=[{lo:.2f}, {hi:.2f}] m  "
              f"-> {len(idxs):,} points")

    dropped_idx = np.where(point_labels == -1)[0]
    print(
        f"[split_floors] Dropped (label -1): {len(dropped_idx):,} / {len(pts):,} points "
        f"({100.0 * len(dropped_idx) / max(len(pts), 1):.1f}%)"
    )

    if debug:
        bounds_flat = sorted({b for lh in storey_bounds for b in lh})
        debug_floor_profile(
            z_centers, area_prof * cell_area, occ_prof * cell_area,
            surf_peaks, floor_levels, bounds_flat,
        )

    if visualize and floor_pcds:
        extras = []
        if len(dropped_idx):
            grey = o3d.geometry.PointCloud(pcd.select_by_index(dropped_idx.tolist()))
            grey.paint_uniform_color([0.35, 0.35, 0.35])
            extras.append(grey)
        visualize_floors(
            floor_pcds,
            title="Floor split  -  grey = dropped / unassigned",
            extra_geometries=extras if extras else None,
        )

    return floor_pcds, floor_meta


def define_masks(
    pcd,
    normal_knn: int = 40,
    horiz_cos_threshold: float = 0.8,
    slab_tol: float = 0.3,
    wall_cos_threshold: float = 0.2,
    wall_z_margin: float = 0.8,
    roof_cos_min: float = 0.2,
    roof_cos_max: float = 0.985,
):
    # ── 1. Normals ──
    normal_radius = 0.2
    pcd.estimate_normals(
        search_param=o3d.geometry.KDTreeSearchParamHybrid(
            radius=normal_radius, max_nn=normal_knn
        )
    )

    points = np.asarray(pcd.points)
    normals = np.asarray(pcd.normals)

    z = points[:, 2]
    z_min, z_max = float(z.min()), float(z.max())
    floor_height = z_max - z_min

    # ── 2. Floor / ceiling detection ──
    up = np.array([0.0, 0.0, 1.0])
    cosang = normals @ up
    mask_h = np.abs(cosang) > horiz_cos_threshold
    z_h = z[mask_h]

    # Defaults if detection fails
    z_floor, z_ceiling, z_ceiling_min = z_min, z_max, z_max

    if z_h.size < 10:
        print("[define_masks] WARNING: too few horizontal points — using Z extents.")
    else:
        bin_size = 0.05
        n_bins = max(64, int(np.ceil((z_h.max() - z_h.min()) / bin_size)))
        hist, edges = np.histogram(z_h, bins=n_bins)
        bin_centers = 0.5 * (edges[:-1] + edges[1:])
        peaks, _ = find_peaks(hist, prominence=np.max(hist) * 0.1, distance=3)

        if peaks.size == 0:
            print(
                "[define_masks] WARNING: no peaks in horizontal histogram — using Z extents."
            )
        else:
            z_peaks = bin_centers[peaks]
            z_mid_raw = 0.5 * (z_min + z_max)

            floor_peaks = z_peaks[z_peaks < z_mid_raw]
            ceil_peaks  = z_peaks[z_peaks >= z_mid_raw]

            if len(floor_peaks) > 0:
                z_floor = float(floor_peaks.min())
            if len(ceil_peaks) > 0:
                z_ceiling     = float(ceil_peaks.max())   # highest ceiling for band/slab
                z_ceiling_min = float(ceil_peaks.min())   # lowest ceiling for const_height

            if len(ceil_peaks) > 1:
                ceil_str = "  ".join(f"{c:.3f}" for c in np.sort(ceil_peaks))
                print(f"[define_masks] multiple ceiling levels detected: {ceil_str} m")

    # const_height uses the *lowest* detected ceiling so walls in lower-ceiling
    # rooms are not penalised by the taller rooms' height in the z_span filter.
    const_height = float(abs(z_ceiling_min - z_floor) - slab_tol)
    print(
        f"[define_masks] z_floor={z_floor:.3f}  z_ceiling={z_ceiling:.3f}  "
        f"height={const_height:.3f} m"
    )

    # ── 3. Slab candidate mask ──
    floor_band = mask_h & (np.abs(z - z_floor) < slab_tol)
    ceil_band  = mask_h & (np.abs(z - z_ceiling) < slab_tol)
    slab_mask  = floor_band | ceil_band

    # ── 4. Wall candidate mask ──
    # Per-point planarity from the local covariance eigenvalues l0<=l1<=l2:
    #     planarity = (l1 - l0) / l2
    pcd.estimate_covariances(
        search_param=o3d.geometry.KDTreeSearchParamHybrid(
            radius=normal_radius, max_nn=normal_knn
        )
    )
    covs = np.asarray(pcd.covariances)            # (N, 3, 3)
    eigvals = np.linalg.eigvalsh(covs)            # ascending along last axis
    planarity_scores = (eigvals[:, 1] - eigvals[:, 0]) / (eigvals[:, 2] + 1e-9)

    # Keep only highly planar points with near-vertical normals for wall analysis.
    walls_mask = (planarity_scores > 0.7) & (np.abs(cosang) < wall_cos_threshold)
    walls_mask = walls_mask & ~slab_mask

    # Wall Z band: centred on the detected room midpoint, not raw Z extents
    room_height = z_ceiling - z_floor
    band_half   = 0.5 * wall_z_margin * room_height
    z_mid       = 0.5 * (z_floor + z_ceiling)
    walls_mask  = walls_mask & (z >= (z_mid - band_half)) & (z <= (z_mid + band_half))

    # ── 5. Roof candidate mask ──
    # Planar points whose normal tilt is roof-like (between wall and flat).  With
    # roof_cos_max=0.996 this reaches down to ~5 deg slopes (shallow roofs).
    # Planarity gate is
    # intentionally looser than walls (0.3 vs 0.7): real roof surfaces are rougher
    # (tiles, gravel, weathering) and thinner-scanned, so many legitimate roof
    # points fail the stricter wall gate.  The region grower's curvature gate
    # handles the remaining clutter.
    roof_mask = (
        (planarity_scores > 0.3)
        & (np.abs(cosang) > roof_cos_min)
        & (np.abs(cosang) < roof_cos_max)
        & ~floor_band
    )

    slab_dict = {
        "floor_band": floor_band,
        "z_floor": z_floor,
        "ceil_band": ceil_band,
        "z_ceiling": z_ceiling,
    }
    walls_dict = {
        "walls_mask": walls_mask,
        "const_height": const_height,
        "z_floor": z_floor,
        "z_ceiling": z_ceiling,
    }
    roof_dict = {
        "roof_mask": roof_mask,
        "z_floor": z_floor,
        "z_ceiling": z_ceiling,
    }

    return points, normals, walls_dict, slab_dict, roof_dict
