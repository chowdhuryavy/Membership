const fs = require('fs');
let code = fs.readFileSync('pages/Reports.tsx', 'utf8');
code = code.replace(
  /<tr className="bg-slate-900 text-white font-black text-\[10px\]">([\s\S]*?)<\/tr>/g,
  `<tr className="bg-slate-100 text-slate-900 font-black text-[10px]">
                        <td colSpan={colSpanForLabel} className="border border-black px-4 py-3 text-right uppercase tracking-widest text-slate-600">Aggregate Portfolio Totals</td>
                        {visibleColumns.gross_amount && <td className="border border-black px-2 py-3 text-right">{formatMoney(totals.totalActual)}</td>}
                        {visibleColumns.disc_percent && <td className="border border-black px-2 py-3 bg-slate-50"></td>}
                        {visibleColumns.discount_amt && <td className="border border-black px-2 py-3 text-right text-rose-600">{formatMoney(totals.totalDiscount)}</td>}
                        {visibleColumns.net_revenue && <td className="border border-black px-2 py-3 text-right text-emerald-700 text-[11px]">{formatMoney(totals.totalNetRev)}</td>}
                        
                        {(isIncentiveReport && incentiveDept === 'Membership') && (
                            <td className="border border-black px-2 py-3 text-right text-indigo-600 font-bold">{formatMoney(totals.totalReferralAmt)}</td>
                        )}
                        
                        {isIncentiveReport && (
                            <>
                                <td className="border border-black px-2 py-3 text-right bg-amber-100">{formatMoney(totals.totalIncTotal)}</td>
                                <td className="border border-black px-2 py-3 bg-amber-100"></td>
                                <td className="border border-black px-2 py-3 text-right bg-amber-100">{formatMoney(totals.totalIncDiscountVal)}</td>
                                <td className="border border-black px-2 py-3 text-right bg-indigo-600 font-black text-white text-[11px]">{formatMoney(totals.totalIncNet)}</td>
                                {visibleColumns.remarks && <td className="border border-black px-2 py-3 bg-slate-50"></td>}
                                {Array.isArray(activeStaffList) && activeStaffList.map(s => (
                                    <td key={s.id} className="border border-black px-1 py-3 text-right text-indigo-700 bg-indigo-50/50">
                                        {formatMoney(totals.staffTotals[s.id] || 0)}
                                    </td>
                                ))}
                            </>
                        )}
                        {!isIncentiveReport && visibleColumns.remarks && <td className="border border-black px-2 py-3 bg-slate-50"></td>}
                    </tr>`
);
fs.writeFileSync('pages/Reports.tsx', code);
