
import React from 'react';
import { createPortal } from 'react-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X, AlertTriangle, HelpCircle, Info } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Card ---
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(({ children, className, ...props }, ref) => (
  <div ref={ref} className={cn("bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden", className)} {...props}>
    {children}
  </div>
));
Card.displayName = "Card";

export const CardHeader = React.forwardRef<HTMLDivElement, CardProps>(({ children, className, ...props }, ref) => (
  <div ref={ref} className={cn("px-6 py-4 border-b border-slate-100", className)} {...props}>{children}</div>
));
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(({ children, className, ...props }, ref) => (
  <h3 ref={ref} className={cn("text-lg font-semibold", className)} {...props}>{children}</h3>
));
CardTitle.displayName = "CardTitle";

export const CardContent = React.forwardRef<HTMLDivElement, CardProps>(({ children, className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6", className)} {...props}>{children}</div>
));
CardContent.displayName = "CardContent";

// --- Inputs ---
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>}
        <input
          className={cn(
            "flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-red-500 focus:ring-red-500",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

// --- Select ---
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options?: { value: string; label: string }[];
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, error, children, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>}
        <select
          className={cn(
            "flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-red-500 focus:ring-red-500",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
          {options && options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";

// --- Button ---
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'default';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    children, 
    className, 
    variant = 'primary', 
    size = 'md',
    isLoading,
    ...props 
  }, ref) => {
    const variants = {
      primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm",
      secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
      outline: "border border-slate-300 bg-transparent hover:bg-slate-50 text-slate-700",
      danger: "bg-red-600 text-white hover:bg-red-700",
      ghost: "hover:bg-slate-100 hover:text-slate-900 text-slate-700",
      default: "bg-slate-900 text-white hover:bg-slate-800",
    };
  
    const sizes = {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-4 text-sm",
      lg: "h-12 px-6 text-base",
      icon: "h-10 w-10 justify-center",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading ? (
          <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

// --- Modal ---
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
  if (!isOpen) return null;
  
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-slate-200 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        <div className="px-6 py-5 border-b border-slate-100 bg-white flex justify-between items-center">
          <h3 className="font-black text-slate-900 uppercase tracking-widest text-base">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar max-h-[calc(90vh-80px)]">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

// --- Confirmation Dialog ---
interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  isDestructive?: boolean;
  showCancel?: boolean;
}

export const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  description, 
  confirmText = "Confirm", 
  isDestructive = false,
  showCancel = true
}: ConfirmationModalProps) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl max-w-[400px] w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
        <div className="p-8 pb-4 text-center">
            <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl",
                isDestructive ? "bg-red-50 text-red-600 shadow-red-100" : "bg-indigo-50 text-indigo-600 shadow-indigo-100"
            )}>
                {isDestructive ? <AlertTriangle className="w-8 h-8" /> : <HelpCircle className="w-8 h-8" />}
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-3">{title}</h3>
            <p className="text-slate-500 text-sm font-medium leading-relaxed px-2">
                {description}
            </p>
        </div>
        <div className="p-8 pt-6 flex flex-col gap-3">
            <Button 
                variant={isDestructive ? "danger" : "primary"} 
                onClick={() => { onConfirm(); onClose(); }} 
                className="h-14 rounded-2xl font-black text-base shadow-lg"
            >
                {confirmText}
            </Button>
            {showCancel && (
                <Button variant="secondary" onClick={onClose} className="h-14 rounded-2xl font-bold bg-slate-50 border-transparent hover:bg-slate-100 text-slate-500">
                    Cancel
                </Button>
            )}
        </div>
      </div>
    </div>,
    document.body
  );
};
