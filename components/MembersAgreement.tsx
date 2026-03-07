
import React from 'react';
import { Member, MembershipCategory, Property, CompanySettings, Outlet } from '../types';
import { format } from 'date-fns';
import { Printer, X, FileText, ShieldCheck } from 'lucide-react';
import { Button } from './ui';

interface MembersAgreementProps {
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

export const MembersAgreement: React.FC<MembersAgreementProps> = ({
  member,
  category,
  outlet,
  property,
  settings,
  formatMoney,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const logoUrl = property?.logo_url || settings?.logo_url || '';
  const propertyName = (property?.name || 'THE TORCH COLLECTION').toUpperCase();
  const outletName = (outlet?.name || 'HEALTH CLUB').toUpperCase();

  const Checkbox = ({ checked, labelEn, labelAr }: { checked?: boolean, labelEn: string, labelAr: string }) => (
    <div className="flex items-center gap-2">
      <div className={`w-4 h-4 border-2 border-black flex items-center justify-center text-[10px] font-black shrink-0 ${checked ? 'bg-black text-white' : 'bg-transparent'}`}>
        {checked ? '✓' : ''}
      </div>
      <div className="flex gap-2 items-center text-[9px] font-bold text-black uppercase">
        <span>{labelEn}</span>
        <span dir="rtl" className="font-arabic">{labelAr}</span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[300] bg-slate-900/90 backdrop-blur-md flex items-start justify-center p-4 md:p-8 animate-in fade-in duration-300 overflow-y-auto print:p-0 print:bg-white print:block">
      <div className="bg-white w-full max-w-[850px] rounded-2xl shadow-2xl flex flex-col border border-white/20 my-4 print:my-0 print:shadow-none print:w-full print:max-w-none print:border-none">
        
        <div className="px-8 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-[210] rounded-t-2xl no-print">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg"><FileText className="w-5 h-5 text-indigo-600" /></div>
            <span className="text-sm font-black text-slate-900 uppercase tracking-widest">Membership Agreement Ledger</span>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handlePrint} className="rounded-xl h-11 px-6 font-black text-xs uppercase shadow-xl shadow-indigo-100">
              <Printer className="w-4 h-4 mr-2" /> Print Agreement
            </Button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-all"><X className="w-5 h-5 text-slate-400" /></button>
          </div>
        </div>

        <div className="p-12 md:p-20 bg-white print:p-10">
          <div className="max-w-[750px] mx-auto text-black font-serif">
            {/* Header */}
            <div className="flex justify-between items-start mb-12 border-b-4 border-black pb-8">
              <div className="flex-1">
                <h1 className="text-3xl font-black tracking-tighter text-black uppercase mb-1">{propertyName}</h1>
                <h2 className="text-sm font-black text-slate-500 uppercase tracking-[0.3em]">{outletName}</h2>
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-black text-white rounded text-[9px] font-black uppercase tracking-widest">
                  <ShieldCheck className="w-3 h-3" /> Certified Member Record
                </div>
              </div>
              <div className="flex flex-col items-end gap-4">
                {logoUrl && <img src={logoUrl} alt="Logo" className="h-20 w-auto object-contain" />}
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest">Serial No.</p>
                  <p className="text-xl font-black tracking-widest text-indigo-600">{member.membership_number}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12 mb-10">
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase border-b border-black pb-1">Member Identity</h3>
                <div className="space-y-2">
                   <p className="text-[10px] font-bold text-slate-400 uppercase">Legal Name</p>
                   <p className="text-base font-black uppercase">{member.guest_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Nationality</p>
                    <p className="text-xs font-black uppercase">{member.nationality || '---'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Date of Birth</p>
                    <p className="text-xs font-black uppercase">{member.dob ? format(parseISO(member.dob), 'dd MMM yyyy') : '---'}</p>
                  </div>
                </div>
                <div className="space-y-2">
                   <p className="text-[10px] font-bold text-slate-400 uppercase">Contact Information</p>
                   <p className="text-xs font-black">{member.email}</p>
                   <p className="text-xs font-black">{member.phone}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase border-b border-black pb-1">Enrollment Logic</h3>
                <div className="space-y-2">
                   <p className="text-[10px] font-bold text-slate-400 uppercase">Tier Designation</p>
                   <p className="text-base font-black uppercase text-indigo-600">{category?.name || 'Custom Membership'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Commencement</p>
                    <p className="text-xs font-black uppercase">{format(parseISO(member.start_date), 'dd MMM yyyy')}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Expiry Date</p>
                    <p className="text-xs font-black uppercase">{format(parseISO(member.current_end_date), 'dd MMM yyyy')}</p>
                  </div>
                </div>
                <div className="pt-4 mt-2 border-t border-dashed border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Contribution</p>
                    <p className="text-xl font-black">{formatMoney(member.net_amount)}</p>
                </div>
              </div>
            </div>

            {/* Checkbox Section */}
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 mb-10 grid grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Checkbox checked={member.membership_type === 'New'} labelEn="New Enrollment" labelAr="طلب جديد" />
                  <Checkbox checked={member.membership_type === 'Renew'} labelEn="Renewal" labelAr="تجديد" />
                </div>
                <div className="space-y-3">
                  <Checkbox checked={member.access_type === 'Pool' || member.access_type === 'Both'} labelEn="Pool Access" labelAr="حمام السباحة" />
                  <Checkbox checked={member.access_type === 'Spa' || member.access_type === 'Both'} labelEn="Spa Facilities" labelAr="نادي السبا" />
                </div>
            </div>

            {/* Family Details if applicable */}
            {(member.package_type === 'Couple' || member.package_type === 'Family') && (
              <div className="mb-10 space-y-6">
                <h3 className="text-xs font-black uppercase border-b-2 border-black pb-1">Family Manifest</h3>
                <div className="grid grid-cols-2 gap-4 p-4 border border-slate-100 rounded-xl">
                   <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Spouse Name</p>
                      <p className="text-xs font-black uppercase">{member.spouse_name || 'Not Declared'}</p>
                   </div>
                   <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Date of Birth</p>
                      <p className="text-xs font-black">{member.spouse_dob ? format(parseISO(member.spouse_dob), 'dd MMM yyyy') : '---'}</p>
                   </div>
                </div>
                {member.kids && member.kids.length > 0 && (
                  <div className="grid grid-cols-1 gap-2">
                    {member.kids.map((kid, i) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-[10px] font-black uppercase tracking-tight">Dependent {i+1}: {kid.name}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">DOB: {format(parseISO(kid.dob), 'dd MMM yyyy')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Terms & Conditions */}
            <div className="mt-12 pt-8 border-t-4 border-black">
               <div className="grid grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <h4 className="text-[11px] font-black uppercase underline">Conditions of Enrollment</h4>
                    <p className="text-[9px] leading-relaxed text-justify">
                      Membership is non-transferable and non-refundable. All facility rules must be strictly adhered to. The management reserves the right to suspend or terminate membership for breach of protocols. Members must present their ID upon entry.
                    </p>
                  </div>
                  <div className="space-y-4" dir="rtl">
                    <h4 className="text-[11px] font-black uppercase underline font-arabic">شروط العضوية</h4>
                    <p className="text-[9px] leading-relaxed text-justify font-arabic">
                      العضوية غير قابلة للتحويل وغير قابلة للاسترداد. يجب الالتزام الصارم بجميع قواعد المنشأة. تحتفظ الإدارة بالحق في تعليق أو إنهاء العضوية بسبب خرق البروتوكولات. يجب على الأعضاء تقديم هويتهم عند الدخول.
                    </p>
                  </div>
               </div>
            </div>

            {/* Signatures */}
            <div className="mt-20 grid grid-cols-2 gap-20">
               <div className="relative">
                  {member.member_signature && (
                    <img src={member.member_signature} alt="Member Signature" className="absolute bottom-full left-0 h-16 object-contain mb-2" />
                  )}
                  <div className="border-t border-black pt-2 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase">Member Signature</span>
                    <span className="text-[10px] font-black uppercase font-arabic">توقيع العضو</span>
                  </div>
               </div>
               <div className="relative">
                  {member.staff_signature && (
                    <img src={member.staff_signature} alt="Staff Signature" className="absolute bottom-full left-0 h-16 object-contain mb-2" />
                  )}
                  <div className="border-t border-black pt-2 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase">Authorized Officer</span>
                    <span className="text-[10px] font-black uppercase font-arabic">المسؤول المعتمد</span>
                  </div>
               </div>
            </div>

            <div className="mt-12 text-center">
              <p className="text-[8px] font-bold text-slate-300 uppercase tracking-[0.5em]">This is a digitally generated legal instrument &bull; System ID: {member.id.substring(0,8)}</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print:block, .print:block * { visibility: visible !important; }
          .no-print { display: none !important; }
          .print-modal-container { position: absolute; left: 0; top: 0; width: 100%; }
          @page { size: A4; margin: 15mm; }
        }
        .font-arabic { font-family: 'Amiri', 'Traditional Arabic', serif; }
      `}</style>
    </div>
  );
};
