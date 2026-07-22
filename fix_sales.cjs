const fs = require('fs');

let content = fs.readFileSync('pages/Sales.tsx', 'utf8');

const earlyReturn = `    if (!canView) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Card className="max-w-md text-center p-8 border-red-100 bg-red-50/30 rounded-[2rem]">
                    <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Access Denied</h3>
                    <p className="text-slate-500 mt-2 text-sm font-bold uppercase tracking-tight">Your permissions do not allow access to the Sales Ledger.</p>
                </Card>
            </div>
        );
    }
`;

content = content.replace(earlyReturn, '');
const targetPoint = '    if (loading) {';
content = content.replace(targetPoint, earlyReturn + '\n' + targetPoint);

fs.writeFileSync('pages/Sales.tsx', content);
