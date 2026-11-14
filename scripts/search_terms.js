import fs from 'fs';
import path from 'path';

const straightApos = 'Shivaji' + String.fromCharCode(39) + 's';

const checks = [
  { name: 'C.S Creative Solution', regex: /C\.S Creative Solution/g },
  { name: 'Creative Solution (singular)', regex: /Creative Solution(?![sS])/g },
  { name: 'CS Creative', regex: /CS Creative/g },
  { name: "Shivaji's (straight apostrophe)", regex: new RegExp(straightApos, 'g') },
];

const matches = [];

function search(dir) {
  for (const f of fs.readdirSync(dir)) {
    if (['node_modules', '.next', '.git', 'screenshots', 'test_data', 'search_terms.js'].includes(f)) continue;
    const fp = path.join(dir, f);
    const st = fs.statSync(fp);
    if (st.isDirectory()) {
      search(fp);
    } else {
      try {
        const content = fs.readFileSync(fp, 'utf8');
        checks.forEach(c => {
          if (c.regex.test(content)) {
            matches.push({ file: fp, target: c.name });
          }
        });
      } catch (e) {}
    }
  }
}

search('.');
console.log('Total forbidden brand occurrences found:', matches.length);
matches.forEach(m => console.log(`❌ [${m.target}] in ${m.file}`));
if (matches.length === 0) {
  console.log('✅ ZERO forbidden brand occurrences across the entire project!');
}
process.exit(matches.length === 0 ? 0 : 1);
