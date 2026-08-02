import numpy as np
import open3d as o3d
import matplotlib.pyplot as plt

_CLUSTER_PALETTE = np.array([
    [0.25, 0.25, 0.25],  # 0  noise → dark gray
    [0.92, 0.30, 0.25],  # 1  coral-red
    [0.25, 0.65, 0.89],  # 2  sky-blue
    [0.30, 0.78, 0.55],  # 3  teal-green
    [0.97, 0.72, 0.22],  # 4  amber
    [0.70, 0.45, 0.90],  # 5  purple
    [0.95, 0.55, 0.30],  # 6  orange
    [0.40, 0.80, 0.75],  # 7  cyan
    [0.85, 0.35, 0.65],  # 8  pink
    [0.55, 0.85, 0.30],  # 9  lime
    [0.20, 0.45, 0.80],  # 10 deep-blue
    [0.90, 0.85, 0.25],  # 11 yellow
    [0.60, 0.20, 0.20],  # 12 dark-red
    [0.20, 0.60, 0.40],  # 13 forest-green
    [0.80, 0.60, 0.90],  # 14 lavender
    [0.95, 0.40, 0.70],  # 15 hot-pink
    [0.30, 0.80, 0.90],  # 16 aqua
    [0.70, 0.50, 0.20],  # 17 brown
    [0.50, 0.90, 0.60],  # 18 mint
    [0.90, 0.65, 0.40],  # 19 peach
], dtype=float)


def _wall_box(w: dict) -> tuple:
    """
    Build an 8-vertex box mesh + 12-edge wireframe for a single wall dict.

    The box spans start_pt → end_pt along the face, 0 → height vertically,
    and 0 → thickness in the wall-normal direction.

    Returns
    -------
    mesh      : o3d.geometry.TriangleMesh  (solid, uncolored)
    verts_8   : (8, 3) np.ndarray          (for wireframe construction)
    """
    s   = np.asarray(w["start_pt"], dtype=float)        # bottom-start on ref face
    e   = np.asarray(w["end_pt"],   dtype=float)        # bottom-end   on ref face
    nrm = np.asarray(w["wall_nrm"], dtype=float)        # (2,) XY unit normal
    h   = float(w["height"])
    t   = float(w["thickness"])

    dz     = np.array([0.0, 0.0, h])
    offset = np.array([nrm[0] * t, nrm[1] * t, 0.0])  # thickness vector in 3-D

    # 8 vertices: front face (ref plane) then back face (ref + thickness)
    #   0 s            1 e            2 e+dz          3 s+dz
    #   4 s+off        5 e+off        6 e+dz+off      7 s+dz+off
    verts = np.array([
        s,            e,            e + dz,       s + dz,        # front
        s + offset,   e + offset,   e + dz + offset, s + dz + offset,  # back
    ])

    # 12 triangles — CCW winding viewed from outside each face
    tris = np.array([
        [0, 1, 2], [0, 2, 3],        # front  face
        [5, 4, 7], [5, 7, 6],        # back   face  (reversed winding)
        [4, 0, 3], [4, 3, 7],        # left   end
        [1, 5, 6], [1, 6, 2],        # right  end
        [4, 5, 1], [4, 1, 0],        # bottom face
        [3, 2, 6], [3, 6, 7],        # top    face
    ], dtype=np.int32)

    mesh = o3d.geometry.TriangleMesh()
    mesh.vertices  = o3d.utility.Vector3dVector(verts)
    mesh.triangles = o3d.utility.Vector3iVector(tris)
    mesh.compute_vertex_normals()

    return mesh, verts


def visualize_floors(
    floor_pcds: list[o3d.geometry.PointCloud],
    title: str = "Floor split",
    extra_geometries: list | None = None,
):
    """
    Color each floor a distinct hue and show all together in an Open3D window.
    extra_geometries: optional pre-coloured geometries (e.g. peak strips) drawn
    on top of the floor colours without being recoloured.
    """
    palette = [
        [0.92, 0.30, 0.25],  # coral-red
        [0.25, 0.65, 0.89],  # sky-blue
        [0.30, 0.78, 0.55],  # teal-green
        [0.97, 0.72, 0.22],  # amber
        [0.70, 0.45, 0.90],  # purple
        [0.95, 0.55, 0.30],  # orange
        [0.40, 0.80, 0.75],  # cyan
        [0.85, 0.35, 0.65],  # pink
    ]

    combined = []
    for i, pcd in enumerate(floor_pcds):
        colored = o3d.geometry.PointCloud(pcd)
        colored.paint_uniform_color(palette[i % len(palette)])
        combined.append(colored)

    if extra_geometries:
        combined.extend(extra_geometries)

    print(f"[visualize_floors] Opening viewer for {len(floor_pcds)} floors …")
    o3d.visualization.draw_geometries(
        combined,
        window_name=title,
        width=1280,
        height=720,
        point_show_normal=False,
    )


def _make_colored_pcd(
    points: np.ndarray,
    color: list | np.ndarray,
) -> o3d.geometry.PointCloud:
    """Return a new PointCloud with all points set to one RGB color (0-1)."""
    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(points)
    colors = np.tile(np.asarray(color, dtype=float), (len(points), 1))
    pcd.colors = o3d.utility.Vector3dVector(colors)
    return pcd


def _label_colors(points: np.ndarray, labels: np.ndarray) -> o3d.geometry.PointCloud:
    """
    Color a point cloud by DBSCAN label.
    label == -1  → dark gray (noise)
    label >= 0   → cycles through _CLUSTER_PALETTE[1:]
    """
    colors = np.zeros((len(points), 3), dtype=float)
    for lab in np.unique(labels):
        mask = labels == lab
        if lab == -1:
            colors[mask] = _CLUSTER_PALETTE[0]   # noise
        else:
            colors[mask] = _CLUSTER_PALETTE[1 +
                                            (lab % (len(_CLUSTER_PALETTE) - 1))]
    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(points)
    pcd.colors = o3d.utility.Vector3dVector(colors)
    return pcd

def debug_ransac_planes(
    planes: list,
    remaining_cloud: o3d.geometry.PointCloud,
    orientation_deg: float | None = None,
) -> None:
    """
    Visualize iterative RANSAC plane extraction results.

    Each detected plane's inliers get a distinct colour from the cluster
    palette.  Points that didn't fit any plane are shown in dark gray.
    Plane normals and inlier counts are printed to the console.
    """
    geometries = []

    for i, plane in enumerate(planes):
        color = _CLUSTER_PALETTE[1 + (i % (len(_CLUSTER_PALETTE) - 1))]
        pcd = o3d.geometry.PointCloud(plane["inlier_cloud"])
        pcd.paint_uniform_color(color.tolist())
        geometries.append(pcd)
        a, b, c, d = plane["plane_model"]
        n_pts = len(plane["inlier_cloud"].points)
        print(f"  plane {i}: normal=({a:.3f},{b:.3f},{c:.3f}) d={d:.3f}  inliers={n_pts:,}")

    if len(remaining_cloud.points) > 0:
        rem = o3d.geometry.PointCloud(remaining_cloud)
        rem.paint_uniform_color([0.25, 0.25, 0.25])
        geometries.append(rem)

    n_remaining = len(remaining_cloud.points)
    title_suffix = f"  orient={orientation_deg:.0f}°" if orientation_deg is not None else ""
    title = (f"RANSAC planes — {len(planes)} plane(s)  "
             f"{n_remaining:,} remaining pts{title_suffix}")
    print(f"[debug_ransac_planes] {len(planes)} plane(s), {n_remaining:,} remaining")
    o3d.visualization.draw_geometries(
        geometries,
        window_name=title,
        width=1280, height=720,
    )


def debug_floors(hist, bin_size, n_bins, min_prominence, peaks, widths, bin_centers, edges, z_max, z_min):
        print(f"[split_floors] bin_size={bin_size:.3f} m, n_bins={n_bins}, "
              f"prominence_threshold={min_prominence:.0f}")
        print(f"[split_floors] Detected {len(peaks)} floor peak(s):")
        for p, w in zip(peaks, widths):
            print(f"  bin {p:4d}  z≈{bin_centers[p]:.3f} m  "
                  f"count={hist[p]:6d}  width={w:.1f} bins ({w * bin_size:.2f} m)")

        fig, ax = plt.subplots(figsize=(9, 4))
        bw = edges[1] - edges[0]
        ax.bar(bin_centers, hist, width=bw, align="center",
               alpha=0.55, color="#4A90D9", label="Z histogram")
        ax.plot(bin_centers[peaks], hist[peaks],
                "rx", ms=8, label="floor peaks")
        z_bounds = np.hstack(([z_min], np.sort(bin_centers[peaks]), [z_max]))
        for zb in z_bounds:
            ax.axvline(zb, linestyle="--", color="k", alpha=0.4, linewidth=0.8)
        ax.set_xlabel("Z coordinate (m)")
        ax.set_ylabel("Point count")
        ax.set_title(f"Z histogram  | bin_size={bin_size:.3f} m | {len(peaks)} peak(s)")
        ax.legend()
        fig.tight_layout()
        plt.show()


def debug_floor_profile(
    z_centers: np.ndarray,
    area_prof_m2: np.ndarray,
    occ_prof_m2: np.ndarray,
    surf_peaks: np.ndarray,
    floor_levels: list,
    cuts: list,
) -> None:
    """
    Plot the horizontal-area floor-detection profile (replaces the old Z count
    histogram view).

    Horizontal axis is elevation Z.  Two curves:
      blue  = horizontal-surface area per Z bin (slab detector; peaks = floors/ceilings)
      gray  = all-points occupied area per Z bin (void detector)
    Red x   = detected slab surfaces.
    Green | = accepted FLOOR datums.
    Black --= storey cut planes.
    """
    fig, ax = plt.subplots(figsize=(11, 4))
    ax.plot(z_centers, area_prof_m2, color="#4A90D9", lw=1.4,
            label="horizontal-surface area / bin")
    ax.plot(z_centers, occ_prof_m2, color="#999999", lw=1.0, alpha=0.8,
            label="all-points occupied area / bin (void detector)")

    ax.plot(z_centers[surf_peaks], area_prof_m2[surf_peaks], "rx", ms=9,
            markeredgewidth=2, label="slab surfaces")

    for k, d in enumerate(floor_levels):
        ax.axvline(d["z_floor"], color="green", lw=1.4, alpha=0.7,
                   label="floor datum" if k == 0 else None)
    for k, c in enumerate(cuts):
        ax.axvline(c, color="black", ls="--", lw=0.9, alpha=0.5,
                   label="storey cut" if k == 0 else None)

    ax.set_xlabel("Z elevation (m)")
    ax.set_ylabel("Area (m2)")
    ax.set_title(f"Floor area profile  -  {len(floor_levels)} storey(s), "
                 f"{len(surf_peaks)} slab surface(s)")
    ax.legend(fontsize=8)
    fig.tight_layout()
    plt.show()


def debug_floor(points):
    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(points)
    o3d.visualization.draw_geometries([pcd])


def debug_slabs(
    points: np.ndarray,
    floor_band: np.ndarray,
    ceil_band: np.ndarray,
) -> None:
    """
    View 1 — slab layer classification.
      amber  = floor band points
      teal   = ceiling band points
      gray   = everything else
    Useful for checking whether slab_tol and the detected z_floor/z_ceiling
    are correctly biting into the horizontal surfaces.
    """
    rest = ~floor_band & ~ceil_band
    geometries = []
    if floor_band.any():
        geometries.append(_make_colored_pcd(
            points[floor_band], [0.97, 0.72, 0.22]))  # amber
    if ceil_band.any():
        geometries.append(_make_colored_pcd(
            points[ceil_band],  [0.30, 0.78, 0.55]))  # teal
    if rest.any():
        geometries.append(_make_colored_pcd(
            points[rest],       [0.55, 0.55, 0.55]))  # gray

    print("[debug view 1] floor band pts:", floor_band.sum(),
          "  ceiling band pts:", ceil_band.sum(),
          "  rest:", rest.sum())
    o3d.visualization.draw_geometries(
        geometries,
        window_name="Debug 1 — slab bands  (amber=floor  teal=ceiling  gray=rest)",
        width=1280, height=720,
    )


def debug_walls(walls: list) -> None:
    """
    Debug view: final accepted wall rectangles as green wireframe boxes.
    Each wall's 4 corners are connected as a closed loop.
    """
    if not walls:
        print("[debug walls] no walls to display")
        return

    all_verts = []
    lines = []
    offset = 0
    for w in walls:
        _, v8 = _wall_box(w)  # (8, 3)
        all_verts.append(v8)
        # 12 edges of the box:  4 front + 4 back + 4 connecting pillars
        front  = [(0,1),(1,2),(2,3),(3,0)]
        back   = [(4,5),(5,6),(6,7),(7,4)]
        pillars= [(0,4),(1,5),(2,6),(3,7)]
        for a, b in front + back + pillars:
            lines.append([offset + a, offset + b])
        offset += 8

    pts_np = np.vstack(all_verts)
    line_set = o3d.geometry.LineSet()
    line_set.points = o3d.utility.Vector3dVector(pts_np)
    line_set.lines  = o3d.utility.Vector2iVector(lines)
    line_set.paint_uniform_color([0.1, 0.9, 0.1])   # bright green

    print(f"[debug walls] {len(walls)} wall rectangle(s)")
    o3d.visualization.draw_geometries(
        [line_set],
        window_name=f"Debug — Walls  ({len(walls)} rectangles)",
        width=1280, height=720,
    )


def debug_wall_polygons(
    all_wall_points: np.ndarray,
    all_labels: np.ndarray,
    walls: list,
) -> None:
    """
    Combined view: DBSCAN-colored input points + accepted wall rectangles.

    Input points are colored by cluster label (same palette as debug_dbscan).
    Each accepted wall rectangle is rendered as a solid mesh (light blue) so
    you can judge whether the rectangle correctly covers the cluster beneath it.
    Rectangle edges are also drawn in white for clarity.
    """
    geometries = []

    # ── Input: point cloud colored by cluster label ──────────────────────────
    pcd = _label_colors(all_wall_points, all_labels)
    geometries.append(pcd)

    # ── Output: wall rectangles as solid meshes + wireframe edges ─────────────
    wall_color  = [0.55, 0.80, 0.95]   # light blue fill
    edge_color  = [1.00, 1.00, 1.00]   # white edges

    all_edge_pts = []
    all_edge_idx = []
    edge_offset  = 0

    for w in walls:
        mesh, v8 = _wall_box(w)  # full-thickness box

        mesh.paint_uniform_color(wall_color)
        geometries.append(mesh)

        # Wireframe: 12 edges of the box
        all_edge_pts.append(v8)
        front   = [(0,1),(1,2),(2,3),(3,0)]
        back    = [(4,5),(5,6),(6,7),(7,4)]
        pillars = [(0,4),(1,5),(2,6),(3,7)]
        for a, b in front + back + pillars:
            all_edge_idx.append([edge_offset + a, edge_offset + b])
        edge_offset += 8

    if all_edge_pts:
        ls = o3d.geometry.LineSet()
        ls.points = o3d.utility.Vector3dVector(np.vstack(all_edge_pts))
        ls.lines  = o3d.utility.Vector2iVector(all_edge_idx)
        ls.paint_uniform_color(edge_color)
        geometries.append(ls)

    n_clusters = len(np.unique(all_labels[all_labels >= 0]))
    print(
        f"[debug wall polygons] "
        f"clusters={n_clusters}  accepted walls={len(walls)}"
    )
    o3d.visualization.draw_geometries(
        geometries,
        window_name=f"Wall polygons — {len(walls)} accepted  ({n_clusters} clusters)",
        width=1280,
        height=720,
    )


def debug_roofs(
    points: np.ndarray,
    roof_mask: np.ndarray,
    labels: np.ndarray,
    roofs: list,
) -> None:
    """
    Combined view: roof candidate points + accepted roof facets.

    Non-candidate points are gray context; roof candidate points are colored by
    region-grow segment label (same palette as the wall views); each accepted
    facet is rendered as a solid triangle mesh with white wireframe edges, so you
    can judge whether the slanted surface tracks the points beneath it.

    points    : (N, 3) full floor point cloud
    roof_mask : (N,)   bool — candidate points fed to the region grower
    labels    : (M,)   region-grow labels over points[roof_mask] (-1 = unused)
    roofs     : list of facet dicts with "verts" (K,3) and "faces" (L,3)
    """
    geometries = []

    # ── Context: non-candidate points in gray ────────────────────────────────
    rest = ~roof_mask
    if rest.any():
        geometries.append(_make_colored_pcd(points[rest], [0.55, 0.55, 0.55]))

    # ── Candidate points colored by region-grow segment label ────────────────
    if roof_mask.any():
        geometries.append(_label_colors(points[roof_mask], labels))

    # ── Output: accepted facets as solid meshes + wireframe edges ─────────────
    facet_color = [0.95, 0.55, 0.35]   # warm orange fill
    edge_color  = [1.00, 1.00, 1.00]   # white edges

    for r in roofs:
        verts = np.asarray(r["verts"], dtype=float)
        faces = np.asarray(r["faces"], dtype=int)
        if len(verts) == 0 or len(faces) == 0:
            continue

        mesh = o3d.geometry.TriangleMesh()
        mesh.vertices  = o3d.utility.Vector3dVector(verts)
        mesh.triangles = o3d.utility.Vector3iVector(faces)
        mesh.compute_vertex_normals()
        mesh.paint_uniform_color(facet_color)
        geometries.append(mesh)

        # Wireframe: the three edges of every triangle
        edge_idx = []
        for tri in faces:
            edge_idx += [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]]
        ls = o3d.geometry.LineSet()
        ls.points = o3d.utility.Vector3dVector(verts)
        ls.lines  = o3d.utility.Vector2iVector(edge_idx)
        ls.paint_uniform_color(edge_color)
        geometries.append(ls)

    n_seg = len(np.unique(labels[labels >= 0])) if labels.size else 0
    print(
        f"[debug roofs] candidate pts={int(roof_mask.sum()):,}  "
        f"segments={n_seg}  accepted facets={len(roofs)}"
    )
    o3d.visualization.draw_geometries(
        geometries,
        window_name=f"Roofs — {len(roofs)} facet(s)  ({n_seg} segments)",
        width=1280, height=720,
    )


def debug_angle_groups(
    points: np.ndarray,
    angle_labels: np.ndarray,
    peak_angles_deg: np.ndarray,
) -> None:
    """
    Open3D view showing the angle-group assignment BEFORE DBSCAN runs.

    Each orientation group gets a distinct colour from the cluster palette.
    Points that fell outside all angle windows (angle_labels == -1) are shown
    in dark grey — these are the points that DBSCAN never sees.  A large grey
    mass indicates the angle window is too tight and will fragment walls.
    """
    geometries = []
    n_discarded = int((angle_labels == -1).sum())

    # One colour per orientation group, grey for discarded
    for grp_idx, ang in enumerate(peak_angles_deg):
        mask = angle_labels == grp_idx
        if not mask.any():
            continue
        color = _CLUSTER_PALETTE[1 + (grp_idx % (len(_CLUSTER_PALETTE) - 1))]
        geometries.append(_make_colored_pcd(points[mask], color))

    discarded_mask = angle_labels == -1
    if discarded_mask.any():
        geometries.append(_make_colored_pcd(points[discarded_mask], [0.25, 0.25, 0.25]))

    label_str = "  ".join(f"grp{i}={a:.0f}°" for i, a in enumerate(peak_angles_deg))
    print(f"[debug angle groups] {label_str}  |  discarded (grey): {n_discarded:,}")
    o3d.visualization.draw_geometries(
        geometries,
        window_name=f"Angle groups before DBSCAN — grey={n_discarded:,} discarded pts",
        width=1280, height=720,
    )


def debug_orientation_histogram(
    hist: np.ndarray,
    bin_centers_ang: np.ndarray,
    peaks_idx: np.ndarray,
    peak_angles_deg: np.ndarray,
    prom_threshold: float,
) -> None:
    """
    Matplotlib bar chart of the wall-normal orientation histogram.

    Shows the smoothed point-count per 1° bin, a dashed line at the
    prominence threshold, and a red marker + angle label at each detected peak.
    Voronoi midpoints between adjacent peaks are drawn as vertical dividers so
    you can see exactly where the group boundaries fall.
    """
    fig, ax = plt.subplots(figsize=(10, 4))

    bw = bin_centers_ang[1] - bin_centers_ang[0] if len(bin_centers_ang) > 1 else 1.0
    ax.bar(bin_centers_ang, hist, width=bw, align="center",
           alpha=0.55, color="#4A90D9", label="point count per °")

    ax.axhline(prom_threshold, linestyle="--", color="orange", linewidth=1.2,
               label=f"prominence threshold ({prom_threshold:.0f})")

    # Voronoi boundaries between adjacent peaks
    sorted_angles = np.sort(peak_angles_deg)
    for a, b in zip(sorted_angles[:-1], sorted_angles[1:]):
        mid = 0.5 * (a + b)
        ax.axvline(mid, linestyle=":", color="grey", linewidth=1.0, alpha=0.7)

    # Peak markers + angle labels
    for i, (pidx, ang) in enumerate(zip(peaks_idx, peak_angles_deg)):
        ax.axvline(ang, linestyle="-", color="red", linewidth=0.8, alpha=0.6)
        ax.plot(ang, hist[pidx], "rx", ms=10, markeredgewidth=2,
                label="detected peak" if i == 0 else None)
        ax.text(ang, hist[pidx] * 1.02, f"{ang:.0f}°",
                ha="center", va="bottom", fontsize=8, color="red")

    ax.set_xlim(-1, 181)
    ax.set_xlabel("Wall-normal angle (°)")
    ax.set_ylabel("Point count")
    ax.set_title(f"Orientation histogram — {len(peak_angles_deg)} peak(s) detected")
    ax.legend(fontsize=8)
    fig.tight_layout()
    plt.show()


def debug_dbscan(
    all_wall_points: np.ndarray,
    all_labels: np.ndarray,
) -> None:
    """
    View 3 — DBSCAN cluster labels across all axis buckets.
      unique color per cluster label (cycles through palette)
      dark gray = noise (label -1)
    Only accepted wall points (those that reached DBSCAN) are shown,
    so you can directly see which clusters survived and which were noise.
    """
    n_clusters = len(np.unique(all_labels[all_labels >= 0]))
    n_noise = int((all_labels == -1).sum())
    print(f"[debug view 2] total pts in DBSCAN: {len(all_wall_points)}"
          f"  clusters: {n_clusters}  noise pts: {n_noise}")

    pcd = _label_colors(all_wall_points, all_labels)
    o3d.visualization.draw_geometries(
        [pcd],
        window_name=f"Debug 2 — DBSCAN labels  ({n_clusters} clusters  {n_noise} noise pts)",
        width=1280, height=720,
    )

