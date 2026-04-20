# m-hub-planimport

Interactive PDF floor-plan import tool. Upload a PDF (CAD vector export *or*
scanned hand drawing), get back a set of line segments; then manually mark
walls, exclude doors/windows, calibrate the scale, draw floor polygons, and
assign per-wall material layers from the German
[ÖKOBAU.dat](https://www.oekobaudat.de) sustainable construction database.

Part of the [m-hub](../) project suite.

## Architecture

```
m-hub-planimport/
├── backend/     Node + Express + TypeScript
│   └── src/
│       ├── services/
│       │   ├── pdfExtract.ts    pdfjs-dist vector path extraction
│       │   ├── rasterize.ts     PDF → PNG via @napi-rs/canvas
│       │   ├── vectorize.ts     opencv-wasm Hough line fallback
│       │   ├── oekobaudat.ts    ÖKOBAU.dat search proxy + cache
│       │   └── pipeline.ts      orchestrator
│       ├── store.ts             JSON-on-disk persistence
│       └── index.ts             Express routes
│
└── frontend/    Angular 18.2 + Material 17 (theme copied from m-hub-frontend)
    └── src/app/
        ├── components/
        │   ├── plan-list/         upload + list
        │   ├── plan-editor/       toolbar shell + calibration dialog
        │   ├── plan-viewer/       SVG canvas with pan / zoom / tool handling
        │   └── material-panel/    ÖKOBAU.dat autocomplete + layer editor
        ├── services/plan.service.ts
        └── models/plan.model.ts
```

## Pipeline

1. **Upload** — user picks a PDF, backend receives it via multer.
2. **Rasterize** — the first page is always rendered to PNG (used as the
   background image behind the SVG overlay).
3. **Vector extraction** — `pdfjs-dist` walks the page operator list
   (`moveTo` / `lineTo` / `curveTo` / `rectangle` / paint ops) and flattens
   every path into straight segments (cubic Béziers are adaptively
   subdivided). Output is deduplicated.
4. **Raster fallback** — if the PDF yields fewer than 20 segments we treat it
   as a scan: the rendered PNG is run through opencv-wasm
   (adaptive threshold → morphological close → Canny → `HoughLinesP`),
   collinear results are merged, and coordinates are scaled back to PDF
   user-space so downstream code doesn't care where the segments came from.
5. **Interactive editing** — the user opens the plan, calibrates the scale
   (two clicks + known distance in mm), then uses the tool palette to mark
   segments as `wall` or `excluded`, draw floor polygons, and assign
   materials.
6. **Persistence** — saved as JSON under `backend/data/plans/<id>.json`;
   uploaded PDFs under `backend/data/uploads/`; rasters under
   `backend/data/raster/`.

Auto wall classification (exterior / party / interior) and automatic
floor-polygon extraction are deferred to v2 — the data model has the shape
already (`kind`, `polygons`).

## Tools

| Tool          | Hotkey hint                    | What it does                                       |
|---------------|--------------------------------|----------------------------------------------------|
| Pan           | hold **Space** at any time     | Drag to pan                                        |
| Select        |                                | Click a segment to edit its materials              |
| Mark wall     |                                | Click raw segments to promote to `wall`            |
| Mark excluded |                                | Click to mask doors, windows, furniture            |
| Calibrate     |                                | Two clicks + enter real distance in mm             |
| Polygon       | **Enter** to close, **Esc** to cancel | Click vertices to draw a floor polygon      |

Mouse wheel zooms at the cursor position.

## Running

### Prerequisites
- Node.js 20+
- npm

### Backend

```bash
cd backend
npm install
npm run dev       # http://localhost:3200
```

### Frontend

```bash
cd frontend
npm install
npm start         # http://localhost:4300
```

The Angular dev server proxies `/api` → `http://localhost:3200` via
`proxy.conf.json`.

### Ports
- Backend: `3200`
- Frontend dev server: `4300` (configure via `ng serve --port 4300`, or
  leave default 4200)

## Backend API

| Method | Path                           | Purpose                                      |
|--------|--------------------------------|----------------------------------------------|
| GET    | `/api/health`                  | Liveness probe                               |
| GET    | `/api/plan`                    | List plan summaries                          |
| POST   | `/api/plan/upload`             | Multipart PDF upload → runs pipeline         |
| GET    | `/api/plan/:id`                | Full PlanDoc                                 |
| PUT    | `/api/plan/:id`                | Save edited segments / polygons / calibration|
| GET    | `/api/plan/:id/raster`         | Rendered background PNG                      |
| GET    | `/api/plan/:id/pdf`            | Original uploaded PDF                        |
| GET    | `/api/materials/search?q=...`  | ÖKOBAU.dat search (proxied + cached)         |

## ÖKOBAU.dat integration

The backend queries ÖKOBAU.dat via its Soda4LCA REST interface:
`https://www.oekobaudat.de/OEKOBAU.DAT/resource/processes?search=true&name=<q>&format=json`.
Responses are cached to `backend/data/oekobaudat-cache.json` for 7 days.
When the remote service is unreachable the code falls back to a bundled
seed list of common German construction materials (Ziegel, Mörtel, EPS,
Porenbeton, Kalksandstein, Gipskarton, KVH, CLT, Stahlbeton, …) so the UI
stays usable offline.

Materials picked from the seed list use synthetic UUIDs prefixed with
`seed-` and can be safely upgraded to real ÖKOBAU.dat entries later.

## Data format

See [backend/src/types.ts](backend/src/types.ts) / [frontend/src/app/models/plan.model.ts](frontend/src/app/models/plan.model.ts).
All coordinates are in PDF user units (1/72 inch); `calibration.mmPerUnit`
converts to millimetres.
