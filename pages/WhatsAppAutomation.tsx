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
import { HierarchySelector } from '../components/whatsapp/HierarchySelector';
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
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';

export const WhatsAppAutomation: React.FC = () => {
  const { user } = useAuth();
  const { properties, outlets, currentProperty, currentOutlet } = useSettings();
  const isAdmin = isSuperAdminRole(user?.role_id);

  // Companies & Hierarchy Selection
  const [companies, setCompanies] = useState<Company[]>(DEFAULT_COMPANIES);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(DEFAULT_COMPANIES[0].id);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [selectedOutletId, setSelectedOutletId] = useState<string>('');

  // Active Tab
  const [activeTab, setActiveTab] = useState<'inbox' | 'conversations' | 'rules' | 'templates' | 'settings'>('inbox');

  // Isolated Data State for Current Selection
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [rules, setRules] = useState<WhatsAppAutomationRule[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  
  const [isLoadingScopeData, setIsLoadingScopeData] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Initialize hierarchy selection from current context
  useEffect(() => {
    WhatsAppService.getCompanies().then(comps => {
      setCompanies(comps);
      if (comps.length > 0 && !selectedCompanyId) {
        setSelectedCompanyId(comps[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (currentProperty && !selectedPropertyId) {
      setSelectedPropertyId(currentProperty.id);
    } else if (properties.length > 0 && !selectedPropertyId) {
      setSelectedPropertyId(properties[0].id);
    }
  }, [currentProperty, properties, selectedPropertyId]);

  useEffect(() => {
    if (currentOutlet && selectedPropertyId === currentOutlet.property_id && !selectedOutletId) {
      setSelectedOutletId(currentOutlet.id);
    } else if (selectedPropertyId && !selectedOutletId) {
      const allowed = outlets.filter(o => o.property_id === selectedPropertyId);
      if (allowed.length > 0) {
        setSelectedOutletId(allowed[0].id);
      }
    }
  }, [currentOutlet, selectedPropertyId, outlets, selectedOutletId]);

  // Load isolated data whenever Company, Property, or Outlet selection changes
  const loadScopeData = useCallback(async (cId: string, pId: string, oId: string) => {
    if (!cId || !pId || !oId) return;

    setIsLoadingScopeData(true);
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
        setActiveConversationId(convs[0].id);
        const msgs = await WhatsAppService.getMessages(convs[0].id, cId, pId, oId);
        setMessages(msgs);
      } else {
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('[WhatsAppAutomation] Error loading scope data:', err);
      toast.error('Failed to load WhatsApp data for selected outlet');
    } finally {
      setIsLoadingScopeData(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCompanyId && selectedPropertyId && selectedOutletId) {
      loadScopeData(selectedCompanyId, selectedPropertyId, selectedOutletId);
    }
  }, [selectedCompanyId, selectedPropertyId, selectedOutletId, loadScopeData]);

  // Load messages when active conversation changes
  const handleSelectConversation = async (convId: string) => {
    setActiveConversationId(convId);
    if (!selectedCompanyId || !selectedPropertyId || !selectedOutletId) return;

    try {
      const msgs = await WhatsAppService.getMessages(
        convId, 
        selectedCompanyId, 
        selectedPropertyId, 
        selectedOutletId
      );
      setMessages(msgs);
    } catch (e) {
      console.error('Error fetching conversation messages:', e);
    }
  };

  // Hierarchy Handlers
  const handleSelectCompany = (cId: string) => {
    setSelectedCompanyId(cId);
  };

  const handleSelectProperty = (pId: string) => {
    setSelectedPropertyId(pId);
    // Cascade reset outlet
    const propOutlets = outlets.filter(o => o.property_id === pId);
    if (propOutlets.length > 0) {
      setSelectedOutletId(propOutlets[0].id);
    } else {
      setSelectedOutletId('');
    }
  };

  const handleSelectOutlet = (oId: string) => {
    setSelectedOutletId(oId);
  };

  // Messaging & Workflow Handlers
  const handleSendMessage = async (text: string, templateId?: string) => {
    if (!activeConversationId || !selectedCompanyId || !selectedPropertyId || !selectedOutletId) return;
    setIsSendingMessage(true);
    try {
      const res = await WhatsAppService.sendMessage({
        conversationId: activeConversationId,
        companyId: selectedCompanyId,
        propertyId: selectedPropertyId,
        outletId: selectedOutletId,
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
    if (!selectedCompanyId || !selectedPropertyId || !selectedOutletId) return;
    const ok = await WhatsAppService.updateConversationStatus(
      convId, 
      status, 
      selectedCompanyId, 
      selectedPropertyId, 
      selectedOutletId
    );
    if (ok) {
      setConversations(prev => prev.map(c => (c.id === convId ? { ...c, status } : c)));
      toast.success(`Conversation marked as ${status}`);
    }
  };

  const handleStartNewChat = async (name: string, phone: string, initialMessage: string, memberId?: string) => {
    if (!selectedCompanyId || !selectedPropertyId || !selectedOutletId) return;
    const newConv = await WhatsAppService.startConversation({
      companyId: selectedCompanyId,
      propertyId: selectedPropertyId,
      outletId: selectedOutletId,
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
    if (!selectedCompanyId || !selectedPropertyId || !selectedOutletId) return;
    const ok = await WhatsAppService.toggleRuleActive(
      ruleId, 
      isActive, 
      selectedCompanyId, 
      selectedPropertyId, 
      selectedOutletId
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
    if (!selectedCompanyId || !selectedPropertyId || !selectedOutletId) return;
    const ok = await WhatsAppService.deleteAutomationRule(
      ruleId, 
      selectedCompanyId, 
      selectedPropertyId, 
      selectedOutletId
    );
    if (ok) {
      setRules(prev => prev.filter(r => r.id !== ruleId));
      toast.success('Rule deleted');
    }
  };

  const handleTestRule = async (ruleId: string, testPhone: string, guestName?: string) => {
    return WhatsAppService.testRuleTrigger({
      ruleId,
      companyId: selectedCompanyId,
      propertyId: selectedPropertyId,
      outletId: selectedOutletId,
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
    if (!selectedCompanyId || !selectedPropertyId || !selectedOutletId) return;
    const ok = await WhatsAppService.deleteTemplate(
      templateId, 
      selectedCompanyId, 
      selectedPropertyId, 
      selectedOutletId
    );
    if (ok) {
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      toast.success('Template deleted');
    }
  };

  const handleSaveConfig = async (updated: Partial<WhatsAppConfig>, newAccessToken?: string) => {
    if (!selectedCompanyId || !selectedPropertyId || !selectedOutletId) return;
    const res = await WhatsAppService.saveConfig(
      selectedCompanyId, 
      selectedPropertyId, 
      selectedOutletId, 
      updated, 
      newAccessToken
    );
    if (res.success) {
      const refreshed = await WhatsAppService.getConfig(
        selectedCompanyId, 
        selectedPropertyId, 
        selectedOutletId
      );
      setConfig(refreshed);
    }
  };

  const handleTestConnection = async () => {
    return WhatsAppService.testConnection(
      selectedCompanyId, 
      selectedPropertyId, 
      selectedOutletId
    );
  };

  const currentPropertyObj = properties.find(p => p.id === selectedPropertyId);
  const currentOutletObj = outlets.find(o => o.id === selectedOutletId);
  const currentCompanyObj = companies.find(c => c.id === selectedCompanyId) || companies[0];

  const unreadTotal = useMemo(() => {
    return conversations.reduce((acc, c) => acc + (c.unread_count > 0 ? 1 : 0), 0);
  }, [conversations]);

  const activeRulesTotal = useMemo(() => {
    return rules.filter(r => r.is_active).length;
  }, [rules]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-lg shadow-emerald-600/20">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight uppercase">
                WhatsApp Automation & Hub
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Multi-Tenant Guest Engagement, Triggers, Templates & Cloud API Messenger
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 1. Mandatory Hierarchy Scope Selector: Company → Property → Outlet */}
      <HierarchySelector
        companies={companies}
        properties={properties}
        outlets={outlets}
        selectedCompanyId={selectedCompanyId}
        selectedPropertyId={selectedPropertyId}
        selectedOutletId={selectedOutletId}
        onSelectCompany={handleSelectCompany}
        onSelectProperty={handleSelectProperty}
        onSelectOutlet={handleSelectOutlet}
        isConnected={!!config?.is_active}
      />

      {/* If No Outlet Selected Yet: Prompt Guide */}
      {!selectedOutletId ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
            <Store className="w-8 h-8" />
          </div>
          <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
            Please Select a Property &amp; Outlet
          </h3>
          <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto">
            To enforce tenant isolation and ensure zero cross-property data leakage, select an outlet above to access its private WhatsApp conversations, automation rules, and API settings.
          </p>
        </div>
      ) : isLoadingScopeData ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-16 text-center shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
            Loading isolated WhatsApp workspace for {currentOutletObj?.name}...
          </p>
        </div>
      ) : (
        <>
          {/* 2. Primary Tab Navigation (Clean & Modern 5 Sections) */}
          <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200/80 pb-px">
            <button
              onClick={() => setActiveTab('inbox')}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
                activeTab === 'inbox'
                  ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-2xl shadow-xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Inbox className="w-4 h-4" />
              Inbox
              {unreadTotal > 0 && (
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                  {unreadTotal}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('conversations')}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
                activeTab === 'conversations'
                  ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-2xl shadow-xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Conversations
            </button>

            <button
              onClick={() => setActiveTab('rules')}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
                activeTab === 'rules'
                  ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-2xl shadow-xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-500" />
              Automation Rules
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {activeRulesTotal} Active
              </span>
            </button>

            <button
              onClick={() => setActiveTab('templates')}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
                activeTab === 'templates'
                  ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-2xl shadow-xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              Templates ({templates.length})
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-2xl shadow-xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Settings className="w-4 h-4" />
              API Settings
              <span className={`w-2 h-2 rounded-full ${config?.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            </button>
          </div>

          {/* 3. Tab Contents */}
          <div className="pt-2">
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
                outletName={currentOutletObj?.name || 'Selected Outlet'}
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
                outletName={currentOutletObj?.name || 'Selected Outlet'}
                propertyName={currentPropertyObj?.name || 'Property'}
                companyName={currentCompanyObj?.name || 'Company'}
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
                companyId={selectedCompanyId}
                propertyId={selectedPropertyId}
                outletId={selectedOutletId}
                outletName={currentOutletObj?.name || 'Selected Outlet'}
              />
            )}

            {activeTab === 'templates' && (
              <WhatsAppTemplatesTab
                templates={templates}
                onSaveTemplate={handleSaveTemplate}
                onDeleteTemplate={handleDeleteTemplate}
                companyId={selectedCompanyId}
                propertyId={selectedPropertyId}
                outletId={selectedOutletId}
                outletName={currentOutletObj?.name || 'Selected Outlet'}
              />
            )}

            {activeTab === 'settings' && config && (
              <WhatsAppSettingsTab
                config={config}
                onSaveConfig={handleSaveConfig}
                onTestConnection={handleTestConnection}
                companyId={selectedCompanyId}
                propertyId={selectedPropertyId}
                outletId={selectedOutletId}
                outletName={currentOutletObj?.name || 'Selected Outlet'}
                propertyName={currentPropertyObj?.name || 'Property'}
                companyName={currentCompanyObj?.name || 'Company'}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default WhatsAppAutomation;
