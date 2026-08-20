import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { PTMember, Property, CompanySettings, Outlet, Staff } from '../types';
import { format } from 'date-fns';
import { Printer, X, Dumbbell, ShieldCheck, UserCheck, CheckSquare, Square, PenTool, Save, CheckCircle2, QrCode } from 'lucide-react';
import { Button, Input } from './ui';
import { getBilingualPTConsentText } from '../lib/waiverHelper';
import { db } from '../services/mockSupabase';
import toast from 'react-hot-toast';
import { SignatureModal } from './SignatureModal';

interface PTAgreementModalProps {
  ptMember: PTMember;
  trainer?: Staff | null;
  outlet?: Outlet | null;
  property?: Property | null;
  settings?: CompanySettings | null;
  onClose: () => void;
  onUpdate?: (updatedMember: PTMember) => void;
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

const getDisplayMembership = (member: PTMember) => {
  if (member.membership_number && !/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(member.membership_number)) {
    return member.membership_number;
  }
  if (member.guest_name?.toLowerCase().includes('walk-in') || !member.membership_number) {
    return 'Non-Member (Walk-in Guest)';
  }
  return `PT-${(member.id || '').slice(0, 8).toUpperCase()}`;
};

export const PTAgreementModal: React.FC<PTAgreementModalProps> = ({
  ptMember,
  trainer,
  outlet,
  property,
  settings,
  onClose,
  onUpdate,
}) => {
  // State for interactive modifications & saving
  const [parqAnswers, setParqAnswers] = useState<{ [key: number]: boolean }>(() => {
    if (ptMember.parq_answers && Object.keys(ptMember.parq_answers).length > 0) {
      return ptMember.parq_answers;
    }
    return { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };
  });

  const [parqDetails, setParqDetails] = useState(ptMember.parq_details || '');
  const [isUnder18, setIsUnder18] = useState(ptMember.is_under_18 || false);
  const [guardianName, setGuardianName] = useState(ptMember.guardian_name || '');
  const [guardianRelationship, setGuardianRelationship] = useState(ptMember.guardian_relationship || '');
  const [guardianContact, setGuardianContact] = useState(ptMember.guardian_contact || '');
  const [guardianSignature, setGuardianSignature] = useState(ptMember.guardian_signature || '');
  const [dob, setDob] = useState(ptMember.dob || '');
  const [memberSignature, setMemberSignature] = useState(ptMember.member_signature || '');
  
  const [isSaving, setIsSaving] = useState(false);
  const [showSigModal, setShowSigModal] = useState(false);
  const [signingTarget, setSigningTarget] = useState<'member' | 'guardian'>('member');

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

  const handleToggleParq = (qId: number, value: boolean) => {
    setParqAnswers(prev => ({
      ...prev,
      [qId]: value
    }));
  };

  const handleSaveUpdates = async () => {
    setIsSaving(true);
    try {
      const updates: Partial<PTMember> = {
        parq_answers: parqAnswers,
        parq_details: parqDetails,
        is_under_18: isUnder18,
        guardian_name: isUnder18 ? guardianName : undefined,
        guardian_relationship: isUnder18 ? guardianRelationship : undefined,
        guardian_contact: isUnder18 ? guardianContact : undefined,
        guardian_signature: isUnder18 ? guardianSignature : undefined,
        dob: dob || undefined,
        member_signature: memberSignature || undefined
      };

      await db.updatePTMember(ptMember.id, updates);
      toast.success('Health Declaration & Consent details updated!');
      
      const updatedMember = { ...ptMember, ...updates };
      if (onUpdate) onUpdate(updatedMember);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('booking_updated'));
      }
    } catch (err: any) {
      toast.error('Failed to save updates');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignatureCaptured = async (dataUrl: string) => {
    setShowSigModal(false);
    const isMember = signingTarget === 'member';
    if (isMember) {
      setMemberSignature(dataUrl);
    } else {
      setGuardianSignature(dataUrl);
    }

    // Immediately auto-save and persist to database
    try {
      const updates: Partial<PTMember> = {
        parq_answers: parqAnswers,
        parq_details: parqDetails,
        is_under_18: isUnder18,
        guardian_name: isUnder18 ? guardianName : undefined,
        guardian_relationship: isUnder18 ? guardianRelationship : undefined,
        guardian_contact: isUnder18 ? guardianContact : undefined,
        guardian_signature: !isMember ? dataUrl : (isUnder18 ? guardianSignature : undefined),
        dob: dob || undefined,
        member_signature: isMember ? dataUrl : memberSignature
      };

      await db.updatePTMember(ptMember.id, updates);
      toast.success('Signature recorded and agreement saved successfully!');
      
      const updatedMember = { ...ptMember, ...updates };
      if (onUpdate) onUpdate(updatedMember);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('booking_updated'));
      }
    } catch (err) {
      console.warn("Auto-save signature warning:", err);
      toast.success('Signature recorded! Remember to click Save Updates.');
    }
  };

  const logoUrl = outlet?.logo_url || property?.logo_url || settings?.logo_url || '';
  const propertyName = property?.name || settings?.name || 'The Torch Club';
  const outletName = outlet?.name || propertyName;
  const clubDisplayName = outlet?.name || property?.name || 'The Torch Club';

  const consent = getBilingualPTConsentText(clubDisplayName);

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
            onClick={handleSaveUpdates}
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-4 rounded-xl shadow-lg flex items-center gap-2 text-xs uppercase tracking-wider"
          >
            <Save className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save Updates'}
          </Button>

          <Button 
            onClick={handlePrint}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 px-4 rounded-xl shadow-lg flex items-center gap-2 text-xs uppercase tracking-wider"
          >
            <Printer className="w-4 h-4" /> Print Form
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
        className="w-full max-w-[210mm] bg-white text-slate-900 border border-slate-200 shadow-2xl p-6 sm:p-8 mb-8 print:border-0 print:shadow-none print:m-0 print:p-0 print:w-full print:max-w-none text-[9.5px] leading-relaxed font-sans"
      >
        <style>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 8mm 10mm 8mm 10mm;
            }
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .print-avoid-break {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
          }
        `}</style>

        {/* Header Branding */}
        <div className="flex justify-between items-center pb-3 border-b-2 border-slate-900 mb-3.5 print-avoid-break">
          <div className="flex flex-col">
            <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 uppercase">{propertyName}</h1>
            <p className="text-[10px] font-bold text-slate-600 tracking-wider uppercase">{outletName}</p>
            <span className="inline-block mt-0.5 px-2 py-0.5 bg-slate-900 text-white font-black text-[7.5px] uppercase tracking-widest rounded self-start">
              Official Personal Training Consent & Health Declaration
            </span>
          </div>
          {logoUrl && (
            <div className="h-10 flex items-center justify-end">
              <img src={logoUrl} alt="Logo" className="max-h-10 max-w-[130px] object-contain" crossOrigin="anonymous" />
            </div>
          )}
        </div>

        {/* Document Title (Bilingual) */}
        <div className="text-center py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg mb-3.5 print-avoid-break">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
            {consent.titleEn}
          </h2>
          <p dir="rtl" className="text-xs font-black text-slate-800 font-arabic mt-0.5">
            {consent.titleAr}
          </p>
        </div>

        {/* Member & Training Package Summary Bar */}
        <div className="grid grid-cols-4 gap-2 mb-3.5 bg-indigo-50/40 p-2.5 rounded-lg border border-indigo-100 text-[9px] print-avoid-break">
          <div>
            <span className="text-[7.5px] font-black uppercase text-indigo-500 tracking-widest block">Full Name / الاسم</span>
            <span className="font-black text-slate-900 truncate block">{ptMember.guest_name}</span>
          </div>
          <div>
            <span className="text-[7.5px] font-black uppercase text-indigo-500 tracking-widest block">Membership / العضوية</span>
            <span className="font-bold text-slate-800 truncate block">{getDisplayMembership(ptMember)}</span>
          </div>
          <div>
            <span className="text-[7.5px] font-black uppercase text-indigo-500 tracking-widest block">Contact / الهاتف</span>
            <span className="font-bold text-slate-800 truncate block">{ptMember.phone || 'N/A'}</span>
          </div>
          <div>
            <span className="text-[7.5px] font-black uppercase text-indigo-500 tracking-widest block">Trainer / المدرب</span>
            <span className="font-bold text-indigo-700 truncate block">{trainer?.name || 'Personal Training Team'}</span>
          </div>
        </div>

        {/* Section 1: Introduction Paragraphs (Bilingual Side-by-Side) */}
        <div className="space-y-2 mb-3.5 bg-slate-50/50 p-3 rounded-lg border border-slate-200/80 print-avoid-break">
          {consent.introParagraphs.map((para, idx) => (
            <div key={idx} className="grid grid-cols-2 gap-3 text-[8.5px] leading-snug border-b border-slate-200/50 pb-1.5 last:border-0 last:pb-0">
              <p className="text-slate-800 text-justify">{para.en}</p>
              <p dir="rtl" className="text-slate-700 font-arabic text-justify">{para.ar}</p>
            </div>
          ))}
        </div>

        {/* Section 2: PAR-Q (Physical Activity Readiness Questionnaire) */}
        <div className="mb-3.5 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs print-avoid-break">
          <div className="bg-slate-900 text-white px-3 py-1.5 flex justify-between items-center">
            <span className="font-black text-[9px] tracking-wide uppercase">{consent.parqTitleEn}</span>
            <span dir="rtl" className="font-arabic font-bold text-[9px]">{consent.parqTitleAr}</span>
          </div>

          <div className="px-3 py-1.5 bg-slate-50/60 border-b border-slate-200 flex justify-between text-[8px] font-black text-slate-600">
            <span>{consent.parqInstructionEn}</span>
            <span dir="rtl" className="font-arabic">{consent.parqInstructionAr}</span>
          </div>

          <div className="divide-y divide-slate-100">
            {consent.parqQuestions.map((q) => {
              const isYes = parqAnswers[q.id] === true;
              const isNo = parqAnswers[q.id] === false;

              return (
                <div key={q.id} className="p-2 sm:p-2.5 flex items-center gap-2.5 hover:bg-slate-50/50 transition-colors">
                  <div className="w-5 shrink-0 text-center font-black text-indigo-700 text-[10px]">
                    #{q.id}
                  </div>
                  <div className="flex-1 min-w-0 grid grid-cols-2 gap-2">
                    <p className="text-[8.5px] text-slate-900 font-medium leading-tight">{q.en}</p>
                    <p dir="rtl" className="text-[8.5px] text-slate-600 font-arabic leading-tight">{q.ar}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5 text-[8.5px] font-black">
                    {/* Interactive on-screen buttons / Clean printable checks */}
                    <button
                      type="button"
                      onClick={() => handleToggleParq(q.id, true)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded border transition-all cursor-pointer ${
                        isYes 
                        ? 'bg-rose-50 border-rose-500 text-rose-700 font-black shadow-xs' 
                        : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {isYes ? <CheckSquare className="w-3.5 h-3.5 text-rose-600 shrink-0" /> : <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      <span>Yes / نعم</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleParq(q.id, false)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded border transition-all cursor-pointer ${
                        isNo 
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-black shadow-xs' 
                        : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {isNo ? <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      <span>No / لا</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* If Yes, Details */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200">
            <div className="flex justify-between items-center text-[8px] font-bold text-slate-700 mb-1">
              <span>{consent.parqDetailsPromptEn}</span>
              <span dir="rtl" className="font-arabic">{consent.parqDetailsPromptAr}</span>
            </div>
            <div className="print:hidden">
              <textarea
                rows={2}
                value={parqDetails}
                onChange={e => setParqDetails(e.target.value)}
                placeholder="Enter details if any condition was marked Yes (e.g. physician clearance, allergies, joint pain)..."
                className="w-full p-2 bg-white rounded-lg border border-slate-300 text-[9px] text-slate-900 focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>
            <div className="hidden print:block min-h-[26px] p-1.5 bg-white rounded border border-slate-300 text-[8.5px] text-slate-800">
              {parqDetails || (
                <span className="text-slate-400 italic">None reported / لا توجد تفاصيل إضافية</span>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Declaration */}
        <div className="mb-3.5 bg-white border border-slate-200 rounded-lg overflow-hidden print-avoid-break">
          <div className="bg-slate-800 text-white px-3 py-1 flex justify-between items-center">
            <span className="font-black text-[9px] tracking-wide uppercase">{consent.declarationTitleEn}</span>
            <span dir="rtl" className="font-arabic font-bold text-[9px]">{consent.declarationTitleAr}</span>
          </div>

          <div className="p-2.5 space-y-1.5 bg-slate-50/40">
            {consent.declarationParagraphs.map((para, idx) => (
              <div key={idx} className="grid grid-cols-2 gap-3 text-[8px] leading-tight border-b border-slate-100 pb-1 last:border-0 last:pb-0">
                <p className="text-slate-800 text-justify flex gap-1">
                  <span className="text-slate-400 font-bold shrink-0">•</span>
                  <span>{para.en}</span>
                </p>
                <p dir="rtl" className="text-slate-700 font-arabic text-justify flex gap-1">
                  <span className="text-slate-400 font-bold shrink-0">•</span>
                  <span>{para.ar}</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: For Participants Under 18 */}
        <div className={`mb-3.5 p-3 rounded-lg text-[8.5px] transition-all border print-avoid-break ${isUnder18 ? 'bg-amber-50/60 border-amber-300 shadow-xs' : 'bg-slate-50/60 border-slate-200'}`}>
          <div className="flex justify-between items-center font-black text-slate-900 border-b border-slate-200 pb-1 mb-2">
            <div className="flex items-center gap-3">
              <span className={`uppercase tracking-wide ${isUnder18 ? 'text-amber-900 font-black' : 'text-slate-700'}`}>{consent.under18TitleEn}</span>
              <label className="flex items-center gap-1.5 px-2 py-0.5 bg-white rounded border border-amber-300 shadow-xs text-[8.5px] text-amber-900 font-black cursor-pointer hover:bg-amber-50/80 transition-colors print:hidden">
                <input
                  type="checkbox"
                  checked={isUnder18}
                  onChange={e => setIsUnder18(e.target.checked)}
                  className="w-3 h-3 rounded border-amber-400 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Enable Minor Guardian Form</span>
              </label>
            </div>
            <span dir="rtl" className="font-arabic font-bold text-slate-700">{consent.under18TitleAr}</span>
          </div>

          {/* If NOT under 18 (Unchecked) - Show note on screen, standard lines on print */}
          {!isUnder18 ? (
            <div className="py-1">
              <p className="text-[8.5px] text-slate-500 italic print:hidden">
                Participant is an adult (18+). If registering on behalf of a minor under 18, check <strong className="text-amber-800 font-bold">"Enable Minor Guardian Form"</strong> above.
              </p>
              <div className="hidden print:block text-[8px] text-slate-500 pt-0.5">
                <div className="grid grid-cols-4 gap-2 pt-0.5">
                  <div><span className="block font-bold text-slate-400">Participant's DOB / الميلاد:</span> ___________________</div>
                  <div><span className="block font-bold text-slate-400">Relationship / القرابة:</span> ___________________</div>
                  <div><span className="block font-bold text-slate-400">Contact Number / الهاتف:</span> ___________________</div>
                  <div><span className="block font-bold text-slate-400">Parent Signature / التوقيع:</span> ___________________</div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Bilingual Guardian Declaration Text */}
              <div className="grid grid-cols-2 gap-3 mb-2 text-[8px] leading-snug">
                <p className="text-slate-800 text-justify">
                  {consent.under18TextEn(guardianName || '________________', ptMember.guest_name || '')}
                </p>
                <p dir="rtl" className="text-slate-700 font-arabic text-justify">
                  {consent.under18TextAr(guardianName || '________________', ptMember.guest_name || '')}
                </p>
              </div>

              {/* Interactive Screen Inputs (Only rendered when isUnder18 is true) */}
              <div className="print:hidden grid grid-cols-4 gap-2 p-2.5 bg-white rounded-lg border border-amber-300 shadow-xs mb-2">
                <div>
                  <label className="text-[7.5px] font-black text-amber-900 uppercase tracking-widest block mb-0.5">Parent / Guardian Name *</label>
                  <input
                    type="text"
                    value={guardianName}
                    onChange={e => setGuardianName(e.target.value)}
                    placeholder="Full Name of Guardian"
                    className="w-full h-7 px-2 rounded border border-slate-300 text-[10px] font-bold focus:ring-1 focus:ring-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[7.5px] font-black text-amber-900 uppercase tracking-widest block mb-0.5">Participant DOB *</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={e => setDob(e.target.value)}
                    className="w-full h-7 px-2 rounded border border-slate-300 text-[10px] font-bold focus:ring-1 focus:ring-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[7.5px] font-black text-amber-900 uppercase tracking-widest block mb-0.5">Relationship *</label>
                  <input
                    type="text"
                    value={guardianRelationship}
                    onChange={e => setGuardianRelationship(e.target.value)}
                    placeholder="Father, Mother..."
                    className="w-full h-7 px-2 rounded border border-slate-300 text-[10px] font-bold focus:ring-1 focus:ring-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[7.5px] font-black text-amber-900 uppercase tracking-widest block mb-0.5">Guardian Contact # *</label>
                  <input
                    type="text"
                    value={guardianContact}
                    onChange={e => setGuardianContact(e.target.value)}
                    placeholder="+974 / Phone #"
                    className="w-full h-7 px-2 rounded border border-slate-300 text-[10px] font-bold focus:ring-1 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* Formatted Fields for Printing & Preview Display */}
              <div className="grid grid-cols-4 gap-2 pt-1.5 border-t border-amber-200 text-[8px]">
                <div>
                  <span className="font-bold text-slate-500 block">Participant's DOB / تاريخ الميلاد:</span>
                  <span className="font-black text-slate-900 truncate block">{dob || '___________________'}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block">Relationship / صلة القرابة:</span>
                  <span className="font-black text-slate-900 truncate block">{guardianRelationship || '___________________'}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block">Contact Number / رقم الهاتف:</span>
                  <span className="font-black text-slate-900 truncate block">{guardianContact || ptMember.phone || '___________________'}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block">Parent Signature / توقيع ولي الأمر:</span>
                  {guardianSignature ? (
                    <div className="h-5 flex items-center">
                      <img src={guardianSignature} alt="Parent Signature" className="max-h-5 object-contain" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-slate-900 truncate block">
                        {guardianName ? `${guardianName} (Confirmed)` : '___________________'}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setSigningTarget('guardian'); setShowSigModal(true); }}
                        className="print:hidden text-[7px] font-black text-amber-800 bg-amber-100 hover:bg-amber-200 px-1 py-0.5 rounded uppercase tracking-wider"
                      >
                        Sign
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Section 5: Member & Staff Signatures (Exact Match to Specification) */}
        <div className="pt-3 border-t-2 border-slate-900 grid grid-cols-2 gap-4 print-avoid-break">
          {/* Member Details & Digital Signature */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
            <div className="flex justify-between items-center border-b border-slate-200 pb-0.5 text-[8.5px]">
              <span className="font-black text-slate-600">Full Name : <span className="text-slate-900 font-black">{ptMember.guest_name}</span></span>
              <span dir="rtl" className="font-arabic font-bold text-slate-700">الاسم الكامل</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200 pb-0.5 text-[8.5px]">
              <span className="font-bold text-slate-600">Membership: <span className="text-slate-900 font-bold">{getDisplayMembership(ptMember)}</span></span>
              <span dir="rtl" className="font-arabic font-bold text-slate-700">العضوية</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200 pb-0.5 text-[8.5px]">
              <span className="font-bold text-slate-600">Contact Number: <span className="text-slate-900 font-bold">{ptMember.phone || 'N/A'}</span></span>
              <span dir="rtl" className="font-arabic font-bold text-slate-700">رقم الهاتف</span>
            </div>
            
            <div className="pt-1">
              <div className="flex justify-between items-center text-[7.5px] font-black text-slate-500 mb-0.5">
                <span>Signature / التوقيع:</span>
                <span>Date / التاريخ: {ptMember.created_at ? format(parseISO(ptMember.created_at), 'dd/MM/yyyy') : format(new Date(), 'dd/MM/yyyy')}</span>
              </div>
              <div className="h-16 border border-dashed border-slate-300 rounded-lg bg-white flex flex-col items-center justify-center overflow-hidden p-1 relative group">
                {memberSignature && memberSignature !== 'BYPASSED' ? (
                  <>
                    <img 
                      src={memberSignature} 
                      alt="Client Signature" 
                      className="max-h-full max-w-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => { setSigningTarget('member'); setShowSigModal(true); }}
                      className="print:hidden absolute inset-0 bg-slate-900/60 text-white flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity font-bold text-[8px] uppercase tracking-wider rounded-lg backdrop-blur-xs"
                    >
                      <PenTool className="w-3 h-3" /> Re-sign
                    </button>
                  </>
                ) : memberSignature === 'BYPASSED' ? (
                  <div className="flex flex-col items-center justify-center text-center p-0.5">
                    <CheckCircle2 className="w-4 h-4 text-amber-500 mb-0.5" />
                    <span className="text-[7.5px] font-black text-amber-700 uppercase tracking-widest">
                      Verified In Person (Staff Bypassed)
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-0.5 text-center">
                    <span className="text-[7.5px] font-bold text-slate-400 italic">No signature recorded yet</span>
                    <button
                      type="button"
                      onClick={() => { setSigningTarget('member'); setShowSigModal(true); }}
                      className="print:hidden flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[7.5px] font-black uppercase tracking-wider transition-colors shadow-xs"
                    >
                      <PenTool className="w-2.5 h-2.5" /> Sign on Pad / Tablet (QR)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Trainer / Fitness Staff Authorization */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center border-b border-slate-200 pb-0.5 text-[8.5px]">
                <span className="font-black text-slate-600">Trainer: <span className="text-indigo-700 font-black">{trainer?.name || 'Authorized Fitness Professional'}</span></span>
                <span dir="rtl" className="font-arabic font-bold text-slate-700">المدرب المسؤول</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200 pb-0.5 text-[8.5px]">
                <span className="font-bold text-slate-600">Package: <span className="text-slate-900 font-bold">{ptMember.total_sessions} Sessions ({ptMember.start_date ? format(parseISO(ptMember.start_date), 'dd/MM/yy') : ''} - {ptMember.end_date ? format(parseISO(ptMember.end_date), 'dd/MM/yy') : ''})</span></span>
                <span dir="rtl" className="font-arabic font-bold text-slate-700">الباقة والصلاحية</span>
              </div>
            </div>

            <div className="pt-1">
              <div className="flex justify-between items-center text-[7.5px] font-black text-slate-500 mb-0.5">
                <span>Trainer / Staff Signature:</span>
                <span>Date: {format(new Date(), 'dd/MM/yyyy')}</span>
              </div>
              <div className="h-16 border border-dashed border-slate-300 rounded-lg bg-white flex flex-col items-center justify-center p-1 text-center">
                <UserCheck className="w-5 h-5 text-indigo-600 mb-0.5" />
                <span className="text-[8.5px] font-black text-slate-900 uppercase">
                  {trainer?.name || 'Fitness Department'}
                </span>
                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">
                  Health & Fitness Authorization
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Notice */}
        <div className="mt-3.5 pt-2 border-t border-slate-200 flex justify-between items-center text-[7px] text-slate-400 print-avoid-break">
          <span>In accordance with Qatar Law No. 13 of 2016 on Personal Data Protection.</span>
          <span>{clubDisplayName} • Personal Training Health Declaration</span>
        </div>
      </div>

      {/* Embedded Signature Modal for capturing member/guardian signature */}
      {showSigModal && (
        <SignatureModal
          isOpen={showSigModal}
          onClose={() => setShowSigModal(false)}
          onSave={handleSignatureCaptured}
          guestName={signingTarget === 'member' ? ptMember.guest_name : (guardianName || `${ptMember.guest_name}'s Guardian`)}
          propertyName={propertyName}
          outletName={outletName}
          outletId={outlet?.id || ''}
          tier={`${ptMember.total_sessions} PT Sessions (Consent Form)`}
          price="0"
          currency="QAR"
          logoUrl={logoUrl}
          agreementType="pt"
        />
      )}
    </div>,
    document.body
  );
};

