import React from 'react';
import { createPortal } from 'react-dom';
import { PTMember, Property, CompanySettings, Outlet, Staff } from '../types';
import { format } from 'date-fns';
import { Printer, X, FileText, ShieldCheck, Dumbbell, UserCheck } from 'lucide-react';
import { Button } from './ui';

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

const PT_RULES = [
  { 
    en: "Personal training packages are non-refundable and non-transferable under any circumstances.", 
    ar: "باقات التدريب الشخصي غير قابلة للاسترداد أو التحويل تحت أي ظرف من الظروف." 
  },
  { 
    en: "Sessions must be completed within the validity period stated in this agreement.", 
    ar: "يجب إكمال جميع الحصص التدريبية خلال فترة الصلاحية المحددة في هذه الاتفاقية." 
  },
  { 
    en: "A minimum of 24 hours prior notice is required to cancel or reschedule a booked training session. Failure to provide 24 hours notice will result in the session being forfeited.", 
    ar: "يلزم تقديم إشعار مسبق قبل 24 ساعة على الأقل لإلغاء أو إعادة جدولة الحصة. عدم الإشعار خلال هذه المدة يؤدي لاحتساب الحصة كحصة ملغاة." 
  },
  { 
    en: "Clients must arrive on time for scheduled sessions. Late arrivals will receive training only for the remainder of the scheduled session time.", 
    ar: "يجب على المتدرب الحضور في الموعد المحدد. في حال التأخير، سيتم استكمال ما تبقى من وقت الحصة فقط دون تمديد." 
  },
  { 
    en: "Clients must disclose all relevant medical history, prior injuries, or medications to the trainer prior to commencing training.", 
    ar: "يجب على المتدرب الإفصاح عن أي تاريخ طبي أو إصابات سابقة أو أدوية للمدرب قبل بدء برنامج التدريب." 
  },
  { 
    en: "Clients participate in physical exercise at their own risk. The facility, management, and trainers shall not be held liable for any bodily injury, illness, or loss of personal property.", 
    ar: "يشارك المتدرب في التمارين الرياضية على مسؤوليته الشخصية، ولا يتحمل النادي أو الإدارة أو المدربون أي مسؤولية عن أي إصابة جسدية أو فقدان مقتنيات." 
  },
  { 
    en: "Appropriate athletic attire and non-marking training shoes are strictly mandatory at all times during sessions.", 
    ar: "الالتزام بالملابس الرياضية اللائقة وحذاء التمارين المناسب إلزامي في جميع الأوقات أثناء التدريب." 
  },
  { 
    en: "Facility management reserves the right to reassign trainers in the event of unforeseen staff scheduling or medical constraints.", 
    ar: "تحتفظ إدارة المرفق بالحق في إعادة تعيين المدرب في حال وجود ظروف طارئة أو تغييرات في جدول الموظفين." 
  }
];

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
    document.title = `PT_Agreement_${ptMember.guest_name.replace(/\s+/g, '_')}`;
    
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.title = originalTitle;
      }, 1000);
    }, 100);
  };

  const logoUrl = outlet?.logo_url || property?.logo_url || settings?.logo_url || '';
  const propertyName = (property?.name || 'PERFECTION HEALTH CLUB').toUpperCase();
  const outletName = (outlet?.name || 'FITNESS & PERSONAL TRAINING').toUpperCase();

  return createPortal(
    <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex flex-col justify-start items-center overflow-y-auto p-4 md:p-8 print:p-0 print:bg-white print:static print:h-auto print:overflow-visible">
      {/* Top Floating Actions (Hidden on Print) */}
      <div className="w-full max-w-[210mm] flex justify-between items-center mb-4 print:hidden sticky top-0 z-10 bg-slate-900/90 backdrop-blur border border-white/10 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Dumbbell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-white font-bold text-sm">PT Agreement & Liability Form</h2>
            <p className="text-slate-400 text-xs">{ptMember.guest_name} • {ptMember.total_sessions} Sessions</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            onClick={handlePrint}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 px-5 rounded-xl shadow-lg flex items-center gap-2"
          >
            <Printer className="w-4 h-4" /> Print Agreement
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
        id="pt-agreement-sheet" 
        className="w-full max-w-[210mm] bg-white text-slate-900 border border-slate-200 shadow-2xl p-8 md:p-12 mb-8 print:border-0 print:shadow-none print:m-0 print:p-8 print:w-full print:max-w-none text-[11px] leading-relaxed font-sans select-none print:select-text"
      >
        {/* Header Branding */}
        <div className="flex justify-between items-center pb-6 border-b-2 border-slate-900 mb-6">
          <div className="flex flex-col">
            <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">{propertyName}</h1>
            <p className="text-xs font-bold text-slate-600 tracking-wider uppercase mt-0.5">{outletName}</p>
            <span className="inline-block mt-2 px-2.5 py-0.5 bg-slate-900 text-white font-black text-[9px] uppercase tracking-widest rounded">
              Official PT Agreement
            </span>
          </div>
          {logoUrl && (
            <div className="h-16 flex items-center justify-end">
              <img src={logoUrl} alt="Logo" className="max-h-14 max-w-[160px] object-contain" crossOrigin="anonymous" />
            </div>
          )}
        </div>

        {/* Title */}
        <div className="text-center py-3 bg-slate-50 border border-slate-200 rounded-xl mb-6">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
            Personal Training Service Agreement & Liability Waiver
          </h2>
          <p dir="rtl" className="text-xs font-bold text-slate-700 font-arabic mt-0.5">
            اتفاقية التدريب الشخصي وإقرار إخلاء المسؤولية
          </p>
        </div>

        {/* Client & Package Information Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-50/50 p-4 border border-slate-200 rounded-xl">
          <div className="space-y-2">
            <div>
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">Client Name / اسم المتدرب</span>
              <span className="text-xs font-black text-slate-900">{ptMember.guest_name}</span>
            </div>
            <div>
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">Phone Number / رقم الهاتف</span>
              <span className="text-xs font-bold text-slate-800">{ptMember.phone || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">Email Address / البريد الإلكتروني</span>
              <span className="text-xs font-bold text-slate-800">{ptMember.email || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">Assigned Trainer / المدرب المسؤول</span>
              <span className="text-xs font-black text-indigo-700">{trainer?.name || 'Personal Training Team'}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center border-b border-slate-200 pb-1">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Total Sessions / إجمالي الحصص</span>
              <span className="text-xs font-black text-slate-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{ptMember.total_sessions} Sessions</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200 pb-1">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Completed Sessions / الحصص المنجزة</span>
              <span className="text-xs font-bold text-slate-700">{ptMember.used_sessions || 0} Sessions</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200 pb-1">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Remaining / المتبقي</span>
              <span className="text-xs font-black text-emerald-600">{Math.max(0, ptMember.total_sessions - (ptMember.used_sessions || 0))} Sessions</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200 pb-1">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Start Date / تاريخ البدء</span>
              <span className="text-xs font-bold text-slate-800">{ptMember.start_date ? format(parseISO(ptMember.start_date), 'dd MMM yyyy') : 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Valid Until / صالح حتى</span>
              <span className="text-xs font-black text-rose-600">{ptMember.end_date ? format(parseISO(ptMember.end_date), 'dd MMM yyyy') : 'N/A'}</span>
            </div>
          </div>
        </div>

        {ptMember.notes && (
          <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
            <span className="text-[9px] font-black uppercase tracking-widest block text-amber-700 mb-1">Notes / ملاحظات</span>
            <p className="text-xs">{ptMember.notes}</p>
          </div>
        )}

        {/* Terms and Conditions (Bilingual) */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 pb-1 border-b border-slate-200">
            <ShieldCheck className="w-4 h-4 text-slate-700" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900">
              Terms of Agreement & Liability Release / شروط الاتفاقية وإخلاء المسؤولية
            </h3>
          </div>
          <div className="space-y-2.5">
            {PT_RULES.map((rule, idx) => (
              <div key={idx} className="flex gap-3 text-[9.5px] leading-relaxed border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-400 shrink-0">{idx + 1}.</span>
                <div className="flex-1 space-y-0.5">
                  <p className="text-slate-800 font-medium">{rule.en}</p>
                  <p dir="rtl" className="text-slate-600 font-arabic text-[9px]">{rule.ar}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Signatures Section */}
        <div className="mt-8 pt-6 border-t-2 border-slate-900 grid grid-cols-2 gap-8">
          {/* Client Signature */}
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Client Digital Signature / توقيع المتدرب
            </span>
            <div className="w-full h-24 border border-dashed border-slate-300 rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden p-2">
              {ptMember.member_signature && ptMember.member_signature !== 'BYPASSED' ? (
                <img 
                  src={ptMember.member_signature} 
                  alt="Client Signature" 
                  className="max-h-full max-w-full object-contain"
                />
              ) : ptMember.member_signature === 'BYPASSED' ? (
                <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">
                  Verified In Person (Staff Bypassed)
                </span>
              ) : (
                <span className="text-[9px] font-bold text-slate-400 italic">Signature Not Recorded</span>
              )}
            </div>
            <div className="w-full flex justify-between text-[8px] font-bold text-slate-500 mt-2 px-1">
              <span>{ptMember.guest_name}</span>
              <span>{ptMember.created_at ? format(parseISO(ptMember.created_at), 'dd/MM/yyyy') : format(new Date(), 'dd/MM/yyyy')}</span>
            </div>
          </div>

          {/* Trainer / Staff Signature */}
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Authorized Trainer / المدرب أو المسؤول
            </span>
            <div className="w-full h-24 border border-dashed border-slate-300 rounded-xl bg-slate-50 flex flex-col items-center justify-center p-2 text-center">
              <UserCheck className="w-6 h-6 text-indigo-600 mb-1" />
              <span className="text-[10px] font-black text-slate-900 uppercase">
                {trainer?.name || 'Fitness Department'}
              </span>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                Authorized Fitness Professional
              </span>
            </div>
            <div className="w-full flex justify-between text-[8px] font-bold text-slate-500 mt-2 px-1">
              <span>Authorized Signature</span>
              <span>Date: {format(new Date(), 'dd/MM/yyyy')}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-slate-200 text-center text-[8px] text-slate-400">
          This document represents a legally binding Personal Training Service & Liability Agreement under facility operational rules.
        </div>
      </div>
    </div>,
    document.body
  );
};
