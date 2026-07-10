const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const projectRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(projectRoot, '..');
const envFile = readEnvFile(path.join(repoRoot, '.env'));
const requestedBranding = process.argv[2] || process.env.FRONTEND_BRANDING || envFile.FRONTEND_BRANDING || 'default';
const customizationRoot = path.join(projectRoot, 'customization');
const defaultSource = path.join(customizationRoot, 'default');
const selectedSource = path.join(customizationRoot, requestedBranding);
const source = fs.existsSync(selectedSource) ? selectedSource : defaultSource;

if (!fs.existsSync(source)) {
  throw new Error(`Branding "${requestedBranding}" not found and no default branding exists.`);
}

if (source !== selectedSource) {
  console.warn(`[branding] "${requestedBranding}" not found. Falling back to "default".`);
}

const assetsTarget = path.join(projectRoot, 'src', 'assets', 'branding');
const themeSource = path.join(source, '_theme-setup.scss');
const themeTarget = path.join(projectRoot, 'src', '_theme-setup.generated.scss');
const faviconSource = path.join(source, 'favicon.ico');
const defaultFaviconSource = path.join(defaultSource, 'favicon.ico');
const faviconTarget = path.join(assetsTarget, 'favicon.ico');
const brandingJsonSource = path.join(source, 'branding.json');
const brandingJsonTarget = path.join(assetsTarget, 'branding.json');
const indexHtmlTarget = path.join(projectRoot, 'src', 'index.html');
const imageAssetsTarget = path.join(projectRoot, 'src', 'assets', 'images');
const assetVersionsTarget = path.join(projectRoot, 'src', 'environments', 'asset-versions.generated.ts');

for (const requiredFile of [themeSource, brandingJsonSource]) {
  if (!fs.existsSync(requiredFile)) {
    throw new Error(`Required branding file missing: ${path.relative(projectRoot, requiredFile)}`);
  }
}

fs.rmSync(assetsTarget, { recursive: true, force: true });
fs.mkdirSync(assetsTarget, { recursive: true });

for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
  if (entry.name === '_theme-setup.scss' || entry.name === 'favicon.ico') {
    continue;
  }

  copyPath(path.join(source, entry.name), path.join(assetsTarget, entry.name));
}

const branding = JSON.parse(fs.readFileSync(brandingJsonTarget, 'utf8'));
const logoPath = path.join(assetsTarget, 'logo.svg');
const logoVersion = fs.existsSync(logoPath)
  ? crypto.createHash('sha256').update(fs.readFileSync(logoPath)).digest('hex').slice(0, 12)
  : path.basename(source);

const logoPathWithoutVersion = (branding.logoPath || '/assets/branding/logo.svg').split('?')[0];
branding.logoPath = `${logoPathWithoutVersion}?v=${logoVersion}`;
branding.appName = branding.appName || 'M HUB';

if (Array.isArray(branding.menuLetters)) {
  branding.menuLetters = branding.menuLetters
    .map((letter) => String(letter).trim())
    .filter(Boolean);
} else {
  delete branding.menuLetters;
}

fs.writeFileSync(brandingJsonTarget, `${JSON.stringify(branding, null, 2)}\n`);

fs.copyFileSync(themeSource, themeTarget);
recolorSvgImageAssets(readScssColorVariable(themeSource, 'svg-asset-color'));
writeAssetVersions();

const faviconToCopy = fs.existsSync(faviconSource) ? faviconSource : defaultFaviconSource;
if (fs.existsSync(faviconToCopy)) {
  fs.copyFileSync(faviconToCopy, faviconTarget);
}

const faviconVersion = fs.existsSync(faviconTarget)
  ? crypto.createHash('sha256').update(fs.readFileSync(faviconTarget)).digest('hex').slice(0, 12)
  : null;

if (fs.existsSync(indexHtmlTarget)) {
  const faviconHref = `/assets/branding/favicon.ico${faviconVersion ? `?v=${faviconVersion}` : ''}`;
  const logoPreloadHref = branding.logoPath || '/assets/branding/logo.svg';
  const indexHtml = fs.readFileSync(indexHtmlTarget, 'utf8');
  fs.writeFileSync(
    indexHtmlTarget,
    indexHtml
      .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(branding.appName)}</title>`)
      .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" type="image/x-icon" href="${faviconHref}">`)
      .replace(/<link rel="preload" href="\/assets\/branding\/logo\.svg[^"]*" as="image" \/>/, `<link rel="preload" href="${escapeHtml(logoPreloadHref)}" as="image" />`)
  );
}

console.log(`[branding] Applied "${path.basename(source)}".`);

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((values, line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        return values;
      }

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) {
        return values;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
      values[key] = value;
      return values;
    }, {});
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function copyPath(sourcePath, targetPath) {
  const stats = fs.statSync(sourcePath);

  if (stats.isDirectory()) {
    fs.mkdirSync(targetPath, { recursive: true });

    for (const entry of fs.readdirSync(sourcePath)) {
      copyPath(path.join(sourcePath, entry), path.join(targetPath, entry));
    }

    return;
  }

  if (stats.isFile()) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function readScssColorVariable(filePath, variableName) {
  const scss = fs.readFileSync(filePath, 'utf8');
  const variablePattern = new RegExp(`\\$${escapeRegExp(variableName)}\\s*:\\s*([^;]+);`);
  const match = scss.match(variablePattern);

  if (!match) {
    return null;
  }

  const value = match[1].trim();
  const hexMatch = value.match(/^#[0-9a-fA-F]{6}$/);

  if (hexMatch) {
    return value.toLowerCase();
  }

  const paletteMatch = value.match(/^mat\.get-color-from-palette\(\s*\$([a-zA-Z0-9_-]+)\s*,\s*([0-9]+)\s*\)$/);

  if (!paletteMatch) {
    return null;
  }

  return readPaletteColor(scss, paletteMatch[1], paletteMatch[2]);
}

function readPaletteColor(scss, paletteName, shade) {
  const paletteStart = scss.indexOf(`$${paletteName}: mat.define-palette((`);

  if (paletteStart === -1) {
    return null;
  }

  const paletteBody = scss.slice(paletteStart, scss.indexOf('contrast:', paletteStart));
  const shadePattern = new RegExp(`^\\s*${escapeRegExp(shade)}\\s*:\\s*(#[0-9a-fA-F]{6})\\s*,?`, 'm');
  const shadeMatch = paletteBody.match(shadePattern);

  return shadeMatch ? shadeMatch[1].toLowerCase() : null;
}

function recolorSvgImageAssets(svgAssetColor) {
  if (!svgAssetColor || !fs.existsSync(imageAssetsTarget)) {
    return;
  }

  for (const filePath of getFiles(imageAssetsTarget, '.svg')) {
    const svg = fs.readFileSync(filePath, 'utf8');
    const recoloredSvg = svg
      .replace(/(stroke\s*[:=]\s*["']?\s*)#[0-9a-fA-F]{6}/g, `$1${svgAssetColor}`)
      .replace(/(fill\s*[:=]\s*["']?\s*)#[0-9a-fA-F]{6}/g, `$1${svgAssetColor}`);

    if (recoloredSvg !== svg) {
      fs.writeFileSync(filePath, recoloredSvg);
    }
  }
}

function writeAssetVersions() {
  const imageSvgVersion = hashFiles(getFiles(imageAssetsTarget, '.svg'));
  fs.writeFileSync(
    assetVersionsTarget,
    `export const assetVersions = {\n  imageSvgVersion: '${imageSvgVersion}'\n};\n`
  );
}

function hashFiles(filePaths) {
  const hash = crypto.createHash('sha256');

  for (const filePath of filePaths.sort()) {
    hash.update(path.relative(projectRoot, filePath));
    hash.update('\0');
    hash.update(fs.readFileSync(filePath));
    hash.update('\0');
  }

  return hash.digest('hex').slice(0, 12);
}

function getFiles(directoryPath, extension) {
  return fs.readdirSync(directoryPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      return getFiles(entryPath, extension);
    }

    return entry.isFile() && entry.name.toLowerCase().endsWith(extension) ? [entryPath] : [];
  });
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
