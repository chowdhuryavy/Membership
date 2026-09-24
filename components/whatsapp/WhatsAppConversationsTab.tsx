import React, { useState, useEffect, useMemo } from 'react';
import { WhatsAppConversation, WhatsAppMessage, WhatsAppTemplate } from '../../types';
import { WhatsAppChatBox } from './WhatsAppChatBox';
import { WhatsAppIcon } from '../WhatsAppIcon';
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
  ChevronRight, 
  ExternalLink,
  Building2,
  Info,
  CheckCircle2,
  RotateCcw
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
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [showRightDrawer, setShowRightDrawer] = useState(false);

  // Auto-select first conversation if none selected
  useEffect(() => {
    if (!activeConversationId && conversations.length > 0) {
      onSelectConversation(conversations[0].id);
    }
  }, [activeConversationId, conversations, onSelectConversation]);

  const activeConversation = useMemo(() => {
    return conversations.find(c => c.id === activeConversationId) || null;
  }, [conversations, activeConversationId]);

  const filteredConversations = useMemo(() => {
    if (!sidebarSearch.trim()) return conversations;
    const q = sidebarSearch.toLowerCase();
    return conversations.filter(
      c => c.contact_name.toLowerCase().includes(q) || c.contact_phone.includes(q)
    );
  }, [conversations, sidebarSearch]);

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

      {/* 2. Center: Authentic WhatsApp Chat Box */}
      <WhatsAppChatBox
        conversation={activeConversation}
        messages={messages}
        templates={templates}
        outletName={outletName}
        propertyName={propertyName}
        onSendMessage={onSendMessage}
        onUpdateStatus={onUpdateStatus}
        isSending={isSending}
        isSplitView={false}
      />

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
              <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-600" />
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
