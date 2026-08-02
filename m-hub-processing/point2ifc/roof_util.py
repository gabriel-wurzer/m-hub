import numpy as np
from scipy.spatial import cKDTree, ConvexHull

from walls_util import region_grow_planar_segments
from vis_util import debug_roofs


def _fit_plane(pts: np.ndarray) -> tuple[np.ndarray, float] | None:
    """
    Least-squares plane fit via PCA.

    Returns (normal, d) for the plane  normal . x = d, with the normal oriented
    so nz > 0 (the convention add_roof expects).  Returns None if the segment is
    degenerate or the plane is vertical (nz ~ 0 — that is a wall, not a roof).
    """
    if len(pts) < 3:
        return None
    c = pts.mean(axis=0)
    _, _, Vt = np.linalg.svd(pts - c, full_matrices=False)
    normal = Vt[2]                       # smallest-variance direction
    if normal[2] < 0:
        normal = -normal                 # orient upward
    if abs(normal[2]) < 1e-6:
        return None                      # near-vertical → not a roof
    d = float(np.dot(normal, c))
    return normal, d


def _group_coplanar(
    fits: list[tuple[np.ndarray, float]],
    seg_pts: list[np.ndarray],
    angle_tol_deg: float,
    offset_tol_m: float,
    adj_gap_m: float,
) -> list[list[int]]:
    """
    Union-find grouping of segment plane-fits that lie on the SAME plane AND are
    spatially adjacent.
    """
    n = len(fits)
    parent = list(range(n))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    trees = [cKDTree(sp) for sp in seg_pts]
    rng = np.random.default_rng(0)

    def adjacent(i, j):
        # Min distance between the two point sets.  Query the SMALLER set (in
        # full, up to a cap) against the larger set's tree: the closest region is
        # far more likely to be sampled this way than blindly subsampling one
        # side to 150 pts, which used to overstate the gap and miss real merges.
        a, b = (i, j) if len(seg_pts[i]) <= len(seg_pts[j]) else (j, i)
        qa = seg_pts[a]
        if len(qa) > 800:
            qa = qa[rng.choice(len(qa), 800, replace=False)]
        dmin, _ = trees[b].query(qa, k=1)
        return float(dmin.min()) <= adj_gap_m

    cos_tol = np.cos(np.radians(angle_tol_deg))
    for i in range(n):
        ni, di = fits[i]
        for j in range(i + 1, n):
            nj, dj = fits[j]
            if (float(np.dot(ni, nj)) >= cos_tol and abs(di - dj) <= offset_tol_m
                    and find(i) != find(j) and adjacent(i, j)):
                parent[find(i)] = find(j)

    groups: dict[int, list[int]] = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(i)
    return list(groups.values())


def _plane_oriented_rect(
    pts: np.ndarray, normal: np.ndarray, d: float
) -> tuple[np.ndarray, float]:
    """
    Minimum-area oriented rectangle of ``pts`` *within their plane*.

    Projects points onto an orthonormal in-plane basis (u, v), computes the
    2-D convex hull, then rotates through every hull edge (rotating calipers)
    to find the enclosing rectangle with the smallest area.  This aligns panels
    to real eave / ridge edges rather than the PCA scatter axes, which can be
    skewed 45 degrees on a half-scanned pitch.

    Returns (verts4x3, rect_area_m2, coverage_area_m2); the 4 corners are
    ordered CCW in-plane.  ``rect_area`` is the full enclosing rectangle (used
    for geometry); ``coverage_area`` is the actually-occupied surface (used by
    the gates so a ragged corner sliver can't masquerade as a large pitch).
    """
    # In-plane orthonormal basis (u, v) spanning the plane; w = normal.
    ref = np.array([1.0, 0.0, 0.0]) if abs(normal[0]) < 0.9 else np.array([0.0, 1.0, 0.0])
    u = ref - normal * np.dot(ref, normal)
    u /= np.linalg.norm(u) + 1e-12
    v = np.cross(normal, u)

    c = pts.mean(axis=0)
    P = pts - c
    ab = np.column_stack([P @ u, P @ v])  # (N, 2) in-plane coords

    def _axis_aligned_box(pts2d):
        mn, mx = pts2d.min(axis=0), pts2d.max(axis=0)
        corners = np.array([[mn[0], mn[1]], [mx[0], mn[1]], [mx[0], mx[1]], [mn[0], mx[1]]])
        area = float((mx[0] - mn[0]) * (mx[1] - mn[1]))
        return corners, area

    if len(ab) < 3:
        corners_ab, best_area = _axis_aligned_box(ab)
    else:
        try:
            hull = ConvexHull(ab)
            hull_pts = ab[hull.vertices]
        except Exception:
            corners_ab, best_area = _axis_aligned_box(ab)
        else:
            n_hull = len(hull_pts)
            best_area = np.inf
            corners_ab = None
            for i in range(n_hull):
                edge = hull_pts[(i + 1) % n_hull] - hull_pts[i]
                edge_len = np.linalg.norm(edge)
                if edge_len < 1e-9:
                    continue
                e = edge / edge_len
                p = np.array([-e[1], e[0]])        # perpendicular
                R = np.column_stack([e, p])        # rotation matrix (cols = basis)
                projs = hull_pts @ R               # project all hull pts
                mn_p, mx_p = projs.min(axis=0), projs.max(axis=0)
                area = float((mx_p[0] - mn_p[0]) * (mx_p[1] - mn_p[1]))
                if area < best_area:
                    best_area = area
                    corners_frame = np.array([
                        [mn_p[0], mn_p[1]], [mx_p[0], mn_p[1]],
                        [mx_p[0], mx_p[1]], [mn_p[0], mx_p[1]]
                    ])
                    corners_ab = corners_frame @ R.T  # back to (u, v) coords
            if corners_ab is None:
                corners_ab, best_area = _axis_aligned_box(ab)

    verts = c + corners_ab[:, 0:1] * u + corners_ab[:, 1:2] * v

    cell = 0.25
    ij = np.floor(ab / cell).astype(np.int64)
    coverage_area = float(len(np.unique(ij, axis=0)) * cell * cell)

    return verts, best_area, coverage_area


def extract_roofs(
    points: np.ndarray,
    normals: np.ndarray,
    roof_dict: dict,
    roof_cos_min: float = 0.2,
    roof_cos_max: float = 0.985,
    min_segment_pts: int = 25,
    min_group_pts: int = 30,
    min_area_m2: float = 2.0,
    plane_angle_tol_deg: float = 15.0,
    plane_offset_tol_m: float = 0.40,
    plane_adj_gap_m: float = 4.0,
    grow_radius: float = 0.50,
    anchor_min_area_m2: float = 20.0,
    size_filter_ref: str = "max",
    size_filter_frac: float = 0.30,
    visualize: bool = False,
) -> list[dict]:
    """
    Build roof geometry as one tilted rectangular panel per roof plane.

    Two-stage so a roof broken up by structural beams still comes out whole:

      1. Region-grow the candidate points into planar segments (non-Manhattan,
         curvature-gated).  Beams break connectivity, so one pitch may arrive as
         several coplanar segments.
      2. Fit a plane per segment, drop non-roof slopes, then MERGE coplanar
         segments (``_group_coplanar``).  Each plane group's points are pooled and
         turned into a PCA-oriented in-plane rectangle (``_plane_oriented_rect``),
         which fully covers even a sparsely-scanned pitch.

    A gable / hip keeps its separate pitches (different normals -> different
    groups); only coplanar fragments fuse.

    ``anchor_min_area_m2``: per-floor size-anchor gate (ABSOLUTE).  If no facet on
    the floor reaches this threshold the entire floor is dropped — this rejects
    floors with no real roof (staircase tops / random spots only make small
    fragments).  Set to 0 to disable.

    ``size_filter_ref`` / ``size_filter_frac``: per-floor RELATIVE size filter
    applied after merging — keep only facets whose coverage area is at least
    ``frac`` times a reference statistic over all facet areas on the floor:
      - "max"    : frac * max(areas)    — keep only the biggest (recommended;
                   robust to how skewed / clutter-heavy the distribution is).
      - "mean"   : frac * mean(areas)   — skew puts the mean above the clutter
                   tail, but one giant pitch can drag it up and drop real medium
                   pitches.
      - "median" : frac * median(areas) — top fraction by COUNT, magnitude-blind.
    Set ``size_filter_frac`` to 0 to disable.  This trims small clutter relative
    to the real pitches; the anchor gate above still handles the no-roof case.

    Returns facet dicts for IFCBuilder.add_roof: {verts(4,3), faces(2,3),
    normal(3,), name}.  add_roof gives the panel its thickness.
    """
    roof_mask = roof_dict["roof_mask"]
    pts = points[roof_mask]
    nrm = normals[roof_mask]

    if len(pts) < min_group_pts:
        print(f"[extract_roofs] only {len(pts)} candidate pts — no roofs.")
        return []

    # ── 1. Region grow into planar segments ─────────────────────────────────
    # Larger radius than walls: roof slopes are bigger, sparser surfaces, so a
    # tight radius drops thinly-scanned pitches before they can be grouped.
    labels = region_grow_planar_segments(
        pts, nrm, radius=grow_radius, min_segment_pts=min_segment_pts,
    )

    # ── 2a. Fit a plane per segment and keep only roof-sloped ones ───────────
    seg_pts: list[np.ndarray] = []
    seg_fits: list[tuple[np.ndarray, float]] = []
    drops: dict[str, int] = {"plane": 0, "slope": 0, "area": 0, "pts": 0}
    for lab in np.unique(labels):
        if lab < 0:
            continue
        seg = pts[labels == lab]
        if len(seg) < min_segment_pts:
            continue
        fit = _fit_plane(seg)
        if fit is None:
            drops["plane"] += 1
            continue
        normal, d = fit
        # Slope gate: |nz| = cos(slope).  Too vertical = wall, too flat = ceiling.
        if not (roof_cos_min < abs(normal[2]) < roof_cos_max):
            drops["slope"] += 1
            continue
        seg_pts.append(seg)
        seg_fits.append((normal, d))

    # ── 2b. Merge coplanar segments (beam-split pieces of one roof plane) ────
    groups = _group_coplanar(
        seg_fits, seg_pts, plane_angle_tol_deg, plane_offset_tol_m, plane_adj_gap_m
    )
    print(f"[extract_roofs] {len(seg_fits)} roof segment(s) -> "
          f"{len(groups)} coplanar plane(s)")

    roofs: list[dict] = []
    for members in groups:
        pooled = np.vstack([seg_pts[m] for m in members])
        if len(pooled) < min_group_pts:
            drops["pts"] += 1
            continue

        fit = _fit_plane(pooled)
        if fit is None:
            drops["plane"] += 1
            continue
        normal, d = fit
        if not (roof_cos_min < abs(normal[2]) < roof_cos_max):
            drops["slope"] += 1
            continue

        verts, rect_area, coverage = _plane_oriented_rect(pooled, normal, d)
        # Gate on COVERAGE (actually-occupied m^2), not the bounding rectangle:
        # a ragged corner sliver has a big rectangle but tiny real coverage.
        if coverage < min_area_m2:
            drops["area"] += 1
            continue
        faces = np.array([[0, 1, 2], [0, 2, 3]], dtype=int)

        idx = len(roofs)
        print(
            f"[extract_roofs] Roof_{idx}: {len(members)} segment(s) / {len(pooled)} pts "
            f" cover={coverage:.1f} m^2 (rect={rect_area:.1f})  "
            f"slope={np.degrees(np.arccos(abs(normal[2]))):.0f}deg"
        )
        roofs.append(
            {
                "verts": verts.astype(float),
                "faces": faces,
                "normal": normal.astype(float),
                "name": f"Roof_{idx}",
                "_area": coverage,
            }
        )

    drop_str = "  ".join(f"{k}={v}" for k, v in drops.items() if v)
    print(f"[extract_roofs] accepted={len(roofs)}  dropped: {drop_str or 'none'}")

    # Per-floor RELATIVE size filter: keep only facets large relative to the
    # floor's area distribution, trimming the small-clutter tail while leaving
    # the real pitches.  "max" is the literal "keep the biggest" and is robust to
    # how skewed the distribution is; "mean"/"median" offered for comparison.
    if roofs and size_filter_frac > 0:
        areas = np.array([r["_area"] for r in roofs])
        ref = {
            "max": float(areas.max()),
            "mean": float(areas.mean()),
            "median": float(np.median(areas)),
        }.get(size_filter_ref, float(areas.max()))
        thresh = size_filter_frac * ref
        kept = [r for r in roofs if r["_area"] >= thresh]
        print(
            f"[extract_roofs] size filter ({size_filter_ref}*{size_filter_frac:g}="
            f"{thresh:.1f} m^2): kept {len(kept)}/{len(roofs)} facet(s)"
        )
        roofs = kept

    # Per-floor size-anchor gate: drop the entire floor if no facet is large
    # enough to be a real roof pitch (prevents staircase tops / random spots).
    if roofs and anchor_min_area_m2 > 0:
        max_area = max(r["_area"] for r in roofs)
        if max_area < anchor_min_area_m2:
            print(
                f"[extract_roofs] anchor gate: largest facet {max_area:.1f} m^2 "
                f"< {anchor_min_area_m2:.1f} m^2 — dropping {len(roofs)} facet(s)."
            )
            roofs = []
        else:
            print(
                f"[extract_roofs] anchor gate: largest facet {max_area:.1f} m^2 "
                f">= {anchor_min_area_m2:.1f} m^2 — keeping all {len(roofs)} facet(s)."
            )
    for r in roofs:
        r.pop("_area", None)

    if visualize:
        debug_roofs(points, roof_mask, labels, roofs)

    return roofs
