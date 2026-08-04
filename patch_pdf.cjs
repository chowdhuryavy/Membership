const fs = require('fs');
let code = fs.readFileSync('pages/Reports.tsx', 'utf8');

const replacement = `      const start = reportType === 'daily_sales' ? startOfDay(parseISO(dailySalesDate)) : startOfDay(parseISO(reportMonth + '-01'));
      const cacheKey = \`\${reportType}_\${currentOutlet.id}_\${format(start, 'yyyy-MM-dd')}_\${incentiveDept}_\${selectedMembershipTypeId}_\${revenueMode}\`;
      const cachedData = reportCache.current[cacheKey] || { rows: reportType === 'revenue_recognition' ? revenueRows : rows, summary: summary, groupedRows: reportType === 'revenue_recognition' ? (reportCache.current[cacheKey]?.groupedRows || {}) : undefined };
      
      const { jsPDF } = await import('jspdf');`;

code = code.replace("const { jsPDF } = await import('jspdf');", replacement);
code = code.replace("data: { rows: rows, summary: summary },", "data: cachedData,");

fs.writeFileSync('pages/Reports.tsx', code);
console.log('Patched');
