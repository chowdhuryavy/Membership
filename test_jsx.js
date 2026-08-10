const fs = require('fs');
const content = fs.readFileSync('pages/Settings.tsx', 'utf8');
console.log(content.includes('localSelected') ? 'localSelected still there' : 'localSelected removed');
