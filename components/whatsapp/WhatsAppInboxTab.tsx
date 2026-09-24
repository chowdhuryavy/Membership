import React, { useState, useMemo } from 'react';
import { WhatsAppConversation, WhatsAppTemplate } from '../../types';
import { 
  MessageSquare, 
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
  ArrowRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface WhatsAppInboxTabProps {
  conversations: WhatsAppConversation[];
  templates: WhatsAppTemplate[];
  onOpenConversation: (conversationId: string) => void;
  onStartNewChat: (name: string, phone: string, initialMessage: string, memberId?: string) => Promise<void>;
  isLoading: boolean;
  outletName: string;
}

export const WhatsAppInboxTab: React.FC<WhatsAppInboxTabProps> = ({
  conversations,
  templates,
  onOpenConversation,
  onStartNewChat,
  isLoading,
  outletName
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'unread' | 'open' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);

  // New Chat Form State
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestPhone, setNewGuestPhone] = useState('');
  const [newMemberId, setNewMemberId] = useState('');
  const [newInitialMsg, setNewInitialMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  return (
    <div className="space-y-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Total Chats</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{totalCount}</div>
            <span className="text-[11px] text-slate-500 font-medium">Isolated for {outletName}</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
            <Inbox className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600">Unread Messages</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">{unreadCount}</div>
            <span className="text-[11px] text-slate-500 font-medium">Pending staff response</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
            <MessageSquare className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-600">Open Inquiries</span>
            <div className="text-2xl font-black text-blue-600 mt-1">{openCount}</div>
            <span className="text-[11px] text-slate-500 font-medium">Active conversations</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Resolved Today</span>
            <div className="text-2xl font-black text-slate-700 mt-1">{resolvedCount}</div>
            <span className="text-[11px] text-emerald-600 font-bold">100% Delivery rate</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
            <CheckCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Action Header */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by guest name, phone, or message..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              filterStatus === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({totalCount})
          </button>
          <button
            onClick={() => setFilterStatus('unread')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              filterStatus === 'unread'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            Unread ({unreadCount})
          </button>
          <button
            onClick={() => setFilterStatus('open')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              filterStatus === 'open'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            Open ({openCount})
          </button>
          <button
            onClick={() => setFilterStatus('resolved')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              filterStatus === 'resolved'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Resolved ({resolvedCount})
          </button>

          <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

          {/* New Chat Button */}
          <button
            onClick={() => setIsNewChatModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/20 active:scale-95 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            New WhatsApp Chat
          </button>
        </div>
      </div>

      {/* Conversations List */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden divide-y divide-slate-100">
        {filteredConversations.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-3xl bg-slate-50 border border-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Inbox className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">No Conversations Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? 'No messages matching your search query. Try clearing your filters.'
                : `No conversations logged for this outlet yet. Click "New WhatsApp Chat" to initiate communication.`}
            </p>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const hasUnread = conv.unread_count > 0;
            const timeAgo = formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true });

            return (
              <div
                key={conv.id}
                onClick={() => onOpenConversation(conv.id)}
                className={`p-4 md:p-5 flex items-center justify-between gap-4 hover:bg-slate-50/80 cursor-pointer transition-colors ${
                  hasUnread ? 'bg-emerald-50/20' : ''
                }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700 text-white flex items-center justify-center font-black text-sm shadow-md">
                      {conv.avatar_url ? (
                        <img
                          src={conv.avatar_url}
                          alt={conv.contact_name}
                          className="w-full h-full object-cover rounded-2xl"
                        />
                      ) : (
                        conv.contact_name.charAt(0).toUpperCase()
                      )}
                    </div>
                    {hasUnread && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px] font-black ring-2 ring-white">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className={`text-xs md:text-sm font-black tracking-tight ${hasUnread ? 'text-slate-900' : 'text-slate-800'}`}>
                        {conv.contact_name}
                      </h4>
                      <span className="text-[11px] text-slate-400 font-mono font-medium">
                        {conv.contact_phone}
                      </span>
                      {conv.tags.map(t => (
                        <span key={t} className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase tracking-wider">
                          {t}
                        </span>
                      ))}
                    </div>

                    <p className={`text-xs mt-1 truncate max-w-md md:max-w-xl ${hasUnread ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
                      {conv.last_message}
                    </p>
                  </div>
                </div>

                {/* Right metadata & Action */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right hidden sm:block">
                    <span className="text-[11px] font-semibold text-slate-400 block">{timeAgo}</span>
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mt-1 ${
                        conv.status === 'open'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {conv.status}
                    </span>
                  </div>

                  <div className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-emerald-600 hover:text-white flex items-center justify-center text-slate-500 transition-colors">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Chat Modal */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight text-slate-900">Initiate WhatsApp Conversation</h3>
                  <p className="text-xs text-slate-500">Sends directly to guest from {outletName}</p>
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
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
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
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
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
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
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
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">
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
                      className="text-[11px] font-bold text-emerald-600 bg-transparent border-none outline-none cursor-pointer"
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
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all flex items-center gap-2"
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
