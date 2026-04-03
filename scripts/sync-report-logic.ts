import * as fs from 'fs';
import * as path from 'path';

const baseDir = process.cwd();
const edgeFuncDir = path.join(baseDir, 'supabase/functions/send-reports');

const filesToSync = [
  { src: 'src/shared/reportLogic.ts', dest: 'reportLogic.ts' },
  { src: 'src/shared/monthlyRevenueReportLogic.ts', dest: 'monthlyRevenueReportLogic.ts' },
  { src: 'services/revenueEngine.ts', dest: 'revenueEngine.ts' },
  { src: 'types.ts', dest: 'types.ts' }
];

filesToSync.forEach(({ src, dest }) => {
  const srcPath = path.join(baseDir, src);
  const destPath = path.join(edgeFuncDir, dest);
  
  let content = fs.readFileSync(srcPath, 'utf-8');
  
  // 1. Replace date-fns import for Deno
  content = content.replace(/from ['"]date-fns['"]/g, "from 'npm:date-fns'");
  
  // 2. Fix relative imports to be local within the edge function directory
  content = content.replace(/from ['"]\.\.\/\.\.\/services\/revenueEngine['"]/g, "from './revenueEngine.ts'");
  content = content.replace(/from ['"]\.\/monthlyRevenueReportLogic['"]/g, "from './monthlyRevenueReportLogic.ts'");
  content = content.replace(/from ['"]\.\.\/types['"]/g, "from './types.ts'");
  
  // 3. Handle supabase import
  // In the edge function, we pass the supabase client in the context, so we don't need the global one.
  if (dest === 'monthlyRevenueReportLogic.ts' || dest === 'reportLogic.ts') {
    content = content.replace(/import { supabase } from ['"]\.\.\/\.\.\/services\/supabase['"];/g, "// supabase is passed in context");
  }

  // Ensure .ts extension for Deno imports if missing
  content = content.replace(/from ['"](\.\.?\/[^'"]+)['"]/g, (match, p1) => {
    if (p1.endsWith('.ts') || p1.startsWith('npm:')) return match;
    return `from '${p1}.ts'`;
  });

  fs.writeFileSync(destPath, content);
  console.log(`Synced ${src} -> ${dest}`);
});

// Create a stub for supabase if needed, or just ensure it's not used where it shouldn't be.
// In reportLogic.ts and monthlyRevenueReportLogic.ts, supabase is usually passed as an argument.

