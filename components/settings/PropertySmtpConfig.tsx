import React, { useState, useEffect, useCallback } from 'react';
import { Property, PropertySmtpSettings } from '../../types';
import { PropertySmtpService } from '../../services/propertySmtpService';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Mail, 
  Server, 
  ShieldCheck, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertTriangle, 
  Send, 
  Save, 
  RefreshCw, 
  Globe, 
  Check, 
  ArrowRight,
  Info,
  Sparkles,
  Code,
  FileText,
  CheckCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { computeDkimBodyHash, canonicalizeHtmlBody } from '../../services/emailCanonicalizer';

interface PropertySmtpConfigProps {
  currentProperty: Property | null;
}

export const PropertySmtpConfig: React.FC<PropertySmtpConfigProps> = ({
  currentProperty
}) => {
  const { hasPermission } = useSettings();
  const { user, isSuperAdmin } = useAuth();
  
  const activeProperty = currentProperty;
  const selectedPropertyId = currentProperty?.id || '';
  
  const canManage = isSuperAdmin || hasPermission(user?.role_id || '', 'settings:manage_smtp');

  // Form State
  const [formData, setFormData] = useState<PropertySmtpSettings>({
    property_id: selectedPropertyId,
    host: '',
    port: 587,
    username: '',
    secure_connection: 'tls',
    from_email: '',
    from_name: '',
    ses_configuration_set: '',
    is_enabled: false,
    has_password_configured: false
  });

  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testEmailInput, setTestEmailInput] = useState('');
  const [showTestModal, setShowTestModal] = useState(false);
  const [dkimDiagnostics, setDkimDiagnostics] = useState<{ bodyHash: string; bodyLength: number } | null>(null);
  const [showDkimInspector, setShowDkimInspector] = useState(false);

  useEffect(() => {
    if (showTestModal) {
      const sampleHtml = `<!DOCTYPE html>\r\n<html>\r\n<head>\r\n  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />\r\n</head>\r\n<body>\r\n  <h2>SMTP Relay Verification</h2>\r\n  <p>Operational test for ${activeProperty?.name || 'Property'}.</p>\r\n  <a href="https://perfection.my/portal">Open Member Portal</a>\r\n</body>\r\n</html>`;
      computeDkimBodyHash(canonicalizeHtmlBody(sampleHtml), 'relaxed')
        .then(res => setDkimDiagnostics(res))
        .catch(err => console.warn('[DKIM Diagnostics] Computation failed:', err));
    }
  }, [showTestModal, activeProperty?.name]);

  // Load SMTP settings whenever the active property changes from the top selector
  const loadSettingsForProperty = useCallback(async (propertyId: string) => {
    if (!propertyId) return;
    setIsLoading(true);
    setNewPassword('');
    setShowPassword(false);

    try {
      const config = await PropertySmtpService.getSettings(propertyId);
      if (config) {
        setFormData(config);
      } else {
        setFormData({
          property_id: propertyId,
          host: '',
          port: 587,
          username: '',
          secure_connection: 'tls',
          from_email: '',
          from_name: '',
          is_enabled: false,
          has_password_configured: false
        });
      }
    } catch (err) {
      console.error('[PropertySmtpConfig] Failed to load settings:', err);
      toast.error('Failed to load SMTP settings for this property');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPropertyId) {
      loadSettingsForProperty(selectedPropertyId);
    }
  }, [selectedPropertyId, loadSettingsForProperty]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPropertyId) return;

    if (!canManage) {
      toast.error('You do not have permission to modify SMTP configurations');
      return;
    }

    // Basic validations
    if (formData.is_enabled) {
      if (!formData.host.trim()) {
        toast.error('SMTP Host is required when enabled');
        return;
      }
      if (!formData.username.trim()) {
        toast.error('SMTP Username is required when enabled');
        return;
      }
      if (!formData.has_password_configured && !newPassword.trim()) {
        toast.error('SMTP Password is required when enabling for the first time');
        return;
      }
    }

    setIsSaving(true);
    try {
      const result = await PropertySmtpService.saveSettings(
        selectedPropertyId,
        {
          host: formData.host.trim(),
          port: Number(formData.port) || 587,
          username: formData.username.trim(),
          secure_connection: formData.secure_connection,
          from_email: formData.from_email.trim(),
          from_name: formData.from_name.trim(),
          is_enabled: formData.is_enabled,
          ses_configuration_set: (formData.ses_configuration_set || '').trim(),
          last_tested_at: formData.last_tested_at,
          last_test_status: formData.last_test_status,
          last_test_error: formData.last_test_error
        },
        newPassword.trim() || undefined
      );

      if (result.success) {
        toast.success(`SMTP configuration saved for ${activeProperty?.name || 'property'}`);
        setNewPassword('');
        // Reload to update state
        await loadSettingsForProperty(selectedPropertyId);
      } else {
        toast.error(result.error || 'Failed to save configuration');
      }
    } catch (err: any) {
      toast.error(err.message || 'Save error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!canManage) {
      toast.error('You do not have permission to run connection tests');
      return;
    }

    if (!testEmailInput || !testEmailInput.includes('@')) {
      toast.error('Please enter a valid recipient email address for testing');
      return;
    }

    setIsTesting(true);
    try {
      const result = await PropertySmtpService.testConnection(
        selectedPropertyId,
        testEmailInput.trim()
      );

      if (result.success) {
        toast.success(result.message, { duration: 6000 });
        setShowTestModal(false);
        await loadSettingsForProperty(selectedPropertyId);
      } else {
        toast.error(result.message, { duration: 7000 });
      }
    } catch (err: any) {
      toast.error(err.message || 'SMTP Test execution error');
    } finally {
      setIsTesting(false);
    }
  };

  if (!activeProperty) {
    return (
      <div className="bg-white rounded-[2.5rem] border border-slate-200/80 p-12 text-center shadow-sm">
        <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
          <Server className="w-8 h-8" />
        </div>
        <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">No Property Selected</h3>
        <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto mt-1">
          Please select a property from the top header menu to view and configure its dedicated outbound SMTP settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Main SMTP Configuration Card */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200/80 shadow-xl overflow-hidden">
        {/* Header Banner */}
        <div className="bg-slate-900 text-white p-8 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                <Server className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-black uppercase tracking-tight text-white">
                    {activeProperty.name} • SMTP Relay
                  </h2>
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                    formData.is_enabled 
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                      : 'bg-slate-700/50 text-slate-400 border-slate-600'
                  }`}>
                    {formData.is_enabled ? 'Active Custom SMTP' : 'Fallback: Resend'}
                  </span>
                </div>
                <p className="text-[11px] font-medium text-slate-400 mt-1">
                  All contracts, receipts, registration vouchers, and alerts for {activeProperty.name} route through this server.
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => loadSettingsForProperty(selectedPropertyId)}
                disabled={isLoading}
                className="p-3 bg-white/10 hover:bg-white/15 text-white rounded-xl transition-all disabled:opacity-50"
                title="Reload configuration"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                disabled={!canManage}
                onClick={() => setShowTestModal(true)}
                className="px-4 py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
                Test Connection
              </button>
            </div>
          </div>
        </div>

        {/* Fallback Notice */}
        <div className="bg-amber-50 border-b border-amber-100 p-4 px-8 flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-amber-800 leading-relaxed">
            <strong>Automated Fallback Protection:</strong> If custom SMTP is disabled or encounters a connection timeout, the system automatically routes all emails through the primary <strong>Resend</strong> delivery network with zero dropped messages.
          </p>
        </div>

        {/* Permission Notice */}
        {!canManage && (
          <div className="bg-blue-50 border-b border-blue-100 p-4 px-8 flex items-start gap-3">
            <Lock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-blue-800 leading-relaxed">
              <strong>View-Only Mode:</strong> You do not have permission to modify SMTP configurations. Contact a system administrator to request edit access.
            </p>
          </div>
        )}

        {/* Form Body */}
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Loading {activeProperty?.name} SMTP Configuration...
            </span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-8 space-y-8">
            {/* Enabled Toggle Switch */}
            <div className="flex items-center justify-between p-6 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div className="space-y-1">
                <label className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  Enable Property-Specific SMTP
                </label>
                <p className="text-xs font-medium text-slate-500">
                  When toggled ON, outbound mail for {activeProperty?.name} will use the credentials specified below.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                disabled={!canManage}
                aria-checked={formData.is_enabled}
                onClick={() => setFormData(prev => ({ ...prev, is_enabled: !prev.is_enabled }))}
                className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  formData.is_enabled ? 'bg-emerald-600' : 'bg-slate-300'
                } ${!canManage ? 'opacity-65 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    formData.is_enabled ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Quick Provider Presets */}
            <div className="p-5 rounded-2xl bg-indigo-50/70 border border-indigo-100/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-950 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  Quick Server Presets
                </span>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100/70 px-2.5 py-0.5 rounded-full">
                  Auto-configures Host & TLS Port
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { name: 'AWS SES (US-East-1)', host: 'email-smtp.us-east-1.amazonaws.com', port: 587, sec: 'tls' },
                  { name: 'AWS SES (US-West-2)', host: 'email-smtp.us-west-2.amazonaws.com', port: 587, sec: 'tls' },
                  { name: 'AWS SES (EU-West-1)', host: 'email-smtp.eu-west-1.amazonaws.com', port: 587, sec: 'tls' },
                  { name: 'AWS SES (AP-Southeast-1)', host: 'email-smtp.ap-southeast-1.amazonaws.com', port: 587, sec: 'tls' },
                  { name: 'Microsoft 365', host: 'smtp.office365.com', port: 587, sec: 'tls' },
                  { name: 'Google Workspace', host: 'smtp.gmail.com', port: 587, sec: 'tls' },
                ].map(preset => (
                  <button
                    key={preset.name}
                    type="button"
                    disabled={!canManage}
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        host: preset.host,
                        port: preset.port,
                        secure_connection: preset.sec as any
                      }));
                      toast.success(`Loaded preset: ${preset.name}`);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      formData.host === preset.host
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white hover:bg-indigo-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid of Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Host */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  SMTP Host Server <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={!canManage}
                  placeholder="e.g. smtp.office365.com or mail.thetorchdoha.com"
                  value={formData.host}
                  onChange={e => setFormData(prev => ({ ...prev, host: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all disabled:bg-slate-50 disabled:text-slate-500"
                />
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Domain or IP address of your mail exchange server
                </span>
              </div>

              {/* Port & Security */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                    Port <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    disabled={!canManage}
                    placeholder="587"
                    value={formData.port}
                    onChange={e => setFormData(prev => ({ ...prev, port: parseInt(e.target.value) || 587 }))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all disabled:bg-slate-50 disabled:text-slate-500"
                  />
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Common: 587, 465, 25
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                    Encryption <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.secure_connection}
                    disabled={!canManage}
                    onChange={e => setFormData(prev => ({ ...prev, secure_connection: e.target.value as any }))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all bg-white disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    <option value="tls">STARTTLS (587 / 25)</option>
                    <option value="ssl">SSL / TLS (465)</option>
                    <option value="none">None (Plain / Insecure)</option>
                  </select>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    TLS/SSL Protocol
                  </span>
                </div>
              </div>

              {/* Username */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  SMTP Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={!canManage}
                  placeholder="e.g. notifications@thetorchdoha.com"
                  value={formData.username}
                  onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all disabled:bg-slate-50 disabled:text-slate-500"
                />
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Usually the full email address or account ID
                </span>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                    SMTP Password <span className="text-red-500">*</span>
                  </label>
                  {formData.has_password_configured && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                      <Lock className="w-2.5 h-2.5" /> Encrypted & Saved
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    disabled={!canManage}
                    placeholder={formData.has_password_configured ? '•••••••••••• (Leave blank to keep existing)' : 'Enter SMTP password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all disabled:bg-slate-50 disabled:text-slate-500"
                  />
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 disabled:opacity-50"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Encrypted server-side using AES-256-GCM before database write
                </span>
              </div>

              {/* From Email */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  From Email Address
                </label>
                <input
                  type="email"
                  disabled={!canManage}
                  placeholder="e.g. club@thetorchdoha.com (Defaults to Username)"
                  value={formData.from_email}
                  onChange={e => setFormData(prev => ({ ...prev, from_email: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all disabled:bg-slate-50 disabled:text-slate-500"
                />
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Return-path and sender address shown in email headers
                </span>
              </div>

              {/* From Name */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  From Friendly Name
                </label>
                <input
                  type="text"
                  disabled={!canManage}
                  placeholder={`e.g. ${activeProperty?.name || 'Luxury Hotel'} Notifications`}
                  value={formData.from_name}
                  onChange={e => setFormData(prev => ({ ...prev, from_name: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all disabled:bg-slate-50 disabled:text-slate-500"
                />
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Sender display name shown to recipients
                </span>
              </div>
            </div>

            {/* AWS SES & DKIM Body Hash Canonicalization Protection */}
            <div className="p-6 rounded-2xl bg-slate-900 text-white space-y-4 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">
                      DKIM Body Hash &amp; Transit Integrity Engine
                    </h4>
                    <p className="text-[10px] text-slate-400 font-medium">
                      RFC 6376 §3.4.4 Relaxed Canonicalization &amp; Anti-Tampering Shield
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Protected
                </span>
              </div>

              {/* SES Configuration Set Input */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-300 block">
                  AWS SES Configuration Set (Optional)
                </label>
                <input
                  type="text"
                  disabled={!canManage}
                  placeholder="e.g. disabled-tracking-ruleset"
                  value={formData.ses_configuration_set || ''}
                  onChange={e => setFormData(prev => ({ ...prev, ses_configuration_set: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all placeholder:text-slate-500"
                />
                <span className="text-[10px] text-slate-400 leading-normal block">
                  If your AWS account uses a dedicated SES Configuration Set with engagement open/click tracking disabled, provide its name to bind messages via <code className="text-indigo-300">X-SES-CONFIGURATION-SET</code>.
                </span>
              </div>

              {/* 4 Feature Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Relaxed CRLF Normalization</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Normalizes all body newlines to strict <code className="text-slate-300">\r\n</code> and strips line-trailing whitespace per RFC 6376, eliminating hash drift from intermediate MTA line conversion.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Anti-Tracking Link Protection</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Injects <code className="text-slate-300">ses:no-track="true"</code> on all hyperlinks so Amazon SES never rewrites URLs to tracking redirectors between signing and dispatch.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Tracking Beacon Suppression</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Attaches <code className="text-slate-300">X-SES-MESSAGE-TAGS: ses:no-track=true</code> header to suppress automatic 1x1 open-tracking pixel injection into the HTML footer.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>RFC 2045 Line Folding</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Enforces 76-character max lines with soft breaks (<code className="text-slate-300">=\r\n</code>), preventing intermediate MTAs from force-wrapping lines exceeding the 998-octet limit.
                  </p>
                </div>
              </div>
            </div>

            {/* Test Status Indicator */}
            {formData.last_tested_at && (
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                formData.last_test_status === 'success' 
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800' 
                  : 'bg-red-50/70 border-red-200 text-red-800'
              }`}>
                <div className="flex items-center gap-3">
                  {formData.last_test_status === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  )}
                  <div>
                    <p className="text-xs font-black uppercase tracking-tight">
                      {formData.last_test_status === 'success' ? 'SMTP Handshake Verified' : 'Last SMTP Test Failed'}
                    </p>
                    <p className="text-[11px] font-medium opacity-80">
                      {formData.last_test_status === 'success' 
                        ? `Last verified: ${new Date(formData.last_tested_at).toLocaleString()}`
                        : `Error: ${formData.last_test_error || 'Connection timed out'}`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!canManage}
                  onClick={() => setShowTestModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white text-xs font-black uppercase tracking-wider shadow-sm border border-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Retest
                </button>
              </div>
            )}

            {/* Submit Bar */}
            <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-100">
              <button
                type="button"
                disabled={!canManage}
                onClick={() => setShowTestModal(true)}
                className="px-6 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                Test Connection
              </button>

              <button
                type="submit"
                disabled={isSaving || !canManage}
                className="px-8 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving Configuration...' : `Save ${activeProperty?.name || 'Property'} SMTP`}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Test Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 max-w-lg w-full shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Send className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Test SMTP Relay</h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  {activeProperty?.name || 'Property'} Outbound Dispatch
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              We will execute an authentic SMTP handshake with <strong>{formData.host || 'your host'}</strong> on port <strong>{formData.port}</strong> and dispatch a verification message with full RFC 6376 canonicalization.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                Recipient Email Address
              </label>
              <input
                type="email"
                placeholder="e.g. your-email@example.com"
                value={testEmailInput}
                onChange={e => setTestEmailInput(e.target.value)}
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
              />
            </div>

            {/* DKIM Body Integrity Diagnostics Toggle */}
            <div className="rounded-2xl bg-slate-900 text-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    DKIM Body Hash &amp; Canonicalization Inspector
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDkimInspector(!showDkimInspector)}
                  className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                >
                  {showDkimInspector ? 'Hide Details' : 'View Diagnostics'}
                </button>
              </div>

              {showDkimInspector && (
                <div className="space-y-2.5 pt-2 border-t border-slate-800 text-xs animate-in fade-in duration-200">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Canonical Body Hash (bh=)</span>
                      <span className="text-emerald-400 font-mono font-bold">SHA-256 Base64</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 font-mono text-[11px] text-emerald-400 break-all border border-slate-800">
                      {dkimDiagnostics?.bodyHash || 'Calculating...'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase">Body Length (l=)</span>
                      <span className="font-mono text-slate-200 font-bold">{dkimDiagnostics?.bodyLength ?? 0} octets</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase">SES Anti-Tracking</span>
                      <span className="text-emerald-400 font-bold">Enforced (ses:no-track)</span>
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1 text-[10px] font-mono text-slate-300">
                    <div>MIME-Version: 1.0</div>
                    <div>Content-Transfer-Encoding: quoted-printable</div>
                    <div>X-SES-MESSAGE-TAGS: ses:no-track=true</div>
                    {formData.ses_configuration_set && (
                      <div>X-SES-CONFIGURATION-SET: {formData.ses_configuration_set}</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                disabled={isTesting}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !testEmailInput}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Testing Relay...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Dispatch Verification
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
