import React, { useState, useEffect, useRef, useMemo } from 'react';
import { WhatsAppConversation, WhatsAppMessage, WhatsAppTemplate } from '../../types';
import { WhatsAppIcon } from '../WhatsAppIcon';
import { 
  Send, 
  Smile, 
  Paperclip, 
  Mic, 
  Check, 
  CheckCheck, 
  Phone, 
  Video, 
  Search, 
  MoreVertical, 
  FileText, 
  Image as ImageIcon, 
  Lock, 
  RotateCcw, 
  CheckCircle2, 
  Copy, 
  ChevronDown, 
  ArrowDown, 
  User, 
  QrCode, 
  Clock, 
  X,
  Play,
  Pause,
  ExternalLink,
  Sparkles,
  Maximize2
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import toast from 'react-hot-toast';

interface WhatsAppChatBoxProps {
  conversation: WhatsAppConversation | null;
  messages: WhatsAppMessage[];
  templates: WhatsAppTemplate[];
  outletName: string;
  propertyName: string;
  onSendMessage: (text: string, templateId?: string) => Promise<void>;
  onUpdateStatus: (conversationId: string, status: 'open' | 'resolved') => Promise<void>;
  isSending?: boolean;
  onOpenFullConsole?: () => void;
  isSplitView?: boolean;
}

const QUICK_EMOJIS = ['👍', '❤️', '🙏', '😊', '🔥', '💪', '👋', '✅', '🏋️', '💆'];

export const WhatsAppChatBox: React.FC<WhatsAppChatBoxProps> = ({
  conversation,
  messages,
  templates,
  outletName,
  propertyName,
  onSendMessage,
  onUpdateStatus,
  isSending = false,
  onOpenFullConsole,
  isSplitView = false
}) => {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showInChatSearch, setShowInChatSearch] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState('');
  const [activeReactionMessageId, setActiveReactionMessageId] = useState<string | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, string>>({});
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle scroll detection for "Scroll to bottom" button
  const handleScroll = () => {
    if (!chatScrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatScrollContainerRef.current;
    const isFarFromBottom = scrollHeight - scrollTop - clientHeight > 150;
    setShowScrollBottom(isFarFromBottom);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isSending) return;
    const text = inputText;
    setInputText('');
    setShowEmojiPicker(false);
    setShowAttachMenu(false);
    await onSendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApplyTemplate = (tmpl: WhatsAppTemplate) => {
    const guestName = conversation?.contact_name || 'Valued Guest';
    let body = tmpl.body_text.replace(/\{\{1\}\}/g, guestName);
    body = body.replace(/\{\{2\}\}/g, conversation?.member_id || '101');
    body = body.replace(/\{\{3\}\}/g, outletName);
    setInputText(body);
    setShowTemplateModal(false);
    textareaRef.current?.focus();
  };

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Message copied to clipboard');
  };

  const handleToggleReaction = (msgId: string, emoji: string) => {
    setMessageReactions(prev => {
      const next = { ...prev };
      if (next[msgId] === emoji) {
        delete next[msgId];
      } else {
        next[msgId] = emoji;
      }
      return next;
    });
    setActiveReactionMessageId(null);
  };

  // Filter messages if search active
  const displayedMessages = useMemo(() => {
    if (!inChatSearchQuery.trim()) return messages;
    const q = inChatSearchQuery.toLowerCase();
    return messages.filter(m => m.message_text.toLowerCase().includes(q));
  }, [messages, inChatSearchQuery]);

  // Group messages by date for authentic WhatsApp date separator pills
  const groupedMessages = useMemo(() => {
    const groups: { dateLabel: string; items: WhatsAppMessage[] }[] = [];
    let currentDate = '';
    let currentGroup: WhatsAppMessage[] = [];

    displayedMessages.forEach(msg => {
      const msgDate = new Date(msg.timestamp);
      let label = format(msgDate, 'MMMM d, yyyy');
      if (isToday(msgDate)) label = 'TODAY';
      else if (isYesterday(msgDate)) label = 'YESTERDAY';

      if (label !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ dateLabel: currentDate, items: currentGroup });
        }
        currentDate = label;
        currentGroup = [msg];
      } else {
        currentGroup.push(msg);
      }
    });

    if (currentGroup.length > 0) {
      groups.push({ dateLabel: currentDate, items: currentGroup });
    }

    return groups;
  }, [displayedMessages]);

  const quickReplies = [
    `Welcome to ${outletName}! How can we assist your visit today?`,
    `Your session reservation is confirmed. We look forward to seeing you!`,
    `Our facilities are open daily from 06:00 AM to 10:00 PM.`,
    `Here is your digital member access pass for your upcoming check-in.`
  ];

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] p-8 text-center select-none h-full min-h-[500px]">
        <div className="w-20 h-20 rounded-full bg-emerald-100/80 flex items-center justify-center text-emerald-600 mb-4 shadow-sm">
          <WhatsAppIcon className="w-10 h-10 text-emerald-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-1">WhatsApp Smart Hub</h3>
        <p className="text-xs text-slate-500 max-w-sm leading-relaxed mb-6">
          Select a conversation from the left to start live messaging with guests and manage automated inquiries for <span className="font-semibold text-slate-700">{outletName}</span>.
        </p>
        <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-white px-4 py-2 rounded-full border border-slate-200/80 shadow-xs">
          <Lock className="w-3.5 h-3.5 text-emerald-600" />
          <span>End-to-End Encrypted & Scoped to {outletName}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-[#efeae2] relative overflow-hidden select-text">
      {/* Authentic WhatsApp Background Pattern Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.06] mix-blend-multiply"
        style={{
          backgroundImage: `radial-gradient(#075e54 1.5px, transparent 1.5px), radial-gradient(#128c7e 1.5px, #efeae2 1.5px)`,
          backgroundSize: '36px 36px',
          backgroundPosition: '0 0, 18px 18px'
        }}
      />

      {/* 1. AUTHENTIC WHATSAPP HEADER */}
      <div className="h-16 px-4 md:px-5 bg-[#f0f2f5] border-b border-[#e9edef] flex items-center justify-between shrink-0 z-10 shadow-xs">
        <div className="flex items-center gap-3 min-w-0 cursor-pointer">
          {/* Avatar with Online Pulse */}
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center text-slate-700 font-bold text-sm overflow-hidden shadow-xs border border-white">
              {conversation.avatar_url ? (
                <img src={conversation.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                conversation.contact_name.charAt(0).toUpperCase()
              )}
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#25d366] border-2 border-white rounded-full" title="Online" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#111b21] truncate leading-tight">
                {conversation.contact_name}
              </h3>
              {conversation.member_id && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-white text-emerald-800 rounded border border-emerald-200">
                  ID: #{conversation.member_id}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#667781] leading-tight mt-0.5 truncate">
              <span className="text-[#25d366] font-semibold">online</span>
              <span>•</span>
              <span className="font-mono text-[10.5px]">{conversation.contact_phone}</span>
              <span>•</span>
              <span className="text-slate-600 font-medium truncate">{outletName}</span>
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-1 md:gap-2 text-[#54656f]">
          {/* In-Chat Search Button */}
          <button
            onClick={() => setShowInChatSearch(!showInChatSearch)}
            className={`p-2 rounded-full hover:bg-black/5 transition-colors cursor-pointer ${showInChatSearch ? 'bg-black/10 text-[#111b21]' : ''}`}
            title="Search in chat"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* WhatsApp Web Direct Link */}
          <a
            href={`https://wa.me/${conversation.contact_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${conversation.contact_name}, this is ${outletName} (${propertyName}).`)}`}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-full hover:bg-black/5 hover:text-emerald-700 transition-colors cursor-pointer hidden sm:flex"
            title="Open in WhatsApp Web"
          >
            <WhatsAppIcon className="w-4 h-4 text-emerald-600" />
          </a>

          {/* Resolve / Reopen Status Toggle */}
          {conversation.status === 'open' ? (
            <button
              onClick={() => onUpdateStatus(conversation.id, 'resolved')}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-full shadow-xs active:scale-95 transition-all cursor-pointer"
              title="Mark as Resolved"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Resolve</span>
            </button>
          ) : (
            <button
              onClick={() => onUpdateStatus(conversation.id, 'open')}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-full shadow-xs active:scale-95 transition-all cursor-pointer"
              title="Reopen conversation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Reopen</span>
            </button>
          )}

          {isSplitView && onOpenFullConsole && (
            <button
              onClick={onOpenFullConsole}
              className="p-2 rounded-full hover:bg-black/5 transition-colors cursor-pointer"
              title="Maximize Console"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}

          {/* More Options Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowOptionsMenu(!showOptionsMenu)}
              className="p-2 rounded-full hover:bg-black/5 transition-colors cursor-pointer"
              title="Menu"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showOptionsMenu && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-50 animate-in fade-in zoom-in-95">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(conversation.contact_phone);
                    toast.success('Phone number copied');
                    setShowOptionsMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-2 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  Copy Phone Number
                </button>
                <button
                  onClick={() => {
                    setShowTemplateModal(true);
                    setShowOptionsMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-2 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  Insert HSM Template
                </button>
                <button
                  onClick={() => {
                    onUpdateStatus(conversation.id, conversation.status === 'open' ? 'resolved' : 'open');
                    setShowOptionsMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  {conversation.status === 'open' ? 'Mark Resolved' : 'Reopen Conversation'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* In-Chat Keyword Search Bar */}
      {showInChatSearch && (
        <div className="px-4 py-2 bg-white border-b border-[#e9edef] flex items-center gap-2 z-10 animate-in slide-in-from-top-2">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search messages in this conversation..."
            value={inChatSearchQuery}
            onChange={(e) => setInChatSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none"
            autoFocus
          />
          {inChatSearchQuery && (
            <button
              onClick={() => setInChatSearchQuery('')}
              className="text-xs text-slate-400 hover:text-slate-600 px-1"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => {
              setShowInChatSearch(false);
              setInChatSearchQuery('');
            }}
            className="p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. CHAT TIMELINE / MESSAGE AREA */}
      <div 
        ref={chatScrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 p-4 md:p-6 overflow-y-auto space-y-3 custom-scrollbar relative z-0"
      >
        {/* Authentic WhatsApp Encryption Banner */}
        <div className="max-w-md mx-auto my-2 p-2.5 bg-[#ffeecd] border border-[#f0d5a3]/70 rounded-xl text-[11px] text-[#54656f] text-center font-medium shadow-xs flex items-center justify-center gap-2">
          <Lock className="w-3.5 h-3.5 text-[#54656f] shrink-0" />
          <span>
            Messages are end-to-end encrypted and isolated to <strong>{outletName}</strong> ({propertyName}).
          </span>
        </div>

        {groupedMessages.map((group) => (
          <div key={group.dateLabel} className="space-y-3">
            {/* WhatsApp Date Divider Pill */}
            <div className="flex justify-center my-3">
              <span className="px-3 py-1 bg-white/90 backdrop-blur-xs text-[#54656f] text-[10.5px] font-bold rounded-lg shadow-xs border border-[#e9edef] uppercase tracking-wider">
                {group.dateLabel}
              </span>
            </div>

            {group.items.map((msg) => {
              const isOutgoing = msg.sender_type === 'agent' || msg.sender_type === 'bot';
              const reaction = messageReactions[msg.id];
              const isBot = msg.sender_type === 'bot';

              return (
                <div
                  key={msg.id}
                  className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} group/msg relative`}
                  onMouseLeave={() => {
                    if (activeReactionMessageId === msg.id) {
                      setActiveReactionMessageId(null);
                    }
                  }}
                >
                  {/* Floating Action Menu (Reaction + Copy) on hover */}
                  <div className={`absolute top-0 ${isOutgoing ? 'right-full mr-2' : 'left-full ml-2'} hidden group-hover/msg:flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2 py-1 shadow-md z-10`}>
                    <button
                      onClick={() => setActiveReactionMessageId(activeReactionMessageId === msg.id ? null : msg.id)}
                      className="text-xs hover:scale-125 transition-transform text-slate-500 hover:text-slate-800"
                      title="React"
                    >
                      <Smile className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleCopyMessage(msg.message_text)}
                      className="text-xs hover:scale-125 transition-transform text-slate-500 hover:text-slate-800"
                      title="Copy"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Reaction Palette Popover */}
                  {activeReactionMessageId === msg.id && (
                    <div className={`absolute -top-10 ${isOutgoing ? 'right-0' : 'left-0'} flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2 py-1 shadow-xl z-20 animate-in zoom-in-95`}>
                      {QUICK_EMOJIS.slice(0, 6).map(em => (
                        <button
                          key={em}
                          onClick={() => handleToggleReaction(msg.id, em)}
                          className="text-base hover:scale-130 transition-transform px-1 cursor-pointer"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* WhatsApp Message Bubble */}
                  <div
                    className={`max-w-[85%] md:max-w-[70%] px-3.5 py-2 text-[13px] relative shadow-xs transition-all ${
                      isOutgoing
                        ? 'bg-[#d9fdd3] text-[#111b21] rounded-2xl rounded-tr-xs border border-[#b2e6a9]/40'
                        : 'bg-white text-[#111b21] rounded-2xl rounded-tl-xs border border-[#e9edef]'
                    }`}
                  >
                    {/* Outgoing Sender Header */}
                    {isOutgoing && (
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#008069] flex items-center gap-1">
                          <WhatsAppIcon className="w-3 h-3 text-[#008069]" />
                          <span>{msg.sender_name || `${outletName} • ${propertyName}`}</span>
                        </span>
                        {isBot && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100/70 text-emerald-800">
                            Auto-Rule
                          </span>
                        )}
                      </div>
                    )}

                    {/* Incoming Sender Header */}
                    {!isOutgoing && (
                      <div className="text-[10.5px] font-bold text-[#53bdeb] mb-0.5">
                        {conversation.contact_name}
                      </div>
                    )}

                    {/* Message Text */}
                    <div className="whitespace-pre-wrap leading-relaxed break-words font-normal">
                      {msg.message_text}
                    </div>

                    {/* Audio Mock Player if voice note */}
                    {msg.message_text.toLowerCase().includes('voice note') && (
                      <div className="mt-2 p-2 bg-black/5 rounded-xl flex items-center gap-2.5">
                        <button
                          onClick={() => setIsAudioPlaying(isAudioPlaying === msg.id ? null : msg.id)}
                          className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0"
                        >
                          {isAudioPlaying === msg.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                        </button>
                        <div className="flex-1">
                          <div className="h-1 bg-slate-300 rounded-full overflow-hidden">
                            <div className={`h-full bg-emerald-600 ${isAudioPlaying === msg.id ? 'w-2/3 animate-pulse' : 'w-1/3'}`} />
                          </div>
                          <div className="flex justify-between text-[9px] text-slate-500 mt-1">
                            <span>0:18</span>
                            <span>Voice Note</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Bubble Bottom: Timestamp & Status Ticks */}
                    <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-[#667781] select-none">
                      <span>{format(new Date(msg.timestamp), 'HH:mm')}</span>
                      {isOutgoing && (
                        <span title={msg.status === 'read' ? 'Read' : msg.status === 'delivered' ? 'Delivered' : 'Sent'} className="flex items-center">
                          {msg.status === 'read' ? (
                            <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                          ) : msg.status === 'delivered' ? (
                            <CheckCheck className="w-3.5 h-3.5 text-[#8696a0]" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-[#8696a0]" />
                          )}
                        </span>
                      )}
                    </div>

                    {/* Reaction Badge on Bubble */}
                    {reaction && (
                      <div className={`absolute -bottom-2 ${isOutgoing ? 'left-2' : 'right-2'} bg-white border border-slate-200 rounded-full px-1.5 py-0.5 text-xs shadow-sm`}>
                        {reaction}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-24 right-6 w-9 h-9 bg-white text-slate-600 hover:text-slate-900 rounded-full shadow-lg border border-slate-200 flex items-center justify-center transition-all animate-in fade-in z-20 cursor-pointer hover:scale-110"
          title="Scroll to bottom"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}

      {/* 3. QUICK CHIPS BAR */}
      <div className="px-4 py-2 bg-[#f0f2f5] border-t border-[#e9edef] flex items-center gap-1.5 overflow-x-auto shrink-0 z-10 custom-scrollbar">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-emerald-600" />
          Quick Reply:
        </span>
        {quickReplies.map((reply, idx) => (
          <button
            key={idx}
            onClick={() => {
              setInputText(reply);
              textareaRef.current?.focus();
            }}
            className="px-2.5 py-1 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 text-[11px] font-semibold rounded-full truncate shrink-0 max-w-[240px] cursor-pointer transition-all shadow-2xs"
          >
            {reply}
          </button>
        ))}
      </div>

      {/* 4. ATTACHMENT POPUP MENU */}
      {showAttachMenu && (
        <div className="absolute bottom-20 left-12 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-30 flex flex-col gap-1 w-52 animate-in fade-in zoom-in-95">
          <button
            onClick={() => {
              setShowTemplateModal(true);
              setShowAttachMenu(false);
            }}
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-800 hover:bg-emerald-50 hover:text-emerald-900 rounded-xl cursor-pointer transition-colors"
          >
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>HSM Approved Template</span>
          </button>
          <button
            onClick={() => {
              setInputText(`Here is your QR check-in pass for ${outletName}: https://hcm.app/pass/${conversation.member_id || 'guest'}`);
              setShowAttachMenu(false);
              textareaRef.current?.focus();
            }}
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-800 hover:bg-indigo-50 hover:text-indigo-900 rounded-xl cursor-pointer transition-colors"
          >
            <QrCode className="w-4 h-4 text-indigo-600" />
            <span>Digital Pass Link</span>
          </button>
          <button
            onClick={() => {
              setInputText(`[Agreement Attached] Please review and sign your facility membership contract.`);
              setShowAttachMenu(false);
              textareaRef.current?.focus();
            }}
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-800 hover:bg-amber-50 hover:text-amber-900 rounded-xl cursor-pointer transition-colors"
          >
            <FileText className="w-4 h-4 text-amber-600" />
            <span>Membership PDF</span>
          </button>
        </div>
      )}

      {/* 5. EMOJI PALETTE POPUP */}
      {showEmojiPicker && (
        <div className="absolute bottom-20 left-4 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 z-30 w-72 animate-in fade-in zoom-in-95">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Frequent Reactions
          </div>
          <div className="grid grid-cols-5 gap-2 text-2xl">
            {QUICK_EMOJIS.map(em => (
              <button
                key={em}
                onClick={() => {
                  setInputText(prev => prev + em);
                  textareaRef.current?.focus();
                }}
                className="hover:scale-125 transition-transform p-1 cursor-pointer flex items-center justify-center rounded-lg hover:bg-slate-100"
              >
                {em}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 6. TEMPLATE PICKER MODAL */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-black text-slate-900 uppercase">Meta Approved Templates</h3>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1 custom-scrollbar">
              {templates.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No templates configured for this venue.
                </div>
              ) : (
                templates.map(tmpl => (
                  <div
                    key={tmpl.id}
                    onClick={() => handleApplyTemplate(tmpl)}
                    className="p-3.5 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-800">{tmpl.name}</h4>
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {tmpl.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{tmpl.body_text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. AUTHENTIC WHATSAPP COMPOSER BOTTOM BAR */}
      <div className="p-3 bg-[#f0f2f5] border-t border-[#e9edef] flex items-center gap-2 shrink-0 z-20">
        {/* Emoji Button */}
        <button
          type="button"
          onClick={() => {
            setShowEmojiPicker(!showEmojiPicker);
            setShowAttachMenu(false);
          }}
          className={`p-2.5 rounded-full hover:bg-black/5 text-[#54656f] transition-colors cursor-pointer ${showEmojiPicker ? 'text-emerald-600' : ''}`}
          title="Emoji"
        >
          <Smile className="w-5 h-5" />
        </button>

        {/* Attachment Paperclip */}
        <button
          type="button"
          onClick={() => {
            setShowAttachMenu(!showAttachMenu);
            setShowEmojiPicker(false);
          }}
          className={`p-2.5 rounded-full hover:bg-black/5 text-[#54656f] transition-colors cursor-pointer ${showAttachMenu ? 'text-emerald-600' : ''}`}
          title="Attach"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Input Field */}
        <div className="flex-1 bg-white rounded-xl shadow-xs border border-transparent focus-within:border-emerald-500 flex items-center px-4 py-2 transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Type a message to ${conversation.contact_name}...`}
            className="w-full bg-transparent text-[13.5px] text-[#111b21] placeholder:text-[#8696a0] focus:outline-none resize-none max-h-32 custom-scrollbar leading-normal"
          />
        </div>

        {/* Send / Mic Button */}
        {inputText.trim() ? (
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={isSending}
            className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-50 text-white flex items-center justify-center shadow-md active:scale-95 transition-transform cursor-pointer shrink-0"
            title="Send Message (Enter)"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setInputText(`[Voice Note from ${outletName}]`);
              textareaRef.current?.focus();
            }}
            className="w-10 h-10 rounded-full hover:bg-black/5 text-[#54656f] flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Record Voice Note"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default WhatsAppChatBox;
