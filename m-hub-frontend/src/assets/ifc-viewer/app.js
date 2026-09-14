import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { IfcAPI } from "web-ifc";

const viewer = document.querySelector("#viewer");
const statusEl = document.querySelector("#status");
const setStatus = (m) => { statusEl.textContent = m; };

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101114);
const camera = new THREE.PerspectiveCamera(55, 1, 0.01, 100000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2f38, 2.4));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(1, 2, 1.5);
scene.add(sun);
const grid = new THREE.GridHelper(60, 60, 0x46bea7, 0x2e343c);
grid.material.opacity = 0.22;
grid.material.transparent = true;
scene.add(grid);

const root = new THREE.Group();
root.rotation.x = -Math.PI / 2; // IFC ist Z-up, three Y-up
scene.add(root);

function resize() {
  const w = viewer.clientWidth, h = viewer.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener("resize", resize);
resize();

(function loop() {
  requestAnimationFrame(loop);
  controls.update();
  renderer.render(scene, camera);
})();

function fitToObject(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  controls.target.copy(center);
  camera.position.copy(center).add(new THREE.Vector3(maxDim * 1.1, maxDim * 0.9, maxDim * 1.1));
  camera.near = maxDim / 1000;
  camera.far = maxDim * 100;
  camera.updateProjectionMatrix();
  controls.update();
}

const ifcApi = new IfcAPI();
ifcApi.SetWasmPath("./vendor/web-ifc/");

async function loadIfc(url) {
  setStatus("web-ifc initialisieren…");
  await ifcApi.Init();
  setStatus("IFC laden…");
  const buffer = await (await fetch(url)).arrayBuffer();
  const modelID = ifcApi.OpenModel(new Uint8Array(buffer));

  let meshes = 0;
  ifcApi.StreamAllMeshes(modelID, (flatMesh) => {
    const geometries = flatMesh.geometries;
    for (let i = 0; i < geometries.size(); i++) {
      const placed = geometries.get(i);
      const geometry = ifcApi.GetGeometry(modelID, placed.geometryExpressID);
      const verts = ifcApi.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize());
      const indices = ifcApi.GetIndexArray(geometry.GetIndexData(), geometry.GetIndexDataSize());

      // web-ifc-Vertices sind interleaved: pos(3) + normal(3) je Vertex
      const vertexCount = verts.length / 6;
      const positions = new Float32Array(vertexCount * 3);
      const normals = new Float32Array(vertexCount * 3);
      for (let v = 0; v < vertexCount; v++) {
        positions[v * 3] = verts[v * 6];
        positions[v * 3 + 1] = verts[v * 6 + 1];
        positions[v * 3 + 2] = verts[v * 6 + 2];
        normals[v * 3] = verts[v * 6 + 3];
        normals[v * 3 + 1] = verts[v * 6 + 4];
        normals[v * 3 + 2] = verts[v * 6 + 5];
      }
      const bg = new THREE.BufferGeometry();
      bg.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      bg.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
      bg.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));

      const c = placed.color;
      const material = new THREE.MeshLambertMaterial({
        color: new THREE.Color(c.x, c.y, c.z),
        transparent: c.w < 1,
        opacity: c.w,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(bg, material);
      mesh.applyMatrix4(new THREE.Matrix4().fromArray(placed.flatTransformation));
      root.add(mesh);
      meshes++;

      ifcApi.GetVertexArray && geometry.delete && geometry.delete();
    }
  });

  fitToObject(root);
  setStatus(meshes ? `IFC geladen: ${meshes} Bauteile` : "IFC geladen, aber keine Geometrie gefunden");
}

const src = new URLSearchParams(location.search).get("src");
if (src) {
  loadIfc(src).catch((error) => {
    console.error(error);
    setStatus("Fehler beim Laden: " + (error && error.message ? error.message : error));
  });
} else {
  setStatus("Kein IFC angegeben (?src=<url> fehlt).");
}
