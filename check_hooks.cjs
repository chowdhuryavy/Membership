const fs = require('fs');
const path = require('path');

function walk(dir, filelist = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === 'dist' || file === '.git') continue;
    const filepath = path.join(dir, file);
    if (fs.statSync(filepath).isDirectory()) {
      walk(filepath, filelist);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      filelist.push(filepath);
    }
  }
  return filelist;
}

const files = walk('.');
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('useState')) {
     const lines = content.split('\n');
     let inEffect = false;
     let inCallback = false;
     let inMemo = false;
     let inThen = false;
     for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('useEffect(')) inEffect = true;
        if (line.includes('useCallback(')) inCallback = true;
        if (line.includes('useMemo(')) inMemo = true;
        if (line.includes('.then(')) inThen = true;
        
        if (line.includes('useState(')) {
           if (inEffect || inCallback || inMemo || inThen) {
               console.log(`Found useState inside block in ${file}:${i+1}`);
               console.log(line);
           }
        }
        
        // rudimentary block tracking is hard with regex, this is just a guess
        // We'll see if it outputs anything
     }
  }
}
