import numpy as np
import ifcopenshell.api.root
import ifcopenshell.api.unit
import ifcopenshell.api.context
import ifcopenshell.api.project
import ifcopenshell.api.spatial
import ifcopenshell.api.geometry
import ifcopenshell.api.aggregate
import ifcopenshell.api.feature


def _slab_plane_z(corners3, mode="mean"):
    c = np.asarray(corners3, float)
    if mode == "min":
        return float(np.min(c[:, 2]))
    if mode == "max":
        return float(np.max(c[:, 2]))
    return float(np.mean(c[:, 2]))


def uniform_storey_from_slabs(floors, ceils):
    """Return (elev, height) or (None, None) if not available."""
    if not floors or not ceils:
        return None, None

    floor_z = min(_slab_plane_z(f["corners"], mode="mean") for f in floors)
    ceil_z = max(_slab_plane_z(c["corners"], mode="mean") for c in ceils)

    elev = float(floor_z)
    height = float(max(0.0, ceil_z - floor_z))
    return elev, height


class IFCBuilder:
    def __init__(self, project_name="test Project"):
        self.model: ifcopenshell.file = ifcopenshell.api.project.create_file()

        project = ifcopenshell.api.root.create_entity(
            self.model, ifc_class="IfcProject", name=project_name
        )

        length = ifcopenshell.api.unit.add_si_unit(self.model, unit_type="LENGTHUNIT")
        area  = ifcopenshell.api.unit.add_si_unit(self.model, unit_type="AREAUNIT")

        ifcopenshell.api.unit.assign_unit(self.model, units=[length, area])

        context = ifcopenshell.api.context.add_context(self.model, context_type="Model")
        self.body = ifcopenshell.api.context.add_context(
            self.model,
            context_type="Model",
            context_identifier="Body",
            target_view="MODEL_VIEW",
            parent=context,
        )

        self.site = ifcopenshell.api.root.create_entity(
            self.model, ifc_class="IfcSite", name="My Site"
        )
        self.building = ifcopenshell.api.root.create_entity(
            self.model, ifc_class="IfcBuilding", name="Building A"
        )

        ifcopenshell.api.aggregate.assign_object(
            self.model, relating_object=project, products=[self.site]
        )
        ifcopenshell.api.aggregate.assign_object(
            self.model, relating_object=self.site, products=[self.building]
        )

    def add_storey(self, level):
        self.storey = ifcopenshell.api.root.create_entity(
            self.model, ifc_class="IfcBuildingStorey", name=f"floor{level}"
        )
        ifcopenshell.api.aggregate.assign_object(
            self.model, relating_object=self.building, products=[self.storey]
        )

    def add_walls(self, walls):
        for i, wall in enumerate(walls):
            p1v = np.asarray(wall["start_pt"][:2], dtype=float)
            p2v = np.asarray(wall["end_pt"][:2], dtype=float)
            thickness = float(wall["thickness"])

            # create_2pt_wall builds the solid from y=0 to y=+thickness in the
            # local frame (entirely on the CCW side of p1->p2), but start/end
            # are the fitted wall CENTERLINE — shift the axis half a thickness
            # so the solid is centred on the fit.
            v = p2v - p1v
            v_len = float(np.linalg.norm(v))
            if v_len < 1e-9:
                continue
            v /= v_len
            y_dir = np.array([-v[1], v[0]])
            p1 = tuple(p1v - 0.5 * thickness * y_dir)
            p2 = tuple(p2v - 0.5 * thickness * y_dir)

            w = ifcopenshell.api.root.create_entity(
                self.model, ifc_class="IfcWall", name=f"Wall_{i:02d}"
            )
            rep = ifcopenshell.api.geometry.create_2pt_wall(
                self.model,
                element=w,
                context=self.body,
                p1=p1,
                p2=p2,
                elevation=float(wall["z_base"]),
                height=float(wall["height"]),
                thickness=thickness,
            )
            ifcopenshell.api.geometry.assign_representation(
                self.model, product=w, representation=rep
            )
            ifcopenshell.api.spatial.assign_container(
                self.model, relating_structure=self.storey, products=[w]
            )

            for oi, op in enumerate(wall.get("openings", []) or []):
                self._cut_opening(w, wall, op, i, oi)

    def _cut_opening(self, wall_elem, wall, op, wi, oi):
        """Cut a detected door/window as an IfcOpeningElement (void through the wall)."""
        a = np.asarray(op["pA"], dtype=float)
        b = np.asarray(op["pB"], dtype=float)
        v = b - a
        L = float(np.linalg.norm(v))
        if L < 1e-6:
            return
        d = v / L
        y_dir = np.array([-d[1], d[0]])
        th = float(wall["thickness"]) + 0.20          # overshoot both faces -> clean cut
        p1 = tuple(a - 0.5 * th * y_dir)
        p2 = tuple(b - 0.5 * th * y_dir)
        z0 = float(op["z0"])
        h = max(float(op["z1"]) - z0, 0.1)
        op_el = ifcopenshell.api.root.create_entity(
            self.model, ifc_class="IfcOpeningElement", name=f"Op_{wi:02d}_{oi}"
        )
        rep = ifcopenshell.api.geometry.create_2pt_wall(
            self.model, element=op_el, context=self.body,
            p1=p1, p2=p2, elevation=z0, height=h, thickness=th,
        )
        ifcopenshell.api.geometry.assign_representation(
            self.model, product=op_el, representation=rep
        )
        ifcopenshell.api.feature.add_feature(
            self.model, feature=op_el, element=wall_elem
        )

    def add_slab(
        self, name, polygon_xy, z_elevation, depth=0.25, direction_sense="NEGATIVE"
    ):
        """
        Create an IfcSlab with proper solid thickness via IfcExtrudedAreaSolid.

        polygon_xy:      (N, 2) float array — outer boundary in world XY
        z_elevation:     float — Z position of the slab's reference face
        depth:           float — slab thickness in metres (default 0.25 m)
        direction_sense: 'NEGATIVE' extrudes downward (floor slab, top face at z_elevation)
                         'POSITIVE' extrudes upward   (ceiling slab, bottom face at z_elevation)
        """
        slab = ifcopenshell.api.root.create_entity(
            self.model, ifc_class="IfcSlab", name=name
        )

        # Placement — sets the local origin to z_elevation so the polyline
        # XY coords are in world space and Z is the slab reference face
        matrix = np.eye(4)
        matrix[2, 3] = float(z_elevation)
        ifcopenshell.api.geometry.edit_object_placement(
            self.model, product=slab, matrix=matrix
        )

        # Convert (N,2) array to list of (x, y) tuples as the API expects
        polyline = [(float(x), float(y)) for x, y in polygon_xy]

        rep = ifcopenshell.api.geometry.add_slab_representation(
            self.model,
            context=self.body,
            depth=float(depth),
            direction_sense=direction_sense,
            polyline=polyline,
        )
        ifcopenshell.api.geometry.assign_representation(
            self.model, product=slab, representation=rep
        )
        ifcopenshell.api.spatial.assign_container(
            self.model, relating_structure=self.storey, products=[slab]
        )

    def add_roof(self, roof_facet: dict, idx: int, thickness: float = 0.2):
        """
        Create an IfcRoof from a slanted roof facet produced by extract_roofs().

        roof_facet keys (from roof_util.extract_roofs):
            verts     : list of [x, y, z]  — triangulated surface vertices
            faces     : list of [i, j, k]  — triangle indices into verts
            normal    : [nx, ny, nz]       — unit normal (z > 0)
            name      : str
        """
        verts = np.asarray(roof_facet["verts"], dtype=float)
        faces = np.asarray(roof_facet["faces"], dtype=int)
        normal = np.asarray(roof_facet["normal"], dtype=float)

        if len(verts) == 0 or len(faces) == 0:
            print(f"[add_roof] Roof_{idx}: empty geometry — skipped.")
            return

        half = thickness / 2.0
        verts_top = verts + normal * half
        verts_bot = verts - normal * half

        ifc_pts_top = [
            self.model.createIfcCartesianPoint((float(v[0]), float(v[1]), float(v[2])))
            for v in verts_top
        ]
        ifc_pts_bot = [
            self.model.createIfcCartesianPoint((float(v[0]), float(v[1]), float(v[2])))
            for v in verts_bot
        ]

        ifc_faces = []

        for tri in faces:
            i, j, k = int(tri[0]), int(tri[1]), int(tri[2])
            loop = self.model.createIfcPolyLoop([ifc_pts_top[i], ifc_pts_top[j], ifc_pts_top[k]])
            ifc_faces.append(self.model.createIfcFace([self.model.createIfcFaceOuterBound(loop, True)]))

        for tri in faces:
            i, j, k = int(tri[0]), int(tri[1]), int(tri[2])
            loop = self.model.createIfcPolyLoop([ifc_pts_bot[i], ifc_pts_bot[k], ifc_pts_bot[j]])
            ifc_faces.append(self.model.createIfcFace([self.model.createIfcFaceOuterBound(loop, True)]))

        edge_count = {}
        for tri in faces:
            for a, b in [(tri[0], tri[1]), (tri[1], tri[2]), (tri[2], tri[0])]:
                key = (min(int(a), int(b)), max(int(a), int(b)))
                edge_count.setdefault(key, []).append((int(a), int(b)))

        for (va, vb), occurrences in edge_count.items():
            if len(occurrences) != 1:
                continue
            a, b = occurrences[0]
            loop = self.model.createIfcPolyLoop([
                ifc_pts_top[a], ifc_pts_top[b], ifc_pts_bot[b], ifc_pts_bot[a]
            ])
            ifc_faces.append(self.model.createIfcFace([self.model.createIfcFaceOuterBound(loop, True)]))

        shell = self.model.createIfcClosedShell(ifc_faces)
        brep  = self.model.createIfcFacetedBrep(shell)

        # ── KEY FIX: keyword args so context binding is unambiguous ──────────
        rep = self.model.createIfcShapeRepresentation(
            ContextOfItems=self.body,
            RepresentationIdentifier="Body",
            RepresentationType="Brep",
            Items=[brep],
        )

        roof = ifcopenshell.api.root.create_entity(
            self.model, ifc_class="IfcRoof", name=roof_facet.get("name", f"Roof_{idx}")
        )
        matrix = np.eye(4)
        ifcopenshell.api.geometry.edit_object_placement(
            self.model, product=roof, matrix=matrix
        )
        ifcopenshell.api.geometry.assign_representation(
            self.model, product=roof, representation=rep
        )
        ifcopenshell.api.spatial.assign_container(
            self.model, relating_structure=self.storey, products=[roof]
        )

    def write(self, path):
        self.model.write(path)
