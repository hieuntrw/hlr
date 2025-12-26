const fs = require('fs');
const path = require('path');

function walk(dir, cb) {
  fs.readdirSync(dir).forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) return walk(full, cb);
    cb(full);
  });
}

const root = path.resolve(__dirname, '..');
const results = [];
const patterns = [
  /cookie\.?slice\(|cookie\?\.slice\(|\.substring\([^)]*sb-access-token|sb-access-token|sb-refresh-token|sb-session/gi,
  /serverDebug\.debug\([^\)]*(sb-access-token|sb-refresh-token|sb-session|raw Cookie)/gi,
];

walk(root, (file) => {
  if (!file.endsWith('.ts') && !file.endsWith('.tsx') && !file.endsWith('.js')) return;
  const content = fs.readFileSync(file, 'utf8');
  patterns.forEach((p) => {
    if (p.test(content)) results.push({ file, pattern: p.toString() });
  });
});

if (results.length > 0) {
  console.log('Potential sensitive logging found:');
  results.forEach(r => console.log(' -', r.file, r.pattern));
  process.exitCode = 2;
} else {
  console.log('No obvious sensitive logging patterns detected.');
}
