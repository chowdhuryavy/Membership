const fs = require('fs');
let code = fs.readFileSync('pages/Reports.tsx', 'utf8');

const regex = /\{\/\* Grand Total \*\/\}\s*<tr className="bg-slate-100 text-slate-900 font-black text-\[10px\]">([\s\S]*?)<\/tr>/;

const correctGrandTotal = `{/* Grand Total */}
                      <tr className="bg-slate-900 text-white font-black text-[10px]">
                          <td colSpan={
                              (visibleColumns.sl_no ? 1 : 0) +
                              (visibleColumns.guest_name ? 1 : 0) +
                              (visibleColumns.membership_no ? 1 : 0) +
                              (visibleColumns.start_date ? 1 : 0) +
                              (visibleColumns.end_date ? 1 : 0) +
                              (visibleColumns.days ? 1 : 0)
                          } className="border border-black px-4 py-3 text-right uppercase tracking-widest">
                              Grand Total
                          </td>
                          {visibleColumns.daily_rate && <td className="border border-black px-2 py-3 text-right">{formatMoney(grandDailyRate)}</td>}
                          {visibleColumns.rev_actual && <td className="border border-black px-2 py-3 text-right">{formatMoney(grandActual)}</td>}
                          {visibleColumns.rev_discount && <td className="border border-black px-2 py-3 text-right">{formatMoney(grandDiscount)}</td>}
                          {visibleColumns.net_fees && <td className="border border-black px-2 py-3 text-right">{formatMoney(grandNetFees)}</td>}
                          {visibleColumns.prev_accrual && <td className="border border-black px-2 py-3 text-right">{formatMoney(grandPrevAccrual)}</td>}
                          {visibleColumns.period_rev && <td className="border border-black px-2 py-3 text-right text-indigo-300">{formatMoney(grandPeriodRev)}</td>}
                          {visibleColumns.deferred && <td className="border border-black px-2 py-3 text-right text-red-400">{formatMoney(grandDeferred)}</td>}
                      </tr>`;

code = code.replace(regex, correctGrandTotal);
fs.writeFileSync('pages/Reports.tsx', code);
