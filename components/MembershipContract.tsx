
import React from 'react';
import { Member, MembershipCategory, Property, CompanySettings, Outlet } from '../types';
import { format } from 'date-fns';
import { Printer, X, FileText } from 'lucide-react';
import { Button } from './ui';

interface MembershipContractProps {
  member: Member;
  category?: MembershipCategory;
  outlet?: Outlet | null;
  property?: Property | null;
  settings?: CompanySettings | null;
  formatMoney: (amount: number) => string;
  onClose: () => void;
}

const parseISO = (dateString?: string) => {
  if (!dateString) return new Date();
  try {
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? new Date() : d;
  } catch (e) {
    return new Date();
  }
};

const getDurationWords = (months: number = 0) => {
  const mapping: Record<number, { en: string; ar: string }> = {
    1: { en: 'ONE MONTH', ar: 'شهر واحد' },
    3: { en: 'THREE MONTHS', ar: 'ثلاثة أشهر' },
    6: { en: 'SIX MONTHS', ar: 'ستة أشهر' },
    12: { en: 'TWELVE MONTHS', ar: 'اثني عشر شهرًا' },
  };
  return mapping[months] || { en: `${months} MONTHS`, ar: `${months} أشهر` };
};

export const MembershipContract: React.FC<MembershipContractProps> = ({
  member,
  category,
  outlet,
  property,
  settings,
  formatMoney,
  onClose,
}) => {
  const handlePrint = (e: React.MouseEvent) => {
    e.preventDefault();
    window.focus();
    window.print();
  };

  const logoUrl = property?.logo_url || settings?.logo_url || 'https://fqwfffkkaeknaqjorygy.supabase.co/storage/v1/object/public/logos/al_aziziyah_logo.png';
  const duration = getDurationWords(category?.duration_months);
  
  const rawName = (outlet?.name || 'HEALTH CLUB').toUpperCase();
  const cleanNameOnly = rawName.replace(/\s*MEMBERSHIP\s*$/gi, '').replace(/\s*FORM\s*$/gi, '').trim();
  const propertyName = (property?.name || 'THE TORCH COLLECTION').toUpperCase();

  const Checkbox = ({ checked, labelEn, labelAr }: { checked?: boolean, labelEn: string, labelAr: string }) => (
    <div className="flex items-center gap-2">
      <div className={`w-4 h-4 border-2 border-black flex items-center justify-center text-[11px] font-black leading-none shrink-0 ${checked ? 'bg-black text-white' : 'bg-transparent'}`}>
        {checked ? '✓' : ''}
      </div>
      <div className="flex gap-2 items-center text-[10px] font-bold">
        <span>{labelEn}</span>
        <span dir="rtl">{labelAr}</span>
      </div>
    </div>
  );

  const FormLine = ({ labelEn, labelAr, value }: { labelEn: string, labelAr: string, value?: string }) => (
    <div className="flex items-end border-b border-black/30 pb-0.5">
      <span className="text-[10px] font-bold shrink-0 whitespace-nowrap">{labelEn} :</span>
      <span className="flex-1 px-4 text-[11px] font-medium text-center min-h-[1.2rem]">{value || ''}</span>
      <span className="text-[10px] font-bold shrink-0 whitespace-nowrap" dir="rtl">{labelAr} :</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-md flex items-start justify-center p-4 md:p-8 animate-in fade-in duration-300 overflow-y-auto print-root">
      <div className="bg-white w-full max-w-[850px] rounded-xl shadow-2xl flex flex-col border border-white/20 my-4 print:my-0 print:shadow-none print:w-full print:max-w-none print:border-none print-modal-container">
        
        <div className="px-8 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-[210] rounded-t-xl no-print">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-indigo-600" />
            <span className="text-sm font-black text-slate-900 uppercase tracking-tight">{propertyName} AGREEMENT</span>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handlePrint} className="rounded-xl h-10 px-6 font-black text-xs uppercase shadow-xl shadow-indigo-100">
              <Printer className="w-4 h-4 mr-2" /> Print Agreement
            </Button>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-all active:scale-95"><X className="w-5 h-5 text-slate-500" /></button>
          </div>
        </div>

        <div className="p-10 md:p-16 bg-white print-page overflow-hidden relative">
          <div className="max-w-[720px] mx-auto text-black font-sans leading-tight">
            
            <div className="text-center mb-8">
              <img src={logoUrl} alt="Logo" className="h-16 mx-auto object-contain mb-4" />
              <div className="space-y-0.5">
                <h1 className="text-2xl font-bold uppercase" dir="rtl">{duration.ar}</h1>
                <div className="flex justify-center items-center gap-3">
                    <h2 className="text-xl font-bold uppercase tracking-tight">{cleanNameOnly} MEMBERSHIP</h2>
                    <h2 className="text-xl font-bold uppercase tracking-tight" dir="rtl">طلب عضوية</h2>
                </div>
                <h2 className="text-xl font-bold uppercase tracking-[0.2em]">{duration.en}</h2>
                <h3 className="text-lg font-bold uppercase tracking-tight">MEMBERSHIP FORM</h3>
              </div>
            </div>

            <div className="flex justify-center mb-8">
                <div className="flex items-end border-b border-black pb-1 w-full max-w-[500px]">
                   <span className="text-[11px] font-bold shrink-0 uppercase">MEMBERSHIP ID:</span>
                   <span className="flex-1 text-center font-bold px-4 text-xl tracking-widest">{member.membership_number}</span>
                   <span className="text-[11px] font-bold shrink-0" dir="rtl">: رقم العضوية</span>
                </div>
            </div>

            <div className="flex justify-center gap-20 mb-4 px-10">
                <div className="flex gap-12">
                  <Checkbox checked={member.membership_type === 'New'} labelEn="New" labelAr="طلب جديد" />
                  <Checkbox checked={member.membership_type === 'Renew'} labelEn="Renew" labelAr="تجديد" />
                </div>
                <div className="flex gap-12">
                  <Checkbox checked={member.access_type === 'Pool' || member.access_type === 'Both'} labelEn="Pool" labelAr="حمام" />
                  <Checkbox checked={member.access_type === 'Spa' || member.access_type === 'Both'} labelEn="Spa" labelAr="السبا" />
                </div>
            </div>
            
            <div className="flex justify-center gap-20 py-2 mb-6 border-b border-black/10">
                <Checkbox checked={member.package_type === 'Single'} labelEn="Single" labelAr="أعزب" />
                <Checkbox checked={member.package_type === 'Couple'} labelEn="Couple" labelAr="زوجان" />
                <Checkbox checked={member.package_type === 'Family'} labelEn="Family" labelAr="أسرة" />
            </div>

            <div className="space-y-3.5">
                <FormLine labelEn="Name" labelAr="الاسم" value={member.guest_name} />
                <div className="grid grid-cols-2 gap-x-8">
                  <FormLine labelEn="Nationality" labelAr="الجنسية" value={member.nationality} />
                  <div className="flex items-end border-b border-black pb-0.5">
                    <span className="text-[10px] font-bold shrink-0">Date of Birth :</span>
                    <span className="flex-1 text-[11px] text-center font-medium">{member.dob ? format(parseISO(member.dob), 'dd/MM/yyyy') : ''}</span>
                    <span className="text-[10px] font-bold shrink-0" dir="rtl">: تاريخ الميلاد</span>
                    <div className="flex gap-4 ml-4 items-center">
                      <Checkbox checked={!member.is_married && member.package_type === 'Single'} labelEn="Single" labelAr="أعزب" />
                      <Checkbox checked={member.is_married || member.package_type !== 'Single'} labelEn="Married" labelAr="متزوج" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 items-end border-b border-black pb-0.5">
                  <span className="text-[10px] font-bold">Email :</span>
                  <span className="flex-1 text-[11px] font-medium text-center">{member.email}</span>
                  <span className="text-[10px] font-bold" dir="rtl">: البريد الالكتروني</span>
                  <span className="text-[10px] font-bold ml-10">Tel :</span>
                  <span className="flex-1 text-[11px] font-medium text-center">{member.phone}</span>
                  <span className="text-[10px] font-bold" dir="rtl">: رقم الهاتف</span>
                </div>
                <div className="grid grid-cols-2 gap-x-8 mt-4">
                  <FormLine labelEn="Start Date" labelAr="تاريخ المباشرة بالعضوية" value={format(parseISO(member.start_date), 'dd/MM/yyyy')} />
                  <FormLine labelEn="End Date" labelAr="تاريخ الإنتهاء" value={format(parseISO(member.current_end_date), 'dd/MM/yyyy')} />
                </div>
                <FormLine labelEn="Amount Paid" labelAr="المبلغ المدفوع" value={formatMoney(member.net_amount)} />
                <FormLine labelEn="Remarks" labelAr="ملاحظات" value={member.remarks} />
            </div>

            <div className="mt-8 border-t-2 border-black pt-6 space-y-3.5">
                <div className="flex items-end border-b border-black pb-0.5">
                    <span className="text-[10px] font-bold shrink-0">Name of Spouse :</span>
                    <span className="flex-1 text-center font-medium px-4">{member.spouse_name || ''}</span>
                    <span className="text-[10px] font-bold shrink-0" dir="rtl">: اسم الزوجة</span>
                    <span className="text-[10px] font-bold shrink-0 ml-10">Date of Birth :</span>
                    <span className="w-32 text-[11px] text-center font-medium">{member.spouse_dob ? format(parseISO(member.spouse_dob), 'dd/MM/yyyy') : ''}</span>
                    <span className="text-[10px] font-bold shrink-0" dir="rtl">: تاريخ الميلاد</span>
                </div>
                <div className="space-y-3">
                  {[0, 1, 2, 3].map(idx => (
                    <div key={idx} className="flex gap-4 items-end border-b border-black pb-0.5">
                      <span className="text-[10px] font-bold shrink-0 min-w-[50px]">Kid {idx+1}.</span>
                      <span className="flex-1 text-[11px] font-medium text-center px-4">{member.kids?.[idx]?.name || ''}</span>
                      <span className="text-[10px] font-bold shrink-0" dir="rtl">: طفل {idx+1}</span>
                      <span className="text-[10px] font-bold shrink-0 ml-12 whitespace-nowrap">Date of Birth :</span>
                      <span className="w-36 text-[11px] font-medium text-center">{member.kids?.[idx]?.dob ? format(parseISO(member.kids?.[idx]?.dob), 'dd/MM/yyyy') : ''}</span>
                      <span className="text-[10px] font-bold shrink-0" dir="rtl">: تاريخ الميلاد</span>
                    </div>
                  ))}
                </div>
            </div>

            <div className="mt-10 border-t-2 border-black pt-6">
                <div className="flex justify-between items-start gap-12 mb-5">
                   <div className="text-[10px] font-bold flex-1 text-right leading-relaxed" dir="rtl">العضوية غير قابلة للتحويل، عند الدفع للعضوية العلاجات فإن المبلغ غير قابل للإسترداد.</div>
                   <div className="text-[10px] font-bold flex-1 text-left leading-relaxed">Membership is non-transferable; Once membership / treatment is paid, it cannot be refunded.</div>
                </div>
                <div className="pt-6 border-t-2 border-black mt-6">
                  <div className="flex justify-between px-2 mb-6">
                    <div className="w-72 border-t border-black pt-1 text-[11px] flex justify-between"><span className="font-bold">Signature</span><span className="font-bold" dir="rtl">التوقيع :</span></div>
                    <div className="w-72 border-t border-black pt-1 text-[11px] flex justify-between"><span className="font-bold">Date Submitted</span><span className="font-bold" dir="rtl">تاريخ التقديم :</span></div>
                  </div>
                </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { display: none !important; visibility: hidden !important; }
          .print-root, .print-root *, .print-modal-container, .print-modal-container *, .print-page, .print-page * { display: block !important; visibility: visible !important; }
          .no-print { display: none !important; }
          .print-root { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: white !important; }
          .print-modal-container { border: none !important; box-shadow: none !important; width: 100% !important; }
          .print-page { width: 210mm !important; min-height: 297mm !important; padding: 20mm !important; margin: 0 auto !important; page-break-after: always !important; }
          @page { size: A4; margin: 0; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
};
