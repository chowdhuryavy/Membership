import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui';
import { X, ArrowRight, FileText } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import SignatureCanvas from 'react-signature-canvas';
export { default as SignaturePad } from 'react-signature-canvas';
import { supabase } from '../services/mockSupabase';
import { PERFECTION_QR_IMAGE_SETTINGS } from '../lib/perfectionLogo';
import { GYM_RULES } from '../services/memberAgreementPdfService';
import { getBilingualPTConsentText, getBilingualWaiverText } from '../lib/waiverHelper';
import toast from 'react-hot-toast';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (signatureDataUrl: string) => void;
  onSkip?: () => void;
  guestName?: string;
  propertyName?: string;
  outletName?: string;
  outletId?: string;
  tier?: string;
  price?: number | string;
  currency?: string;
  currencySymbol?: string;
  logoUrl?: string;
  agreementType?: 'pt' | 'general' | 'membership' | 'entrance' | 'waiver';
}

export const SignatureModal: React.FC<SignatureModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  onSkip,
  guestName = 'Guest',
  propertyName = '',
  outletName = '',
  outletId = '',
  tier = 'Standard',
  price = '0',
  currency = 'AED',
  currencySymbol = '',
  logoUrl = '',
  agreementType = 'pt'
}) => {
  const signatureRef = useRef<SignatureCanvas>(null);
  const [signatureMethod, setSignatureMethod] = useState<'pad' | 'qr' | null>(null);
  const [liveSignature, setLiveSignature] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState('');
  const signatureIdRef = useRef<string | null>(null);

  // Real-time synchronization & Polling for QR Signing
  useEffect(() => {
    if (!isOpen || signatureMethod !== 'qr' || !signatureIdRef.current) return;

    const currentSigId = signatureIdRef.current;

    // Use Real-time subscription for instant preview
    const channel = supabase
      .channel(`sig_sync:${currentSigId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `id=eq.${currentSigId}`
        },
        (payload: any) => {
          const record = payload.new || payload.old;
          if (!record?.message) return;
          try {
            const syncData = JSON.parse(record.message);
            if (syncData.signature) setLiveSignature(syncData.signature);
            if (syncData.confirmed) {
              setSignatureMethod(null);
              supabase.from('notifications').delete().eq('id', record.id);
              onSave(syncData.signature);
            }
          } catch (e) {
            console.error("Sync parse error:", e);
          }
        }
      )
      .subscribe();

    // Fallback polling for environments where real-time might be restricted
    const interval = setInterval(async () => {
      try {
        let { data } = await supabase
          .from('notifications')
          .select('message, id')
          .eq('id', currentSigId)
          .maybeSingle();

        if (!data) {
          const res = await supabase
            .from('notifications')
            .select('message, id')
            .eq('title', `SIG_SYNC:${currentSigId}`)
            .maybeSingle();
          data = res.data;
        }

        if ((data as any)?.message) {
          const syncData = JSON.parse((data as any).message);
          if (syncData.signature) setLiveSignature(syncData.signature);
          if (syncData.confirmed) {
            setSignatureMethod(null);
            clearInterval(interval);
            await supabase.from('notifications').delete().eq('id', (data as any).id);
            onSave(syncData.signature);
          }
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
    }, 1500);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [isOpen, signatureMethod, onSave]);

  const handleSignatureMethodSelect = (method: 'pad' | 'qr') => {
    setSignatureMethod(method);
    setLiveSignature(null);

    if (method === 'qr') {
      const id = crypto.randomUUID();
      signatureIdRef.current = id;

      const baseUrl = window.location.origin;
      const queryParams = new URLSearchParams({
        id: id,
        name: guestName,
        tier: tier,
        price: price.toString(),
        property: propertyName,
        outlet: outletName,
        outlet_id: outletId,
        currency: currency || 'AED',
        symbol: currencySymbol || '',
        logo: logoUrl || '',
        type: agreementType || 'pt'
      }).toString();

      // Use HashRouter format #/signature/...
      setQrUrl(`${baseUrl}/#/signature/${id}?${queryParams}`);

      // Create initial sync record in Supabase notifications
      supabase.from('notifications').insert({
        id: id,
        title: `SIG_SYNC:${id}`,
        message: JSON.stringify({ status: 'pending' }),
        type: 'info',
        outlet_id: outletId || null,
        user_id: '00000000-0000-0000-0000-000000000000'
      }).then(({ error }) => {
        if (error) console.error("Error creating sync record:", error);
      });
    }
  };

  const handleClose = async () => {
    if (signatureIdRef.current) {
      try {
        await supabase.from('notifications').update({
          message: JSON.stringify({ cancelled: true })
        }).eq('id', signatureIdRef.current);

        await new Promise(r => setTimeout(r, 400));
        await supabase.from('notifications').delete().eq('id', signatureIdRef.current);
      } catch (e) {
        console.error("Cancellation error:", e);
      }
    }
    setSignatureMethod(null);
    setLiveSignature(null);
    signatureIdRef.current = null;
    onClose();
  };

  const handlePadClear = () => {
    signatureRef.current?.clear();
  };

  const handleStaffConfirm = async () => {
    if (!liveSignature) return;

    if (signatureIdRef.current) {
      try {
        await supabase.from('notifications').update({
          message: JSON.stringify({ completed_by_staff: true })
        }).eq('id', signatureIdRef.current);

        await new Promise(r => setTimeout(r, 400));
        await supabase.from('notifications').delete().eq('id', signatureIdRef.current);
      } catch (e) {
        console.error("Staff confirm sync error:", e);
      }
    }
    setSignatureMethod(null);
    onSave(liveSignature);
  };

  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const isPTAgreement = agreementType === 'pt' || tier.toLowerCase().includes('pt') || tier.toLowerCase().includes('personal') || tier.toLowerCase().includes('training') || tier.toLowerCase().includes('consent');
  const isEntranceWaiver = agreementType === 'waiver' || agreementType === 'entrance' || tier.toLowerCase().includes('entrance') || tier.toLowerCase().includes('pass') || tier.toLowerCase().includes('waiver');
  const isMembershipAgreement = agreementType === 'membership' || (!isPTAgreement && !isEntranceWaiver);

  const waiverContent = useMemo(() => isEntranceWaiver ? getBilingualWaiverText(outletName, propertyName) : null, [isEntranceWaiver, outletName, propertyName]);
  const ptConsent = useMemo(() => isPTAgreement ? getBilingualPTConsentText(propertyName || outletName || 'The Torch Club') : null, [isPTAgreement, propertyName, outletName]);

  const handlePadSave = () => {
    if (!acceptedTerms) {
      toast.error('Please accept the Terms and Conditions.');
      return;
    }
    if (signatureRef.current && !signatureRef.current.isEmpty()) {
      const dataUrl = signatureRef.current.toDataURL();
      setSignatureMethod(null);
      onSave(dataUrl);
    } else {
      toast.error('Please sign before confirming.');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className={`bg-white rounded-[2rem] shadow-2xl w-full overflow-hidden p-6 sm:p-8 flex flex-col items-center transition-all my-auto ${signatureMethod === 'pad' ? 'max-w-xl' : 'max-w-md'}`}>
        {!signatureMethod ? (
          <>
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-3 font-black text-lg">
              ✍️
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-1 uppercase tracking-widest text-center">Select Method</h3>
            <p className="text-xs text-slate-500 font-medium mb-6 text-center">Choose how {guestName} will provide their signature</p>

            <div className="flex flex-col gap-3 w-full">
              <Button onClick={() => handleSignatureMethodSelect('pad')} className="h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-indigo-100">
                Signature Pad (On-Screen)
              </Button>
              <Button onClick={() => handleSignatureMethodSelect('qr')} className="h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-slate-200">
                QR Code (Scan to Sign on Phone/Tablet)
              </Button>
              <Button variant="outline" onClick={handleClose} className="h-12 rounded-2xl border-slate-200 text-slate-600 font-bold hover:bg-slate-50">
                Cancel
              </Button>
              
              {onSkip && (
                <button 
                  type="button"
                  onClick={onSkip} 
                  className="h-10 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 flex items-center justify-center gap-2 mt-1 transition-colors cursor-pointer"
                >
                  Skip Signature (Staff Bypass) <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </>
        ) : signatureMethod === 'pad' ? (
          <div className="w-full flex flex-col max-h-[82vh] overflow-y-auto pr-1">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4 sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                  {isPTAgreement ? 'Personal Training & Health Declaration' : isEntranceWaiver ? 'Facility Liability Waiver' : 'Membership Agreement & Consent'}
                </h3>
                <p className="text-[11px] text-indigo-600 font-bold">{guestName} • {tier}</p>
              </div>
              <button onClick={() => setSignatureMethod(null)} className="text-slate-400 hover:text-slate-600 text-xs font-black uppercase tracking-widest">
                Back
              </button>
            </div>

            {/* Terms and Conditions Section - Shown prominently BEFORE the signature pad */}
            <div className="bg-slate-50 rounded-2xl p-4 shadow-sm border border-slate-200/80 flex flex-col gap-3 mb-4">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    {isPTAgreement ? 'Health Declaration & PAR-Q' : isEntranceWaiver ? 'Liability Waiver' : 'Terms & Conditions'}
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-md">Bilingual / ثنائي اللغة</span>
              </div>

              {/* Prominent Bilingual Declaration Preview */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-[11px] leading-relaxed space-y-2 max-h-32 overflow-y-auto">
                <p className="text-slate-700 font-medium text-justify">
                  {isPTAgreement 
                    ? "I declare that I am in good physical health to participate in Personal Training. I confirm that all PAR-Q answers provided are true and accurate." 
                    : isEntranceWaiver
                    ? "I agree to abide by all club guidelines, facility safety rules, and operational regulations as outlined in the liability waiver."
                    : "I agree to abide by all gymnasium rules and regulations as outlined in the membership agreement."}
                </p>
                <p dir="rtl" className="text-slate-600 font-arabic text-justify">
                  {isPTAgreement 
                    ? "أقر بأنني بحالة صحية جيدة تؤهلني للمشاركة في التدريب الشخصي، وأؤكد أن جميع إجاباتي على استبيان الجاهزية البدنية صحيحة ودقيقة." 
                    : isEntranceWaiver
                    ? "أوافق على الالتزام بكافة لوائح وقوانين النادي وشروط السلامة المعتمدة كما هو موضح في نموذج إخلاء المسؤولية."
                    : "أوافق على الالتزام بكافة لوائح وقوانين النادي وشروط السلامة المعتمدة كما هو موضح في اتفاقية العضوية."}
                </p>
              </div>

              <div className="flex items-start gap-2.5 pt-1">
                <div className="relative flex items-center pt-0.5">
                  <input
                    id="modal-terms"
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="modal-terms" className="text-[11px] font-bold text-slate-800 cursor-pointer select-none">
                    I accept the Terms, Conditions & Waiver.
                  </label>
                  <p className="text-[9px] text-slate-400 font-medium uppercase tracking-tight">
                    أوافق على شروط وأحكام الإقرار الصحي
                  </p>
                </div>
              </div>

              <button 
                type="button"
                onClick={() => setShowTermsModal(true)}
                className="flex items-center justify-center gap-2 w-full py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-[10px] font-black text-indigo-600 uppercase tracking-widest transition-all cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                Read Full Policy & Questionnaire (EN/AR)
              </button>
            </div>

            {/* Signature Area */}
            <div className="space-y-1.5 mb-4">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sign in the box below:</label>
                <button 
                  type="button" 
                  onClick={handlePadClear}
                  className="text-[10px] font-black text-rose-600 hover:text-rose-700 uppercase tracking-widest cursor-pointer"
                >
                  Clear Pad
                </button>
              </div>
              <div className="border-2 border-slate-300 rounded-2xl bg-white w-full overflow-hidden shadow-inner focus-within:border-indigo-500 relative">
                <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1.5px,transparent_1.5px)] [background-size:24px_24px] opacity-20 pointer-events-none" />
                <SignatureCanvas 
                  ref={signatureRef}
                  penColor="#0f172a"
                  canvasProps={{ className: 'w-full h-36 cursor-crosshair relative z-10' }} 
                />
              </div>
            </div>

            <div className="flex gap-3 w-full">
              <Button onClick={() => setSignatureMethod(null)} variant="outline" className="flex-1 h-12 rounded-xl border-slate-200 text-slate-600 font-bold">
                Cancel
              </Button>
              <Button 
                onClick={handlePadSave} 
                disabled={!acceptedTerms}
                className={`flex-1 h-12 rounded-xl font-black uppercase tracking-wider shadow-lg ${
                  acceptedTerms 
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100' 
                  : 'bg-slate-100 text-slate-400 shadow-none cursor-not-allowed opacity-50'
                }`}
              >
                Confirm Signature
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between w-full pb-2 mb-2 border-b border-slate-100">
              <div className="text-left">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Guest Mobile Sign</h3>
                <p className="text-[10px] text-indigo-600 font-bold">{guestName}</p>
              </div>
              <button onClick={() => setSignatureMethod(null)} className="text-slate-400 hover:text-slate-600 text-xs font-black uppercase tracking-widest">
                Back
              </button>
            </div>

            <p className="text-[10px] text-slate-500 font-bold mb-3 text-center uppercase tracking-wider">
              {liveSignature ? 'Guest is signing in real-time...' : 'Scan QR code with tablet or mobile camera'}
            </p>

            <div className="bg-slate-50 p-4 border border-slate-200 rounded-2xl shadow-inner mb-4 flex items-center justify-center min-h-[250px] w-full">
              {liveSignature ? (
                <div className="w-full flex flex-col items-center">
                  <img src={liveSignature} alt="Live Signature" className="max-h-40 object-contain bg-white border border-slate-200 rounded-xl p-2 shadow-sm" />
                  <p className="text-[10px] text-indigo-600 font-black mt-3 animate-pulse uppercase tracking-wider">Waiting for guest confirmation...</p>
                </div>
              ) : qrUrl ? (
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 relative group flex flex-col items-center">
                  <QRCodeSVG 
                    value={qrUrl} 
                    size={220} 
                    level="H" 
                    includeMargin={true}
                    imageSettings={PERFECTION_QR_IMAGE_SETTINGS}
                  />
                  <div className="mt-2 text-center flex items-center gap-1.5 justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping"></span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Perfection Digital Sign</span>
                  </div>
                </div>
              ) : (
                <div className="w-52 h-52 bg-slate-200 animate-pulse rounded-xl" />
              )}
            </div>

            <div className="flex flex-col items-center gap-2.5 w-full">
              {liveSignature && (
                <Button 
                  type="button"
                  onClick={handleStaffConfirm}
                  className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black h-12 shadow-lg shadow-emerald-100 transition-all active:scale-95 uppercase tracking-wider text-xs"
                >
                  Accept & Save Signature
                </Button>
              )}
              <Button 
                variant="outline"
                onClick={handleClose}
                className="w-full h-10 rounded-xl border-slate-200 text-slate-500 font-bold text-xs uppercase tracking-wider hover:bg-slate-50"
              >
                Close Window
              </Button>
            </div>
          </>
        )}
      </div>

      {showTermsModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">
                  {ptConsent?.titleEn || (isEntranceWaiver ? 'Liability Waiver' : 'Membership Rules & Regulations')}
                </h3>
                <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest mt-1" dir="rtl">
                  {ptConsent?.titleAr || (isEntranceWaiver ? 'إخلاء المسؤولية' : 'قواعد ولوائح العضوية')}
                </p>
              </div>
              <button 
                onClick={() => setShowTermsModal(false)}
                className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400 hover:text-slate-900 shadow-sm"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {ptConsent ? (
                <div className="space-y-6">
                  <div className="space-y-4">
                    {ptConsent.introParagraphs.map((para, idx) => (
                      <div key={idx} className="space-y-1.5 border-b border-slate-100 pb-3">
                        <p className="text-slate-700 leading-relaxed font-medium">{para.en}</p>
                        <p dir="rtl" className="text-slate-600 font-arabic leading-relaxed">{para.ar}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex justify-between items-center font-black text-[11px] text-slate-900 border-b border-slate-200 pb-1.5">
                      <span>{ptConsent.parqTitleEn}</span>
                      <span dir="rtl" className="font-arabic">{ptConsent.parqTitleAr}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold">{ptConsent.parqInstructionEn}</p>
                    <div className="space-y-2.5">
                      {ptConsent.parqQuestions.map((q) => (
                        <div key={q.id} className="text-[10.5px] border-b border-slate-200/60 pb-2 last:border-0">
                          <p className="font-bold text-slate-800">{q.id}. {q.en}</p>
                          <p dir="rtl" className="font-arabic text-slate-600 mt-0.5">{q.ar}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center font-black text-[11px] text-slate-900 border-b border-slate-200 pb-1">
                      <span>{ptConsent.declarationTitleEn}</span>
                      <span dir="rtl" className="font-arabic">{ptConsent.declarationTitleAr}</span>
                    </div>
                    {ptConsent.declarationParagraphs.map((para, idx) => (
                      <div key={idx} className="space-y-1 text-[10.5px] border-b border-slate-50 pb-2.5 last:border-0">
                        <p className="text-slate-700 leading-relaxed">• {para.en}</p>
                        <p dir="rtl" className="text-slate-600 font-arabic leading-relaxed">• {para.ar}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : isEntranceWaiver && waiverContent ? (
                <div className="space-y-8">
                  <div className="space-y-4 border-b border-slate-100 pb-6">
                    <div className="space-y-1">
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{waiverContent.waiverTitleEn}</p>
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{waiverContent.waiverSubEn}</p>
                    </div>
                    <div className="space-y-3 text-slate-700 leading-relaxed text-[13px] text-justify font-medium">
                      <p>{waiverContent.p1En}</p>
                      <p>{waiverContent.p2En}</p>
                      <p className="font-bold text-slate-900">{waiverContent.p3En}</p>
                    </div>
                  </div>
                  <div dir="rtl" className="space-y-4 text-right">
                    <div className="space-y-1">
                      <p className="text-sm font-black text-slate-900 tracking-tight">{waiverContent.waiverTitleAr}</p>
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{waiverContent.waiverSubAr}</p>
                    </div>
                    <div className="space-y-3 text-slate-600 leading-relaxed text-[13px] text-justify font-arabic">
                      <p>{waiverContent.p1Ar}</p>
                      <p>{waiverContent.p2Ar}</p>
                      <p className="font-bold text-slate-900">{waiverContent.p3Ar}</p>
                    </div>
                  </div>
                </div>
              ) : (
                GYM_RULES.map((rule, idx) => (
                  <div key={idx} className="flex gap-4 items-start border-b border-slate-50 pb-6 last:border-0">
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 w-6 h-6 rounded-lg flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-bold text-slate-700 leading-relaxed text-left">
                        {rule.en}
                      </p>
                      <p className="text-sm font-black text-slate-500 leading-relaxed text-right font-serif" dir="rtl">
                        {rule.ar}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-white">
              <Button 
                onClick={() => {
                  setAcceptedTerms(true);
                  setShowTermsModal(false);
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl shadow-lg shadow-indigo-100"
              >
                I Understand & Accept
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

