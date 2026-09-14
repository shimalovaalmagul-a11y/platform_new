const fs = require('fs');

const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const output = config.outputDirectory;
const html = fs.readFileSync(`${output}/index.html`, 'utf8');

for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const asset = match[1];
  if (asset.startsWith('#') || asset.includes(':')) continue;
  if (!fs.existsSync(`${output}/${asset}`)) throw new Error(`Missing static asset: ${asset}`);
}

if (fs.existsSync('.openai/hosting.json')) {
  throw new Error('The removed Sites configuration must not be restored.');
}

console.log('Vercel static output and local assets are valid.');
