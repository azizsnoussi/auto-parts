const fs = require('fs');
const path = require('path');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk('src/pages/admin').filter(f => f.endsWith('.tsx'));
const get = (o, k) => k.split('.').reduce((v, p) => v && Object.prototype.hasOwnProperty.call(v, p) ? v[p] : undefined, o);
for (const lang of ['fr', 'en']) {
  const json = JSON.parse(fs.readFileSync(`src/i18n/${lang}.json`, 'utf8'));
  const missing = [];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)) {
      const direct = get(json, match[1]);
      const plural = get(json, `${match[1]}_other`) ?? get(json, `${match[1]}_one`);
      if (direct === undefined && plural === undefined) missing.push(`${file}: ${match[1]}`);
    }
  }
  console.log(`${lang} missing ${missing.length}`);
  console.log([...new Set(missing)].join('\n'));
}
