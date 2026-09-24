import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth, isSuperAdminRole } from '../contexts/AuthContext';
import { 
  Company, 
  WhatsAppConfig, 
  WhatsAppConversation, 
  WhatsAppMessage, 
  WhatsAppAutomationRule, 
  WhatsAppTemplate 
} from '../types';
import { WhatsAppService, DEFAULT_COMPANIES } from '../services/whatsappService';
import { WhatsAppInboxTab } from '../components/whatsapp/WhatsAppInboxTab';
import { WhatsAppConversationsTab } from '../components/whatsapp/WhatsAppConversationsTab';
import { WhatsAppAutomationRulesTab } from '../components/whatsapp/WhatsAppAutomationRulesTab';
import { WhatsAppTemplatesTab } from '../components/whatsapp/WhatsAppTemplatesTab';
import { WhatsAppSettingsTab } from '../components/whatsapp/WhatsAppSettingsTab';
import { 
  MessageSquare, 
  Inbox, 
  Zap, 
  FileText, 
  Settings, 
  Loader2, 
  AlertCircle,
  Building2,
  Store,
  Sparkles,
  RefreshCw,
  Plus,
  ShieldCheck,
  Radio,
  CheckCircle2,
  PhoneCall,
  MapPin,
  Flame
} from 'lucide-react';
import toast from 'react-hot-toast';

export const WhatsAppAutomation: React.FC = () => {
  const { user } = useAuth();
  const { properties, outlets, userAllowedOutlets, currentProperty, currentOutlet } = useSettings();
  const isAdmin = isSuperAdminRole(user?.role_id);

  // Companies (Tenant Hierarchy Root)
  const [companies, setCompanies] = useState<Company[]>(DEFAULT_COMPANIES);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'inbox' | 'conversations' | 'rules' | 'templates' | 'settings'>('inbox');

  // Isolated Data State for Current Active Outlet
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [rules, setRules] = useState<WhatsAppAutomationRule[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  
  const [isLoadingScopeData, setIsLoadingScopeData] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // 1. Resolve Active Venue strictly from top navigation context
  const activeOutlet = useMemo(() => {
    if (currentOutlet) return currentOutlet;
    if (userAllowedOutlets && userAllowedOutlets.length > 0) return userAllowedOutlets[0];
    if (outlets && outlets.length > 0) return outlets[0];
    return null;
  }, [currentOutlet, userAllowedOutlets, outlets]);

  const activeProperty = useMemo(() => {
    if (currentProperty) return currentProperty;
    if (activeOutlet?.property_id) {
      return properties.find(p => p.id === activeOutlet.property_id) || null;
    }
    if (properties && properties.length > 0) return properties[0];
    return null;
  }, [currentProperty, activeOutlet, properties]);

  const activeCompany = useMemo(() => {
    return companies[0] || DEFAULT_COMPANIES[0];
  }, [companies]);

  // Load Companies list once
  useEffect(() => {
    WhatsAppService.getCompanies().then(comps => {
      if (comps && comps.length > 0) setCompanies(comps);
    });
  }, []);

  // 2. Load isolated data whenever active outlet or property changes from top navigation
  const loadScopeData = useCallback(async (cId: string, pId: string, oId: string, isSilent = false) => {
    if (!cId || !pId || !oId) return;

    if (!isSilent) setIsLoadingScopeData(true);
    else setIsRefreshing(true);

    try {
      const [cfg, convs, rls, tmpls] = await Promise.all([
        WhatsAppService.getConfig(cId, pId, oId),
        WhatsAppService.getConversations(cId, pId, oId),
        WhatsAppService.getAutomationRules(cId, pId, oId),
        WhatsAppService.getTemplates(cId, pId, oId)
      ]);

      setConfig(cfg);
      setConversations(convs);
      setRules(rls);
      setTemplates(tmpls);

      if (convs.length > 0) {
        // Keep active conversation if still present in list, otherwise select first
        setActiveConversationId(prev => {
          const exists = convs.some(c => c.id === prev);
          return exists && prev ? prev : convs[0].id;
        });
        const targetConvId = convs[0].id;
        const msgs = await WhatsAppService.getMessages(targetConvId, cId, pId, oId);
        setMessages(msgs);
      } else {
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('[WhatsAppAutomation] Error loading scope data:', err);
      toast.error('Failed to load WhatsApp data for active outlet');
    } finally {
      setIsLoadingScopeData(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (activeCompany?.id && activeProperty?.id && activeOutlet?.id) {
      loadScopeData(activeCompany.id, activeProperty.id, activeOutlet.id);
    }
  }, [activeCompany?.id, activeProperty?.id, activeOutlet?.id, loadScopeData]);

  const handleManualRefresh = () => {
    if (activeCompany?.id && activeProperty?.id && activeOutlet?.id) {
      loadScopeData(activeCompany.id, activeProperty.id, activeOutlet.id, true);
      toast.success('WhatsApp workspace synchronized', { icon: '🔄' });
    }
  };

  // Load messages when active conversation changes
  const handleSelectConversation = async (convId: string) => {
    setActiveConversationId(convId);
    if (!activeCompany?.id || !activeProperty?.id || !activeOutlet?.id) return;

    try {
      const msgs = await WhatsAppService.getMessages(
        convId, 
        activeCompany.id, 
        activeProperty.id, 
        activeOutlet.id
      );
      setMessages(msgs);
    } catch (e) {
      console.error('Error fetching conversation messages:', e);
    }
  };

  // Messaging & Workflow Handlers
  const handleSendMessage = async (text: string, templateId?: string) => {
    if (!activeConversationId || !activeCompany?.id || !activeProperty?.id || !activeOutlet?.id) return;
    setIsSendingMessage(true);
    try {
      const res = await WhatsAppService.sendMessage({
        conversationId: activeConversationId,
        companyId: activeCompany.id,
        propertyId: activeProperty.id,
        outletId: activeOutlet.id,
        messageText: text,
        senderName: user?.name || 'Staff Concierge',
        templateId
      });

      if (res.success && res.message) {
        setMessages(prev => [...prev, res.message!]);
        // Update conversation in list
        setConversations(prev => prev.map(c => {
          if (c.id === activeConversationId) {
            return {
              ...c,
              last_message: text,
              last_message_at: new Date().toISOString()
            };
          }
          return c;
        }));
      }
    } catch (e) {
      toast.error('Failed to send WhatsApp message');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleUpdateStatus = async (convId: string, status: 'open' | 'resolved') => {
    if (!activeCompany?.id || !activeProperty?.id || !activeOutlet?.id) return;
    const ok = await WhatsAppService.updateConversationStatus(
      convId, 
      status, 
      activeCompany.id, 
      activeProperty.id, 
      activeOutlet.id
    );
    if (ok) {
      setConversations(prev => prev.map(c => (c.id === convId ? { ...c, status } : c)));
      toast.success(`Conversation marked as ${status}`);
    }
  };

  const handleStartNewChat = async (name: string, phone: string, initialMessage: string, memberId?: string) => {
    if (!activeCompany?.id || !activeProperty?.id || !activeOutlet?.id) return;
    const newConv = await WhatsAppService.startConversation({
      companyId: activeCompany.id,
      propertyId: activeProperty.id,
      outletId: activeOutlet.id,
      contactName: name,
      contactPhone: phone,
      initialMessage,
      memberId
    });
    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
    setActiveTab('conversations');
    toast.success('WhatsApp conversation initiated!');
  };

  const handleToggleRule = async (ruleId: string, isActive: boolean) => {
    if (!activeCompany?.id || !activeProperty?.id || !activeOutlet?.id) return;
    const ok = await WhatsAppService.toggleRuleActive(
      ruleId, 
      isActive, 
      activeCompany.id, 
      activeProperty.id, 
      activeOutlet.id
    );
    if (ok) {
      setRules(prev => prev.map(r => (r.id === ruleId ? { ...r, is_active: isActive } : r)));
      toast.success(isActive ? 'Rule activated' : 'Rule paused');
    }
  };

  const handleSaveRule = async (rule: WhatsAppAutomationRule) => {
    const res = await WhatsAppService.saveAutomationRule(rule);
    if (res.success) {
      setRules(prev => {
        const idx = prev.findIndex(r => r.id === rule.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = rule;
          return next;
        }
        return [rule, ...prev];
      });
      toast.success('Automation rule saved');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!activeCompany?.id || !activeProperty?.id || !activeOutlet?.id) return;
    const ok = await WhatsAppService.deleteAutomationRule(
      ruleId, 
      activeCompany.id, 
      activeProperty.id, 
      activeOutlet.id
    );
    if (ok) {
      setRules(prev => prev.filter(r => r.id !== ruleId));
      toast.success('Rule deleted');
    }
  };

  const handleTestRule = async (ruleId: string, testPhone: string, guestName?: string) => {
    if (!activeCompany?.id || !activeProperty?.id || !activeOutlet?.id) {
      return { success: false, error: 'No active outlet' };
    }
    return WhatsAppService.testRuleTrigger({
      ruleId,
      companyId: activeCompany.id,
      propertyId: activeProperty.id,
      outletId: activeOutlet.id,
      testPhone,
      guestName
    });
  };

  const handleSaveTemplate = async (tmpl: WhatsAppTemplate) => {
    const res = await WhatsAppService.saveTemplate(tmpl);
    if (res.success) {
      setTemplates(prev => {
        const idx = prev.findIndex(t => t.id === tmpl.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = tmpl;
          return next;
        }
        return [tmpl, ...prev];
      });
      toast.success('WhatsApp template saved');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!activeCompany?.id || !activeProperty?.id || !activeOutlet?.id) return;
    const ok = await WhatsAppService.deleteTemplate(
      templateId, 
      activeCompany.id, 
      activeProperty.id, 
      activeOutlet.id
    );
    if (ok) {
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      toast.success('Template deleted');
    }
  };

  const handleSaveConfig = async (updated: Partial<WhatsAppConfig>, newAccessToken?: string) => {
    if (!activeCompany?.id || !activeProperty?.id || !activeOutlet?.id) return;
    const res = await WhatsAppService.saveConfig(
      activeCompany.id, 
      activeProperty.id, 
      activeOutlet.id, 
      updated, 
      newAccessToken
    );
    if (res.success) {
      const refreshed = await WhatsAppService.getConfig(
        activeCompany.id, 
        activeProperty.id, 
        activeOutlet.id
      );
      setConfig(refreshed);
    }
  };

  const handleTestConnection = async () => {
    if (!activeCompany?.id || !activeProperty?.id || !activeOutlet?.id) {
      return { success: false, error: 'No active outlet context' };
    }
    return WhatsAppService.testConnection(
      activeCompany.id, 
      activeProperty.id, 
      activeOutlet.id
    );
  };

  // Metrics
  const unreadTotal = useMemo(() => {
    return conversations.reduce((acc, c) => acc + (c.unread_count > 0 ? 1 : 0), 0);
  }, [conversations]);

  const activeRulesTotal = useMemo(() => {
    return rules.filter(r => r.is_active).length;
  }, [rules]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-14">
      {/* 1. Header Banner & Active Top Venue Context Indicator */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-6 md:p-8 text-white shadow-2xl border border-slate-700/50">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Title & Brand */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center font-black text-white shadow-lg shadow-emerald-500/30">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white">
                    WhatsApp Automation Hub
                  </h1>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Meta Cloud API
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium">
                  Two-Way Guest Concierge, Expiration Alerts, POS Triggers & Official HSM Templates
                </p>
              </div>
            </div>
          </div>

          {/* Active Context Indicators (Bound to Global Top Changer) */}
          <div className="flex flex-wrap items-center gap-2.5 bg-slate-800/80 backdrop-blur-md p-2 rounded-2xl border border-slate-700/60 shadow-inner">
            {/* Property Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 text-xs font-bold text-slate-200 border border-slate-700">
              <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="text-slate-400 text-[10px] uppercase font-black">Property:</span>
              <span className="text-white uppercase tracking-tight truncate max-w-[140px]">
                {activeProperty?.name || 'Primary Portfolio'}
              </span>
            </div>

            {/* Outlet Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/70 text-xs font-bold text-emerald-300 border border-emerald-700/40">
              <Store className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-emerald-400/80 text-[10px] uppercase font-black">Outlet:</span>
              <span className="text-emerald-100 font-black uppercase tracking-tight truncate max-w-[150px]">
                {activeOutlet?.name || 'Default Facility'}
              </span>
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing || isLoadingScopeData}
              title="Sync latest WhatsApp messages & rules"
              className="p-2 rounded-xl bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Dynamic Context Banner Sub-bar */}
        <div className="mt-6 pt-4 border-t border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>
              Operating in isolated tenant context for <strong>{activeOutlet?.name || 'Active Venue'}</strong>. Data updates automatically when you switch outlets at the top bar.
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold text-slate-400">
              Status: <span className="text-emerald-400">{config?.is_active ? '● Live API Gateway' : '⚡ Sandbox Active'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* If No Active Outlet Available */}
      {!activeOutlet ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-200/80 p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-100">
            <Store className="w-8 h-8" />
          </div>
          <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
            No Active Outlet Selected
          </h3>
          <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto">
            Please use the outlet selector at the top of your screen to choose a facility. Your assigned WhatsApp conversations and automation workflows will load automatically.
          </p>
        </div>
      ) : isLoadingScopeData ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-200/80 p-16 text-center shadow-sm">
          <Loader2 className="w-9 h-9 animate-spin text-emerald-600 mx-auto mb-3.5" />
          <p className="text-sm font-black text-slate-800 uppercase tracking-wider">
            Loading WhatsApp Workspace
          </p>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Retrieving isolated guest conversations and triggers for {activeOutlet.name}...
          </p>
        </div>
      ) : (
        <>
          {/* 2. Key Metrics Bar (High-Impact Luxury Style) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200/70 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Guest Inquiries</span>
                <span className="w-7 h-7 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                  <Inbox className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">{conversations.length}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                {conversations.filter(c => c.status === 'open').length} Open Threads
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/70 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unread Messages</span>
                <span className={`w-7 h-7 rounded-xl flex items-center justify-center ${unreadTotal > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  <MessageSquare className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-2xl font-black text-emerald-600 mt-2">{unreadTotal}</div>
              <div className="text-[10px] font-bold text-emerald-700/80 uppercase tracking-wider mt-0.5">
                {unreadTotal > 0 ? 'Requires Staff Attention' : 'All Inquiries Addressed'}
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/70 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Automations</span>
                <span className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">{activeRulesTotal}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                {rules.length} Configured Triggers
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/70 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">HSM Templates</span>
                <span className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">{templates.length}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                Meta Verified Templates
              </div>
            </div>
          </div>

          {/* 3. Primary Segmented Navigation Tabs */}
          <div className="bg-slate-100/90 p-1.5 rounded-3xl flex items-center gap-1.5 overflow-x-auto border border-slate-200/70 shadow-inner">
            <button
              onClick={() => setActiveTab('inbox')}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'inbox'
                  ? 'bg-white text-emerald-700 shadow-md scale-[1.01]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Inbox className="w-4 h-4" />
              Smart Inbox
              {unreadTotal > 0 && (
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black shadow-xs">
                  {unreadTotal}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('conversations')}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'conversations'
                  ? 'bg-white text-emerald-700 shadow-md scale-[1.01]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Live Chat Console
            </button>

            <button
              onClick={() => setActiveTab('rules')}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'rules'
                  ? 'bg-white text-emerald-700 shadow-md scale-[1.01]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-500" />
              Auto Triggers
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
                {activeRulesTotal}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('templates')}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'templates'
                  ? 'bg-white text-emerald-700 shadow-md scale-[1.01]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <FileText className="w-4 h-4" />
              HSM Templates
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
                {templates.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-white text-emerald-700 shadow-md scale-[1.01]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Settings className="w-4 h-4" />
              API Gateway
              <span className={`w-2 h-2 rounded-full ${config?.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            </button>
          </div>

          {/* 4. Tab Contents */}
          <div className="pt-2 animate-in fade-in-50 duration-300">
            {activeTab === 'inbox' && (
              <WhatsAppInboxTab
                conversations={conversations}
                templates={templates}
                onOpenConversation={(id) => {
                  setActiveConversationId(id);
                  setActiveTab('conversations');
                }}
                onStartNewChat={handleStartNewChat}
                isLoading={isLoadingScopeData}
                outletName={activeOutlet.name}
              />
            )}

            {activeTab === 'conversations' && (
              <WhatsAppConversationsTab
                conversations={conversations}
                activeConversationId={activeConversationId}
                onSelectConversation={handleSelectConversation}
                messages={messages}
                templates={templates}
                onSendMessage={handleSendMessage}
                onUpdateStatus={handleUpdateStatus}
                outletName={activeOutlet.name}
                propertyName={activeProperty?.name || 'Property'}
                companyName={activeCompany.name}
                isSending={isSendingMessage}
              />
            )}

            {activeTab === 'rules' && (
              <WhatsAppAutomationRulesTab
                rules={rules}
                templates={templates}
                onToggleActive={handleToggleRule}
                onSaveRule={handleSaveRule}
                onDeleteRule={handleDeleteRule}
                onTestRule={handleTestRule}
                companyId={activeCompany.id}
                propertyId={activeProperty?.id || 'prop-1'}
                outletId={activeOutlet.id}
                outletName={activeOutlet.name}
              />
            )}

            {activeTab === 'templates' && (
              <WhatsAppTemplatesTab
                templates={templates}
                onSaveTemplate={handleSaveTemplate}
                onDeleteTemplate={handleDeleteTemplate}
                companyId={activeCompany.id}
                propertyId={activeProperty?.id || 'prop-1'}
                outletId={activeOutlet.id}
                outletName={activeOutlet.name}
              />
            )}

            {activeTab === 'settings' && config && (
              <WhatsAppSettingsTab
                config={config}
                onSaveConfig={handleSaveConfig}
                onTestConnection={handleTestConnection}
                companyId={activeCompany.id}
                propertyId={activeProperty?.id || 'prop-1'}
                outletId={activeOutlet.id}
                outletName={activeOutlet.name}
                propertyName={activeProperty?.name || 'Property'}
                companyName={activeCompany.name}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default WhatsAppAutomation;
