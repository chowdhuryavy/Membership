import React from 'react';
import { createPortal } from 'react-dom';
import { PTMember, Property, CompanySettings, Outlet, Staff } from '../types';
import { format } from 'date-fns';
import { Printer, X, Dumbbell, ShieldCheck, UserCheck, CheckSquare, Square } from 'lucide-react';
import { Button } from './ui';
import { getBilingualPTConsentText } from '../lib/waiverHelper';

interface PTAgreementModalProps {
  ptMember: PTMember;
  trainer?: Staff | null;
  outlet?: Outlet | null;
  property?: Property | null;
  settings?: CompanySettings | null;
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

export const PTAgreementModal: React.FC<PTAgreementModalProps> = ({
  ptMember,
  trainer,
  outlet,
  property,
  settings,
  onClose,
}) => {
  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `PT_Consent_${ptMember.guest_name.replace(/\s+/g, '_')}`;
    
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.title = originalTitle;
      }, 1000);
    }, 100);
  };

  const logoUrl = outlet?.logo_url || property?.logo_url || settings?.logo_url || '';
  const propertyName = property?.name || settings?.company_name || 'The Torch Club';
  const outletName = outlet?.name || propertyName;
  const clubDisplayName = outlet?.name || property?.name || 'The Torch Club';

  const consent = getBilingualPTConsentText(clubDisplayName);

  const parqAnswers = ptMember.parq_answers || {};
  const isMinor = ptMember.is_under_18 || false;

  return createPortal(
    <div className="fixed inset-0 z-[500] bg-slate-950/85 backdrop-blur-md flex flex-col justify-start items-center overflow-y-auto p-3 sm:p-6 print:p-0 print:bg-white print:static print:h-auto print:overflow-visible">
      {/* Top Floating Actions (Hidden on Print) */}
      <div className="w-full max-w-[210mm] flex justify-between items-center mb-4 print:hidden sticky top-0 z-10 bg-slate-900/95 backdrop-blur border border-white/10 p-4 rounded-2xl shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Dumbbell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-white font-bold text-sm">PT Health Declaration & Participation Consent Form</h2>
            <p className="text-slate-400 text-xs">{ptMember.guest_name} • {ptMember.total_sessions} Sessions • {clubDisplayName}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            onClick={handlePrint}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 px-5 rounded-xl shadow-lg flex items-center gap-2"
          >
            <Printer className="w-4 h-4" /> Print Consent Form
          </Button>
          <Button 
            onClick={onClose}
            variant="outline"
            className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white h-10 w-10 p-0 rounded-xl flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Printable Sheet (A4 Dimensions) */}
      <div 
        id="pt-consent-sheet" 
        className="w-full max-w-[210mm] bg-white text-slate-900 border border-slate-200 shadow-2xl p-6 sm:p-10 mb-8 print:border-0 print:shadow-none print:m-0 print:p-6 print:w-full print:max-w-none text-[10px] sm:text-[11px] leading-relaxed font-sans select-none print:select-text"
      >
        {/* Header Branding */}
        <div className="flex justify-between items-center pb-4 border-b-2 border-slate-900 mb-5">
          <div className="flex flex-col">
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 uppercase">{propertyName}</h1>
            <p className="text-xs font-bold text-slate-600 tracking-wider uppercase mt-0.5">{outletName}</p>
            <span className="inline-block mt-1 px-2.5 py-0.5 bg-slate-900 text-white font-black text-[8.5px] uppercase tracking-widest rounded self-start">
              Official Personal Training Consent & Health Declaration
            </span>
          </div>
          {logoUrl && (
            <div className="h-14 flex items-center justify-end">
              <img src={logoUrl} alt="Logo" className="max-h-12 max-w-[150px] object-contain" crossOrigin="anonymous" />
            </div>
          )}
        </div>

        {/* Document Title (Bilingual) */}
        <div className="text-center py-2.5 px-4 bg-slate-50 border border-slate-200 rounded-xl mb-5">
          <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900">
            {consent.titleEn}
          </h2>
          <p dir="rtl" className="text-xs sm:text-sm font-black text-slate-800 font-arabic mt-0.5">
            {consent.titleAr}
          </p>
        </div>

        {/* Member & Training Package Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5 bg-indigo-50/40 p-3 rounded-xl border border-indigo-100 text-[10px]">
          <div>
            <span className="text-[8px] font-black uppercase text-indigo-400 tracking-widest block">Full Name / الاسم</span>
            <span className="font-black text-slate-900">{ptMember.guest_name}</span>
          </div>
          <div>
            <span className="text-[8px] font-black uppercase text-indigo-400 tracking-widest block">Membership / العضوية</span>
            <span className="font-bold text-slate-800">{ptMember.membership_number || ptMember.sale_id || 'PT Client'}</span>
          </div>
          <div>
            <span className="text-[8px] font-black uppercase text-indigo-400 tracking-widest block">Contact / الهاتف</span>
            <span className="font-bold text-slate-800">{ptMember.phone || 'N/A'}</span>
          </div>
          <div>
            <span className="text-[8px] font-black uppercase text-indigo-400 tracking-widest block">Assigned Trainer / المدرب</span>
            <span className="font-bold text-indigo-700">{trainer?.name || 'Personal Training Team'}</span>
          </div>
        </div>

        {/* Section 1: Introduction Paragraphs (Bilingual) */}
        <div className="space-y-3 mb-5 bg-slate-50/50 p-4 rounded-xl border border-slate-200/80">
          {consent.introParagraphs.map((para, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[9.5px] leading-relaxed border-b border-slate-200/50 pb-2.5 last:border-0 last:pb-0">
              <p className="text-slate-800 text-justify">{para.en}</p>
              <p dir="rtl" className="text-slate-700 font-arabic text-justify">{para.ar}</p>
            </div>
          ))}
        </div>

        {/* Section 2: PAR-Q (Physical Activity Readiness Questionnaire) */}
        <div className="mb-5 bg-white border-2 border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-slate-900 text-white px-4 py-2 flex justify-between items-center">
            <span className="font-black text-[10px] tracking-wide uppercase">{consent.parqTitleEn}</span>
            <span dir="rtl" className="font-arabic font-bold text-[10px]">{consent.parqTitleAr}</span>
          </div>

          <div className="p-3.5 bg-slate-50/60 border-b border-slate-200 flex justify-between text-[9px] font-black text-slate-600">
            <span>{consent.parqInstructionEn}</span>
            <span dir="rtl" className="font-arabic">{consent.parqInstructionAr}</span>
          </div>

          <div className="divide-y divide-slate-100">
            {consent.parqQuestions.map((q) => {
              const isYes = parqAnswers[q.id] === true;
              const isNo = parqAnswers[q.id] === false;

              return (
                <div key={q.id} className="p-3 hover:bg-slate-50/50 transition-colors">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                    <div className="md:col-span-1 text-center font-black text-indigo-700 text-xs">
                      #{q.id}
                    </div>
                    <div className="md:col-span-8 space-y-1">
                      <p className="text-[9.5px] text-slate-900 font-medium">{q.en}</p>
                      <p dir="rtl" className="text-[9.5px] text-slate-600 font-arabic">{q.ar}</p>
                    </div>
                    <div className="md:col-span-3 flex items-center justify-end gap-3 text-[9px] font-black pt-1 md:pt-0">
                      <div className={`flex items-center gap-1 px-2.5 py-1 rounded-md border ${isYes ? 'bg-rose-50 border-rose-300 text-rose-700 font-black' : 'border-slate-300 text-slate-600'}`}>
                        {isYes ? <CheckSquare className="w-3.5 h-3.5 text-rose-600" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                        <span>Yes / نعم</span>
                      </div>
                      <div className={`flex items-center gap-1 px-2.5 py-1 rounded-md border ${isNo ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-black' : 'border-slate-300 text-slate-600'}`}>
                        {isNo ? <CheckSquare className="w-3.5 h-3.5 text-emerald-600" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                        <span>No / لا</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* If Yes, Details */}
          <div className="p-3.5 bg-slate-50 border-t border-slate-200">
            <div className="flex justify-between items-center text-[9px] font-bold text-slate-700 mb-1">
              <span>{consent.parqDetailsPromptEn}</span>
              <span dir="rtl" className="font-arabic">{consent.parqDetailsPromptAr}</span>
            </div>
            <div className="min-h-[32px] p-2 bg-white rounded border border-slate-300 text-[9.5px] text-slate-800">
              {ptMember.parq_details || (
                <span className="text-slate-300 italic">None reported / لا توجد تفاصيل إضافية</span>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Declaration */}
        <div className="mb-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-800 text-white px-4 py-1.5 flex justify-between items-center">
            <span className="font-black text-[10px] tracking-wide uppercase">{consent.declarationTitleEn}</span>
            <span dir="rtl" className="font-arabic font-bold text-[10px]">{consent.declarationTitleAr}</span>
          </div>

          <div className="p-4 space-y-2.5 bg-slate-50/40">
            {consent.declarationParagraphs.map((para, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[9px] leading-relaxed border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                <p className="text-slate-800 text-justify flex gap-1.5">
                  <span className="text-slate-400 font-bold shrink-0">•</span>
                  <span>{para.en}</span>
                </p>
                <p dir="rtl" className="text-slate-700 font-arabic text-justify flex gap-1.5">
                  <span className="text-slate-400 font-bold shrink-0">•</span>
                  <span>{para.ar}</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: For Participants Under 18 */}
        <div className="mb-5 p-3.5 bg-amber-50/40 border border-amber-200 rounded-xl text-[9px]">
          <div className="flex justify-between items-center font-black text-amber-900 border-b border-amber-200 pb-1.5 mb-2.5">
            <span className="uppercase tracking-wide">{consent.under18TitleEn}</span>
            <span dir="rtl" className="font-arabic">{consent.under18TitleAr}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 text-[8.5px] leading-relaxed">
            <p className="text-slate-800 text-justify">
              {consent.under18TextEn(ptMember.guardian_name || '', ptMember.guest_name || '')}
            </p>
            <p dir="rtl" className="text-slate-700 font-arabic text-justify">
              {consent.under18TextAr(ptMember.guardian_name || '', ptMember.guest_name || '')}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-amber-200/60 text-[8.5px]">
            <div>
              <span className="font-bold text-slate-500 block">Participant's DOB / تاريخ الميلاد:</span>
              <span className="font-black text-slate-800">{ptMember.dob || '___________________'}</span>
            </div>
            <div>
              <span className="font-bold text-slate-500 block">Relationship / صلة القرابة:</span>
              <span className="font-black text-slate-800">{ptMember.guardian_relationship || '___________________'}</span>
            </div>
            <div>
              <span className="font-bold text-slate-500 block">Contact Number / رقم الهاتف:</span>
              <span className="font-black text-slate-800">{ptMember.guardian_contact || ptMember.phone || '___________________'}</span>
            </div>
            <div>
              <span className="font-bold text-slate-500 block">Parent Signature / توقيع ولي الأمر:</span>
              <span className="font-black text-slate-800">{ptMember.guardian_signature || '___________________'}</span>
            </div>
          </div>
        </div>

        {/* Section 5: Member & Staff Signatures (Exact Match to Requested Structure) */}
        <div className="pt-4 border-t-2 border-slate-900 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Member Details & Digital Signature */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex justify-between items-center border-b border-slate-200 pb-1 text-[9px]">
              <span className="font-black text-slate-600">Full Name : <span className="text-slate-900 font-black">{ptMember.guest_name}</span></span>
              <span dir="rtl" className="font-arabic font-bold text-slate-700">الاسم الكامل</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200 pb-1 text-[9px]">
              <span className="font-bold text-slate-600">Membership: <span className="text-slate-900 font-bold">{ptMember.membership_number || ptMember.sale_id || 'PT Package'}</span></span>
              <span dir="rtl" className="font-arabic font-bold text-slate-700">العضوية</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200 pb-1 text-[9px]">
              <span className="font-bold text-slate-600">Contact Number: <span className="text-slate-900 font-bold">{ptMember.phone || 'N/A'}</span></span>
              <span dir="rtl" className="font-arabic font-bold text-slate-700">رقم الهاتف</span>
            </div>
            
            <div className="pt-1">
              <div className="flex justify-between items-center text-[8.5px] font-black text-slate-500 mb-1">
                <span>Signature / التوقيع:</span>
                <span>Date / التاريخ: {ptMember.created_at ? format(parseISO(ptMember.created_at), 'dd/MM/yyyy') : format(new Date(), 'dd/MM/yyyy')}</span>
              </div>
              <div className="h-20 border border-dashed border-slate-300 rounded-lg bg-white flex items-center justify-center overflow-hidden p-1">
                {ptMember.member_signature && ptMember.member_signature !== 'BYPASSED' ? (
                  <img 
                    src={ptMember.member_signature} 
                    alt="Client Signature" 
                    className="max-h-full max-w-full object-contain"
                  />
                ) : ptMember.member_signature === 'BYPASSED' ? (
                  <span className="text-[8.5px] font-black text-amber-600 uppercase tracking-widest">
                    Verified In Person (Staff Bypassed)
                  </span>
                ) : (
                  <span className="text-[8.5px] font-bold text-slate-400 italic">Signature Recorded on File</span>
                )}
              </div>
            </div>
          </div>

          {/* Trainer / Fitness Staff Authorization */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center border-b border-slate-200 pb-1 text-[9px]">
                <span className="font-black text-slate-600">Trainer: <span className="text-indigo-700 font-black">{trainer?.name || 'Authorized Fitness Professional'}</span></span>
                <span dir="rtl" className="font-arabic font-bold text-slate-700">المدرب المسؤول</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200 pb-1 text-[9px]">
                <span className="font-bold text-slate-600">Package: <span className="text-slate-900 font-bold">{ptMember.total_sessions} Sessions ({ptMember.start_date ? format(parseISO(ptMember.start_date), 'dd/MM/yy') : ''} - {ptMember.end_date ? format(parseISO(ptMember.end_date), 'dd/MM/yy') : ''})</span></span>
                <span dir="rtl" className="font-arabic font-bold text-slate-700">الباقة والصلاحية</span>
              </div>
            </div>

            <div className="pt-1">
              <div className="flex justify-between items-center text-[8.5px] font-black text-slate-500 mb-1">
                <span>Trainer / Staff Signature:</span>
                <span>Date: {format(new Date(), 'dd/MM/yyyy')}</span>
              </div>
              <div className="h-20 border border-dashed border-slate-300 rounded-lg bg-white flex flex-col items-center justify-center p-1 text-center">
                <UserCheck className="w-5 h-5 text-indigo-600 mb-0.5" />
                <span className="text-[9px] font-black text-slate-900 uppercase">
                  {trainer?.name || 'Fitness Department'}
                </span>
                <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider">
                  Health & Fitness Authorization
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Notice */}
        <div className="mt-5 pt-3 border-t border-slate-200 flex justify-between items-center text-[7.5px] text-slate-400">
          <span>In accordance with Qatar Law No. 13 of 2016 on Personal Data Protection.</span>
          <span>{clubDisplayName} • Personal Training Health Declaration</span>
        </div>
      </div>
    </div>,
    document.body
  );
};
