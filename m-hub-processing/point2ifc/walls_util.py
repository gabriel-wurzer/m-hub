import numpy as np
import open3d as o3d
from collections import defaultdict
from sklearn.cluster import HDBSCAN
from sklearn.neighbors import NearestNeighbors
from scipy.signal import find_peaks
from scipy.ndimage import gaussian_filter1d
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import connected_components
from vis_util import (
    debug_wall_polygons,
    debug_orientation_histogram,
    debug_angle_groups,
)


def _cluster_aspect_ratio(pts: np.ndarray) -> float:
    """
    PCA aspect ratio of a cluster in XY: ratio of longest to shortest axis.
    A wall is long and thin → high ratio (e.g. 10–50).
    A furniture blob is compact → low ratio (e.g. 1–3).
    """
    if len(pts) < 3:
        return 1.0
    pts_xy = pts[:, :2]
    mean = pts_xy.mean(axis=0)
    _, sv, _ = np.linalg.svd(pts_xy - mean, full_matrices=False)
    if sv[1] < 1e-9:
        return float("inf")
    return float(sv[0] / sv[1])


def _ransac_line_2d(
    pts_xy: np.ndarray,
    inlier_thresh: float = 0.15,
    n_iter: int = 200,
) -> tuple:
    """
    Fit a 2-D line to pts_xy using RANSAC then SVD-refit on inliers.

    Returns the direction of the majority line, a point on it, and a boolean
    inlier mask.  Falls back to plain SVD when too few points are available.

    Parameters
    ----------
    pts_xy       : (M, 2) XY coordinates
    inlier_thresh: max perpendicular distance (m) for a point to be an inlier.
                   0.15 m works well at 0.10 m voxel size.
    n_iter       : number of RANSAC iterations

    Returns
    -------
    wall_dir  : (2,) unit tangent vector of the majority line
    pt_on_line: (2,) a point on that line (centroid of inliers)
    inliers   : (M,) bool mask — True for points within inlier_thresh
    """
    n = len(pts_xy)
    if n < 2:
        # degenerate — return horizontal direction, all inliers
        return np.array([1.0, 0.0]), pts_xy.mean(axis=0), np.ones(n, dtype=bool)

    best_inliers = np.zeros(n, dtype=bool)
    rng = np.random.default_rng(seed=0)  # deterministic

    for _ in range(n_iter):
        i, j = rng.choice(n, 2, replace=False)
        d = pts_xy[j] - pts_xy[i]
        d_len = np.linalg.norm(d)
        if d_len < 1e-9:
            continue
        d /= d_len
        perp = np.array([-d[1], d[0]])  # unit normal to candidate line
        dists = np.abs((pts_xy - pts_xy[i]) @ perp)
        inliers = dists < inlier_thresh
        if inliers.sum() > best_inliers.sum():
            best_inliers = inliers

    # If RANSAC found too few inliers, fall back to all points
    if best_inliers.sum() < max(2, int(0.3 * n)):
        best_inliers = np.ones(n, dtype=bool)

    # SVD refit on inlier set for maximum direction accuracy
    inlier_pts = pts_xy[best_inliers]
    mean_xy = inlier_pts.mean(axis=0)
    _, _, Vt = np.linalg.svd(inlier_pts - mean_xy, full_matrices=False)
    wall_dir = Vt[0]  # long axis = tangent

    return wall_dir, mean_xy, best_inliers


def wall_sweep_params(
    cluster_pts,
    wall_nrm_hint,
    extent_percentile: float = 2.0,
    default_thickness: float = 0.2,
):
    """
    Extract swept-solid wall parameters from a cluster of wall points.

    Parameters
    ----------
    cluster_pts       : (M, 3) world 3-D points for one wall cluster
    wall_nrm_hint     : (2,)   XY unit normal hint from the orientation group
    extent_percentile : percentile clip at each end (same as corner fitting)
    default_thickness : minimum / default wall thickness in metres

    Returns
    -------
    dict with keys:
        start_pt   (3,) – world XY start of wall reference line, z = z_base
        end_pt     (3,) – world XY end   of wall reference line, z = z_base
        length     float – wall span along the tangent axis (m)
        height     float – wall Z span (m)
        thickness  float – wall depth in the normal direction (m)
        z_base     float – base (bottom) elevation
        wall_nrm   (2,) – XY unit normal (PCA-derived, sign-corrected)
    """
    pts = np.asarray(cluster_pts, dtype=float)
    pts_xy = pts[:, :2]
    hint = np.asarray(wall_nrm_hint, dtype=float)
    hint = hint / (np.linalg.norm(hint) + 1e-9)

    # ── RANSAC line fit on XY positions ─────────────────────────────────────
    wall_dir, _, inliers = _ransac_line_2d(pts_xy)
    wall_nrm = np.array([-wall_dir[1], wall_dir[0]])  # 90° rotation

    # Sign-resolve: normal must agree with orientation-group hint
    if np.dot(wall_nrm, hint) < 0:
        wall_nrm = -wall_nrm
        wall_dir = -wall_dir

    # Use only inlier points for extent measurements so that stray points at
    # corners or on adjacent surfaces don't stretch the wall bounds
    inlier_pts_xy = pts_xy[inliers]
    inlier_pts_z = pts[inliers, 2]

    p = float(np.clip(extent_percentile, 0.0, 49.0))

    # ── Tangent span → length (from inliers) ────────────────────────────────
    t = inlier_pts_xy @ wall_dir
    t_min = float(np.percentile(t, p))
    t_max = float(np.percentile(t, 100 - p))
    length = t_max - t_min

    # ── Normal span → thickness (from inliers) ───────────────────────────────
    n = inlier_pts_xy @ wall_nrm
    n_lo = float(np.percentile(n, p))
    n_hi = float(np.percentile(n, 100 - p))
    n_ref = float(np.median(n))  # reference face
    thickness = max(default_thickness, n_hi - n_lo)

    # ── Z span → height and base elevation (from inliers) ───────────────────
    z_base = float(np.percentile(inlier_pts_z, p))
    z_top = float(np.percentile(inlier_pts_z, 100 - p))
    height = z_top - z_base

    # ── Reference-line start / end in world XY ───────────────────────────────
    start_xy = t_min * wall_dir + n_ref * wall_nrm
    end_xy = t_max * wall_dir + n_ref * wall_nrm

    return {
        "start_pt": np.array([start_xy[0], start_xy[1], z_base]),
        "end_pt": np.array([end_xy[0], end_xy[1], z_base]),
        "length": float(length),
        "height": float(height),
        "thickness": float(thickness),
        "z_base": float(z_base),
        "wall_nrm": wall_nrm,
    }


def _segment_models_from_labels(
    points_xy: np.ndarray,
    labels: np.ndarray,
    wall_nrm: np.ndarray,
) -> dict[int, dict]:
    """Build simple geometric models for each labelled wall segment."""
    wall_nrm = np.asarray(wall_nrm, dtype=float)
    wall_nrm = wall_nrm / (np.linalg.norm(wall_nrm) + 1e-9)
    wall_dir = np.array([-wall_nrm[1], wall_nrm[0]])

    models = {}
    for lab in np.unique(labels):
        if lab < 0:
            continue
        pts = points_xy[labels == lab]
        if len(pts) == 0:
            continue
        perp_vals = pts @ wall_nrm
        tang_vals = pts @ wall_dir
        models[int(lab)] = {
            "rho": float(np.median(perp_vals)),
            "t_min": float(tang_vals.min()),
            "t_max": float(tang_vals.max()),
        }
    return models


def split_cluster_by_gap(
    cluster_pts: np.ndarray,
    wall_tan: np.ndarray,
    max_gap_m: float = 0.8,
) -> list:
    """
    Split a wall cluster at any tangential gap larger than *max_gap_m*.

    Parameters
    ----------
    cluster_pts : (M, 3) points of one HDBSCAN cluster
    wall_tan    : (2,)   unit tangent vector along the wall face
    max_gap_m   : gap threshold in metres.  Typical values:
                    0.8 m  — splits at standard doorways (0.9 m clear width)
                    1.2 m  — only splits at wide openings / room breaks
                  Keep below the minimum expected wall segment length.

    Returns
    -------
    list of (K, 3) arrays — one entry per sub-cluster (at least one entry).
    """
    pts = np.asarray(cluster_pts, dtype=float)
    t = pts[:, :2] @ wall_tan  # scalar tangent coordinate per point
    order = np.argsort(t)
    t_sorted = t[order]

    gaps = np.diff(t_sorted)
    split_at = np.where(gaps > max_gap_m)[0]

    if len(split_at) == 0:
        return [pts]

    sub_clusters = []
    prev = 0
    for idx in split_at:
        sub_clusters.append(pts[order[prev : idx + 1]])
        prev = idx + 1
    sub_clusters.append(pts[order[prev:]])
    return sub_clusters


def label_walls_to_angles(
    masked_points,
    masked_normals,
    orientation_min_frac: float = 0.025,
    visualize: bool = False,
):
    # ── 1. Orientation histogram on confident wall normals ───────────────────
    xy_norms = np.linalg.norm(masked_normals[:, :2], axis=1)
    conf_mask = xy_norms > 0.7
    horiz_angles = (
        np.degrees(
            np.arctan2(masked_normals[conf_mask, 1], masked_normals[conf_mask, 0])
        )
        % 180
    )

    hist, bin_edges = np.histogram(horiz_angles, bins=180, range=(0.0, 180.0))
    bin_centers_ang = 0.5 * (bin_edges[:-1] + bin_edges[1:])

    # Circular peak detection: pad both ends so the 0°/180° boundary becomes
    # an interior point.  find_peaks cannot detect a peak at bin 0 because it
    # has no left neighbour; wrapping fixes that.
    _wrap = 20
    hist_padded = np.concatenate([hist[-_wrap:], hist, hist[:_wrap]])
    hist_smooth_padded = gaussian_filter1d(hist_padded.astype(float), sigma=2)
    # Centre slice used for visualisation (same shape as original histogram)
    hist_smooth = hist_smooth_padded[_wrap:-_wrap]

    total_pts = float(len(masked_points))
    prom_threshold = max(3.0, orientation_min_frac * total_pts)

    peaks_padded, _ = find_peaks(
        hist_smooth_padded,
        height=total_pts * 0.02,
        distance=10,
        prominence=prom_threshold,
    )

    # Map padded indices back to [0, 180) and deduplicate.
    # A boundary peak (e.g. at 1° or 178°) may appear in both the wrapped pad
    # and the centre region; % 180 collapses them to the same bin.
    seen_keys: set[int] = set()
    peaks_list: list[int] = []
    for p in peaks_padded:
        orig = int((p - _wrap) % 180)
        key = int(bin_centers_ang[orig] + 0.5)  # round to nearest degree
        if key not in seen_keys:
            seen_keys.add(key)
            peaks_list.append(orig)
    peaks = np.array(sorted(set(peaks_list)), dtype=int)

    peak_angles = bin_centers_ang[peaks] if len(peaks) > 0 else np.array([0.0, 90.0])
    print(f"[extract_walls] orientation peaks: {[f'{a:.0f}°' for a in peak_angles]}")

    # Voronoi angle labels — circular distance so points near 0°/180° wrap
    # correctly instead of being pulled toward the wrong peak.
    all_horiz_angles = (
        np.degrees(np.arctan2(masked_normals[:, 1], masked_normals[:, 0])) % 180
    )
    _diffs = np.abs(all_horiz_angles[:, np.newaxis] - peak_angles[np.newaxis, :])
    _diffs = np.minimum(_diffs, 180.0 - _diffs)  # wrap-around distance
    angle_labels = np.argmin(_diffs, axis=1).astype(np.int32)

    if visualize:
        debug_orientation_histogram(
            hist_smooth, bin_centers_ang, peaks, peak_angles, prom_threshold
        )
        debug_angle_groups(masked_points, angle_labels, peak_angles)

    return peak_angles, angle_labels

def cluster_wall_find_geometry(masked_points, peak_angles, angle_labels, visualize:bool = False):
    walls = []
    all_pts_list = []
    all_lbl_list = []
    drop_pts = drop_height = drop_aspect = drop_length = 0
    global_label_offset = 0

    for grp_idx, peak_ang in enumerate(peak_angles):
        mask_g = angle_labels == grp_idx
        P_g = masked_points[mask_g]

        if len(P_g) < 30:
            print(f"  group {grp_idx} ({peak_ang:.0f}°): only {len(P_g)} pts, skipping")
            continue

        # Representative wall normal for this orientation group
        ang_rad = np.radians(peak_ang)
        mean_nrm = np.array([np.cos(ang_rad), np.sin(ang_rad), 0.0])

        # Cluster within this orientation group using XY coordinates only
        labels_g = (
            HDBSCAN(
                min_cluster_size=30,
                min_samples=5,
                cluster_selection_epsilon=0.3,
                copy=False,
            )
            .fit(P_g[:, :2])
            .labels_
        )

        unique_labels = [lbl for lbl in np.unique(labels_g) if lbl >= 0]

        # Tangent direction for this orientation group (90° from normal)
        wall_tan = np.array([-mean_nrm[1], mean_nrm[0]])

        # Split each HDBSCAN cluster at large tangential gaps (doorways, windows)
        sub_cluster_groups = []
        for lbl in unique_labels:
            cluster_mask = labels_g == lbl
            subs = split_cluster_by_gap(
                P_g[cluster_mask], wall_tan, max_gap_m=0.8
            )
            sub_cluster_groups.extend(subs)

        n_after_split = len(sub_cluster_groups)
        print(
            f"  group {grp_idx} ({peak_ang:.0f}°): {len(P_g)} pts"
            f"  → {len(unique_labels)} HDBSCAN cluster(s)"
            f"  → {n_after_split} after gap split"
        )

        for seg_idx, cluster_pts in enumerate(sub_cluster_groups):
            all_pts_list.append(cluster_pts)
            all_lbl_list.append(np.full(len(cluster_pts), global_label_offset))
            global_label_offset += 1

            if len(cluster_pts) < 10:
                drop_pts += 1
                continue

            pt_z_span = float(cluster_pts[:, 2].max() - cluster_pts[:, 2].min())
            if pt_z_span < 0.5:
                drop_height += 1
                if len(cluster_pts) > 100:
                    print(
                        f"  drop grp{grp_idx}/seg{seg_idx}: height {pt_z_span:.2f} m"
                        f"  pts={len(cluster_pts)}"
                    )
                continue

            wall_nrm_xy = mean_nrm[:2].copy()
            wall_nrm_xy /= np.linalg.norm(wall_nrm_xy) + 1e-9

            aspect = _cluster_aspect_ratio(cluster_pts)
            if aspect < 3.0:
                drop_aspect += 1
                if len(cluster_pts) > 100:
                    print(
                        f"  drop grp{grp_idx}/seg{seg_idx}: aspect {aspect:.1f}"
                        f"  pts={len(cluster_pts)}"
                    )
                continue

            sweep = wall_sweep_params(
                cluster_pts,
                wall_nrm_xy,
                extent_percentile=2.0,
            )
            if sweep["length"] < 0.5:
                drop_length += 1
                if len(cluster_pts) > 100:
                    print(
                        f"  drop grp{grp_idx}/seg{seg_idx}: length {sweep['length']:.2f} m"
                        f"  pts={len(cluster_pts)}"
                    )
                continue

            walls.append(
                {
                    "start_pt": sweep["start_pt"],
                    "end_pt": sweep["end_pt"],
                    "length": sweep["length"],
                    "height": sweep["height"],
                    "thickness": sweep["thickness"],
                    "z_base": sweep["z_base"],
                    "wall_nrm": sweep["wall_nrm"],
                    "pt_z_span": pt_z_span,
                }
            )

    print(
        f"  → accepted={len(walls)}"
        f"  dropped: pts<10={drop_pts}"
        f"  height<{0.5}m={drop_height}"
        f"  aspect<{3.0}={drop_aspect}"
        f"  length<{0.5}m={drop_length}"
    )

    if visualize and all_pts_list:
        debug_wall_polygons(
            np.vstack(all_pts_list),
            np.concatenate(all_lbl_list),
            walls,
        )
    return walls


def _point_curvature(points: np.ndarray, radius: float, k: int) -> np.ndarray:
    """
    Surface-variation curvature per point: l0 / (l0 + l1 + l2) of the local
    covariance eigenvalues.  ~0 on a flat patch, high on edges/corners.
    """
    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(points)
    pcd.estimate_covariances(
        search_param=o3d.geometry.KDTreeSearchParamHybrid(radius=radius, max_nn=k)
    )
    ev = np.linalg.eigvalsh(np.asarray(pcd.covariances))   # ascending
    return ev[:, 0] / (ev.sum(axis=1) + 1e-12)


def region_grow_planar_segments(
    points: np.ndarray,
    normals: np.ndarray,
    k: int = 16,
    radius: float = 0.30,
    normal_thresh_deg: float = 25.0,
    plane_tol_m: float = 0.12,
    curvature_max: float = 0.035,
    min_segment_pts: int = 20,
) -> np.ndarray:
    """
    Connectivity-aware planar segmentation via a curvature-gated normal graph.

    This replaces the global orientation-angle histogram, which assumed a
    Manhattan world (a few dominant wall directions).  Region growing makes no
    such assumption: a wall at 37 degrees is found exactly like one at 0, so
    angled wings / bay windows / off-axis clouds segment correctly.

    Method (a fast, vectorised form of PCL-style region growing):
      1. Build a k-NN graph over the 3-D points.
      2. Compute per-point curvature; mark low-curvature points as "flat".
      3. Keep an edge i-j only when BOTH points are flat AND their normals agree
         (|n_i . n_j| >= cos(normal_thresh_deg); abs is sign-invariant since the
         normals are not consistently oriented) AND they are co-planar
         (|(p_i - p_j) . n_i| <= plane_tol_m).
      4. Connected components of that graph are the planar segments.

    Why the curvature gate matters: normal estimation averages across a sharp
    corner, creating a smooth 0->90deg gradient of in-between normals.  A pure
    pairwise-normal test lets connectivity "chain" through that gradient and
    fuse two perpendicular walls into one L-shaped segment.  Corner/edge points
    have high curvature, so excluding them from the graph cuts the chain: the
    two walls become separate segments and the dropped corner points are
    rebuilt later by extend_walls_to_corners.

    Returns an (N,) int array of segment labels; -1 for corner points and for
    components smaller than ``min_segment_pts``.
    """
    n = len(points)
    if n < min_segment_pts:
        return np.full(n, -1, dtype=np.int32)

    curv = _point_curvature(points, radius=radius, k=k)
    flat = curv < curvature_max

    nn = NearestNeighbors(n_neighbors=min(k, n)).fit(points)
    dist, idx = nn.kneighbors(points)

    src = np.repeat(np.arange(n), idx.shape[1])
    dst = idx.ravel()
    d = dist.ravel()

    valid = (src != dst) & (d <= radius)
    src, dst, d = src[valid], dst[valid], d[valid]

    # Edge tests: both endpoints flat, normals agree, and co-planar.
    dotn = np.abs(np.einsum("ij,ij->i", normals[src], normals[dst]))
    diff = points[src] - points[dst]
    plane_d = np.abs(np.einsum("ij,ij->i", diff, normals[src]))
    cos_t = np.cos(np.radians(normal_thresh_deg))
    keep = (
        flat[src] & flat[dst]
        & (dotn >= cos_t)
        & (plane_d <= plane_tol_m)
    )
    src, dst = src[keep], dst[keep]

    adj = csr_matrix(
        (np.ones(len(src), dtype=np.uint8), (src, dst)), shape=(n, n)
    )
    n_comp, raw = connected_components(adj, directed=False)

    # Drop tiny components and relabel the survivors 0..M-1.
    counts = np.bincount(raw, minlength=n_comp)
    labels = np.full(n, -1, dtype=np.int32)
    next_lab = 0
    for c in range(n_comp):
        if counts[c] >= min_segment_pts:
            labels[raw == c] = next_lab
            next_lab += 1

    print(f"[region_grow] curvature gate: {int(flat.sum()):,}/{n:,} flat pts "
          f"(corner/edge points excluded)")

    print(
        f"[region_grow] {n:,} pts -> {n_comp} raw component(s) -> "
        f"{next_lab} segment(s) (>= {min_segment_pts} pts)"
    )

    # ── Recover residual points (curvature-excluded + small components) ─────
    # The curvature gate is deliberately aggressive, so it also discards noise-
    # curvature points on otherwise-flat walls, leaving holes.  Assign every
    # unlabeled point to its nearest already-labelled neighbour whose normal
    # agrees.  This refills walls WITHOUT re-bridging corners: a point joining a
    # segment does not connect two segments to each other.
    if next_lab > 0:
        # Loose threshold (~45 deg): a corner point landing on the "wrong" wall
        # is harmless because assignment does not reconnect two segments.
        labels = _propagate_labels(points, normals, labels, radius,
                                   normal_thresh_deg + 20.0)
    return labels


def _propagate_labels(
    points: np.ndarray,
    normals: np.ndarray,
    labels: np.ndarray,
    radius: float,
    thresh_deg: float,
    k: int = 8,
    n_rounds: int = 4,
) -> np.ndarray:
    """
    Grow existing segment labels onto unlabelled points by nearest-labelled-
    neighbour vote with a normal-agreement gate.  Iterated so points deep inside
    a hole get reached once their rim is filled.  Points with no agreeing
    labelled neighbour within ``radius`` stay -1 (genuine noise).
    """
    cos_t = np.cos(np.radians(thresh_deg))
    n_before = int((labels < 0).sum())
    for _ in range(n_rounds):
        un = np.where(labels < 0)[0]
        lab = np.where(labels >= 0)[0]
        if len(un) == 0 or len(lab) == 0:
            break
        nbrs = NearestNeighbors(n_neighbors=min(k, len(lab))).fit(points[lab])
        d, idx = nbrs.kneighbors(points[un])          # sorted by distance
        neigh = lab[idx]                              # (U, k) global indices
        dots = np.abs(np.einsum("uc,ukc->uk", normals[un], normals[neigh]))
        ok = (d <= radius) & (dots >= cos_t)
        first = np.argmax(ok, axis=1)                 # first (nearest) ok column
        has = ok[np.arange(len(un)), first]
        winners = neigh[np.arange(len(un)), first]
        new = np.where(has, labels[winners], -1)
        if not has.any():
            break
        labels[un] = np.where(has, new, labels[un])

    recovered = n_before - int((labels < 0).sum())
    print(f"[propagate] recovered {recovered:,} residual pts; "
          f"{int((labels < 0).sum()):,} remain unlabelled")
    return labels


def _segment_normal_hint(seg_pts: np.ndarray) -> np.ndarray | None:
    """
    XY plane-normal of a segment from PCA (direction of least variance).

    PCA is used instead of averaging per-point normals because the point
    normals are not consistently oriented (define_masks does not flip them), so
    their mean can cancel.  Returns a unit XY vector, or None if the plane is
    too horizontal to be a wall.
    """
    if len(seg_pts) < 3:
        return None
    c = seg_pts - seg_pts.mean(axis=0)
    _, _, Vt = np.linalg.svd(c, full_matrices=False)
    n_plane = Vt[2]                      # smallest-variance direction = normal
    hint = n_plane[:2]
    nh = float(np.linalg.norm(hint))
    if nh < 1e-6:
        return None                      # near-horizontal plane, not a wall
    return hint / nh


def _wall_from_cluster(
    cluster_pts: np.ndarray,
    hint_xy: np.ndarray,
    min_pts: int = 10,
    min_z_span: float = 0.5,
    min_aspect: float = 3.0,
    min_length: float = 0.5,
):
    """
    Turn one (already-split) wall cluster into a wall dict, or reject it.

    Same acceptance tests as the legacy path (point count, vertical span,
    PCA aspect ratio, swept length) so downstream IFC geometry is unchanged.
    Returns (wall_dict, None) on success or (None, reason) on rejection.
    """
    if len(cluster_pts) < min_pts:
        return None, "pts"
    pt_z_span = float(cluster_pts[:, 2].max() - cluster_pts[:, 2].min())
    if pt_z_span < min_z_span:
        return None, "height"
    if _cluster_aspect_ratio(cluster_pts) < min_aspect:
        return None, "aspect"
    sweep = wall_sweep_params(cluster_pts, hint_xy, extent_percentile=2.0)
    if sweep["length"] < min_length:
        return None, "length"
    return {
        "start_pt": sweep["start_pt"],
        "end_pt": sweep["end_pt"],
        "length": sweep["length"],
        "height": sweep["height"],
        "thickness": sweep["thickness"],
        "z_base": sweep["z_base"],
        "wall_nrm": sweep["wall_nrm"],
        "pt_z_span": pt_z_span,
    }, None


def segments_to_walls(
    masked_points: np.ndarray,
    seg_labels: np.ndarray,
    visualize: bool = False,
) -> list[dict]:
    """
    Build wall geometry from planar segments.

    For each segment: derive the wall tangent from its PCA normal, split at wide
    tangential gaps (doorways/windows) exactly as the legacy path did, then fit
    swept-solid parameters per sub-cluster.
    """
    walls: list[dict] = []
    all_pts_list, all_lbl_list = [], []
    drops: dict[str, int] = defaultdict(int)
    global_label_offset = 0

    for lab in np.unique(seg_labels):
        if lab < 0:
            continue
        seg_pts = masked_points[seg_labels == lab]
        if len(seg_pts) < 30:
            continue

        hint = _segment_normal_hint(seg_pts)
        if hint is None:
            drops["horizontal"] += 1
            continue
        wall_tan = np.array([-hint[1], hint[0]])

        for sub in split_cluster_by_gap(seg_pts, wall_tan, max_gap_m=0.8):
            all_pts_list.append(sub)
            all_lbl_list.append(np.full(len(sub), global_label_offset))
            global_label_offset += 1

            wall, reason = _wall_from_cluster(sub, hint)
            if wall is None:
                drops[reason] += 1
                continue
            # Carry the supporting points so a later direction snap/merge can be
            # validated against the evidence it was fitted from (anchor_walls_to_evidence).
            wall["src_pts"] = sub
            walls.append(wall)

    drop_str = "  ".join(f"{k}={v}" for k, v in sorted(drops.items()))
    print(f"[segments_to_walls] accepted={len(walls)}  dropped: {drop_str or 'none'}")

    if visualize and all_pts_list:
        debug_wall_polygons(
            np.vstack(all_pts_list),
            np.concatenate(all_lbl_list),
            walls,
        )
    return walls


def _dominant_wall_angles(walls: list[dict]) -> np.ndarray:
    """Unique wall-normal orientations (deg, mod 180) for reporting / compat."""
    if not walls:
        return np.array([])
    angs = np.array([
        np.degrees(np.arctan2(w["wall_nrm"][1], w["wall_nrm"][0])) % 180
        for w in walls
    ])
    return np.unique(np.round(angs).astype(int)).astype(float)


def _union_src(ws: list[dict]) -> np.ndarray:
    """Concatenate the carried supporting points of several walls (anchor evidence)."""
    arrs = [w["src_pts"] for w in ws
            if w.get("src_pts") is not None and len(w["src_pts"])]
    return np.vstack(arrs) if arrs else np.empty((0, 3))


def merge_wall_fragments(
    walls: list[dict],
    angle_tol_deg: float = 12.0,
    n_tol_m: float = 0.20,
    merge_gap_m: float = 0.8,
    height_tol_m: float = 3.0,
    max_base_jump_m: float = 1.2,
    storey_floor: float | None = None,
    storey_ceiling: float | None = None,
) -> list[dict]:
    """
    Stitch collinear wall fragments back into whole walls.

    The curvature-gated region growing is deliberately aggressive so it breaks
    at every corner; the side effect is that a single straight wall fragments
    wherever local noise raises curvature.  This pass reverses that
    fragmentation WITHOUT a Manhattan assumption:

      1. Group walls by orientation with an angular *tolerance* (any absolute
         angle, so 37 deg fragments cluster with other 37 deg fragments).
      2. Within a group, single-linkage cluster by normal offset -> walls on the
         same infinite line.  This is what stops two DIFFERENT coplanar walls in
         separate rooms from merging: they share orientation but have different
         offsets unless genuinely collinear.
      3. Along each line, merge fragments whose tangential gap <= merge_gap_m and
         whose height bands are compatible.

    Merging onto the group's mean orientation also snaps near-parallel fragments
    exactly parallel, cleaning up the output.

    Opening guards: a lintel (piece whose base sits far above its neighbour's,
    ``max_base_jump_m``) and a spandrel (low stub entirely below the room
    midline, requires ``storey_floor``/``storey_ceiling``) must NOT be absorbed
    into the adjacent full-height run — that would wall the doorway/window
    shut.  They are kept separate here and consumed by ``fuse_wall_openings``,
    which turns the stack into one wall with an IfcOpeningElement-able opening.
    """
    if len(walls) < 2:
        return walls

    z_mid_room = (0.5 * (storey_floor + storey_ceiling)
                  if storey_floor is not None and storey_ceiling is not None
                  else None)

    def is_low_stub(z_base, z_top):
        # spandrel-like: short and entirely in the lower half of the room.
        # A furniture-occluded fragment of a real wall still reaches above the
        # room midline, so it is not caught by this.
        if z_mid_room is None:
            return False
        return (z_top - z_base) < 1.5 and z_top < z_mid_room

    def wall_angle(w):
        return float(np.degrees(np.arctan2(w["wall_nrm"][1], w["wall_nrm"][0])) % 180.0)

    def circ_diff(a, b):
        d = abs(a - b) % 180.0
        return min(d, 180.0 - d)

    # ── 1. Greedy circular clustering by orientation (tolerance-based) ───────
    order = sorted(range(len(walls)), key=lambda i: wall_angle(walls[i]))
    groups: list[dict] = []
    for i in order:
        a = wall_angle(walls[i])
        best = next((g for g in groups if circ_diff(a, g["mean"]) <= angle_tol_deg), None)
        if best is None:
            groups.append({"angles": [a], "mean": a, "walls": [walls[i]]})
        else:
            best["walls"].append(walls[i])
            best["angles"].append(a)
            best["mean"] = float(np.mean(best["angles"]))

    merged: list[dict] = []
    for g in groups:
        ang = g["mean"]
        rad = np.radians(ang)
        nrm_ref = np.array([np.cos(rad), np.sin(rad)])
        dir_ref = np.array([-np.sin(rad), np.cos(rad)])

        data = []
        for w in g["walls"]:
            n_ref = float(np.dot(w["start_pt"][:2], nrm_ref))
            t_s = float(np.dot(w["start_pt"][:2], dir_ref))
            t_e = float(np.dot(w["end_pt"][:2], dir_ref))
            if t_s > t_e:
                t_s, t_e = t_e, t_s
            data.append((n_ref, t_s, t_e, w))

        # ── 2. Single-linkage on normal offset = collinear lines ────────────
        data.sort(key=lambda x: x[0])
        lines = [[data[0]]]
        for entry in data[1:]:
            if entry[0] - lines[-1][-1][0] <= n_tol_m:
                lines[-1].append(entry)
            else:
                lines.append([entry])

        # ── 3. Merge runs along each line by tangent gap + height band ──────
        for line in lines:
            line.sort(key=lambda x: x[1])
            runs = [[line[0]]]
            for entry in line[1:]:
                prev = runs[-1][-1]
                tang_gap = entry[1] - prev[2]
                run_walls = [e[3] for e in runs[-1]]
                run_z_base = min(w["z_base"] for w in run_walls)
                run_z_top = max(w["z_base"] + w["height"] for w in run_walls)
                e_z_base = entry[3]["z_base"]
                e_z_top = e_z_base + entry[3]["height"]
                # Loose by design: input is already one floor, so this is only a
                # within-storey sanity bound (fragments of one wall often capture
                # different vertical extents), not a cross-floor guard.
                z_ok = (abs(e_z_base - run_z_base) <= height_tol_m
                        and abs(e_z_top - run_z_top) <= height_tol_m)
                # Opening guards: never absorb a lintel (base jump) or a
                # spandrel (low stub) into a full-height run.
                z_ok = z_ok and abs(e_z_base - run_z_base) <= max_base_jump_m
                z_ok = z_ok and (is_low_stub(e_z_base, e_z_top)
                                 == is_low_stub(run_z_base, run_z_top))
                if tang_gap <= merge_gap_m and z_ok:
                    runs[-1].append(entry)
                else:
                    runs.append([entry])

            for run in runs:
                t_min = min(e[1] for e in run)
                t_max = max(e[2] for e in run)
                n_avg = float(np.mean([e[0] for e in run]))
                ws = [e[3] for e in run]
                z_base = min(w["z_base"] for w in ws)
                z_top = max(w["z_base"] + w["height"] for w in ws)
                start_xy = t_min * dir_ref + n_avg * nrm_ref
                end_xy = t_max * dir_ref + n_avg * nrm_ref
                merged.append({
                    "start_pt": np.array([start_xy[0], start_xy[1], z_base]),
                    "end_pt": np.array([end_xy[0], end_xy[1], z_base]),
                    "length": t_max - t_min,
                    "height": z_top - z_base,
                    "thickness": max(w["thickness"] for w in ws),
                    "z_base": z_base,
                    "wall_nrm": nrm_ref.copy(),
                    "pt_z_span": max(w["pt_z_span"] for w in ws),
                    "peak_angle_deg": ang,
                    "src_pts": _union_src(ws),
                })

    print(f"[merge_fragments] {len(walls)} -> {len(merged)} walls  "
          f"(angle_tol={angle_tol_deg} n_tol={n_tol_m} gap={merge_gap_m})")
    return merged


def merge_parallel_faces(
    walls: list[dict],
    angle_tol_deg: float = 12.0,
    max_thickness_m: float = 0.40,
    min_extent_iou: float = 0.40,
) -> list[dict]:
    """
    Collapse the two (or more) scanned faces of a single thick wall into one.

    A scanner sees both sides of a wall as two parallel point sheets a wall-
    thickness apart, so the 2-D line extractor reports them as separate
    near-parallel segments.  This merges segments that are:
      - nearly parallel (within ``angle_tol_deg``),
      - within ``max_thickness_m`` perpendicular offset (wall thickness, NOT a
        room width — that is the discriminator vs two genuinely different walls),
      - extent-matching: IoU of their tangential spans >= ``min_extent_iou``.
        Two real faces of one wall cover almost the same span (IoU ~ 1); a short
        wall sitting in front of part of a longer, different wall has low IoU and
        is therefore left alone (this avoids the "red extends past blue" case).

    The merged wall is centred between the faces and its thickness is set to the
    measured face separation — recovering true wall thickness from the scan.
    """
    if len(walls) < 2:
        return walls

    def wall_angle(w):
        return float(np.degrees(np.arctan2(w["wall_nrm"][1], w["wall_nrm"][0])) % 180.0)

    def circ_diff(a, b):
        d = abs(a - b) % 180.0
        return min(d, 180.0 - d)

    # Group by orientation (greedy, tolerance-based, non-Manhattan).
    order = sorted(range(len(walls)), key=lambda i: wall_angle(walls[i]))
    groups: list[dict] = []
    for i in order:
        a = wall_angle(walls[i])
        best = next((g for g in groups if circ_diff(a, g["mean"]) <= angle_tol_deg), None)
        if best is None:
            groups.append({"mean": a, "walls": [walls[i]]})
        else:
            best["walls"].append(walls[i])
            best["mean"] = float(np.mean([wall_angle(w) for w in best["walls"]]))

    def find(p, i):
        while p[i] != i:
            p[i] = p[p[i]]
            i = p[i]
        return i

    result: list[dict] = []
    for g in groups:
        ws = g["walls"]
        rad = np.radians(g["mean"])
        nrm_ref = np.array([np.cos(rad), np.sin(rad)])
        dir_ref = np.array([-np.sin(rad), np.cos(rad)])

        items = []
        for w in ws:
            n_ref = float(np.dot(w["start_pt"][:2], nrm_ref))
            t0 = float(np.dot(w["start_pt"][:2], dir_ref))
            t1 = float(np.dot(w["end_pt"][:2], dir_ref))
            if t0 > t1:
                t0, t1 = t1, t0
            items.append((n_ref, t0, t1, w))

        # Union parallel + thickness-close + EXTENT-MATCHING pairs.  The extent
        # match (IoU of the two tangential spans) is the key guard: the two real
        # faces of one wall cover almost the same span (IoU ~ 1), whereas a short
        # wall sitting in front of part of a longer, different wall has low IoU
        # and must stay separate even though it overlaps.
        parent = list(range(len(items)))
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                if abs(items[i][0] - items[j][0]) > max_thickness_m:
                    continue
                inter = min(items[i][2], items[j][2]) - max(items[i][1], items[j][1])
                if inter <= 0:
                    continue
                union = max(items[i][2], items[j][2]) - min(items[i][1], items[j][1])
                if union > 1e-6 and inter / union >= min_extent_iou:
                    parent[find(parent, i)] = find(parent, j)

        clusters: dict[int, list] = defaultdict(list)
        for i in range(len(items)):
            clusters[find(parent, i)].append(items[i])

        for cl in clusters.values():
            if len(cl) == 1:
                result.append(cl[0][3])
                continue
            ns = [c[0] for c in cl]
            t_min = min(c[1] for c in cl)
            t_max = max(c[2] for c in cl)
            cws = [c[3] for c in cl]
            n_center = float(np.mean(ns))
            thickness = max(max(ns) - min(ns), max(w["thickness"] for w in cws))
            z_base = min(w["z_base"] for w in cws)
            z_top = max(w["z_base"] + w["height"] for w in cws)
            start_xy = t_min * dir_ref + n_center * nrm_ref
            end_xy = t_max * dir_ref + n_center * nrm_ref
            result.append({
                "start_pt": np.array([start_xy[0], start_xy[1], z_base]),
                "end_pt": np.array([end_xy[0], end_xy[1], z_base]),
                "length": t_max - t_min,
                "height": z_top - z_base,
                "thickness": thickness,
                "z_base": z_base,
                "wall_nrm": nrm_ref.copy(),
                "pt_z_span": max(w["pt_z_span"] for w in cws),
                "peak_angle_deg": g["mean"],
                "src_pts": _union_src(cws),
            })

    print(f"[merge_faces] {len(walls)} -> {len(result)} walls  "
          f"(max_thickness={max_thickness_m}m  min_extent_iou={min_extent_iou})")
    return result


def _snap_wall_to_angle(w: dict, snapped_ang_deg: float) -> None:
    """
    Rotate a wall's axis to ``snapped_ang_deg`` (wall-NORMAL angle, deg mod 180)
    about its midpoint, preserving its normal offset and tangential span.
    Mutates the wall dict in place.
    """
    rad = np.radians(snapped_ang_deg)
    new_nrm = np.array([np.cos(rad), np.sin(rad)])
    new_dir = np.array([-np.sin(rad), np.cos(rad)])

    mid_xy = 0.5 * (w["start_pt"][:2] + w["end_pt"][:2])
    n_ref = float(np.dot(mid_xy, new_nrm))
    t1 = float(np.dot(w["start_pt"][:2], new_dir))
    t2 = float(np.dot(w["end_pt"][:2], new_dir))
    t_start, t_end = min(t1, t2), max(t1, t2)

    start_xy = t_start * new_dir + n_ref * new_nrm
    end_xy = t_end * new_dir + n_ref * new_nrm
    z_base = w["z_base"]
    w["start_pt"] = np.array([start_xy[0], start_xy[1], z_base])
    w["end_pt"] = np.array([end_xy[0], end_xy[1], z_base])
    w["wall_nrm"] = new_nrm
    w["length"] = t_end - t_start
    w["peak_angle_deg"] = float(snapped_ang_deg % 180.0)


def anchor_walls_to_evidence(
    walls: list[dict],
    max_dev_deg: float = 8.0,
    min_pts: int = 30,
    min_aspect: float = 3.0,
) -> list[dict]:
    """
    Undo any direction snap/merge that rotated a wall off its own points.

    merge_wall_fragments (mean over a 12 deg group), regularize_wall_directions
    (length-weighted family snap) and extend_walls_to_corners all couple a wall's
    orientation to OTHER walls.  A single mis-fit wall can therefore rotate a
    correct neighbour with it.  This pass re-derives each wall's true direction
    from the supporting points carried on ``src_pts`` (the evidence it was fitted
    from): PCA principal axis -> wall tangent.  If the wall's current angle now
    deviates from that point-supported angle by more than ``max_dev_deg``, the
    snap was wrong, so the wall is reverted to its own evidence direction.

    A legitimate squaring snap moves a wall at most ~cluster_tol_deg (6 deg) off
    its points, so ``max_dev_deg`` is set just above that: small corrective snaps
    survive, gross drags are reverted.  Walls whose cluster is too small or too
    round (``min_pts`` / ``min_aspect``) have an ill-defined direction and are
    left as the snap put them.
    """
    if len(walls) < 1:
        return walls

    def wall_angle(w):
        return float(np.degrees(np.arctan2(w["wall_nrm"][1], w["wall_nrm"][0])) % 180.0)

    def circ_diff(a, b):
        d = abs(a - b) % 180.0
        return min(d, 180.0 - d)

    n_reverted = 0
    for w in walls:
        pts = w.get("src_pts")
        if pts is None or len(pts) < min_pts:
            continue
        xy = np.asarray(pts, dtype=float)[:, :2]
        mean = xy.mean(axis=0)
        _, sv, Vt = np.linalg.svd(xy - mean, full_matrices=False)
        if sv[1] < 1e-9 or sv[0] / sv[1] < min_aspect:
            continue  # not elongated enough -> direction ambiguous, trust the snap
        d_fit = Vt[0]
        nrm_fit = np.array([-d_fit[1], d_fit[0]])
        ev_ang = float(np.degrees(np.arctan2(nrm_fit[1], nrm_fit[0])) % 180.0)
        if circ_diff(wall_angle(w), ev_ang) > max_dev_deg:
            _snap_wall_to_angle(w, ev_ang)
            n_reverted += 1

    print(f"[anchor_evidence] reverted {n_reverted}/{len(walls)} wall(s) to their "
          f"point-supported direction (> {max_dev_deg} deg off evidence)")
    return walls


def regularize_wall_directions(
    walls: list[dict],
    cluster_tol_deg: float = 6.0,
    ortho_tol_deg: float = 4.0,
    shared_families_mod90: list[float] | None = None,
) -> list[dict]:
    """
    Snap wall orientations to a small set of globally consistent directions.

    Fitted wall angles are individually accurate to ~1-2 deg, but those small
    errors are exactly what makes the output look like a sketch instead of a
    floor plan: the "parallel" walls of a corridor diverge, and the two
    dominant directions of the building come out at e.g. 89.7 deg and 177.6
    deg -- 87.9 deg apart -- so every corner is slightly off-square.

    Two-level snap, deliberately NOT a Manhattan assumption:
      1. Cluster wall angles (circular, mod 180) with ``cluster_tol_deg``.
      2. Re-cluster the cluster means in mod-90 space with ``ortho_tol_deg``:
         clusters that are nearly parallel OR nearly perpendicular to each
         other form one "direction family" and snap to the family's
         length-weighted mean direction (or its exact +90 complement).
    A genuinely oblique wall group (e.g. a 58 deg party wall) lands in its own
    family and keeps its true angle.

    ``shared_families_mod90`` (optional, MUTATED in place) is a building-wide
    direction registry: each storey is fitted independently, so without it the
    same building grid comes out at e.g. 88.1-89.6 deg on different storeys --
    every storey internally square but rotated ~1 deg against its neighbours
    (~25 cm wall misalignment over a 14 m facade).  When passed, a family whose
    angle matches a registered direction (within ``ortho_tol_deg``, mod 90)
    snaps to it exactly; unmatched families are appended to the registry for
    subsequent storeys.
    """
    if len(walls) < 2:
        return walls

    def wall_angle(w):
        return float(np.degrees(np.arctan2(w["wall_nrm"][1], w["wall_nrm"][0])) % 180.0)

    def circ_diff(a, b, period=180.0):
        d = abs(a - b) % period
        return min(d, period - d)

    # ── 1. greedy circular clustering of wall angles (mod 180) ──────────────
    clusters: list[dict] = []          # {"angles": [...], "weights": [...]}
    order = np.argsort([-w["length"] for w in walls])   # long walls seed first
    member_cluster = np.full(len(walls), -1, dtype=int)
    for i in order:
        a = wall_angle(walls[i])
        for ci, cl in enumerate(clusters):
            if circ_diff(a, cl["mean"]) <= cluster_tol_deg:
                cl["angles"].append(a)
                cl["weights"].append(walls[i]["length"])
                # circular weighted mean, mod 180 (double-angle trick)
                ang2 = np.radians(np.array(cl["angles"]) * 2.0)
                wts = np.array(cl["weights"])
                cl["mean"] = float(np.degrees(np.arctan2(
                    np.sum(wts * np.sin(ang2)), np.sum(wts * np.cos(ang2)))) / 2.0 % 180.0)
                member_cluster[i] = ci
                break
        else:
            clusters.append({"angles": [a], "weights": [walls[i]["length"]],
                             "mean": a})
            member_cluster[i] = len(clusters) - 1

    # ── 2. group clusters into mod-90 direction families ────────────────────
    # Two clusters whose means agree mod 90 (within ortho_tol_deg) are either
    # parallel or perpendicular -- same family.  Family direction = weighted
    # circular mean in mod-90 space (quadruple-angle trick).
    family_of = np.full(len(clusters), -1, dtype=int)
    families: list[list[int]] = []
    for ci, cl in enumerate(clusters):
        for fi, fam in enumerate(families):
            ref = clusters[fam[0]]["mean"]
            if circ_diff(cl["mean"], ref, period=90.0) <= ortho_tol_deg:
                fam.append(ci)
                family_of[ci] = fi
                break
        else:
            families.append([ci])
            family_of[ci] = len(families) - 1

    fam_angle_mod90 = np.zeros(len(families))
    for fi, fam in enumerate(families):
        ang4, wts = [], []
        for ci in fam:
            ang4.extend(np.radians(np.array(clusters[ci]["angles"]) * 4.0))
            wts.extend(clusters[ci]["weights"])
        wts = np.array(wts)
        ang4 = np.array(ang4)
        fam_angle_mod90[fi] = float(np.degrees(np.arctan2(
            np.sum(wts * np.sin(ang4)), np.sum(wts * np.cos(ang4)))) / 4.0 % 90.0)

    # ── 2b. align families to the building-wide direction registry ──────────
    if shared_families_mod90 is not None:
        for fi in range(len(families)):
            best = None
            for p in shared_families_mod90:
                d = circ_diff(fam_angle_mod90[fi], p, period=90.0)
                if d <= ortho_tol_deg and (best is None or d < best[0]):
                    best = (d, p)
            if best is not None:
                fam_angle_mod90[fi] = best[1]
            else:
                shared_families_mod90.append(float(fam_angle_mod90[fi]))

    # ── 3. snap every wall to its family direction (or its +90 branch) ──────
    n_snapped = 0
    for i, w in enumerate(walls):
        fi = family_of[member_cluster[i]]
        base = fam_angle_mod90[fi]
        a = wall_angle(w)
        # candidate directions: base and base+90 (both mod 180)
        cands = np.array([base % 180.0, (base + 90.0) % 180.0])
        target = float(cands[np.argmin([circ_diff(a, c) for c in cands])])
        if circ_diff(a, target) > 0.01:
            n_snapped += 1
        _snap_wall_to_angle(w, target)

    fam_str = "  ".join(
        f"{fam_angle_mod90[fi]:.1f}deg(n={sum(len(clusters[ci]['angles']) for ci in fam)})"
        for fi, fam in enumerate(families))
    print(f"[regularize_dirs] {n_snapped}/{len(walls)} walls snapped; "
          f"{len(families)} direction families: {fam_str}")
    return walls


def regularize_line_offsets(
    walls: list[dict],
    offset_tol_m: float = 0.08,
    max_cluster_spread_m: float = 0.15,
) -> list[dict]:
    """
    Make near-collinear walls EXACTLY collinear.

    After direction snapping, walls in the same orientation group that lie on
    the same physical line (e.g. the two sides of a doorway) still carry
    slightly different normal offsets from independent fits.  Cluster the
    offsets (single linkage, gap <= ``offset_tol_m``, total spread capped at
    ``max_cluster_spread_m`` so chaining cannot fuse two distinct parallel
    lines) and snap each cluster to its length-weighted mean line.
    """
    if len(walls) < 2:
        return walls

    by_angle: dict[float, list[dict]] = defaultdict(list)
    for w in walls:
        ang = float(np.degrees(np.arctan2(w["wall_nrm"][1], w["wall_nrm"][0])) % 180.0)
        by_angle[round(ang, 3)].append(w)

    n_adjusted = 0
    for ang, group in by_angle.items():
        if len(group) < 2:
            continue
        rad = np.radians(ang)
        nrm = np.array([np.cos(rad), np.sin(rad)])
        items = sorted(
            ((float(np.dot(0.5 * (w["start_pt"][:2] + w["end_pt"][:2]), nrm)), w)
             for w in group),
            key=lambda t: t[0],
        )
        # single-linkage clustering along the sorted offsets, spread-capped
        cluster: list[tuple[float, dict]] = [items[0]]
        all_clusters = []
        for it in items[1:]:
            if (it[0] - cluster[-1][0] <= offset_tol_m
                    and it[0] - cluster[0][0] <= max_cluster_spread_m):
                cluster.append(it)
            else:
                all_clusters.append(cluster)
                cluster = [it]
        all_clusters.append(cluster)

        for cl in all_clusters:
            if len(cl) < 2:
                continue
            wts = np.array([w["length"] for _, w in cl])
            target = float(np.sum(wts * np.array([n for n, _ in cl])) / np.sum(wts))
            for n_cur, w in cl:
                if abs(n_cur - target) < 1e-9:
                    continue
                shift = (target - n_cur) * nrm
                w["start_pt"][:2] += shift
                w["end_pt"][:2] += shift
                n_adjusted += 1

    print(f"[regularize_offsets] {n_adjusted}/{len(walls)} walls shifted onto "
          f"shared lines (tol={offset_tol_m}m)")
    return walls


def regularize_thickness(
    walls: list[dict],
    gap_tol_m: float = 0.05,
    min_thickness_m: float = 0.10,
) -> list[dict]:
    """
    Quantize wall thicknesses to a small palette.

    Measured thicknesses scatter continuously (every wall slightly different),
    which reads as noise in the model.  Real buildings use a handful of wall
    build-ups, so: 1-D cluster the sorted thicknesses (split where consecutive
    values differ by more than ``gap_tol_m``) and snap each cluster to its
    median, rounded to the centimetre.
    """
    if not walls:
        return walls
    th = np.array([max(w["thickness"], min_thickness_m) for w in walls])
    order = np.argsort(th)
    sorted_th = th[order]

    cluster_ids = np.zeros(len(walls), dtype=int)
    cid = 0
    for k in range(1, len(sorted_th)):
        if sorted_th[k] - sorted_th[k - 1] > gap_tol_m:
            cid += 1
        cluster_ids[order[k]] = cid

    palette = []
    for c in range(cluster_ids.max() + 1):
        med = round(float(np.median(th[cluster_ids == c])), 2)
        palette.append(max(med, min_thickness_m))
        for w, ci in zip(walls, cluster_ids):
            if ci == c:
                w["thickness"] = palette[-1]

    print(f"[regularize_thickness] {len(np.unique(np.round(th, 3)))} raw values "
          f"-> palette {palette}")
    return walls


def filter_clutter_walls(
    walls: list[dict],
    storey_floor: float | None = None,
    storey_ceiling: float | None = None,
    max_length_m: float = 1.6,
    min_family_length_m: float = 6.0,
    family_tol_deg: float = 4.0,
    top_clearance_m: float = 0.30,
    wall_z_margin: float = 0.8,
) -> list[dict]:
    """
    Remove scanned door leaves (and similar planar clutter).

    An open door leaf is a perfectly planar vertical surface ~0.9 m wide, so it
    passes every wall acceptance test and shows up as a weirdly-angled little
    wall.  Its signature is the CONJUNCTION of three things, each of which a
    real wall violates:

      1. short (< ``max_length_m``),
      2. orientation belongs to no significant direction family — total length
         of all walls parallel OR perpendicular to it (mod-90, within
         ``family_tol_deg``) is < ``min_family_length_m``.  A genuine oblique
         party wall is long, so its own family carries enough weight;
      3. its top stays well below the scanned wall band's top (a door is
         ~2.0-2.1 m in a ~3 m storey) — real walls reach the band top.

    Run AFTER regularize_wall_directions (so family angles are exact) and
    BEFORE corner extension (so a door leaf cannot drag corners around first).
    """
    if len(walls) < 3:
        return walls

    def ang_mod90(w):
        return float(np.degrees(np.arctan2(w["wall_nrm"][1], w["wall_nrm"][0])) % 90.0)

    def circ_diff90(a, b):
        d = abs(a - b) % 90.0
        return min(d, 90.0 - d)

    # family weight per wall: total length of walls sharing its mod-90 direction
    angs = [ang_mod90(w) for w in walls]
    lens = [w["length"] for w in walls]
    fam_len = [
        sum(l2 for a2, l2 in zip(angs, lens) if circ_diff90(a, a2) <= family_tol_deg)
        for a in angs
    ]

    # top of the scanned wall band (define_masks keeps the central
    # wall_z_margin fraction of the room height)
    if storey_floor is not None and storey_ceiling is not None:
        z_mid = 0.5 * (storey_floor + storey_ceiling)
        band_top = z_mid + 0.5 * wall_z_margin * (storey_ceiling - storey_floor)
    else:
        band_top = max(w["z_base"] + w["height"] for w in walls)

    kept, dropped = [], []
    for w, fl in zip(walls, fam_len):
        z_top = w["z_base"] + w["height"]
        is_clutter = (
            w["length"] < max_length_m
            and fl < min_family_length_m
            and z_top < band_top - top_clearance_m
        )
        (dropped if is_clutter else kept).append(w)

    if dropped:
        angs_str = "  ".join(
            f"{np.degrees(np.arctan2(w['wall_nrm'][1], w['wall_nrm'][0])) % 180:.0f}deg/"
            f"{w['length']:.1f}m" for w in dropped)
        print(f"[filter_clutter] dropped {len(dropped)} door-leaf/clutter wall(s): {angs_str}")
    return kept


def fuse_wall_openings(
    walls: list[dict],
    masked_points: np.ndarray,
    storey_floor: float | None = None,
    storey_ceiling: float | None = None,
    line_tol_m: float = 0.15,
    col_bin_m: float = 0.10,
    min_opening_w_m: float = 0.55,
    max_opening_w_m: float = 3.2,
    min_lintel_clearance_m: float = 1.2,
    min_window_gap_m: float = 0.8,
    min_opening_h_m: float = 0.8,
    min_classified_frac: float = 0.4,
    wall_z_margin: float = 0.8,
) -> list[dict]:
    """
    Detect door/window openings from POINT occupancy and fuse the wall pieces
    around them into single walls carrying rectangular openings.

    Why points and not the wall pieces themselves: lintels and spandrels mostly
    never survive ``_wall_from_cluster`` (a 1x1 m lintel fails the aspect test),
    and when the lintel face is collinear with the wall its points fill the
    doorway span in the XY projection, so the whole stack is ONE label and the
    doorway is walled shut.  The scanned points above/below the opening are the
    reliable signal in both cases.

    Per wall line (exact angle + clustered normal offset), the nearby masked
    points are binned into tangential columns of ``col_bin_m`` and classified:

        SOLID   - has points near the bottom of the scanned wall band
        DOOR    - has points, but the lowest is > ``min_lintel_clearance_m``
                  above the band bottom (only a lintel above an opening)
        WINDOW  - has low AND high points with an internal vertical gap
                  >= ``min_window_gap_m`` (spandrel + lintel)
        EMPTY   - no points (scan hole or genuine gap between walls)

    Runs of non-SOLID columns between solid stretches become openings if they
    are door-width-plausible and at least ``min_classified_frac`` of their
    columns are DOOR/WINDOW (not just EMPTY — an all-empty gap is a real end of
    wall and the pieces stay separate).  Thin solid islands (a scanned door
    leaf crossing the line) are smoothed away.  Walls on the same line whose
    gap is fully explained by openings/solid columns are fused into one wall.

    Openings are stored on the wall as {"t0","t1","z0","z1"} in GLOBAL tangent
    coordinates (t = p . wall_dir), which survive the later corner extension
    (it only moves endpoints, never the wall line).  IFCBuilder.add_walls cuts
    them as IfcOpeningElements.  Arched tops come out as their bounding
    rectangle (opening top = lowest scanned point of the arch face).
    """
    if len(walls) < 1 or storey_floor is None or storey_ceiling is None:
        return walls

    room_h = storey_ceiling - storey_floor
    z_mid = 0.5 * (storey_floor + storey_ceiling)
    band_top = z_mid + 0.5 * wall_z_margin * room_h
    band_bot = z_mid - 0.5 * wall_z_margin * room_h

    P2 = masked_points[:, :2]
    PZ = masked_points[:, 2]

    EMPTY, SOLID, DOOR, WINDOW = 0, 1, 2, 3

    # ── group into lines: exact angle (post-regularization) then n_ref ──────
    by_angle: dict[float, list[dict]] = defaultdict(list)
    for w in walls:
        ang = float(np.degrees(np.arctan2(w["wall_nrm"][1], w["wall_nrm"][0])) % 180.0)
        by_angle[round(ang, 3)].append(w)

    result: list[dict] = []
    n_openings, n_fused = 0, 0

    for ang, group in by_angle.items():
        rad = np.radians(ang)
        nrm = np.array([np.cos(rad), np.sin(rad)])
        d = np.array([-np.sin(rad), np.cos(rad)])
        n_proj = P2 @ nrm
        t_proj = P2 @ d

        entries = []
        for w in group:
            n_ref = float(np.dot(0.5 * (w["start_pt"][:2] + w["end_pt"][:2]), nrm))
            t_s = float(np.dot(w["start_pt"][:2], d))
            t_e = float(np.dot(w["end_pt"][:2], d))
            if t_s > t_e:
                t_s, t_e = t_e, t_s
            entries.append({"n": n_ref, "t0": t_s, "t1": t_e, "w": w})
        entries.sort(key=lambda e: e["n"])

        lines = [[entries[0]]]
        for e in entries[1:]:
            if e["n"] - lines[-1][-1]["n"] <= line_tol_m:
                lines[-1].append(e)
            else:
                lines.append([e])

        for line in lines:
            line.sort(key=lambda e: e["t0"])
            t_lo = min(e["t0"] for e in line)
            t_hi = max(e["t1"] for e in line)
            lens = np.array([e["t1"] - e["t0"] for e in line])
            n_line = float(np.sum(lens * np.array([e["n"] for e in line]))
                           / np.sum(lens))
            halfwidth = 0.5 * max(e["w"]["thickness"] for e in line) + 0.15

            sel = ((np.abs(n_proj - n_line) <= halfwidth)
                   & (t_proj >= t_lo) & (t_proj <= t_hi))
            ts, zs = t_proj[sel], PZ[sel]
            n_cols = max(1, int(np.ceil((t_hi - t_lo) / col_bin_m)))
            if len(ts) < 10:
                result.extend(e["w"] for e in line)
                continue
            col_idx = np.clip(((ts - t_lo) / col_bin_m).astype(int), 0, n_cols - 1)

            # ── classify columns ─────────────────────────────────────────────
            state = np.full(n_cols, EMPTY, dtype=int)
            door_z1 = np.full(n_cols, np.nan)
            win_z0 = np.full(n_cols, np.nan)
            win_z1 = np.full(n_cols, np.nan)
            for c in range(n_cols):
                zc = np.sort(zs[col_idx == c])
                if len(zc) < 2:
                    # 0 points = empty; a single point is too weak to call
                    # either way - treat as empty (no opening evidence, and
                    # empty columns never create openings on their own)
                    state[c] = EMPTY
                    continue
                if zc[0] > band_bot + min_lintel_clearance_m:
                    state[c] = DOOR
                    door_z1[c] = zc[0]
                    continue
                gaps = np.diff(zc)
                g = int(np.argmax(gaps))
                if (gaps[g] >= min_window_gap_m
                        and zc[g] < band_top - 0.3
                        and zc[g + 1] > band_bot + 0.3):
                    state[c] = WINDOW
                    win_z0[c], win_z1[c] = zc[g], zc[g + 1]
                else:
                    state[c] = SOLID

            # smooth away thin solid islands (a door leaf crossing the line)
            max_island = max(1, int(np.round(0.25 / col_bin_m)))
            c = 0
            while c < n_cols:
                if state[c] == SOLID:
                    c2 = c
                    while c2 < n_cols and state[c2] == SOLID:
                        c2 += 1
                    if (c2 - c <= max_island and c > 0 and c2 < n_cols
                            and state[c - 1] in (DOOR, WINDOW)
                            and state[c2] in (DOOR, WINDOW)):
                        state[c:c2] = state[c - 1]
                    c = c2
                else:
                    c += 1

            solid_cols = np.where(state == SOLID)[0]
            if len(solid_cols) == 0:
                result.extend(e["w"] for e in line)
                continue

            # ── openings = plausible runs of open columns between solids ────
            openings: list[dict] = []
            ok_col = state == SOLID          # columns "explained" for fusion
            c = solid_cols[0]
            while c <= solid_cols[-1]:
                if state[c] == SOLID:
                    c += 1
                    continue
                c2 = c
                while c2 <= solid_cols[-1] and state[c2] != SOLID:
                    c2 += 1
                run = np.arange(c, c2)
                width = len(run) * col_bin_m
                n_door = int(np.sum(state[run] == DOOR))
                n_win = int(np.sum(state[run] == WINDOW))
                classified = (n_door + n_win) / len(run)
                if (min_opening_w_m <= width <= max_opening_w_m
                        and classified >= min_classified_frac
                        and (n_door + n_win) > 0):
                    if n_door >= n_win:
                        z0 = float(storey_floor)
                        z1 = float(np.nanmedian(door_z1[run]))
                    else:
                        z0 = float(np.nanmedian(win_z0[run]))
                        z1 = float(np.nanmedian(win_z1[run]))
                    if z1 - z0 >= min_opening_h_m:
                        openings.append({
                            "t0": t_lo + c * col_bin_m,
                            "t1": t_lo + c2 * col_bin_m,
                            "z0": z0, "z1": z1,
                        })
                        ok_col[run] = True
                c = c2
            n_openings += len(openings)

            # ── fuse members whose gaps are fully explained ──────────────────
            line_start = len(result)
            chains = [[line[0]]]
            for e in line[1:]:
                prev = chains[-1][-1]
                gap0, gap1 = prev["t1"], e["t0"]
                if gap1 <= gap0 + col_bin_m:
                    chains[-1].append(e)
                    continue
                c0 = int(np.floor((gap0 - t_lo) / col_bin_m)) + 1
                c1 = int(np.ceil((gap1 - t_lo) / col_bin_m)) - 1
                c0, c1 = max(c0, 0), min(c1, n_cols - 1)
                if c1 < c0 or bool(np.all(ok_col[c0:c1 + 1])):
                    chains[-1].append(e)
                else:
                    chains.append([e])

            # Openings are NOT emitted as voids — the user prefers clean solid
            # walls.  Detection above is kept only because it identifies which
            # gaps are real doorways/windows (vs a genuine wall end), so the
            # left/lintel/right pieces of a doorway FUSE into one continuous
            # solid wall instead of staying as three separate fragments.
            for chain in chains:
                t0c = min(e["t0"] for e in chain)
                t1c = max(e["t1"] for e in chain)
                if len(chain) == 1:
                    result.append(chain[0]["w"])
                    continue
                n_fused += 1
                ws = [e["w"] for e in chain]
                z_base = min(w["z_base"] for w in ws)
                z_top = max(w["z_base"] + w["height"] for w in ws)
                start_xy = t0c * d + n_line * nrm
                end_xy = t1c * d + n_line * nrm
                result.append({
                    "start_pt": np.array([start_xy[0], start_xy[1], z_base]),
                    "end_pt": np.array([end_xy[0], end_xy[1], z_base]),
                    "length": t1c - t0c,
                    "height": z_top - z_base,
                    "thickness": max(w["thickness"] for w in ws),
                    "z_base": z_base,
                    "wall_nrm": nrm.copy(),
                    "pt_z_span": max(w.get("pt_z_span", z_top - z_base)
                                     for w in ws),
                    "peak_angle_deg": ang,
                    "src_pts": _union_src(ws),
                })

            # Detektierte Oeffnungen an die abdeckende Wand DIESER Linie haengen
            # (Weltkoordinaten pA/pB auf der Wandmittellinie) fuer den IFC-Writer.
            for op in openings:
                tmid = 0.5 * (op["t0"] + op["t1"])
                for w in result[line_start:]:
                    ts = float(np.dot(w["start_pt"][:2], d))
                    te = float(np.dot(w["end_pt"][:2], d))
                    if min(ts, te) - 1e-6 <= tmid <= max(ts, te) + 1e-6:
                        pA = op["t0"] * d + n_line * nrm
                        pB = op["t1"] * d + n_line * nrm
                        w.setdefault("openings", []).append({
                            "pA": (float(pA[0]), float(pA[1])),
                            "pB": (float(pB[0]), float(pB[1])),
                            "z0": float(op["z0"]), "z1": float(op["z1"]),
                        })
                        break

    print(f"[fuse_openings] {len(walls)} -> {len(result)} walls; "
          f"{n_fused} fusion(s) across {n_openings} detected opening(s)")
    return result


def extract_wall_lines_2d(
    points: np.ndarray,
    normals: np.ndarray,
    inlier_thresh_m: float = 0.12,
    min_line_pts: int = 40,
    min_cluster_pts: int = 20,
    gap_m: float = 0.6,
    n_seeds: int = 150,
    max_lines: int = 400,
) -> np.ndarray:
    """
    Segment walls by extracting 2-D line segments from the XY (floor-plan)
    projection — the cleanest framing of the problem, since walls are line
    segments when viewed top-down.

    Why 2-D lines over 3-D region growing: a corner is handled for free — a line
    fit to wall A simply does not include wall B's points (they are far from A's
    line in the perpendicular direction), so there is no normal "chaining" and no
    need to delete corner points (hence no grey holes).  Parallel walls have
    different perpendicular offsets -> different lines; collinear walls in
    different rooms share a line but are separated by the tangential gap split.

    Method — normal-guided sequential RANSAC:
      while enough points remain:
        1. Hypothesise lines from a sample of seed points (each point's own XY
           normal defines a candidate line through it). Pick the line with the
           most inliers within ``inlier_thresh_m`` perpendicular distance.
        2. Refit the direction (SVD) and reselect inliers.
        3. Split inliers along the tangent at gaps > ``gap_m`` -> one label per
           collinear run; deactivate all inliers and continue.

    Normal-guided hypotheses converge far faster than random point pairs and use
    the (reliable, near-vertical) wall normals already computed.

    Returns an (N,) int array of segment labels; -1 for unassigned points.
    """
    n = len(points)
    P2 = points[:, :2]
    nrm = normals[:, :2].copy()
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-9

    labels = np.full(n, -1, dtype=np.int32)
    active = np.ones(n, dtype=bool)
    rng = np.random.default_rng(0)
    next_lab = 0

    for _ in range(max_lines):
        ai = np.where(active)[0]
        if len(ai) < min_line_pts:
            break
        Pa = P2[ai]

        # ── 1. Normal-guided line hypotheses ───────────────────────────────
        seeds = ai if len(ai) <= n_seeds else rng.choice(ai, n_seeds, replace=False)
        best_inl, best_cnt = None, min_line_pts - 1
        for s in seeds:
            ns = nrm[s]
            inl = np.abs((Pa - P2[s]) @ ns) < inlier_thresh_m
            c = int(inl.sum())
            if c > best_cnt:
                best_cnt, best_inl = c, inl
        if best_inl is None:
            break

        # ── 2. Refit direction (SVD) and reselect inliers ──────────────────
        sel0 = Pa[best_inl]
        mean = sel0.mean(axis=0)
        _, _, Vt = np.linalg.svd(sel0 - mean, full_matrices=False)
        d = Vt[0]
        line_n = np.array([-d[1], d[0]])
        inl2 = np.abs((Pa - mean) @ line_n) < inlier_thresh_m
        sel = ai[inl2]

        # ── 3. Tangent gap split -> one label per collinear run ─────────────
        t = P2[sel] @ d
        order = np.argsort(t)
        cuts = np.where(np.diff(t[order]) > gap_m)[0]
        starts = np.concatenate([[0], cuts + 1])
        ends = np.concatenate([cuts + 1, [len(sel)]])
        for a, b in zip(starts, ends):
            run = sel[order[a:b]]
            if len(run) >= min_cluster_pts:
                labels[run] = next_lab
                next_lab += 1
        active[sel] = False

    n_assigned = int((labels >= 0).sum())
    print(f"[wall_lines_2d] {n:,} pts -> {next_lab} line segment(s); "
          f"{n_assigned:,} assigned, {n - n_assigned:,} residual")
    return labels


def extract_walls(
    points: np.ndarray,
    normals: np.ndarray,
    walls_dict: dict,
    visualize: bool = False,
    storey_floor: float | None = None,
    storey_ceiling: float | None = None,
    direction_registry: list[float] | None = None,
) -> list[dict]:
    walls_mask = walls_dict["walls_mask"]
    masked_points = points[walls_mask]
    masked_normals = normals[walls_mask]

    if len(masked_points) == 0:
        print("[extract_walls] WARNING: no wall candidate points after masking.")
        return [], np.array([])

    # 2-D line-segment extraction on the floor-plan projection (no Manhattan
    # assumption, no curvature gating); recover stragglers by label propagation.
    seg_labels = extract_wall_lines_2d(masked_points, masked_normals)
    seg_labels = _propagate_labels(masked_points, masked_normals, seg_labels,
                                   radius=0.30, thresh_deg=45.0)
    # NOTE: don't visualize inside segments_to_walls — that would show the
    # pre-merge fragments.  The debug view is drawn at the END, on the final
    # merged walls (see below).
    walls = segments_to_walls(masked_points, seg_labels, visualize=False)
    # Reassemble walls, then snap to corners.  Order matters: stitch collinear
    # fragments end-to-end first, then collapse the two scanned faces of each
    # thick wall into one, then extend the resulting whole walls to corners.
    walls = merge_wall_fragments(walls, storey_floor=storey_floor,
                                 storey_ceiling=storey_ceiling)
    walls = merge_parallel_faces(walls)
    # Regularize BEFORE corner extension: once directions are snapped to exact
    # families and collinear runs share one line, the corner intersections are
    # exact and the plan stops looking hand-sketched.
    walls = regularize_wall_directions(walls, shared_families_mod90=direction_registry)
    # Anchor to evidence: if the family snap (or an earlier merge) rotated a wall
    # off its own supporting points — dragging a correct neighbour with it —
    # revert that wall to the direction its points actually support.  Done before
    # offset snapping and corner extension so those operate on corrected angles.
    walls = anchor_walls_to_evidence(walls)
    # Door leaves masquerade as short odd-angle walls; remove them before they
    # can participate in offset snapping or corner extension.
    walls = filter_clutter_walls(walls, storey_floor, storey_ceiling)
    walls = regularize_line_offsets(walls)
    # Collinear-offset snapping can align the extents of previously-unmerged
    # parallel faces, so give face merging a second chance on the clean lines.
    walls = merge_parallel_faces(walls)
    walls = regularize_thickness(walls)
    # Collapse left/lintel/right (and spandrel) stacks into single walls with
    # rectangular openings (cut as IfcOpeningElements by IFCBuilder).
    walls = fuse_wall_openings(walls, masked_points, storey_floor, storey_ceiling)
    walls = extend_walls_to_corners(walls)

    # extend_walls_to_corners can pull an endpoint inward and shrink a wall below
    # the acceptance length, so re-apply the minimum-length filter afterwards.
    min_wall_length_m = 0.5
    before = len(walls)
    walls = [w for w in walls if w["length"] >= min_wall_length_m]
    if before != len(walls):
        print(f"[extract_walls] dropped {before - len(walls)} sub-"
              f"{min_wall_length_m}m fragment(s) after corner extension")

    # Vertical extent: start from each wall's OWN scanned z-bounds (variable per
    # wall), then extend to a slab only when the wall actually reaches it:
    #   - snap base DOWN to the floor only if the scanned bottom is already near
    #     it (a full-height wall) -- a lintel/spandrel keeps its high bottom so
    #     the opening below stays open instead of being walled shut;
    #   - snap top UP to the ceiling only if the scanned top is near it (so a
    #     spandrel runs opening-top -> ceiling), and CLAMP every top to the
    #     ceiling so nothing pokes above it;
    #   - where no ceiling was detected (attic), keep the scanned top.
    has_ceiling = (storey_ceiling is not None and storey_floor is not None
                   and storey_ceiling > storey_floor)
    if storey_floor is not None:
        room_h = (storey_ceiling - storey_floor) if has_ceiling else None
        reach = max(0.5, 0.30 * room_h) if room_h else 0.6
        for w in walls:
            base = float(w["z_base"])
            top = float(w["z_base"] + w["height"])
            if base - storey_floor <= reach:               # reaches floor -> snap
                base = storey_floor
            base = max(base, storey_floor)
            if has_ceiling:
                if storey_ceiling - top <= reach:          # reaches ceiling -> snap
                    top = storey_ceiling
                top = min(top, storey_ceiling)             # clamp under ceiling
            w["z_base"] = float(base)
            w["height"] = max(0.1, float(top - base))

    peak_angles = _dominant_wall_angles(walls)
    print(f"[extract_walls] -> {len(walls)} walls accepted")

    # Visualize the FINAL merged walls over the segment-coloured points.
    if visualize:
        debug_wall_polygons(masked_points, seg_labels, walls)

    return walls, peak_angles


# ─────────────────────────────────────────────────────────────────────────────
# Post-processing helpers
# ─────────────────────────────────────────────────────────────────────────────


def align_walls_to_peaks(
    walls: list[dict],
    peak_angles_deg: np.ndarray,
) -> list[dict]:
    """
    Snap every wall's direction to the nearest detected orientation peak.

    The RANSAC-fitted wall_nrm may deviate slightly from the true dominant
    angle.  This function recomputes start_pt / end_pt / length / wall_nrm
    so that all walls in the same orientation group are exactly parallel.
    """
    if len(peak_angles_deg) == 0 or len(walls) == 0:
        return walls

    n_snapped = 0
    for w in walls:
        nrm = w["wall_nrm"]
        cur_ang = float(np.degrees(np.arctan2(nrm[1], nrm[0])) % 180)

        # Nearest peak — circular distance in [0°, 180°)
        diffs = np.abs(peak_angles_deg - cur_ang)
        diffs = np.minimum(diffs, 180.0 - diffs)
        snapped_ang = float(peak_angles_deg[np.argmin(diffs)])

        rad = np.radians(snapped_ang)
        new_nrm = np.array([np.cos(rad), np.sin(rad)])
        new_dir = np.array([-np.sin(rad), np.cos(rad)])  # 90° CCW of normal

        # Reference-line position along the snapped normal (scanned face)
        mid_xy = 0.5 * (w["start_pt"][:2] + w["end_pt"][:2])
        n_ref = float(np.dot(mid_xy, new_nrm))

        # Tangent extents — project both endpoints, keep the span
        t1 = float(np.dot(w["start_pt"][:2], new_dir))
        t2 = float(np.dot(w["end_pt"][:2], new_dir))
        t_start, t_end = min(t1, t2), max(t1, t2)

        start_xy = t_start * new_dir + n_ref * new_nrm
        end_xy = t_end * new_dir + n_ref * new_nrm
        z_base = w["z_base"]

        w["start_pt"] = np.array([start_xy[0], start_xy[1], z_base])
        w["end_pt"] = np.array([end_xy[0], end_xy[1], z_base])
        w["wall_nrm"] = new_nrm
        w["length"] = t_end - t_start
        w["peak_angle_deg"] = snapped_ang

        if abs(snapped_ang - cur_ang) > 0.5:
            n_snapped += 1

    print(
        f"[align_walls] {n_snapped}/{len(walls)} walls direction-snapped to peak angles"
    )
    return walls


def merge_collinear_walls(
    walls: list[dict],
    merge_gap_m: float = 0.4,
    n_tol_m: float = 0.25,
    height_tol_m: float = 0.3,
) -> list[dict]:
    """
    Stitch wall fragments on the same physical line that are separated by
    scan-artifact gaps no wider than ``merge_gap_m``.

    Two fragments are candidates for merging only when they are:
      - Same orientation  (identical ``peak_angle_deg`` after alignment)
      - Same line         (normal offset within ``n_tol_m``)
      - Same height band  (z_base within ``height_tol_m`` AND z_top within
                           ``height_tol_m``) — prevents cross-floor merges
      - Close together    (tangent gap ≤ ``merge_gap_m``)

    n_ref clustering uses single-linkage on the sorted normal-offset values so
    that gradual scan-noise drift along a long wall does not split it into
    separate clusters.
    """
    if len(walls) == 0:
        return walls

    # ── 1. Group walls by peak angle ─────────────────────────────────────────
    by_angle: dict[float, list[dict]] = defaultdict(list)
    for w in walls:
        ang = float(w.get(
            "peak_angle_deg",
            np.degrees(np.arctan2(w["wall_nrm"][1], w["wall_nrm"][0])) % 180,
        ))
        by_angle[ang].append(w)

    merged: list[dict] = []

    for ang, group in by_angle.items():
        rad     = np.radians(ang)
        nrm_ref = np.array([ np.cos(rad),  np.sin(rad)])
        dir_ref = np.array([-np.sin(rad),  np.cos(rad)])

        # Compute projections for every wall in this orientation group
        data: list[tuple] = []   # (n_ref, t_start, t_end, wall_dict)
        for w in group:
            n_ref   = float(np.dot(w["start_pt"][:2], nrm_ref))
            t_start = float(np.dot(w["start_pt"][:2], dir_ref))
            t_end   = float(np.dot(w["end_pt"][:2],   dir_ref))
            if t_start > t_end:
                t_start, t_end = t_end, t_start
            data.append((n_ref, t_start, t_end, w))

        # ── 2. Single-linkage clustering on n_ref (normal offset) ────────────
        # Sort by n_ref so adjacent entries in the sorted list are closest in
        # the normal direction.  Cluster wherever consecutive gap < n_tol_m.
        data.sort(key=lambda x: x[0])
        lines: list[list[tuple]] = [[data[0]]]
        for entry in data[1:]:
            # Compare to the LAST entry in the current cluster (single-linkage)
            if entry[0] - lines[-1][-1][0] <= n_tol_m:
                lines[-1].append(entry)
            else:
                lines.append([entry])

        # ── 3. Within each line cluster: merge close, height-compatible walls ─
        for line in lines:
            line.sort(key=lambda x: x[1])   # order by tangent start

            # Each "run" is a group of walls that will be merged into one.
            # A new run starts whenever the tangent gap is too large OR the
            # height bands are incompatible.
            runs: list[list[tuple]] = [[line[0]]]

            for entry in line[1:]:
                prev        = runs[-1][-1]
                tang_gap    = entry[1] - prev[2]            # t_start - t_end

                # Height compatibility: compare z_base and z_top of the
                # incoming wall against the run's accumulated z range.
                run_walls   = [e[3] for e in runs[-1]]
                run_z_base  = min(w["z_base"]              for w in run_walls)
                run_z_top   = max(w["z_base"] + w["height"] for w in run_walls)
                e_z_base    = entry[3]["z_base"]
                e_z_top     = e_z_base + entry[3]["height"]

                z_base_ok   = abs(e_z_base - run_z_base) <= height_tol_m
                z_top_ok    = abs(e_z_top  - run_z_top)  <= height_tol_m

                if tang_gap <= merge_gap_m and z_base_ok and z_top_ok:
                    runs[-1].append(entry)
                else:
                    runs.append([entry])

            # ── 4. Emit one merged wall per run ──────────────────────────────
            for run in runs:
                t_min  = min(e[1] for e in run)
                t_max  = max(e[2] for e in run)
                n_avg  = float(np.mean([e[0] for e in run]))
                walls_ = [e[3] for e in run]

                z_bases    = [w["z_base"]              for w in walls_]
                z_tops     = [w["z_base"] + w["height"] for w in walls_]
                new_z_base = min(z_bases)
                new_height = max(z_tops) - new_z_base

                start_xy = t_min * dir_ref + n_avg * nrm_ref
                end_xy   = t_max * dir_ref + n_avg * nrm_ref

                merged.append({
                    "start_pt":       np.array([start_xy[0], start_xy[1], new_z_base]),
                    "end_pt":         np.array([end_xy[0],   end_xy[1],   new_z_base]),
                    "length":         t_max - t_min,
                    "height":         new_height,
                    "thickness":      max(w["thickness"]  for w in walls_),
                    "z_base":         new_z_base,
                    "wall_nrm":       nrm_ref.copy(),
                    "pt_z_span":      max(w["pt_z_span"]  for w in walls_),
                    "peak_angle_deg": ang,
                })

    n_in, n_out = len(walls), len(merged)
    print(f"[merge_walls] {n_in} → {n_out} walls  "
          f"(gap≤{merge_gap_m}m  n_tol≤{n_tol_m}m  h_tol≤{height_tol_m}m)")
    return merged


def extend_walls_to_corners(
    walls: list[dict],
    max_extension_m: float = 1.0,
    min_angle_diff_deg: float = 20.0,
    corner_slack_m: float = 0.3,
) -> list[dict]:
    """
    Snap each wall endpoint to the intersection of its own wall line with the
    nearest differently-oriented wall line.

    After alignment every wall has an exact direction, so the intersection of
    two wall lines is well-defined.  For each endpoint we:

      1. Iterate over all walls whose orientation differs by at least
         ``min_angle_diff_deg``.
      2. Compute the intersection of the two *infinite* wall lines.
      3. Accept the candidate whose intersection requires the smallest tangent
         move, provided that move is within ``max_extension_m`` and the
         intersection falls within (or close to) the candidate wall's tangent
         extent.
      4. Move the endpoint to the winning intersection.

    The wall's normal offset (its position in the perpendicular direction) is
    preserved — only the tangent extent changes.
    """
    if len(walls) < 2:
        return walls

    n_extended = 0

    for w in walls:
        nrm_W  = w["wall_nrm"]
        rad_W  = float(np.arctan2(nrm_W[1], nrm_W[0]))
        d_W    = np.array([-np.sin(rad_W),  np.cos(rad_W)])   # tangent direction
        n_W    = float(np.dot(w["start_pt"][:2], nrm_W))       # normal offset of line
        t_W_s  = float(np.dot(w["start_pt"][:2], d_W))         # global tangent of start
        t_W_e  = float(np.dot(w["end_pt"][:2],   d_W))         # global tangent of end
        ang_W  = float(w.get("peak_angle_deg",
                             np.degrees(np.arctan2(nrm_W[1], nrm_W[0])) % 180))

        # Process start (ep=0) then end (ep=1)
        for ep in (0, 1):
            t_ep   = t_W_s if ep == 0 else t_W_e   # current tangent of endpoint
            best_dt, best_t_new, best_miss = None, None, None

            for c in walls:
                if c is w:
                    continue

                ang_C  = float(c.get("peak_angle_deg",
                                     np.degrees(np.arctan2(
                                         c["wall_nrm"][1], c["wall_nrm"][0])) % 180))
                # Circular angle difference in [0°, 90°]
                diff   = abs(ang_W - ang_C) % 180
                diff   = min(diff, 180.0 - diff)
                if diff < min_angle_diff_deg:
                    continue

                nrm_C  = c["wall_nrm"]
                rad_C  = float(np.arctan2(nrm_C[1], nrm_C[0]))
                d_C    = np.array([-np.sin(rad_C), np.cos(rad_C)])
                n_C    = float(np.dot(c["start_pt"][:2], nrm_C))

                # --- Intersection of line W and line C -------------------
                # W's line:  dot(P, nrm_W) = n_W   →  P = t*d_W + n_W*nrm_W
                # C's line:  dot(P, nrm_C) = n_C
                # Substituting: t*dot(d_W, nrm_C) + n_W*dot(nrm_W, nrm_C) = n_C
                denom  = float(np.dot(d_W, nrm_C))
                if abs(denom) < 1e-6:
                    continue   # lines are parallel

                t_isect = (n_C - n_W * float(np.dot(nrm_W, nrm_C))) / denom

                # How far must we move this endpoint?
                dt = t_isect - t_ep
                if abs(dt) > max_extension_m:
                    continue

                # Endpoint must not cross the opposite endpoint — that would
                # reverse the wall direction and corrupt create_2pt_wall.
                min_span = 0.1
                if ep == 0 and t_isect >= t_W_e - min_span:
                    continue
                if ep == 1 and t_isect <= t_W_s + min_span:
                    continue

                # Intersection must lie within C's tangent extent.
                # Use a small fixed slack so already-extended neighbours
                # don't compound the effective reach.
                i_xy   = t_isect * d_W + n_W * nrm_W
                s_C    = float(np.dot(i_xy, d_C))
                t_C_s  = float(np.dot(c["start_pt"][:2], d_C))
                t_C_e  = float(np.dot(c["end_pt"][:2],   d_C))
                if t_C_s > t_C_e:
                    t_C_s, t_C_e = t_C_e, t_C_s
                # The intersection must lie within (or barely beyond) the OTHER
                # wall's actual extent, so a wall only snaps to a corner that
                # the other wall really reaches -- not to a distant wall's
                # infinite line.  A large slack here is what caused short walls
                # to balloon out by metres toward unrelated parallel walls.
                if s_C < t_C_s - corner_slack_m or s_C > t_C_e + corner_slack_m:
                    continue

                # Rank by how far the intersection falls outside C's tangent
                # extent ("miss distance") — this is the distance in the axis
                # perpendicular to W (Y for X-axis walls, X for Y-axis walls).
                # A candidate whose body actually reaches the corner (miss=0)
                # is always preferred over one that doesn't, regardless of how
                # small its dt is.  Break ties with min abs(dt).
                miss = max(0.0, t_C_s - s_C, s_C - t_C_e)
                if (best_miss is None
                        or miss < best_miss
                        or (miss == best_miss and abs(dt) < abs(best_dt))):
                    best_miss  = miss
                    best_dt    = dt
                    best_t_new = t_isect

            if best_t_new is None:
                continue

            new_xy = best_t_new * d_W + n_W * nrm_W
            z_base = w["z_base"]
            if ep == 0:
                w["start_pt"] = np.array([new_xy[0], new_xy[1], z_base])
                t_W_s = best_t_new
            else:
                w["end_pt"]   = np.array([new_xy[0], new_xy[1], z_base])
                t_W_e = best_t_new

            n_extended += 1

        # Recompute length from (possibly updated) endpoints
        t_s = float(np.dot(w["start_pt"][:2], d_W))
        t_e = float(np.dot(w["end_pt"][:2],   d_W))
        w["length"] = abs(t_e - t_s)

    print(f"[extend_corners] adjusted {n_extended} endpoint(s) across {len(walls)} walls")
    return walls


def split_walls_at_openings(
    walls: list[dict],
    points: np.ndarray,
    min_opening_width_m: float = 0.6,
    density_threshold: float = 0.15,
    bin_size_m: float = 0.1,
    normal_margin_m: float = 0.3,
    min_segment_length_m: float = 0.4,
) -> list[dict]:
    """
    Detect doorway / window gaps along each wall by querying the nearby point
    cloud for low-density regions.  A wall with K detected openings is replaced
    by up to K+1 shorter wall segments (one per solid span either side of the
    gap).  No IFC opening elements are needed — the gaps simply appear as
    missing geometry between adjacent wall segments.
    """
    if len(walls) == 0 or len(points) == 0:
        return walls

    pts_xy = points[:, :2]
    pts_z = points[:, 2]
    result: list[dict] = []
    n_splits = 0

    for w_idx, w in enumerate(walls):
        nrm = w["wall_nrm"]
        rad = float(np.arctan2(nrm[1], nrm[0]))
        wall_dir = np.array([-np.sin(rad), np.cos(rad)])
        anchor = w["start_pt"][:2]
        t_start = float(np.dot(anchor, wall_dir))
        t_end = float(np.dot(w["end_pt"][:2], wall_dir))
        if t_start > t_end:
            t_start, t_end = t_end, t_start
        n_ref = float(np.dot(anchor, nrm))
        length = t_end - t_start
        z_base = w["z_base"]
        height = w["height"]
        thick = w["thickness"]

        # ── Query points in the wall's bounding slab ─────────────────────────
        n_dist = np.abs((pts_xy - anchor) @ nrm)
        t_vals = (pts_xy - anchor) @ wall_dir + t_start  # world tangent coords
        # re-derive local: project onto wall_dir from origin
        t_proj = pts_xy @ wall_dir
        n_proj = pts_xy @ nrm

        slab_mask = (
            (np.abs(n_proj - n_ref) <= thick + normal_margin_m)
            & (pts_z >= z_base - 0.1)
            & (pts_z <= z_base + height + 0.1)
            & (t_proj >= t_start - 0.1)
            & (t_proj <= t_end + 0.1)
        )
        n_nearby = int(slab_mask.sum())

        if n_nearby < 10:
            result.append(w)
            continue

        nearby_t = t_proj[slab_mask]

        # ── 1-D density histogram along tangent (local coords) ────────────────
        bins = np.arange(t_start, t_end + bin_size_m, bin_size_m)
        if len(bins) < 2:
            result.append(w)
            continue
        density, bin_edges = np.histogram(nearby_t, bins=bins)
        bin_centers = 0.5 * (bin_edges[:-1] + bin_edges[1:])

        # ── Find sparse runs → openings ───────────────────────────────────────
        threshold = (
            density_threshold * float(density.max()) if density.max() > 0 else 1.0
        )
        empty = density < threshold

        # Group consecutive empty bins into runs
        opening_spans: list[tuple[float, float]] = []
        in_gap, gap_start = False, 0.0
        for k, is_empty in enumerate(empty):
            if is_empty and not in_gap:
                in_gap = True
                gap_start = bin_edges[k]
            elif not is_empty and in_gap:
                in_gap = False
                gap_end = bin_edges[k]
                if gap_end - gap_start >= min_opening_width_m:
                    opening_spans.append((gap_start, gap_end))
        if in_gap:
            gap_end = bin_edges[-1]
            if gap_end - gap_start >= min_opening_width_m:
                opening_spans.append((gap_start, gap_end))

        if not opening_spans:
            result.append(w)
            continue

        # ── Split wall at opening boundaries ─────────────────────────────────
        n_splits += 1
        solid_spans: list[tuple[float, float]] = []
        prev = t_start
        for o_start, o_end in opening_spans:
            if o_start - prev >= min_segment_length_m:
                solid_spans.append((prev, o_start))
            prev = o_end
        if t_end - prev >= min_segment_length_m:
            solid_spans.append((prev, t_end))

        print(
            f"[split_openings] wall {w_idx}: "
            f"{len(opening_spans)} opening(s) → {len(solid_spans)} segment(s)"
        )

        for seg_t0, seg_t1 in solid_spans:
            seg_start_xy = seg_t0 * wall_dir + n_ref * nrm
            seg_end_xy = seg_t1 * wall_dir + n_ref * nrm
            seg = dict(w)  # shallow copy preserves all other fields
            seg["start_pt"] = np.array([seg_start_xy[0], seg_start_xy[1], z_base])
            seg["end_pt"] = np.array([seg_end_xy[0], seg_end_xy[1], z_base])
            seg["length"] = seg_t1 - seg_t0
            result.append(seg)

    print(
        f"[split_openings] {len(walls)} walls → {len(result)} segments "
        f"({n_splits} wall(s) split at openings)"
    )
    return result
