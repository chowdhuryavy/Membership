import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, QrCode, AlertCircle, Sparkles, CheckCircle2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { Html5Qrcode } from 'html5-qrcode';

interface QrScannerModalProps {
  onScanSuccess: (code: string) => void;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  onScanSuccess,
  onClose,
  title = 'Scan Digital Member Pass',
  subtitle = 'Position the QR code or Barcode inside the camera frame or use a physical scanner'
}) => {
  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // USB Barcode Scanner Wedge Listener (Listens to fast keypress buffer)
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key events if user is typing in an input field
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return;
      }

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 100) {
        buffer = ''; // Reset buffer if typing speed is human slow (>100ms)
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (buffer.trim().length > 2) {
          const scanned = buffer.trim();
          toast.success(`Scanned: ${scanned}`);
          onScanSuccess(scanned);
          buffer = '';
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScanSuccess]);

  // Start Camera Stream with html5-qrcode
  useEffect(() => {
    let isMounted = true;

    async function startCamera() {
      try {
        const html5QrCode = new Html5Qrcode('reader');
        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (isMounted) {
              toast.success(`Scanned: ${decodedText}`);
              onScanSuccess(decodedText);
              // Stop immediately after scan success
              try {
                if (html5QrCode.isScanning) {
                  html5QrCode.stop().catch(console.error);
                }
              } catch (e) {
                console.warn(e);
              }
            }
          },
          (errorMessage) => {
             // parse errors are normal (no qr code found)
          }
        );

        if (isMounted) {
          setCameraActive(true);
        }
      } catch (err: any) {
        console.warn('Camera access denied or unavailable:', err);
        if (isMounted) setCameraError('Camera stream unavailable. You can enter the Membership # below or use a USB scanner.');
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current.stop().catch(console.warn);
          } else {
            html5QrCodeRef.current.clear();
          }
        } catch (e) {
          console.warn('Error stopping scanner:', e);
        }
      }
    };
  }, [onScanSuccess]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) {
      toast.error('Please enter a membership number or phone number.');
      return;
    }
    onScanSuccess(manualCode.trim());
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-white leading-none">
                {title}
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                Camera & Barcode Reader Active
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera Viewfinder Area */}
        <div className="p-6 space-y-5">
          <div className="relative bg-slate-950 rounded-3xl overflow-hidden border-2 border-slate-800 shadow-inner group min-h-[300px]">
            <div id="reader" className="w-full h-full object-cover"></div>

            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 space-y-3 bg-slate-950 z-10">
                <Camera className="w-12 h-12 text-slate-600 mx-auto animate-pulse" />
                <p className="text-xs font-bold text-slate-400 max-w-xs mx-auto text-center">
                  {cameraError || 'Initializing camera viewfinder...'}
                </p>
              </div>
            )}

            {/* Scanning Laser HUD overlay */}
            {cameraActive && (
              <>
                <div className="absolute inset-0 border-2 border-indigo-500/40 pointer-events-none flex items-center justify-center p-8 z-10">
                  <div className="w-48 h-48 border-2 border-dashed border-indigo-400 rounded-2xl relative flex items-center justify-center">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-indigo-500"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-indigo-500"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-indigo-500"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-indigo-500"></div>
                    <div className="w-full h-0.5 bg-red-500/80 shadow-[0_0_12px_rgba(239,68,68,1)] animate-bounce"></div>
                  </div>
                </div>

                <div className="absolute bottom-3 left-3 right-3 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-center z-10">
                  <span className="text-[10px] font-mono text-indigo-300 font-bold uppercase tracking-wider">
                    Ready for USB Hardware Scanner or Camera QR
                  </span>
                </div>
              </>
            )}
          </div>

          <p className="text-center text-xs font-bold text-slate-500">
            {subtitle}
          </p>

          {/* Manual Input Fallback */}
          <form onSubmit={handleManualSubmit} className="space-y-3 pt-2 border-t border-slate-100">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              Or Enter Membership Number / Phone Manually
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="e.g. MEM-2026-8812 or Phone #"
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 uppercase tracking-wider"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 shrink-0"
              >
                Submit Code
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
