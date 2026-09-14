import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";

const viewer = document.querySelector("#viewer");
const statusEl = document.querySelector("#status");
const sizeInput = document.querySelector("#pointSize");
const sizeVal = document.querySelector("#sizeVal");
const setStatus = (m) => { statusEl.textContent = m; };

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101114);
const camera = new THREE.PerspectiveCamera(55, 1, 0.001, 100000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

const grid = new THREE.GridHelper(60, 60, 0x46bea7, 0x2e343c);
grid.material.opacity = 0.2;
grid.material.transparent = true;
scene.add(grid);

const root = new THREE.Group();
scene.add(root);
let material = null;

sizeInput.addEventListener("input", () => {
  sizeVal.textContent = Number(sizeInput.value).toFixed(3);
  if (material) material.size = Number(sizeInput.value);
});

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
  camera.position.copy(center).add(new THREE.Vector3(maxDim, maxDim * 0.8, maxDim));
  camera.near = maxDim / 1000;
  camera.far = maxDim * 100;
  camera.updateProjectionMatrix();
  controls.update();
  // Punktgroesse an die Szenengroesse anpassen (Startwert)
  const suggested = Math.max(0.001, Math.min(0.2, maxDim / 400));
  sizeInput.value = suggested;
  sizeVal.textContent = suggested.toFixed(3);
  if (material) material.size = suggested;
}

function parseXyz(text) {
  const positions = [];
  const colors = [];
  for (const line of text.split("\n")) {
    const p = line.trim().split(/[\s,;]+/).map(Number);
    if (p.length >= 3 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2])) {
      positions.push(p[0], p[1], p[2]);
      if (p.length >= 6) colors.push(p[3] / 255, p[4] / 255, p[5] / 255);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  if (colors.length === positions.length) {
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  }
  return geometry;
}

async function loadCloud(url) {
  setStatus("Punktwolke laden…");
  const ext = url.split("?")[0].split(".").pop().toLowerCase();
  let geometry;
  if (ext === "ply") {
    geometry = await new Promise((resolve, reject) =>
      new PLYLoader().load(url, resolve, undefined, reject));
  } else {
    geometry = parseXyz(await (await fetch(url)).text());
  }

  const count = geometry.getAttribute("position")?.count ?? 0;
  if (!count) {
    setStatus("Keine Punkte gefunden.");
    return;
  }
  const hasColor = !!geometry.getAttribute("color");
  material = new THREE.PointsMaterial({
    size: Number(sizeInput.value),
    vertexColors: hasColor,
    color: hasColor ? 0xffffff : 0x8fe0cf,
    sizeAttenuation: true,
  });
  root.add(new THREE.Points(geometry, material));
  fitToObject(root);
  setStatus(`${count.toLocaleString("de-AT")} Punkte`);
}

const src = new URLSearchParams(location.search).get("src");
if (src) {
  loadCloud(src).catch((error) => {
    console.error(error);
    setStatus("Fehler beim Laden: " + (error && error.message ? error.message : error));
  });
} else {
  setStatus("Keine Punktwolke angegeben (?src=<url> fehlt).");
}
