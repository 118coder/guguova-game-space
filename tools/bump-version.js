// Update the shared version in the project file and every static asset query.
// Usage: node tools/bump-version.js 1.5.1
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const value = (process.argv[2] || '').trim();
if (!/^\d+\.\d+\.\d+$/.test(value)) {
  console.error('usage: node tools/bump-version.js <major.minor.patch>');
  process.exit(1);
}

const write = (file, transform) => {
  const full = path.join(root, file);
  const before = fs.readFileSync(full, 'utf8');
  const after = transform(before);
  if (after !== before) fs.writeFileSync(full, after);
  console.log(after !== before ? 'updated' : 'unchanged', file);
};

const metaPath = path.join(root, 'version.json');
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
meta.version = value;
meta.legacyVersion = value;
meta.updatedUtc = new Date().toISOString();
fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
console.log('updated version.json');

write('NovaGameSpace.csproj', (s) => s.replace(/<Version>[^<]+<\/Version>/, `<Version>${value}</Version>`));
write('legacy/NovaGameSpace.Legacy.csproj', (s) => s.replace(/<Version>[^<]+<\/Version>/, `<Version>${value}</Version>`));
write('src/index.html', (s) => s.replace(/\?v=\d+\.\d+\.\d+/g, `?v=${value}`));
