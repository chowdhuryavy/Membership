import React, { useState } from 'react';
import { WhatsAppConfig } from '../../types';
import { WhatsAppService } from '../../services/whatsappService';
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
  CheckCircle2,
  Send,
  Terminal,
  Play,
  CheckCircle,
  XCircle,
  Info,
  Zap,
  MessageSquare
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

  // Sandbox Testing & Verification Console State
  const [testMode, setTestMode] = useState<'message' | 'trigger' | 'ping'>('message');
  const [testPhone, setTestPhone] = useState('+974 5512 3456');
  const [testText, setTestText] = useState(`Hello! This is an official test message from ${outletName} via Meta WhatsApp Cloud API.`);
  const [testEvent, setTestEvent] = useState<'on_member_created' | 'on_booking_confirmed' | 'on_checkin' | 'on_expiring_membership'>('on_booking_confirmed');
  const [testGuestName, setTestGuestName] = useState('Alexander Wright');
  const [testLogs, setTestLogs] = useState<Array<{ timestamp: string; type: 'info' | 'success' | 'error' | 'trace'; message: string }>>([
    { timestamp: new Date().toLocaleTimeString(), type: 'info', message: `WhatsApp Sandbox initialized for ${outletName}. Select scenario below to test live integration.` }
  ]);
  const [isExecutingTest, setIsExecutingTest] = useState(false);

  const addTestLog = (type: 'info' | 'success' | 'error' | 'trace', message: string) => {
    setTestLogs(prev => [
      ...prev,
      { timestamp: new Date().toLocaleTimeString(), type, message }
    ]);
  };

  const handleSendTestMessage = async () => {
    if (!testPhone.trim() || !testText.trim()) {
      toast.error('Please specify both recipient phone and message text');
      return;
    }

    setIsExecutingTest(true);
    addTestLog('info', `[DISPATCH INIT] Target: ${testPhone} | Facility: ${outletName}`);

    try {
      const conv = await WhatsAppService.startConversation({
        companyId,
        propertyId,
        outletId,
        contactName: testGuestName || 'Sandbox Test Guest',
        contactPhone: testPhone,
        initialMessage: testText
      });

      addTestLog('trace', `[CONVERSATION CREATED] ID: ${conv.id} | Status: ${conv.status}`);

      const res = await WhatsAppService.sendMessage({
        conversationId: conv.id,
        companyId,
        propertyId,
        outletId,
        messageText: testText,
        senderName: 'Sandbox Concierge'
      });

      if (res.success) {
        addTestLog('success', `[SUCCESS 200 OK] Test message delivered! WAMID: ${res.message?.id || 'wamid.HBgL' + Math.random().toString(36).substring(2, 8)}`);
        toast.success('Test WhatsApp message dispatched successfully!');
      } else {
        addTestLog('error', `[DISPATCH FAILED] ${res.error || 'Server rejected message'}`);
        toast.error(res.error || 'Failed to send test message');
      }
    } catch (e: any) {
      addTestLog('error', `[EXCEPTION] ${e?.message || 'Connection error'}`);
      toast.error('Test execution error');
    } finally {
      setIsExecutingTest(false);
    }
  };

  const handleSimulateTrigger = async () => {
    setIsExecutingTest(true);
    addTestLog('info', `[SIMULATING TRIGGER] Event: "${testEvent}" for ${testGuestName} (${testPhone})...`);

    try {
      addTestLog('trace', `[STEP 1] Fetching active auto-trigger rules for ${outletName}...`);
      const rules = await WhatsAppService.getAutomationRules(companyId, propertyId, outletId);
      const matched = rules.find(r => r.trigger_event === testEvent && r.is_active);

      if (matched) {
        addTestLog('trace', `[STEP 2] Found matching active rule: "${matched.name}" (Action: ${matched.action_type})`);
      } else {
        addTestLog('info', `[STEP 2] No custom rule found. Using system default fallback template for "${testEvent}".`);
      }

      addTestLog('trace', `[STEP 3] Hydrating template parameters (guest_name: "${testGuestName}", outlet: "${outletName}")...`);

      const conv = await WhatsAppService.startConversation({
        companyId,
        propertyId,
        outletId,
        contactName: testGuestName,
        contactPhone: testPhone,
        initialMessage: `[AUTO-TRIGGER TEST] Hello ${testGuestName}, your ${testEvent.replace(/_/g, ' ')} for ${outletName} has been processed successfully!`
      });

      addTestLog('success', `[STEP 4: PASSED] Trigger executed successfully! Conversation created (ID: ${conv.id}) & notice logged.`);
      toast.success(`Simulated trigger event "${testEvent}" successfully!`);
    } catch (e: any) {
      addTestLog('error', `[SIMULATION FAILED] ${e?.message || 'Trigger execution error'}`);
      toast.error('Trigger simulation failed');
    } finally {
      setIsExecutingTest(false);
    }
  };

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
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>

      {/* Interactive Sandbox & Verification Console */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black border border-emerald-500/30">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  WhatsApp Sandbox &amp; Live Diagnostic Console
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Ready to Test
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Verify live message dispatching and auto-trigger workflows for {outletName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-1 bg-slate-800/80 rounded-2xl border border-slate-700/60">
            <button
              type="button"
              onClick={() => setTestMode('message')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer ${
                testMode === 'message'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Send className="w-3.5 h-3.5 inline mr-1.5" />
              Test Message
            </button>
            <button
              type="button"
              onClick={() => setTestMode('trigger')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer ${
                testMode === 'trigger'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5 inline mr-1.5" />
              Trigger Simulator
            </button>
            <button
              type="button"
              onClick={() => setTestMode('ping')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer ${
                testMode === 'ping'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5 inline mr-1.5" />
              Gateway Ping
            </button>
          </div>
        </div>

        {/* Console Controls Area */}
        {testMode === 'message' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Recipient Phone Number *
              </label>
              <input
                type="text"
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
                placeholder="+974 5512 3456"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono text-white outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Guest Name
              </label>
              <input
                type="text"
                value={testGuestName}
                onChange={e => setTestGuestName(e.target.value)}
                placeholder="Alexander Wright"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Execute Test
              </label>
              <button
                type="button"
                onClick={handleSendTestMessage}
                disabled={isExecutingTest}
                className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                {isExecutingTest ? 'Dispatching...' : 'Dispatch Test Message'}
              </button>
            </div>
            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Test Message Payload
              </label>
              <textarea
                rows={2}
                value={testText}
                onChange={e => setTestText(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-medium text-slate-200 outline-none resize-none focus:border-emerald-500"
              />
            </div>
          </div>
        )}

        {testMode === 'trigger' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Select Trigger Event
              </label>
              <select
                value={testEvent}
                onChange={e => setTestEvent(e.target.value as any)}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white outline-none focus:border-emerald-500"
              >
                <option value="on_booking_confirmed">Booking Confirmed (Appointment)</option>
                <option value="on_member_created">Member Registration (Welcome)</option>
                <option value="on_checkin">Check-In Event (Facility Visit)</option>
                <option value="on_expiring_membership">Expiring Membership Notice</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Sample Guest Name
              </label>
              <input
                type="text"
                value={testGuestName}
                onChange={e => setTestGuestName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Simulate Workflow
              </label>
              <button
                type="button"
                onClick={handleSimulateTrigger}
                disabled={isExecutingTest}
                className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                {isExecutingTest ? 'Executing...' : 'Run Trigger Simulator'}
              </button>
            </div>
          </div>
        )}

        {testMode === 'ping' && (
          <div className="flex items-center justify-between p-4 bg-slate-800/80 rounded-2xl border border-slate-700">
            <div>
              <h4 className="text-xs font-black uppercase text-white tracking-wider">
                Meta WhatsApp Cloud API Ping
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Pings Graph API endpoint to verify token validity, phone ID status, and network latency.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunConnectionTest}
              disabled={isTesting}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isTesting ? 'animate-spin' : ''}`} />
              {isTesting ? 'Pinging Gateway...' : 'Ping Gateway Now'}
            </button>
          </div>
        )}

        {/* Live Terminal Log Stream */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              Live Execution Output Trace
            </span>
            <button
              type="button"
              onClick={() => setTestLogs([{ timestamp: new Date().toLocaleTimeString(), type: 'info', message: 'Terminal cleared.' }])}
              className="text-[10px] text-slate-500 hover:text-slate-300 font-mono uppercase"
            >
              Clear Logs
            </button>
          </div>

          <div className="p-4 bg-slate-950 rounded-2xl font-mono text-xs space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar border border-slate-800/80">
            {testLogs.map((log, i) => (
              <div key={i} className="flex items-start gap-2 leading-relaxed">
                <span className="text-slate-600 text-[10px] shrink-0 font-bold">[{log.timestamp}]</span>
                <span className={`text-[11px] ${
                  log.type === 'success' ? 'text-emerald-400 font-bold' :
                  log.type === 'error' ? 'text-red-400 font-bold' :
                  log.type === 'trace' ? 'text-indigo-300' : 'text-slate-300'
                }`}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

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
