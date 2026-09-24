import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Company, 
  WhatsAppConversation, 
  WhatsAppMessage, 
  WhatsAppTemplate,
  Outlet
} from '../types';
import { WhatsAppService, DEFAULT_COMPANIES } from '../services/whatsappService';
import { WhatsAppInboxTab } from '../components/whatsapp/WhatsAppInboxTab';
import { WhatsAppConversationsTab } from '../components/whatsapp/WhatsAppConversationsTab';
import { WhatsAppIcon } from '../components/WhatsAppIcon';
import { 
  MessageSquare, 
  Inbox, 
  Loader2, 
  Building2,
  Store,
  RefreshCw,
  Plus,
  ChevronRight,
  Sparkles,
  ChevronsUpDown,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';

export const WhatsAppAutomation: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { properties, outlets, userAllowedOutlets, currentProperty, currentOutlet, setCurrentOutlet } = useSettings();

  // Companies (Tenant Hierarchy Root)
  const [companies, setCompanies] = useState<Company[]>(DEFAULT_COMPANIES);

  // Active Tab (Daily Operational Messenger Tabs)
  const [activeTab, setActiveTab] = useState<'inbox' | 'conversations'>('inbox');

  // Isolated Data State for Current Active Outlet
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  
  const [isLoadingScopeData, setIsLoadingScopeData] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isOutletSelectorOpen, setIsOutletSelectorOpen] = useState(false);

  // 1. Resolve Active Venue strictly from navigation context
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

  // Sender Name is strictly the Outlet Name and Property Name (e.g. "Main Gym • Grand Hotel")
  const senderIdentityName = useMemo(() => {
    if (!activeOutlet) return 'Staff Concierge';
    const propName = activeProperty?.name ? ` • ${activeProperty.name}` : '';
    return `${activeOutlet.name}${propName}`;
  }, [activeOutlet, activeProperty]);

  // Load Companies list once
  useEffect(() => {
    WhatsAppService.getCompanies().then(comps => {
      if (comps && comps.length > 0) setCompanies(comps);
    });
  }, []);

  // 2. Load isolated operational data whenever active outlet or property changes
  const loadScopeData = useCallback(async (
    cId: string, 
    pId: string, 
    oId: string, 
    oName?: string, 
    pName?: string,
    isSilent = false
  ) => {
    if (!cId || !pId || !oId) return;

    if (!isSilent) setIsLoadingScopeData(true);
    else setIsRefreshing(true);

    try {
      const [convs, tmpls] = await Promise.all([
        WhatsAppService.getConversations(cId, pId, oId, undefined, oName, pName),
        WhatsAppService.getTemplates(cId, pId, oId)
      ]);

      setConversations(convs);
      setTemplates(tmpls);

      if (convs.length > 0) {
        const targetConvId = convs[0].id;
        setActiveConversationId(targetConvId);
        const msgs = await WhatsAppService.getMessages(targetConvId, cId, pId, oId, oName, pName);
        setMessages(msgs);
      } else {
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('[WhatsAppAutomation] Error loading scope data:', err);
      toast.error('Failed to load WhatsApp messages for active outlet');
    } finally {
      setIsLoadingScopeData(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (activeCompany?.id && activeProperty?.id && activeOutlet?.id) {
      loadScopeData(
        activeCompany.id, 
        activeProperty.id, 
        activeOutlet.id, 
        activeOutlet.name, 
        activeProperty.name
      );
    }
  }, [activeCompany?.id, activeProperty?.id, activeOutlet?.id, activeOutlet?.name, activeProperty?.name, loadScopeData]);

  const handleManualRefresh = () => {
    if (activeCompany?.id && activeProperty?.id && activeOutlet?.id) {
      loadScopeData(
        activeCompany.id, 
        activeProperty.id, 
        activeOutlet.id, 
        activeOutlet.name, 
        activeProperty.name, 
        true
      );
      toast.success(`Synchronized messages for ${activeOutlet.name}`, { icon: '🔄' });
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
        activeOutlet.id,
        activeOutlet.name,
        activeProperty.name
      );
      setMessages(msgs);
    } catch (e) {
      console.error('Error fetching conversation messages:', e);
    }
  };

  // Messaging Handlers - senderName strictly uses Outlet Name and Property Name
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
        senderName: senderIdentityName,
        templateId
      });

      if (res.success && res.message) {
        setMessages(prev => [...prev, res.message!]);
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
      memberId,
      senderName: senderIdentityName
    });
    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
    setActiveTab('conversations');
    toast.success('WhatsApp conversation initiated!');
  };

  // Metrics
  const unreadTotal = useMemo(() => {
    return conversations.reduce((acc, c) => acc + (c.unread_count > 0 ? 1 : 0), 0);
  }, [conversations]);

  const availableOutlets = userAllowedOutlets && userAllowedOutlets.length > 0 ? userAllowedOutlets : outlets;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-14">
      {/* Top Header with Context Badges */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-lg shadow-emerald-600/20">
            <WhatsAppIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight uppercase">
                WhatsApp Smart Messenger
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                Live Concierge
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Isolated guest messages and automated concierge for <span className="font-bold text-slate-800">{activeOutlet?.name || 'Active Outlet'}</span> ({activeProperty?.name || 'Property'})
            </p>
          </div>
        </div>

        {/* Action Controls & Facility Switcher */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Quick Outlet Switcher */}
          <div className="relative">
            <button
              onClick={() => setIsOutletSelectorOpen(!isOutletSelectorOpen)}
              className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-800 border border-slate-200/80 transition-all cursor-pointer"
            >
              <Store className="w-4 h-4 text-emerald-700 shrink-0" />
              <div className="text-left">
                <span className="block text-[9px] uppercase tracking-wider text-slate-400 leading-none">
                  {activeProperty?.name || 'Property'}
                </span>
                <span className="text-xs font-black text-slate-900 leading-tight">
                  {activeOutlet?.name || 'Select Outlet'}
                </span>
              </div>
              <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {isOutletSelectorOpen && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  Switch Facility Scope
                </div>
                <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-0.5 pt-1">
                  {availableOutlets.map((o) => {
                    const isCurrent = o.id === activeOutlet?.id;
                    const prop = properties.find(p => p.id === o.property_id);
                    return (
                      <button
                        key={o.id}
                        onClick={() => {
                          setCurrentOutlet(o);
                          setIsOutletSelectorOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="truncate font-black">{o.name}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{prop?.name || 'Facility'}</div>
                        </div>
                        {isCurrent && <Check className="w-4 h-4 text-emerald-700 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing || isLoadingScopeData}
            title="Sync latest WhatsApp messages"
            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-700' : ''}`} />
          </button>
        </div>
      </div>

      {/* If No Active Outlet Available */}
      {!activeOutlet ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto mb-4 border border-amber-200/60">
            <Store className="w-8 h-8" />
          </div>
          <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
            No Active Outlet Selected
          </h3>
          <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto">
            Please select a facility outlet at the top navigation bar to load your isolated WhatsApp messages and guest conversations.
          </p>
        </div>
      ) : isLoadingScopeData ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-200/80 p-16 text-center shadow-xs">
          <Loader2 className="w-9 h-9 animate-spin text-emerald-700 mx-auto mb-3.5" />
          <p className="text-sm font-black text-slate-800 uppercase tracking-wider">
            Loading Guest Messenger
          </p>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Retrieving isolated guest inbox for {activeOutlet.name}...
          </p>
        </div>
      ) : (
        <>
          {/* Day-to-Day Communication Navigation Tabs */}
          <div className="bg-slate-100/90 p-1.5 rounded-3xl flex items-center gap-1.5 border border-slate-200/70 shadow-inner w-fit">
            <button
              onClick={() => setActiveTab('inbox')}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'inbox'
                  ? 'bg-white text-emerald-800 shadow-md scale-[1.01]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Inbox className="w-4 h-4" />
              Smart Inbox
              {unreadTotal > 0 && (
                <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px] font-black shadow-xs">
                  {unreadTotal}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('conversations')}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'conversations'
                  ? 'bg-white text-emerald-800 shadow-md scale-[1.01]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Live Chat Console
            </button>
          </div>

          {/* Operational Views */}
          <div className="pt-2 animate-in fade-in-50 duration-300">
            {activeTab === 'inbox' && (
              <WhatsAppInboxTab
                conversations={conversations}
                templates={templates}
                activeConversationId={activeConversationId}
                onSelectConversation={handleSelectConversation}
                onOpenConversation={(id) => {
                  setActiveConversationId(id);
                  setActiveTab('conversations');
                }}
                onStartNewChat={handleStartNewChat}
                onSendMessage={handleSendMessage}
                onUpdateStatus={handleUpdateStatus}
                isLoading={isLoadingScopeData}
                outletName={activeOutlet.name}
                propertyName={activeProperty?.name || 'Property'}
                isSending={isSendingMessage}
                messages={messages}
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
          </div>
        </>
      )}
    </div>
  );
};

export default WhatsAppAutomation;
