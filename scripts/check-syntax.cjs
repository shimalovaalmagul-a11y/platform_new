const { readdirSync } = require('fs');
const { join } = require('path');
const { execFileSync } = require('child_process');

function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(file) : entry.name.endsWith('.js') ? [file] : [];
  });
}

for (const file of [...filesIn('api'), 'dist/auth.js']) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}

console.log('JavaScript syntax is valid.');
