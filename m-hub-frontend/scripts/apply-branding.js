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
