import React, { useState } from 'react';
import { WhatsAppConfig } from '../../types';
import { 
  Settings, 
  ShieldCheck, 
  Lock, 
  Key, 
  Check, 
  Copy, 
  RefreshCw, 
  AlertTriangle, 
  Sparkles, 
  ExternalLink,
  Phone,
  Clock,
  Building2,
  CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';

interface WhatsAppSettingsTabProps {
  config: WhatsAppConfig;
  onSaveConfig: (updated: Partial<WhatsAppConfig>, newAccessToken?: string) => Promise<void>;
  onTestConnection: () => Promise<{ success: boolean; error?: string; details?: any }>;
  companyId: string;
  propertyId: string;
  outletId: string;
  outletName: string;
  propertyName: string;
  companyName: string;
}

export const WhatsAppSettingsTab: React.FC<WhatsAppSettingsTabProps> = ({
  config,
  onSaveConfig,
  onTestConnection,
  companyId,
  propertyId,
  outletId,
  outletName,
  propertyName,
  companyName
}) => {
  const [phoneNumberId, setPhoneNumberId] = useState(config.phone_number_id || '');
  const [wabaId, setWabaId] = useState(config.waba_id || '');
  const [displayPhone, setDisplayPhone] = useState(config.display_phone_number || '');
  const [displayName, setDisplayName] = useState(config.display_name || outletName);
  const [appId, setAppId] = useState(config.app_id || '');
  const [isActive, setIsActive] = useState(!!config.is_active);
  const [hoursStart, setHoursStart] = useState(config.business_hours_start || '08:00');
  const [hoursEnd, setHoursEnd] = useState(config.business_hours_end || '22:00');
  const [outOfHoursMsg, setOutOfHoursMsg] = useState(
    config.out_of_hours_message || 'Thank you for messaging us! Our reception is currently closed and will reply during operating hours.'
  );

  // Secure Token Update Modal State
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [newTokenInput, setNewTokenInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionDetails, setConnectionDetails] = useState<any>(null);

  const webhookCallbackUrl = `${window.location.origin}/api/whatsapp/webhook`;
  const webhookVerifyToken = config.webhook_verify_token || 'hcm_wa_verify_2026';

  const handleCopyWebhook = (val: string, label: string) => {
    navigator.clipboard.writeText(val);
    toast.success(`${label} copied to clipboard!`);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveConfig({
        phone_number_id: phoneNumberId,
        waba_id: wabaId,
        display_phone_number: displayPhone,
        display_name: displayName,
        app_id: appId,
        is_active: isActive,
        business_hours_start: hoursStart,
        business_hours_end: hoursEnd,
        out_of_hours_message: outOfHoursMsg
      });
      toast.success('WhatsApp configuration saved successfully!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateToken = async () => {
    if (!newTokenInput.trim()) return;
    setIsSaving(true);
    try {
      await onSaveConfig({}, newTokenInput.trim());
      setIsTokenModalOpen(false);
      setNewTokenInput('');
      toast.success('Permanent Access Token encrypted and saved securely!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update token');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunConnectionTest = async () => {
    setIsTesting(true);
    try {
      const res = await onTestConnection();
      if (res.success) {
        setConnectionDetails(res.details);
        toast.success('WhatsApp API connection verified successfully!');
      } else {
        toast.error(res.error || 'Connection check failed');
      }
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Isolation Scope Verification Notice */}
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-900">
              Isolated API Credentials Configuration
            </h3>
            <p className="text-xs text-emerald-700 mt-0.5">
              Target Scope: <span className="font-bold">{companyName.split(' ')[0]}</span> › <span className="font-bold">{propertyName}</span> › <span className="font-bold">{outletName}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRunConnectionTest}
            disabled={isTesting}
            className="px-4 py-2 bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-black uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
            {isTesting ? 'Testing...' : 'Test Connection'}
          </button>
        </div>
      </div>

      {/* Connection Diagnostic Result Card */}
      {connectionDetails && (
        <div className="bg-white rounded-3xl border border-emerald-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-emerald-700 text-xs font-black uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Meta WhatsApp Cloud API Status: Healthy & Verified
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-50 p-2.5 rounded-xl">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Account</span>
              <span className="font-bold text-slate-800">{connectionDetails.verified_name}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Quality Rating</span>
              <span className="font-bold text-emerald-600">{connectionDetails.quality_rating}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Status</span>
              <span className="font-bold text-slate-800">{connectionDetails.code_verification_status}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">API Latency</span>
              <span className="font-bold text-indigo-600">{connectionDetails.latency_ms} ms</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-black uppercase text-slate-900 tracking-tight">
              Meta WhatsApp Business Credentials
            </h3>
            <p className="text-xs text-slate-500">Provided by Meta for Developers Portal</p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-700">Enable Live WhatsApp Service</label>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                isActive ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-md" />
            </button>
          </div>
        </div>

        {/* Credentials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
              Phone Number ID (Meta Graph API) *
            </label>
            <input
              type="text"
              placeholder="e.g. 109823901239012"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
              WhatsApp Business Account ID (WABA ID) *
            </label>
            <input
              type="text"
              placeholder="e.g. 98129031823901"
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
              Display Phone Number *
            </label>
            <input
              type="tel"
              placeholder="e.g. +974 4445 5555"
              value={displayPhone}
              onChange={(e) => setDisplayPhone(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
              Verified Brand / Display Name
            </label>
            <input
              type="text"
              placeholder="e.g. Nova Spa Concierge"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            />
          </div>
        </div>

        {/* Encrypted Access Token Row */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                Meta Permanent Access Token (Encrypted)
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                Stored using AES-256 server-side encryption. Never returned in plaintext to the frontend.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                {config.has_token_configured ? '••••••••••••••••••••3a8f' : 'Not Configured'}
              </span>

              <button
                type="button"
                onClick={() => setIsTokenModalOpen(true)}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all"
              >
                {config.has_token_configured ? 'Update Token' : 'Add Token'}
              </button>
            </div>
          </div>
        </div>

        {/* Webhook Configuration */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div>
            <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">
              Webhook Real-Time Integration
            </h4>
            <p className="text-xs text-slate-500">
              Configure these in your Meta App Dashboard under WhatsApp &gt; Configuration:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Callback URL
              </label>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={webhookCallbackUrl}
                  className="w-full pl-4 pr-10 py-2 bg-slate-100/80 border border-slate-200 rounded-2xl text-xs font-mono text-slate-700 outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleCopyWebhook(webhookCallbackUrl, 'Callback URL')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Verify Token
              </label>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={webhookVerifyToken}
                  className="w-full pl-4 pr-10 py-2 bg-slate-100/80 border border-slate-200 rounded-2xl text-xs font-mono text-slate-700 outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleCopyWebhook(webhookVerifyToken, 'Verify Token')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Operating Hours & Out of Hours Responder */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div>
            <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">
              Operating Hours & Out-of-Office Auto Responder
            </h4>
            <p className="text-xs text-slate-500">
              Automate replies to inquiries arriving outside business hours for {outletName}.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Operating Hours Start
              </label>
              <input
                type="time"
                value={hoursStart}
                onChange={(e) => setHoursStart(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Operating Hours End
              </label>
              <input
                type="time"
                value={hoursEnd}
                onChange={(e) => setHoursEnd(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
              Out-of-Hours Auto Reply Message
            </label>
            <textarea
              rows={2}
              value={outOfHoursMsg}
              onChange={(e) => setOutOfHoursMsg(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 outline-none resize-none"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>

      {/* Update Token Modal */}
      {isTokenModalOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-900">Configure Meta Permanent Token</h3>
                  <p className="text-xs text-slate-500">{outletName}</p>
                </div>
              </div>
              <button
                onClick={() => setIsTokenModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 mt-5">
              <div className="p-3 bg-slate-50 rounded-2xl text-xs text-slate-600 leading-relaxed border border-slate-100">
                Paste your Permanent System User Access Token from Meta Business Manager. It will be encrypted immediately and never shown again.
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Permanent System User Token (EAAB...) *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="EAABwz..."
                  value={newTokenInput}
                  onChange={(e) => setNewTokenInput(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTokenModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!newTokenInput.trim() || isSaving}
                  onClick={handleUpdateToken}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  {isSaving ? 'Encrypting & Saving...' : 'Encrypt & Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
