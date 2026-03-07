import React, { useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button } from './ui';
import { X, PenTool, Eraser, Check } from 'lucide-react';

interface SignaturePadProps {
  title: string;
  onSave: (dataUrl: string) => void;
  onClear: () => void;
  initialData?: string;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ title, onSave, onClear, initialData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(!!initialData);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000000';
        
        if (initialData) {
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
          };
          img.src = initialData;
        }
      }
    }
  }, [initialData]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      // Prevent scrolling while drawing on touch devices
      if (e.cancelable) {
        e.preventDefault();
      }
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (hasDrawn && canvasRef.current) {
      onSave(canvasRef.current.toDataURL('image/png'));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onClear();
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</label>
        {hasDrawn && (
          <button type="button" onClick={clear} className="text-[9px] font-bold text-red-500 hover:text-red-700 uppercase tracking-widest flex items-center gap-1">
            <Eraser className="w-3 h-3" /> Clear
          </button>
        )}
      </div>
      <div className="border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 overflow-hidden relative">
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
            <div className="flex flex-col items-center gap-2">
              <PenTool className="w-8 h-8 text-slate-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sign Here</span>
            </div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className="w-full h-[150px] touch-none cursor-crosshair bg-transparent relative z-10"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
    </div>
  );
};

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (memberSig: string, staffSig: string) => void;
  initialMemberSignature?: string;
  initialStaffSignature?: string;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialMemberSignature, 
  initialStaffSignature 
}) => {
  const [memberSig, setMemberSig] = useState(initialMemberSignature || '');
  const [staffSig, setStaffSig] = useState(initialStaffSignature || '');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[400] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-lg rounded-[2rem] shadow-2xl border-white/20">
        <CardHeader className="p-6 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2">
            <PenTool className="w-5 h-5 text-indigo-600" /> Capture Signatures
          </CardTitle>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <SignaturePad 
            title="Member Signature" 
            initialData={memberSig}
            onSave={setMemberSig} 
            onClear={() => setMemberSig('')} 
          />
          <SignaturePad 
            title="Authorized Staff Signature" 
            initialData={staffSig}
            onSave={setStaffSig} 
            onClear={() => setStaffSig('')} 
          />
          
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={onClose} className="flex-1 rounded-xl h-12 font-bold">Cancel</Button>
            <Button 
              onClick={() => onSave(memberSig, staffSig)} 
              className="flex-1 rounded-xl h-12 font-black shadow-lg shadow-indigo-100"
              disabled={!memberSig || !staffSig}
            >
              <Check className="w-4 h-4 mr-2" /> Save Signatures
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
