import * as fs from 'fs';
import * as path from 'path';

const sharedPath = path.join(process.cwd(), 'src/shared/reportLogic.ts');
const edgeFunctionPath = path.join(process.cwd(), 'supabase/functions/send-reports/reportLogic.ts');

let content = fs.readFileSync(sharedPath, 'utf-8');

// Replace date-fns import for Deno/Supabase Edge Functions
content = content.replace(/from ['"]date-fns['"]/g, "from 'npm:date-fns'");

fs.writeFileSync(edgeFunctionPath, content);
console.log('Report logic synced to Edge Function.');
