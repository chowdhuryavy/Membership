const fs = require('fs');
let code = fs.readFileSync('pages/Settings.tsx', 'utf8');

code = code.replace(/const \[localSelected, setLocalSelected\] = useState[^\n]+\n/g, '');
code = code.replace(/useEffect\(\(\) => \{\n\s+setLocalSelected[^\n]+\n\s+\}, \[selectedPermissions\]\);\n/g, '');
code = code.replace(/localSelected/g, 'selectedPermissions');
code = code.replace(/setLocalSelected\(newSelected\);/g, '');

fs.writeFileSync('pages/Settings.tsx', code);
console.log('Fixed localSelected');
