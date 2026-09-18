import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";

const SUPPORTED_FORMATS = [".ply", ".spz", ".splat", ".ksplat", ".sog", ".zip", ".rad"];
const ASSET_MANIFEST_URL = "./assets/manifest.json";

const viewer = document.querySelector("#viewer");
const statusEl = document.querySelector("#status");
const assetSelect = document.querySelector("#assetSelect");
const resetCameraButton = document.querySelector("#resetCamera");
const centerSplatButton = document.querySelector("#centerSplat");
const moveModeButton = document.querySelector("#moveMode");
const rotateModeButton = document.querySelector("#rotateMode");
const scaleModeButton = document.querySelector("#scaleMode");
const resetTransformButton = document.querySelector("#resetTransform");
const toggleSpinButton = document.querySelector("#toggleSpin");
const toggleGridButton = document.querySelector("#toggleGrid");
const toggleBoundsButton = document.querySelector("#toggleBounds");
const toggleDimensionsButton = document.querySelector("#toggleDimensions");
const assetCenterModeSelect = document.querySelector("#assetCenterMode");
const scaleInput = document.querySelector("#splatScale");
const scaleValue = document.querySelector("#scaleValue");
const opacityInput = document.querySelector("#opacity");
const opacityValue = document.querySelector("#opacityValue");
const qualityPreset = document.querySelector("#qualityPreset");
const lodScaleInput = document.querySelector("#lodScale");
const lodScaleValue = document.querySelector("#lodScaleValue");
const perspectiveModeButton = document.querySelector("#perspectiveMode");
const orthoModeButton = document.querySelector("#orthoMode");
const fovSlider = document.querySelector("#fovSlider");
const fovValue = document.querySelector("#fovValue");
const downloadOriginalButton = document.querySelector("#downloadOriginal");
const downloadXYZRGBButton = document.querySelector("#downloadXYZRGB");
const downloadArchicadXYZButton = document.querySelector("#downloadArchicadXYZ");
const pointCloudUpAxisSelect = document.querySelector("#pointCloudUpAxis");
const formatValue = document.querySelector("#formatValue");
const sourceValue = document.querySelector("#sourceValue");
const splatCountValue = document.querySelector("#splatCountValue");
const fileSizeValue = document.querySelector("#fileSizeValue");
const boundsSizeValue = document.querySelector("#boundsSizeValue");
const boundsCenterValue = document.querySelector("#boundsCenterValue");
const densityValue = document.querySelector("#densityValue");
const lodBudgetValue = document.querySelector("#lodBudgetValue");
const loadTimeValue = document.querySelector("#loadTimeValue");

let splatMesh;
let splatRoot;
let centerSpinRoot;
let boundsHelper;
let dimensionsHelper;
const assetBoundsCenter = new THREE.Vector3();
const assetLocalCenter = new THREE.Vector3();
const splatLocalBounds = new THREE.Box3();
const assetStats = {
  splatCount: undefined,
  fileSize: undefined,
  loadTimeMs: undefined,
  lodBudget: undefined,
};
let spinEnabled = false;
let boundsVisible = false;
let dimensionsVisible = false;
let loadId = 0;
let transformMode = "none";
let currentAssetUrl;
let currentAssetName;
let currentAssetBuffer;
let activeCameraType = "perspective";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101114);

const perspectiveCamera = new THREE.PerspectiveCamera(55, 1, 0.01, 1000);
const orthographicCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 1000);
let camera = perspectiveCamera;
const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: "high-performance",
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewer.clientWidth, viewer.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewer.appendChild(renderer.domElement);

const spark = new SparkRenderer({
  renderer,
  sortRadial: true,
  lodSplatScale: 1.1,
});
scene.add(spark);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = true;
controls.minDistance = 0.15;
controls.maxDistance = 80;

const transformControls = new TransformControls(camera, renderer.domElement);
transformControls.setMode("translate");
transformControls.setSpace("local");
scene.add(transformControls.getHelper());

transformControls.addEventListener("dragging-changed", (event) => {
  controls.enabled = !event.value;
});

transformControls.addEventListener("objectChange", () => {
  if (!splatRoot) return;
  const uniformScale = splatRoot.scale.x;
  scaleInput.value = THREE.MathUtils.clamp(uniformScale, Number(scaleInput.min), Number(scaleInput.max));
  scaleValue.textContent = `${uniformScale.toFixed(2)}x`;
  updateAssetBoundsCenter();
  updateDimensionsHelper();
});

const grid = new THREE.GridHelper(8, 16, 0x46bea7, 0x2e343c);
grid.position.y = 0;
grid.material.opacity = 0.28;
grid.material.transparent = true;
scene.add(grid);

const keyLight = new THREE.HemisphereLight(0xffffff, 0x303642, 2.2);
scene.add(keyLight);

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatNumber(value) {
  return Number.isFinite(value) ? new Intl.NumberFormat().format(Math.round(value)) : "-";
}

function formatMeasure(value) {
  if (!Number.isFinite(value)) return "-";
  const abs = Math.abs(value);
  if (abs >= 1000) return value.toFixed(0);
  if (abs >= 10) return value.toFixed(2);
  return value.toFixed(3);
}

function formatVector(vector) {
  return `${formatMeasure(vector.x)}, ${formatMeasure(vector.y)}, ${formatMeasure(vector.z)}`;
}

function resetStats() {
  assetStats.splatCount = undefined;
  assetStats.fileSize = undefined;
  assetStats.loadTimeMs = undefined;
  assetStats.lodBudget = undefined;
  splatCountValue.textContent = "-";
  fileSizeValue.textContent = "-";
  boundsSizeValue.textContent = "-";
  boundsCenterValue.textContent = "-";
  densityValue.textContent = "-";
  loadTimeValue.textContent = "-";
}

function updateStats() {
  if (!Number.isFinite(assetStats.splatCount) && splatMesh) {
    assetStats.splatCount = splatMesh.numSplats ?? splatMesh.numSplatsLoaded ?? splatMesh.numSplatsTotal;
  }

  splatCountValue.textContent = formatNumber(assetStats.splatCount);
  fileSizeValue.textContent = assetStats.fileSize ? formatBytes(assetStats.fileSize) : "-";

  if (!isFiniteBox(splatLocalBounds)) {
    boundsSizeValue.textContent = "-";
    boundsCenterValue.textContent = "-";
    densityValue.textContent = "-";
    return;
  }

  const size = splatLocalBounds.getSize(new THREE.Vector3());
  const volume = size.x * size.y * size.z;
  boundsSizeValue.textContent = formatVector(size);
  boundsCenterValue.textContent = formatVector(assetLocalCenter);
  densityValue.textContent =
    Number.isFinite(assetStats.splatCount) && volume > 0
      ? `${formatNumber(assetStats.splatCount / volume)}/unit3`
      : "-";
  loadTimeValue.textContent = Number.isFinite(assetStats.loadTimeMs)
    ? `${(assetStats.loadTimeMs / 1000).toFixed(2)} s`
    : "-";
  lodBudgetValue.textContent = Number.isFinite(assetStats.lodBudget)
    ? `${formatNumber(assetStats.lodBudget)} (${lodScaleValue.textContent})`
    : lodScaleValue.textContent;
}

function getExtension(name) {
  const lowerName = name.toLowerCase();
  return SUPPORTED_FORMATS.find((extension) => lowerName.endsWith(extension)) ?? "";
}

function setAssetOptions(entries) {
  assetSelect.replaceChildren();

  for (const entry of entries) {
    const option = document.createElement("option");
    option.value = entry.file;
    option.textContent = entry.label;
    assetSelect.append(option);
  }
}

function updateMeta({ source, name }) {
  const extension = getExtension(name);
  formatValue.textContent = extension ? extension.slice(1).toUpperCase() : "Auto";
  sourceValue.textContent = source;
}

function normalizeManifestEntry(entry) {
  if (typeof entry === "string") {
    return {
      label: entry,
      file: entry,
    };
  }

  return {
    label: entry.label ?? entry.name ?? entry.file,
    file: entry.file ?? entry.url ?? entry.path,
  };
}

async function loadAssetManifest() {
  assetSelect.disabled = true;
  assetSelect.innerHTML = '<option value="">Loading assets...</option>';

  try {
    const entries = await discoverAssets();

    if (!entries.length) {
      throw new Error("No supported splat assets were found.");
    }

    setAssetOptions(entries);
    assetSelect.disabled = false;
    loadSplat({ url: `./assets/${entries[0].file}`, source: "Assets", name: entries[0].label });
  } catch (error) {
    console.error(error);
    assetSelect.innerHTML = '<option value="">No assets found</option>';
    setStatus("Add splat filenames to assets/manifest.json to populate this dropdown.", true);
  }
}

async function discoverAssets() {
  const manifestEntries = await readManifestAssets();
  if (manifestEntries.length) return manifestEntries;
  return readDirectoryAssets();
}

async function readManifestAssets() {
  try {
    const response = await fetch(ASSET_MANIFEST_URL, { cache: "no-store" });
    if (!response.ok) return [];
    const manifest = await response.json();
    return (Array.isArray(manifest) ? manifest : manifest.assets ?? [])
      .map(normalizeManifestEntry)
      .filter((entry) => entry.file && getExtension(entry.file));
  } catch {
    return [];
  }
}

async function readDirectoryAssets() {
  try {
    const response = await fetch("./assets/", { cache: "no-store" });
    if (!response.ok) return [];
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const files = [...doc.querySelectorAll("a")]
      .map((link) => decodeURIComponent(link.getAttribute("href") ?? ""))
      .map((href) => href.split("/").pop())
      .filter((file) => file && getExtension(file));

    return [...new Set(files)].map((file) => ({
      label: file,
      file,
    }));
  } catch {
    return [];
  }
}

function isFiniteBox(box) {
  return (
    box &&
    !box.isEmpty() &&
    Number.isFinite(box.min.x) &&
    Number.isFinite(box.min.y) &&
    Number.isFinite(box.min.z) &&
    Number.isFinite(box.max.x) &&
    Number.isFinite(box.max.y) &&
    Number.isFinite(box.max.z)
  );
}

function readAsciiToken(text, start) {
  let index = start;

  while (index < text.length && /\s/.test(text[index])) index += 1;

  const tokenStart = index;
  while (index < text.length && !/\s/.test(text[index])) index += 1;

  return {
    token: text.slice(tokenStart, index),
    index,
  };
}

function getPlyPropertyReader(dataView, type) {
  const readers = {
    char: { size: 1, read: (offset) => dataView.getInt8(offset) },
    int8: { size: 1, read: (offset) => dataView.getInt8(offset) },
    uchar: { size: 1, read: (offset) => dataView.getUint8(offset) },
    uint8: { size: 1, read: (offset) => dataView.getUint8(offset) },
    short: { size: 2, read: (offset, littleEndian) => dataView.getInt16(offset, littleEndian) },
    int16: { size: 2, read: (offset, littleEndian) => dataView.getInt16(offset, littleEndian) },
    ushort: { size: 2, read: (offset, littleEndian) => dataView.getUint16(offset, littleEndian) },
    uint16: { size: 2, read: (offset, littleEndian) => dataView.getUint16(offset, littleEndian) },
    int: { size: 4, read: (offset, littleEndian) => dataView.getInt32(offset, littleEndian) },
    int32: { size: 4, read: (offset, littleEndian) => dataView.getInt32(offset, littleEndian) },
    uint: { size: 4, read: (offset, littleEndian) => dataView.getUint32(offset, littleEndian) },
    uint32: { size: 4, read: (offset, littleEndian) => dataView.getUint32(offset, littleEndian) },
    float: { size: 4, read: (offset, littleEndian) => dataView.getFloat32(offset, littleEndian) },
    float32: { size: 4, read: (offset, littleEndian) => dataView.getFloat32(offset, littleEndian) },
    double: { size: 8, read: (offset, littleEndian) => dataView.getFloat64(offset, littleEndian) },
    float64: { size: 8, read: (offset, littleEndian) => dataView.getFloat64(offset, littleEndian) },
  };

  return readers[type];
}

async function computePlyBounds(url) {
  if (!url.toLowerCase().endsWith(".ply")) return undefined;

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return undefined;

  const buffer = await response.arrayBuffer();
  currentAssetBuffer = buffer.slice(0);
  assetStats.fileSize = buffer.byteLength;
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder();
  const headerPreview = decoder.decode(bytes.slice(0, Math.min(bytes.length, 65536)));
  const endHeaderToken = "end_header";
  const endHeaderIndex = headerPreview.indexOf(endHeaderToken);

  if (endHeaderIndex === -1) return undefined;

  const headerEndTextIndex = endHeaderIndex + endHeaderToken.length;
  let bodyStart = headerEndTextIndex;
  while (bodyStart < headerPreview.length && (headerPreview[bodyStart] === "\r" || headerPreview[bodyStart] === "\n")) {
    bodyStart += 1;
  }

  const headerByteLength = new TextEncoder().encode(headerPreview.slice(0, bodyStart)).length;
  const header = headerPreview.slice(0, headerEndTextIndex);
  const lines = header.split(/\r?\n/);
  const formatLine = lines.find((line) => line.startsWith("format "));
  const format = formatLine?.split(/\s+/)[1];
  const vertexCountLineIndex = lines.findIndex((line) => line.startsWith("element vertex "));

  if (!format || vertexCountLineIndex === -1) return undefined;

  const vertexCount = Number(lines[vertexCountLineIndex].split(/\s+/)[2]);
  if (!Number.isFinite(vertexCount) || vertexCount <= 0) return undefined;
  assetStats.splatCount = vertexCount;

  const properties = [];
  for (let index = vertexCountLineIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line.startsWith("element ")) break;
    if (!line.startsWith("property ")) continue;

    const parts = line.split(/\s+/);
    if (parts[1] === "list") return undefined;
    properties.push({
      type: parts[1],
      name: parts[2],
    });
  }

  const xIndex = properties.findIndex((property) => property.name === "x");
  const yIndex = properties.findIndex((property) => property.name === "y");
  const zIndex = properties.findIndex((property) => property.name === "z");
  if (xIndex === -1 || yIndex === -1 || zIndex === -1) return undefined;

  const bounds = new THREE.Box3();
  const point = new THREE.Vector3();

  if (format === "ascii") {
    const body = decoder.decode(bytes.slice(headerByteLength));
    let index = 0;

    for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
      let x = 0;
      let y = 0;
      let z = 0;

      for (let propertyIndex = 0; propertyIndex < properties.length; propertyIndex += 1) {
        const result = readAsciiToken(body, index);
        index = result.index;
        const value = Number(result.token);

        if (propertyIndex === xIndex) x = value;
        if (propertyIndex === yIndex) y = value;
        if (propertyIndex === zIndex) z = value;
      }

      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        bounds.expandByPoint(point.set(x, y, z));
      }
    }

    return isFiniteBox(bounds) ? bounds : undefined;
  }

  if (format === "binary_little_endian" || format === "binary_big_endian") {
    const littleEndian = format === "binary_little_endian";
    const dataView = new DataView(buffer);
    const readers = properties.map((property) => getPlyPropertyReader(dataView, property.type));
    if (readers.some((reader) => !reader)) return undefined;

    const propertyOffsets = [];
    let propertyOffset = 0;
    for (const reader of readers) {
      propertyOffsets.push(propertyOffset);
      propertyOffset += reader.size;
    }

    const stride = propertyOffset;
    let offset = headerByteLength;

    for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
      const x = readers[xIndex].read(offset + propertyOffsets[xIndex], littleEndian);
      const y = readers[yIndex].read(offset + propertyOffsets[yIndex], littleEndian);
      const z = readers[zIndex].read(offset + propertyOffsets[zIndex], littleEndian);

      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        bounds.expandByPoint(point.set(x, y, z));
      }

      offset += stride;
    }

    return isFiniteBox(bounds) ? bounds : undefined;
  }

  return undefined;
}

async function getCurrentAssetBuffer() {
  if (currentAssetBuffer) return currentAssetBuffer;
  if (!currentAssetUrl) return undefined;

  const response = await fetch(currentAssetUrl, { cache: "no-store" });
  if (!response.ok) return undefined;
  currentAssetBuffer = await response.arrayBuffer();
  return currentAssetBuffer;
}

function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
    }),
  );
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }, 1000);
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function sphericalHarmonicColor(value) {
  return clampByte((0.28209479177387814 * value + 0.5) * 255);
}

function convertPointForUpAxis(x, y, z) {
  if (pointCloudUpAxisSelect.value === "y") {
    return {
      x,
      y: z,
      z: -y,
    };
  }

  return {
    x,
    y,
    z,
  };
}

function getPointCloudAxisSuffix() {
  return pointCloudUpAxisSelect.value === "y" ? "Yup" : "Zup";
}

function parsePlyLayout(buffer) {
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder();
  const headerPreview = decoder.decode(bytes.slice(0, Math.min(bytes.length, 65536)));
  const endHeaderToken = "end_header";
  const endHeaderIndex = headerPreview.indexOf(endHeaderToken);

  if (endHeaderIndex === -1) return undefined;

  const headerEndTextIndex = endHeaderIndex + endHeaderToken.length;
  let bodyStart = headerEndTextIndex;
  while (bodyStart < headerPreview.length && (headerPreview[bodyStart] === "\r" || headerPreview[bodyStart] === "\n")) {
    bodyStart += 1;
  }

  const headerByteLength = new TextEncoder().encode(headerPreview.slice(0, bodyStart)).length;
  const header = headerPreview.slice(0, headerEndTextIndex);
  const lines = header.split(/\r?\n/);
  const formatLine = lines.find((line) => line.startsWith("format "));
  const format = formatLine?.split(/\s+/)[1];
  const vertexCountLineIndex = lines.findIndex((line) => line.startsWith("element vertex "));

  if (!format || vertexCountLineIndex === -1) return undefined;

  const vertexCount = Number(lines[vertexCountLineIndex].split(/\s+/)[2]);
  if (!Number.isFinite(vertexCount) || vertexCount <= 0) return undefined;

  const properties = [];
  for (let index = vertexCountLineIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line.startsWith("element ")) break;
    if (!line.startsWith("property ")) continue;

    const parts = line.split(/\s+/);
    if (parts[1] === "list") return undefined;
    properties.push({
      type: parts[1],
      name: parts[2],
    });
  }

  return {
    bytes,
    format,
    headerByteLength,
    vertexCount,
    properties,
  };
}

function getPropertyIndex(properties, names) {
  return names.map((name) => properties.findIndex((property) => property.name === name)).find((index) => index !== -1) ?? -1;
}

function convertPlyToPointCloudPly(buffer) {
  const layout = parsePlyLayout(buffer);
  if (!layout) throw new Error("Could not parse PLY header.");

  const { bytes, format, headerByteLength, vertexCount, properties } = layout;
  const xIndex = getPropertyIndex(properties, ["x"]);
  const yIndex = getPropertyIndex(properties, ["y"]);
  const zIndex = getPropertyIndex(properties, ["z"]);
  const rIndex = getPropertyIndex(properties, ["red", "r"]);
  const gIndex = getPropertyIndex(properties, ["green", "g"]);
  const bIndex = getPropertyIndex(properties, ["blue", "b"]);
  const dc0Index = getPropertyIndex(properties, ["f_dc_0"]);
  const dc1Index = getPropertyIndex(properties, ["f_dc_1"]);
  const dc2Index = getPropertyIndex(properties, ["f_dc_2"]);

  if (xIndex === -1 || yIndex === -1 || zIndex === -1) {
    throw new Error("PLY does not contain x/y/z vertex properties.");
  }

  const hasRgb = rIndex !== -1 && gIndex !== -1 && bIndex !== -1;
  const hasSphericalHarmonics = dc0Index !== -1 && dc1Index !== -1 && dc2Index !== -1;
  if (!hasRgb && !hasSphericalHarmonics) {
    throw new Error("PLY does not contain RGB or f_dc_0/f_dc_1/f_dc_2 color properties.");
  }

  const lines = [
    "ply",
    "format ascii 1.0",
    `element vertex ${vertexCount}`,
    "property float x",
    "property float y",
    "property float z",
    "property uchar red",
    "property uchar green",
    "property uchar blue",
    "end_header",
  ];

  if (format === "ascii") {
    const body = new TextDecoder().decode(bytes.slice(headerByteLength));
    let index = 0;

    for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
      const values = [];

      for (let propertyIndex = 0; propertyIndex < properties.length; propertyIndex += 1) {
        const result = readAsciiToken(body, index);
        index = result.index;
        values.push(Number(result.token));
      }

      const point = convertPointForUpAxis(values[xIndex], values[yIndex], values[zIndex]);
      const r = hasRgb ? clampByte(values[rIndex]) : sphericalHarmonicColor(values[dc0Index]);
      const g = hasRgb ? clampByte(values[gIndex]) : sphericalHarmonicColor(values[dc1Index]);
      const b = hasRgb ? clampByte(values[bIndex]) : sphericalHarmonicColor(values[dc2Index]);
      lines.push(`${point.x} ${point.y} ${point.z} ${r} ${g} ${b}`);
    }

    return `${lines.join("\n")}\n`;
  }

  if (format === "binary_little_endian" || format === "binary_big_endian") {
    const littleEndian = format === "binary_little_endian";
    const dataView = new DataView(buffer);
    const readers = properties.map((property) => getPlyPropertyReader(dataView, property.type));
    if (readers.some((reader) => !reader)) throw new Error("Unsupported PLY property type.");

    const propertyOffsets = [];
    let propertyOffset = 0;
    for (const reader of readers) {
      propertyOffsets.push(propertyOffset);
      propertyOffset += reader.size;
    }

    const stride = propertyOffset;
    let offset = headerByteLength;

    for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
      const read = (propertyIndex) => readers[propertyIndex].read(offset + propertyOffsets[propertyIndex], littleEndian);
      const x = read(xIndex);
      const y = read(yIndex);
      const z = read(zIndex);
      const point = convertPointForUpAxis(x, y, z);
      const r = hasRgb ? clampByte(read(rIndex)) : sphericalHarmonicColor(read(dc0Index));
      const g = hasRgb ? clampByte(read(gIndex)) : sphericalHarmonicColor(read(dc1Index));
      const b = hasRgb ? clampByte(read(bIndex)) : sphericalHarmonicColor(read(dc2Index));
      lines.push(`${point.x} ${point.y} ${point.z} ${r} ${g} ${b}`);
      offset += stride;
    }

    return `${lines.join("\n")}\n`;
  }

  throw new Error(`Unsupported PLY format: ${format}`);
}

function convertPlyToArchicadXYZ(buffer) {
  const ply = convertPlyToPointCloudPly(buffer);
  const headerEnd = ply.indexOf("end_header\n");
  if (headerEnd === -1) throw new Error("Could not create Archicad XYZ output.");
  return ply.slice(headerEnd + "end_header\n".length);
}

async function downloadOriginalAsset() {
  const asset = getSelectedAssetInfo();
  const assetUrl = currentAssetUrl ?? asset?.url;
  const assetName = currentAssetName ?? asset?.name;

  if (!assetUrl || !assetName) {
    setStatus("No loaded asset is available to download.", true);
    return;
  }

  setStatus(`Preparing ${assetName} for download...`);
  const response = await fetch(assetUrl, { cache: "no-store" });
  if (!response.ok) {
    setStatus("Could not fetch the loaded asset for download.", true);
    return;
  }

  const blob = await response.blob();
  currentAssetBuffer = await blob.arrayBuffer();
  downloadBlob(blob, assetName);
  setStatus(`Downloaded ${assetName}.`);
}

function getSelectedAssetInfo() {
  const file = assetSelect.value;
  const label = assetSelect.selectedOptions[0]?.textContent ?? file;

  if (!file) return undefined;

  return {
    url: `./assets/${file}`,
    name: label,
  };
}

async function downloadXYZRGBAsset() {
  const asset = getSelectedAssetInfo();
  const assetName = currentAssetName ?? asset?.name;
  const assetUrl = currentAssetUrl ?? asset?.url;

  if (!assetName?.toLowerCase().endsWith(".ply")) {
    setStatus("XYZRGB export is currently available for PLY assets.", true);
    return;
  }

  try {
    setStatus("Converting loaded PLY to color point cloud...");
    if (!currentAssetBuffer && assetUrl) {
      const response = await fetch(assetUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not fetch the selected PLY for conversion.");
      currentAssetBuffer = await response.arrayBuffer();
    }

    const buffer = await getCurrentAssetBuffer();
    const pointCloudPly = convertPlyToPointCloudPly(buffer);
    const outputName = assetName.replace(/\.[^.]+$/, `_PC_${getPointCloudAxisSuffix()}.ply`);
    downloadBlob(new Blob([pointCloudPly], { type: "application/octet-stream" }), outputName);
    setStatus(`Converted ${assetName} to color point cloud PLY.`);
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Could not convert this asset to XYZRGB.", true);
  }
}

async function downloadArchicadXYZAsset() {
  const asset = getSelectedAssetInfo();
  const assetName = currentAssetName ?? asset?.name;
  const assetUrl = currentAssetUrl ?? asset?.url;

  if (!assetName?.toLowerCase().endsWith(".ply")) {
    setStatus("Archicad XYZ export is currently available for PLY assets.", true);
    return;
  }

  try {
    setStatus("Converting loaded PLY to Archicad XYZ...");
    if (!currentAssetBuffer && assetUrl) {
      const response = await fetch(assetUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not fetch the selected PLY for conversion.");
      currentAssetBuffer = await response.arrayBuffer();
    }

    const buffer = await getCurrentAssetBuffer();
    const xyz = convertPlyToArchicadXYZ(buffer);
    const outputName = assetName.replace(/\.[^.]+$/, `_Archicad_PC_${getPointCloudAxisSuffix()}.xyz`);
    downloadBlob(new Blob([xyz], { type: "text/plain" }), outputName);
    setStatus(`Converted ${assetName} to Archicad XYZ.`);
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Could not convert this asset to Archicad XYZ.", true);
  }
}

function disposeCurrentSplat() {
  transformControls.detach();
  removeBoundsHelper();
  removeDimensionsHelper();
  splatLocalBounds.makeEmpty();
  assetLocalCenter.set(0, 0, 0);
  assetBoundsCenter.set(0, 0, 0);
  resetStats();

  if (splatRoot) {
    scene.remove(splatRoot);
    splatRoot = undefined;
  }

  centerSpinRoot = undefined;

  if (splatMesh) {
    splatMesh.dispose?.();
    splatMesh = undefined;
  }
}

function applySplatControls() {
  if (!splatRoot || !splatMesh) return;
  const scale = Number(scaleInput.value);
  const opacity = Number(opacityInput.value);
  splatRoot.scale.setScalar(scale);
  splatMesh.opacity = opacity;
  scaleValue.textContent = `${scale.toFixed(2)}x`;
  opacityValue.textContent = `${Math.round(opacity * 100)}%`;
  updateDimensionsHelper();
}

function applyQualitySettings() {
  const qualityPercent = Number(lodScaleInput.value);
  const splatCount = Number.isFinite(assetStats.splatCount) ? assetStats.splatCount : 800000;
  const lodBudget = Math.max(1, Math.round((splatCount * qualityPercent) / 100));

  assetStats.lodBudget = lodBudget;
  lodScaleValue.textContent = `${qualityPercent}%`;
  lodBudgetValue.textContent = `${formatNumber(lodBudget)} (${qualityPercent}%)`;

  spark.lodSplatCount = lodBudget;
  spark.lodSplatScale = 1;
  spark.lodRenderScale = Math.max(1, 100 / qualityPercent);
  if (splatMesh) {
    splatMesh.lodScale = 1;
  }
}

function clearTransformMode() {
  transformMode = "none";
  transformControls.detach();
  moveModeButton.setAttribute("aria-pressed", "false");
  rotateModeButton.setAttribute("aria-pressed", "false");
  scaleModeButton.setAttribute("aria-pressed", "false");
}

function attachActiveTransform() {
  if (transformMode !== "none" && splatRoot) {
    transformControls.attach(splatRoot);
  }
}

function setTransformMode(mode) {
  const nextMode = transformMode === mode ? "none" : mode;
  transformMode = nextMode;

  if (nextMode === "none") {
    transformControls.detach();
  } else {
    transformControls.setMode(nextMode);
    attachActiveTransform();
  }

  moveModeButton.setAttribute("aria-pressed", String(nextMode === "translate"));
  rotateModeButton.setAttribute("aria-pressed", String(nextMode === "rotate"));
  scaleModeButton.setAttribute("aria-pressed", String(nextMode === "scale"));
}

function storeSplatLocalBounds(box) {
  if (!isFiniteBox(box)) return false;

  splatLocalBounds.copy(box);
  splatLocalBounds.getCenter(assetLocalCenter);
  updateAssetBoundsCenter();
  updateBoundsHelper();
  updateDimensionsHelper();
  updateStats();
  return true;
}

function computeSplatLocalBounds() {
  splatLocalBounds.makeEmpty();

  if (!splatMesh?.forEachSplat) return;

  try {
    splatMesh.forEachSplat((index, center) => {
      splatLocalBounds.expandByPoint(center);
    });
  } catch (error) {
    console.warn("Could not compute splat bounds.", error);
    splatLocalBounds.makeEmpty();
  }

  storeSplatLocalBounds(splatLocalBounds);
}

function updateAssetBoundsCenter() {
  assetBoundsCenter.set(0, 0, 0);

  if (!splatMesh || !splatRoot) return assetBoundsCenter;

  splatRoot.updateMatrixWorld(true);
  assetBoundsCenter.copy(assetLocalCenter);
  splatMesh.localToWorld(assetBoundsCenter);
  return assetBoundsCenter;
}

function updateBoundsHelper() {
  if (!boundsVisible || !centerSpinRoot || splatLocalBounds.isEmpty()) return;

  removeBoundsHelper();

  const size = splatLocalBounds.getSize(new THREE.Vector3());
  const minSize = 0.01;
  const geometry = new THREE.BoxGeometry(
    Math.max(size.x, minSize),
    Math.max(size.y, minSize),
    Math.max(size.z, minSize),
  );
  const edges = new THREE.EdgesGeometry(geometry);
  const material = new THREE.LineBasicMaterial({
    color: 0xffd34d,
    depthTest: false,
    depthWrite: false,
  });

  boundsHelper = new THREE.LineSegments(edges, material);
  boundsHelper.position.set(0, 0, 0);
  boundsHelper.renderOrder = 999;
  centerSpinRoot.add(boundsHelper);

  geometry.dispose();
}

function removeBoundsHelper() {
  if (!boundsHelper) return;
  boundsHelper.parent?.remove(boundsHelper);
  boundsHelper.geometry.dispose();
  boundsHelper.material.dispose();
  boundsHelper = undefined;
}

function createLabelSprite(text, color) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = 512;
  canvas.height = 128;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "700 44px Inter, Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 8;
  context.strokeStyle = "rgba(0, 0, 0, 0.72)";
  context.strokeText(text, canvas.width / 2, canvas.height / 2);
  context.fillStyle = color;
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.3, 0.075, 1);
  sprite.renderOrder = 1000;
  return sprite;
}

function addScaleGuide(group, start, end, color, labelText, labelPosition) {
  const points = [start, end];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    depthTest: false,
    depthWrite: false,
  });
  const line = new THREE.Line(geometry, material);
  line.renderOrder = 1000;
  group.add(line);

  const label = createLabelSprite(labelText, `#${color.toString(16).padStart(6, "0")}`);
  label.position.copy(labelPosition);
  group.add(label);
}

function updateDimensionsHelper() {
  if (!dimensionsVisible || !centerSpinRoot || splatLocalBounds.isEmpty()) return;

  removeDimensionsHelper();

  const size = splatLocalBounds.getSize(new THREE.Vector3());
  const scaledSize = size.clone().multiply(splatRoot?.scale ?? new THREE.Vector3(1, 1, 1));
  const half = size.clone().multiplyScalar(0.5);
  const maxSize = Math.max(size.x, size.y, size.z, 0.1);
  const pad = maxSize * 0.12;
  const group = new THREE.Group();
  group.name = "Dimension guides";

  const xY = -half.y - pad;
  const xZ = half.z + pad;
  addScaleGuide(
    group,
    new THREE.Vector3(-half.x, xY, xZ),
    new THREE.Vector3(half.x, xY, xZ),
    0xff6b6b,
    `X ${formatMeasure(scaledSize.x)} m`,
    new THREE.Vector3(0, xY - pad * 0.45, xZ),
  );

  const yX = half.x + pad;
  const yZ = half.z + pad;
  addScaleGuide(
    group,
    new THREE.Vector3(yX, -half.y, yZ),
    new THREE.Vector3(yX, half.y, yZ),
    0x8fd76f,
    `Y ${formatMeasure(scaledSize.y)} m`,
    new THREE.Vector3(yX + pad * 0.45, 0, yZ),
  );

  const zX = half.x + pad;
  const zY = -half.y - pad;
  addScaleGuide(
    group,
    new THREE.Vector3(zX, zY, -half.z),
    new THREE.Vector3(zX, zY, half.z),
    0x6ba7ff,
    `Z ${formatMeasure(scaledSize.z)} m`,
    new THREE.Vector3(zX, zY - pad * 0.45, 0),
  );

  dimensionsHelper = group;
  centerSpinRoot.add(dimensionsHelper);
}

function removeDimensionsHelper() {
  if (!dimensionsHelper) return;
  dimensionsHelper.traverse((object) => {
    object.geometry?.dispose?.();
    object.material?.map?.dispose?.();
    object.material?.dispose?.();
  });
  dimensionsHelper.parent?.remove(dimensionsHelper);
  dimensionsHelper = undefined;
}

function alignCenterSpinRoot() {
  if (!centerSpinRoot || !splatMesh) return;

  centerSpinRoot.position.copy(assetLocalCenter);
  centerSpinRoot.rotation.set(0, 0, 0);
  splatMesh.position.copy(assetLocalCenter).multiplyScalar(-1);
  splatMesh.rotation.set(0, 0, 0);
  updateAssetBoundsCenter();
}

function placePivotAtWorldOrigin({ frameCamera = true } = {}) {
  if (!splatRoot || !centerSpinRoot || !splatMesh) {
    if (frameCamera) resetCamera();
    return;
  }

  splatRoot.position.set(0, 0, 0);
  splatRoot.rotation.set(0, 0, 0);
  centerSpinRoot.position.set(0, 0, 0);
  centerSpinRoot.rotation.set(0, 0, 0);
  splatMesh.position.set(0, 0, 0);
  splatMesh.rotation.set(0, 0, 0);
  alignCenterSpinRoot();
  splatRoot.updateMatrixWorld(true);
  updateAssetBoundsCenter();
  attachActiveTransform();

  if (frameCamera) {
    frameSplat();
  }
}

function centerAssetBySetting({ frameCamera = true } = {}) {
  if (!splatRoot || !splatMesh) {
    if (frameCamera) resetCamera();
    return;
  }

  if (assetCenterModeSelect.value === "bounds") {
    alignCenterSpinRoot();
    updateAssetBoundsCenter();
    splatRoot.position.sub(assetBoundsCenter);
  } else {
    splatRoot.position.set(0, 0, 0);
  }

  splatRoot.updateMatrixWorld(true);
  updateAssetBoundsCenter();
  attachActiveTransform();

  if (frameCamera) {
    frameSplat();
  }
}

function resetTransform() {
  if (!splatRoot || !centerSpinRoot) return;
  splatRoot.position.set(0, 0, 0);
  splatRoot.rotation.set(0, 0, 0);
  splatRoot.scale.setScalar(1);
  centerSpinRoot.position.set(0, 0, 0);
  centerSpinRoot.rotation.set(0, 0, 0);
  if (splatMesh) {
    splatMesh.position.set(0, 0, 0);
    splatMesh.rotation.set(0, 0, 0);
    alignCenterSpinRoot();
  }
  scaleInput.value = "1";
  scaleValue.textContent = "1.00x";
  updateAssetBoundsCenter();
  attachActiveTransform();
}

function resetCamera() {
  frameSplat();
}

function syncCameraPose(fromCamera, toCamera) {
  toCamera.position.copy(fromCamera.position);
  toCamera.quaternion.copy(fromCamera.quaternion);
  toCamera.near = fromCamera.near;
  toCamera.far = fromCamera.far;
  toCamera.updateProjectionMatrix();
}

function updateActiveCamera(type) {
  if (type === activeCameraType) return;

  const previousCamera = camera;
  activeCameraType = type;
  camera = type === "ortho" ? orthographicCamera : perspectiveCamera;
  syncCameraPose(previousCamera, camera);
  controls.object = camera;
  transformControls.camera = camera;
  perspectiveModeButton.setAttribute("aria-pressed", String(type === "perspective"));
  orthoModeButton.setAttribute("aria-pressed", String(type === "ortho"));
  resize();
  if (type === "ortho") {
    fitOrthographicToCurrentView();
  } else {
    frameSplat();
  }
}

function fitOrthographicToCurrentView() {
  const target = controls.target.clone();
  const distance = Math.max(camera.position.distanceTo(target), 0.5);
  const fov = THREE.MathUtils.degToRad(perspectiveCamera.fov);
  const viewHeight = Math.max(2 * distance * Math.tan(fov / 2), 0.5);
  const aspect = viewer.clientWidth / Math.max(viewer.clientHeight, 1);
  const viewWidth = viewHeight * aspect;

  orthographicCamera.left = -viewWidth / 2;
  orthographicCamera.right = viewWidth / 2;
  orthographicCamera.top = viewHeight / 2;
  orthographicCamera.bottom = -viewHeight / 2;
  orthographicCamera.near = 0.001;
  orthographicCamera.far = Math.max(distance * 100, 10000);
  orthographicCamera.zoom = 1;
  orthographicCamera.updateProjectionMatrix();
}

function applyFov() {
  const fov = Number(fovSlider.value);
  perspectiveCamera.fov = fov;
  perspectiveCamera.updateProjectionMatrix();
  fovValue.textContent = `${fov} deg`;

  if (activeCameraType === "perspective") {
    frameSplat();
  }
}

function getFrameBox() {
  if (!isFiniteBox(splatLocalBounds) || !splatMesh) {
    return undefined;
  }

  splatMesh.updateMatrixWorld(true);
  return splatLocalBounds.clone().applyMatrix4(splatMesh.matrixWorld);
}

function getFrameTarget() {
  if (isFiniteBox(splatLocalBounds)) {
    return getFrameBox()?.getCenter(new THREE.Vector3()) ?? assetBoundsCenter.clone();
  }

  if (splatRoot) {
    return splatRoot.getWorldPosition(new THREE.Vector3());
  }

  return new THREE.Vector3();
}

function frameSplat() {
  const box = getFrameBox();
  const target = box ? box.getCenter(new THREE.Vector3()) : getFrameTarget();
  const size = box ? box.getSize(new THREE.Vector3()) : new THREE.Vector3(3, 3, 3);
  const radius = Math.max(size.length() * 0.5, 0.5);
  const fov = THREE.MathUtils.degToRad(perspectiveCamera.fov);
  const fitHeightDistance = radius / Math.sin(fov / 2);
  const fitWidthDistance = fitHeightDistance / Math.max(camera.aspect, 0.1);
  const distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.22;
  const direction = new THREE.Vector3(0.85, 0.48, 0.85).normalize();

  camera.position.copy(target).addScaledVector(direction, distance);
  camera.near = camera.isOrthographicCamera ? 0.001 : Math.max(distance / 1000, 0.001);
  camera.far = Math.max(distance * 1000, 10000);

  if (camera.isOrthographicCamera) {
    const aspect = viewer.clientWidth / Math.max(viewer.clientHeight, 1);
    const viewHeight = Math.max(radius * 2.35, 0.5);
    const viewWidth = viewHeight * aspect;
    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.zoom = 1;
  }

  camera.updateProjectionMatrix();
  controls.target.copy(target);
  controls.update();
}

async function loadSplat({ url, source, name = url }) {
  const currentLoadId = ++loadId;
  const loadStartedAt = performance.now();
  disposeCurrentSplat();
  currentAssetUrl = url;
  currentAssetName = name;
  currentAssetBuffer = undefined;

  updateMeta({ source, name });
  setStatus(`Loading ${source.toLowerCase()} splat...`);

  const plyBoundsPromise = computePlyBounds(url);

  const meshOptions = {
    url,
    lod: true,
    onProgress: (event) => {
      if (currentLoadId !== loadId) return;
      if (!event.lengthComputable) return;
      const progress = Math.round((event.loaded / event.total) * 100);
      setStatus(`Loading ${progress}% (${formatBytes(event.loaded)} of ${formatBytes(event.total)})`);
    },
  };

  try {
    splatRoot = new THREE.Group();
    splatRoot.name = "Splat pivot";
    splatRoot.position.set(0, 0, 0);
    splatRoot.rotation.set(0, 0, 0);

    centerSpinRoot = new THREE.Group();
    centerSpinRoot.name = "Splat center spin";

    splatMesh = new SplatMesh(meshOptions);
    splatMesh.lodScale = 1;
    splatMesh.position.set(0, 0, 0);
    splatMesh.rotation.set(0, 0, 0);
    centerSpinRoot.add(splatMesh);
    splatRoot.add(centerSpinRoot);
    scene.add(splatRoot);

    applySplatControls();
    await splatMesh.initialized;
    if (currentLoadId !== loadId) return;

    const plyBounds = await plyBoundsPromise;
    if (currentLoadId !== loadId) return;

    if (isFiniteBox(plyBounds)) {
      storeSplatLocalBounds(plyBounds);
    } else {
      computeSplatLocalBounds();
      assetStats.splatCount = splatMesh?.numSplats ?? splatMesh?.numSplatsLoaded ?? undefined;
      updateStats();
    }

    applyQualitySettings();
    placePivotAtWorldOrigin();
    assetStats.loadTimeMs = performance.now() - loadStartedAt;
    updateStats();
    setStatus(`Loaded ${name}`);
  } catch (error) {
    console.error(error);
    disposeCurrentSplat();
    setStatus("That splat could not be loaded. Check the file format and browser console.", true);
  }
}

function resize() {
  const { clientWidth, clientHeight } = viewer;
  const aspect = clientWidth / Math.max(clientHeight, 1);
  perspectiveCamera.aspect = aspect;
  perspectiveCamera.updateProjectionMatrix();

  if (orthographicCamera.isOrthographicCamera) {
    const height = Math.max(orthographicCamera.top - orthographicCamera.bottom || 2, 0.5);
    const width = height * aspect;
    orthographicCamera.left = -width / 2;
    orthographicCamera.right = width / 2;
    orthographicCamera.updateProjectionMatrix();
  }

  camera.updateProjectionMatrix();
  renderer.setSize(clientWidth, clientHeight, false);
}

assetSelect.addEventListener("change", () => {
  const file = assetSelect.value;
  const label = assetSelect.selectedOptions[0]?.textContent ?? file;
  if (!file) return;
  loadSplat({ url: `./assets/${file}`, source: "Assets", name: label });
});

resetCameraButton.addEventListener("click", resetCamera);
centerSplatButton.addEventListener("click", () => centerAssetBySetting({ frameCamera: true }));
moveModeButton.addEventListener("click", () => setTransformMode("translate"));
rotateModeButton.addEventListener("click", () => setTransformMode("rotate"));
scaleModeButton.addEventListener("click", () => setTransformMode("scale"));
resetTransformButton.addEventListener("click", resetTransform);
perspectiveModeButton.addEventListener("click", () => updateActiveCamera("perspective"));
orthoModeButton.addEventListener("click", () => updateActiveCamera("ortho"));
fovSlider.addEventListener("input", applyFov);
downloadOriginalButton.addEventListener("click", downloadOriginalAsset);
downloadXYZRGBButton.addEventListener("click", downloadXYZRGBAsset);
downloadArchicadXYZButton.addEventListener("click", downloadArchicadXYZAsset);

toggleSpinButton.addEventListener("click", () => {
  spinEnabled = !spinEnabled;
  toggleSpinButton.setAttribute("aria-pressed", String(spinEnabled));
  toggleSpinButton.textContent = spinEnabled ? "Spin on" : "Spin off";
});

toggleGridButton.addEventListener("click", () => {
  grid.visible = !grid.visible;
  toggleGridButton.setAttribute("aria-pressed", String(grid.visible));
  toggleGridButton.textContent = grid.visible ? "Grid on" : "Grid off";
});

toggleBoundsButton.addEventListener("click", () => {
  boundsVisible = !boundsVisible;
  toggleBoundsButton.setAttribute("aria-pressed", String(boundsVisible));
  toggleBoundsButton.textContent = boundsVisible ? "Bounds on" : "Bounds off";

  if (!boundsVisible) {
    removeBoundsHelper();
  } else {
    updateBoundsHelper();
  }
});

toggleDimensionsButton.addEventListener("click", () => {
  dimensionsVisible = !dimensionsVisible;
  toggleDimensionsButton.setAttribute("aria-pressed", String(dimensionsVisible));
  toggleDimensionsButton.textContent = dimensionsVisible ? "Scales on" : "Scales off";

  if (!dimensionsVisible) {
    removeDimensionsHelper();
  } else {
    updateDimensionsHelper();
  }
});

assetCenterModeSelect.addEventListener("change", () => {
  if (assetCenterModeSelect.value === "bounds") {
    alignCenterSpinRoot();
    updateAssetBoundsCenter();
  }
});

scaleInput.addEventListener("input", applySplatControls);
opacityInput.addEventListener("input", applySplatControls);

qualityPreset.addEventListener("change", () => {
  if (qualityPreset.value === "custom") return;
  lodScaleInput.value = qualityPreset.value;
  applyQualitySettings();
});

lodScaleInput.addEventListener("input", () => {
  const matchingPreset = [...qualityPreset.options].find((option) => option.value === lodScaleInput.value);
  qualityPreset.value = matchingPreset?.value ?? "custom";
  applyQualitySettings();
});

window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;

  if (event.key.toLowerCase() === "w") setTransformMode("translate");
  if (event.key.toLowerCase() === "e") setTransformMode("rotate");
  if (event.key.toLowerCase() === "r") setTransformMode("scale");
  if (event.key === "Escape") clearTransformMode();
});

window.addEventListener("resize", () => {
  resize();
  frameSplat();
});

renderer.setAnimationLoop(() => {
  if (spinEnabled && splatRoot) {
    // Die Kamera faehrt um das Bauteil, statt das Bauteil zu drehen. Beim
    // Begutachten will man um ein Objekt herumgehen; ein sich drehendes Objekt
    // steht dagegen schief zum Boden und wirkt wie ein Ausstellungsteller.
    const ziel = controls.target;
    const dx = camera.position.x - ziel.x;
    const dz = camera.position.z - ziel.z;
    const winkel = 0.004;
    const cos = Math.cos(winkel);
    const sin = Math.sin(winkel);
    camera.position.x = ziel.x + dx * cos - dz * sin;
    camera.position.z = ziel.z + dx * sin + dz * cos;
    camera.lookAt(ziel);
    controls.update();
  }

  controls.update();
  renderer.render(scene, camera);
});

resize();
applyFov();
resetCamera();
applyQualitySettings();

// m-hub: ein Splat direkt per ?src=<url> oeffnen (Dokument-URL); sonst das Asset-Manifest.
const srcParam = new URLSearchParams(location.search).get("src");
if (srcParam) {
  const srcName = decodeURIComponent(srcParam.split("?")[0].split("/").pop() || "splat");
  loadSplat({ url: srcParam, source: "m-hub", name: srcName });
} else {
  loadAssetManifest();
}
