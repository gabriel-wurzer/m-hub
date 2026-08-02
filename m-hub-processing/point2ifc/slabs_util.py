import numpy as np
from vis_util import debug_slabs
from scipy.spatial import Delaunay
from scipy.ndimage import binary_dilation, binary_erosion, binary_fill_holes


def _triangulate_polygon(polygon_xy: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """
    Triangulate a 2D polygon using constrained Delaunay.
    Returns (verts_2d, faces) where faces index into verts_2d.

    Uses the ear-clipping approach via Delaunay + interior point filtering:
    triangulate all polygon vertices, then keep only triangles whose
    centroid lies inside the polygon (filters out exterior triangles).
    """
    from matplotlib.path import Path

    x_range = polygon_xy[:, 0].max() - polygon_xy[:, 0].min()
    y_range = polygon_xy[:, 1].max() - polygon_xy[:, 1].min()
    if x_range < 1e-6 or y_range < 1e-6:
        return polygon_xy, np.empty((0, 3), dtype=int)

    tri = Delaunay(polygon_xy)
    # Centroid of each triangle
    centroids = polygon_xy[tri.simplices].mean(axis=1)  # (M, 2)

    # Keep only triangles whose centroid is inside the polygon boundary
    path = Path(polygon_xy)
    inside = path.contains_points(centroids)

    faces = tri.simplices[inside]
    return polygon_xy, faces


def _grid_to_polygon(
    pts_xy: np.ndarray,
    cell_size: float = 0.15,
    gap_fill_cells: int = 5,
    simplify_tolerance: float = 0.10,
    debug=False,
) -> np.ndarray | None:
    """
    Convert a sparse 2D point cloud into a solid outer boundary polygon.

    Steps:
      1. Rasterise points onto a binary grid at cell_size resolution
      2. Dilate by gap_fill_cells to bridge scanner gaps
      3. Fill any remaining interior holes (binary_fill_holes)
      4. Erode back by gap_fill_cells to restore original footprint size
      5. Trace the outer contour of the filled binary mask
      6. Simplify the contour (reduce vertex count for IFC)

    Returns (N, 2) polygon vertex array, or None on failure.

    cell_size:
        Grid resolution in metres. 0.10–0.20 m works well for 0.1 m voxel.
    gap_fill_cells:
        How many cells to dilate before filling. 5 cells × 0.15 m = 0.75 m
        fill radius — bridges typical scanner shadow gaps in floor coverage.
        Increase if large patches of floor are missing.
    simplify_tolerance:
        Douglas-Peucker tolerance in metres for polygon simplification.
        Keeps the IFC file size reasonable without losing room shape.
    """
    from skimage import measure  # only used here — lightweight contour tracing

    if len(pts_xy) < 4:
        return None

    # ── 1. Rasterise ──────────────────────────────────────────────────────────
    xy_min = pts_xy.min(axis=0) - cell_size
    xy_max = pts_xy.max(axis=0) + cell_size

    nx = int(np.ceil((xy_max[0] - xy_min[0]) / cell_size)) + 1
    ny = int(np.ceil((xy_max[1] - xy_min[1]) / cell_size)) + 1

    grid = np.zeros((ny, nx), dtype=bool)
    ix = np.clip(((pts_xy[:, 0] - xy_min[0]) / cell_size).astype(int), 0, nx - 1)
    iy = np.clip(((pts_xy[:, 1] - xy_min[1]) / cell_size).astype(int), 0, ny - 1)
    grid[iy, ix] = True

    # ── 2. Dilate → fill holes → erode ────────────────────────────────────────
    struct = np.ones((3, 3), dtype=bool)  # 8-connected kernel
    grid_dilated = binary_dilation(grid, structure=struct, iterations=gap_fill_cells)
    grid_filled = binary_fill_holes(grid_dilated)
    grid_restored = binary_erosion(
        grid_filled, structure=struct, iterations=gap_fill_cells
    )

    # Ensure at least some cells remain after erosion
    if not grid_restored.any():
        if debug:
            print(
                "[_grid_to_polygon] Erosion removed all cells — using dilated+filled grid."
            )
        grid_restored = grid_filled

    # ── 3. Trace outer contour ────────────────────────────────────────────────
    # find_contours returns contours in (row, col) = (y, x) order, level=0.5
    contours = measure.find_contours(grid_restored.astype(float), level=0.5)

    if not contours:
        if debug:
            print("[_grid_to_polygon] No contours found.")
        return None

    # Take the longest contour (largest area = outer boundary)
    contour = max(contours, key=len)  # (N, 2) in row,col order

    # Convert grid coords back to world XY
    poly_x = contour[:, 1] * cell_size + xy_min[0]
    poly_y = contour[:, 0] * cell_size + xy_min[1]
    polygon = np.column_stack([poly_x, poly_y])

    # ── 4. Simplify ───────────────────────────────────────────────────────────
    polygon = _simplify_polygon(polygon, tolerance=simplify_tolerance)

    if len(polygon) < 3:
        return None

    x_range = polygon[:, 0].max() - polygon[:, 0].min()
    y_range = polygon[:, 1].max() - polygon[:, 1].min()
    if x_range < 1e-6 or y_range < 1e-6:
        if debug:
            print(f"[_grid_to_polygon] Degenerate polygon (x_range={x_range:.6f}, y_range={y_range:.6f}) — skipped.")
        return None

    return polygon


def _simplify_polygon(polygon: np.ndarray, tolerance: float) -> np.ndarray:
    """
    Douglas-Peucker polygon simplification.
    Reduces vertex count while preserving shape within `tolerance` metres.
    """
    if len(polygon) <= 3:
        return polygon

    def _dp(pts, tol):
        if len(pts) <= 2:
            return pts
        # Find point with max perpendicular distance from line start→end
        start, end = pts[0], pts[-1]
        seg = end - start
        seg_len = np.linalg.norm(seg)
        if seg_len < 1e-9:
            dists = np.linalg.norm(pts - start, axis=1)
        else:
            # Perpendicular distance
            n = np.array([-seg[1], seg[0]]) / seg_len
            dists = np.abs((pts - start) @ n)

        idx = int(np.argmax(dists))
        if dists[idx] > tol:
            left = _dp(pts[: idx + 1], tol)
            right = _dp(pts[idx:], tol)
            return np.vstack([left[:-1], right])
        else:
            return np.array([start, end])

    return _dp(polygon, tolerance)


def extract_slabs(
    points: np.ndarray,
    slab_dict: dict,
    slab_tol: float = 0.3,
    cell_size: float = 0.15,  # grid resolution in metres
    gap_fill_cells: int = 5,  # dilation radius to bridge scanner gaps
    simplify_tolerance: float = 0.10,
    debug=False,
) -> tuple[dict | None, dict | None]:
    """
      Extract solid floor and ceiling slab geometry from a floor point cloud.

    - Rasterises the sparse point coverage onto a 2D grid
    - Dilates to fill scanner gaps, then fills all interior holes
    - Erodes back to original footprint size
    - Traces the outer boundary polygon
    - Triangulates the solid polygon interior

      Returns (floor_slab, ceil_slab), each a dict with keys:
          verts: np.ndarray (N, 3)
          faces: np.ndarray (M, 3)
          z:     float
          name:  str
      Either may be None if extraction fails.
    """
    floor_band = slab_dict["floor_band"]
    z_floor = slab_dict["z_floor"]
    ceil_band = slab_dict["ceil_band"]
    z_ceiling = slab_dict["z_ceiling"]

    if debug:
        debug_slabs(points, floor_band, ceil_band)

    results = []
    for band, z_val, label in [
        (floor_band, z_floor, "Floor"),
        (ceil_band, z_ceiling, "Ceiling"),
    ]:
        pts = points[band]
        if len(pts) < 10:
            print(f"[extract_slabs] {label}: too few points ({len(pts)}) — skipped.")
            results.append(None)
            continue

        pts_xy = pts[:, :2]

        # Build solid boundary polygon via grid dilation
        polygon = _grid_to_polygon(
            pts_xy,
            cell_size=cell_size,
            gap_fill_cells=gap_fill_cells,
            simplify_tolerance=simplify_tolerance,
            debug=debug,
        )

        if polygon is None:
            print(f"[extract_slabs] {label}: boundary extraction failed — skipped.")
            results.append(None)
            continue

        # Triangulate the solid polygon
        verts_2d, faces = _triangulate_polygon(polygon)

        if len(faces) == 0:
            print(
                f"[extract_slabs] {label}: triangulation produced no faces — skipped."
            )
            results.append(None)
            continue

        # Restore Z
        verts = np.column_stack([verts_2d, np.full(len(verts_2d), float(z_val))])

        print(
            f"[extract_slabs] {label}: {len(polygon)} boundary pts → "
            f"{len(verts)} verts, {len(faces)} faces, z={z_val:.3f} m"
        )

        results.append(
            {
                "polygon": polygon,
                "verts": [verts.astype(float).tolist()],
                "faces": [faces.astype(int).tolist()],
                "z": float(z_val),
                "name": label,
            }
        )

    return results[0], results[1]
