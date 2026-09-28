import React from 'react';
import { Check, X, ShieldAlert, ShieldCheck } from 'lucide-react';

export interface PasswordValidationResult {
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  isMatch: boolean;
  isValid: boolean;
  strengthScore: number; // 0 to 5
}

export function validatePasswordComplexity(
  password: string,
  confirmPassword?: string
): PasswordValidationResult {
  const p = password || '';
  const hasMinLength = p.length >= 8;
  const hasUppercase = /[A-Z]/.test(p);
  const hasLowercase = /[a-z]/.test(p);
  const hasNumber = /[0-9]/.test(p);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(p);
  
  const isMatch = confirmPassword !== undefined 
    ? (p !== '' && p === confirmPassword)
    : true;

  let strengthScore = 0;
  if (p.length >= 8) strengthScore++;
  if (hasUppercase) strengthScore++;
  if (hasLowercase) strengthScore++;
  if (hasNumber) strengthScore++;
  if (hasSpecialChar) strengthScore++;

  const isValid = 
    hasMinLength && 
    hasUppercase && 
    hasLowercase && 
    hasNumber && 
    hasSpecialChar && 
    isMatch;

  return {
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecialChar,
    isMatch,
    isValid,
    strengthScore
  };
}

interface PasswordComplexityCheckerProps {
  password: string;
  confirmPassword?: string;
  showMatchCheck?: boolean;
}

export const PasswordComplexityChecker: React.FC<PasswordComplexityCheckerProps> = ({
  password,
  confirmPassword,
  showMatchCheck = true
}) => {
  const validation = validatePasswordComplexity(password, confirmPassword);

  const getStrengthLabel = (score: number) => {
    if (!password) return { text: 'Enter Password', color: 'text-slate-400', barColor: 'bg-slate-200' };
    if (score <= 2) return { text: 'Weak', color: 'text-red-500', barColor: 'bg-red-500' };
    if (score <= 4) return { text: 'Medium', color: 'text-amber-500', barColor: 'bg-amber-500' };
    return { text: 'Strong', color: 'text-emerald-500', barColor: 'bg-emerald-500' };
  };

  const strength = getStrengthLabel(validation.strengthScore);

  const rules = [
    { label: 'At least 8 characters', met: validation.hasMinLength },
    { label: 'One uppercase letter (A-Z)', met: validation.hasUppercase },
    { label: 'One lowercase letter (a-z)', met: validation.hasLowercase },
    { label: 'One number (0-9)', met: validation.hasNumber },
    { label: 'One special symbol (!@#$%^&*)', met: validation.hasSpecialChar },
  ];

  return (
    <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200/80 space-y-3 shadow-inner">
      {/* Strength Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
          <span className="text-slate-400">Password Security</span>
          <span className={strength.color}>{strength.text}</span>
        </div>
        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden flex gap-1">
          {[1, 2, 3, 4, 5].map((level) => (
            <div
              key={level}
              className={`h-full flex-1 transition-all duration-300 rounded-full ${
                level <= validation.strengthScore ? strength.barColor : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Rules Checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        {rules.map((rule, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div
              className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors duration-200 ${
                rule.met
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-200 text-slate-400'
              }`}
            >
              {rule.met ? (
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              )}
            </div>
            <span
              className={`text-[11px] font-bold transition-colors duration-200 ${
                rule.met ? 'text-emerald-700' : 'text-slate-500'
              }`}
            >
              {rule.label}
            </span>
          </div>
        ))}

        {showMatchCheck && confirmPassword !== undefined && (
          <div className="flex items-center gap-2 col-span-1 sm:col-span-2 pt-1 border-t border-slate-200/60">
            <div
              className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors duration-200 ${
                validation.isMatch
                  ? 'bg-emerald-500 text-white'
                  : confirmPassword !== ''
                  ? 'bg-red-500 text-white'
                  : 'bg-slate-200 text-slate-400'
              }`}
            >
              {validation.isMatch ? (
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              ) : (
                <X className="w-2.5 h-2.5 stroke-[3]" />
              )}
            </div>
            <span
              className={`text-[11px] font-bold transition-colors duration-200 ${
                validation.isMatch
                  ? 'text-emerald-700'
                  : confirmPassword !== ''
                  ? 'text-red-600'
                  : 'text-slate-500'
              }`}
            >
              {validation.isMatch
                ? 'Passwords match'
                : confirmPassword !== ''
                ? 'Passwords do not match'
                : 'Confirm password'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
