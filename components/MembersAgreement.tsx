
import React from 'react';
import { createPortal } from 'react-dom';
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

const GYM_RULES = [
  { en: "Only registered members and authorized visitors are allowed entry.", ar: "يسمح بالدخول فقط للأعضاء المسجلين والزوار المعتمدين." },
  { en: "No person below 18 years old is allowed to use the facility.", ar: "لا يسمح لأي شخص يقل عمره عن 18 عامًا باستخدام المرفق." },
  { en: "Members should consult a doctor before starting a new fitness routine.", ar: "يجب على الأعضاء استشارة الطبيب قبل البدء في روتين لياقة بدنية جديد." },
  { en: "If you suffer from medical conditions or are taking medications, please consult your doctor and inform the club staff before using the gym.", ar: "إذا كنت تعاني من حالات طبية أو تتناول أدوية، يرجى استشارة طبيبك وإبلاغ موظفي النادي قبل استخدام الصالة الرياضية." },
  { en: "Pregnant women must consult their healthcare provider before exercising; a liability waiver may be required.", ar: "يجب على النساء الحوامل استشارة مقدم الرعاية الصحية قبل ممارسة الرياضة؛ قد يُطلب التنازل عن المسؤولية." },
  { en: "Proper athletic attire and non-marking footwear are required at all times.", ar: "مطلوب ارتداء ملابس رياضية مناسبة وأحذية لا تترك أثرًا في جميع الأوقات." },
  { en: "Follow equipment instructions and report malfunctions.", ar: "اتبع تعليمات المعدات وأبلغ عن الأعطال." },
  { en: "Use the gym at your own risk and be responsible for your own safety.", ar: "استخدم الصالة الرياضية على مسؤوليتك الخاصة وكن مسؤولاً عن سلامتك." },
  { en: "Use lockers for personal items. The gym is not responsible for losses.", ar: "استخدم الخزائن للأغراض الشخصية. الصالة الرياضية ليست مسؤولة عن الخسائر." },
  { en: "Daily lockers must be emptied before closing.", ar: "يجب إفراغ الخزائن اليومية قبل الإغلاق." },
  { en: "Re-rack weights after use.", ar: "أعد الأوزان إلى مكانها بعد الاستخدام." },
  { en: "Do not drop dumbbells or barbells.", ar: "لا تسقط الدمبل أو الأثقال." },
  { en: "Chalk or talcum powder is strictly prohibited.", ar: "يمنع منعاً باتاً استخدام الطباشير أو بودرة التلك." },
  { en: "Ask staff or another member for assistance with heavy lifting.", ar: "اطلب المساعدة من الموظفين أو عضو آخر عند رفع الأثقال." },
  { en: "Only approved trainers may offer personal training.", ar: "يُسمح فقط للمدربين المعتمدين بتقديم التدريب الشخصي." },
  { en: "No loud music or phone calls in gym areas.", ar: "لا يسمح بالموسيقى الصاخبة أو المكالمات الهاتفية في مناطق الصالة الرياضية." },
  { en: "Photography and videography require prior approval.", ar: "التصوير الفوتوغرافي وتصوير الفيديو يتطلب موافقة مسبقة." },
  { en: "Harassment, intimidation, or inappropriate behavior is not tolerated.", ar: "لن يتم التسامح مع التحرش أو الترهيب أو السلوك غير اللائق." },
  { en: "Smoking and alcohol are strictly prohibited.", ar: "يمنع منعاً باتاً التدخين والكحول." },
  { en: "Do not exercise under the influence of alcohol.", ar: "لا تمارس الرياضة تحت تأثير الكحول." },
  { en: "No outside food or beverages allowed.", ar: "لا يسمح بإدخال الأطعمة أو المشروبات من الخارج." },
  { en: "No glass containers allowed.", ar: "لا يسمح بالأوعية الزجاجية." },
  { en: "Pets are not allowed in gym areas.", ar: "لا يسمح باصطحاب الحيوانات الأليفة في مناطق الصالة الرياضية." },
  { en: "Lost items will be held at reception for a limited time.", ar: "سيتم الاحتفاظ بالأشياء المفقودة في الاستقبال لفترة محدودة." },
  { en: "Report any injuries or health issues immediately.", ar: "أبلغ عن أي إصابات أو مشاكل صحية على الفور." },
  { en: "Staff are trained in first aid; AEDs are available.", ar: "الموظفون مدربون على الإسعافات الأولية؛ تتوفر أجهزة تنظيم ضربات القلب." },
  { en: "Memberships must be renewed on time; cancellation policies apply.", ar: "يجب تجديد العضويات في الوقت المحدد؛ تطبق سياسات الإلغاء." },
  { en: "Guests are allowed only with prior approval.", ar: "يسمح للضيوف فقط بموافقة مسبقة." },
  { en: "Violations may result in warning, suspension, or termination.", ar: "قد تؤدي الانتهاكات إلى التحذير أو التعليق أو الإنهاء." },
  { en: "The club is not liable for injury, death, or loss related to gym use.", ar: "النادي غير مسؤول عن الإصابة أو الوفاة أو الخسارة المتعلقة باستخدام الصالة الرياضية." },
  { en: "In case of emergency, contact club staff immediately.", ar: "في حالة الطوارئ، اتصل بموظفي النادي على الفور." }
];

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
    const originalTitle = document.title;
    document.title = `${member.guest_name.replace(/\s+/g, '_')}_${member.membership_number}`;
    
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.title = originalTitle;
      }, 1000);
    }, 100);
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

  return createPortal(
    <div className="fixed inset-0 z-[300] bg-slate-900/90 backdrop-blur-md flex items-start justify-center p-4 md:p-8 animate-in fade-in duration-300 overflow-y-auto print:relative print:block print:bg-white print:p-0 print:m-0 print:overflow-visible print:h-auto print-root">
      <div className="bg-white w-full max-w-[850px] rounded-2xl shadow-2xl flex flex-col border border-white/20 my-4 print:my-0 print:shadow-none print:border-none print:overflow-visible print:h-auto print:block print-container">
        
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

        <div className="p-12 md:p-20 bg-white print:p-0">
          <div className="max-w-[750px] mx-auto text-black font-sans leading-tight">
            {/* Header */}
            <div className="flex justify-between items-start mb-12 border-b-4 border-black pb-6">
              <div className="flex-1">
                <h1 className="text-3xl font-black tracking-tighter text-black uppercase mb-1">{propertyName}</h1>
                <h2 className="text-sm font-black text-slate-500 uppercase tracking-[0.3em]">{outletName}</h2>
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-black text-white rounded text-[9px] font-black uppercase tracking-widest">
                  <ShieldCheck className="w-3 h-3" /> 
                  <span>Certified Member Record</span>
                  <span className="font-arabic" dir="rtl">سجل عضو معتمد</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-4">
                {logoUrl && <img src={logoUrl} alt="Logo" className="h-20 w-auto object-contain" />}
                <div className="text-right">
                  <div className="flex justify-end items-center gap-2">
                    <p className="text-[10px] font-black uppercase tracking-widest">Serial No.</p>
                    <p className="text-[10px] font-black uppercase tracking-widest font-arabic" dir="rtl">الرقم التسلسلي</p>
                  </div>
                  <p className="text-xl font-black tracking-widest text-indigo-600">{member.membership_number}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12 mb-10">
              <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-black pb-1">
                  <h3 className="text-xs font-black uppercase">Member Identity</h3>
                  <h3 className="text-xs font-black uppercase font-arabic" dir="rtl">هوية العضو</h3>
                </div>
                <div className="space-y-1">
                   <div className="flex justify-between items-end">
                     <p className="text-[11px] font-bold text-slate-400 uppercase">Legal Name</p>
                     <p className="text-[11px] font-bold text-slate-400 uppercase font-arabic" dir="rtl">الاسم القانوني</p>
                   </div>
                   <p className="text-sm font-black uppercase">{member.guest_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between items-end">
                      <p className="text-[11px] font-bold text-slate-400 uppercase">Nationality</p>
                      <p className="text-[11px] font-bold text-slate-400 uppercase font-arabic" dir="rtl">الجنسية</p>
                    </div>
                    <p className="text-xs font-black uppercase">{member.nationality || '---'}</p>
                  </div>
                  <div>
                    <div className="flex justify-between items-end">
                      <p className="text-[11px] font-bold text-slate-400 uppercase">Date of Birth</p>
                      <p className="text-[11px] font-bold text-slate-400 uppercase font-arabic" dir="rtl">تاريخ الميلاد</p>
                    </div>
                    <p className="text-xs font-black uppercase">{member.dob ? format(parseISO(member.dob), 'dd MMM yyyy') : '---'}</p>
                  </div>
                </div>
                <div className="space-y-1">
                   <div className="flex justify-between items-end">
                     <p className="text-[11px] font-bold text-slate-400 uppercase">Contact Information</p>
                     <p className="text-[11px] font-bold text-slate-400 uppercase font-arabic" dir="rtl">معلومات الاتصال</p>
                   </div>
                   <p className="text-xs font-black">{member.email}</p>
                   <p className="text-xs font-black">{member.phone}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-black pb-1">
                  <h3 className="text-xs font-black uppercase">Enrollment Logic</h3>
                  <h3 className="text-xs font-black uppercase font-arabic" dir="rtl">تفاصيل التسجيل</h3>
                </div>
                <div className="space-y-1">
                   <div className="flex justify-between items-end">
                     <p className="text-[11px] font-bold text-slate-400 uppercase">Tier Designation</p>
                     <p className="text-[11px] font-bold text-slate-400 uppercase font-arabic" dir="rtl">نوع العضوية</p>
                   </div>
                   <p className="text-sm font-black uppercase text-indigo-600">{category?.name || 'Custom Membership'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between items-end">
                      <p className="text-[11px] font-bold text-slate-400 uppercase">Commencement</p>
                      <p className="text-[11px] font-bold text-slate-400 uppercase font-arabic" dir="rtl">تاريخ البدء</p>
                    </div>
                    <p className="text-xs font-black uppercase">{format(parseISO(member.start_date), 'dd MMM yyyy')}</p>
                  </div>
                  <div>
                    <div className="flex justify-between items-end">
                      <p className="text-[11px] font-bold text-slate-400 uppercase">Expiry Date</p>
                      <p className="text-[11px] font-bold text-slate-400 uppercase font-arabic" dir="rtl">تاريخ الانتهاء</p>
                    </div>
                    <p className="text-xs font-black uppercase">{format(parseISO(member.current_end_date), 'dd MMM yyyy')}</p>
                  </div>
                </div>
                <div className="pt-2 mt-2 border-t border-dashed border-slate-200">
                    <div className="flex justify-between items-end mb-1">
                      <p className="text-[11px] font-bold text-slate-400 uppercase">Total Contribution</p>
                      <p className="text-[11px] font-bold text-slate-400 uppercase font-arabic" dir="rtl">إجمالي المبلغ</p>
                    </div>
                    <p className="text-xl font-black">{formatMoney(member.net_amount)}</p>
                </div>
              </div>
            </div>

            {/* Checkbox Section */}
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 mb-10 grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <Checkbox checked={member.membership_type === 'New'} labelEn="New Enrollment" labelAr="طلب جديد" />
                  <Checkbox checked={member.membership_type === 'Renew'} labelEn="Renewal" labelAr="تجديد" />
                </div>
                <div className="space-y-4">
                  <Checkbox checked={member.access_type === 'Pool' || member.access_type === 'Both'} labelEn="Pool Access" labelAr="حمام السباحة" />
                  <Checkbox checked={member.access_type === 'Spa' || member.access_type === 'Both'} labelEn="Spa Facilities" labelAr="نادي السبا" />
                </div>
            </div>

            {/* Family Details if applicable */}
            {(member.package_type === 'Couple' || member.package_type === 'Family') && (
              <div className="mb-10 space-y-4">
                <div className="flex justify-between items-end border-b-2 border-black pb-1">
                  <h3 className="text-xs font-black uppercase">
                    {member.package_type === 'Couple' ? 'Couple Details' : 'Family Manifest'}
                  </h3>
                  <h3 className="text-xs font-black uppercase font-arabic" dir="rtl">
                    {member.package_type === 'Couple' ? 'بيانات الزوجين' : 'بيانات العائلة'}
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-6 p-4 border border-slate-100 rounded-xl">
                   <div>
                      <div className="flex justify-between items-end">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Spouse Name</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase font-arabic" dir="rtl">اسم الزوج/الزوجة</p>
                      </div>
                      <p className="text-xs font-black uppercase">{member.spouse_name || 'Not Declared'}</p>
                   </div>
                   <div>
                      <div className="flex justify-between items-end">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Date of Birth</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase font-arabic" dir="rtl">تاريخ الميلاد</p>
                      </div>
                      <p className="text-xs font-black">{member.spouse_dob ? format(parseISO(member.spouse_dob), 'dd MMM yyyy') : '---'}</p>
                   </div>
                </div>
                {member.kids && member.kids.length > 0 && (
                  <div className="grid grid-cols-1 gap-1">
                    {member.kids.map((kid, i) => (
                      <div key={i} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase tracking-tight">Dependent {i+1}: {kid.name}</span>
                          <span className="text-[10px] font-black uppercase tracking-tight font-arabic" dir="rtl">التابع {i+1}</span>
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">DOB: {format(parseISO(kid.dob), 'dd MMM yyyy')}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase font-arabic" dir="rtl">تاريخ الميلاد</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Terms & Conditions */}
            <div className="mt-10 pt-6 border-t-4 border-black">
               <div className="grid grid-cols-2 gap-12">
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-black uppercase underline">Conditions of Enrollment</h4>
                    <p className="text-[9px] leading-relaxed text-justify">
                      Membership is non-transferable and non-refundable. All facility rules must be strictly adhered to. The management reserves the right to suspend or terminate membership for breach of protocols. Members must present their ID upon entry.
                    </p>
                  </div>
                  <div className="space-y-3" dir="rtl">
                    <h4 className="text-[11px] font-black uppercase underline font-arabic">شروط العضوية</h4>
                    <p className="text-[9px] leading-relaxed text-justify font-arabic">
                      العضوية غير قابلة للتحويل وغير قابلة للاسترداد. يجب الالتزام الصارم بجميع قواعد المنشأة. تحتفظ الإدارة بالحق في تعليق أو إنهاء العضوية بسبب خرق البروتوكولات. يجب على الأعضاء تقديم هويتهم عند الدخول.
                    </p>
                  </div>
               </div>
            </div>

            {/* Signatures */}
            <div className="mt-20 grid grid-cols-2 gap-16">
               <div className="flex flex-col justify-end h-24">
                  {member.member_signature && (
                    <img src={member.member_signature} alt="Member Signature" className="h-16 object-contain mb-2 self-start" />
                  )}
                  <div className="border-t border-black pt-2 flex justify-between items-center w-full">
                    <span className="text-[11px] font-black uppercase">Member Signature</span>
                    <span className="text-[11px] font-black uppercase font-arabic">توقيع العضو</span>
                  </div>
               </div>
               <div className="flex flex-col justify-end h-24">
                  {member.staff_signature && (
                    <img src={member.staff_signature} alt="Staff Signature" className="h-16 object-contain mb-2 self-start" />
                  )}
                  <div className="border-t border-black pt-2 flex justify-between items-center w-full">
                    <span className="text-[11px] font-black uppercase">Authorized Officer</span>
                    <span className="text-[11px] font-black uppercase font-arabic">المسؤول المعتمد</span>
                  </div>
               </div>
            </div>

            <div className="mt-12 text-center">
              <p className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.5em]">This is a digitally generated legal instrument &bull; System ID: {member.id.substring(0,8)}</p>
            </div>
          </div>
        </div>

        {/* Page 2: Rules and Regulations */}
        <div className="p-12 md:p-20 bg-white relative mt-4 print:mt-0 border-t border-slate-200 print:border-none print-page-2 print:p-0">
          <div className="max-w-[750px] mx-auto text-black font-sans leading-tight">
            <div className="text-center mb-8">
              <h3 className="text-xl font-black uppercase tracking-widest border-b-2 border-black inline-block pb-2">Gymnasium Rules & Regulations</h3>
              <h3 className="text-lg font-bold mt-2 font-arabic" dir="rtl">القواعد و اللوائح الخاصة بصالة الألعاب الرياضية</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-y-2 text-[9px] font-medium leading-relaxed mb-8">
              {GYM_RULES.map((rule, idx) => (
                <div key={idx} className="flex gap-4 items-start border-b border-slate-200 pb-1.5 print-rule-item">
                  <span className="font-black w-6">{idx + 1}.</span>
                  <span className="flex-1">{rule.en}</span>
                  <span className="flex-1 text-right font-arabic" dir="rtl">{rule.ar}</span>
                </div>
              ))}
            </div>
            
            <div className="mt-auto pt-6 border-t-2 border-black">
              <div className="flex justify-between px-2">
                <div className="w-72 flex flex-col justify-end h-24">
                  {member.member_signature && (
                    <img src={member.member_signature} alt="Member Signature" className="h-16 object-contain mb-2 self-start" />
                  )}
                  <div className="border-t border-black pt-2 text-[11px] flex justify-between w-full"><span className="font-bold">Member Signature</span><span className="font-bold" dir="rtl">توقيع العضو :</span></div>
                </div>
                <div className="w-72 flex flex-col justify-end h-24">
                   <div className="border-t border-black pt-2 text-[11px] flex justify-between w-full"><span className="font-bold">Date</span><span className="font-bold" dir="rtl">التاريخ :</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body > #root {
            display: none !important;
          }
          body {
            background: white !important;
          }
          .print-root {
            position: relative !important;
            inset: auto !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            display: block !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            transform: none !important;
          }
          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            display: block !important;
            background: white !important;
          }
          .no-print, .no-print * {
            display: none !important;
          }
          .print-page-2 {
            break-before: page;
            display: block !important;
          }
          .print-rule-item {
            break-inside: avoid;
          }
          @page { size: A4; margin: 15mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        .font-arabic { font-family: 'Amiri', 'Traditional Arabic', serif; }
      `}</style>
    </div>,
    document.body
  );
};
