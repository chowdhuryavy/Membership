import React, { useState } from 'react';
import { 
  WhatsAppAutomationRule, 
  WhatsAppTemplate, 
  WhatsAppTriggerEvent 
} from '../../types';
import { 
  Zap, 
  Plus, 
  Play, 
  Trash2, 
  Check, 
  Clock, 
  Tag, 
  FileText, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  SlidersHorizontal 
} from 'lucide-react';
import { format } from 'date-fns';

interface WhatsAppAutomationRulesTabProps {
  rules: WhatsAppAutomationRule[];
  templates: WhatsAppTemplate[];
  onToggleActive: (ruleId: string, isActive: boolean) => Promise<void>;
  onSaveRule: (rule: WhatsAppAutomationRule) => Promise<void>;
  onDeleteRule: (ruleId: string) => Promise<void>;
  onTestRule: (ruleId: string, testPhone: string, guestName?: string) => Promise<{ success: boolean; messageText?: string; error?: string }>;
  companyId: string;
  propertyId: string;
  outletId: string;
  outletName: string;
}

export const WhatsAppAutomationRulesTab: React.FC<WhatsAppAutomationRulesTabProps> = ({
  rules,
  templates,
  onToggleActive,
  onSaveRule,
  onDeleteRule,
  onTestRule,
  companyId,
  propertyId,
  outletId,
  outletName
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [testModalRule, setTestModalRule] = useState<WhatsAppAutomationRule | null>(null);
  const [testPhone, setTestPhone] = useState('+974 5512 8901');
  const [testGuestName, setTestGuestName] = useState('Sheikh Hamad Al-Thani');
  const [testResult, setTestResult] = useState<{ success: boolean; messageText?: string; error?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // New Rule Form State
  const [ruleName, setRuleName] = useState('');
  const [ruleDesc, setRuleDesc] = useState('');
  const [triggerEvent, setTriggerEvent] = useState<WhatsAppTriggerEvent>('on_member_created');
  const [actionType, setActionType] = useState<'send_template' | 'send_text'>('send_template');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [customText, setCustomText] = useState('');
  const [keywordCondition, setKeywordCondition] = useState('');
  const [daysBeforeExpiry, setDaysBeforeExpiry] = useState(7);
  const [vipOnly, setVipOnly] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;

    setIsSaving(true);
    try {
      const newRule: WhatsAppAutomationRule = {
        id: 'rule_' + Math.random().toString(36).substring(2, 11),
        company_id: companyId,
        property_id: propertyId,
        outlet_id: outletId,
        name: ruleName,
        description: ruleDesc,
        trigger_event: triggerEvent,
        conditions: {
          keyword: triggerEvent === 'on_keyword' ? keywordCondition : undefined,
          days_before_expiry: triggerEvent === 'on_expiring_membership' ? daysBeforeExpiry : undefined,
          only_vip: vipOnly
        },
        action_type: actionType,
        template_id: actionType === 'send_template' ? selectedTemplateId : undefined,
        action_payload: {
          text_message: actionType === 'send_text' ? customText : undefined,
          template_name: actionType === 'send_template' ? templates.find(t => t.id === selectedTemplateId)?.name : undefined
        },
        is_active: true,
        execution_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await onSaveRule(newRule);
      setIsAddModalOpen(false);
      // Reset
      setRuleName('');
      setRuleDesc('');
      setCustomText('');
      setKeywordCondition('');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunTest = async () => {
    if (!testModalRule || !testPhone.trim()) return;
    setIsTesting(true);
    try {
      const res = await onTestRule(testModalRule.id, testPhone, testGuestName);
      setTestResult(res);
    } finally {
      setIsTesting(false);
    }
  };

  const getEventBadge = (evt: WhatsAppTriggerEvent) => {
    switch (evt) {
      case 'on_member_created':
        return { label: 'New Member Enrollment', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'on_expiring_membership':
        return { label: 'Membership Expiry Alert', color: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'on_booking_confirmed':
        return { label: 'Treatment Booking Confirmation', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'on_checkin':
        return { label: 'Facility Check-In Greeting', color: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'on_keyword':
        return { label: 'Incoming Keyword Auto-Reply', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'on_inactivity':
        return { label: '30-Day Inactivity Follow-up', color: 'bg-slate-100 text-slate-700 border-slate-200' };
      default:
        return { label: evt, color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Zap className="w-4 h-4" />
            </span>
            <h2 className="text-base font-black text-slate-900 tracking-tight uppercase">
              Automated WhatsApp Workflows
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Configure instant WhatsApp triggers for new registrations, treatment bookings, renewal warnings, and automated keyword responses isolated to <span className="font-bold text-slate-800">{outletName}</span>.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/20 active:scale-95 transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Automation Rule
        </button>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rules.map((rule) => {
          const badge = getEventBadge(rule.trigger_event);
          return (
            <div
              key={rule.id}
              className={`bg-white rounded-3xl border p-5 shadow-sm flex flex-col justify-between transition-all ${
                rule.is_active ? 'border-slate-200/90' : 'border-slate-200/50 bg-slate-50/50 opacity-80'
              }`}
            >
              <div>
                {/* Top badges & Toggle */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${badge.color}`}>
                    {badge.label}
                  </span>

                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${rule.is_active ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {rule.is_active ? 'Active' : 'Paused'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onToggleActive(rule.id, !rule.is_active)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                        rule.is_active ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                    </button>
                  </div>
                </div>

                {/* Title & Desc */}
                <h3 className="text-sm font-black text-slate-900">{rule.name}</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{rule.description}</p>

                {/* Conditions / Action Details */}
                <div className="mt-4 p-3 bg-slate-50 rounded-2xl space-y-1.5 text-xs border border-slate-100">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="font-semibold text-slate-400 text-[10px] uppercase">Action:</span>
                    <span className="font-bold text-slate-800">
                      {rule.action_type === 'send_template'
                        ? `Send Meta Template (${rule.action_payload.template_name || 'Approved'})`
                        : 'Send Custom Text Message'}
                    </span>
                  </div>

                  {rule.conditions?.keyword && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-semibold text-slate-400 text-[10px] uppercase">Keywords:</span>
                      <span className="font-mono text-emerald-700 font-bold">{rule.conditions.keyword}</span>
                    </div>
                  )}

                  {rule.conditions?.days_before_expiry && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-semibold text-slate-400 text-[10px] uppercase">Trigger Timing:</span>
                      <span className="font-bold text-amber-700">{rule.conditions.days_before_expiry} Days Before Expiry</span>
                    </div>
                  )}

                  {rule.conditions?.only_vip && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-semibold text-slate-400 text-[10px] uppercase">Target:</span>
                      <span className="font-bold text-indigo-700">VIP Members Only</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Metrics & Actions */}
              <div className="flex items-center justify-between gap-2 mt-5 pt-4 border-t border-slate-100">
                <div className="text-[11px] text-slate-400 font-medium">
                  <span className="font-bold text-slate-700">{rule.execution_count}</span> times triggered
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setTestModalRule(rule);
                      setTestResult(null);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                  >
                    <Play className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                    Test Trigger
                  </button>

                  <button
                    onClick={() => onDeleteRule(rule.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    title="Delete Rule"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Rule Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-900">Create Automation Workflow</h3>
                  <p className="text-xs text-slate-500">Automate WhatsApp actions for {outletName}</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-4 mt-5">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Rule Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP Booking Confirmation Reminder"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Explains when and why this rule triggers"
                  value={ruleDesc}
                  onChange={(e) => setRuleDesc(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                />
              </div>

              {/* Trigger Event */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Trigger Event *
                </label>
                <select
                  value={triggerEvent}
                  onChange={(e) => setTriggerEvent(e.target.value as WhatsAppTriggerEvent)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                >
                  <option value="on_member_created">New Member Registered</option>
                  <option value="on_expiring_membership">Membership Expiring Soon</option>
                  <option value="on_booking_confirmed">Treatment / Massage Booking Confirmed</option>
                  <option value="on_checkin">Facility Reception Check-In</option>
                  <option value="on_keyword">Guest Incoming Keyword Message</option>
                  <option value="on_inactivity">30 Days Facility Inactivity</option>
                </select>
              </div>

              {/* Conditional parameters based on trigger */}
              {triggerEvent === 'on_keyword' && (
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Matching Keywords (comma-separated) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. hours, schedule, menu, price, spa"
                    value={keywordCondition}
                    onChange={(e) => setKeywordCondition(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold text-slate-900 outline-none"
                  />
                </div>
              )}

              {triggerEvent === 'on_expiring_membership' && (
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Days Prior to Expiry
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={daysBeforeExpiry}
                    onChange={(e) => setDaysBeforeExpiry(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 outline-none"
                  />
                </div>
              )}

              {/* Action Type */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActionType('send_template')}
                  className={`p-3 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all ${
                    actionType === 'send_template'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Send Meta Template
                </button>
                <button
                  type="button"
                  onClick={() => setActionType('send_text')}
                  className={`p-3 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all ${
                    actionType === 'send_text'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Send Custom Text
                </button>
              </div>

              {actionType === 'send_template' ? (
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Choose Approved Template *
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 outline-none"
                  >
                    <option value="" disabled>Select Meta Template...</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Custom Message Text *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Enter message to dispatch. You can use {{guest_name}} and {{outlet_name}}."
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 outline-none resize-none"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="vipOnly"
                  checked={vipOnly}
                  onChange={(e) => setVipOnly(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="vipOnly" className="text-xs text-slate-700 font-semibold cursor-pointer">
                  Limit this rule strictly to VIP Members
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Automation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Rule Simulation Modal */}
      {testModalRule && (
        <div className="fixed inset-0 z-[200] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <Play className="w-5 h-5 fill-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-900">Simulate Rule Trigger</h3>
                  <p className="text-xs text-slate-500">{testModalRule.name}</p>
                </div>
              </div>
              <button
                onClick={() => setTestModalRule(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Test Recipient Phone *
                </label>
                <input
                  type="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Sample Guest Name
                </label>
                <input
                  type="text"
                  value={testGuestName}
                  onChange={(e) => setTestGuestName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 outline-none"
                />
              </div>

              {testResult && (
                <div className={`p-4 rounded-2xl border text-xs ${
                  testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'
                }`}>
                  <div className="flex items-center gap-2 font-black uppercase tracking-wider text-[11px] mb-1">
                    {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
                    {testResult.success ? 'Simulation Succeeded' : 'Simulation Failed'}
                  </div>
                  <p className="mt-1 font-medium">{testResult.messageText || testResult.error}</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTestModalRule(null)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={isTesting}
                  onClick={handleRunTest}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {isTesting ? 'Executing...' : 'Run Simulation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
