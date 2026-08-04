const fs = require('fs');
let code = fs.readFileSync('src/shared/reportLogic.ts', 'utf8');

const target = `      callAutoTable(doc, {
        startY: currentY,
        head: [['MONTH', ...monthNames, 'Total']],
        styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
        theme: 'grid',`;

const replacement = `      callAutoTable(doc, {
        startY: currentY,
        head: [['MONTH', ...monthNames, 'Total']],`;

code = code.replace(target, replacement);

const target2 = `      callAutoTable(doc, {
        startY: currentY,
        head: [['MONTH', 'CASH BASIS', 'ACCRUAL BASIS', 'DEFERRED BALANCE']],
        styles: { fontSize: 8, cellPadding: 2 },
        theme: 'grid',`;

const replacement2 = `      callAutoTable(doc, {
        startY: currentY,
        head: [['MONTH', 'CASH BASIS', 'ACCRUAL BASIS', 'DEFERRED BALANCE']],`;

if (code.includes(target2)) {
    code = code.replace(target2, replacement2);
}

fs.writeFileSync('src/shared/reportLogic.ts', code);
