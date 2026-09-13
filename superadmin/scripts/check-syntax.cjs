/**
 * Syntax check for the Super Admin portal.
 *
 * Why this exists instead of `node --check`:
 *
 *   `node --check` parses as plain JavaScript. Two things here break it:
 *     1. JSX. Nearly every file under src/ is .jsx and contains JSX, which is
 *        not JavaScript. `node --check` reports syntax errors on correct files.
 *     2. ESM. package.json sets "type": "module", and `node --check` did not
 *        learn to parse ES modules until Node 22. On Node 20 it rejects the
 *        first `import` statement it sees.
 *
 *   esbuild is what Vite itself uses to parse this code, so running each file
 *   through esbuild's transform reproduces the exact parse a `vite build` would
 *   perform. It ships as a dependency of Vite, so `npm install` provides it.
 *
 * This checks syntax only. It does not resolve imports or type-check.
 *
 * Usage:  node scripts/check-syntax.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

let esbuild;
try {
  esbuild = require('esbuild');
} catch (error) {
  console.error('Could not load esbuild. Run `npm install` first.\n');
  console.error(error.message);
  process.exit(2);
}

// Files at the project root are part of the build too, so they are checked
// alongside src/. node_modules and dist are skipped.
const ROOT_FILES = ['vite.config.js'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);

const collect = (dir) => {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      found.push(...collect(full));
    } else if (/\.(js|jsx|mjs|cjs)$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
};

const show = (file) => path.relative(ROOT, file).replace(/\\/g, '/');

const files = collect(path.join(ROOT, 'src'));
for (const name of ROOT_FILES) {
  const full = path.join(ROOT, name);
  if (fs.existsSync(full)) files.push(full);
}

const failures = [];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  try {
    esbuild.transformSync(source, {
      loader: file.endsWith('.jsx') ? 'jsx' : 'js',
      // Leave the code alone — we only want it parsed, not rewritten.
      format: 'esm',
    });
  } catch (error) {
    const detail = error.errors && error.errors[0];
    failures.push({
      file: show(file),
      message: detail ? detail.text : error.message,
      where: detail && detail.location ? `line ${detail.location.line}, column ${detail.location.column}` : '',
    });
  }
}

console.log(`Parsed ${files.length} files under src/ and the project root.\n`);

if (failures.length === 0) {
  console.log('Syntax check passed — no parse errors.');
  process.exit(0);
}

console.error(`Syntax check FAILED — ${failures.length} file(s) did not parse:\n`);
for (const failure of failures) {
  console.error(`  ${failure.file}`);
  console.error(`    ${failure.message}${failure.where ? ` (${failure.where})` : ''}`);
}
process.exit(1);
