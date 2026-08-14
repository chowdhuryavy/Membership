import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from './ui';
import { X, ArrowRight } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import SignatureCanvas from 'react-signature-canvas';
import { supabase } from '../services/mockSupabase';

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
  logoUrl = ''
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
        const { data } = await supabase
          .from('notifications')
          .select('message, id')
          .eq('title', `SIG_SYNC:${currentSigId}`)
          .maybeSingle();

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
    }, 2000);

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
        logo: logoUrl || ''
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

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden p-8 flex flex-col items-center">
        {!signatureMethod ? (
          <>
            <h3 className="text-lg font-black text-slate-900 mb-6 uppercase tracking-widest">Select Method</h3>
            <div className="flex flex-col gap-4 w-full">
              <Button onClick={() => handleSignatureMethodSelect('pad')} className="h-14 rounded-xl">Signature Pad</Button>
              <Button onClick={() => handleSignatureMethodSelect('qr')} className="h-14 rounded-xl">QR Code</Button>
              <Button variant="outline" onClick={handleClose} className="h-14 rounded-xl">Cancel</Button>
              
              {onSkip && (
                <Button 
                  variant="ghost" 
                  onClick={onSkip} 
                  className="h-10 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 hidden md:flex items-center justify-center gap-2 mt-2"
                >
                  Skip Signature (Desktop) <ArrowRight className="w-3 h-3" />
                </Button>
              )}
            </div>
          </>
        ) : signatureMethod === 'pad' ? (
          <>
            <h3 className="text-lg font-black text-slate-900 mb-4 uppercase tracking-widest">Sign Below</h3>
            <div className="border-2 border-slate-200 rounded-2xl mb-6 bg-slate-50 w-full overflow-hidden">
              <SignatureCanvas 
                ref={signatureRef}
                penColor="black"
                canvasProps={{ width: 300, height: 150, className: 'w-full h-36' }} 
              />
            </div>
            <div className="flex gap-2 w-full">
              <Button onClick={handlePadClear} variant="outline" className="flex-1 rounded-xl">Clear</Button>
              <Button onClick={handlePadSave} className="flex-1 rounded-xl bg-indigo-600">Confirm</Button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-lg font-black text-slate-900 mb-2 uppercase tracking-widest">
              {liveSignature ? 'Live Preview' : 'Guest Signature'}
            </h3>
            <p className="text-[10px] text-slate-500 font-bold mb-4 text-center uppercase tracking-tighter">
              {liveSignature ? 'Guest is signing now...' : 'Scan QR with tablet to sign'}
            </p>
            <div className="bg-white p-4 border border-slate-100 rounded-3xl shadow-sm mb-6 flex items-center justify-center min-h-[270px] w-full">
              {liveSignature ? (
                <div className="w-full flex flex-col items-center">
                  <img src={liveSignature} alt="Live Signature" className="max-h-48 object-contain border border-slate-50 rounded-xl" />
                  <p className="text-[10px] text-indigo-500 font-black mt-4 animate-pulse">WAITING FOR GUEST TO CONFIRM...</p>
                </div>
              ) : qrUrl ? (
                <QRCodeSVG 
                  value={qrUrl} 
                  size={240} 
                  level="H" 
                  includeMargin={true} 
                />
              ) : (
                <div className="w-60 h-60 bg-slate-50 animate-pulse rounded-xl" />
              )}
            </div>
            <div className="flex flex-col items-center gap-4 w-full">
              {liveSignature && (
                <Button 
                  type="button"
                  onClick={handleStaffConfirm}
                  className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 shadow-lg shadow-indigo-100 transition-all active:scale-95"
                >
                  Staff Confirm Signature
                </Button>
              )}
              <button 
                type="button"
                onClick={handleClose}
                className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
              >
                Cancel & Reset
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

