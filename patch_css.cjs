const fs = require('fs');
let code = fs.readFileSync('pages/Reports.tsx', 'utf8');

const target = `      <style>{\`
        @media print {
            body { background: white !important; }
            .no-print { display: none !important; }
            #root, main { overflow: visible !important; height: auto !important; position: static !important; }
            
            /* Hide everything by default */
            body * { visibility: hidden; }
            
            /* Show the print container and its children */
            .print-container, .print-container * { 
                visibility: visible !important; 
            }
            
            .print-container { 
                position: absolute !important; 
                left: 0 !important; 
                top: 0 !important; 
                width: 100% !important;
                height: 100% !important;
                padding: 0 !important;
                margin: 0 !important;
                background: white !important;
                box-sizing: border-box !important;
            }
            
            /* Preserve colors */
            * { 
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important; 
            }
            
            @page { 
                size: A4 landscape; 
                margin: 5mm; 
            }
        }
      \`}</style>`;

const replacement = `      <style>{\`
        @media print {
            body { background: white !important; }
            .no-print { display: none !important; }
            
            .print-container {
                width: 100%;
                background: white !important;
            }
            
            * { 
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important; 
            }
            
            @page { 
                size: A4 landscape; 
                margin: 5mm; 
            }
        }
      \`}</style>`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    console.log("Patched CSS");
} else {
    console.log("Could not find CSS to patch");
}

fs.writeFileSync('pages/Reports.tsx', code);
