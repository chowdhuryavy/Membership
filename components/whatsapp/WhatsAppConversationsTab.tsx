import React, { useState, useEffect, useRef, useMemo } from 'react';
import { WhatsAppConversation, WhatsAppMessage, WhatsAppTemplate } from '../../types';
import { 
  Search, 
  Send, 
  Check, 
  CheckCheck, 
  Phone, 
  User, 
  Tag, 
  Clock, 
  FileText, 
  Sparkles, 
  Paperclip, 
  Smile, 
  ChevronRight, 
  CheckCircle2, 
  RotateCcw, 
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Building2,
  Info
} from 'lucide-react';
import { format } from 'date-fns';

interface WhatsAppConversationsTabProps {
  conversations: WhatsAppConversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  messages: WhatsAppMessage[];
  templates: WhatsAppTemplate[];
  onSendMessage: (text: string, templateId?: string) => Promise<void>;
  onUpdateStatus: (id: string, status: 'open' | 'resolved') => Promise<void>;
  outletName: string;
  propertyName: string;
  companyName: string;
  isSending: boolean;
}

export const WhatsAppConversationsTab: React.FC<WhatsAppConversationsTabProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  messages,
  templates,
  onSendMessage,
  onUpdateStatus,
  outletName,
  propertyName,
  companyName,
  isSending
}) => {
  const [inputText, setInputText] = useState('');
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [showRightDrawer, setShowRightDrawer] = useState(true);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-select first conversation if none selected
  useEffect(() => {
    if (!activeConversationId && conversations.length > 0) {
      onSelectConversation(conversations[0].id);
    }
  }, [activeConversationId, conversations, onSelectConversation]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeConversation = useMemo(() => {
    return conversations.find(c => c.id === activeConversationId);
  }, [conversations, activeConversationId]);

  const filteredConversations = useMemo(() => {
    if (!sidebarSearch.trim()) return conversations;
    const q = sidebarSearch.toLowerCase();
    return conversations.filter(
      c => c.contact_name.toLowerCase().includes(q) || c.contact_phone.includes(q)
    );
  }, [conversations, sidebarSearch]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isSending) return;
    const text = inputText;
    setInputText('');
    await onSendMessage(text);
  };

  const handleApplyTemplate = (tmpl: WhatsAppTemplate) => {
    const guestName = activeConversation?.contact_name || 'Valued Guest';
    let body = tmpl.body_text.replace(/\{\{1\}\}/g, guestName);
    body = body.replace(/\{\{2\}\}/g, activeConversation?.member_id || '101');
    body = body.replace(/\{\{3\}\}/g, outletName);
    setInputText(body);
    setShowTemplateDropdown(false);
  };

  const quickSnippets = [
    `Welcome to ${outletName}! How may our concierge team assist you today?`,
    `Your appointment has been confirmed. We look forward to welcoming you!`,
    `Our facilities and thermal suites operate daily from 08:00 AM to 10:00 PM.`
  ];

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col md:flex-row h-[780px]">
      {/* 1. Left Sidebar: Chat List */}
      <div className="w-full md:w-80 lg:w-96 border-r border-slate-100 flex flex-col shrink-0 bg-slate-50/50">
        <div className="p-4 border-b border-slate-100 bg-white">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search chats..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No conversations found for {outletName}.
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = conv.id === activeConversationId;
              return (
                <div
                  key={conv.id}
                  onClick={() => onSelectConversation(conv.id)}
                  className={`p-3.5 flex items-center gap-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-emerald-50/70 border-l-4 border-emerald-600'
                      : 'hover:bg-slate-100/60'
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-2xl bg-slate-800 text-white flex items-center justify-center font-black text-xs shadow-sm">
                      {conv.avatar_url ? (
                        <img src={conv.avatar_url} alt="" className="w-full h-full object-cover rounded-2xl" />
                      ) : (
                        conv.contact_name.charAt(0).toUpperCase()
                      )}
                    </div>
                    {conv.unread_count > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[9px] font-black">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-900 truncate">
                        {conv.contact_name}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {format(new Date(conv.last_message_at), 'HH:mm')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {conv.last_message}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        conv.status === 'open' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {conv.status}
                      </span>
                      {conv.tags.slice(0, 1).map(t => (
                        <span key={t} className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Center: Chat Conversation Pane */}
      {activeConversation ? (
        <div className="flex-1 flex flex-col h-full min-w-0 bg-[#efeae2]/40 relative">
          {/* Top Chat Header */}
          <div className="h-16 px-6 bg-white border-b border-slate-100 flex items-center justify-between shrink-0 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs">
                {activeConversation.contact_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-slate-900 truncate">
                    {activeConversation.contact_name}
                  </h3>
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    activeConversation.status === 'open' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {activeConversation.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                  <span>{activeConversation.contact_phone}</span>
                  <span>•</span>
                  <span className="text-emerald-700 font-bold">{outletName}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeConversation.status === 'open' ? (
                <button
                  onClick={() => onUpdateStatus(activeConversation.id, 'resolved')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl transition-all"
                  title="Resolve Conversation"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Resolve</span>
                </button>
              ) : (
                <button
                  onClick={() => onUpdateStatus(activeConversation.id, 'open')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                  title="Reopen Conversation"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="hidden sm:inline">Reopen</span>
                </button>
              )}

              <button
                onClick={() => setShowRightDrawer(!showRightDrawer)}
                className={`p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-all ${
                  showRightDrawer ? 'bg-slate-100 text-slate-900' : ''
                }`}
                title="Guest Context Info"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* WhatsApp Message Wallpaper & Timeline */}
          <div className="flex-1 p-6 overflow-y-auto space-y-3.5 custom-scrollbar">
            {/* Encryption & Security Notice */}
            <div className="max-w-md mx-auto my-2 p-2.5 bg-amber-50/90 border border-amber-200/70 rounded-2xl text-[11px] text-amber-800 text-center font-medium shadow-sm flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Messages are protected by Meta WhatsApp End-to-End Encryption and isolated to {outletName}.
              </span>
            </div>

            {messages.map((msg) => {
              const isOutgoing = msg.sender_type === 'agent' || msg.sender_type === 'bot';
              return (
                <div
                  key={msg.id}
                  className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] md:max-w-[65%] rounded-2xl px-4 py-2.5 shadow-sm text-xs relative ${
                      isOutgoing
                        ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-xs border border-emerald-200/50'
                        : 'bg-white text-slate-900 rounded-tl-xs border border-slate-200/70'
                    }`}
                  >
                    {isOutgoing && (
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block mb-0.5">
                        {msg.sender_name || 'Staff Agent'} {msg.sender_type === 'bot' && '• Automated'}
                      </span>
                    )}

                    <p className="whitespace-pre-wrap leading-relaxed">{msg.message_text}</p>

                    <div className="flex items-center justify-end gap-1.5 mt-1 text-[10px] text-slate-400">
                      <span>{format(new Date(msg.timestamp), 'HH:mm')}</span>
                      {isOutgoing && (
                        msg.status === 'read' ? (
                          <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                        ) : msg.status === 'delivered' ? (
                          <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-slate-400" />
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Snippet Bar */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-200/60 flex items-center gap-2 overflow-x-auto">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0">
              Quick Replies:
            </span>
            {quickSnippets.map((snip, idx) => (
              <button
                key={idx}
                onClick={() => setInputText(snip)}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-lg truncate shrink-0 max-w-[220px]"
              >
                {snip}
              </button>
            ))}
          </div>

          {/* Message Composer Footer */}
          <div className="p-4 bg-white border-t border-slate-100 relative">
            {/* Template Picker Popup */}
            {showTemplateDropdown && (
              <div className="absolute bottom-20 left-4 right-4 md:right-auto md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 z-20 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                  <span className="text-xs font-black uppercase text-slate-700">Meta Approved Templates</span>
                  <button
                    onClick={() => setShowTemplateDropdown(false)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar">
                  {templates.map(tmpl => (
                    <div
                      key={tmpl.id}
                      onClick={() => handleApplyTemplate(tmpl)}
                      className="p-2.5 rounded-xl hover:bg-emerald-50 cursor-pointer transition-colors border border-transparent hover:border-emerald-200"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{tmpl.name}</span>
                        <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                          {tmpl.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{tmpl.body_text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSend} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all text-xs font-bold flex items-center gap-1.5 shrink-0"
                title="Insert WhatsApp Template"
              >
                <FileText className="w-4 h-4 text-emerald-600" />
                <span className="hidden sm:inline">Templates</span>
              </button>

              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Type a WhatsApp message (Enter to send)..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={!inputText.trim() || isSending}
                className="w-11 h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20 active:scale-95 transition-all shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-12 text-center text-slate-400 bg-slate-50/50">
          <div>
            <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-black uppercase text-slate-700">Select a conversation</h3>
            <p className="text-xs text-slate-500 mt-1">Choose a chat from the sidebar to view message history</p>
          </div>
        </div>
      )}

      {/* 3. Right Sidebar: Guest Context Card (Collapsible) */}
      {activeConversation && showRightDrawer && (
        <div className="w-full md:w-72 lg:w-80 border-t md:border-t-0 md:border-l border-slate-100 bg-white p-5 flex flex-col overflow-y-auto custom-scrollbar shrink-0">
          <div className="text-center pb-4 border-b border-slate-100">
            <div className="w-16 h-16 rounded-3xl bg-slate-900 text-white text-lg font-black flex items-center justify-center mx-auto mb-2 shadow-lg">
              {activeConversation.contact_name.charAt(0).toUpperCase()}
            </div>
            <h3 className="text-sm font-black text-slate-900">{activeConversation.contact_name}</h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{activeConversation.contact_phone}</p>
            
            <a
              href={`https://wa.me/${activeConversation.contact_phone.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold rounded-xl transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open WhatsApp App
            </a>
          </div>

          {/* Location / Scope Verified */}
          <div className="py-4 border-b border-slate-100 space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Outlet Context
            </span>
            <div className="bg-slate-50 p-3 rounded-2xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Property:</span>
                <span className="font-bold text-slate-800">{propertyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Outlet:</span>
                <span className="font-bold text-emerald-700">{outletName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Company:</span>
                <span className="font-bold text-slate-800">{companyName.split(' ')[0]}</span>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="py-4 border-b border-slate-100">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
              Guest Tags
            </span>
            <div className="flex flex-wrap gap-1.5">
              {activeConversation.tags.map(t => (
                <span key={t} className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-xl">
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Linked Member Info */}
          <div className="py-4 border-b border-slate-100 space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Membership Information
            </span>
            <div className="bg-slate-50 p-3 rounded-2xl space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Member #:</span>
                <span className="font-mono font-bold text-slate-900">
                  {activeConversation.member_id ? `#${activeConversation.member_id}` : 'Non-Member Guest'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tier:</span>
                <span className="font-bold text-indigo-600">VIP Platinum Tier</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Valid Until:</span>
                <span className="font-bold text-emerald-600">Active (2026)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
