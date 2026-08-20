import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui';
import { X, ArrowRight } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import SignatureCanvas from 'react-signature-canvas';
export { default as SignaturePad } from 'react-signature-canvas';
import { supabase } from '../services/mockSupabase';
import { PERFECTION_QR_IMAGE_SETTINGS } from '../lib/perfectionLogo';

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
  agreementType?: 'pt' | 'general' | 'membership' | 'entrance';
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

  const handlePadSave = () => {
    if (signatureRef.current && !signatureRef.current.isEmpty()) {
      const dataUrl = signatureRef.current.toDataURL();
      setSignatureMethod(null);
      onSave(dataUrl);
    }
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

  if (!isOpen) return null;

  const isPT = agreementType === 'pt' || tier.toLowerCase().includes('pt') || tier.toLowerCase().includes('personal') || tier.toLowerCase().includes('consent');

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
          <div className="w-full flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Health Declaration & Signature</h3>
                <p className="text-[11px] text-indigo-600 font-bold">{guestName} • {tier}</p>
              </div>
              <button onClick={() => setSignatureMethod(null)} className="text-slate-400 hover:text-slate-600 text-xs font-black uppercase tracking-widest">
                Back
              </button>
            </div>

            {/* Terms & Consent Summary Box shown BEFORE the signature pad */}
            <div className="mb-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 max-h-40 overflow-y-auto text-[10px] space-y-2 text-slate-700 leading-relaxed shadow-inner">
              <div className="flex items-center gap-1.5 text-indigo-700 font-black text-[10.5px]">
                <span>📋 Consent & PAR-Q Acknowledgment</span>
              </div>
              <p className="text-justify font-medium">
                {isPT 
                  ? "I declare that I am physically fit and voluntarily participate in personal training sessions. I have accurately answered the Physical Activity Readiness Questionnaire (PAR-Q) and consent to the health & safety terms."
                  : "I acknowledge and agree to abide by the club rules, terms of membership, and safety regulations."}
              </p>
              <p dir="rtl" className="text-justify font-arabic text-slate-600">
                {isPT
                  ? "أقر بأنني لائق بدنياً وأشارك طواعية في جلسات التدريب الشخصي، وقد أجبت بدقة على استبيان الجاهزية للنشاط البدني وأوافق على شروط السلامة والصحة."
                  : "أقر وأوافق على الالتزام بقواعد النادي وشروط العضوية واللوائح الخاصة بالسلامة."}
              </p>
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
              <div className="border-2 border-slate-300 rounded-2xl bg-white w-full overflow-hidden shadow-inner focus-within:border-indigo-500">
                <SignatureCanvas 
                  ref={signatureRef}
                  penColor="#0f172a"
                  canvasProps={{ className: 'w-full h-40 cursor-crosshair' }} 
                />
              </div>
            </div>

            <div className="flex gap-3 w-full">
              <Button onClick={() => setSignatureMethod(null)} variant="outline" className="flex-1 h-12 rounded-xl border-slate-200 text-slate-600 font-bold">
                Cancel
              </Button>
              <Button onClick={handlePadSave} className="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider shadow-lg shadow-indigo-100">
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
    </div>,
    document.body
  );
};

