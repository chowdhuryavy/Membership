import React, { useState, useMemo } from 'react';
import { WhatsAppConversation, WhatsAppMessage, WhatsAppTemplate } from '../../types';
import { WhatsAppChatBox } from './WhatsAppChatBox';
import { WhatsAppIcon } from '../WhatsAppIcon';
import { 
  Search, 
  Filter, 
  Plus, 
  Check, 
  CheckCheck, 
  Clock, 
  Phone, 
  User, 
  Tag, 
  Sparkles,
  Inbox,
  ArrowRight,
  Send,
  FileText,
  CheckCircle2,
  RotateCcw,
  Building2,
  Store,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Info,
  Maximize2
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface WhatsAppInboxTabProps {
  conversations: WhatsAppConversation[];
  templates: WhatsAppTemplate[];
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onOpenConversation: (conversationId: string) => void;
  onStartNewChat: (name: string, phone: string, initialMessage: string, memberId?: string) => Promise<void>;
  onSendMessage: (text: string, templateId?: string) => Promise<void>;
  onUpdateStatus: (conversationId: string, status: 'open' | 'resolved') => Promise<void>;
  isLoading: boolean;
  outletName: string;
  propertyName: string;
  isSending?: boolean;
  messages?: WhatsAppMessage[];
}

export const WhatsAppInboxTab: React.FC<WhatsAppInboxTabProps> = ({
  conversations,
  templates,
  activeConversationId,
  onSelectConversation,
  onOpenConversation,
  onStartNewChat,
  onSendMessage,
  onUpdateStatus,
  isLoading,
  outletName,
  propertyName,
  isSending = false,
  messages = []
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'unread' | 'open' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [quickReplyText, setQuickReplyText] = useState('');
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

  // New Chat Form State
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestPhone, setNewGuestPhone] = useState('');
  const [newMemberId, setNewMemberId] = useState('');
  const [newInitialMsg, setNewInitialMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active selected conversation
  const activeConversation = useMemo(() => {
    if (!activeConversationId && conversations.length > 0) return conversations[0];
    return conversations.find(c => c.id === activeConversationId) || conversations[0] || null;
  }, [conversations, activeConversationId]);

  // Filtered list
  const filteredConversations = useMemo(() => {
    return conversations.filter(c => {
      if (filterStatus === 'unread' && c.unread_count === 0) return false;
      if (filterStatus === 'open' && c.status !== 'open') return false;
      if (filterStatus === 'resolved' && c.status !== 'resolved') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.contact_name.toLowerCase().includes(q) ||
          c.contact_phone.includes(q) ||
          c.last_message.toLowerCase().includes(q) ||
          (c.member_id && c.member_id.toLowerCase().includes(q)) ||
          c.tags.some(t => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [conversations, filterStatus, searchQuery]);

  // KPIs
  const totalCount = conversations.length;
  const unreadCount = conversations.reduce((acc, c) => acc + (c.unread_count > 0 ? 1 : 0), 0);
  const openCount = conversations.filter(c => c.status === 'open').length;
  const resolvedCount = conversations.filter(c => c.status === 'resolved').length;

  const handleCreateChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGuestName.trim() || !newGuestPhone.trim() || !newInitialMsg.trim()) return;

    setIsSubmitting(true);
    try {
      await onStartNewChat(newGuestName, newGuestPhone, newInitialMsg, newMemberId || undefined);
      setIsNewChatModalOpen(false);
      setNewGuestName('');
      setNewGuestPhone('');
      setNewMemberId('');
      setNewInitialMsg('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendQuickReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickReplyText.trim() || isSending) return;
    const text = quickReplyText;
    setQuickReplyText('');
    await onSendMessage(text);
  };

  const handleApplyTemplate = (tmpl: WhatsAppTemplate) => {
    const guestName = activeConversation?.contact_name || 'Valued Guest';
    let body = tmpl.body_text.replace(/\{\{1\}\}/g, guestName);
    body = body.replace(/\{\{2\}\}/g, activeConversation?.member_id || '101');
    body = body.replace(/\{\{3\}\}/g, outletName);
    setQuickReplyText(body);
    setShowTemplateDropdown(false);
  };

  const quickSnippets = [
    `Welcome to ${outletName}! How may our concierge assist you today?`,
    `Your reservation at ${outletName} is confirmed. We look forward to your visit!`,
    `Our facilities operate daily from 08:00 AM to 10:00 PM.`
  ];

  return (
    <div className="space-y-6">
      {/* 1. Top Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Conversations</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{totalCount}</div>
            <span className="text-[11px] text-slate-500 font-medium">Scoped for {outletName}</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
            <Inbox className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Requires Action</span>
            <div className="text-2xl font-black text-emerald-700 mt-1">{unreadCount}</div>
            <span className="text-[11px] text-slate-500 font-medium">Unread guest replies</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black">
            <WhatsAppIcon className="w-6 h-6 text-emerald-700" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">Active Inquiries</span>
            <div className="text-2xl font-black text-blue-700 mt-1">{openCount}</div>
            <span className="text-[11px] text-slate-500 font-medium">Ongoing concierge chats</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-black">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Resolved Inquiries</span>
            <div className="text-2xl font-black text-slate-700 mt-1">{resolvedCount}</div>
            <span className="text-[11px] text-emerald-700 font-bold">100% Delivery rate</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black">
            <CheckCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 2. Filter, Search & Action Bar */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by guest, phone, member ID, or text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterStatus === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({totalCount})
          </button>
          <button
            onClick={() => setFilterStatus('unread')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterStatus === 'unread'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            Unread ({unreadCount})
          </button>
          <button
            onClick={() => setFilterStatus('open')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterStatus === 'open'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
            }`}
          >
            Open ({openCount})
          </button>
          <button
            onClick={() => setFilterStatus('resolved')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterStatus === 'resolved'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Resolved ({resolvedCount})
          </button>

          <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

          {/* New Chat Button */}
          <button
            onClick={() => setIsNewChatModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md shadow-emerald-700/20 active:scale-95 transition-all shrink-0 cursor-pointer"
          >
            <WhatsAppIcon className="w-4 h-4 text-white" />
            New WhatsApp Chat
          </button>
        </div>
      </div>

      {/* 3. Split Master-Detail Smart Inbox */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Conversation List */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col h-[700px]">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-black uppercase tracking-tight text-slate-800">
                {outletName} Messages
              </span>
            </div>
            <span className="text-[10px] font-bold text-slate-400">
              {filteredConversations.length} Active Threads
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
            {filteredConversations.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Inbox className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">No Conversations</h4>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                  {searchQuery
                    ? 'No chats match your filter criteria.'
                    : `No guest messages for ${outletName} yet.`}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = activeConversation?.id === conv.id;
                const hasUnread = conv.unread_count > 0;
                const timeAgo = formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true });

                return (
                  <div
                    key={conv.id}
                    onClick={() => onSelectConversation(conv.id)}
                    className={`p-4 flex items-start gap-3.5 cursor-pointer transition-all border-l-4 ${
                      isSelected
                        ? 'bg-emerald-50/70 border-emerald-700'
                        : hasUnread
                        ? 'bg-emerald-50/30 border-emerald-500 hover:bg-slate-50'
                        : 'border-transparent hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0 mt-0.5">
                      <div className="w-11 h-11 rounded-2xl bg-slate-800 text-white flex items-center justify-center font-black text-xs shadow-xs">
                        {conv.avatar_url ? (
                          <img src={conv.avatar_url} alt="" className="w-full h-full object-cover rounded-2xl" />
                        ) : (
                          conv.contact_name.charAt(0).toUpperCase()
                        )}
                      </div>
                      {hasUnread && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[10px] font-black ring-2 ring-white shadow-xs">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>

                    {/* Content Excerpt */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className={`text-xs font-black truncate ${hasUnread ? 'text-slate-900' : 'text-slate-800'}`}>
                          {conv.contact_name}
                        </h4>
                        <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                          {timeAgo}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono mt-0.5">
                        <span>{conv.contact_phone}</span>
                        {conv.member_id && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-sans">
                            #{conv.member_id}
                          </span>
                        )}
                      </div>

                      <p className={`text-xs mt-1 line-clamp-2 leading-relaxed ${hasUnread ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
                        {conv.last_message}
                      </p>

                      <div className="flex items-center justify-between mt-2 pt-1">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            conv.status === 'open' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {conv.status}
                          </span>
                          {conv.tags.slice(0, 2).map(t => (
                            <span key={t} className="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                              {t}
                            </span>
                          ))}
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateStatus(conv.id, conv.status === 'open' ? 'resolved' : 'open');
                          }}
                          className="text-[10px] font-bold text-slate-400 hover:text-emerald-700 flex items-center gap-1 transition-colors"
                          title={conv.status === 'open' ? 'Mark Resolved' : 'Reopen'}
                        >
                          {conv.status === 'open' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Resolve</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-3 h-3 text-slate-500" />
                              <span>Reopen</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Authentic WhatsApp Chat Box in Split-View */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col h-[700px]">
          <WhatsAppChatBox
            conversation={activeConversation}
            messages={messages}
            templates={templates}
            outletName={outletName}
            propertyName={propertyName}
            onSendMessage={onSendMessage}
            onUpdateStatus={onUpdateStatus}
            isSending={isSending}
            onOpenFullConsole={() => activeConversation && onOpenConversation(activeConversation.id)}
            isSplitView={true}
          />
        </div>
      </div>

      {/* 4. New Chat Modal */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-700/10 text-emerald-700 flex items-center justify-center">
                  <WhatsAppIcon className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight text-slate-900">Initiate WhatsApp Conversation</h3>
                  <p className="text-xs text-slate-500">
                    Sending as: <span className="font-bold text-emerald-800">{outletName} • {propertyName}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsNewChatModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateChat} className="space-y-4 mt-5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Guest Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sheikh Hamad Al-Thani"
                  value={newGuestName}
                  onChange={(e) => setNewGuestName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    WhatsApp Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+974 5512 8901"
                    value={newGuestPhone}
                    onChange={(e) => setNewGuestPhone(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Member ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1042"
                    value={newMemberId}
                    onChange={(e) => setNewMemberId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Initial Message *
                  </label>
                  {templates.length > 0 && (
                    <select
                      onChange={(e) => {
                        const t = templates.find(item => item.id === e.target.value);
                        if (t) {
                          setNewInitialMsg(t.body_text.replace('{{1}}', newGuestName || 'Guest'));
                        }
                      }}
                      defaultValue=""
                      className="text-[11px] font-bold text-emerald-800 bg-transparent border-none outline-none cursor-pointer"
                    >
                      <option value="" disabled>Insert Approved Template...</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <textarea
                  rows={4}
                  required
                  placeholder="Type the message or greeting here..."
                  value={newInitialMsg}
                  onChange={(e) => setNewInitialMsg(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewChatModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-700/20 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? 'Sending...' : 'Send WhatsApp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
